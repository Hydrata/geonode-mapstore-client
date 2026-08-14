/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';

import playbackController, {
    createInitialPlaybackState,
    PLAYBACK_STATUS
} from '../playbackController';
import {
    playbackTick,
    playbackChunksBuffered,
    playbackDismissDegraded
} from '../actions/playbackActions';

/*
 * The degraded-playback warning, reviewed against a live UAT reading.
 *
 * As shipped it was `stallCount >= 3` where stallCount counted TICKS at
 * TICK_INTERVAL_MS = 50 — a 150ms threshold, shorter than any chunk fetch the
 * prod-scale store can do (one was timed at 869ms). stallCount was never
 * reset despite its comment saying "consecutive", and `degraded` was written
 * as `state.degraded || …` with no path back to false, so a live reading
 * found stallCount=144 and degraded=true on a run that had just played end to
 * end cleanly, with the warning still on screen and no way to clear it.
 */
describe('degraded playback flag', () => {
    // A run whose window is never buffered, so every tick stalls.
    function stalledRun(over) {
        return {
            ...createInitialPlaybackState(),
            status: PLAYBACK_STATUS.PLAYING,
            nTime: 31,
            chunkLengthT: 10,
            totalChunks: 4,
            bufferWindowRadius: 0,
            time: Float64Array.from({ length: 31 }, (_, i) => i * 60),
            bufferedChunks: [],
            currentTimestep: 0,
            playheadSeconds: 0,
            lastTickMs: 0,
            speed: 1,
            ...over
        };
    }
    const tick = (state, nowMs) => playbackController(state, playbackTick(nowMs));

    it('does NOT raise on a brief stall — the old 150ms bar', () => {
        let s = stalledRun();
        // Five ticks at the real 50ms interval = 250ms of waiting. The old
        // rule tripped at three ticks; a chunk fetch takes far longer.
        [50, 100, 150, 200, 250].forEach((ms) => { s = tick(s, ms); });
        expect(s.status).toBe(PLAYBACK_STATUS.STALLED);
        expect(s.stallCount).toBe(5);
        expect(s.degraded).toBe(false);
    });

    it('does not raise for an 869ms fetch — the measured healthy case', () => {
        let s = stalledRun();
        for (let ms = 50; ms <= 869; ms += 50) { s = tick(s, ms); }
        expect(s.degraded).toBe(false);
    });

    it('raises once playback has genuinely been stuck for 2.5s', () => {
        let s = stalledRun();
        for (let ms = 50; ms <= 2600; ms += 50) { s = tick(s, ms); }
        expect(s.degraded).toBe(true);
    });

    it('is driven by elapsed time, not tick count — a slower tick rate raises it just the same', () => {
        // Same 2.5s of stall, only 5 ticks. The old rule keyed on the count,
        // so it silently tracked TICK_INTERVAL_MS.
        let s = stalledRun();
        [500, 1000, 1500, 2000, 2500, 3000].forEach((ms) => { s = tick(s, ms); });
        expect(s.stallCount).toBe(6);
        expect(s.degraded).toBe(true);
    });

    describe('recovery', () => {
        // Buffering chunk 0 makes timestep 0's window playable again.
        const recover = (s) => playbackController(s, playbackChunksBuffered([0, 1], true));

        it('clears the stall bookkeeping', () => {
            let s = stalledRun();
            for (let ms = 50; ms <= 2600; ms += 50) { s = tick(s, ms); }
            expect(s.degraded).toBe(true);

            s = recover(s);
            expect(s.stalledSinceMs).toBe(null);
            expect(s.stallCount).toBe(0);
            expect(s.degraded).toBe(false);
        });

        /* THE BUG THE COMMENT CLAIMED WAS NOT THERE. stallCount survived
           recovery, so three isolated hiccups an hour apart summed to a
           permanent warning. */
        it('makes "consecutive" true — separate short stalls never accumulate', () => {
            let s = stalledRun();
            for (let round = 0; round < 6; round++) {
                const base = round * 10000;
                for (let ms = 50; ms <= 200; ms += 50) {
                    s = tick(s, base + ms);
                }
                expect(s.stallCount).toBe(4);
                s = recover(s);
                s = { ...s, status: PLAYBACK_STATUS.PLAYING, bufferedChunks: [] };
            }
            expect(s.degraded).toBe(false);
        });

        it('a stall AFTER recovery must re-earn the full 2.5s', () => {
            let s = stalledRun();
            for (let ms = 50; ms <= 2600; ms += 50) { s = tick(s, ms); }
            s = recover(s);
            s = { ...s, status: PLAYBACK_STATUS.PLAYING, bufferedChunks: [] };
            [3000, 3050, 3100].forEach((ms) => { s = tick(s, ms); });
            expect(s.degraded).toBe(false);
        });
    });

    describe('dismissal', () => {
        it('is off by default', () => {
            expect(createInitialPlaybackState().degradedDismissed).toBe(false);
        });

        it('records the dismissal without falsifying the degraded state', () => {
            let s = stalledRun();
            for (let ms = 50; ms <= 2600; ms += 50) { s = tick(s, ms); }
            s = playbackController(s, playbackDismissDegraded());
            expect(s.degradedDismissed).toBe(true);
            // State stays a truthful record of what playback is doing; only
            // whether we SAY it changes.
            expect(s.degraded).toBe(true);
        });

        it('sticks across a later stall, so it need not be repeated', () => {
            let s = stalledRun();
            for (let ms = 50; ms <= 2600; ms += 50) { s = tick(s, ms); }
            s = playbackController(s, playbackDismissDegraded());
            s = playbackController(s, playbackChunksBuffered([0, 1], true));
            s = { ...s, status: PLAYBACK_STATUS.PLAYING, bufferedChunks: [] };
            for (let ms = 5000; ms <= 8000; ms += 50) { s = tick(s, ms); }
            expect(s.degraded).toBe(true);
            expect(s.degradedDismissed).toBe(true);
        });
    });
});
