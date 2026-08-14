/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2627 (W3.1, epic 2618) — playbackController pure state-machine spec:
 * buffer-then-play transitions, chunk-window math, mixT/timestep advance,
 * stall detection + degradation, and the AC's "state survives quantity
 * switching" contract. No fetch/timer/DOM — every case drives the reducer
 * directly with hand-built actions/state.
 */
import expect from 'expect';
import {
    PLAYBACK_STATUS,
    createInitialPlaybackState,
    clampSpeed,
    timestepToChunkIndex,
    requiredChunkIndices,
    isWindowBuffered,
    mergeBufferedChunks,
    findTimestepBracket,
    colorMaxForQuantity,
    isColorMaxOverridden,
    colorMinForQuantity,
    clampOpacity,
    DEFAULT_PLAYBACK_OPACITY,
    MAX_SPEED,
    defaultSpeedForTime,
    simulatedSpanSeconds,
    playbackControllerReducer as reduce
} from '../playbackController';
import {
    playbackInit,
    playbackManifestLoaded,
    playbackManifestFailed,
    playbackChunksBuffered,
    playbackPlay,
    playbackPause,
    playbackSeek,
    playbackTick,
    playbackSetSpeed,
    playbackSetQuantity,
    playbackSetIdentifyArmed,
    playbackSetIdentifyResult,
    playbackSetLegendOpen,
    playbackSetWireframe,
    playbackReset
} from '../actions/playbackActions';

const TIME = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]; // 13 steps, matches fixturePlaybackStore

function loadedState(overrides = {}, mesh = null) {
    const base = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
        playbackManifestLoaded({
            runId: 7, manifest: { id: 'm' }, mesh, time: TIME, nTime: TIME.length, nNode: 6,
            chunkLengthT: 10, totalChunks: 2, quantization: { depth: { valid_max: 1 } }
        }));
    return { ...base, ...overrides };
}

function bufferedState(overrides = {}) {
    const s = loadedState(overrides);
    return reduce(s, playbackChunksBuffered([0, 1]));
}

