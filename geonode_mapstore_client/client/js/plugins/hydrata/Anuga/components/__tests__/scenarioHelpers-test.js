/*
 * TASK-868 — validateScenario returns null when valid, or the name of the
 * first missing field as a string. Field order must match the scenario
 * helpers implementation so the returned name is deterministic.
 *
 * Fields checked, in order:
 *   scenario (non-null object) → 'scenario'
 *   name (length > 0)          → 'name'
 *   terrain                    → 'terrain'
 *   inflow OR rainfall         → 'inflowOrRainfall'
 *   resolution (> 0)           → 'resolution'
 *   duration (> 0)             → 'duration'
 *   boundary                   → 'boundary'
 *
 * Scenarios Option A redesign — Inflow and Rainfall are mutually
 * substitutable water sources; the validator requires at least one of
 * the two. Callers surface "inflowOrRainfall" via a dedicated message
 * string. The category-rail tag counts them as a single slot too (3/3,
 * not 4/4) so the build-validation and rail UIs agree.
 */
import expect from 'expect';
import { validateScenario, validateCategoryProgress, toHHMM, getSecondsFromHHMM } from '../scenarioHelpers';

function makeValidScenario(overrides) {
    return {
        name: 'scenario_1',
        terrain: 1,
        inflow: 2,
        resolution: 5,
        duration: 3600,
        boundary: 3,
        ...overrides
    };
}

describe('TASK-868 validateScenario', () => {
    it('returns null when every required field is populated', () => {
        expect(validateScenario(makeValidScenario())).toBe(null);
    });

    it('returns "scenario" when the scenario is null', () => {
        expect(validateScenario(null)).toBe('scenario');
    });

    it('returns "scenario" when given a non-object', () => {
        expect(validateScenario('not an object')).toBe('scenario');
    });

    it('returns "name" when name is empty string', () => {
        expect(validateScenario(makeValidScenario({name: ''}))).toBe('name');
    });

    it('returns "name" when name is missing', () => {
        const s = makeValidScenario();
        delete s.name;
        expect(validateScenario(s)).toBe('name');
    });

    it('returns "terrain" when terrain is missing', () => {
        expect(validateScenario(makeValidScenario({terrain: null}))).toBe('terrain');
    });

    it('returns "inflowOrRainfall" when both inflow and rainfall are missing', () => {
        // Inflow + Rainfall share one validator slot — neither set fires
        // the combined-name error.
        const s = makeValidScenario({inflow: null});
        delete s.rainfall;
        expect(validateScenario(s)).toBe('inflowOrRainfall');
    });

    it('returns null when only rainfall is set (no inflow)', () => {
        // Rainfall substitutes for Inflow — the validator must accept a
        // rainfall-only scenario as fully valid.
        const s = makeValidScenario({inflow: null, rainfall: 9});
        expect(validateScenario(s)).toBe(null);
    });

    it('returns null when only inflow is set (no rainfall)', () => {
        // Preserves prior pre-redesign behaviour where inflow alone was
        // enough to satisfy the water-source slot.
        const s = makeValidScenario({rainfall: null});
        expect(validateScenario(s)).toBe(null);
    });

    it('returns "inflowOrRainfall" when both fields are absent (not null) on the scenario', () => {
        const s = makeValidScenario();
        delete s.inflow;
        delete s.rainfall;
        expect(validateScenario(s)).toBe('inflowOrRainfall');
    });

    it('returns "resolution" when resolution is 0', () => {
        expect(validateScenario(makeValidScenario({resolution: 0}))).toBe('resolution');
    });

    it('returns "duration" when duration is 0', () => {
        expect(validateScenario(makeValidScenario({duration: 0}))).toBe('duration');
    });

    it('returns "boundary" when boundary is missing', () => {
        expect(validateScenario(makeValidScenario({boundary: null}))).toBe('boundary');
    });

    it('returns the first missing field in declared order (terrain before boundary)', () => {
        // Both terrain and boundary missing, terrain is checked first.
        expect(validateScenario(makeValidScenario({terrain: null, boundary: null}))).toBe('terrain');
    });
});

