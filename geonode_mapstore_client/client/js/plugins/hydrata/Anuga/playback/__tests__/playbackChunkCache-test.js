/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2625 (W2.1, epic 2618) — PlaybackChunkCache LRU/ceiling tests.
 *
 * "cache respects its ceiling under a simulated long scrub" (AC): a scrub is
 * simulated by touching MANY more distinct chunk keys than fit under the
 * byte ceiling, in linear order (worst case for an LRU — every touch is a
 * fresh miss), then asserting total bytes never exceeds the ceiling and the
 * right (oldest-untouched) keys were the ones evicted.
 */
import expect from 'expect';
import { PlaybackChunkCache, DEFAULT_MAX_BYTES } from '../playbackChunkCache';

function chunkOf(nBytes) {
    // Float32Array byteLength = length * 4
    return new Float32Array(nBytes / 4);
}

describe('PlaybackChunkCache', () => {
    it('uses DEFAULT_MAX_BYTES when no ceiling is given', () => {
        const cache = new PlaybackChunkCache();
        expect(cache.maxBytes).toBe(DEFAULT_MAX_BYTES);
    });

    it('rejects a non-positive ceiling', () => {
        expect(() => new PlaybackChunkCache({ maxBytes: 0 })).toThrow();
        expect(() => new PlaybackChunkCache({ maxBytes: -1 })).toThrow();
    });

    it('get() on a miss returns undefined without throwing', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 1024 });
        expect(cache.get('nope')).toBe(undefined);
    });

    it('set()/get() round-trips a value and tracks totalBytes', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 1024 });
        const value = chunkOf(400);
        cache.set('a', value);
        expect(cache.get('a')).toBe(value);
        expect(cache.totalBytes).toBe(400);
        expect(cache.size).toBe(1);
    });

    it('never exceeds its byte ceiling across a long linear scrub (many more distinct chunks than fit)', () => {
        const maxBytes = 1000; // 10 chunks of 100 bytes fit exactly
        const cache = new PlaybackChunkCache({ maxBytes });
        const chunkBytes = 100;
        const totalChunksScrubbed = 250; // 25x the ceiling's capacity
        for (let i = 0; i < totalChunksScrubbed; i++) {
            cache.set(`depth/c/${i}/0`, chunkOf(chunkBytes));
            expect(cache.totalBytes <= maxBytes).toBe(true, `totalBytes ${cache.totalBytes} exceeded ceiling ${maxBytes} at i=${i}`);
        }
        // Only the most-recently-touched window can possibly still be resident.
        expect(cache.size <= Math.ceil(maxBytes / chunkBytes)).toBe(true);
        // The very first chunks scrubbed must be long gone.
        expect(cache.has('depth/c/0/0')).toBe(false);
        expect(cache.has('depth/c/1/0')).toBe(false);
        // The most recent chunk must still be resident.
        expect(cache.has(`depth/c/${totalChunksScrubbed - 1}/0`)).toBe(true);
    });

    it('evicts least-recently-used first, not insertion order, once a key has been re-touched via get()', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 300 }); // 3 x 100-byte chunks fit
        cache.set('a', chunkOf(100));
        cache.set('b', chunkOf(100));
        cache.set('c', chunkOf(100));
        // Touch 'a' so it becomes MOST recently used; 'b' is now the LRU entry.
        cache.get('a');
        cache.set('d', chunkOf(100)); // forces exactly one eviction
        expect(cache.has('b')).toBe(false); // evicted (was LRU)
        expect(cache.has('a')).toBe(true); // survived (was touched)
        expect(cache.has('c')).toBe(true);
        expect(cache.has('d')).toBe(true);
        expect(cache.lastEvictedKeys()).toEqual(['b']);
    });

    it('re-setting an existing key updates its size and moves it to most-recently-used without double-counting bytes', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 1000 });
        cache.set('a', chunkOf(100));
        cache.set('a', chunkOf(400)); // replace with a bigger value
        expect(cache.totalBytes).toBe(400);
        expect(cache.size).toBe(1);
    });

    it('a single entry larger than the ceiling is still stored (never silently dropped) and evicts every other entry', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 300 });
        cache.set('small', chunkOf(100));
        cache.set('huge', chunkOf(4000)); // bigger than the whole ceiling
        expect(cache.has('huge')).toBe(true);
        expect(cache.has('small')).toBe(false);
        expect(cache.size).toBe(1);
    });

    /*
     * TASK-2985 (W1.2, epic 2981) — evict(key), the named removal the fill
     * queue needs. At HEAD the cache exposed resize/keys/has/get/set/
     * lastEvictedKeys/clear and NO delete or evict at all, so a caller that
     * knew WHICH chunk should go had no way to say so.
     */
    describe('evict(key) — TASK-2985', () => {
        it('removes exactly the named key and decrements totalBytes', () => {
            const cache = new PlaybackChunkCache({ maxBytes: 1000 });
            cache.set('depth/c/0/0', chunkOf(100));
            cache.set('depth/c/1/0', chunkOf(200));
            expect(cache.totalBytes).toBe(300);
            expect(cache.evict('depth/c/0/0')).toBe(true);
            expect(cache.has('depth/c/0/0')).toBe(false);
            expect(cache.has('depth/c/1/0')).toBe(true);
            expect(cache.totalBytes).toBe(200);
            expect(cache.size).toBe(1);
        });

        it('is a NO-OP on a miss, not an error', () => {
            // The caller is removing something it believes is there; a race
            // that removed it first is exactly as good an outcome.
            const cache = new PlaybackChunkCache({ maxBytes: 1000 });
            cache.set('depth/c/0/0', chunkOf(100));
            expect(cache.evict('depth/c/9/0')).toBe(false);
            expect(cache.totalBytes).toBe(100);
            expect(cache.size).toBe(1);
        });

        it('does NOT promote what it walks past — the LRU order it bypasses stays put', () => {
            // get() promotes (delete + re-set). If evict() did too, a queue
            // that evicts would reorder the very LRU it is overriding.
            const cache = new PlaybackChunkCache({ maxBytes: 1000 });
            cache.set('a', chunkOf(100));
            cache.set('b', chunkOf(100));
            cache.set('c', chunkOf(100));
            cache.evict('b');
            expect(cache.keys()).toEqual(['a', 'c']);
        });
    });

    it('clear() empties the cache and resets totalBytes', () => {
        const cache = new PlaybackChunkCache({ maxBytes: 1000 });
        cache.set('a', chunkOf(100));
        cache.clear();
        expect(cache.size).toBe(0);
        expect(cache.totalBytes).toBe(0);
        expect(cache.get('a')).toBe(undefined);
    });
});