describe('playbackController', () => {

    describe('createInitialPlaybackState', () => {
        it('starts idle with sane defaults', () => {
            const s = createInitialPlaybackState();
            expect(s.status).toBe(PLAYBACK_STATUS.IDLE);
            expect(s.quantity).toBe('depth');
            expect(s.speed).toBe(1);
            expect(s.bufferedChunks).toEqual([]);
            expect(s.identifyArmed).toBe(false);
            expect(s.legendOpen).toBe(false);
            // TASK-2656d (W6.5) — AC: wireframe toggle default OFF.
            expect(s.wireframe).toBe(false);
        });
    });

    describe('clampSpeed', () => {
        it('clamps into [MIN_SPEED, MAX_SPEED]', () => {
            expect(clampSpeed(0)).toBe(0.25);
            expect(clampSpeed(-5)).toBe(0.25);
            expect(clampSpeed(2)).toBe(2);
            // TASK-2744 AC17 raised MAX_SPEED from 8 to 20000: at 8x even a
            // 30-minute run took 3.75 minutes to watch end to end. 100 is now
            // a legitimate speed, not something to clamp away.
            expect(clampSpeed(100)).toBe(100);
            expect(clampSpeed(1e9)).toBe(MAX_SPEED);
        });
        it('falls back to the default for non-finite input', () => {
            expect(clampSpeed(NaN)).toBe(1);
            expect(clampSpeed(undefined)).toBe(1);
        });
    });

    describe('timestepToChunkIndex / requiredChunkIndices', () => {
        it('maps timestep -> O1 chunk index', () => {
            expect(timestepToChunkIndex(0, 10)).toBe(0);
            expect(timestepToChunkIndex(9, 10)).toBe(0);
            expect(timestepToChunkIndex(10, 10)).toBe(1);
            expect(timestepToChunkIndex(17, 10)).toBe(1);
        });
        it('returns one chunk when frame0/frame1 share a chunk', () => {
            expect(requiredChunkIndices(3, 18, 10)).toEqual([0]);
        });
        it('returns two chunks when frame1 crosses a chunk boundary', () => {
            expect(requiredChunkIndices(9, 18, 10)).toEqual([0, 1]);
        });
        it('clamps frame1 at the last timestep (mirrors loadPlaybackLayerOptions)', () => {
            expect(requiredChunkIndices(17, 18, 10)).toEqual([1]);
        });
    });

    describe('isWindowBuffered / mergeBufferedChunks', () => {
        it('requires every index in the window to be present', () => {
            expect(isWindowBuffered([0, 1, 2], [0, 1])).toBe(true);
            expect(isWindowBuffered([0], [0, 1])).toBe(false);
            expect(isWindowBuffered([], [])).toBe(true);
        });
        it('dedupes and sorts', () => {
            expect(mergeBufferedChunks([2, 0], [0, 1])).toEqual([0, 1, 2]);
        });
    });

    describe('findTimestepBracket', () => {
        it('clamps below the first sample', () => {
            expect(findTimestepBracket(TIME, -10)).toEqual({ currentTimestep: 0, mixT: 0 });
        });
        it('clamps at/after the last sample', () => {
            expect(findTimestepBracket(TIME, 1000)).toEqual({ currentTimestep: 12, mixT: 0 });
            expect(findTimestepBracket(TIME, 360)).toEqual({ currentTimestep: 12, mixT: 0 });
        });
        it('finds the exact bracket + mix fraction mid-interval', () => {
            const { currentTimestep, mixT } = findTimestepBracket(TIME, 45); // between t=30 and t=60
            expect(currentTimestep).toBe(1);
            expect(Math.abs(mixT - 0.5) < 1e-9).toBe(true);
        });
        it('returns mixT=0 exactly on a sample boundary', () => {
            expect(findTimestepBracket(TIME, 90)).toEqual({ currentTimestep: 3, mixT: 0 });
        });
        it('degrades gracefully with no time array', () => {
            expect(findTimestepBracket(null, 45)).toEqual({ currentTimestep: 0, mixT: 0 });
        });
    });

    describe('colorMaxForQuantity', () => {
        const quantization = {
            depth: { valid_min: 0, valid_max: 22.15 },
            x_velocity: { valid_min: -3.72, valid_max: 3.72 },
            y_velocity: { valid_min: -1.5, valid_max: 1.5 }
        };
        it('depth uses the depth array valid_max', () => {
            expect(colorMaxForQuantity('depth', quantization)).toBe(22.15);
        });
        it('speed uses the larger absolute velocity-component bound', () => {
            expect(colorMaxForQuantity('speed', quantization)).toBe(3.72);
        });
        it('falls back to 1 with no quantization metadata', () => {
            expect(colorMaxForQuantity('depth', null)).toBe(1);
            expect(colorMaxForQuantity('speed', {})).toBe(1);
        });

        // TASK-2629 (W4.1) — the six new derived quantities. hazard/froude/
        // shear/courant are FIXED caps (mirror playbackColormap.js's own
        // constants — cross-checked, not re-derived); div/stage rescale from
        // the manifest/run like depth/speed already did.
        it('hazard is the fixed classIndex cap (0..5, H1-H6), independent of quantization', () => {
            expect(colorMaxForQuantity('hazard', quantization)).toBe(5);
            expect(colorMaxForQuantity('hazard', null)).toBe(5);
        });
        it('froude/shear/courant use their own fixed engineering caps regardless of quantization', () => {
            expect(colorMaxForQuantity('froude', null)).toBe(3.0);
            expect(colorMaxForQuantity('shear', null)).toBe(500);
            expect(colorMaxForQuantity('courant', null)).toBe(4.0);
        });
        it('div uses the depth*velocity product bound from quantization', () => {
            expect(colorMaxForQuantity('div', quantization)).toBe(22.15 * 3.72);
        });
        it('div falls back to a sane default with no quantization', () => {
            expect(colorMaxForQuantity('div', null)).toBe(20);
        });
        it('stage rescales to this run\'s own [elevationMin, elevationMax+depthMax] span', () => {
            const context = { elevationMin: 10, elevationMax: 15 };
            expect(colorMaxForQuantity('stage', quantization, context)).toBe(15 + 22.15);
        });
        it('stage falls back to elevationMin+1 when the span is degenerate (no depth range)', () => {
            expect(colorMaxForQuantity('stage', null, { elevationMin: 10, elevationMax: 10 })).toBe(11);
        });
    });

    describe('colorMinForQuantity (AC: only stage is non-zero — a datum-absolute field)', () => {
        it('every non-stage quantity is 0', () => {
            ['depth', 'speed', 'div', 'hazard', 'froude', 'shear', 'courant'].forEach((q) => {
                expect(colorMinForQuantity(q, { elevationMin: 42 })).toBe(0);
            });
        });
        it('stage uses the run\'s own elevationMin', () => {
            expect(colorMinForQuantity('stage', { elevationMin: -3.5 })).toBe(-3.5);
        });
        it('stage falls back to 0 with no context', () => {
            expect(colorMinForQuantity('stage')).toBe(0);
            expect(colorMinForQuantity('stage', {})).toBe(0);
        });
    });

    describe('INIT / MANIFEST_LOADED / MANIFEST_FAILED', () => {
        it('INIT resets to a fresh loading-manifest state for the new run', () => {
            const s = reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1'));
            expect(s.status).toBe(PLAYBACK_STATUS.LOADING_MANIFEST);
            expect(s.runId).toBe(7);
            expect(s.layerId).toBe('layer-1');
        });
        it('MANIFEST_LOADED populates the store metadata and moves to buffering', () => {
            const mesh = { nodeX: new Float32Array([0]) };
            const s = loadedState({}, mesh);
            expect(s.status).toBe(PLAYBACK_STATUS.BUFFERING);
            expect(s.nTime).toBe(TIME.length);
            expect(s.nNode).toBe(6);
            expect(s.chunkLengthT).toBe(10);
            expect(s.time).toBe(TIME);
            expect(s.mesh).toBe(mesh);
            expect(s.playheadSeconds).toBe(0);
            expect(s.currentTimestep).toBe(0);
        });

        // TASK-2629 (W4.1) — the store-attr fields the six new formulas need,
        // read from schema_metadata (never hardcoded past the initial-state
        // fallback) and from the mesh's own elevation range.
        it('MANIFEST_LOADED reads hasDt/g/rhoW/wetThreshold from schema_metadata and elevationMin/Max from the mesh', () => {
            const mesh = { nodeX: new Float32Array([0]), elevationMin: -2, elevationMax: 12 };
            const dtMs = new Float32Array([NaN, 500, 500]);
            const s = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm', schema_metadata: { has_dt: true, g: 9.8, rho_w: 1023, minimum_storable_height: 0.005 } },
                    mesh, dtMs, time: TIME, nTime: TIME.length, nNode: 6, chunkLengthT: 10, totalChunks: 2, quantization: {}
                }));
            expect(s.hasDt).toBe(true);
            expect(s.g).toBe(9.8);
            expect(s.rhoW).toBe(1023);
            expect(s.wetThreshold).toBe(0.005);
            expect(s.elevationMin).toBe(-2);
            expect(s.elevationMax).toBe(12);
            expect(s.dtMs).toBe(dtMs);
        });
        it('MANIFEST_LOADED falls back to the initial-state defaults when schema_metadata omits a field', () => {
            const s = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({ runId: 7, manifest: { id: 'm' }, time: TIME, nTime: TIME.length, nNode: 6, chunkLengthT: 10, totalChunks: 2 }));
            expect(s.hasDt).toBe(false);
            expect(s.g).toBe(9.8);
            expect(s.rhoW).toBe(1000);
            expect(s.wetThreshold).toBe(1e-5);
        });
        it('AC: a MANIFEST_LOADED for the current run that flips hasDt to false falls a courant selection back to depth (state-consistency invariant — the picker itself can never offer courant with hasDt=false, but state must not silently keep an unavailable value either)', () => {
            // bufferedState()/loadedState() hard-code runId=7 — a SECOND
            // MANIFEST_LOADED for that SAME runId (not a fresh INIT, which
            // already resets quantity to depth on its own) is the only way
            // to exercise this branch directly.
            const wasCourant = bufferedState({ quantity: 'courant', hasDt: true, runId: 7 });
            const s = reduce(wasCourant, playbackManifestLoaded({
                runId: 7, manifest: { id: 'm2', schema_metadata: { has_dt: false } },
                time: TIME, nTime: TIME.length, nNode: 6, chunkLengthT: 10, totalChunks: 2
            }));
            expect(s.quantity).toBe('depth');
        });
        it('a non-courant selection survives a repeat MANIFEST_LOADED for the same run unchanged', () => {
            const wasSpeed = bufferedState({ quantity: 'speed', runId: 7 });
            const s = reduce(wasSpeed, playbackManifestLoaded({
                runId: 7, manifest: { id: 'm2', schema_metadata: { has_dt: false } },
                time: TIME, nTime: TIME.length, nNode: 6, chunkLengthT: 10, totalChunks: 2
            }));
            expect(s.quantity).toBe('speed');
        });
        it('ignores a MANIFEST_LOADED for a superseded runId', () => {
            const afterInit = reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1'));
            const stale = reduce(afterInit, playbackManifestLoaded({ runId: 6, time: TIME, nTime: 13, nNode: 6, chunkLengthT: 10, totalChunks: 2 }));
            expect(stale.status).toBe(PLAYBACK_STATUS.LOADING_MANIFEST);
        });
        it('MANIFEST_FAILED sets error status (current runId only)', () => {
            const afterInit = reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1'));
            const failed = reduce(afterInit, playbackManifestFailed(7, 'boom'));
            expect(failed.status).toBe(PLAYBACK_STATUS.ERROR);
            expect(failed.error).toBe('boom');
            const staleFailed = reduce(afterInit, playbackManifestFailed(999, 'boom'));
            expect(staleFailed.status).toBe(PLAYBACK_STATUS.LOADING_MANIFEST);
        });
    });

    describe('buffer-then-play (LOCKED, W0 memo F4)', () => {
        it('CHUNKS_BUFFERED moves buffering -> ready once the required window completes', () => {
            const s = reduce(loadedState(), playbackChunksBuffered([0]));
            expect(s.status).toBe(PLAYBACK_STATUS.READY);
            expect(s.bufferedChunks).toEqual([0]);
        });
        it('a partial buffer (window still incomplete) stays in buffering', () => {
            // timestep 9's window is [chunk0, chunk1] (requiredChunkIndices
            // crosses the boundary) — buffering only chunk0 must NOT flip
            // status; only completing chunk1 too does.
            const atBoundary = { ...loadedState(), currentTimestep: 9 };
            const half = reduce(atBoundary, playbackChunksBuffered([0]));
            expect(half.status).toBe(PLAYBACK_STATUS.BUFFERING);
            const full = reduce(half, playbackChunksBuffered([1]));
            expect(full.status).toBe(PLAYBACK_STATUS.READY);
        });
        it('PLAY on a buffered window starts playing immediately', () => {
            const s = reduce(bufferedState(), playbackPlay());
            expect(s.status).toBe(PLAYBACK_STATUS.PLAYING);
        });
        it('PLAY on an unbuffered window defers via pendingPlay, then auto-starts once buffered', () => {
            const s1 = reduce(loadedState(), playbackPlay());
            expect(s1.status).toBe(PLAYBACK_STATUS.BUFFERING);
            expect(s1.pendingPlay).toBe(true);
            const s2 = reduce(s1, playbackChunksBuffered([0]));
            expect(s2.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(s2.pendingPlay).toBe(false);
        });
        it('PAUSE while pending-play cancels the auto-start', () => {
            const s1 = reduce(loadedState(), playbackPlay());
            const s2 = reduce(s1, playbackPause());
            expect(s2.pendingPlay).toBe(false);
            const s3 = reduce(s2, playbackChunksBuffered([0]));
            expect(s3.status).toBe(PLAYBACK_STATUS.READY);
        });
        it('PAUSE while playing returns to ready', () => {
            const playing = reduce(bufferedState(), playbackPlay());
            const paused = reduce(playing, playbackPause());
            expect(paused.status).toBe(PLAYBACK_STATUS.READY);
        });
    });

    describe('SEEK (scrub)', () => {
        it('seeking into an already-buffered window keeps ready/playing status', () => {
            const playing = reduce(bufferedState(), playbackPlay());
            const seeked = reduce(playing, playbackSeek(5));
            expect(seeked.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(seeked.currentTimestep).toBe(5);
            expect(seeked.mixT).toBe(0);
            expect(seeked.playheadSeconds).toBe(TIME[5]);
        });
        it('seeking into an unbuffered window shows the distinct "seeking" buffering state', () => {
            // chunkLengthT=10, seek to timestep 12 -> needs chunk 1, not yet buffered.
            const s = reduce(loadedState(), playbackChunksBuffered([0]));
            const seeked = reduce(s, playbackSeek(12));
            expect(seeked.status).toBe(PLAYBACK_STATUS.SEEKING);
        });
        it('a scrub while playing resumes playing once the new window buffers', () => {
            // Only chunk 0 buffered (unlike bufferedState(), which has both) —
            // seeking to timestep 12 needs chunk 1, genuinely unbuffered here.
            const onlyChunk0Playing = reduce(reduce(loadedState(), playbackChunksBuffered([0])), playbackPlay());
            const seeked = reduce(onlyChunk0Playing, playbackSeek(12));
            expect(seeked.status).toBe(PLAYBACK_STATUS.SEEKING);
            expect(seeked.pendingPlay).toBe(true);
            const resumed = reduce(seeked, playbackChunksBuffered([1]));
            expect(resumed.status).toBe(PLAYBACK_STATUS.PLAYING);
        });
        it('clamps to [0, nTime-1]', () => {
            const s = reduce(bufferedState(), playbackSeek(999));
            expect(s.currentTimestep).toBe(TIME.length - 1);
            const s2 = reduce(bufferedState(), playbackSeek(-5));
            expect(s2.currentTimestep).toBe(0);
        });
    });

    describe('TICK (playhead advance)', () => {
        it('is a no-op unless status is playing', () => {
            const s = bufferedState();
            expect(reduce(s, playbackTick(1000))).toBe(s);
        });
        it('advances mixT within the current bracket using elapsed wall time * speed', () => {
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0, speed: 1 };
            // 15 real seconds elapsed, bracket [0,30] -> mixT = 0.5
            const ticked = reduce(playing, playbackTick(15000));
            expect(ticked.currentTimestep).toBe(0);
            expect(Math.abs(ticked.mixT - 0.5) < 1e-9).toBe(true);
            expect(ticked.playheadSeconds).toBe(15);
        });
        it('speed multiplies the advance', () => {
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0, speed: 4 };
            const ticked = reduce(playing, playbackTick(5000)); // 5s real * 4x = 20s sim
            expect(ticked.playheadSeconds).toBe(20);
        });
        it('crossing into an unbuffered chunk freezes the playhead and reports stalled', () => {
            // Only chunk 0 buffered (timesteps 0-9, t<=270); ticking far enough
            // to need timestep>=10 (chunk 1, t>=300) must NOT advance past the
            // buffered edge.
            const playing = { ...reduce(reduce(loadedState(), playbackChunksBuffered([0])), playbackPlay()), lastTickMs: 0 };
            const ticked = reduce(playing, playbackTick(350000)); // 350s sim time -> timestep 10+ (chunk 1)
            expect(ticked.status).toBe(PLAYBACK_STATUS.STALLED);
            expect(ticked.pendingPlay).toBe(true);
            // Frozen: currentTimestep/mixT/playheadSeconds unchanged from before this tick.
            expect(ticked.currentTimestep).toBe(playing.currentTimestep);
            expect(ticked.mixT).toBe(playing.mixT);
            expect(ticked.playheadSeconds).toBe(playing.playheadSeconds);
        });
        it('resumes playing automatically once the stalled-on chunk buffers', () => {
            const playing = { ...reduce(reduce(loadedState(), playbackChunksBuffered([0])), playbackPlay()), lastTickMs: 0 };
            const stalled = reduce(playing, playbackTick(350000));
            expect(stalled.status).toBe(PLAYBACK_STATUS.STALLED);
            const resumed = reduce(stalled, playbackChunksBuffered([1]));
            expect(resumed.status).toBe(PLAYBACK_STATUS.PLAYING);
        });
        it('sets degraded once a stall has LASTED, not once it has been counted', () => {
            // On a stall, lastTickMs advances but playheadSeconds/currentTimestep
            // stay frozen (buffer-then-play: pause the sim clock, don't skip
            // ahead) — so each subsequent tick must independently re-attempt a
            // big enough jump to re-discover chunk 1 is still unbuffered.
            //
            // This used to assert `degraded` on the THIRD stalled tick whatever
            // the clock said, which made the threshold 3 x TICK_INTERVAL_MS =
            // 150ms in production — shorter than any chunk fetch the prod-scale
            // store can do, so a healthy run raised it. The rule is now elapsed
            // stall time, and these ticks are 350 SECONDS apart: one gap is
            // already a hundred times over the bar.
            let s = { ...reduce(reduce(loadedState(), playbackChunksBuffered([0])), playbackPlay()), lastTickMs: 0 };
            s = reduce(s, playbackTick(350000));
            expect(s.status).toBe(PLAYBACK_STATUS.STALLED);
            expect(s.stallCount).toBe(1);
            // Nothing has ELAPSED yet — this tick is when the stall began.
            expect(s.degraded).toBe(false);
            expect(s.stalledSinceMs).toBe(350000);

            s = reduce(s, playbackTick(700000));
            expect(s.stallCount).toBe(2);
            expect(s.degraded).toBe(true);
        });
        it('reaching the end of the timeline pauses (does not loop)', () => {
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0 };
            const ticked = reduce(playing, playbackTick(1000000)); // way past t=360
            expect(ticked.status).toBe(PLAYBACK_STATUS.PAUSED);
            expect(ticked.currentTimestep).toBe(TIME.length - 1);
        });

        // TASK-2685 (W6.75.3, epic 2618) — Play at end-of-timeline is dead:
        // reproduced in the 2026-08-07 W6.5 manual UAT. PAUSED is the
        // DEDICATED "reached the end" status (createInitialPlaybackState's
        // comment; PLAYBACK_PAUSE always lands mid-timeline in READY, never
        // PAUSED) — Play must rewind-and-play from PAUSED rather than
        // resuming from the frozen end-of-timeline playhead (which the OLD
        // code did: it flipped straight back to PLAYING with playheadSeconds
        // still >= the last time value, so the very next TICK's `atEnd`
        // check fired immediately — one dead PLAYING frame, then back to
        // PAUSED, with currentTimestep never leaving the last frame:
        // "the button looks live and does nothing").
        it('AC: Play from PAUSED (end-of-timeline) rewinds to the first frame and plays — no manual scrub required', () => {
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0 };
            const atEnd = reduce(playing, playbackTick(1000000)); // way past t=360
            expect(atEnd.status).toBe(PLAYBACK_STATUS.PAUSED);
            expect(atEnd.currentTimestep).toBe(TIME.length - 1);

            const replayed = reduce(atEnd, playbackPlay());
            expect(replayed.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(replayed.currentTimestep).toBe(0);
            expect(replayed.playheadSeconds).toBe(TIME[0]);
            expect(replayed.mixT).toBe(0);

            // AND it actually MOVES on the next tick — the regression this
            // guards: the old code's very next TICK immediately re-hit
            // `atEnd` and flipped back to PAUSED with zero visible motion.
            // 35s > TIME's 30s first step, so this crosses into timestep 1
            // (not just a mixT nudge within timestep 0 — genuine frame
            // advance, matching the other large-jump TICK tests in this file).
            // TASK-2744 AC17: MANIFEST_LOADED now seeds `speed` from the
            // store's own duration (TIME spans 360 s -> 360/15 = 24x), so the
            // old 35 000 ms delta would advance 840 sim-seconds and land past
            // the end of the timeline. 2 000 ms at 24x is 48 sim-seconds:
            // still a genuine frame advance across TIME's 30 s first step,
            // which is what this test is actually guarding.
            const tickedAgain = reduce({ ...replayed, lastTickMs: 0 }, playbackTick(2000));
            expect(tickedAgain.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(tickedAgain.currentTimestep).toBeGreaterThan(0);
        });

        it('Play from PAUSED still respects buffer-then-play when frame 0\'s window is NOT buffered (rewound position, not a bypass)', () => {
            // Reach PAUSED, then simulate frame 0's chunk having been evicted/
            // never (re)buffered — bufferedChunks emptied.
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0 };
            const atEnd = { ...reduce(playing, playbackTick(1000000)), bufferedChunks: [] };
            expect(atEnd.status).toBe(PLAYBACK_STATUS.PAUSED);

            const replayed = reduce(atEnd, playbackPlay());
            expect(replayed.status).toBe(PLAYBACK_STATUS.BUFFERING);
            expect(replayed.pendingPlay).toBe(true);
            expect(replayed.currentTimestep).toBe(0); // rewound even though it must wait to buffer

            const resumed = reduce(replayed, playbackChunksBuffered([0]));
            expect(resumed.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(resumed.currentTimestep).toBe(0);
        });

        it('AC: Play mid-timeline (paused via PLAYBACK_PAUSE, status READY) is UNCHANGED — resumes from the current position, no rewind', () => {
            const playing = reduce(bufferedState(), playbackPlay());
            const seeked = reduce(playing, playbackSeek(5));
            const paused = reduce(seeked, playbackPause());
            expect(paused.status).toBe(PLAYBACK_STATUS.READY); // NOT PAUSED — mid-timeline pause is a different status
            const resumed = reduce(paused, playbackPlay());
            expect(resumed.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(resumed.currentTimestep).toBe(5); // unchanged — no rewind
        });
    });

    describe('SET_SPEED / SET_QUANTITY', () => {
        it('SET_SPEED clamps and only touches speed', () => {
            const s = reduce(bufferedState(), playbackSetSpeed(2));
            expect(s.speed).toBe(2);
        });
        it('SET_QUANTITY leaves buffering/timestep/status untouched (AC: survives switching)', () => {
            const playing = reduce(bufferedState(), playbackPlay());
            const switched = reduce(playing, playbackSetQuantity('speed'));
            expect(switched.quantity).toBe('speed');
            expect(switched.status).toBe(PLAYBACK_STATUS.PLAYING);
            expect(switched.currentTimestep).toBe(playing.currentTimestep);
            expect(switched.bufferedChunks).toEqual(playing.bufferedChunks);
        });
        it('SET_QUANTITY defaults an unknown value to depth', () => {
            const s = reduce(bufferedState(), playbackSetQuantity('bogus'));
            expect(s.quantity).toBe('depth');
        });

        // TASK-2629 (W4.1) — AC: "Courant hidden gracefully when dt absent".
        // The picker already filters via availableQuantityIds, but the
        // reducer itself must independently reject an unavailable selection
        // too (defence in depth — a caller must never be able to force an
        // unavailable quantity into state merely by dispatching directly).
        it('rejects courant when hasDt is false (state keeps its previous quantity)', () => {
            const s = reduce(bufferedState({ hasDt: false, quantity: 'depth' }), playbackSetQuantity('courant'));
            expect(s.quantity).toBe('depth');
        });
        it('accepts courant when hasDt is true', () => {
            const s = reduce(bufferedState({ hasDt: true }), playbackSetQuantity('courant'));
            expect(s.quantity).toBe('courant');
        });
        it('every non-courant quantity is selectable regardless of hasDt', () => {
            ['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear'].forEach((q) => {
                const s = reduce(bufferedState({ hasDt: false }), playbackSetQuantity(q));
                expect(s.quantity).toBe(q);
            });
        });
    });

    describe('identify + legend UI flags (TASK-2628)', () => {
        it('arming identify clears any stale result; disarming also clears it', () => {
            const armed = reduce(bufferedState(), playbackSetIdentifyArmed(true));
            expect(armed.identifyArmed).toBe(true);
            const withResult = reduce(armed, playbackSetIdentifyResult({ depth: 1 }));
            expect(withResult.identifyResult).toEqual({ depth: 1 });
            const disarmed = reduce(withResult, playbackSetIdentifyArmed(false));
            expect(disarmed.identifyArmed).toBe(false);
            expect(disarmed.identifyResult).toBe(null);
        });
        it('legend open/close toggles legendOpen only', () => {
            const s = reduce(bufferedState(), playbackSetLegendOpen(true));
            expect(s.legendOpen).toBe(true);
        });
    });

    // TASK-2656d (W6.5, epic 2618) — real wireframe toggle (was hardcoded
    // `false` in playbackEpics.js's addLayer baseProps, no way to flip it).
    describe('wireframe toggle (TASK-2656d)', () => {
        it('SET_WIREFRAME(true) flips wireframe only, leaving other state untouched', () => {
            const before = bufferedState({ quantity: 'speed', mixT: 0.3 });
            const after = reduce(before, playbackSetWireframe(true));
            expect(after.wireframe).toBe(true);
            expect(after.quantity).toBe('speed');
            expect(after.mixT).toBe(0.3);
            expect(after.status).toBe(before.status);
        });
        it('SET_WIREFRAME(false) turns it back off', () => {
            const on = reduce(bufferedState(), playbackSetWireframe(true));
            const off = reduce(on, playbackSetWireframe(false));
            expect(off.wireframe).toBe(false);
        });
        it('coerces a truthy/falsy non-boolean argument to a real boolean', () => {
            expect(reduce(bufferedState(), playbackSetWireframe(1)).wireframe).toBe(true);
            expect(reduce(bufferedState(), playbackSetWireframe(0)).wireframe).toBe(false);
        });
    });

    describe('RESET', () => {
        it('returns to the initial state regardless of prior state', () => {
            const busy = reduce(bufferedState(), playbackPlay());
            const reset = reduce(busy, playbackReset());
            expect(reset).toEqual(createInitialPlaybackState());
        });
    });

    // TASK-2744 (AC3/AC4/AC11, epic 2706) — three render controls promoted to
    // controller state so they survive the bar's own unmount (the bar is
    // destroyed whenever the SimpleView menu group leaves 'Results').
    describe('opacity, overlay knobs and colour-ramp override — TASK-2744', () => {
        it('AC3 — SET_OPACITY clamps to 0..1 and ignores garbage', () => {
            expect(createInitialPlaybackState().opacity).toBe(DEFAULT_PLAYBACK_OPACITY);
            expect(reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OPACITY', opacity: 0.25 }).opacity).toBe(0.25);
            expect(reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OPACITY', opacity: 5 }).opacity).toBe(1);
            expect(reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OPACITY', opacity: -3 }).opacity).toBe(0);
            // garbage keeps the PREVIOUS value rather than snapping to a default
            const at3 = reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OPACITY', opacity: 0.3 });
            expect(reduce(at3, { type: 'PLAYBACK:SET_OPACITY', opacity: 'nonsense' }).opacity).toBe(0.3);
            expect(clampOpacity(0.5)).toBe(0.5);
        });

        it('AC11 — SET_OVERLAY writes whitelisted keys and DROPS unknown ones', () => {
            const on = reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OVERLAY', key: 'flowVizEnabled', value: true });
            expect(on.flowVizEnabled).toBe(true);
            expect(reduce(on, { type: 'PLAYBACK:SET_OVERLAY', key: 'arrowDensity', value: 96 }).arrowDensity).toBe(96);
            // a typo must not invent a controller-state field
            const bogus = reduce(on, { type: 'PLAYBACK:SET_OVERLAY', key: 'flowVisEnabled', value: false });
            expect(bogus).toBe(on);
            expect(bogus.flowVisEnabled).toBe(undefined);
        });

        it('AC11 — the knobs survive PLAYBACK_PAUSE/PLAY (they are transport-independent)', () => {
            const on = reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_OVERLAY', key: 'particlesEnabled', value: true });
            expect(reduce(on, playbackPause()).particlesEnabled).toBe(true);
        });

        it('AC4 — SET_COLOR_MAX is per-quantity, and a null value CLEARS the override', () => {
            const quantization = { depth: { valid_max: 16.862720489501953 } };
            const base = createInitialPlaybackState();
            // RED: the derived maximum is the store's valid_max
            expect(colorMaxForQuantity('depth', quantization)).toBe(16.862720489501953);

            const set = reduce(base, { type: 'PLAYBACK:SET_COLOR_MAX', quantity: 'depth', value: 1.5 });
            expect(set.colorMaxOverride).toEqual({ depth: 1.5 });
            expect(colorMaxForQuantity('depth', quantization, { colorMaxOverride: 1.5 })).toBe(1.5);
            // a depth override in metres must not leak onto speed in m/s
            expect(colorMaxForQuantity('speed', { x_velocity: { valid_max: 3 } }, { colorMaxOverride: set.colorMaxOverride.speed })).toBe(3);

            const cleared = reduce(set, { type: 'PLAYBACK:SET_COLOR_MAX', quantity: 'depth', value: null });
            expect(cleared.colorMaxOverride.depth).toBe(undefined);
            expect(colorMaxForQuantity('depth', quantization, { colorMaxOverride: cleared.colorMaxOverride.depth })).toBe(16.862720489501953);
        });

        /*
         * TASK-2788 (W7, epic 2706) — the dry-ground sheet's own alpha.
         *
         * A SEPARATE field from `opacity` on purpose. `opacity` is a CSS
         * opacity on the whole canvas, so using it to see the catchment under
         * the results also washes out the water you came to read.
         */
        it('AC — backgroundOpacity defaults to 0, and is not the same field as opacity', () => {
            const base = createInitialPlaybackState();
            expect(base.backgroundOpacity).toBe(0);
            expect(base.opacity).toBe(DEFAULT_PLAYBACK_OPACITY);
            expect(base.opacity).toNotBe(base.backgroundOpacity);
        });

        it('AC — SET_BACKGROUND_OPACITY moves only the background, and clamps to 0..1', () => {
            const base = createInitialPlaybackState();
            const set = reduce(base, { type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: 0.4 });
            expect(set.backgroundOpacity).toBe(0.4);
            expect(set.opacity).toBe(base.opacity, 'the layer slider must not move with it');

            expect(reduce(set, { type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: 3 }).backgroundOpacity).toBe(1);
            expect(reduce(set, { type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: -2 }).backgroundOpacity).toBe(0);
            // garbage keeps the current value rather than snapping to a default
            expect(reduce(set, { type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: 'x' }).backgroundOpacity).toBe(0.4);
        });

        it('AC — SET_OPACITY does not disturb the background, either', () => {
            const withBg = reduce(createInitialPlaybackState(), { type: 'PLAYBACK:SET_BACKGROUND_OPACITY', backgroundOpacity: 0.6 });
            const after = reduce(withBg, { type: 'PLAYBACK:SET_OPACITY', opacity: 0.2 });
            expect(after.opacity).toBe(0.2);
            expect(after.backgroundOpacity).toBe(0.6);
        });

        it('AC4 — an override at or below colorMin is ignored (never inverts the ramp)', () => {
            // stage's colorMin is its elevationMin, so an override below that
            // would produce a negative span and divide-by-clamp everything
            const ctx = { elevationMin: 10, elevationMax: 20, colorMaxOverride: 5 };
            expect(colorMaxForQuantity('stage', null, ctx)).toNotBe(5);
        });

        // TASK-2784 (W7, epic 2706) — the UI used to ask `isFinite(override)`
        // while colorMaxForQuantity asked something stricter, so an override
        // the renderer was DISCARDING still lit the is-override styling and
        // the reset button. One predicate, so the ramp mode, the uniform, the
        // legend labels and the reset affordance cannot disagree.
        it('isColorMaxOverridden agrees with colorMaxForQuantity on every edge it used to differ on', () => {
            const quantization = { depth: { valid_max: 16.862720489501953 } };
            const cases = [
                { quantity: 'depth', ctx: { colorMaxOverride: 1.5 }, expected: true },
                { quantity: 'depth', ctx: { colorMaxOverride: 0 }, expected: false },
                { quantity: 'depth', ctx: { colorMaxOverride: -2 }, expected: false },
                { quantity: 'depth', ctx: {}, expected: false },
                { quantity: 'depth', ctx: { colorMaxOverride: NaN }, expected: false },
                { quantity: 'stage', ctx: { elevationMin: 10, elevationMax: 20, colorMaxOverride: 5 }, expected: false },
                { quantity: 'stage', ctx: { elevationMin: 10, elevationMax: 20, colorMaxOverride: 15 }, expected: true }
            ];
            cases.forEach(({ quantity, ctx, expected }) => {
                expect(isColorMaxOverridden(quantity, ctx)).toBe(expected, `${quantity} / ${JSON.stringify(ctx)}`);
                // the predicate IS the branch colorMaxForQuantity takes
                const took = colorMaxForQuantity(quantity, quantization, ctx) === Number(ctx.colorMaxOverride);
                expect(took).toBe(expected, `colorMaxForQuantity disagreed for ${quantity}`);
            });
        });
    });

    // TASK-2744 (AC17, epic 2706) — THE DEFAULT SPEED WAS REAL TIME AND
    // NOTHING SAID SO. Measured on map 1461 at HEAD: speed 1, and 3000 ms of
    // wall clock advanced the playhead exactly 3.00 sim-seconds and ZERO
    // timesteps, because the Msimbazi store steps every 60 s. End-to-end was
    // 30 minutes; the old 8x ceiling still meant 3.75.
    describe('default playback speed — TASK-2744 AC17', () => {
        const MSIMBAZI_TIME = Array.from({ length: 31 }, (_, i) => i * 60); // 0..1800 s

        it('simulatedSpanSeconds reads the store\'s own duration', () => {
            expect(simulatedSpanSeconds(MSIMBAZI_TIME)).toBe(1800);
            expect(simulatedSpanSeconds(null)).toBe(0);
            expect(simulatedSpanSeconds([5])).toBe(0);
        });

        it('a freshly loaded Msimbazi run plays end-to-end in ~15 s, not 30 min', () => {
            const speed = defaultSpeedForTime(MSIMBAZI_TIME);
            expect(speed).toBe(120);
            // the AC's own predicate
            expect(Math.abs(1800 / speed - 15) <= 3).toBe(true);
            // RED on HEAD: speed was DEFAULT_SPEED = 1 => 1800 s = 30 minutes
            expect(1800 / 1).toBe(1800);
        });

        it('MANIFEST_LOADED seeds the speed from the store, per run', () => {
            const loaded = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm' }, mesh: null, time: MSIMBAZI_TIME,
                    nTime: 31, nNode: 6, chunkLengthT: 10, totalChunks: 4,
                    quantization: { depth: { valid_max: 1 } }
                }));
            expect(loaded.speed).toBe(120);

            // a 24 h design storm gets its OWN multiplier, not a shared constant
            const daily = Array.from({ length: 25 }, (_, i) => i * 3600); // 0..86400 s
            expect(defaultSpeedForTime(daily)).toBe(86400 / 15);
        });

        it('falls back to real time when the store declares no usable duration', () => {
            expect(defaultSpeedForTime(null)).toBe(1);
            expect(defaultSpeedForTime([0, 0])).toBe(1);
        });

        it('at the seeded default a 3 s sample crosses several timesteps (the AC1 clause that was vacuous at HEAD)', () => {
            const base = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm' }, mesh: null, time: MSIMBAZI_TIME,
                    nTime: 31, nNode: 6, chunkLengthT: 10, totalChunks: 4,
                    quantization: { depth: { valid_max: 1 } }
                }));
            // 3 s of wall clock at 120x = 360 sim-seconds = six 60 s timesteps
            const advanced = reduce({ ...base, status: PLAYBACK_STATUS.PLAYING, lastTickMs: 0, bufferedChunks: [0, 1, 2, 3] }, playbackTick(3000));
            expect(advanced.currentTimestep - base.currentTimestep >= 3).toBe(true);
            // at HEAD's speed of 1 the same 3 s moved ZERO timesteps
            const atHeadSpeed = reduce({ ...base, speed: 1, status: PLAYBACK_STATUS.PLAYING, lastTickMs: 0, bufferedChunks: [0, 1, 2, 3] }, playbackTick(3000));
            expect(atHeadSpeed.currentTimestep).toBe(0);
        });
    });

    // TASK-2726 (W5.5, epic 2706) — the results extent is its OWN state field,
    // deliberately not derived from `mesh`. `mesh.nodeX/nodeY` are in the
    // STORE'S NATIVE CRS; handing MapStore those numbers as an EPSG:3857
    // extent is the exact mistake AC3 names, and a separate, already-projected
    // field is what makes it unavailable to make.
    describe('meshBounds3857 — TASK-2726', () => {
        const BOUNDS = [4369623.8, -761565.1, 4373166.8, -757776.3];

        it('is null before a store loads', () => {
            expect(createInitialPlaybackState().meshBounds3857).toBe(null);
        });

        it('is published by MANIFEST_LOADED', () => {
            expect(loadedState({}, null).meshBounds3857).toBe(null);
            const withBounds = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm' }, time: TIME, nTime: TIME.length, nNode: 6,
                    chunkLengthT: 10, totalChunks: 2, meshBounds3857: BOUNDS
                }));
            expect(withBounds.meshBounds3857).toEqual(BOUNDS);
        });

        it('is NOT carried over when a second store loads without one', () => {
            // A run switch must never leave the zoom control aimed at the
            // previous run's extent — the failure would be silent and would
            // look exactly like a working button.
            const first = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm' }, time: TIME, nTime: TIME.length, nNode: 6,
                    chunkLengthT: 10, totalChunks: 2, meshBounds3857: BOUNDS
                }));
            expect(first.meshBounds3857).toEqual(BOUNDS);
            const second = reduce(reduce(first, playbackInit(8, 'layer-2')),
                playbackManifestLoaded({
                    runId: 8, manifest: { id: 'm2' }, time: TIME, nTime: TIME.length, nNode: 6,
                    chunkLengthT: 10, totalChunks: 2
                }));
            expect(second.meshBounds3857).toBe(null);
        });

        it('is cleared by PLAYBACK_RESET', () => {
            const first = reduce(reduce(createInitialPlaybackState(), playbackInit(7, 'layer-1')),
                playbackManifestLoaded({
                    runId: 7, manifest: { id: 'm' }, time: TIME, nTime: TIME.length, nNode: 6,
                    chunkLengthT: 10, totalChunks: 2, meshBounds3857: BOUNDS
                }));
            expect(reduce(first, playbackReset(7, 'layer-1')).meshBounds3857).toBe(null);
        });
    });
});
