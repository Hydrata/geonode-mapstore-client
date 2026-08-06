/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2629 (W4.1, epic 2618) — the load-bearing PARITY suite: this compares
 * playbackDerivedQuantities.js's formulas against an INDEPENDENT Python
 * implementation (docs/reports/task-2618-w4-derived-quantity-fixtures/
 * derived_quantity_reference.py, deploy worktree) run against the SAME real
 * on-disk store bytes the browser loads — not a re-derivation from the SWW,
 * and not two copies of the same bug. Mirrors the W3 identify-fixture
 * precedent (playbackIdentify-test.js's "REAL exporter-generated fixture
 * mesh" describe block), extended with the wave brief's explicit rules:
 *
 *   - velocity-family parity (div/froude/shear/courant/hazard) ONLY on cells
 *     h>h_min (fixture point `wet`) — a dry cell's speed is a cosmetic,
 *     store-convention-dependent zero on the JS side (see
 *     playbackDerivedQuantities.js's own header), not a formula divergence.
 *   - stage has no speed dependency, so it is compared on EVERY point
 *     (wet and dry) — matches computeStage's own "unmasked by wetness"
 *     contract.
 *   - hazard classification: className must match OR the fixture's own
 *     `nearHazardBoundary` flag is true (review F8 boundary-tolerance rule —
 *     see isNearHazardBoundary's header).
 *   - AIDR curve constants: asserted equal, in one place, against the
 *     Python reference's OWN --dump-aidr-table output — so the two tables
 *     cannot silently drift (playbackShaders-test.js separately asserts the
 *     JS<->GLSL half of the same "cannot drift" requirement).
 *   - Courant: the real-store fixture (has_dt=false) proves the GRACEFUL
 *     OMISSION path (every courant value is 0, and the picker/reducer tests
 *     elsewhere prove the menu omits it entirely); the synthesized
 *     dt-bearing fixture proves the PRESENCE path (real nonzero values) —
 *     both stores on this box have has_dt=false, so the presence path is
 *     fixture-only per the wave brief ("the omission path is
 *     live-testable, the presence path is fixture-testable").
 */
import expect from 'expect';
import {
    AIDR_HAZARD_TABLE,
    computeStage,
    computeDIV,
    computeFroude,
    computeShear,
    computeCourant,
    classifyHazard
} from '../playbackDerivedQuantities';
import {
    DERIVED_QUANTITY_FIXTURE,
    DERIVED_QUANTITY_FIXTURE_DT,
    AIDR_HAZARD_TABLE_PYTHON
} from './fixtures/fixtureDerivedQuantities';

// Quantization step for depth/speed on the real store is on the order of
// 1e-4-1e-5 physical units (schema §3); the nonlinear formulas below (cube
// root, sqrt, squares) amplify that slightly, so a loose-but-meaningful
// absolute tolerance catches a REAL formula divergence (which would be
// orders of magnitude larger) without false-failing on quantization noise.
const EPS = 1e-3;
function closeTo(actual, expected, eps = EPS) {
    return Math.abs(actual - expected) < eps;
}

describe('playbackDerivedQuantities PARITY (Python reference, real store bytes)', () => {
    describe('AIDR_HAZARD_TABLE: JS <-> Python (the half GLSL cannot cover)', () => {
        it('the JS table equals the Python reference\'s own --dump-aidr-table output, field-for-field, in order', () => {
            // Shallow-copy: this repo's expect@1.20.1 toEqual treats object
            // EXTENSIBILITY as part of deep-equality (is-equal's integrity-
            // level check), so comparing the source's Object.freeze()'d rows
            // directly fails on frozen-ness alone — see
            // playbackDerivedQuantities-test.js's own note on this.
            expect(AIDR_HAZARD_TABLE.map((row) => ({ ...row }))).toEqual(AIDR_HAZARD_TABLE_PYTHON);
        });
    });

    describe('real Merewether store (has_dt=false — the graceful-omission fixture)', () => {
        it('fixture metadata sanity: g/rhoW/wetThreshold match the real store attrs (Phase 0.5 proof)', () => {
            expect(DERIVED_QUANTITY_FIXTURE.g).toBe(9.8);
            expect(DERIVED_QUANTITY_FIXTURE.rhoW).toBe(1023);
            expect(DERIVED_QUANTITY_FIXTURE.wetThreshold).toBe(0.005);
            expect(DERIVED_QUANTITY_FIXTURE.hasDt).toBe(false);
            expect(DERIVED_QUANTITY_FIXTURE.results.length).toBeGreaterThan(0);
        });

        it('has both wet and dry sample points (both branches of every formula\'s guard get exercised)', () => {
            const wet = DERIVED_QUANTITY_FIXTURE.results.filter((r) => r.wet);
            const dry = DERIVED_QUANTITY_FIXTURE.results.filter((r) => !r.wet);
            expect(wet.length).toBeGreaterThan(0);
            expect(dry.length).toBeGreaterThan(0);
        });

        it('stage = elevation + depth matches on EVERY point (wet and dry — unmasked by wetness)', () => {
            DERIVED_QUANTITY_FIXTURE.results.forEach((r) => {
                const got = computeStage(r.elevation, r.depth);
                expect(closeTo(got, r.stage)).toBe(true);
            });
        });

        it('div/froude/shear/hazard match on WET cells only (AC: velocity-family parity is h>h_min-only)', () => {
            const { g, rhoW } = DERIVED_QUANTITY_FIXTURE;
            const wetPoints = DERIVED_QUANTITY_FIXTURE.results.filter((r) => r.wet);
            wetPoints.forEach((r) => {
                expect(closeTo(computeDIV(r.depth, r.speed), r.div)).toBe(true);
                expect(closeTo(computeFroude(r.depth, r.speed, g), r.froude)).toBe(true);
                expect(closeTo(computeShear(r.depth, r.speed, r.friction, rhoW, g), r.shear)).toBe(true);

                const hazard = classifyHazard(r.depth, r.speed);
                const classMatches = hazard.className === r.hazardClassName;
                // Boundary-tolerance rule (review F8): a class mismatch is
                // tolerated ONLY when the fixture's own Python-computed flag
                // says this point sits within eps of a curve boundary.
                expect(classMatches || r.nearHazardBoundary).toBe(true);
            });
        });

        it('courant is 0 for every point (has_dt=false — the graceful-omission contract, proven numerically)', () => {
            DERIVED_QUANTITY_FIXTURE.results.forEach((r) => {
                expect(r.courant).toBe(0);
            });
        });
    });

    describe('synthesized dt-bearing store (has_dt=true — the Courant-PRESENT fixture)', () => {
        it('fixture metadata sanity: hasDt=true with a real positive dtSeconds', () => {
            expect(DERIVED_QUANTITY_FIXTURE_DT.hasDt).toBe(true);
            expect(DERIVED_QUANTITY_FIXTURE_DT.dtSeconds).toBeGreaterThan(0);
        });

        it('courant matches computeCourant on wet cells, and is genuinely NONZERO for most of them (proves the presence path end to end, not just "still zero")', () => {
            const { g, dtSeconds } = DERIVED_QUANTITY_FIXTURE_DT;
            const wetPoints = DERIVED_QUANTITY_FIXTURE_DT.results.filter((r) => r.wet);
            let nonzeroCount = 0;
            wetPoints.forEach((r) => {
                const got = computeCourant(r.depth, dtSeconds, r.inradius, g);
                expect(closeTo(got, r.courant)).toBe(true);
                if (r.courant > 0) {
                    nonzeroCount += 1;
                }
            });
            expect(nonzeroCount).toBeGreaterThan(0);
        });

        it('every OTHER formula (stage/div/froude/shear/hazard) is UNCHANGED by has_dt — courant is the only dt-gated quantity', () => {
            // Both fixtures were captured from the SAME underlying store
            // (only dt_ms/has_dt were patched), so index-for-index the
            // non-courant fields must be identical between the two fixtures.
            DERIVED_QUANTITY_FIXTURE.results.forEach((real, i) => {
                const dt = DERIVED_QUANTITY_FIXTURE_DT.results[i];
                expect(dt.vertex).toBe(real.vertex);
                expect(closeTo(dt.stage, real.stage)).toBe(true);
                expect(closeTo(dt.div, real.div)).toBe(true);
                expect(closeTo(dt.froude, real.froude)).toBe(true);
                expect(closeTo(dt.shear, real.shear)).toBe(true);
                expect(dt.hazardClassName).toBe(real.hazardClassName);
            });
        });
    });
});
