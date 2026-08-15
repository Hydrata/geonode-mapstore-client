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
import { resolveChunkLengthT, readChunkLengthsByArray, QUANTITY_ARRAYS, assertNodeExtentMatchesMesh, assertDeclaredNodeCountAgrees } from '../playbackChunkShape';
import { loadPlaybackFrame } from '../loadPlaybackLayerOptions';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { playbackInitEpic, fetcherRegistry } from '../epics/playbackEpics';
import { playbackInit, PLAYBACK_MANIFEST_LOADED, PLAYBACK_MANIFEST_FAILED } from '../actions/playbackActions';
import { createInitialPlaybackState } from '../playbackController';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST, FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixtures/fixturePlaybackStore';
import { FIXTURE_STORE_FILES_CHUNK1, FIXTURE_MANIFEST_CHUNK1 } from './fixtures/fixturePlaybackStoreChunk1';
import { FIXTURE_STORE_FILES_CHUNK2, FIXTURE_MANIFEST_CHUNK2 } from './fixtures/fixturePlaybackStoreChunk2';

const MANIFEST_URL = '/api/v2/anuga/runs/1/playback-manifest/';

// The three stores under test: same data, different chunk grid.
const STORES = [
    { label: 'chunk-10 (the shape prod writes today)', chunkLengthT: 10, manifest: FIXTURE_MANIFEST, files: FIXTURE_STORE_FILES },
    { label: 'chunk-1 (backward-compat test grid only — D5 forbids the exporter from writing this)', chunkLengthT: 1, manifest: FIXTURE_MANIFEST_CHUNK1, files: FIXTURE_STORE_FILES_CHUNK1 },
    { label: 'chunk-2 (D5 floor — what TASK-2719\'s exporter actually writes at run-1328 scale)', chunkLengthT: 2, manifest: FIXTURE_MANIFEST_CHUNK2, files: FIXTURE_STORE_FILES_CHUNK2 }
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

        it('all three stores return the SAME frame for the same timestep (only the chunk grid differs)', (done) => {
            const timestep = 11;
            Promise.all(STORES.map(({ manifest, files }) => {
                const fetcher = new PlaybackChunkFetcher({ manifest, fetchImpl: fetchFrom(files) });
                return loadPlaybackFrame(fetcher, timestep, FIXTURE_MESH.nNode, resolveChunkLengthT(manifest));
            })).then(([chunk10Frame, chunk1Frame, chunk2Frame]) => {
                for (let n = 0; n < FIXTURE_MESH.nNode; n++) {
                    expect(chunk10Frame.depth[n]).toBe(chunk1Frame.depth[n]);
                    expect(chunk10Frame.xVelocity[n]).toBe(chunk1Frame.xVelocity[n]);
                    expect(chunk10Frame.yVelocity[n]).toBe(chunk1Frame.yVelocity[n]);
                    expect(chunk10Frame.depth[n]).toBe(chunk2Frame.depth[n]);
                    expect(chunk10Frame.xVelocity[n]).toBe(chunk2Frame.xVelocity[n]);
                    expect(chunk10Frame.yVelocity[n]).toBe(chunk2Frame.yVelocity[n]);
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

    // ------------------------------------------------- AC4 (TASK-2719 chunk-2 arm)
    describe('AC4 chunk-2 arm (TASK-2719) — the hardcoded-10 client renders the WRONG timestep off the chunk-2 store', () => {
        // D5's floor is 2, not 1 — this is the length the exporter will
        // actually write at run-1328 scale. Same shape as the chunk-1 block
        // above: chunkIndex = floor(10/10) = 1, rowInChunk = 10 % 10 = 0.
        // In a REAL chunk-2 store chunk index 1 holds timesteps [2, 3]
        // (rows 0, 1), so row 0 is timestep 2's water — still IN BOUNDS, no
        // error, just wrong.
        const TIMESTEP = 10;
        const IMPOSTOR_TIMESTEP = 2;

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

        it('REVERTED (chunkLengthT hardcoded to 10) returns timestep 2\'s water for timestep 10 off the chunk-2 store', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST_CHUNK2, fetchImpl: fetchFrom(FIXTURE_STORE_FILES_CHUNK2) });
            loadPlaybackFrame(fetcher, TIMESTEP, FIXTURE_MESH.nNode, 10).then((frame) => {
                // It resolves (chunkIndex 1, row 0 is in bounds). It is
                // full-length. It is simply the wrong water.
                expect(frame.depth.length).toBe(FIXTURE_MESH.nNode);
                expect(maxDepthError(frame, IMPOSTOR_TIMESTEP) <= DEPTH_TOLERANCE).toBe(true);
                expect(maxDepthError(frame, TIMESTEP) > DEPTH_TOLERANCE).toBe(true);
                done();
            }).catch(done);
        });

        it('FIXED (chunkLengthT resolved from the store) returns timestep 10\'s water for timestep 10', (done) => {
            const fetcher = new PlaybackChunkFetcher({ manifest: FIXTURE_MANIFEST_CHUNK2, fetchImpl: fetchFrom(FIXTURE_STORE_FILES_CHUNK2) });
            const chunkLengthT = resolveChunkLengthT(FIXTURE_MANIFEST_CHUNK2);
            expect(chunkLengthT).toBe(2);
            loadPlaybackFrame(fetcher, TIMESTEP, FIXTURE_MESH.nNode, chunkLengthT).then((frame) => {
                expect(maxDepthError(frame, TIMESTEP) <= DEPTH_TOLERANCE).toBe(true);
                expect(maxDepthError(frame, IMPOSTOR_TIMESTEP) > DEPTH_TOLERANCE).toBe(true);
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

/*
 * TASK-2729 (W5, epic 2706) — the dim-1 twin of TASK-2724.
 *
 * 2724 stopped the client assuming dim 0 of the chunk grid. Dim 1 was left
 * assumed: readNodeCount calls `chunk_shapes[q][1]` "n_node", but that value
 * is the chunk's node EXTENT. It equals the node count today only because the
 * exporter writes a SINGLE node chunk (run_anuga/playback_store.py:538,
 * `t_chunks = (CHUNK_LENGTH_T, n_node)`) — the exact "every store we have ever
 * written does X" invariant 2724 exists to stop trusting.
 *
 * The dim-1 failure is strictly worse than the dim-0 one. A wrong chunk length
 * at least sometimes throws out of bounds; a wrong node extent returns a
 * full-length, finite, plausible flood surface stitched from two different
 * timesteps, and an engineer will read it and believe it. PROOF 3 below runs
 * that known-positive through the real production code path.
 */
describe('TASK-2729 — the store\'s declared node extent is cross-checked, not trusted', () => {
    // PROOF 1 is PARAMETERISED over all three quantity arrays on purpose.
    // readNodeCount returns the FIRST usable dim-1 over QUANTITY_ARRAYS
    // (playbackMemoryPolicy.js), so a guard built on it would pass a proof that
    // only ever mutates `depth` — the first array — while missing a store where
    // only x_velocity or y_velocity is node-chunked. The guard has to compare
    // EVERY array, so the proof has to drive every array.
    QUANTITY_ARRAYS.forEach((arrayName) => {
        it(`refuses a store whose declared chunk node extent disagrees with the mesh it actually has (${arrayName})`, () => {
            const manifest = {
                ...FIXTURE_MANIFEST,
                chunk_shapes: { ...FIXTURE_MANIFEST.chunk_shapes, [arrayName]: [10, 3] }
            };
            let thrown = null;
            try {
                assertNodeExtentMatchesMesh(manifest, FIXTURE_MESH.nNode);
            } catch (e) {
                thrown = e;
            }
            expect(thrown).toExist();
            expect(String(thrown.message)).toContain('3');
            expect(String(thrown.message)).toContain(String(FIXTURE_MESH.nNode));
            expect(String(thrown.message)).toContain(arrayName);
        });
    });

    it('a normal single-node-chunk store still resolves unchanged (both shipped fixtures)', () => {
        // guard-the-guard: the new refusal must not brick the stores we serve.
        STORES.forEach(({ manifest }) => {
            expect(assertNodeExtentMatchesMesh(manifest, FIXTURE_MESH.nNode)).toBe(FIXTURE_MESH.nNode);
        });
    });

    it('a store that declares no chunk node extent at all is played, not refused', () => {
        // Same shape as the manifest-time absence arm: an UNDECLARED extent is
        // the state of stores we already serve, so it must never be a refusal.
        // Only a DISAGREEMENT is.
        const manifest = { ...FIXTURE_MANIFEST, chunk_shapes: { depth: [10], x_velocity: [10], y_velocity: [10] } };
        expect(assertNodeExtentMatchesMesh(manifest, FIXTURE_MESH.nNode)).toBe(FIXTURE_MESH.nNode);
    });

    describe('the manifest-time arm is PRESENCE-GATED on schema_metadata.n_node', () => {
        it('a store that declares no n_node is played, not refused', () => {
            // Every PRE-TASK-2719 store, run 1328's included, never wrote
            // n_node at all — group_attrs (run_anuga/playback_store.py)
            // omitted it entirely before the v2 bump, so a
            // fail-loud-on-absence check would refuse the entire product.
            // Built explicitly here (rather than relying on FIXTURE_MANIFEST
            // itself lacking n_node) because TASK-2719 made the shared
            // fixture declare n_node from birth (schema_metadata now
            // representative of a v2 store) — it no longer MODELS a
            // pre-2719 store on its own.
            const { n_node, ...schemaWithoutNNode } = FIXTURE_MANIFEST.schema_metadata;
            const manifest = { ...FIXTURE_MANIFEST, schema_metadata: schemaWithoutNNode };
            expect(manifest.schema_metadata.n_node).toBe(undefined);
            expect(assertDeclaredNodeCountAgrees(manifest)).toBe(undefined);
        });

        it('n_node present and EQUAL to the declared chunk extent passes', () => {
            const manifest = {
                ...FIXTURE_MANIFEST,
                schema_metadata: { ...FIXTURE_MANIFEST.schema_metadata, n_node: FIXTURE_MESH.nNode }
            };
            expect(assertDeclaredNodeCountAgrees(manifest)).toBe(FIXTURE_MESH.nNode);
        });

        QUANTITY_ARRAYS.forEach((arrayName) => {
            it(`n_node present and DISAGREEING throws naming both numbers (${arrayName})`, () => {
                const manifest = {
                    ...FIXTURE_MANIFEST,
                    schema_metadata: { ...FIXTURE_MANIFEST.schema_metadata, n_node: 6 },
                    chunk_shapes: { ...FIXTURE_MANIFEST.chunk_shapes, [arrayName]: [10, 3] }
                };
                let thrown = null;
                try {
                    assertDeclaredNodeCountAgrees(manifest);
                } catch (e) {
                    thrown = e;
                }
                expect(thrown).toExist();
                expect(String(thrown.message)).toContain('3');
                expect(String(thrown.message)).toContain('6');
                expect(String(thrown.message)).toContain(arrayName);
            });
        });
    });
});

/*
 * TASK-2729 NAMED PROOF 3 — prove the detector on a KNOWN-POSITIVE.
 *
 * This spec is GREEN at HEAD and stays green: it is not a defect proof, it is
 * the evidence the guard above is worth having. It runs a node-chunked store
 * through the real production slicing path with the guard bypassed, and shows
 * that the client does not crash, does not warn, and does not return an empty
 * frame — it returns six finite depths that are half of one timestep welded to
 * half of the next.
 */
describe('TASK-2729 PROOF 3 — an unguarded node-chunked store silently interleaves two timesteps', () => {
    const N_NODE = 6;   // what the mesh actually has, and what the client slices with
    const N_CHUNK = 3;  // what the store actually laid the chunk out in
    const CHUNK_LENGTH_T = 10;
    const QUANT = { scale: 1, offset: 0, byteorder: 'little' };

    it('resolves, returns 6 finite values, and they are timestep 2 followed by timestep 3', (done) => {
        // A 10 x 3 chunk, row-major: element (t, n) = t * 10 + n, so a value
        // identifies the timestep it came from at a glance.
        const stored = new Uint16Array(CHUNK_LENGTH_T * N_CHUNK);
        for (let t = 0; t < CHUNK_LENGTH_T; t++) {
            for (let n = 0; n < N_CHUNK; n++) {
                stored[t * N_CHUNK + n] = t * 10 + n;
            }
        }
        const manifest = {
            chunk_urls: {
                'depth/c/0/0': 'd', 'x_velocity/c/0/0': 'x', 'y_velocity/c/0/0': 'y'
            },
            chunk_shapes: {
                depth: [CHUNK_LENGTH_T, N_CHUNK],
                x_velocity: [CHUNK_LENGTH_T, N_CHUNK],
                y_velocity: [CHUNK_LENGTH_T, N_CHUNK]
            },
            quantization: { depth: QUANT, x_velocity: QUANT, y_velocity: QUANT }
        };
        const fetcher = new PlaybackChunkFetcher({
            manifest,
            fetchImpl: () => Promise.resolve(new Response(new ArrayBuffer(8), { status: 200 })),
            decodeImpl: () => Promise.resolve(stored)
        });

        // The guard is deliberately NOT called here — this is the pre-2729
        // behaviour, reproduced exactly.
        loadPlaybackFrame(fetcher, 1, N_NODE, CHUNK_LENGTH_T).then((frame) => {
            // It does not throw: dequantizeRow's bounds check is
            // `start + length > storedArray.length`, i.e. 6 + 6 = 12 > 30 is
            // FALSE, so the one guard that exists never fires.
            expect(frame.depth.length).toBe(N_NODE);
            Array.prototype.forEach.call(frame.depth, (v) => {
                expect(isFinite(v)).toBe(true);
            });
            // And the water is wrong in the worst possible way — plausible.
            // Elements [6, 12) of a 3-wide row-major grid are rows 2 and 3.
            expect(Array.prototype.slice.call(frame.depth)).toEqual([20, 21, 22, 30, 31, 32]);
            // For contrast, the CORRECT frame for timestep 1 would have been
            // row 1 alone: [10, 11, 12]. Nothing in the pipeline noticed.
            done();
        }).catch(done);
    });

    it('and the TASK-2729 guard refuses that same store before a frame is ever sliced', () => {
        const manifest = {
            chunk_shapes: {
                depth: [CHUNK_LENGTH_T, N_CHUNK],
                x_velocity: [CHUNK_LENGTH_T, N_CHUNK],
                y_velocity: [CHUNK_LENGTH_T, N_CHUNK]
            }
        };
        // NOT `toThrow()` alone: a bare toThrow() passes on ANY throw,
        // including the TypeError you get from calling a function that does not
        // exist yet — which would make this spec green against a tree with no
        // guard in it at all. The message has to name both numbers.
        let thrown = null;
        try {
            assertNodeExtentMatchesMesh(manifest, N_NODE);
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toExist();
        expect(thrown instanceof TypeError).toBe(false);
        expect(String(thrown.message)).toContain(String(N_CHUNK));
        expect(String(thrown.message)).toContain(String(N_NODE));
    });
});
