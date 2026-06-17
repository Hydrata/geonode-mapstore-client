import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import fixture from './fixtures/preRefactorActionLog.json';
import {MenuRow} from '../components/simpleViewMenuRow';

/**
 * TASK-1008 (W4) — Redux action-log parity regression guard for the
 * Miller-columns refactor (TASK-1004 / W1+W2+W3, shipped 2026-05-17/18).
 *
 * The fixture `preRefactorActionLog.json` was captured against gmc
 * `34ac09071` (W1 ship) using `window.MapStoreAPI.onAction('*', ...)`
 * — the live action listener exposed in AppUtils.js. It records the
 * Redux action sequence for 11 categories × 4 simple-view user actions
 * (44 keys), with id-shaped fields filtered.
 *
 * What this file asserts:
 *   (A) Fixture schema invariants — captureContext + sequences shape +
 *       the key spec correction that CHANGE_LAYER_PROPERTIES carries
 *       `layer` (NOT `id`).
 *   (B) Filter rule unit tests — so future filter regressions surface
 *       independently of the replay assertions.
 *   (C) Simple-action replay — toggleVisibility for Terrain / Boundary
 *       / Inflow. Two clicks. Recorded actions filtered and compared
 *       to the fixture entries byte-for-byte.
 *   (D) Skipped-sequence inventory — positive assertions on the
 *       fixture's stated invariants (Terrain.pencilClick === null,
 *       every *.trashConfirm === []) so fixture drift fails loud.
 *
 * What this file does NOT do:
 *   - pencilClick replay: those sequences include cross-plugin actions
 *     (FEATUREGRID:CLOSE_GRID, VECTOR_DRAW:START, SHOW_NOTIFICATION
 *     from a live GeoServer WFS error path) that require a live
 *     VectorDraw store / FeatureGrid lifecycle. Out of scope for unit
 *     tests; covered by the orchestrator's localhost smoke step.
 *   - opacityDrag replay: nouislider's `change` event doesn't fire
 *     under JSDOM (no real mouse event sequence). We assert the
 *     fixture entry's structural shape only (xit() with a comment for
 *     follow-up).
 */

// 4 known action types in the fixture. SIMPLE_ACTIONS replay here;
// COMPLEX_ACTIONS are documented and skipped per the rationale above.
const SIMPLE_ACTIONS = ['toggleVisibility', 'opacityDrag'];
const COMPLEX_ACTIONS = ['pencilClick', 'trashConfirm'];
const ALL_ACTIONS = [...SIMPLE_ACTIONS, ...COMPLEX_ACTIONS];

const CATEGORIES = [
    'Terrain', 'Boundary', 'Inflow', 'Rainfall', 'MeshRegion',
    'Friction', 'FrictionRaster', 'Structure',
    'Catchments', 'Nodes', 'Links'
];

/**
 * Filter normalises action shapes the same way the W1 capture did:
 *   - `id`/`uuid`/`timestamp`/`createdAt`/`updatedAt`/`layer` → '<filtered>'
 *   - any number > 1e12 (Date.now()-shaped) → '<filtered>'
 *   - any 'geonode:<prefix>_<id>_<rest>' string → '<filtered>'
 *   - `opacity` numeric → '<numeric>' (the exact float varies by pixel
 *     rounding so the parity signal is the TYPE, not the value)
 */
function filter(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'number' && value > 1e12) return '<filtered>';
    if (typeof value === 'string') {
        if (/^geonode:[a-z]+_\d+_/.test(value)) return '<filtered>';
        return value;
    }
    if (Array.isArray(value)) return value.map(filter);
    if (typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) {
            if (['id', 'uuid', 'timestamp', 'createdAt', 'updatedAt', 'layer'].includes(k)) {
                out[k] = '<filtered>';
            } else if (k === 'opacity') {
                out[k] = '<numeric>';
            } else {
                out[k] = filter(value[k]);
            }
        }
        return out;
    }
    return value;
}

