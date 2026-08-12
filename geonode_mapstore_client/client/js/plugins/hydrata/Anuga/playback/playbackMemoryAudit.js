/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackMemoryAudit — TASK-2744 (AC20, epic 2706).
 *
 * `computePlaybackMemoryPlan` returns a `withinBudget` boolean, and NOTHING
 * ever read it: a full-tree grep found the definition plus five assertions in
 * its own spec, and zero readers in any epic, reducer, component or fetcher.
 * `affordableChunksPerQuantity` had zero readers anywhere at all. A forecast
 * with no reader cannot be wrong, and this one was: measured on map 1461 it
 * reported `withinBudget: true` at peakResidentBytes 746,369,012 (711.8 MiB)
 * against an 800 MiB budget, in a session whose observed heap peak was
 * 840.7 MiB — already over the budget it declared itself inside of.
 *
 * This module is the missing half: it scores the prediction against a
 * measurement. It deliberately keeps TWO observations apart, because
 * conflating them is exactly how the original error reads as a contradiction:
 *
 *   accountedBytes — bytes the client can NAME (the plan's own fixed
 *     geometry/render residency plus what the chunk cache actually holds).
 *     Directly comparable to peakResidentBytes; if this exceeds the plan, the
 *     POLICY is wrong.
 *   heapBytes — performance.memory.usedJSHeapSize, which also contains
 *     garbage not yet collected, decode transients and GPU-adjacent
 *     allocations. It is an UPPER BOUND and is never used to fail anything;
 *     it is recorded so the gap has a number instead of an anecdote.
 *
 * `unaccountedBytes` is the interesting one — it is the part of the growth the
 * plan does not model at all, which is what TASK-2734's escalated AC2a/AC2b
 * are really about. Scoring it here does not fix it, and is not meant to: this
 * AC's job is to stop the forecast being unfalsifiable.
 */

/**
 * Compare a memory plan against an observation.
 *
 * @param {object|null} plan a computePlaybackMemoryPlan() result
 * @param {{accountedBytes?: number, heapBytes?: number, baselineHeapBytes?: number}} observation
 * @returns {object|null} null when there is nothing to score
 */
export function scorePlan(plan, observation = {}) {
    if (!plan) {
        return null;
    }
    const budgetBytes = plan.budgetBytes || 0;
    const predictedPeakBytes = plan.peakResidentBytes || 0;
    const accountedBytes = isFinite(observation.accountedBytes) ? observation.accountedBytes : null;
    const heapBytes = isFinite(observation.heapBytes) ? observation.heapBytes : null;
    const baselineHeapBytes = isFinite(observation.baselineHeapBytes) ? observation.baselineHeapBytes : null;
    const heapDeltaBytes = (heapBytes !== null && baselineHeapBytes !== null)
        ? heapBytes - baselineHeapBytes
        : null;

    return {
        predictedPeakBytes,
        budgetBytes,
        // what the plan claimed, unchanged — kept beside the score so the two
        // are always read together
        predictedWithinBudget: !!plan.withinBudget,
        accountedBytes,
        heapBytes,
        heapDeltaBytes,
        // the part of observed growth the plan does not model
        unaccountedBytes: (heapDeltaBytes !== null && accountedBytes !== null)
            ? heapDeltaBytes - accountedBytes
            : null,
        // THE SCORE. null when unmeasured — never defaulted to true, because a
        // silent `true` is the defect this module exists to remove.
        accountedWithinBudget: accountedBytes === null ? null : accountedBytes <= budgetBytes,
        observedWithinBudget: heapDeltaBytes === null ? null : heapDeltaBytes <= budgetBytes,
        overshootRatio: (heapDeltaBytes !== null && budgetBytes > 0)
            ? Number((heapDeltaBytes / budgetBytes).toFixed(3))
            : null
    };
}

/**
 * True when a scored plan predicted it was inside budget and the measurement
 * disagrees — i.e. the exact condition that went unnoticed on map 1461.
 */
export function isForecastContradicted(score) {
    if (!score) {
        return false;
    }
    return !!score.predictedWithinBudget
        && (score.accountedWithinBudget === false || score.observedWithinBudget === false);
}

/** A one-line human summary, for the console breadcrumb. */
export function describeScore(score) {
    if (!score) {
        return 'playback memory: no plan to score';
    }
    const mib = (b) => (b === null || b === undefined ? '—' : `${(b / 1048576).toFixed(1)} MiB`);
    return `playback memory: predicted peak ${mib(score.predictedPeakBytes)} vs budget ${mib(score.budgetBytes)}`
        + ` (plan said withinBudget=${score.predictedWithinBudget});`
        + ` accounted ${mib(score.accountedBytes)}, heap delta ${mib(score.heapDeltaBytes)},`
        + ` unaccounted ${mib(score.unaccountedBytes)}`
        + (isForecastContradicted(score) ? ' — FORECAST CONTRADICTED BY MEASUREMENT' : '');
}
