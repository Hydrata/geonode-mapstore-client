/**
 * TASK-1599 / TASK-1600 (W1) — TerrainWorkbench unit tests.
 * TASK-1671 (W1.6) — Updated for single DEM priority stack + atomic derive body.
 *
 * Tests cover:
 *  1. Reducer: default state, SET_SECTION, SET_VISIBLE actions (shell).
 *  2. Reducer: recipe state — TW_LOAD_DATA, TW_LOAD_DATA_SUCCESS,
 *     TW_CREATE_SURFACE_SUCCESS, TW_UPDATE_SURFACE_SUCCESS,
 *     TW_DELETE_SURFACE_SUCCESS, TW_DERIVE / TW_DERIVE_SUCCESS /
 *     TW_DERIVE_COMPLETE.
 *  3. Action creators: setTerrainWorkbenchSection, setTerrainWorkbenchVisible,
 *     twCreateSurface, twDerive (with body), twDeriveSuccess, twDeriveComplete.
 */

import expect from 'expect';
import Rx from 'rxjs';
import { ActionsObservable } from 'redux-observable';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';
import { testEpic } from '@mapstore/framework/epics/__tests__/epicTestUtils';

import reducer from '../reducersTerrainWorkbench';
import {
    TERRAIN_WORKBENCH_SET_SECTION,
    TERRAIN_WORKBENCH_SET_VISIBLE,
    setTerrainWorkbenchSection,
    setTerrainWorkbenchVisible,
    TW_LOAD_DATA,
    TW_LOAD_DATA_SUCCESS,
    TW_LOAD_DATA_ERROR,
    TW_SELECT_SURFACE,
    TW_CREATE_SURFACE,
    TW_CREATE_SURFACE_SUCCESS,
    TW_UPDATE_SURFACE_SUCCESS,
    TW_DELETE_SURFACE_SUCCESS,
    TW_SET_DESIGN_INPUTS_SUCCESS,
    TW_DERIVE,
    TW_DERIVE_SUCCESS,
    TW_DERIVE_ERROR,
    TW_DERIVE_COMPLETE,
    twLoadDataSuccess,
    twCreateSurface,
    twDerive,
    twDeriveSuccess,
    twDeriveComplete,
    twSelectSurfaceForTerrain
} from '../actionsTerrainWorkbench';

// ---------------------------------------------------------------------------
// Reducer — shell tests (TASK-1599)
// ---------------------------------------------------------------------------

describe('TerrainWorkbench reducer — shell', () => {
    it('returns default state', () => {
        const state = reducer(undefined, {});
        expect(state.activeSection).toEqual('terrain');
        expect(state.visible).toEqual(false);
    });

    it('handles SET_SECTION', () => {
        const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_SECTION, section: 'delineation' });
        expect(state.activeSection).toEqual('delineation');
    });

    it('handles SET_VISIBLE', () => {
        const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible: true });
        expect(state.visible).toEqual(true);
    });

    it('switches to each valid section', () => {
        const sections = ['terrain', 'delineation', 'catchments'];
        sections.forEach((section) => {
            const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_SECTION, section });
            expect(state.activeSection).toEqual(section);
        });
    });

    it('preserves other state on SET_SECTION', () => {
        const initial = { activeSection: 'terrain', visible: true, extra: 'preserved' };
        const next = reducer(initial, { type: TERRAIN_WORKBENCH_SET_SECTION, section: 'catchments' });
        expect(next.visible).toEqual(true);
        expect(next.extra).toEqual('preserved');
    });
});

// ---------------------------------------------------------------------------
// Reducer — recipe state (TASK-1600)
// ---------------------------------------------------------------------------

