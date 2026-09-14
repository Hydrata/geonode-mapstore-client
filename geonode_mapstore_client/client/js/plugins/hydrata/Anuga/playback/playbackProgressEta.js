/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-3086 (W2.2, epic 3082) — the load-progress ETA, kept OUT of the
 * reducer (R3): a guessed total is worse than none (D5's whole point), and a
 * wall-clock measurement has no business in a pure state machine that has to
 * replay deterministically from actions alone. This is the only place a
 * `Date.now()`-shaped timestamp touches the playback progress line at all.
 *
 * `computeLoadEtaSeconds` is a PURE function of its two arguments — no
 * `Date.now()` inside it, no module state — so the 3 s gate below is
 * testable with real, small, elapsed time (a handful of setTimeout ticks),
 * never a mocked clock (this repo's karma has no sinon/fake timers).
 */

/**
 * @param {{t: number, bytesLoaded: number}[]} samples a timestamped series of
 *   the CURRENT phase's `bytesLoaded` readings, ascending by `t`
 *   (milliseconds, e.g. `Date.now()`). The caller resets this to `[]` on a
 *   run/phase change — this function never infers that from the samples
 *   themselves, and never mutates the array it is given.
 * @param {number|null|undefined} remainingBytes `bytesTotal - bytesLoaded`,
 *   or null/undefined when `bytesTotal` is not known yet — no ETA is
 *   possible without one, by design (never guessed).
 * @param {number} [windowMs] the trailing window the rate is measured over
 *   (R3: "aggregate bytes per second over the last 2 s") — a phase that
 *   crawled and then resumed at full rate reports the NEW rate, not one
 *   blended with the crawl.
 * @returns {number|null} seconds remaining, or null before >= 3 s of
 *   samples have accumulated (from the FIRST sample to the LAST, not the
 *   window above) or when there is nothing measurable to report yet.
 */
export function computeLoadEtaSeconds(samples, remainingBytes, windowMs = 2000) {
    if (!Array.isArray(samples) || samples.length < 2) {
        return null;
    }
    if (remainingBytes === null || remainingBytes === undefined || !(remainingBytes > 0)) {
        return null;
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (!first || !last || !((last.t - first.t) >= 3000)) {
        return null;
    }
    // The rate is measured over the TRAILING `windowMs` only, so a link that
    // just resumed at full speed is not held back by an earlier crawl.
    const windowStart = last.t - windowMs;
    let windowFirst = first;
    for (let i = 0; i < samples.length; i++) {
        if (samples[i].t >= windowStart) {
            windowFirst = samples[i];
            break;
        }
    }
    const elapsedS = (last.t - windowFirst.t) / 1000;
    const bytes = last.bytesLoaded - windowFirst.bytesLoaded;
    if (!(elapsedS > 0) || !(bytes > 0)) {
        return null;
    }
    const rateBps = bytes / elapsedS;
    if (!(rateBps > 0)) {
        return null;
    }
    return remainingBytes / rateBps;
}
