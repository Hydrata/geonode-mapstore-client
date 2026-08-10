/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2724 (W1.3, epic 2706) — the playback client reads its time-chunk
 * length FROM THE STORE.
 *
 * Every spec here runs over BOTH real byte fixtures: the original chunk-10
 * store and fixturePlaybackStoreChunk1, the SAME store regrouped into
 * one-timestep chunks by the deploy repo's rechunk_playback_store.py (the
 * tool that produced the W0 rig's prod-scale chunk-1 store). Their decoded
 * buffers are byte-identical — only the chunk grid differs — so FIXTURE_PHYSICAL
 * is the correct expected-value table for both, and any disagreement between
 * them is purely a chunk-indexing fault.
 *
 * That matters because the failure this task removes is not a crash. A client
 * that assumes 10 against the chunk-1 store fetches a chunk that EXISTS and
 * slices a row that EXISTS, and renders a plausible flood surface for the
 * wrong timestep. See the AC4 block below for that known-positive, run through
 * the real production code path.
 */
import expect from 'expect';
import Rx from 'rxjs';
import { resolveChunkLengthT, readChunkLengthsByArray, QUANTITY_ARRAYS } from '../playbackChunkShape';
import { loadPlaybackFrame } from '../loadPlaybackLayerOptions';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { playbackInitEpic, fetcherRegistry } from '../epics/playbackEpics';
import { playbackInit, PLAYBACK_MANIFEST_LOADED, PLAYBACK_MANIFEST_FAILED } from '../actions/playbackActions';
import { createInitialPlaybackState } from '../playbackController';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST, FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixtures/fixturePlaybackStore';
import { FIXTURE_STORE_FILES_CHUNK1, FIXTURE_MANIFEST_CHUNK1 } from './fixtures/fixturePlaybackStoreChunk1';

const MANIFEST_URL = '/api/v2/anuga/runs/1/playback-manifest/';

// The two stores under test: same data, different chunk grid.
const STORES = [
    { label: 'chunk-10 (the shape prod writes today)', chunkLengthT: 10, manifest: FIXTURE_MANIFEST, files: FIXTURE_STORE_FILES },
    { label: 'chunk-1 (what TASK-2719\'s exporter would write)', chunkLengthT: 1, manifest: FIXTURE_MANIFEST_CHUNK1, files: FIXTURE_STORE_FILES_CHUNK1 }
];

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function fetchFrom(files) {
    return (url) => {
        const b64 = files[url];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
}

function stubGlobalFetch(handler) {
    const original = window.fetch;
    window.fetch = handler;
    return () => { window.fetch = original; };
}

function makeActionsSubject() {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter((a) => types.includes(a.type));
    return { subject, action$ };
}

function makeStore(playbackState) {
    const state = { anugaPlayback: playbackState, layers: { flat: [] } };
    return { getState: () => state };
}

/** Absolute per-node error against the physical table, in metres. */
function maxDepthError(frame, timestep) {
    let worst = 0;
    for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
        worst = Math.max(worst, Math.abs(frame.depth[n] - FIXTURE_PHYSICAL.depth[timestep][n]));
    }
    return worst;
}

// One uint16 quantum plus float32 slack — the same tolerance the W2 seam
// tests use, i.e. "matches the store's own dequantized value".
const DEPTH_TOLERANCE = FIXTURE_MANIFEST.quantization.depth.scale + 1e-6;