// Build a recording store. Defaults mirror the minimal slices MenuRow
// touches via mapStateToProps. Overrides shallow-merge top-level keys
// and deep-merge simpleView/layers for the common test paths.
function createRecordingStore(overrides = {}) {
    const defaults = {
        simpleView: {openMenuGroupId: null, config: {}, selectedCategory: null},
        layers: {flat: [], groups: []},
        gnresource: {initialResource: {perms: []}},
        gnsettings: {geonodeUrl: 'http://localhost'},
        controls: {},
        localConfig: {plugins: {map_viewer: []}},
        security: {user: {pk: 1}},
        anuga: {
            projects: {data: {id: 99, my_role: 'editor'}},
            resources: {},
            ui: {showAnugaInputMenu: false}
        }
    };
    const merged = {
        ...defaults,
        ...overrides,
        simpleView: {...defaults.simpleView, ...(overrides.simpleView || {})},
        layers: {...defaults.layers, ...(overrides.layers || {})}
    };
    const recorded = [];
    return {
        getState: () => merged,
        subscribe: () => () => {},
        dispatch: (a) => {
            // Thunks are unused by the visibility/opacity dispatch paths —
            // both go through plain action creators — but guard for them
            // anyway so a future migration to thunks doesn't crash the
            // test harness silently.
            if (typeof a === 'function') {
                return a(() => {}, () => merged);
            }
            recorded.push(a);
            return a;
        },
        __recorded: () => recorded
    };
}

// Build a layer that satisfies the "visible glyph renders" path. Visibility
// is `true` so clicking the active glyph dispatches `{visibility: false}` —
// matching the fixture's recorded direction.
function makeLayer(category, name, group) {
    return {
        id: `${category.toLowerCase()}-1`,
        name,
        title: `My ${category}`,
        group,
        visibility: true,
        opacity: 1,
        type: 'wms',
        perms: ['change_resourcebase']
    };
}

