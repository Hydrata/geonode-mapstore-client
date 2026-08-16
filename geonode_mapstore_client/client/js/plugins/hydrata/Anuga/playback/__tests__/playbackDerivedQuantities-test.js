/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2629 (W4.1, epic 2618) — playbackDerivedQuantities tests.
 *
 * Formula cases below deliberately parametrize g/rhoW with clean values
 * (4, 9, 10, 1...) rather than always the store's real 9.8/1023 — every
 * formula function takes g/rhoW as plain arguments (never hardcoded), so a
 * clean value makes the expected result hand-verifiable exactly rather than
 * an irrational sqrt(9.8) chased to N decimal places. Real-9.8 numeric
 * parity against an actual store is the Python reference fixture's job
 * (docs/reports/task-2618-w4-derived-quantity-fixtures/, deploy worktree),
 * not this unit suite's.
 */
import expect from 'expect';
import {
    QUANTITY_IDS,
    QUANTITY_MODE_INDEX,
    QUANTITY_META,
    availableQuantityIds,
    AIDR_HAZARD_TABLE,
    AIDR_HAZARD_CLASS_COUNT,
    classifyHazard,
    isNearHazardBoundary,
    computeStage,
    computeDIV,
    computeFroude,
    computeShear,
    computeCourant,
    mixDtSeconds,
    ENVELOPE_BACKEND_NAME,
    ENVELOPE_QUANTITY_IDS,
    envelopeArrayName,
    availableEnvelopeQuantityIds
} from '../playbackDerivedQuantities';

