import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import {
    getAnugaPrefix,
    ANUGA_FEATURE_CONFIG,
    MenuRow
} from '../components/simpleViewMenuRow';
import { SET_OPEN_MENU_GROUP_ID } from '../actionsSimpleView';
import { START_VECTOR_DRAW } from '../../VectorDraw/actionsVectorDraw';
import { SET_ANUGA_INPUT_MENU } from '../../Anuga/actions/uiActions';

/**
 * TASK-793 — Pure-function unit tests for the migrated-prefix routing
 * helper + ANUGA_FEATURE_CONFIG map shape. These exercise the routing
 * logic without standing up a connected-component / Provider tree.
 *
 * The routing decision is: layer.name → prefix (or null) → either the
 * VectorDraw path (5 migrated prefixes) or the legacy FeatureGrid path
 * (terrain_/ele_/cat_/nod_/lin_/full_mesh_/network_).
 *
 * BE-casing is load-bearing — the legacy prePopulate epic used wrong
 * casing (lowercase) for years which silently dropped values; the
 * VectorDraw migration is the moment that bug is fixed. We assert
 * field-name casing per BE here so future drift causes a CI failure.
 */
describe('TASK-793 SimpleView MenuRow routing', () => {

    describe('getAnugaPrefix', () => {
        // Migrated prefixes
        it('returns "bdy_" for geonode:bdy_4_my_boundary', () => {
            expect(getAnugaPrefix('geonode:bdy_4_my_boundary')).toBe('bdy_');
        });
        it('returns "inf_" for geonode:inf_4_test', () => {
            expect(getAnugaPrefix('geonode:inf_4_test')).toBe('inf_');
        });
        it('returns "fri_" for geonode:fri_4_x', () => {
            expect(getAnugaPrefix('geonode:fri_4_x')).toBe('fri_');
        });
        it('returns "mes_" for geonode:mes_4_x', () => {
            expect(getAnugaPrefix('geonode:mes_4_x')).toBe('mes_');
        });
        it('returns "str_" for geonode:str_4_x', () => {
            expect(getAnugaPrefix('geonode:str_4_x')).toBe('str_');
        });

        // Non-migrated prefixes — must return null so the legacy
        // FeatureGrid path is taken.
        it('returns null for geonode:cat_4_x (catchment, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:cat_4_x')).toBe(null);
        });
        it('returns null for geonode:nod_4_x (nodes, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:nod_4_x')).toBe(null);
        });
        it('returns null for geonode:lin_4_x (links, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:lin_4_x')).toBe(null);
        });
        it('returns null for geonode:ele_4_dem (terrain alias, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:ele_4_dem')).toBe(null);
        });
        it('returns null for geonode:terrain_4_x (NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:terrain_4_x')).toBe(null);
        });

        // Edge cases
        it('returns null for null', () => {
            expect(getAnugaPrefix(null)).toBe(null);
        });
        it('returns null for undefined', () => {
            expect(getAnugaPrefix(undefined)).toBe(null);
        });
        it('returns null for empty string', () => {
            expect(getAnugaPrefix('')).toBe(null);
        });
        it('returns "bdy_" for bdy_4_my_boundary (no geonode: prefix)', () => {
            expect(getAnugaPrefix('bdy_4_my_boundary')).toBe('bdy_');
        });
    });

    describe('ANUGA_FEATURE_CONFIG geomType', () => {
        it('bdy_ → LineString', () => {
            expect(ANUGA_FEATURE_CONFIG.bdy_.geomType).toBe('LineString');
        });
        it('inf_ → LineString', () => {
            expect(ANUGA_FEATURE_CONFIG.inf_.geomType).toBe('LineString');
        });
        it('fri_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.fri_.geomType).toBe('Polygon');
        });
        it('mes_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.mes_.geomType).toBe('Polygon');
        });
        it('str_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.str_.geomType).toBe('Polygon');
        });
    });

    describe('ANUGA_FEATURE_CONFIG GeoServer-casing (TASK-794 — all lowercase to match WFS DescribeFeatureType)', () => {
        // TASK-794 fix: every prefix uses lowercase `name` keys to match
        // what GeoServer's WFS DescribeFeatureType returns. PostGIS lower-
        // cases unquoted column identifiers, so the BE Python
        // attributes_template's Title-case names (Boundary, Mannings,
        // Method, Resolution, Description, Location) round-trip back as
        // lowercase. Pre-fix the 4 non-inflow prefixes used Title-case
        // `name` keys → MapStore's RequestBuilder filtered them out
        // because `Object.keys(properties).filter(k => getPropertyDescriptor(k, describe))`
        // requires an exact-case match → POST body had only the_geom →
        // PostGIS attributes landed NULL → picker fell through to the
        // feature-id fallback. Inflow happened to match by accident.
        //
        // These tests pin the lowercase invariant so future regressions
        // (e.g. someone copy-pasting the BE template) fail loud in CI.
        const allLowercase = (fields) => fields.every(f => f.name === f.name.toLowerCase());

        it('bdy_ field names are all lowercase', () => {
            const fields = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields;
            expect(allLowercase(fields)).toBe(true);
        });

        it('fri_ field names are all lowercase', () => {
            const fields = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields;
            expect(allLowercase(fields)).toBe(true);
        });

        it('str_ field names are all lowercase', () => {
            const fields = ANUGA_FEATURE_CONFIG.str_.formConfig.fields;
            expect(allLowercase(fields)).toBe(true);
        });

        it('mes_ field names are all lowercase', () => {
            const fields = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields;
            expect(allLowercase(fields)).toBe(true);
        });

        it('inf_ field names are all lowercase (matches BE template + GeoServer)', () => {
            const fields = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields;
            expect(allLowercase(fields)).toBe(true);
        });

        // Per-prefix exact-name spot-checks against the GeoServer schema
        // verified via curl on 2026-05-09.
        it('bdy_ exposes [description, boundary, location, data] in that order', () => {
            const names = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.map(f => f.name);
            expect(names).toEqual(['description', 'boundary', 'location', 'data']);
        });

        it('fri_ exposes [description, mannings] in that order', () => {
            const names = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields.map(f => f.name);
            expect(names).toEqual(['description', 'mannings']);
        });

        it('str_ exposes [description, method] in that order', () => {
            const names = ANUGA_FEATURE_CONFIG.str_.formConfig.fields.map(f => f.name);
            expect(names).toEqual(['description', 'method']);
        });

        it('mes_ exposes [description, resolution] in that order', () => {
            const names = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields.map(f => f.name);
            expect(names).toEqual(['description', 'resolution']);
        });

        it('inf_ exposes [description, type, data] in that order', () => {
            const names = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields.map(f => f.name);
            expect(names).toEqual(['description', 'type', 'data']);
        });
    });

    describe('ANUGA_FEATURE_CONFIG "Title" relabel + first-field order (TASK-784 polish + TASK-794 lowercasing)', () => {
        // The user-visible label "Title" is the TASK-784 polish change. The
        // BE column name is `description` (lowercase, per TASK-794 fix —
        // GeoServer's WFS DescribeFeatureType returns lowercase regardless
        // of the BE Python attributes_template casing). Assert: each
        // prefix's FIRST form field is the lowercase `description` column
        // AND its user-visible label is "Title". The picker label fallback
        // (VectorDrawPopup.featureLabel) reads both casings so legacy
        // historical rows that did happen to land Title-case in PostGIS
        // also display.
        it('bdy_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
        it('fri_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
        it('mes_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
        it('str_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.str_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
        it('inf_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
    });

    /**
     * TASK-784 polish — pencil click on a migrated prefix must close the
     * AnugaInputMenu side panel (state.anuga.ui.showAnugaInputMenu) so the
     * VectorDraw popup is the focus, while leaving the toolbar buttons
     * (rendered by AnugaContainer in a portal into .simple-view-left-toolbar)
     * visible. The toolbar is not gated by either openMenuGroupId or
     * showAnugaInputMenu, so as long as we don't dispatch anything that
     * removes/hides AnugaContainer or the toolbar portal target, it stays.
     *
     * Bug history: Round-1 introduced a brand-new visibleSimpleViewSidePanel
     * slice + container style guard that hid the toolbar too. Round-2
     * reverted to relying on setOpenMenuGroupId(null), but that targets a
     * DIFFERENT slice (state.simpleView.openMenuGroupId) — it controls the
     * non-Anuga SimpleView menu-groups panel in simpleViewContainer.js, not
     * AnugaInputMenu. Anuga's uiReducer's SET_OPEN_MENU_GROUP_ID case is a
     * no-op when the value is null/falsy, so showAnugaInputMenu stayed true
     * → panel stayed visible. The fix dispatches setAnugaInputMenu(false)
     * alongside setOpenMenuGroupId(null) so each panel closes via its own
     * slice.
     */
    describe('TASK-784 pencil click closes the inputs side panel (migrated prefix)', () => {
        let container;

        // Helper: build a mock store that records every dispatched action
        // into a shared array so the test can assert on them.
        const buildRecordingStore = (overrides = {}) => {
            const dispatched = [];
            const defaults = {
                simpleView: { openMenuGroupId: 'Input Data', config: {} },
                layers: { flat: [], groups: [] },
                gnresource: { initialResource: { perms: ['change_resourcebase'] } },
                gnsettings: { geonodeUrl: 'http://localhost' },
                controls: {},
                localConfig: { plugins: { map_viewer: [] } },
                security: { user: { pk: 1 } },
                anuga: {
                    projects: { data: { id: 99, my_role: 'editor' } },
                    resources: { boundaries: [] },
                    ui: { showAnugaInputMenu: true }
                }
            };
            const merged = { ...defaults, ...overrides };
            return {
                getState: () => merged,
                subscribe: () => {},
                dispatch: (action) => { dispatched.push(action); return action; },
                _dispatched: dispatched
            };
        };

        // Layer that satisfies canEditLayer (perms include change_dataset_data
        // + change_resourcebase) so the pencil glyph is rendered.
        const makeBoundaryLayer = () => ({
            id: 'l-1',
            name: 'geonode:bdy_99_my_boundary',
            title: 'My Boundary',
            group: 'Input Data.Boundaries',
            visibility: true,
            opacity: 1,
            type: 'wms',
            perms: ['change_dataset_data', 'change_resourcebase']
        });

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

        it('pencil click on bdy_ layer dispatches setAnugaInputMenu(false) to close AnugaInputMenu side panel', (done) => {
            const store = buildRecordingStore();
            const layer = makeBoundaryLayer();
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const pencil = container.querySelector('.glyphicon-pencil');
                    expect(pencil).toExist();
                    pencil.click();
                    const setAnugaInputMenuActions = store._dispatched.filter(
                        a => a && a.type === SET_ANUGA_INPUT_MENU
                    );
                    expect(setAnugaInputMenuActions.length).toBe(1);
                    expect(setAnugaInputMenuActions[0].visible).toBe(false);
                    done();
                }
            );
        });

        it('pencil click on bdy_ layer also dispatches setOpenMenuGroupId(null) (defensive: closes non-Anuga SimpleView panel too)', (done) => {
            const store = buildRecordingStore();
            const layer = makeBoundaryLayer();
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const pencil = container.querySelector('.glyphicon-pencil');
                    pencil.click();
                    const setOpenActions = store._dispatched.filter(
                        a => a && a.type === SET_OPEN_MENU_GROUP_ID
                    );
                    expect(setOpenActions.length).toBe(1);
                    expect(setOpenActions[0].openMenuGroupId).toBe(null);
                    done();
                }
            );
        });

        it('pencil click on bdy_ layer starts VectorDraw flow (migrated path is taken)', (done) => {
            const store = buildRecordingStore();
            const layer = makeBoundaryLayer();
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const pencil = container.querySelector('.glyphicon-pencil');
                    pencil.click();
                    const startActions = store._dispatched.filter(
                        a => a && a.type === START_VECTOR_DRAW
                    );
                    expect(startActions.length).toBe(1);
                    expect(startActions[0].config.layerName).toBe('geonode:bdy_99_my_boundary');
                    expect(startActions[0].config.geomType).toBe('LineString');
                    done();
                }
            );
        });

        it('pencil click on a migrated prefix does NOT toggle AnugaContainer toolbar (no setNetworkMenu/setReviewPanel/setPublicationPanel/setMembershipPanel/setAnugaScenarioMenu/setAnugaResultMenu)', (done) => {
            // The toolbar buttons in AnugaContainer.renderToolbarButtons are
            // visible whenever AnugaContainer renders (gated only by
            // isAnugaProject + per-button capability flags). They are NOT
            // controlled by showAnugaInputMenu / openMenuGroupId. The only
            // way to hide the toolbar would be to dispatch something that
            // unmounts AnugaContainer (isAnugaProject change) or to clear
            // capability flags — neither of which the pencil handler does.
            // This test asserts the pencil dispatches NONE of the unrelated
            // panel-toggle actions that would cascade into the Anuga
            // uiReducer and unintentionally affect adjacent panels.
            const store = buildRecordingStore();
            const layer = makeBoundaryLayer();
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const pencil = container.querySelector('.glyphicon-pencil');
                    pencil.click();
                    const stranglerTypes = [
                        'SET_NETWORK_MENU',
                        'SET_REVIEW_PANEL',
                        'SET_PUBLICATION_PANEL',
                        'SET_MEMBERSHIP_PANEL',
                        'SET_ANUGA_SCENARIO_MENU',
                        'SET_ANUGA_RESULT_MENU'
                    ];
                    const stragglers = store._dispatched.filter(
                        a => a && stranglerTypes.includes(a.type)
                    );
                    expect(stragglers.length).toBe(0);
                    done();
                }
            );
        });
    });

    /**
     * TASK-795 — Time-boundary value picker is the new compound widget.
     * The bdy_ `data` field's TYPE changed from 'text' to 'time-data-picker',
     * and it carries a `showWhen` predicate so it only renders when the
     * boundary type is 'Time'. The legacy bare `data` text field is GONE
     * for new writes (BE keeps the column for back-compat reads only).
     */
    describe('TASK-795 bdy_ data field is a time-data-picker (legacy bare text field removed)', () => {
        it('bdy_ data field type is "time-data-picker" (NOT "text")', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'data');
            expect(f).toExist();
            expect(f.type).toBe('time-data-picker');
            // Regression guard against re-introducing the legacy bare text
            // field — the BE no longer accepts plain `data` writes for
            // Time boundaries.
            expect(f.type).toNotBe('text');
        });

        it('bdy_ data field carries showWhen { field: "boundary", equals: "Time" }', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'data');
            expect(f.showWhen).toEqual({ field: 'boundary', equals: 'Time' });
        });

        it('inf_ data field is still plain text (TASK-795 only touched bdy_)', () => {
            // Inflow boundary type ALSO uses the legacy bare `data` column
            // and still needs free-text input (TimeSeries name OR numeric
            // string per scenario.py:399-404). TASK-795 deliberately did
            // NOT touch inf_ — only bdy_ migrated to the compound widget.
            const f = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields.find(x => x.name === 'data');
            expect(f).toExist();
            expect(f.type).toBe('text');
            expect(f.showWhen).toBe(undefined);
        });

        it('non-bdy prefixes (fri_, mes_, str_) have no data field', () => {
            // Friction/Mesh-Region/Structure don't use the `data` column
            // at all — the per-feature WFS schema for each is
            // [the_geom, description, <one numeric or string method col>].
            ['fri_', 'mes_', 'str_'].forEach(prefix => {
                const fields = ANUGA_FEATURE_CONFIG[prefix].formConfig.fields;
                const dataField = fields.find(x => x.name === 'data');
                expect(dataField).toBe(undefined);
            });
        });
    });

    describe('ANUGA_FEATURE_CONFIG defaults', () => {
        it('bdy_ boundary default is "Dirichlet"', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'boundary');
            expect(f.default).toBe('Dirichlet');
        });
        it('bdy_ location default is "External"', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'location');
            expect(f.default).toBe('External');
        });
        it('fri_ mannings default is 0.035', () => {
            const f = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields.find(x => x.name === 'mannings');
            expect(f.default).toBe(0.035);
        });
        it('mes_ resolution default is 10', () => {
            const f = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields.find(x => x.name === 'resolution');
            expect(f.default).toBe(10);
        });
        it('str_ method default is "Holes"', () => {
            const f = ANUGA_FEATURE_CONFIG.str_.formConfig.fields.find(x => x.name === 'method');
            expect(f.default).toBe('Holes');
        });
        it('inf_ type default is "Rainfall"', () => {
            const f = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields.find(x => x.name === 'type');
            expect(f.default).toBe('Rainfall');
        });
    });

    // Regression guard: text→select restoration. Originally a FeatureGrid
    // dropdown, both fields got flattened to plain text inputs during the
    // VectorDraw migration (commit 823df8c9b). Restored as `select` widgets
    // 2026-05-12 so users can no longer type free-form values the engine
    // doesn't understand.
    describe('ANUGA_FEATURE_CONFIG select-widget regressions restored', () => {
        it('inf_ type is a select with Rainfall and Surface', () => {
            const f = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields.find(x => x.name === 'type');
            expect(f.type).toBe('select');
            const values = (f.options || []).map(o => o.value);
            expect(values).toEqual(['Rainfall', 'Surface']);
        });
        it('str_ method is a select with Holes, Mannings, Reflective', () => {
            const f = ANUGA_FEATURE_CONFIG.str_.formConfig.fields.find(x => x.name === 'method');
            expect(f.type).toBe('select');
            const values = (f.options || []).map(o => o.value);
            expect(values).toEqual(['Holes', 'Mannings', 'Reflective']);
        });
    });
});
