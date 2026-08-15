/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2730 (W3, epic 2706) — EVERY decode request must settle, always.
 *
 * W1's commit 4e9c5a6ec replaced PlaybackChunkFetcher's inline
 * `gunzip -> decodeTypedArray` (both of which always settle) with the
 * off-main-thread seam `this.decodeImpl = decodeImpl || decodeChunkOffThread`.
 * That introduced a promise that can never settle at all, and a promise that
 * never settles is the worst shape of failure this epic has: the fetcher's
 * `finally` never runs, so `_inflight` keeps the dead promise forever, and
 * `cache.set` sits AFTER the awaited decode so the cache is never written
 * either. The chunk becomes permanently unplayable with no error, no console
 * line, no retry and no network activity.
 *
 * Two independent ways in, both covered here:
 *   (1) DISPOSAL RACE. decodeChunkOffThread captures `active` and runs its
 *       body one microtask later; anything calling tearDownWorker in that
 *       window fails only the requests already in `pending` — this one has
 *       not joined yet — and `postMessage` on a terminated Worker is a SILENT
 *       no-op, so no reply ever arrives.
 *   (2) A WORKER THAT DIES AFTER postMessage WITHOUT FIRING onerror (an OOM
 *       gunzipping a 67,861,500 B chunk is exactly this shape). Nothing
 *       rejects the request: the handshake timer covers the handshake only.
 *
 * WHY THE STUB WORKER IS NOT OPTIONAL. karma owns a `Worker` global but does
 * NOT serve the emitted worker chunk (see the module header), so a real
 * Worker fires onerror during the handshake, disposeWorker parks
 * workerReadyPromise at `Promise.resolve(null)` PERMANENTLY, `active` is null
 * and every request takes the `if (!active) return decodeInline(...)` branch.
 * The race window never opens and a "it settles" assertion goes green having
 * proved nothing. Every case below therefore installs a stub `window.Worker`
 * AND calls terminatePlaybackDecodeWorker() in beforeEach (the module-level
 * worker/workerReadyPromise/pending state at playbackDecodeWorker.js:49-52
 * leaks across specs, and playbackMemoryPolicy-test.js's off-thread/inline
 * parity case shares it), and asserts a POSITIVE CONTROL that the worker path
 * was genuinely live — `createdStubs.length` and `postedDecodes.length` — so
 * the inline branch cannot silently pass these cases for us.
 */
import expect from 'expect';
import {
    decodeChunkOffThread,
    terminatePlaybackDecodeWorker,
    WORKER_REQUEST_TIMEOUT_MS
} from '../playbackDecodeWorker';
import { decodeCompressedChunk } from '../playbackDecode';
import { PlaybackChunkFetcher } from '../playbackChunkFetcher';
import { FIXTURE_STORE_FILES, FIXTURE_MANIFEST } from './fixtures/fixturePlaybackStore';

const UINT16_OPTS = { dtype: 'uint16', byteorder: 'little' };

function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Same shape as playbackChunkFetcher-test's fixture fetch: the manifest's
// chunk_urls values ARE the relative keys, so "the URL" is the lookup key.
function makeFixtureFetch(spy) {
    return function fixtureFetch(url) {
        if (spy) {
            spy.push(url);
        }
        const b64 = FIXTURE_STORE_FILES[url];
        if (!b64) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(new Response(base64ToArrayBuffer(b64), { status: 200 }));
    };
}

/** Resolve either way, so "did it settle at all?" is the only question asked. */
function settle(promise) {
    return promise.then(
        (value) => ({ outcome: 'resolved', value }),
        (error) => ({ outcome: 'rejected', error })
    );
}

const createdStubs = [];
// 'auto' answers the ping/pong immediately; 'hold' waits for the test to call
// answerHandshake(), which is how two requests are parked on the SAME pending
// ready promise so their .then callbacks run back to back.
let handshakeMode = 'auto';
// Invoked for every NON-ping postMessage. Left null = a worker that swallows
// the request and never replies.
let decodePostHandler = null;