describe('K5 toHHMM', () => {
    it('returns 00:00 for zero seconds', () => {
        expect(toHHMM(0)).toBe('00:00');
    });

    it('returns 00:01 for 90 seconds (rounds down to whole minute)', () => {
        expect(toHHMM(90)).toBe('00:01');
    });

    it('returns 01:00 for exactly 3600 seconds', () => {
        expect(toHHMM(3600)).toBe('01:00');
    });

    it('returns 01:01 for 3690 seconds', () => {
        expect(toHHMM(3690)).toBe('01:01');
    });

    it('returns 24:00 for 86400 seconds (allows hours > 23)', () => {
        expect(toHHMM(86400)).toBe('24:00');
    });

    it('returns 00:00 for negative input', () => {
        expect(toHHMM(-1)).toBe('00:00');
    });

    it('returns 00:00 for null', () => {
        expect(toHHMM(null)).toBe('00:00');
    });

    it('returns 00:00 for undefined', () => {
        expect(toHHMM(undefined)).toBe('00:00');
    });

    it('returns 00:00 for NaN', () => {
        expect(toHHMM(NaN)).toBe('00:00');
    });

    it('round-trips with getSecondsFromHHMM for 3690', () => {
        // 3690 seconds rounds to 61 minutes ("01:01"), which round-trips to 3660.
        // The HH:MM display drops sub-minute precision by design.
        expect(getSecondsFromHHMM(toHHMM(3690))).toBe(3660);
    });

    it('round-trips exactly with getSecondsFromHHMM for whole-minute inputs', () => {
        expect(getSecondsFromHHMM(toHHMM(3600))).toBe(3600);
        expect(getSecondsFromHHMM(toHHMM(60))).toBe(60);
    });
});

