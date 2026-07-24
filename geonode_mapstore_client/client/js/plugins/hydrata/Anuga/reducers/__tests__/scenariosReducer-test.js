/*
 * TASK-2038 (F5) — a new scenario's default resolution must match the BE
 * model default (apps/gn_anuga/models/scenario.py: `resolution = FloatField(
 * default=100)`). The FE previously stamped 1000, silently landing on
 * max_triangle_area = resolution^2 / 2 ≈ 1 triangle for a small domain
 * (dogfood 2026-07-01, F5).
 */
import expect from 'expect';
import scenariosReducer from '../scenariosReducer';
import {
    ADD_ANUGA_SCENARIO,
    ARCHIVE_ANUGA_SCENARIO,
    ARCHIVE_ANUGA_SCENARIO_ERROR,
    ARCHIVE_ANUGA_SCENARIO_SUCCESS,
    archiveAnugaScenarioError
} from '../../actions/scenarioActions';
import {
    BUILD_SCENARIO,
    BUILD_SCENARIO_SUCCESS,
    BUILD_SCENARIO_ERROR
} from '../../actions/comparisonActions';
import {SET_ANUGA_POLLING_DATA} from '../../actions/dataActions';

describe('TASK-2038 scenariosReducer ADD_ANUGA_SCENARIO default resolution', () => {
    it('stamps the new temp scenario with resolution 100 (matches the BE default)', () => {
        const state = scenariosReducer(undefined, {type: ADD_ANUGA_SCENARIO});
        const tempId = state.allIds[0];
        expect(state.byId[tempId].resolution).toBe(100);
    });
});

// TASK-2078 — the 8s poll (SET_ANUGA_POLLING_DATA) merge must refresh
// latest_complete_run on an already-loaded scenario, else every store-state
// D1 result consumer (View Results gate, freshness banner, cross-section
// profile, download) reads a value frozen at init and goes stale until reload.
describe('TASK-2078 scenariosReducer SET_ANUGA_POLLING_DATA merges latest_complete_run', () => {
    const baseState = () => ({
        byId: {3: {id: 3, name: 'S3', selected: true, latest_run: {id: 5}, latest_complete_run: null}},
        allIds: [3],
        selectedId: 3,
        archiveFilter: 'none'
    });
    it('refreshes latest_complete_run on an already-loaded scenario from a poll tick', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 3, latest_run: {id: 6, status: 'building'}, latest_complete_run: {id: 5, status: 'complete'}, status: 'building'}]
        });
        expect(state.byId[3].latest_complete_run).toEqual({id: 5, status: 'complete'});
        expect(state.byId[3].latest_run).toEqual({id: 6, status: 'building'});
    });
    it('clears latest_complete_run to null when the backend reports none (mirrors latest_run)', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 3, latest_run: {id: 6}, status: 'building'}]
        });
        expect(state.byId[3].latest_complete_run).toBe(null);
    });
});

// TASK-2400 (dogfood F1/#1) — mirrors the TASK-2078 fix immediately above:
// the 8s poll must ALSO refresh the pre-build estimate fields
// (mesh_triangle_count_estimate / _breakdown, compute_cost_estimate,
// vcpu_hours_estimate) on an already-loaded scenario. Before this fix the
// merge whitelist dropped them entirely, so a server-side recompute never
// reached the estimate line (scenarioPane.js) or the Build tooltip echo
// (scenarioHeaderActions.js) until a full page reload or the next
// SAVE_ANUGA_SCENARIO_SUCCESS (a full-object replace).
describe('TASK-2400 scenariosReducer SET_ANUGA_POLLING_DATA merges estimate fields', () => {
    const baseState = () => ({
        byId: {3: {
            id: 3,
            name: 'S3',
            selected: true,
            latest_run: {id: 5},
            mesh_triangle_count_estimate: 1000,
            mesh_triangle_count_estimate_breakdown: {mesh_region: 0.5},
            compute_cost_estimate: 1.23,
            vcpu_hours_estimate: 7.28
        }},
        allIds: [3],
        selectedId: 3,
        archiveFilter: 'none'
    });
    it('refreshes all four estimate fields on an already-loaded scenario from a poll tick', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{
                id: 3,
                latest_run: {id: 5},
                status: 'created',
                mesh_triangle_count_estimate: 2500,
                mesh_triangle_count_estimate_breakdown: {mesh_region: 0.9},
                compute_cost_estimate: 2.58,
                vcpu_hours_estimate: 15.25
            }]
        });
        expect(state.byId[3].mesh_triangle_count_estimate).toBe(2500);
        expect(state.byId[3].mesh_triangle_count_estimate_breakdown).toEqual({mesh_region: 0.9});
        expect(state.byId[3].compute_cost_estimate).toBe(2.58);
        expect(state.byId[3].vcpu_hours_estimate).toBe(15.25);
    });
    it('refreshes a free-band ($0) compute_cost_estimate rather than keeping the stale non-zero value', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 3, latest_run: {id: 5}, status: 'created', compute_cost_estimate: 0}]
        });
        // ?? preserves a real 0 (only null/undefined fall back) — the stale
        // 1.23 must NOT survive.
        expect(state.byId[3].compute_cost_estimate).toBe(0);
    });
    it('clears estimate fields to null when the backend reports none (mirrors latest_run/_complete_run)', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 3, latest_run: {id: 5}, status: 'created'}]
        });
        expect(state.byId[3].mesh_triangle_count_estimate).toBe(null);
        expect(state.byId[3].mesh_triangle_count_estimate_breakdown).toBe(null);
        expect(state.byId[3].compute_cost_estimate).toBe(null);
        expect(state.byId[3].vcpu_hours_estimate).toBe(null);
    });
});

