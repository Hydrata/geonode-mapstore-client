/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-3025 (W4.5, epic 2981) — the runtime-tunable playback memory policy.
 *
 * Two rungs with DIFFERENT safety directions, so most of this file is about
 * what must NOT be honoured: a url param in a tab that is not a tester's, a
 * site value that would make playback more aggressive for every anonymous
 * visitor, and any value at all that would breach the module's own bands.
 */
import expect from 'expect';
import {
    resolvePlaybackPolicyOverrides,
    describePolicyOverrides,
    isPlaybackPolicyTester,
    readLocationParams,
    parseMiB,
    POLICY_KEYS,
    SITE_SAFE_DIRECTION,
    URL_PARAM_BY_KEY,
    SITE_KEY_BY_KEY,
    PLAYBACK_POLICY_OVERRIDE_PREFIX
} from '../playbackPolicyOverrides';
import {
    computePlaybackMemoryPlan,
    resolvePlaybackHeapBudget,
    APP_BASELINE_FLOOR_BYTES,
    PLAN_TRANSIENT_EXCESS_BYTES,
    PLAN_UNCAP_MAX_PEAK_BYTES,
    PLAYBACK_HEAP_BUDGET_MAX_BYTES,
    MIN_CHUNKS_PER_QUANTITY,
    SHIPPED_POLICY_CONSTANTS
} from '../playbackMemoryPolicy';

const MIB = 1024 * 1024;

// A store big enough that the window arithmetic actually bites: the AC2 table
// shape, i.e. the 1412 mirror's own numbers.
const STORE = {
    nNode: 145824,
    nFace: 290407,
    chunkLengthT: 10,
    totalChunks: 11,
    budgetBytes: 1760 * MIB
};

const plan = (overrides = {}) => computePlaybackMemoryPlan({ ...STORE, ...overrides });
const loc = (search) => ({ search, hash: '#/map/118' });

