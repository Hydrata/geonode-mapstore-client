/*
 * TASK-868 — validateScenario returns null when valid, or the name of the
 * first missing field as a string. Field order must match the scenario
 * helpers implementation so the returned name is deterministic.
 *
 * Fields checked, in order:
 *   scenario (non-null object) → 'scenario'
 *   name (length > 0)          → 'name'
 *   terrain                    → 'terrain'
 *   inflow                     → 'inflow'
 *   resolution (> 0)           → 'resolution'
 *   duration (> 0)             → 'duration'
 *   boundary                   → 'boundary'
 */
import expect from 'expect';
import { validateScenario } from '../scenarioHelpers';

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

    it('returns "inflow" when inflow is missing', () => {
        expect(validateScenario(makeValidScenario({inflow: null}))).toBe('inflow');
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
        // Both terrain and boundary missing — terrain is checked first.
        expect(validateScenario(makeValidScenario({terrain: null, boundary: null}))).toBe('terrain');
    });
});