describe('playbackChunkShape (TASK-2724 — chunk length comes from the store)', () => {
    afterEach(() => {
        fetcherRegistry.clear();
    });

    // ---------------------------------------------------------------- AC2
    describe('AC2 — sourced from chunk_grid.configuration.chunk_shape, never defaulted', () => {
        STORES.forEach(({ label, chunkLengthT, manifest }) => {
            it(`reads ${chunkLengthT} out of the ${label} manifest`, () => {
                expect(resolveChunkLengthT(manifest)).toBe(chunkLengthT);
                QUANTITY_ARRAYS.forEach((name) => {
                    // The manifest value IS the store's own chunk_shape[0].
                    expect(manifest.chunk_shapes[name][0]).toBe(chunkLengthT);
                });
            });
        });

        it('REFUSES a manifest with no chunk_shapes at all (the pre-TASK-2724 shape) instead of assuming 10', () => {
            const legacy = { ...FIXTURE_MANIFEST };
            delete legacy.chunk_shapes;
            let thrown = null;
            try {
                resolveChunkLengthT(legacy);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toNotBe(null);
            expect(thrown.message).toContain('does not declare a time-chunk length');
            expect(thrown.message).toContain('depth');
            expect(thrown.message).toContain('x_velocity');
            expect(thrown.message).toContain('y_velocity');
        });

        it('REFUSES a manifest missing just one array\'s chunk shape, naming it', () => {
            const partial = { ...FIXTURE_MANIFEST, chunk_shapes: { ...FIXTURE_MANIFEST.chunk_shapes } };
            delete partial.chunk_shapes.y_velocity;
            let thrown = null;
            try {
                resolveChunkLengthT(partial);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toNotBe(null);
            expect(thrown.message).toContain('y_velocity');
            expect(thrown.message).toNotContain('depth,');
        });

        it('REFUSES junk chunk shapes rather than coercing them', () => {
            [null, [], [0, 6], [-1, 6], [2.5, 6], ['10', 6], [NaN, 6], 10].forEach((shape) => {
                const bad = { ...FIXTURE_MANIFEST, chunk_shapes: { depth: shape, x_velocity: shape, y_velocity: shape } };
                expect(readChunkLengthsByArray(bad).depth).toBe(undefined);
                expect(() => resolveChunkLengthT(bad)).toThrow();
            });
        });
    });

    // ---------------------------------------------------------------- AC5
    describe('AC5 — cross-quantity safety: disagreeing arrays are REFUSED, not silently unified', () => {
        it('throws naming every array\'s length when depth disagrees with the velocities', () => {
            const mixed = {
                ...FIXTURE_MANIFEST,
                chunk_shapes: { depth: [1, 6], x_velocity: [10, 6], y_velocity: [10, 6] }
            };
            let thrown = null;
            try {
                resolveChunkLengthT(mixed);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toNotBe(null);
            expect(thrown.message).toContain('disagree on time-chunk length');
            expect(thrown.message).toContain('depth=1');
            expect(thrown.message).toContain('x_velocity=10');
            expect(thrown.message).toContain('y_velocity=10');
        });

        it('does NOT take depth\'s value and apply it to all three', () => {
            const mixed = {
                ...FIXTURE_MANIFEST,
                chunk_shapes: { depth: [10, 6], x_velocity: [10, 6], y_velocity: [1, 6] }
            };
            expect(() => resolveChunkLengthT(mixed)).toThrow();
            expect(readChunkLengthsByArray(mixed)).toEqual({ depth: 10, x_velocity: 10, y_velocity: 1 });
        });
    });

    // ---------------------------------------------------------------- AC3
    describe('AC3 — correct values on BOTH chunk lengths, through the real fetch/decode path', () => {
        STORES.forEach(({ label, chunkLengthT, manifest, files }) => {
            // Timesteps chosen to straddle the chunk-10 boundary: 0 and 5 are
            // in chunk 0, 10/11/12 are in chunk 1. Under chunk-1 every one of
            // them is its own chunk.
            [0, 5, 9, 10, 11, 12].forEach((timestep) => {
                it(`${label}: timestep ${timestep} matches the store's own dequantized depth at every vertex`, (done) => {
                    const fetcher = new PlaybackChunkFetcher({ manifest, fetchImpl: fetchFrom(files) });
                    loadPlaybackFrame(fetcher, timestep, FIXTURE_MESH.nNode, resolveChunkLengthT(manifest)).then((frame) => {
                        expect(frame.depth.length).toBe(FIXTURE_MESH.nNode);
                        expect(maxDepthError(frame, timestep) <= DEPTH_TOLERANCE).toBe(true);
                        expect(resolveChunkLengthT(manifest)).toBe(chunkLengthT);
                        done();
                    }).catch(done);
                });
            });
        });

        it('the two stores return the SAME frame for the same timestep (only the chunk grid differs)', (done) => {
            const timestep = 11;
            Promise.all(STORES.map(({ manifest, files }) => {
                const fetcher = new PlaybackChunkFetcher({ manifest, fetchImpl: fetchFrom(files) });
                return loadPlaybackFrame(fetcher, timestep, FIXTURE_MESH.nNode, resolveChunkLengthT(manifest));
            })).then(([chunk10Frame, chunk1Frame]) => {
                for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                    expect(chunk10Frame.depth[n]).toBe(chunk1Frame.depth[n]);
                    expect(chunk10Frame.xVelocity[n]).toBe(chunk1Frame.xVelocity[n]);
                    expect(chunk10Frame.yVelocity[n]).toBe(chunk1Frame.yVelocity[n]);
                }
                done();
            }).catch(done);
        });
    });

    // ---------------------------------------------------------------- AC4
    describe('AC4 — KNOWN-POSITIVE: the hardcoded-10 client renders the WRONG timestep off the chunk-1 store', () => {
        // The pre-fix client is exactly `loadPlaybackFrame(..., 10)`: that is
        // what playbackEpics passed (CHUNK_LENGTH_T) and what loadPlaybackFrame
        // itself defaulted to. Reading timestep 10 it computes
        // chunkIndex = floor(10/10) = 1 and rowInChunk = 0 — and `depth/c/1/0`
        // in a chunk-1 store is timestep ONE. No error, no gap, no NaN: a
        // complete flood surface, 10x too shallow.
        const TIMESTEP = 10;
        const IMPOSTOR_TIMESTEP = 1;

        it('the fixture itself makes the two timesteps distinguishable (guards the guard)', () => {
            const real = FIXTURE_PHYSICAL.depth[TIMESTEP];
            const impostor = FIXTURE_PHYSICAL.depth[IMPOSTOR_TIMESTEP];
            let differing = 0;
            for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                if (Math.abs(real[n] - impostor[n]) > DEPTH_TOLERANCE) {
                    differing++;
                }
            }
            expect(differing >= 5).toBe(true);
        });

        it('REVERTED (chunkLengthT hardcoded to 10) returns timestep 1\'s water for timestep 10', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST_CHUNK1, fetchImpl: fetchFrom(FIXTURE_STORE_FILES_CHUNK1) });
            loadPlaybackFrame(fetcher, TIMESTEP, FIXTURE_MESH.nNode, 10).then((frame) => {
                // It resolves. It is full-length. It is simply the wrong water.
                expect(frame.depth.length).toBe(FIXTURE_MESH.nNode);
                expect(maxDepthError(frame, IMPOSTOR_TIMESTEP) <= DEPTH_TOLERANCE).toBe(true);
                expect(maxDepthError(frame, TIMESTEP) > DEPTH_TOLERANCE).toBe(true);
                done();
            }).catch(done);
        });

        it('FIXED (chunkLengthT resolved from the store) returns timestep 10\'s water for timestep 10', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST_CHUNK1, fetchImpl: fetchFrom(FIXTURE_STORE_FILES_CHUNK1) });
            const chunkLengthT = resolveChunkLengthT(FIXTURE_MANIFEST_CHUNK1);
            expect(chunkLengthT).toBe(1);
            loadPlaybackFrame(fetcher, TIMESTEP, FIXTURE_MESH.nNode, chunkLengthT).then((frame) => {
                expect(maxDepthError(frame, TIMESTEP) <= DEPTH_TOLERANCE).toBe(true);
                expect(maxDepthError(frame, IMPOSTOR_TIMESTEP) > DEPTH_TOLERANCE).toBe(true);
                done();
            }).catch(done);
        });

        it('the same hardcoded 10 is harmless on the chunk-10 store — which is why this shipped green', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fetchFrom(FIXTURE_STORE_FILES) });
            loadPlaybackFrame(fetcher, TIMESTEP, FIXTURE_MESH.nNode, 10).then((frame) => {
                expect(maxDepthError(frame, TIMESTEP) <= DEPTH_TOLERANCE).toBe(true);
                done();
            }).catch(done);
        });
    });

    // ------------------------------------------------- the deleted default
    describe('AC1/AC2 — loadPlaybackFrame has no default chunk length left to fall back on', () => {
        [undefined, null, 0, -1, 2.5, '10', NaN].forEach((bad) => {
            it(`throws for chunkLengthT=${typeof bad === 'string' ? JSON.stringify(bad) : String(bad)} rather than assuming 10`, (done) => {
                const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST, fetchImpl: fetchFrom(FIXTURE_STORE_FILES) });
                loadPlaybackFrame(fetcher, 5, FIXTURE_MESH.nNode, bad).then(() => {
                    done(new Error('expected loadPlaybackFrame to reject a missing/invalid chunk length'));
                }).catch((error) => {
                    expect(error.message).toContain('chunkLengthT');
                    expect(error.message).toContain('no safe default');
                    done();
                });
            });
        });
    });

    // ---------------------------------------------- end-to-end via the epic
    describe('playbackInitEpic threads the store\'s own chunk length into state', () => {
        function runInit(manifest, files) {
            return new Promise((resolve) => {
                const restore = stubGlobalFetch((url) => (
                    url === MANIFEST_URL
                        ? Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }))
                        : fetchFrom(files)(url)
                ));
                const { subject, action$ } = makeActionsSubject();
                playbackInitEpic(action$, makeStore(createInitialPlaybackState())).subscribe((action) => {
                    if (action.type === PLAYBACK_MANIFEST_LOADED || action.type === PLAYBACK_MANIFEST_FAILED) {
                        restore();
                        resolve(action);
                    }
                });
                subject.next(playbackInit(1, 'layer-1', MANIFEST_URL));
            });
        }

        STORES.forEach(({ label, chunkLengthT, manifest, files }) => {
            it(`${label}: MANIFEST_LOADED carries chunkLengthT=${chunkLengthT} and the matching totalChunks`, (done) => {
                runInit(manifest, files).then((action) => {
                    expect(action.type).toBe(PLAYBACK_MANIFEST_LOADED);
                    expect(action.chunkLengthT).toBe(chunkLengthT);
                    expect(action.totalChunks).toBe(Math.ceil(FIXTURE_MESH.nTime / chunkLengthT));
                    done();
                }).catch(done);
            });
        });

        it('a store that declares no chunk grid FAILS THE LOAD with the reason, rather than playing wrong water', (done) => {
            const legacy = { ...FIXTURE_MANIFEST };
            delete legacy.chunk_shapes;
            runInit(legacy, FIXTURE_STORE_FILES).then((action) => {
                expect(action.type).toBe(PLAYBACK_MANIFEST_FAILED);
                expect(action.error).toContain('does not declare a time-chunk length');
                done();
            }).catch(done);
        });
    });

    // ------------------------------------------------------------- initial state
    it('initial playback state carries NO chunk length until a store says so', () => {
        expect(createInitialPlaybackState().chunkLengthT).toBe(null);
    });
});
