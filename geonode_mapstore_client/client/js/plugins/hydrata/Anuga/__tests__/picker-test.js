/**
 * TASK-2254 (epic 2249 W2) — Cross-section picker state spec.
 *
 * The picker lists up to 3 terrains + 3 scenario water surfaces (LOCKED
 * decisions #2/#6/#10 in epic 2249's context). This spec pins the STATE +
 * DATA layer only (the picker-as-legend UI component is W3/TASK-2256):
 *
 *   - getTerrainPickerRows / getScenarioPickerRows — the series model. Terrain
 *     rows = project Terrain resources with status='ready' + gn_layer_name, in
 *     resource-list order. Scenario rows = non-archived scenarios in
 *     allIds order, each tagged a checkability `status`: 'ready' (has a
 *     published stage_max) | 'no-run' (no latest_complete_run) | 'no-stage'
 *     (a run exists but predates stage publication).
 *   - seedCheckedTerrains / seedCheckedScenarios — seed the checked-id set from
 *     current map visibility on panel open; overflow (>3 visible) takes the
 *     first 3 BY LIST ORDER; nothing visible falls back to the active terrain
 *     / selected scenario (today's single-terrain/single-water default).
 *   - getColorSlot — colour slot = a checked id's index within the STABLE
 *     picker-list order of the checked subset, NOT the order items were
 *     checked in (kills colour churn across sessions/screenshots).
 *   - uiReducer checked-id state: SET_CHECKED_TERRAINS/SCENARIOS (bulk seed,
 *     defensively capped) and TOGGLE_CHECKED_TERRAIN/SCENARIO (user click,
 *     hard-capped at 3, independent per group).
 *   - pickerSeedEpic — on SET_PROFILE_PANEL_VISIBLE(true) dispatches the two
 *     seeded checked-id sets.
 */
import expect from 'expect';
import Rx from 'rxjs';

import uiReducer from '../reducers/uiReducer';
import {
    setProfilePanelVisible,
    setCheckedTerrains,
    setCheckedScenarios,
    toggleCheckedTerrain,
    toggleCheckedScenario
} from '../actionsAnuga';
import {
    getTerrainPickerRows,
    getScenarioPickerRows,
    getColorSlot,
    seedCheckedTerrains,
    seedCheckedScenarios,
    pickerSeedEpic
} from '../epics/profileEpic';

// ── State fixture ────────────────────────────────────────────────────────────
// 4 ready terrains (+ 1 not-ready, excluded) and 4 non-archived scenarios
// spanning every checkability status, plus 1 archived scenario (must be
// hidden entirely regardless of its run/stage state).
const makeState = (overrides = {}) => {
    const base = {
        anuga: {
            resources: {
                terrainLoaded: true,
                terrain: [
                    { id: 1, status: 'ready', gn_layer_name: 'ele_1_a' },
                    { id: 2, status: 'ready', gn_layer_name: 'ele_2_b' },
                    { id: 3, status: 'ready', gn_layer_name: 'ele_3_c' },
                    { id: 4, status: 'ready', gn_layer_name: 'ele_4_d' },
                    { id: 5, status: 'pending', gn_layer_name: null }
                ]
            },
            scenarios: {
                selectedId: 1,
                allIds: [1, 2, 3, 4, 5],
                byId: {
                    // 1: ready (published stage) — the default selected scenario.
                    1: {
                        id: 1,
                        selected: true,
                        latest_complete_run: {
                            id: 10,
                            gn_layer_stage_max: { name: 'geonode:run_1_10_stage_max_cog' },
                            gn_layer_depth_max: { name: 'geonode:run_1_10_depth_max_cog' }
                        }
                    },
                    // 2: ready.
                    2: {
                        id: 2,
                        latest_complete_run: {
                            id: 11,
                            gn_layer_stage_max: { name: 'geonode:run_2_11_stage_max_cog' },
                            gn_layer_depth_max: { name: 'geonode:run_2_11_depth_max_cog' }
                        }
                    },
                    // 3: no completed run at all.
                    3: { id: 3, latest_complete_run: null },
                    // 4: a run exists but predates stage publication (no stage_max).
                    4: {
                        id: 4,
                        latest_complete_run: {
                            id: 12,
                            gn_layer_stage_max: null,
                            gn_layer_depth_max: { name: 'geonode:run_4_12_depth_max_cog' }
                        }
                    },
                    // 5: archived — must be hidden regardless of an otherwise-ready run.
                    5: {
                        id: 5,
                        archived_at: '2026-01-01T00:00:00Z',
                        latest_complete_run: {
                            id: 13,
                            gn_layer_stage_max: { name: 'geonode:run_5_13_stage_max_cog' },
                            gn_layer_depth_max: { name: 'geonode:run_5_13_depth_max_cog' }
                        }
                    }
                }
            }
        },
        layers: { flat: [] }
    };
    return { ...base, ...overrides };
};

const withLayers = (flat) => makeState({ layers: { flat } });