describe('playbackPolicyOverrides (TASK-3025)', () => {
    describe('parsing', () => {
        it('reads MiB and returns bytes', () => {
            expect(parseMiB(320)).toBe(320 * MIB);
            expect(parseMiB('320')).toBe(320 * MIB);
        });
        it('refuses everything that is not a positive finite number', () => {
            [null, undefined, '', 'abc', NaN, -1, '-40', 0, [320], {}].forEach((bad) => {
                expect(parseMiB(bad)).toBe(null);
            });
        });
        it('reads params from BOTH the search string and the hash route, hash winning', () => {
            const params = readLocationParams({
                search: '?pbUncapMaxPeakMiB=300&other=1',
                hash: '#/map/118?pbUncapMaxPeakMiB=380&pbAppBaselineFloorMiB=320'
            });
            expect(params.pbUncapMaxPeakMiB).toBe('380');
            expect(params.pbAppBaselineFloorMiB).toBe('320');
            expect(params.other).toBe('1');
        });
        it('survives a location with neither half', () => {
            expect(readLocationParams(null)).toEqual({});
            expect(readLocationParams({})).toEqual({});
        });
    });

    describe('AC3 — RUNG 1 FAILS CLOSED on an un-hydrated tester flag', () => {
        // canSelectComputeTarget arrives from an async fetch dispatched on
        // INIT_ANUGA (uiReducer.js sets it as `cfg.can_select_compute_target
        // === true`, initial state false). PLAYBACK_INIT can precede that
        // fetch resolving, and an un-hydrated read must yield the shipped
        // constant — never an honoured override.
        it('isPlaybackPolicyTester is false for every un-hydrated shape', () => {
            [undefined, {}, { anuga: {} }, { anuga: { ui: {} } },
                { anuga: { ui: { canSelectComputeTarget: undefined } } },
                { anuga: { ui: { canSelectComputeTarget: false } } },
                { anuga: { ui: { canSelectComputeTarget: 'true' } } },
                { anuga: { ui: { canSelectComputeTarget: 1 } } }
            ].forEach((state) => {
                expect(isPlaybackPolicyTester(state)).toBe(false);
            });
            expect(isPlaybackPolicyTester({ anuga: { ui: { canSelectComputeTarget: true } } })).toBe(true);
        });

        it('a url param in a non-tester tab is IGNORED and the plan is byte-identical', () => {
            const resolution = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=2000&pbPlanTransientExcessMiB=0.5'),
                isTester: false
            });
            expect(resolution.overrides.uncapMaxPeakBytes).toBe(undefined);
            expect(resolution.overrides.planTransientExcessBytes).toBe(undefined);
            expect(resolution.notes.length).toBe(2);
            expect(resolution.notes[0].indexOf('canSelectComputeTarget') > -1).toBe(true);
            expect(plan(resolution.overrides)).toEqual(plan());
        });

        it('the same params in a TESTER tab are honoured', () => {
            const resolution = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=300'),
                isTester: true
            });
            expect(resolution.overrides.uncapMaxPeakBytes).toBe(300 * MIB);
            expect(resolution.sources.uncapMaxPeakBytes).toBe('url');
        });
    });

    describe('AC2 — RUNG 1, per tester, per tab, BOTH directions', () => {
        it('honours a more aggressive value for a tester (the blast radius is one tab)', () => {
            const resolution = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=900&pbAppBaselineFloorMiB=120&pbPlanTransientExcessMiB=400'),
                isTester: true
            });
            expect(resolution.overrides.uncapMaxPeakBytes).toBe(900 * MIB);
            expect(resolution.overrides.appBaselineFloorBytes).toBe(120 * MIB);
            expect(resolution.overrides.planTransientExcessBytes).toBe(400 * MIB);
            POLICY_KEYS.forEach((key) => expect(resolution.sources[key]).toBe('url'));
        });

        it('an absent param uses the shipped constant', () => {
            const resolution = resolvePlaybackPolicyOverrides({ location: loc('?zoom=4'), isTester: true });
            expect(resolution.overrides).toEqual({ overrideSources: {} });
            expect(resolution.supplied).toBe(false);
            expect(plan(resolution.overrides)).toEqual(plan());
        });

        it('a malformed / NaN / negative param is IGNORED, the shipped constant is used, and it is logged', () => {
            const resolution = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=banana&pbAppBaselineFloorMiB=-40&pbPlanTransientExcessMiB='),
                isTester: true
            });
            expect(resolution.overrides.uncapMaxPeakBytes).toBe(undefined);
            expect(resolution.overrides.appBaselineFloorBytes).toBe(undefined);
            expect(resolution.overrides.planTransientExcessBytes).toBe(undefined);
            expect(resolution.notes.length).toBe(3);
            resolution.notes.forEach((note) => expect(note.indexOf('IGNORED') > -1).toBe(true));
            expect(plan(resolution.overrides)).toEqual(plan());
        });
    });

    describe('AC4 — RUNG 2, per site, SAFE DIRECTION ONLY (six specs)', () => {
        const site = (block) => resolvePlaybackPolicyOverrides({ siteConfig: { playbackMemory: block } });

        it('appBaselineFloorMiB HIGHER than shipped is accepted (less budget offered)', () => {
            const r = site({ appBaselineFloorMiB: 400 });
            expect(r.overrides.appBaselineFloorBytes).toBe(400 * MIB);
            expect(r.sources.appBaselineFloorBytes).toBe('site');
        });
        it('appBaselineFloorMiB LOWER than shipped is REJECTED and logged', () => {
            const r = site({ appBaselineFloorMiB: 120 });
            expect(r.overrides.appBaselineFloorBytes).toBe(undefined);
            expect(r.notes.length).toBe(1);
            expect(r.notes[0].indexOf('REJECTED') > -1).toBe(true);
        });
        it('planTransientExcessMiB HIGHER than shipped is accepted (shallower window)', () => {
            const r = site({ planTransientExcessMiB: 900 });
            expect(r.overrides.planTransientExcessBytes).toBe(900 * MIB);
            expect(r.sources.planTransientExcessBytes).toBe('site');
        });
        it('planTransientExcessMiB LOWER than shipped is REJECTED and logged', () => {
            const r = site({ planTransientExcessMiB: 100 });
            expect(r.overrides.planTransientExcessBytes).toBe(undefined);
            expect(r.notes[0].indexOf('REJECTED') > -1).toBe(true);
        });
        it('uncapMaxPeakMiB LOWER than shipped is accepted (shallower window)', () => {
            const r = site({ uncapMaxPeakMiB: 300 });
            expect(r.overrides.uncapMaxPeakBytes).toBe(300 * MIB);
            expect(r.sources.uncapMaxPeakBytes).toBe('site');
        });
        it('uncapMaxPeakMiB HIGHER than shipped is REJECTED and logged', () => {
            const r = site({ uncapMaxPeakMiB: 900 });
            expect(r.overrides.uncapMaxPeakBytes).toBe(undefined);
            expect(r.notes[0].indexOf('REJECTED') > -1).toBe(true);
        });

        it('a rejected site value is REJECTED, not clamped to the shipped constant silently', () => {
            // The difference matters: a clamped value and an absent one make
            // the SAME plan, so only the note and the source can tell them
            // apart — which is what makes the census falsifiable at all.
            const r = site({ uncapMaxPeakMiB: 900 });
            expect(plan(r.overrides)).toEqual(plan());
            expect(r.supplied).toBe(true);
            expect(r.sources.uncapMaxPeakBytes).toBe(undefined);
            expect(describePolicyOverrides(r).indexOf('REJECTED') > -1).toBe(true);
        });

        it('the SAFE DIRECTION table agrees with the arithmetic it claims', () => {
            // A HIGHER floor or excess, or a LOWER ceiling, can only ever
            // shrink the window — the property the table asserts in words.
            const shallower = plan({
                appBaselineFloorBytes: SHIPPED_POLICY_CONSTANTS.appBaselineFloorBytes + 40 * MIB,
                planTransientExcessBytes: SHIPPED_POLICY_CONSTANTS.planTransientExcessBytes + 200 * MIB,
                uncapMaxPeakBytes: SHIPPED_POLICY_CONSTANTS.uncapMaxPeakBytes - 100 * MIB
            });
            expect(shallower.chunksPerQuantity <= plan().chunksPerQuantity).toBe(true);
            expect(shallower.peakResidentBytes <= plan().peakResidentBytes).toBe(true);
            expect(SITE_SAFE_DIRECTION.appBaselineFloorBytes).toBe('higher');
            expect(SITE_SAFE_DIRECTION.planTransientExcessBytes).toBe('higher');
            expect(SITE_SAFE_DIRECTION.uncapMaxPeakBytes).toBe('lower');
        });

        it('a malformed site value is IGNORED and logged, never coerced', () => {
            const r = site({ uncapMaxPeakMiB: 'small' });
            expect(r.overrides.uncapMaxPeakBytes).toBe(undefined);
            expect(r.notes[0].indexOf('IGNORED') > -1).toBe(true);
        });

        it('an absent playbackMemory block supplies nothing', () => {
            expect(resolvePlaybackPolicyOverrides({ siteConfig: {} }).supplied).toBe(false);
            expect(resolvePlaybackPolicyOverrides({ siteConfig: null }).supplied).toBe(false);
            expect(resolvePlaybackPolicyOverrides({ siteConfig: { defaultTerrain: 'GLO-30' } }).supplied).toBe(false);
        });
    });

    describe('precedence', () => {
        it("a tester's url wins over the site row for the same key, and the source says so", () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=200'),
                siteConfig: { playbackMemory: { uncapMaxPeakMiB: 350, planTransientExcessMiB: 900 } },
                isTester: true
            });
            expect(r.overrides.uncapMaxPeakBytes).toBe(200 * MIB);
            expect(r.sources.uncapMaxPeakBytes).toBe('url');
            // the site's OTHER key is untouched by that
            expect(r.overrides.planTransientExcessBytes).toBe(900 * MIB);
            expect(r.sources.planTransientExcessBytes).toBe('site');
        });

        it('a non-tester url does NOT undo an accepted site value', () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=900'),
                siteConfig: { playbackMemory: { uncapMaxPeakMiB: 350 } },
                isTester: false
            });
            expect(r.overrides.uncapMaxPeakBytes).toBe(350 * MIB);
            expect(r.sources.uncapMaxPeakBytes).toBe('site');
        });
    });

    describe('AC5 — the HARD CEILING no rung may breach', () => {
        const absurd = 999999 * MIB;

        it('an absurd URL override cannot breach the bands or the window floor', () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc(`?pbUncapMaxPeakMiB=${absurd / MIB}&pbPlanTransientExcessMiB=${absurd / MIB}`
                    + `&pbAppBaselineFloorMiB=${absurd / MIB}`),
                isTester: true
            });
            const p = plan(r.overrides);
            expect(p.peakResidentBytes <= PLAYBACK_HEAP_BUDGET_MAX_BYTES).toBe(true);
            expect(p.chunksPerQuantity >= MIN_CHUNKS_PER_QUANTITY).toBe(true);
            expect(p.chunksPerQuantity <= STORE.totalChunks).toBe(true);
            // out of band -> the shipped constant, and the echo says 'shipped'
            expect(p.uncapMaxPeakBytes).toBe(PLAN_UNCAP_MAX_PEAK_BYTES);
            expect(p.planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BYTES);
            expect(p.overrideSources.uncapMaxPeakBytes).toBe('shipped');
        });

        it('an absurd SITE override cannot breach them either', () => {
            const r = resolvePlaybackPolicyOverrides({
                siteConfig: { playbackMemory: { planTransientExcessMiB: absurd / MIB, appBaselineFloorMiB: absurd / MIB } }
            });
            const p = plan(r.overrides);
            expect(p.peakResidentBytes <= PLAYBACK_HEAP_BUDGET_MAX_BYTES).toBe(true);
            expect(p.chunksPerQuantity >= MIN_CHUNKS_PER_QUANTITY).toBe(true);
            expect(p.chunksPerQuantity <= STORE.totalChunks).toBe(true);
            expect(p.planTransientExcessBytes).toBe(PLAN_TRANSIENT_EXCESS_BYTES);
            expect(p.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
        });

        it('a hostile budget resolve keeps the resolved budget under the module ceiling', () => {
            const budget = resolvePlaybackHeapBudget({
                jsHeapSizeLimit: 64 * 1024 * MIB,
                usedJSHeapSize: 100 * MIB,
                deviceMemoryGiB: 512,
                appBaselineFloorBytes: absurd
            });
            expect(budget.budgetBytes <= PLAYBACK_HEAP_BUDGET_MAX_BYTES).toBe(true);
            expect(budget.appBaselineFloorBytes).toBe(APP_BASELINE_FLOOR_BYTES);
            expect(budget.overrideSources.appBaselineFloorBytes).toBe('shipped');
        });
    });

    describe('AC7 — ANTI-INERT', () => {
        it('(i) an override MOVES a plan cell, by the exact expected numbers', () => {
            // THE ARITHMETIC, so a future reader can check the pins rather
            // than trust them. fixed.total = 14,562,544 B for this mesh and
            // one chunk across the three quantities costs
            // 3 x 10 x 145,824 x 2 = 8,749,440 B.
            //   before: windowBudget = min(1760 - 680, 440) MiB = 440 MiB
            //           deep = floor((461,373,440 - 14,562,544) / 8,749,440)
            //                = 51, clamped to totalChunks 11
            //           peak = 14,562,544 + 3 x 11 x 2,916,480 = 110,806,384
            //   after (ceiling dropped to 60 MiB):
            //           deep = floor((62,914,560 - 14,562,544) / 8,749,440) = 5
            //           peak = 14,562,544 + 3 x 5 x 2,916,480 = 58,309,744
            const before = plan();
            const after = plan({ uncapMaxPeakBytes: 60 * MIB });
            expect(before.chunksPerQuantity).toBe(11);
            expect(before.peakResidentBytes).toBe(110806384);
            expect(after.chunksPerQuantity).toBe(5);
            expect(after.peakResidentBytes).toBe(58309744);
            expect(after.windowBudgetBytes).toBe(60 * MIB);
        });

        it('(ii) with NO override from either rung the plan is BYTE-IDENTICAL to the shipped one', () => {
            const r = resolvePlaybackPolicyOverrides({ location: loc(''), siteConfig: null, isTester: true });
            expect(plan(r.overrides)).toEqual(plan());
            expect(plan(r.overrides).overrideSource).toBe('shipped');
            expect(plan(r.overrides).overrideSources).toEqual({
                planTransientExcessBytes: 'shipped',
                uncapMaxPeakBytes: 'shipped',
                appBaselineFloorBytes: 'shipped'
            });
        });

        it('(iii) overrideSources names the RUNG behind each effective value', () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=300'),
                siteConfig: { playbackMemory: { planTransientExcessMiB: 900 } },
                isTester: true
            });
            const p = plan(r.overrides);
            expect(p.overrideSources).toEqual({
                planTransientExcessBytes: 'site',
                uncapMaxPeakBytes: 'url',
                appBaselineFloorBytes: 'shipped'
            });
            expect(p.overrideSource).toBe('override');
        });

        it('(iii) an override EQUAL to the shipped constant reads "shipped", because nothing moved', () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc(`?pbUncapMaxPeakMiB=${PLAN_UNCAP_MAX_PEAK_BYTES / MIB}`),
                isTester: true
            });
            expect(r.sources.uncapMaxPeakBytes).toBe('url');
            expect(plan(r.overrides).overrideSources.uncapMaxPeakBytes).toBe('shipped');
        });
    });

    describe('the resolution log line', () => {
        it('names every effective value, its rung, and every refusal', () => {
            const r = resolvePlaybackPolicyOverrides({
                location: loc('?pbUncapMaxPeakMiB=300'),
                siteConfig: { playbackMemory: { appBaselineFloorMiB: 120 } },
                isTester: true
            });
            const line = describePolicyOverrides(r);
            expect(line.indexOf('uncapMaxPeakBytes=300.0 MiB (url)') > -1).toBe(true);
            expect(line.indexOf('appBaselineFloorBytes=280.0 MiB (shipped)') > -1).toBe(true);
            expect(line.indexOf('REJECTED') > -1).toBe(true);
            expect(PLAYBACK_POLICY_OVERRIDE_PREFIX.indexOf('[playback]') === 0).toBe(true);
        });

        it('the transport key tables are the ones the runbook documents', () => {
            expect(URL_PARAM_BY_KEY).toEqual({
                appBaselineFloorBytes: 'pbAppBaselineFloorMiB',
                planTransientExcessBytes: 'pbPlanTransientExcessMiB',
                uncapMaxPeakBytes: 'pbUncapMaxPeakMiB'
            });
            expect(SITE_KEY_BY_KEY).toEqual({
                appBaselineFloorBytes: 'appBaselineFloorMiB',
                planTransientExcessBytes: 'planTransientExcessMiB',
                uncapMaxPeakBytes: 'uncapMaxPeakMiB'
            });
        });
    });
});