describe('TerrainWorkbench reducer — recipe state', () => {
    it('TW_LOAD_DATA sets loading=true', () => {
        const state = reducer(undefined, { type: TW_LOAD_DATA });
        expect(state.loading).toEqual(true);
        expect(state.error).toEqual(null);
    });

    it('TW_LOAD_DATA_SUCCESS stores terrains + surfaces, clears loading', () => {
        // TASK-1671: terrains now include bbox_wgs84 + native_resolution_m fields.
        const terrains = [{
            id: 1,
            title: 'DEM A',
            bbox_wgs84: [150.0, -35.0, 151.0, -34.0],
            native_crs: 'EPSG:28356',
            native_resolution_m: 5
        }];
        // TASK-1671: surfaces now use inputs_ordered (not design_inputs_ordered).
        const surfaces = [{
            id: 10,
            title: 'Surface 1',
            is_stale: false,
            inputs_ordered: [
                { id: 1, terrain: 1, priority: 0, unmodified: true }
            ]
        }];
        const state = reducer(undefined, { type: TW_LOAD_DATA_SUCCESS, terrains, surfaces });
        expect(state.loading).toEqual(false);
        expect(state.terrains).toEqual(terrains);
        expect(state.surfaces).toEqual(surfaces);
        expect(state.terrains[0].bbox_wgs84.length).toEqual(4);
        expect(state.terrains[0].native_resolution_m).toEqual(5);
        expect(state.surfaces[0].inputs_ordered[0].unmodified).toEqual(true);
    });

    it('TW_LOAD_DATA_ERROR stores error, clears loading', () => {
        const state = reducer(undefined, { type: TW_LOAD_DATA_ERROR, error: 'Network error' });
        expect(state.loading).toEqual(false);
        expect(state.error).toEqual('Network error');
    });

    it('TW_SELECT_SURFACE stores selectedSurfaceId', () => {
        const state = reducer(undefined, { type: TW_SELECT_SURFACE, surfaceId: 42 });
        expect(state.selectedSurfaceId).toEqual(42);
    });

    it('TW_CREATE_SURFACE sets saving=true', () => {
        const state = reducer(undefined, { type: TW_CREATE_SURFACE, payload: {} });
        expect(state.saving).toEqual(true);
    });

    it('TW_CREATE_SURFACE_SUCCESS adds surface + selects it', () => {
        const surface = { id: 5, title: 'New', is_stale: true };
        const initial = { ...reducer(undefined, {}), surfaces: [] };
        const state = reducer(initial, { type: TW_CREATE_SURFACE_SUCCESS, surface });
        expect(state.surfaces.length).toEqual(1);
        expect(state.surfaces[0].id).toEqual(5);
        expect(state.selectedSurfaceId).toEqual(5);
        expect(state.saving).toEqual(false);
    });

    it('TW_UPDATE_SURFACE_SUCCESS merges surface by id', () => {
        const surfaces = [
            { id: 1, title: 'Old', feather_width_m: 50 },
            { id: 2, title: 'Other' }
        ];
        const initial = { ...reducer(undefined, {}), surfaces };
        const updated = { id: 1, title: 'Updated', feather_width_m: 100 };
        const state = reducer(initial, { type: TW_UPDATE_SURFACE_SUCCESS, surface: updated });
        expect(state.surfaces[0].feather_width_m).toEqual(100);
        expect(state.surfaces[0].title).toEqual('Updated');
        expect(state.surfaces[1].id).toEqual(2); // unchanged
    });

    it('TW_DELETE_SURFACE_SUCCESS removes surface + clears selection', () => {
        const surfaces = [{ id: 1 }, { id: 2 }];
        const initial = { ...reducer(undefined, {}), surfaces, selectedSurfaceId: 1 };
        const state = reducer(initial, { type: TW_DELETE_SURFACE_SUCCESS, surfaceId: 1 });
        expect(state.surfaces.length).toEqual(1);
        expect(state.surfaces[0].id).toEqual(2);
        expect(state.selectedSurfaceId).toEqual(null);
    });

    it('TW_DELETE_SURFACE_SUCCESS preserves selection if different surface deleted', () => {
        const surfaces = [{ id: 1 }, { id: 2 }];
        const initial = { ...reducer(undefined, {}), surfaces, selectedSurfaceId: 2 };
        const state = reducer(initial, { type: TW_DELETE_SURFACE_SUCCESS, surfaceId: 1 });
        expect(state.selectedSurfaceId).toEqual(2);
    });

    it('TW_SET_DESIGN_INPUTS_SUCCESS merges surface (backward compat)', () => {
        // TASK-1671: TW_SET_DESIGN_INPUTS is no longer dispatched by the UI but
        // the reducer case is preserved for backward compatibility. Verify merge
        // still works using the new inputs_ordered shape.
        const surfaces = [{ id: 3, inputs_ordered: [] }];
        const initial = { ...reducer(undefined, {}), surfaces };
        const updated = { id: 3, inputs_ordered: [{ id: 1, terrain: 5, priority: 0, unmodified: false }] };
        const state = reducer(initial, { type: TW_SET_DESIGN_INPUTS_SUCCESS, surface: updated });
        expect(state.surfaces[0].inputs_ordered.length).toEqual(1);
    });

    it('TW_DERIVE sets deriving=true, clears errors', () => {
        const state = reducer(undefined, { type: TW_DERIVE, surfaceId: 7 });
        expect(state.deriving).toEqual(true);
        expect(state.deriveError).toEqual(null);
        expect(state.derivingProcessId).toEqual(null);
    });

    it('TW_DERIVE_SUCCESS stores processId, stays deriving=true', () => {
        const initial = { ...reducer(undefined, {}), deriving: true };
        const state = reducer(initial, { type: TW_DERIVE_SUCCESS, surfaceId: 7, processId: 99 });
        expect(state.derivingProcessId).toEqual(99);
        expect(state.deriving).toEqual(true);
    });

    it('TW_DERIVE_ERROR clears deriving, stores error', () => {
        const initial = { ...reducer(undefined, {}), deriving: true };
        const state = reducer(initial, { type: TW_DERIVE_ERROR, error: 'failed' });
        expect(state.deriving).toEqual(false);
        expect(state.deriveError).toEqual('failed');
    });

    it('TW_DERIVE_COMPLETE merges surface, clears deriving', () => {
        const surfaces = [{ id: 7, is_stale: true }];
        const initial = {
            ...reducer(undefined, {}),
            surfaces,
            deriving: true,
            derivingProcessId: 99
        };
        // TASK-1671: surface now returns inputs_ordered (not design_inputs_ordered).
        const completed = {
            id: 7,
            is_stale: false,
            enforcement_log: { max_seam_step_m: 0.05 },
            inputs_ordered: [
                { id: 1, terrain: 5, priority: 0, unmodified: true },
                { id: 2, terrain: 7, priority: 1, unmodified: false }
            ]
        };
        const state = reducer(initial, { type: TW_DERIVE_COMPLETE, surface: completed });
        expect(state.deriving).toEqual(false);
        expect(state.derivingProcessId).toEqual(null);
        expect(state.surfaces[0].is_stale).toEqual(false);
        expect(state.surfaces[0].enforcement_log.max_seam_step_m).toEqual(0.05);
        expect(state.surfaces[0].inputs_ordered.length).toEqual(2);
        expect(state.surfaces[0].inputs_ordered[0].unmodified).toEqual(true);
        expect(state.surfaces[0].inputs_ordered[1].unmodified).toEqual(false);
    });
});

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