// ── Series model ─────────────────────────────────────────────────────────────

describe('profileEpic — picker series model (TASK-2254)', () => {
    it('terrain rows = ready terrains with a gn_layer_name, in resource-list order', () => {
        const rows = getTerrainPickerRows(makeState());
        expect(rows.map(r => r.id)).toEqual([1, 2, 3, 4]);
    });

    it('scenario rows: archived hidden; no-run / no-stage / ready are distinct statuses', () => {
        const rows = getScenarioPickerRows(makeState());
        expect(rows.map(r => r.id)).toEqual([1, 2, 3, 4]);
        const byId = Object.fromEntries(rows.map(r => [r.id, r.status]));
        expect(byId[1]).toBe('ready');
        expect(byId[2]).toBe('ready');
        expect(byId[3]).toBe('no-run');
        expect(byId[4]).toBe('no-stage');
    });
});

// ── Seeding from map visibility (AC1/AC2) ───────────────────────────────────

describe('profileEpic — picker seeding from map visibility (TASK-2254, AC1)', () => {
    it('seeds checked terrains from visible map layers, in LIST order (not detection order)', () => {
        // Layer 2 appears before layer 1 in state.layers.flat; the seed must
        // still come back terrain-1-then-2 (stable picker-list order).
        const state = withLayers([
            { name: 'geonode:ele_2_b', visibility: true },
            { name: 'geonode:ele_1_a', visibility: true }
        ]);
        expect(seedCheckedTerrains(state)).toEqual([1, 2]);
    });

    it('overflow (>3 visible) takes the first 3 BY LIST ORDER', () => {
        const state = withLayers([
            { name: 'geonode:ele_4_d', visibility: true },
            { name: 'geonode:ele_1_a', visibility: true },
            { name: 'geonode:ele_3_c', visibility: true },
            { name: 'geonode:ele_2_b', visibility: true }
        ]);
        // All 4 terrains are visible; only the first 3 BY LIST ORDER (1,2,3) win.
        expect(seedCheckedTerrains(state)).toEqual([1, 2, 3]);
    });

    it('an explicitly-hidden layer (visibility:false) does not seed', () => {
        const state = withLayers([{ name: 'geonode:ele_1_a', visibility: false }]);
        expect(seedCheckedTerrains(state).includes(1)).toBe(false);
    });

    it('a scenario seeds if ANY of its result layers is visible (depth_max here)', () => {
        const state = withLayers([{ name: 'geonode:run_2_11_depth_max_cog', visibility: true }]);
        expect(seedCheckedScenarios(state)).toEqual([2]);
    });

    it('overflow (>3 scenarios visible) takes the first 3 BY LIST ORDER', () => {
        // Scenario 4 has no stage_max (status 'no-stage') so it is NOT checkable
        // and must never be seeded even though its depth layer is visible.
        const state = withLayers([
            { name: 'geonode:run_2_11_depth_max_cog', visibility: true },
            { name: 'geonode:run_1_10_depth_max_cog', visibility: true },
            { name: 'geonode:run_4_12_depth_max_cog', visibility: true }
        ]);
        expect(seedCheckedScenarios(state)).toEqual([1, 2]);
    });
});

describe('profileEpic — picker fallback seed when nothing visible (TASK-2254, AC2)', () => {
    it('no visible terrain layers at all -> falls back to the active terrain', () => {
        const state = withLayers([
            { name: 'geonode:ele_3_c', type: 'wms', group: 'Input Data.Terrain', visibility: false }
        ]);
        expect(seedCheckedTerrains(state)).toEqual([3]);
    });

    it('no terrain layers on the map at all -> empty (no active terrain to fall back to)', () => {
        expect(seedCheckedTerrains(makeState())).toEqual([]);
    });

    it('no scenario result layers visible -> falls back to the selected scenario', () => {
        expect(seedCheckedScenarios(makeState())).toEqual([1]);
    });

    it('the selected scenario is not checkable (no run) -> fallback yields empty, never a disabled row', () => {
        const state = makeState();
        state.anuga.scenarios.selectedId = 3;
        expect(seedCheckedScenarios(state)).toEqual([]);
    });
});

// ── Stable colour slots (AC5) ───────────────────────────────────────────────

describe('profileEpic — getColorSlot: stable picker-list position (TASK-2254, AC5)', () => {
    const rows = [{ id: 10 }, { id: 20 }, { id: 30 }];

    it('slot = index within the checked subset in LIST order, NOT check order', () => {
        // Checked in reverse (30 clicked before 10) — slots still follow the
        // underlying list order (10 before 30).
        expect(getColorSlot(rows, [30, 10], 10)).toBe(0);
        expect(getColorSlot(rows, [30, 10], 30)).toBe(1);
    });

    it('is stable across uncheck/recheck', () => {
        const slotBefore = getColorSlot(rows, [10, 20], 20);
        // 10 unchecked then rechecked (now last in the checked-ids array) —
        // 20's slot must be unaffected because it is still list-position 1.
        const slotAfter = getColorSlot(rows, [20, 10], 20);
        expect(slotAfter).toBe(slotBefore);
    });

    it('is stable across differing check ORDERS for the same checked set', () => {
        expect(getColorSlot(rows, [10, 30], 30)).toBe(getColorSlot(rows, [30, 10], 30));
    });

    it('returns -1 for an id that is not currently checked', () => {
        expect(getColorSlot(rows, [10], 20)).toBe(-1);
    });
});

