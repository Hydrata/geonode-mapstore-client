/*
 * TASK-2038 (F5) — a new scenario's default resolution must match the BE
 * model default (apps/gn_anuga/models/scenario.py: `resolution = FloatField(
 * default=100)`). The FE previously stamped 1000, silently landing on
 * max_triangle_area = resolution^2 / 2 ≈ 1 triangle for a small domain
 * (dogfood 2026-07-01, F5).
 */
import expect from 'expect';
import scenariosReducer from '../scenariosReducer';
import {ADD_ANUGA_SCENARIO} from '../../actions/scenarioActions';
import {
    BUILD_SCENARIO,
    BUILD_SCENARIO_SUCCESS,
    BUILD_SCENARIO_ERROR
} from '../../actions/comparisonActions';

describe('TASK-2038 scenariosReducer ADD_ANUGA_SCENARIO default resolution', () => {
    it('stamps the new temp scenario with resolution 100 (matches the BE default)', () => {
        const state = scenariosReducer(undefined, {type: ADD_ANUGA_SCENARIO});
        const tempId = state.allIds[0];
        expect(state.byId[tempId].resolution).toBe(100);
    });
});

// TASK-2079 — build-dedup: BUILD_SCENARIO_ERROR previously had NO reducer
// (action-only). A benign 409 (conflict: true) now stashes `buildConflict`
// on the scenario so scenarioHeaderActions.js can render it inline near the
// Build button instead of the 'Build failed' toast.
describe('TASK-2079 scenariosReducer BUILD_SCENARIO_ERROR / buildConflict', () => {
    const baseState = () => ({
        byId: {
            7: {id: 7, name: 'Scenario 7'}
        },
        allIds: [7],
        selectedId: 7,
        archiveFilter: 'none'
    });

    it('stashes buildConflict on the scenario for a conflict (409) error', () => {
        const state = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: true,
            runId: 99,
            runStatus: 'building',
            detail: 'A build is already in progress for this scenario.'
        });
        expect(state.byId[7].buildConflict).toEqual({
            runId: 99,
            status: 'building',
            detail: 'A build is already in progress for this scenario.'
        });
    });

    it('does NOT stash buildConflict for a real (non-conflict) build error', () => {
        const state = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: false,
            error: new Error('boom')
        });
        expect(state.byId[7].buildConflict).toBe(null);
    });

    it('clears a stale buildConflict when a real error follows a conflict', () => {
        const conflicted = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: true,
            runId: 99,
            runStatus: 'building',
            detail: 'in flight'
        });
        const state = scenariosReducer(conflicted, {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: false
        });
        expect(state.byId[7].buildConflict).toBe(null);
    });

    it('BUILD_SCENARIO_SUCCESS clears a stale buildConflict', () => {
        const conflicted = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: true,
            runId: 99,
            runStatus: 'building',
            detail: 'in flight'
        });
        const state = scenariosReducer(conflicted, {
            type: BUILD_SCENARIO_SUCCESS,
            scenarioId: 7
        });
        expect(state.byId[7].buildConflict).toBe(null);
    });

    it('a fresh BUILD_SCENARIO dispatch optimistically clears a stale buildConflict', () => {
        const conflicted = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 7,
            conflict: true,
            runId: 99,
            runStatus: 'building',
            detail: 'in flight'
        });
        const state = scenariosReducer(conflicted, {
            type: BUILD_SCENARIO,
            scenarioId: 7
        });
        expect(state.byId[7].buildConflict).toBe(null);
    });

    it('is a no-op for an unknown scenarioId', () => {
        const state = scenariosReducer(baseState(), {
            type: BUILD_SCENARIO_ERROR,
            scenarioId: 999,
            conflict: true,
            runId: 1,
            runStatus: 'building',
            detail: 'in flight'
        });
        expect(state).toEqual(baseState());
    });
});