describe('TerrainWorkbench action creators', () => {
    it('setTerrainWorkbenchSection returns correct type + payload', () => {
        const action = setTerrainWorkbenchSection('delineation');
        expect(action.type).toEqual(TERRAIN_WORKBENCH_SET_SECTION);
        expect(action.section).toEqual('delineation');
    });

    it('setTerrainWorkbenchVisible returns correct type + payload', () => {
        const action = setTerrainWorkbenchVisible(true);
        expect(action.type).toEqual(TERRAIN_WORKBENCH_SET_VISIBLE);
        expect(action.visible).toEqual(true);
    });

    it('twCreateSurface returns correct type + payload', () => {
        const payload = { title: 'Test', feather_width_m: 50 };
        const action = twCreateSurface(payload);
        expect(action.type).toEqual(TW_CREATE_SURFACE);
        expect(action.payload).toEqual(payload);
    });

    it('twDerive returns surfaceId (no body)', () => {
        const action = twDerive(11);
        expect(action.type).toEqual(TW_DERIVE);
        expect(action.surfaceId).toEqual(11);
        expect(action.body).toEqual(undefined);
    });

    it('twDerive carries atomic derive body (TASK-1671)', () => {
        // TASK-1671: twDerive now carries the full derive body so the epic
        // can POST it as one atomic call to /derive/.
        const body = {
            inputs: [
                { terrain_id: 5, priority: 0, unmodified: true },
                { terrain_id: 7, priority: 1, unmodified: false }
            ],
            feather_width_m: 50,
            target_resolution_m: 5,
            breach_max_cost: 20,
            breach_search_dist: 100,
            use_culverts: false
        };
        const action = twDerive(11, body);
        expect(action.type).toEqual(TW_DERIVE);
        expect(action.surfaceId).toEqual(11);
        expect(action.body).toEqual(body);
        expect(action.body.inputs.length).toEqual(2);
        expect(action.body.inputs[0].unmodified).toEqual(true);
        expect(action.body.inputs[1].unmodified).toEqual(false);
        // Priority convention: 0 = top (highest priority), 1 = base.
        expect(action.body.inputs[0].priority).toEqual(0);
        expect(action.body.inputs[1].priority).toEqual(1);
    });

    it('twDeriveSuccess returns surfaceId + processId', () => {
        const action = twDeriveSuccess(11, 77);
        expect(action.type).toEqual(TW_DERIVE_SUCCESS);
        expect(action.surfaceId).toEqual(11);
        expect(action.processId).toEqual(77);
    });

    it('twLoadDataSuccess returns terrains + surfaces', () => {
        const terrains = [{ id: 1 }];
        const surfaces = [{ id: 2 }];
        const action = twLoadDataSuccess(terrains, surfaces);
        expect(action.type).toEqual(TW_LOAD_DATA_SUCCESS);
        expect(action.terrains).toEqual(terrains);
        expect(action.surfaces).toEqual(surfaces);
    });

    it('twDeriveComplete returns surface', () => {
        const surface = { id: 5, is_stale: false };
        const action = twDeriveComplete(surface);
        expect(action.type).toEqual(TW_DERIVE_COMPLETE);
        expect(action.surface).toEqual(surface);
    });
});