describe('TASK-1008 (W4) SimpleView Redux action-log parity', () => {

    // ───────────────────────────────────────────────────────────────
    // (A) Fixture schema invariants
    // ───────────────────────────────────────────────────────────────
    describe('Fixture schema invariants (regression guard for captureContext drift)', () => {

        it('captureContext.gmcSha is a string of length >= 7 (W1 ship SHA)', () => {
            expect(typeof fixture.captureContext.gmcSha).toBe('string');
            expect(fixture.captureContext.gmcSha.length).toBeGreaterThanOrEqualTo(7);
        });

        it('captureContext has gmcSha, jobName, projectId, capturedAt, captureMethod, notes', () => {
            const required = ['gmcSha', 'jobName', 'projectId', 'capturedAt', 'captureMethod', 'notes'];
            for (const k of required) {
                expect(fixture.captureContext.hasOwnProperty(k)).toBe(true);
            }
            expect(Array.isArray(fixture.captureContext.notes)).toBe(true);
        });

        it('sequences has exactly 44 keys (11 categories × 4 actions)', () => {
            expect(Object.keys(fixture.sequences).length).toBe(44);
        });

        it('every sequence key matches <Category>.<action> for one of 4 known actions', () => {
            for (const key of Object.keys(fixture.sequences)) {
                const dot = key.indexOf('.');
                expect(dot).toBeGreaterThan(0);
                const cat = key.slice(0, dot);
                const action = key.slice(dot + 1);
                expect(CATEGORIES.includes(cat)).toBe(true);
                expect(ALL_ACTIONS.includes(action)).toBe(true);
            }
        });

        it('every non-null, non-empty sequence entry is an object with a non-empty `type` string', () => {
            for (const seq of Object.values(fixture.sequences)) {
                if (seq === null) continue;
                if (Array.isArray(seq) && seq.length === 0) continue;
                expect(Array.isArray(seq)).toBe(true);
                for (const action of seq) {
                    expect(typeof action).toBe('object');
                    expect(action).toNotBe(null);
                    expect(typeof action.type).toBe('string');
                    expect(action.type.length).toBeGreaterThan(0);
                }
            }
        });

        it('every CHANGE_LAYER_PROPERTIES action has `layer` (NOT `id`) + `newProperties` object — spec correction', () => {
            // MEMORY pin: `CHANGE_LAYER_PROPERTIES uses layer not id`. The
            // gmc action creator (MapStore2/web/client/actions/layers.js:73)
            // returns `{type, newProperties, layer}` — there is no `id`
            // field. Future drift toward an `id`-shaped payload would
            // break every reducer downstream; this is the regression
            // guard.
            let inspected = 0;
            for (const seq of Object.values(fixture.sequences)) {
                if (!Array.isArray(seq)) continue;
                for (const action of seq) {
                    if (action && action.type === 'CHANGE_LAYER_PROPERTIES') {
                        expect(action.hasOwnProperty('layer')).toBe(true);
                        expect(action.hasOwnProperty('id')).toBe(false);
                        expect(typeof action.newProperties).toBe('object');
                        expect(action.newProperties).toNotBe(null);
                        inspected++;
                    }
                }
            }
            // Sanity: at least the toggleVisibility/opacityDrag sequences
            // for the 7 categories with rows produce CHANGE_LAYER_PROPERTIES.
            expect(inspected).toBeGreaterThanOrEqualTo(7);
        });
    });

    // ───────────────────────────────────────────────────────────────
    // (B) Filter rule unit tests
    // ───────────────────────────────────────────────────────────────
    describe('filter() rules (per the W1 capture filter spec)', () => {

        it('filters `layer` field value regardless of shape', () => {
            expect(filter({layer: 'geonode:bdy_11557_x'})).toEqual({layer: '<filtered>'});
        });

        it('normalises `opacity` numeric values to <numeric> (pixel-rounding tolerance)', () => {
            expect(filter({opacity: 0.62})).toEqual({opacity: '<numeric>'});
        });

        it('leaves booleans inside newProperties unchanged', () => {
            expect(filter({newProperties: {visibility: false}})).toEqual({
                newProperties: {visibility: false}
            });
        });

        it('recursively filters arrays of actions and matches geonode:<prefix>_<id>_ layer-name pattern', () => {
            expect(filter([{type: 'X', layer: 'geonode:y_1_z'}])).toEqual([{
                type: 'X',
                layer: '<filtered>'
            }]);
        });
    });

    // ───────────────────────────────────────────────────────────────
    // (C) Simple-action replay — toggleVisibility for 3 categories
    // ───────────────────────────────────────────────────────────────
    describe('Replay: toggleVisibility click dispatches the fixture-matching action', () => {

        let container;

        beforeEach((done) => {
            document.body.innerHTML = '<div id="container"></div>';
            container = document.getElementById('container');
            setTimeout(done);
        });

        afterEach((done) => {
            ReactDOM.unmountComponentAtNode(container);
            document.body.innerHTML = '';
            setTimeout(done);
        });

        // Helper: render a MenuRow inside a recording store, click the
        // visibility glyph, filter the recorded actions, and compare to
        // the filtered fixture entry. Returns void; assertions are
        // inside.
        function runToggleVisibilityReplay(category, layer, done) {
            const fixtureKey = `${category}.toggleVisibility`;
            const expectedRaw = fixture.sequences[fixtureKey];
            // Skip categories that have no row in the source project.
            // The fixture documents these gaps explicitly.
            if (expectedRaw === null) {
                done();
                return;
            }
            const expected = filter(expectedRaw);
            const store = createRecordingStore();
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    // Visibility glyph uses .sv-glyph-active when visibility===true.
                    // It is the FIRST glyph in the locked 4-icon toolbar
                    // (vis | zoom | edit | delete).
                    const visGlyph = container.querySelector('.menu-row-glyph.sv-glyph-active');
                    expect(visGlyph).toExist();
                    visGlyph.click();
                    const recorded = store.__recorded()
                        .filter(a => a && a.type === 'CHANGE_LAYER_PROPERTIES')
                        .map(filter);
                    expect(recorded).toEqual(expected);
                    done();
                }
            );
        }

        it('Terrain.toggleVisibility — recorded action matches filtered fixture entry', (done) => {
            runToggleVisibilityReplay('Terrain',
                makeLayer('Terrain', 'geonode:ele_11557_terrain_01', 'Input Data.Terrain'),
                done);
        });

        it('Boundary.toggleVisibility — recorded action matches filtered fixture entry', (done) => {
            runToggleVisibilityReplay('Boundary',
                makeLayer('Boundary', 'geonode:bdy_11557_boundary_01', 'Input Data.Boundaries'),
                done);
        });

        it('Inflow.toggleVisibility — recorded action matches filtered fixture entry', (done) => {
            runToggleVisibilityReplay('Inflow',
                makeLayer('Inflow', 'geonode:inf_11557_inflow_01', 'Input Data.Inflows'),
                done);
        });
    });

    // ───────────────────────────────────────────────────────────────
    // (C-2) Structural assertion for opacityDrag — replay skipped per
    // JSDOM limitation, but we pin the fixture-side shape so a future
    // capture-format change still trips CI.
    // ───────────────────────────────────────────────────────────────
    describe('Replay: opacityDrag (JSDOM-skipped — structural assertion only)', () => {

        it('Terrain.opacityDrag fixture entry is a CHANGE_LAYER_PROPERTIES.opacity action', () => {
            const seq = fixture.sequences['Terrain.opacityDrag'];
            expect(Array.isArray(seq)).toBe(true);
            expect(seq.length).toBeGreaterThanOrEqualTo(1);
            const last = seq[seq.length - 1];
            expect(last.type).toBe('CHANGE_LAYER_PROPERTIES');
            expect(typeof last.newProperties.opacity).toBe('number');
        });

        // Limitation: nouislider's `change` event does not fire under
        // JSDOM (no real mouse event sequence on the slider handle).
        // Driving the onChange prop via fiber inspection would be
        // brittle. Live replay covered by the orchestrator's localhost
        // smoke step.
        xit('Terrain.opacityDrag live click-drag replay — JSDOM no real mouse events; covered by localhost smoke', () => {});
    });

    // ───────────────────────────────────────────────────────────────
    // (D) Skipped-sequence inventory — fixture invariants
    // ───────────────────────────────────────────────────────────────
    describe('Skipped-sequence inventory (raster early-return + React-local state)', () => {

        it('Terrain.pencilClick is null (rasters early-return at simpleViewMenuRow.js:439)', () => {
            // Terrain is a raster → `cfg.geomType === 'Raster'` → onEdit
            // returns immediately with no Redux dispatch. The fixture
            // records this as explicit null (not []) so consumers
            // distinguish "no row in project" from "row exists but no
            // Redux dispatch by design".
            expect(fixture.sequences['Terrain.pencilClick']).toBe(null);
        });

        it('every *.trashConfirm sequence is [] (React local state, not Redux)', () => {
            // The trash glyph opens a confirm overlay via
            // `this.setState({deleteConfirmVisible: true})` — no Redux
            // dispatch fires until the user clicks the Delete confirm
            // button. The fixture records the "open confirm" step only
            // (clicking trash, NOT clicking confirm), so every
            // *.trashConfirm key is [] by design.
            for (const cat of CATEGORIES) {
                const key = `${cat}.trashConfirm`;
                const seq = fixture.sequences[key];
                // Either [] (row exists) or null (no row in project) — both
                // are "no Redux activity from clicking trash open".
                if (seq === null) continue;
                expect(Array.isArray(seq)).toBe(true);
                expect(seq.length).toBe(0);
            }
        });
    });
});