describe('TASK-C Wave 3A validateCategoryProgress', () => {
    describe('inputs category', () => {
        // Scenarios Option A — 3 slots: terrain, boundary, water-source
        // (inflow OR rainfall, mutually substitutable). 3/3 is the
        // complete state, not 4/4.

        it('returns 3/3 + ok when terrain + boundary + (inflow OR rainfall) assigned', () => {
            const s = {terrain: 1, boundary: 2, inflow: 3, rainfall: 4};
            const result = validateCategoryProgress('inputs', s);
            expect(result.satisfied).toBe(3);
            expect(result.total).toBe(3);
            expect(result.tag).toBe('3/3');
            expect(result.severity).toBe('ok');
        });

        it('returns 2/3 + warn when 2 of 3 slots are filled (terrain + inflow, no boundary)', () => {
            const s = {terrain: 1, inflow: 3};
            const result = validateCategoryProgress('inputs', s);
            expect(result.satisfied).toBe(2);
            expect(result.total).toBe(3);
            expect(result.tag).toBe('2/3');
            expect(result.severity).toBe('warn');
        });

        it('returns 0/3 + err when none assigned', () => {
            const s = {name: 'empty'};
            const result = validateCategoryProgress('inputs', s);
            expect(result.tag).toBe('0/3');
            expect(result.severity).toBe('err');
        });

        it('counts rainfall-only as 1/3 + warn (no terrain, no boundary, no inflow)', () => {
            const s = {terrain: null, boundary: null, rainfall: 4};
            const result = validateCategoryProgress('inputs', s);
            expect(result.satisfied).toBe(1);
            expect(result.total).toBe(3);
            expect(result.tag).toBe('1/3');
            expect(result.severity).toBe('warn');
        });

        it('counts inflow-only as 1/3 + warn (preserves prior inflow-slot semantics)', () => {
            const s = {terrain: null, boundary: null, inflow: 4};
            const result = validateCategoryProgress('inputs', s);
            expect(result.satisfied).toBe(1);
            expect(result.total).toBe(3);
            expect(result.tag).toBe('1/3');
            expect(result.severity).toBe('warn');
        });

        it('counts both inflow AND rainfall as a single shared slot (3/3 not 4/3)', () => {
            // The water-source slot is satisfied once — having both does
            // not promote the count past total.
            const s = {terrain: 1, boundary: 2, inflow: 3, rainfall: 4};
            const result = validateCategoryProgress('inputs', s);
            expect(result.satisfied).toBe(3);
            expect(result.total).toBe(3);
            expect(result.tag).toBe('3/3');
        });
    });

    describe('advanced category', () => {
        it('returns N/4 + ok even when nothing is assigned (advanced is optional)', () => {
            const s = {name: 'empty'};
            const result = validateCategoryProgress('advanced', s);
            expect(result.tag).toBe('0/4');
            expect(result.severity).toBe('ok');
        });

        it('returns 3/4 + ok when 3 advanced fields are assigned', () => {
            const s = {friction: 1, structure: 2, mesh_region: 3};
            const result = validateCategoryProgress('advanced', s);
            expect(result.tag).toBe('3/4');
            expect(result.severity).toBe('ok');
        });
    });

    describe('runConfig category', () => {
        it('returns OK + ok when both resolution and duration are positive', () => {
            const s = {resolution: 1000, duration: 3600};
            const result = validateCategoryProgress('runConfig', s);
            expect(result.tag).toBe('OK');
            expect(result.severity).toBe('ok');
        });

        it('returns 1/2 + warn when only resolution is set', () => {
            const s = {resolution: 1000};
            const result = validateCategoryProgress('runConfig', s);
            expect(result.tag).toBe('1/2');
            expect(result.severity).toBe('warn');
        });

        it('returns 0/2 + err when neither is set', () => {
            const s = {name: 'empty'};
            const result = validateCategoryProgress('runConfig', s);
            expect(result.tag).toBe('0/2');
            expect(result.severity).toBe('err');
        });
    });

    describe('statusActions category', () => {
        it('returns rounded pct + ok when computing', () => {
            const s = {status: 'computing', latest_run: {progress_pct: 47.3}};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('47%');
            expect(result.severity).toBe('ok');
        });

        it('returns err + err when status is error', () => {
            const s = {status: 'error'};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('err');
            expect(result.severity).toBe('err');
        });

        it('returns 100% + ok when status is complete', () => {
            const s = {status: 'complete'};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('100%');
            expect(result.severity).toBe('ok');
        });

        it('returns built + ok when status is built', () => {
            const s = {status: 'built'};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('built');
            expect(result.severity).toBe('ok');
        });

        it('returns dash + warn when status is created', () => {
            const s = {status: 'created'};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('—');
            expect(result.severity).toBe('warn');
        });

        it('returns dash + warn when status is cancelled', () => {
            const s = {status: 'cancelled'};
            const result = validateCategoryProgress('statusActions', s);
            expect(result.tag).toBe('—');
            expect(result.severity).toBe('warn');
        });
    });

    describe('runLog category', () => {
        it('returns line count + ok when latest_run.log_line_count > 0', () => {
            const s = {latest_run: {log_line_count: 231}};
            const result = validateCategoryProgress('runLog', s);
            expect(result.tag).toBe('231');
            expect(result.severity).toBe('ok');
        });

        it('returns dash + warn when no log lines yet', () => {
            const s = {latest_run: {}};
            const result = validateCategoryProgress('runLog', s);
            expect(result.tag).toBe('—');
            expect(result.severity).toBe('warn');
        });
    });

    describe('defensive defaults', () => {
        it('returns a neutral fallback when scenario is null', () => {
            const result = validateCategoryProgress('inputs', null);
            expect(result.tag).toBe('—');
            expect(result.severity).toBe('warn');
        });

        it('returns a neutral fallback for an unknown category', () => {
            const result = validateCategoryProgress('unknownCategory', {});
            expect(result.tag).toBe('—');
            expect(result.severity).toBe('warn');
        });
    });

    describe('Wave 3C C4 — unsaved flag propagation', () => {
        // Coarse signal: scenario.unsaved===true should propagate to every
        // category's `unsaved` flag identically. Per-category diffing would
        // require a backend snapshot cache — out of scope.
        const allCategories = ['inputs', 'advanced', 'runConfig', 'statusActions', 'runLog'];

        it('returns unsaved=false when scenario has no unsaved flag', () => {
            const s = {terrain: 1, boundary: 2, inflow: 3};
            allCategories.forEach((cat) => {
                const result = validateCategoryProgress(cat, s);
                expect(result.unsaved).toBe(false);
            });
        });

        it('returns unsaved=true on every category when scenario.unsaved is true', () => {
            const s = {terrain: 1, boundary: 2, inflow: 3, unsaved: true};
            allCategories.forEach((cat) => {
                const result = validateCategoryProgress(cat, s);
                expect(result.unsaved).toBe(true);
            });
        });

        it('coerces truthy non-boolean unsaved to true', () => {
            const s = {unsaved: 'pending'};
            const result = validateCategoryProgress('inputs', s);
            expect(result.unsaved).toBe(true);
        });

        it('returns unsaved=false in the null-scenario neutral fallback', () => {
            const result = validateCategoryProgress('inputs', null);
            expect(result.unsaved).toBe(false);
        });

        it('returns unsaved=true in the unknown-category fallback when scenario.unsaved is true', () => {
            // Unknown category still propagates the scenario-level unsaved
            // flag so a future-added category gets the coarse dot signal
            // for free. The 5 known categories are exercised above.
            const result = validateCategoryProgress('unknownCategory', {unsaved: true});
            expect(result.unsaved).toBe(true);
        });

        it('returns unsaved=false in the unknown-category fallback when scenario.unsaved is false', () => {
            const result = validateCategoryProgress('unknownCategory', {});
            expect(result.unsaved).toBe(false);
        });
    });
});