// TASK-1657: the panel visible-gating describe block was removed with the dead
// workbench shell component (the 1645 dissolution). The reducer's SET_VISIBLE /
// SET_SECTION cases + their action creators are still covered above.

// ---------------------------------------------------------------------------
// TASK-1658 — extractTwError: map the BE {success:false, errors:[...]} shape
// ---------------------------------------------------------------------------

import { extractTwError, twSelectSurfaceForTerrainEpic, twDeriveEpic } from '../epicsTerrainWorkbench';

describe('TASK-1658 extractTwError', () => {
    it('joins an errors array of plain strings', () => {
        const err = { response: { data: { success: false, code: 'validation', errors: ['priorities must be unique', 'terrain not found'] } } };
        expect(extractTwError(err, 'Create failed')).toEqual('priorities must be unique; terrain not found');
    });
    it('maps errors array of {message} objects', () => {
        const err = { response: { data: { errors: [{ message: 'bad input' }, { detail: 'also bad' }] } } };
        expect(extractTwError(err, 'Create failed')).toEqual('bad input; also bad');
    });
    it('maps errors array of {field,error} objects', () => {
        const err = { response: { data: { errors: [{ field: 'inputs', error: 'required' }] } } };
        expect(extractTwError(err, 'Create failed')).toEqual('inputs: required');
    });
    it('falls back to detail then error then message then default', () => {
        expect(extractTwError({ response: { data: { detail: 'd' } } }, 'fb')).toEqual('d');
        expect(extractTwError({ response: { data: { error: 'e' } } }, 'fb')).toEqual('e');
        expect(extractTwError({ message: 'm' }, 'fb')).toEqual('m');
        expect(extractTwError({}, 'fb')).toEqual('fb');
    });
    it('ignores an empty errors array and uses the fallback chain', () => {
        const err = { response: { data: { errors: [], error: 'real' } } };
        expect(extractTwError(err, 'fb')).toEqual('real');
    });
});

// ---------------------------------------------------------------------------
// TASK-1753 (W1.8) — selecting a derived terrain populates the recipe builder
// ---------------------------------------------------------------------------