// TASK-2421 (UAT-1 findings 2+3) — the staleness flag (`unsaved`) must clear
// once a poll tick delivers a GENUINELY refreshed estimate (evidence the
// backend has recomputed off the edit that set it), but must NOT clear on a
// tick that brings the SAME (stale) estimate back — the edit genuinely
// hasn't been reflected yet.
describe('TASK-2421 scenariosReducer SET_ANUGA_POLLING_DATA clears unsaved on fresh estimate', () => {
    const baseState = () => ({
        byId: {9: {
            id: 9,
            name: 'S9',
            selected: true,
            unsaved: true,
            latest_run: {id: 20},
            mesh_triangle_count_estimate: 1000,
            compute_cost_estimate: 0.05
        }},
        allIds: [9],
        selectedId: 9,
        archiveFilter: 'none'
    });
    it('clears unsaved when the poll brings a DIFFERENT triangle estimate', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 9, latest_run: {id: 20}, status: 'created', mesh_triangle_count_estimate: 49457, compute_cost_estimate: 0.17}]
        });
        expect(state.byId[9].unsaved).toBe(false);
        expect(state.byId[9].mesh_triangle_count_estimate).toBe(49457);
    });
    it('clears unsaved when only the cost estimate changed (triangle count identical)', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 9, latest_run: {id: 20}, status: 'created', mesh_triangle_count_estimate: 1000, compute_cost_estimate: 0.09}]
        });
        expect(state.byId[9].unsaved).toBe(false);
    });
    it('leaves unsaved TRUE when the poll brings back the SAME stale estimate (edit not yet reflected)', () => {
        const state = scenariosReducer(baseState(), {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 9, latest_run: {id: 20}, status: 'created', mesh_triangle_count_estimate: 1000, compute_cost_estimate: 0.05}]
        });
        expect(state.byId[9].unsaved).toBe(true);
    });
    it('leaves an already-saved (unsaved:false) scenario untouched regardless of estimate movement', () => {
        const saved = {...baseState(), byId: {9: {...baseState().byId[9], unsaved: false}}};
        const state = scenariosReducer(saved, {
            type: SET_ANUGA_POLLING_DATA,
            scenarios: [{id: 9, latest_run: {id: 20}, status: 'created', mesh_triangle_count_estimate: 2000, compute_cost_estimate: 0.20}]
        });
        expect(state.byId[9].unsaved).toBe(false);
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

// TASK-2264 — a failed archive (412: scenario has an active/queued run)
// stashes the BE detail as `archiveError` on the scenario so the pane's
// notices surface can anchor it inline, not just in the easy-to-miss toast.
describe('TASK-2264 scenariosReducer ARCHIVE_ANUGA_SCENARIO_ERROR / archiveError', () => {
    const baseState = () => ({
        byId: {7: {id: 7, name: 'Scenario 7'}},
        allIds: [7],
        selectedId: 7,
        archiveFilter: 'none'
    });

    it('stashes the BE detail as archiveError on the scenario', () => {
        const state = scenariosReducer(baseState(), {
            type: ARCHIVE_ANUGA_SCENARIO_ERROR,
            scenarioId: 7,
            detail: 'Cannot archive: scenario has an active run.'
        });
        expect(state.byId[7].archiveError).toBe('Cannot archive: scenario has an active run.');
    });

    it('the archiveAnugaScenarioError action creator carries the BE detail string', () => {
        const action = archiveAnugaScenarioError(7, {detail: 'active run'});
        expect(action.type).toBe(ARCHIVE_ANUGA_SCENARIO_ERROR);
        expect(action.scenarioId).toBe(7);
        expect(action.detail).toBe('active run');
    });

    it('falls back to a default detail when the BE body has none', () => {
        const action = archiveAnugaScenarioError(7, undefined);
        expect(action.detail).toBe('Could not archive scenario.');
    });

    it('a fresh ARCHIVE_ANUGA_SCENARIO optimistically clears a stale archiveError', () => {
        const errored = scenariosReducer(baseState(), {
            type: ARCHIVE_ANUGA_SCENARIO_ERROR, scenarioId: 7, detail: 'active run'
        });
        const state = scenariosReducer(errored, {
            type: ARCHIVE_ANUGA_SCENARIO, scenario: {id: 7}
        });
        expect(state.byId[7].archiveError).toBe(null);
    });

    it('ARCHIVE_ANUGA_SCENARIO_SUCCESS clears a stale archiveError', () => {
        const errored = scenariosReducer(baseState(), {
            type: ARCHIVE_ANUGA_SCENARIO_ERROR, scenarioId: 7, detail: 'active run'
        });
        const state = scenariosReducer(errored, {
            type: ARCHIVE_ANUGA_SCENARIO_SUCCESS,
            scenario: {id: 7, archived_at: '2026-07-14T00:00:00Z'}
        });
        expect(state.byId[7].archiveError).toBe(null);
        expect(state.byId[7].archived_at).toBe('2026-07-14T00:00:00Z');
    });

    it('is a no-op for an unknown scenarioId', () => {
        const state = scenariosReducer(baseState(), {
            type: ARCHIVE_ANUGA_SCENARIO_ERROR, scenarioId: 999, detail: 'x'
        });
        expect(state).toEqual(baseState());
    });
});