describe('playbackDerivedQuantities', () => {
    describe('QUANTITY_IDS / QUANTITY_MODE_INDEX / QUANTITY_META', () => {
        it('has exactly the eight AC-required quantities', () => {
            expect(QUANTITY_IDS).toEqual(['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear', 'courant']);
        });

        it('QUANTITY_MODE_INDEX assigns a unique 0..7 index to every id (matches playbackShaders uColorMode)', () => {
            const indices = QUANTITY_IDS.map((id) => QUANTITY_MODE_INDEX[id]);
            expect(indices.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        });

        it('every id has QUANTITY_META with a unit/requiresDt/discrete', () => {
            QUANTITY_IDS.forEach((id) => {
                expect(QUANTITY_META[id]).toBeTruthy();
                expect(typeof QUANTITY_META[id].unit).toBe('string');
                expect(typeof QUANTITY_META[id].requiresDt).toBe('boolean');
                expect(typeof QUANTITY_META[id].discrete).toBe('boolean');
            });
        });

        it('only `courant` requires dt', () => {
            const requiring = QUANTITY_IDS.filter((id) => QUANTITY_META[id].requiresDt);
            expect(requiring).toEqual(['courant']);
        });

        it('`hazard` is the only discrete (classed) quantity', () => {
            const discrete = QUANTITY_IDS.filter((id) => QUANTITY_META[id].discrete);
            expect(discrete).toEqual(['hazard']);
        });
    });

    describe('availableQuantityIds (AC: Courant hidden gracefully when dt absent)', () => {
        it('omits ONLY courant when hasDt is false', () => {
            const available = availableQuantityIds(false);
            expect(available).toEqual(['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear']);
            expect(available).toNotContain('courant');
        });

        it('includes all eight when hasDt is true', () => {
            expect(availableQuantityIds(true)).toEqual(QUANTITY_IDS);
        });
    });

    describe('AIDR hazard table (AIDR Guideline 7-3 (2017) Table 2, p.11)', () => {
        it('has five explicit rows (H1-H5) plus the H6 catch-all', () => {
            expect(AIDR_HAZARD_TABLE.length).toBe(5);
            expect(AIDR_HAZARD_CLASS_COUNT).toBe(6);
            expect(AIDR_HAZARD_TABLE.map((r) => r.className)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
        });

        it('the table\'s own thresholds match the published Table 2 values verbatim', () => {
            // Shallow-copy each row: this repo's `expect@1.20.1` toEqual
            // treats object EXTENSIBILITY as part of deep-equality (via
            // is-equal's integrity-level check), so comparing the source's
            // Object.freeze()'d rows directly against a plain-object literal
            // fails on frozen-ness alone, not content — see the W4 wave
            // report's Phase 0.5 note. Copying strips the frozen flag while
            // leaving every field verbatim.
            expect(AIDR_HAZARD_TABLE.map((row) => ({ ...row }))).toEqual([
                { classIndex: 0, className: 'H1', maxDV: 0.3, maxD: 0.3, maxV: 2.0 },
                { classIndex: 1, className: 'H2', maxDV: 0.6, maxD: 0.5, maxV: 2.0 },
                { classIndex: 2, className: 'H3', maxDV: 0.6, maxD: 1.2, maxV: 2.0 },
                { classIndex: 3, className: 'H4', maxDV: 1.0, maxD: 2.0, maxV: 2.0 },
                { classIndex: 4, className: 'H5', maxDV: 4.0, maxD: 4.0, maxV: 4.0 }
            ]);
        });
    });

    describe('classifyHazard (Table 2 boundary cases, hand-derived from the published thresholds)', () => {
        it('(0, 0) -> H1 (dry/still, trivially safe)', () => {
            expect(classifyHazard(0, 0)).toEqual({ classIndex: 0, className: 'H1' });
        });
        it('(0.1, 1.0) -> H1 (well inside H1)', () => {
            expect(classifyHazard(0.1, 1.0)).toEqual({ classIndex: 0, className: 'H1' });
        });
        it('(0.3, 1.0) -> H1 exactly on the D=0.3/D*V=0.3 boundary (inclusive <=)', () => {
            expect(classifyHazard(0.3, 1.0)).toEqual({ classIndex: 0, className: 'H1' });
        });
        it('(0.5, 1.0) -> H2 (D*V=0.5 fails H1, D=0.5 exactly on H2 boundary)', () => {
            expect(classifyHazard(0.5, 1.0)).toEqual({ classIndex: 1, className: 'H2' });
        });
        it('(1.2, 0.5) -> H3 (D=1.2 fails H2s D<=0.5, D*V=0.6 exactly on H2/H3 D*V cap)', () => {
            expect(classifyHazard(1.2, 0.5)).toEqual({ classIndex: 2, className: 'H3' });
        });
        it('(2.0, 0.5) -> H4 (D*V=1.0 exactly on the H4 cap, D=2.0 exactly on the H4 D cap)', () => {
            expect(classifyHazard(2.0, 0.5)).toEqual({ classIndex: 3, className: 'H4' });
        });
        it('(4.0, 1.0) -> H5 (D*V=4.0 exactly on the H5 cap, D=4.0 exactly on the H5 D cap)', () => {
            expect(classifyHazard(4.0, 1.0)).toEqual({ classIndex: 4, className: 'H5' });
        });
        it('(5.0, 1.0) -> H6 (D=5.0 exceeds every D cap)', () => {
            expect(classifyHazard(5.0, 1.0)).toEqual({ classIndex: 5, className: 'H6' });
        });
        it('(3.0, 3.0) -> H6 via the D*V product (D*V=9.0) even though D and V individually sit inside H5s D/V caps', () => {
            expect(classifyHazard(3.0, 3.0)).toEqual({ classIndex: 5, className: 'H6' });
        });
        it('negative inputs are clamped to 0 (never negative-depth/-speed a class)', () => {
            expect(classifyHazard(-1, -1)).toEqual({ classIndex: 0, className: 'H1' });
        });
    });

    describe('isNearHazardBoundary (review F8 boundary-tolerance rule)', () => {
        it('true when depth sits exactly on a D threshold', () => {
            expect(isNearHazardBoundary(0.3, 1.0)).toBe(true);
            expect(isNearHazardBoundary(1.2, 0.1)).toBe(true);
        });
        it('true when a value is within eps of a threshold', () => {
            expect(isNearHazardBoundary(0.29995, 1.0, 1e-3)).toBe(true);
        });
        it('true when D*V sits exactly on a D*V threshold even if D/V individually are not near one', () => {
            // D=0.4, V=1.5 -> D*V=0.6 (a D*V threshold), D=0.4 and V=1.5 are
            // not themselves near any D or V threshold.
            expect(isNearHazardBoundary(0.4, 1.5)).toBe(true);
        });
        it('false well inside a class, far from every threshold', () => {
            expect(isNearHazardBoundary(0.1, 0.1, 1e-3)).toBe(false);
        });
    });

    describe('computeStage = elevation + max(0, depth)', () => {
        it('adds elevation and depth', () => {
            expect(computeStage(10, 2)).toBe(12);
        });
        it('clamps a negative/degenerate depth to 0 (still reports ground elevation)', () => {
            expect(computeStage(10, -0.5)).toBe(10);
        });
        it('is unmasked by wetness — dry ground (depth=0) still returns a valid stage', () => {
            expect(computeStage(-3.5, 0)).toBe(-3.5);
        });
    });

    describe('computeDIV = depth * speed (glossary: dIV, the D*V hazard-conveyance product)', () => {
        it('multiplies depth and speed', () => {
            expect(computeDIV(2, 3)).toBe(6);
        });
        it('is 0 when either factor is 0', () => {
            expect(computeDIV(0, 5)).toBe(0);
            expect(computeDIV(5, 0)).toBe(0);
        });
    });

    describe('computeFroude = speed / sqrt(g * depth)', () => {
        it('critical flow (Fr=1) when speed == sqrt(g*depth), g=4/depth=1 -> sqrt(4)=2', () => {
            expect(computeFroude(1, 2, 4)).toBe(1);
        });
        it('supercritical (Fr=2): depth=4, g=4 -> sqrt(16)=4; speed=8 -> Fr=2', () => {
            expect(computeFroude(4, 8, 4)).toBe(2);
        });
        it('subcritical (Fr=0.5): depth=1, g=4 -> sqrt(4)=2; speed=1 -> Fr=0.5', () => {
            expect(computeFroude(1, 1, 4)).toBe(0.5);
        });
        it('returns 0 on a dry/degenerate cell (depth<=0) rather than Infinity/NaN', () => {
            expect(computeFroude(0, 5, 9.8)).toBe(0);
            expect(computeFroude(-1, 5, 9.8)).toBe(0);
        });
    });

    describe('computeShear = rhoW * g * n^2 * speed^2 / depth^(1/3)  (Manning form)', () => {
        it('depth=1 (cube root of 1 is 1): rhoW=1000, g=10, n=0.1, speed=2 -> 1000*10*0.01*4/1 = 400', () => {
            expect(Math.abs(computeShear(1, 2, 0.1, 1000, 10) - 400) < 1e-6).toBe(true);
        });
        it('depth=8 (cube root of 8 is 2): rhoW=1000, g=10, n=0.1, speed=2 -> 400/2 = 200', () => {
            expect(Math.abs(computeShear(8, 2, 0.1, 1000, 10) - 200) < 1e-6).toBe(true);
        });
        it('returns 0 on a dry/degenerate cell (depth<=0), guarding the 1/depth^(1/3) divide-by-zero', () => {
            expect(computeShear(0, 5, 0.05, 1000, 9.8)).toBe(0);
        });
    });

    describe('computeCourant = celerity(=sqrt(g*depth)) * dtSeconds / inradius', () => {
        it('depth=4, g=9 -> celerity=sqrt(36)=6; dt=3, inradius=4 -> 6*3/4 = 4.5', () => {
            expect(Math.abs(computeCourant(4, 3, 4, 9) - 4.5) < 1e-6).toBe(true);
        });
        it('depth=1, g=1 -> celerity=1; dt=2, inradius=1 -> 2', () => {
            expect(Math.abs(computeCourant(1, 2, 1, 1) - 2) < 1e-6).toBe(true);
        });
        it('returns 0 on a dry cell (depth<=0)', () => {
            expect(computeCourant(0, 5, 2, 9.8)).toBe(0);
        });
        it('returns 0 when inradius is non-positive (guards the /inradius divide-by-zero)', () => {
            expect(computeCourant(5, 2, 0, 9.8)).toBe(0);
            expect(computeCourant(5, 2, -1, 9.8)).toBe(0);
        });
        it('returns 0 for a negative dt (never negative-Courant a run)', () => {
            expect(computeCourant(5, -1, 2, 9.8)).toBe(0);
        });
    });

    describe('mixDtSeconds (schema O2: dt_ms[0] is ALWAYS invalid/NaN)', () => {
        it('linearly mixes two valid endpoints and converts ms -> seconds', () => {
            expect(Math.abs(mixDtSeconds([500, 1000], 0, 1, 0.5) - 0.75) < 1e-6).toBe(true);
            expect(Math.abs(mixDtSeconds([500, 1000], 0, 1, 0) - 0.5) < 1e-6).toBe(true);
            expect(Math.abs(mixDtSeconds([500, 1000], 0, 1, 1) - 1.0) < 1e-6).toBe(true);
        });
        it('falls back to the valid endpoint when t0 is the always-invalid NaN sample', () => {
            expect(Math.abs(mixDtSeconds([NaN, 1000, 2000], 0, 1, 0.5) - 1.0) < 1e-6).toBe(true);
        });
        it('falls back to the valid endpoint when t1 is invalid', () => {
            expect(Math.abs(mixDtSeconds([1000, NaN], 0, 1, 0.5) - 1.0) < 1e-6).toBe(true);
        });
        it('returns 0 when both endpoints are invalid', () => {
            expect(mixDtSeconds([NaN, NaN], 0, 1, 0.5)).toBe(0);
        });
        it('returns 0 for an empty/missing array', () => {
            expect(mixDtSeconds([], 0, 1, 0.5)).toBe(0);
            expect(mixDtSeconds(null, 0, 1, 0.5)).toBe(0);
        });
    });

    // TASK-2752 (W8.2, epic 2706) — temporal-max envelope capability mapping.
    describe('envelope capability mapping (TASK-2752)', () => {
        it('ENVELOPE_BACKEND_NAME translates the FE speed id to the backend velocity name', () => {
            // Spread strips Object.freeze: expect@1.20.1's toEqual treats
            // extensibility as part of deep-equality (same trap and same
            // workaround as the AIDR_HAZARD_TABLE test above) — the direct
            // compare passes on local node but fails on CI's.
            expect({ ...ENVELOPE_BACKEND_NAME }).toEqual({ depth: 'depth', speed: 'velocity', div: 'div' });
        });

        it('ENVELOPE_QUANTITY_IDS is exactly the three quantities the *_max.tif set covers', () => {
            // .slice() for the same frozen-ness reason as above.
            expect(ENVELOPE_QUANTITY_IDS.slice()).toEqual(['depth', 'speed', 'div']);
        });

        describe('envelopeArrayName', () => {
            it('maps each envelope-capable FE id to its zarr array name', () => {
                expect(envelopeArrayName('depth')).toBe('depth_max');
                expect(envelopeArrayName('speed')).toBe('velocity_max');
                expect(envelopeArrayName('div')).toBe('div_max');
            });
            it('returns null for a quantity outside the minimum set (stage/hazard/froude/shear/courant)', () => {
                ['stage', 'hazard', 'froude', 'shear', 'courant'].forEach((id) => {
                    expect(envelopeArrayName(id)).toBe(null);
                });
            });
        });

        describe('availableEnvelopeQuantityIds', () => {
            it('translates the manifest\'s declared backend names into FE ids', () => {
                expect(availableEnvelopeQuantityIds(['depth', 'velocity', 'div'])).toEqual(['depth', 'speed', 'div']);
            });
            it('preserves QUANTITY_IDS order (depth before speed before div), regardless of declared order', () => {
                expect(availableEnvelopeQuantityIds(['div', 'depth', 'velocity'])).toEqual(['depth', 'speed', 'div']);
            });
            it('a partial declaration only reports the declared ones', () => {
                expect(availableEnvelopeQuantityIds(['depth'])).toEqual(['depth']);
            });
            it('first-class absence: undefined/null/empty/malformed all resolve to [], never throw', () => {
                expect(availableEnvelopeQuantityIds(undefined)).toEqual([]);
                expect(availableEnvelopeQuantityIds(null)).toEqual([]);
                expect(availableEnvelopeQuantityIds([])).toEqual([]);
                expect(availableEnvelopeQuantityIds('not-an-array')).toEqual([]);
            });
            it('ignores an unrecognised backend name rather than inventing an FE id for it', () => {
                expect(availableEnvelopeQuantityIds(['depth', 'bogus'])).toEqual(['depth']);
            });

            // TASK-2814 — availability == FETCHABILITY. The fetch path needs
            // quantization['{backend}_max']; a quantity declared but missing
            // that block used to be offered and then degrade to the
            // silent-dry zero-filled envelope.
            describe('quantization gating (TASK-2814)', () => {
                it('a declared quantity with a quantization block stays available', () => {
                    expect(availableEnvelopeQuantityIds(
                        ['depth', 'velocity'],
                        { depth_max: { scale: 0.001 }, velocity_max: { scale: 0.002 } }
                    )).toEqual(['depth', 'speed']);
                });
                it('a declared quantity MISSING its quantization block is not offered', () => {
                    expect(availableEnvelopeQuantityIds(
                        ['depth', 'velocity'],
                        { depth_max: { scale: 0.001 } }
                    )).toEqual(['depth']);
                });
                it('an empty quantization object offers nothing, however much is declared', () => {
                    expect(availableEnvelopeQuantityIds(['depth', 'velocity', 'div'], {})).toEqual([]);
                });
                it('omitting the quantization argument keeps the declaration-only behaviour (legacy callers)', () => {
                    expect(availableEnvelopeQuantityIds(['depth', 'velocity'])).toEqual(['depth', 'speed']);
                });
            });
        });
    });
});