describe('TASK-1753 twSelectSurfaceForTerrainEpic', () => {
    const makeState = (surfaces = []) => ({
        anuga: { projects: { data: { id: 42 } } },
        terrainWorkbench: { surfaces }
    });

    it('resolves the source recipe from already-loaded surfaces and selects it', (done) => {
        // Surface 11 produced terrain 7 — its output_terrain === 7.
        const state = makeState([
            { id: 10, output_terrain: null },
            { id: 11, output_terrain: 7 },
            { id: 12, output_terrain: 99 }
        ]);
        testEpic(
            twSelectSurfaceForTerrainEpic,
            1,
            twSelectSurfaceForTerrain(7),
            (actions) => {
                expect(actions.length).toBe(1);
                expect(actions[0].type).toBe(TW_SELECT_SURFACE);
                expect(actions[0].surfaceId).toBe(11);
                done();
            },
            state
        );
    });

    it('falls back to the ?output_terrain=<id> BE filter and dispatches load + select', (done) => {
        // No loaded surface carries output_terrain === 7 → hit the BE filter.
        // MockAdapter matches config.url (the base path) and exposes the query as
        // config.params, so assert the ?output_terrain= filter is forwarded there.
        const mockAxios = new MockAdapter(axios);
        mockAxios.onGet(/analysis-surfaces\/$/).reply((config) => {
            expect(config.params).toEqual({ output_terrain: 7 });
            return [200, [{ id: 21, output_terrain: 7 }]];
        });
        testEpic(
            twSelectSurfaceForTerrainEpic,
            2,
            twSelectSurfaceForTerrain(7),
            (actions) => {
                try {
                    // First load the list (so the resolved surface is present for the
                    // builder), then select it.
                    expect(actions[0].type).toBe(TW_LOAD_DATA);
                    expect(actions[1].type).toBe(TW_SELECT_SURFACE);
                    expect(actions[1].surfaceId).toBe(21);
                } finally {
                    mockAxios.restore();
                }
                done();
            },
            makeState([])
        );
    });
});

// ---------------------------------------------------------------------------
// TASK-1800 (W1.9 UAT r2) — twDeriveEpic lazy create-then-derive:
// register the created Combined surface on CREATE success, independent of the
// derive outcome, so a failed derive does not orphan a fresh row on retry.
// ---------------------------------------------------------------------------

