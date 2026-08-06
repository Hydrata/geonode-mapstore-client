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
        });
    });

    describe('clampSpeed', () => {
        it('clamps into [MIN_SPEED, MAX_SPEED]', () => {
            expect(clampSpeed(0)).toBe(0.25);
            expect(clampSpeed(-5)).toBe(0.25);
            expect(clampSpeed(100)).toBe(8);
            expect(clampSpeed(2)).toBe(2);
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
        it('sets degraded after repeated consecutive stalls (graceful degradation AC)', () => {
            // On a stall, lastTickMs advances but playheadSeconds/currentTimestep
            // stay frozen (buffer-then-play: pause the sim clock, don't skip
            // ahead) — so each subsequent tick must independently re-attempt a
            // big enough jump to re-discover chunk 1 is still unbuffered.
            let s = { ...reduce(reduce(loadedState(), playbackChunksBuffered([0])), playbackPlay()), lastTickMs: 0 };
            s = reduce(s, playbackTick(350000));
            expect(s.status).toBe(PLAYBACK_STATUS.STALLED);
            expect(s.degraded).toBe(false);
            expect(s.stallCount).toBe(1);
            s = reduce(s, playbackTick(700000));
            expect(s.stallCount).toBe(2);
            expect(s.degraded).toBe(false);
            s = reduce(s, playbackTick(1050000));
            expect(s.status).toBe(PLAYBACK_STATUS.STALLED);
            expect(s.stallCount).toBe(3);
            expect(s.degraded).toBe(true);
        });
        it('reaching the end of the timeline pauses (does not loop)', () => {
            const playing = { ...reduce(bufferedState(), playbackPlay()), lastTickMs: 0 };
            const ticked = reduce(playing, playbackTick(1000000)); // way past t=360
            expect(ticked.status).toBe(PLAYBACK_STATUS.PAUSED);
            expect(ticked.currentTimestep).toBe(TIME.length - 1);
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

    describe('RESET', () => {
        it('returns to the initial state regardless of prior state', () => {
            const busy = reduce(bufferedState(), playbackPlay());
            const reset = reduce(busy, playbackReset());
            expect(reset).toEqual(createInitialPlaybackState());
        });
    });
});