// ── uiReducer checked-id state + cap (AC3) ──────────────────────────────────

describe('uiReducer — picker checked-set state (TASK-2254, AC3)', () => {
    it('defaults to no checked terrains/scenarios', () => {
        const s = uiReducer(undefined, { type: '@@INIT' });
        expect(s.checkedTerrainIds).toEqual([]);
        expect(s.checkedScenarioIds).toEqual([]);
    });

    it('SET_CHECKED_TERRAINS bulk-replaces, defensively capped to 3', () => {
        const s = uiReducer(undefined, setCheckedTerrains([1, 2, 3, 4, 5]));
        expect(s.checkedTerrainIds).toEqual([1, 2, 3]);
    });

    it('SET_CHECKED_SCENARIOS bulk-replaces, defensively capped to 3', () => {
        const s = uiReducer(undefined, setCheckedScenarios([1, 2, 3, 4]));
        expect(s.checkedScenarioIds).toEqual([1, 2, 3]);
    });

    it('TOGGLE_CHECKED_TERRAIN adds up to the cap, then ignores a 4th add', () => {
        let s = uiReducer(undefined, toggleCheckedTerrain(1));
        s = uiReducer(s, toggleCheckedTerrain(2));
        s = uiReducer(s, toggleCheckedTerrain(3));
        expect(s.checkedTerrainIds).toEqual([1, 2, 3]);
        s = uiReducer(s, toggleCheckedTerrain(4));
        expect(s.checkedTerrainIds).toEqual([1, 2, 3]);
    });

    it('TOGGLE_CHECKED_TERRAIN removes an already-checked id (unchecking frees a slot)', () => {
        let s = uiReducer(undefined, toggleCheckedTerrain(1));
        s = uiReducer(s, toggleCheckedTerrain(2));
        s = uiReducer(s, toggleCheckedTerrain(1));
        expect(s.checkedTerrainIds).toEqual([2]);
        s = uiReducer(s, toggleCheckedTerrain(3));
        s = uiReducer(s, toggleCheckedTerrain(4));
        expect(s.checkedTerrainIds).toEqual([2, 3, 4]);
    });

    it('checkedScenarioIds toggling/cap is independent of checkedTerrainIds', () => {
        let s = uiReducer(undefined, toggleCheckedTerrain(1));
        s = uiReducer(s, toggleCheckedScenario(10));
        s = uiReducer(s, toggleCheckedScenario(11));
        s = uiReducer(s, toggleCheckedScenario(12));
        s = uiReducer(s, toggleCheckedScenario(13));
        expect(s.checkedScenarioIds).toEqual([10, 11, 12]);
        expect(s.checkedTerrainIds).toEqual([1]);
    });
});

// ── pickerSeedEpic ───────────────────────────────────────────────────────────

const mockActions = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => actions.forEach(a => subject.next(a)), 0);
    return action$;
};

describe('pickerSeedEpic — seeds checked terrains/scenarios on panel open (TASK-2254)', () => {
    it('on SET_PROFILE_PANEL_VISIBLE(true) dispatches both seeded checked-id sets', function(done) {
        this.timeout(3000);
        const state = withLayers([{ name: 'geonode:ele_1_a', visibility: true }]);
        const store = { getState: () => state };
        const action$ = mockActions([setProfilePanelVisible(true)]);
        const emitted = [];
        pickerSeedEpic(action$, store).subscribe(a => emitted.push(a), done);
        setTimeout(() => {
            try {
                const terrains = emitted.find(a => a.type === 'ANUGA:SET_CHECKED_TERRAINS');
                const scenarios = emitted.find(a => a.type === 'ANUGA:SET_CHECKED_SCENARIOS');
                expect(terrains).toExist('expected SET_CHECKED_TERRAINS');
                expect(terrains.ids).toEqual([1]);
                expect(scenarios).toExist('expected SET_CHECKED_SCENARIOS');
                expect(scenarios.ids).toEqual([1]);
                done();
            } catch (e) { done(e); }
        }, 200);
    });

    it('does NOT seed on SET_PROFILE_PANEL_VISIBLE(false)', function(done) {
        this.timeout(3000);
        const store = { getState: () => makeState() };
        const action$ = mockActions([setProfilePanelVisible(false)]);
        const emitted = [];
        pickerSeedEpic(action$, store).subscribe(a => emitted.push(a), done);
        setTimeout(() => {
            try {
                expect(emitted.length).toBe(0);
                done();
            } catch (e) { done(e); }
        }, 200);
    });
});
