/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2744 (AC20, epic 2706) — `memoryPlan.withinBudget` IS A FORECAST
 * NOBODY SCORES.
 *
 * RED on HEAD, measured on map 1461 and confirmed by grep: `withinBudget` had
 * ZERO production readers (its definition in playbackMemoryPolicy.js plus five
 * assertions in that module's own spec), and `affordableChunksPerQuantity` had
 * zero readers anywhere at all. The live plan reported withinBudget:true at
 * peakResidentBytes 746,369,012 (711.8 MiB) against budgetBytes 838,860,800
 * (800 MiB) in a session whose measured heap peak was 840.7 MiB — already over
 * the budget it declared itself inside of, with nothing to notice.
 */
import expect from 'expect';
import { scorePlan, isForecastContradicted, describeScore } from '../playbackMemoryAudit';

// The plan measured live on map 1461, verbatim.
const MSIMBAZI_PLAN = {
    peakResidentBytes: 746369012,
    budgetBytes: 838860800,
    fixedBytes: 339222496,
    cacheMaxBytes: 407146516,
    affordableChunksPerQuantity: 2,
    chunksPerQuantity: 2,
    withinBudget: true
};

describe('playbackMemoryAudit — TASK-2744 AC20', () => {
    it('scores an unmeasured plan as UNKNOWN, never as within budget', () => {
        const score = scorePlan(MSIMBAZI_PLAN, {});
        expect(score.predictedWithinBudget).toBe(true);
        // the whole point: absence of measurement is not a pass
        expect(score.accountedWithinBudget).toBe(null);
        expect(score.observedWithinBudget).toBe(null);
        expect(isForecastContradicted(score)).toBe(false);
    });

    it('CONTRADICTS the forecast when the observed heap delta exceeds the budget', () => {
        // The session that went unnoticed, from epic decision d13 / TASK-2734
        // comment 1689: on map 1461 the baseline was 210 MiB and the TRANSIENT
        // peak 1326 MiB — a delta of +1116 MiB against a plan reporting
        // withinBudget:true for a 800 MiB budget.
        //
        // NOTE the comparison that matters is the DELTA, not the absolute
        // heap: the plan budgets playback's OWN residency, so an absolute
        // usedJSHeapSize (which includes the whole app) is not comparable to
        // it. A settled 840 MiB absolute over a 196 MiB baseline is 644 MiB of
        // playback and genuinely within budget; +1116 MiB is not.
        const score = scorePlan(MSIMBAZI_PLAN, {
            accountedBytes: MSIMBAZI_PLAN.fixedBytes,
            baselineHeapBytes: 220200960,    // 210 MiB
            heapBytes: 1390411776            // 1326 MiB
        });
        expect(score.heapDeltaBytes).toBe(1390411776 - 220200960);
        expect(Math.round(score.heapDeltaBytes / 1048576)).toBe(1116);
        expect(score.observedWithinBudget).toBe(false);
        expect(score.predictedWithinBudget).toBe(true);
        expect(isForecastContradicted(score)).toBe(true);
        expect(describeScore(score)).toContain('FORECAST CONTRADICTED BY MEASUREMENT');
    });

    it('flags an ACCOUNTED breach separately — that one is a policy bug, not GC noise', () => {
        const score = scorePlan(MSIMBAZI_PLAN, { accountedBytes: 900000000 });
        expect(score.accountedWithinBudget).toBe(false);
        expect(isForecastContradicted(score)).toBe(true);
    });

    it('reports the unaccounted gap — the number the dogfood session actually wanted', () => {
        const score = scorePlan(MSIMBAZI_PLAN, {
            accountedBytes: 400000000,
            baselineHeapBytes: 200000000,
            heapBytes: 1000000000
        });
        expect(score.unaccountedBytes).toBe(800000000 - 400000000);
        expect(score.overshootRatio).toBe(Number((800000000 / 838860800).toFixed(3)));
    });

    it('does not claim a contradiction when the plan never predicted success', () => {
        const score = scorePlan({ ...MSIMBAZI_PLAN, withinBudget: false }, {
            baselineHeapBytes: 0, heapBytes: 2000000000
        });
        expect(isForecastContradicted(score)).toBe(false);
    });

    it('returns null for no plan at all rather than inventing one', () => {
        expect(scorePlan(null, { heapBytes: 1 })).toBe(null);
        expect(isForecastContradicted(null)).toBe(false);
    });
});