class StubWorker {
    constructor(url) {
        this.url = url;
        this.terminated = false;
        this.postedDecodes = [];
        this.onmessage = null;
        this.onerror = null;
        this._listeners = [];
        this._pingPending = false;
        createdStubs.push(this);
    }
    addEventListener(type, fn) {
        if (type === 'message') {
            this._listeners.push(fn);
        }
    }
    removeEventListener(type, fn) {
        if (type === 'message') {
            this._listeners = this._listeners.filter((listener) => listener !== fn);
        }
    }
    postMessage(data) {
        // THE PRODUCTION BEHAVIOUR THIS CARD IS ABOUT: postMessage on an
        // already-terminated Worker is a silent no-op in every browser. It
        // does NOT throw, so decodeChunkOffThread's catch never runs and no
        // reply ever arrives.
        if (this.terminated) {
            return;
        }
        if (data && data.ping) {
            this._pingPending = true;
            if (handshakeMode === 'auto') {
                this.answerHandshake();
            }
            return;
        }
        this.postedDecodes.push(data);
        if (decodePostHandler) {
            decodePostHandler(this, data);
        }
    }
    answerHandshake() {
        if (!this._pingPending) {
            return;
        }
        this._pingPending = false;
        this._dispatch({ pong: true, requestId: 0 });
    }
    replyDecoded(requestId, result) {
        this._dispatch({ requestId, result });
    }
    _dispatch(data) {
        const event = { data };
        this._listeners.slice().forEach((fn) => fn(event));
        if (typeof this.onmessage === 'function') {
            this.onmessage(event);
        }
    }
    terminate() {
        this.terminated = true;
    }
}

// A stub worker that really decodes, so the happy path can be exercised
// through the worker seam rather than the inline fallback.
function replyWithRealDecode(stub, data) {
    decodeCompressedChunk(data.compressed, { dtype: data.dtype, byteorder: data.byteorder })
        .then((result) => stub.replyDecoded(data.requestId, result));
}