describe('TASK-1800 twDeriveEpic lazy create-then-derive', () => {
    const projectState = { anuga: { projects: { data: { id: 42 } } } };
    const deriveBody = {
        inputs: [{ terrain_id: 5, priority: 0, unmodified: true }],
        feather_width_m: 50,
        target_resolution_m: 5,
        breach_max_cost: 20,
        breach_search_dist: 100,
        use_culverts: false
    };

    it('registers the created surface on create-success even when the derive FAILS', (done) => {
        // null surfaceId → lazy create. Create succeeds (returns id 77), derive 500s.
        // The created row MUST be registered (twCreateSurfaceSuccess + twSelectSurface)
        // BEFORE the derive error — otherwise the panel keeps surface=null and the
        // retry creates a duplicate row (the orphan-row bug this fix closes).
        const mockAxios = new MockAdapter(axios);
        let createCalls = 0;
        mockAxios.onPost(/analysis-surfaces\/$/).reply(() => {
            createCalls += 1;
            return [201, { id: 77, title: 'Combined surface', is_stale: true }];
        });
        mockAxios.onPost(/analysis-surfaces\/77\/derive\/$/).reply(500, {
            success: false, errors: ['boom']
        });
        // 3 actions expected: twCreateSurfaceSuccess, twSelectSurface, twDeriveError.
        testEpic(
            twDeriveEpic,
            3,
            twDerive(null, deriveBody),
            (actions) => {
                try {
                    expect(actions.length).toBe(3);
                    expect(actions[0].type).toBe(TW_CREATE_SURFACE_SUCCESS);
                    expect(actions[0].surface.id).toBe(77);
                    expect(actions[1].type).toBe(TW_SELECT_SURFACE);
                    expect(actions[1].surfaceId).toBe(77);
                    // The derive failure surfaces as an error, NOT a success — and the
                    // task-monitor panel is NOT opened (no derive in flight).
                    expect(actions[2].type).toBe(TW_DERIVE_ERROR);
                    // Only ONE create POST despite the failed derive.
                    expect(createCalls).toBe(1);
                } finally {
                    mockAxios.restore();
                }
                done();
            },
            projectState
        );
    });

    it('a retry after a failed derive hits the EXISTING-id path — no duplicate create', (done) => {
        // Simulate the real two-attempt sequence: attempt 1 creates id 77 then the
        // derive fails; the row is now registered + selected, so the panel re-binds
        // to id 77 and the retry dispatches twDerive(77, body) (non-null) — which
        // takes the deriveWithId existing-id branch and does NOT POST create again.
        //
        // We drive the epic by hand (rather than via testEpic's synchronous array
        // form) because twDeriveEpic uses switchMap: dispatching both twDerive
        // actions back-to-back would CANCEL attempt 1's in-flight create/derive when
        // attempt 2 arrives. The real UI only fires the retry AFTER the first derive
        // resolved (the button re-enables on TW_DERIVE_ERROR), so we mirror that —
        // dispatch attempt 2 only once attempt 1's three actions have settled.
        const mockAxios = new MockAdapter(axios);
        let createCalls = 0;
        mockAxios.onPost(/analysis-surfaces\/$/).reply(() => {
            createCalls += 1;
            return [201, { id: 77, title: 'Combined surface', is_stale: true }];
        });
        // First derive (after lazy create) fails; the retry derive succeeds (202).
        let deriveCalls = 0;
        mockAxios.onPost(/analysis-surfaces\/77\/derive\/$/).reply(() => {
            deriveCalls += 1;
            return deriveCalls === 1
                ? [500, { success: false, errors: ['boom'] }]
                : [202, { detail: 'queued', process_id: 'pid-9' }];
        });

        const actions$ = new Rx.Subject();
        const emitted = [];
        let secondDispatched = false;
        const sub = twDeriveEpic(
            new ActionsObservable(actions$),
            { getState: () => projectState }
        ).subscribe((a) => {
            emitted.push(a);
            // After attempt 1 settles (its 3rd action, the derive error) fire the retry
            // against the now-registered id 77 — the existing-id branch.
            if (!secondDispatched && a.type === TW_DERIVE_ERROR) {
                secondDispatched = true;
                actions$.next(twDerive(77, deriveBody));
            }
            // Attempt 2's terminal action is the derive-success — assert and finish.
            if (a.type === TW_DERIVE_SUCCESS) {
                try {
                    // Attempt 1 — lazy create then failed derive.
                    expect(emitted[0].type).toBe(TW_CREATE_SURFACE_SUCCESS);
                    expect(emitted[0].surface.id).toBe(77);
                    expect(emitted[1].type).toBe(TW_SELECT_SURFACE);
                    expect(emitted[1].surfaceId).toBe(77);
                    expect(emitted[2].type).toBe(TW_DERIVE_ERROR);
                    // Attempt 2 — existing-id derive succeeds.
                    expect(a.surfaceId).toBe(77);
                    expect(a.processId).toBe('pid-9');
                    // createAnalysisSurface called EXACTLY ONCE across both attempts —
                    // the retry did NOT orphan a second Combined surface row.
                    expect(createCalls).toBe(1);
                    // Attempt 2 took the existing-id branch, so it never re-registered.
                    expect(emitted.filter(x => x.type === TW_CREATE_SURFACE_SUCCESS).length).toBe(1);
                    sub.unsubscribe();
                    mockAxios.restore();
                    done();
                } catch (e) {
                    sub.unsubscribe();
                    mockAxios.restore();
                    done(e);
                }
            }
        }, (err) => {
            mockAxios.restore();
            done(err);
        });
        // Kick off attempt 1.
        actions$.next(twDerive(null, deriveBody));
    });

    it('the existing-id path derives directly without any create POST', (done) => {
        // A project that already owns a surface (non-null surfaceId) must NOT create.
        const mockAxios = new MockAdapter(axios);
        let createCalls = 0;
        mockAxios.onPost(/analysis-surfaces\/$/).reply(() => {
            createCalls += 1;
            return [201, { id: 99 }];
        });
        mockAxios.onPost(/analysis-surfaces\/11\/derive\/$/).reply(202, {
            detail: 'queued', process_id: 'pid-1'
        });
        // toggleTaskMonitorPanel(true) + twDeriveSuccess = 2 actions.
        testEpic(
            twDeriveEpic,
            2,
            twDerive(11, deriveBody),
            (actions) => {
                try {
                    const successAction = actions.find(a => a.type === TW_DERIVE_SUCCESS);
                    expect(successAction).toExist();
                    expect(successAction.surfaceId).toBe(11);
                    expect(successAction.processId).toBe('pid-1');
                    // No lazy create on the existing-id path.
                    expect(createCalls).toBe(0);
                } finally {
                    mockAxios.restore();
                }
                done();
            },
            projectState
        );
    });
});