describe('playbackDecodeWorker — every request settles (TASK-2730, W3, epic 2706)', () => {
    let realWorker;

    beforeEach(() => {
        realWorker = window.Worker;
        window.Worker = StubWorker;
        createdStubs.length = 0;
        handshakeMode = 'auto';
        decodePostHandler = null;
        // disposeWorker parks workerReadyPromise at Promise.resolve(null)
        // PERMANENTLY, and karma's real Worker triggers exactly that during
        // any earlier spec that touched decodeChunkOffThread. Without this
        // reset the stub is never constructed and every case below passes
        // vacuously on the inline branch.
        terminatePlaybackDecodeWorker();
    });

    afterEach(() => {
        terminatePlaybackDecodeWorker();
        window.Worker = realWorker;
        decodePostHandler = null;
        handshakeMode = 'auto';
    });

    it('a decode request that races worker disposal settles instead of hanging', (done) => {
        handshakeMode = 'hold';
        let terminations = 0;
        decodePostHandler = () => {
            // The first real decode postMessage tears the worker down
            // SYNCHRONOUSLY — the "left the playback page" cleanup that
            // terminatePlaybackDecodeWorker exists for. The second request's
            // .then callback is already queued and is about to run holding a
            // captured-but-dead `active`.
            terminations++;
            terminatePlaybackDecodeWorker();
        };
        let decodeCalls = 0;
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch(),
            decodeImpl: (compressed, opts) => {
                const promise = decodeChunkOffThread(compressed, opts);
                decodeCalls++;
                if (decodeCalls === 2) {
                    // Both requests are now chained onto the SAME still-pending
                    // ready promise; letting the handshake land runs their two
                    // .then callbacks back to back, with no task in between.
                    createdStubs[0].answerHandshake();
                }
                return promise;
            }
        });
        const first = settle(fetcher.fetchAndDecodeChunk('depth', [0, 0], UINT16_OPTS));
        const second = settle(fetcher.fetchAndDecodeChunk('depth', [1, 0], UINT16_OPTS));
        Promise.all([first, second]).then(([a, b]) => {
            // POSITIVE CONTROLS — without these the case passes on the inline
            // branch with the race window never opened.
            expect(createdStubs.length).toBe(1);
            expect(createdStubs[0].postedDecodes.length).toBe(1);
            expect(createdStubs[0].terminated).toBe(true);
            expect(terminations).toBe(1);
            // The request whose bytes WERE transferred surfaces as a chunk
            // error (the module header's own contract), never as zeroed data.
            expect(a.outcome).toBe('rejected');
            // The racing request settles by EITHER route — it rejects, or it
            // resolves through the inline fallback. What it must never do is
            // hang, which is what reaching this line at all proves.
            expect(['resolved', 'rejected'].indexOf(b.outcome) >= 0).toBe(true);
            done();
        }).catch(done);
    });

    it('a decode request whose worker never replies rejects on its own timeout', (done) => {
        // decodePostHandler stays null: the worker swallows the request and
        // never answers, and never fires onerror either.
        const compressed = base64ToArrayBuffer(FIXTURE_STORE_FILES['depth/c/0/0']);
        decodeChunkOffThread(compressed, Object.assign({ timeoutMs: 50 }, UINT16_OPTS)).then(
            () => done(new Error('expected the request to reject on its own timeout')),
            (error) => {
                try {
                    // POSITIVE CONTROL: the request really went off-thread.
                    expect(createdStubs.length).toBe(1);
                    expect(createdStubs[0].postedDecodes.length).toBe(1);
                    expect(error instanceof Error).toBe(true);
                    // The contract text at playbackDecodeWorker.js's fail()
                    // names the chunk dtype and says the bytes are gone.
                    expect(error.message.indexOf('\'uint16\'') >= 0).toBe(true);
                    expect(error.message.indexOf('must be refetched') >= 0).toBe(true);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it('the SHIPPED per-request timeout stays generous enough for a 67,861,500 B gunzip', () => {
        // Nobody may green the case above by shrinking the shipped default
        // instead of injecting a test-sized one.
        expect(typeof WORKER_REQUEST_TIMEOUT_MS).toBe('number');
        expect(WORKER_REQUEST_TIMEOUT_MS >= 60000).toBe(true);
    });

    it('a timed-out decode leaves neither the fetcher inflight map nor the cache poisoned', (done) => {
        const fetches = [];
        const fetcher = new PlaybackChunkFetcher({
            manifest: FIXTURE_MANIFEST,
            fetchImpl: makeFixtureFetch(fetches),
            decodeImpl: (compressed, { dtype, byteorder }) =>
                decodeChunkOffThread(compressed, { dtype, byteorder, timeoutMs: 50 })
        });
        const key = 'depth/c/0/0';
        fetcher.fetchAndDecodeChunk('depth', [0, 0], UINT16_OPTS).then(
            () => done(new Error('expected the decode to reject on its own timeout')),
            (error) => {
                try {
                    expect(error instanceof Error).toBe(true);
                    expect(fetches.length).toBe(1);
                    // The `finally` deleted it — the ONLY delete in the module.
                    expect(fetcher._inflight.has(key)).toBe(false);
                    // cache.set sits INSIDE the try AFTER the awaited decode,
                    // so a rejected decode never wrote it.
                    expect(!fetcher.cache.get(key)).toBe(true);
                } catch (e) {
                    done(e);
                    return;
                }
                // ...and a later caller therefore gets a FRESH attempt rather
                // than the dead promise or an absent cache entry: fetchImpl
                // goes 1 -> 2, not 1 -> 1.
                fetcher.fetchAndDecodeChunk('depth', [0, 0], UINT16_OPTS).then(
                    () => done(new Error('expected the second attempt to reject too')),
                    () => {
                        try {
                            expect(fetches.length).toBe(2);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    }
                );
            }
        );
    });

    it('terminatePlaybackDecodeWorker still leaves the module able to re-probe from scratch', (done) => {
        decodePostHandler = replyWithRealDecode;
        const compressed = () => base64ToArrayBuffer(FIXTURE_STORE_FILES['depth/c/0/0']);
        decodeChunkOffThread(compressed(), UINT16_OPTS).then((first) => {
            expect(createdStubs.length).toBe(1);
            expect(first.constructor).toBe(Uint16Array);
            // tearDownWorker(null, ...) — as distinct from disposeWorker's
            // permanent Promise.resolve(null).
            terminatePlaybackDecodeWorker();
            return decodeChunkOffThread(compressed(), UINT16_OPTS);
        }).then((second) => {
            // A SECOND stub was constructed — the module re-probed rather
            // than reusing a parked resolved-null ready promise.
            expect(createdStubs.length).toBe(2);
            expect(second.constructor).toBe(Uint16Array);
            return decodeCompressedChunk(compressed(), UINT16_OPTS).then((inline) => {
                expect(second.length).toBe(inline.length);
                expect(Array.from(second)).toEqual(Array.from(inline));
                done();
            });
        }).catch(done);
    });
});
