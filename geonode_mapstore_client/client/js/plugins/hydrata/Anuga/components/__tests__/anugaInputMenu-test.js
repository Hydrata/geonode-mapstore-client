/*
 * V2P-22 — anugaInputMenu.js per-role exact-button-set assertion.
 *
 * The InputMenu has section-level "+" / "✓" create buttons (one per resource
 * type) that are gated on `canEditAnugaMap` from the V2P-02 selector chain.
 * Per-row CRUD glyphs delegate to <MenuRow> (= simpleViewMenuRow.js, already
 * V2P-02 wired). This file pins the section-level matrix.
 *
 * Roles:
 *   owner / manager / editor : full create-set across all resource types
 *   contributor              : NO create buttons (canEditAnugaMap excludes
 *                              contributor by design — contributors edit
 *                              existing resources they own, but resource
 *                              creation requires editor+ in selectorsAnuga.js
 *                              line 21). This is the documented Anuga gate.
 *   viewer                   : no create buttons
 *   anon                     : no create buttons (myRole=null)
 *
 * Notes:
 *   - With the TASK-1004 rail+pane Miller layout (W3/W4-plus), only one
 *     category pane is visible at a time. The test navigates the rail to
 *     each role-gated category (boundaries / inflows / rainfalls) and
 *     reads the `.anuga-pane-toolbar` for `.glyph-active.glyphicon-plus`.
 *     The same canEditAnugaMap gate is shared by every InputSection-style
 *     pane, so probing those three is sufficient to pin the matrix.
 *   - Each create button uses class .glyph-active per renderCreateControls.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { makeAnugaResourceState } from '../../__tests__/fixtures/anugaState';

function createMockStore({ role = 'viewer', layerCount = 0 } = {}) {
    const resources = makeAnugaResourceState(role, layerCount);
    const state = {
        anuga: {
            resources,
            projects: {
                data: {
                    id: 42,
                    my_role: role === 'anon' ? null : role,
                    projection: 'EPSG:32756'  // truthy → top-level Boundary/Inflow sections render
                }
            },
            ui: { isCreatingAnugaLayer: false }
        },
        layers: { flat: [], groups: [] },
        security: { user: { pk: 9999 } },
        gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
        controls: {},
        localConfig: { plugins: {} }
    };
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

describe('V2P-22 anugaInputMenu role-gated create buttons', () => {
    let container;

    // EXACT button set per role (top-level sections only, advanced collapsed).
    // Buttons present at the section header are:
    //   - terrain upload glyph (.glyphicon-upload, ALWAYS present — no role gate)
    //   - boundaries "+" / "✓" create button (canEditAnugaMap gate)
    //   - inflows "+" / "✓" create button (canEditAnugaMap gate)
    //   - rainfall "+" / "✓" create button (canEditAnugaMap gate) — TASK-955
    //   - "showAdvanced" cog glyph (always present — no role gate)
    //
    // We assert the SET of role-gated create-buttons. Always-present glyphs
    // are in every render and thus orthogonal to the gate.
    const expectedCreateButtons = {
        // canEditAnugaMap === [owner, manager, editor]
        // TASK-955 (W2.2 FE) — Rainfall InputSection adds 'rainfall-create' to
        // the gated create-button set; same canEditAnugaMap gate as Inflow.
        owner: ['boundary-create', 'inflow-create', 'rainfall-create'],
        manager: ['boundary-create', 'inflow-create', 'rainfall-create'],
        editor: ['boundary-create', 'inflow-create', 'rainfall-create'],
        contributor: [],  // canEditAnugaMap excludes contributor (writes only to own resources via Scenario flow)
        viewer: [],
        anon: []
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mountMenu(opts) {
        const { AnugaInputMenu } = require('../anugaInputMenu');
        const store = createMockStore(opts);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><AnugaInputMenu /></Provider>,
                container,
                () => resolve(container)
            );
        });
    }

    function readCreateButtonSet() {
        // TASK-1004 W4-plus rail+pane Miller layout — only ONE category
        // pane is visible at a time (the one matching rail-state
        // selectedCategory). Walk each role-gated rail item, click it to
        // mount the pane, and probe the visible .anuga-pane-toolbar for the
        // `.glyph-active.glyphicon-plus` create button.
        const targets = [
            {railId: 'boundaries', label: 'boundary-create'},
            {railId: 'inflows', label: 'inflow-create'},
            {railId: 'rainfalls', label: 'rainfall-create'}
        ];
        const buttons = [];
        for (const t of targets) {
            const rail = container.querySelector(`[data-anuga-category="${t.railId}"]`);
            if (!rail) continue;
            rail.click(); // React 16 setState in event handler flushes synchronously
            const toolbar = container.querySelector('.anuga-pane-toolbar');
            if (!toolbar) continue;
            if (toolbar.querySelector('.glyph-active.glyphicon-plus')) {
                buttons.push(t.label);
            }
        }
        return buttons.sort();
    }

    Object.entries(expectedCreateButtons).forEach(([role, expectedButtons]) => {
        const expectedLabel = expectedButtons.length ? expectedButtons.join(',') : '(none)';
        it(`role=${role} renders exactly create buttons: ${expectedLabel}`, () => {
            return mountMenu({ role, layerCount: 0 }).then(() => {
                expect(readCreateButtonSet()).toEqual(expectedButtons.slice().sort());
            });
        });
    });

    it('terrain upload glyph always renders independent of role (panel-level upload)', () => {
        return mountMenu({ role: 'viewer', layerCount: 0 }).then(() => {
            // The terrain section's upload glyph is ALWAYS present, by
            // design (read-only viewers can navigate to the uploader form;
            // the form itself enforces the perm via canEditMap on submit).
            // Re-read this assertion every change to InputSection's gate.
            const upload = container.querySelector('.glyphicon-upload');
            expect(upload).toExist();
        });
    });
});

// ── TASK-1652 (W1.5): Terrain hierarchy _buildTerrainGroups unit tests ─────
//
// These tests exercise the terrain-grouping logic in isolation using a minimal
// mock of the class instance's `props` shape, without a full React render.
// The algorithm under test:
//   • Each terrainModel with a matching terrainLayer → { terrain, demLayer, hillshadeLayer }
//   • Hillshade layers are excluded from parent-row candidates
//   • Unmatched layers (analysis surface outputs, etc.) → { terrain:null, demLayer, hillshadeLayer:null }
import { AnugaInputMenuClass } from '../anugaInputMenu';

function buildGroupsWithProps({ terrainLayers = [], terrainModels = [] } = {}) {
    // Directly invoke the instance method with a mock `this.props`.
    const instance = Object.create(AnugaInputMenuClass.prototype);
    instance.props = { terrainLayers, terrainModels };
    return instance._buildTerrainGroups();
}

describe('TASK-1652 _buildTerrainGroups terrain hierarchy grouping', () => {
    it('empty inputs produce empty groups', () => {
        const groups = buildGroupsWithProps();
        expect(groups).toEqual([]);
    });

    it('single terrain with hillshade groups them together', () => {
        const terrainModels = [
            { id: 1, title: 'GLO-30', gn_layer_name: 'glo30_utm', gn_layer_hillshade_name: 'glo30_hillshade' }
        ];
        const terrainLayers = [
            { id: 'l1', name: 'glo30_utm', title: 'GLO-30 DEM', group: 'Input Data.Terrain' },
            { id: 'l2', name: 'glo30_hillshade', title: 'GLO-30 Hillshade', group: 'Input Data.Terrain' }
        ];
        const groups = buildGroupsWithProps({ terrainLayers, terrainModels });
        expect(groups.length).toBe(1);
        expect(groups[0].terrain.id).toBe(1);
        expect(groups[0].demLayer.name).toBe('glo30_utm');
        expect(groups[0].hillshadeLayer.name).toBe('glo30_hillshade');
    });

    it('terrain without hillshade has hillshadeLayer null', () => {
        const terrainModels = [
            { id: 2, title: 'Uploaded DEM', gn_layer_name: 'user_dem', gn_layer_hillshade_name: null }
        ];
        const terrainLayers = [
            { id: 'l3', name: 'user_dem', title: 'User DEM', group: 'Input Data.Terrain' }
        ];
        const groups = buildGroupsWithProps({ terrainLayers, terrainModels });
        expect(groups.length).toBe(1);
        expect(groups[0].hillshadeLayer).toBe(null);
    });

    it('unmatched layers (analysis surface outputs) appear as parent rows', () => {
        const terrainModels = [
            { id: 3, title: 'GLO-30', gn_layer_name: 'glo30_utm', gn_layer_hillshade_name: null }
        ];
        const terrainLayers = [
            { id: 'l4', name: 'glo30_utm', title: 'GLO-30', group: 'Input Data.Terrain' },
            { id: 'l5', name: 'design_dem_surface_1', title: 'Design DEM', group: 'Input Data.Terrain' }
        ];
        const groups = buildGroupsWithProps({ terrainLayers, terrainModels });
        expect(groups.length).toBe(2);
        // First group: the terrain model row
        expect(groups[0].terrain.id).toBe(3);
        expect(groups[0].demLayer.name).toBe('glo30_utm');
        // Second group: unmatched layer (analysis surface) as standalone parent
        expect(groups[1].terrain).toBe(null);
        expect(groups[1].demLayer.name).toBe('design_dem_surface_1');
        expect(groups[1].hillshadeLayer).toBe(null);
    });

    // BUG-5 (UAT 2026-06-16): the dead "Switch to Dynamic" button.
    // gn_layer_name is the BARE GeoNode dataset name, but a map layer's `name`
    // can carry the 'geonode:' workspace prefix. The old strict equality match
    // resolved demLayer=null for namespaced layers → the parent row showed the
    // pending placeholder and the Mode toggle (gated only on terrainModel.id)
    // no-opped on click because _handleTerrainStylingModeChange early-returns
    // when mapLayer.id is missing. _buildTerrainGroups must match either form.
    it('BUG-5: namespaced map layer name (geonode:<name>) resolves the DEM layer', () => {
        const terrainModels = [
            { id: 5, title: 'GLO-30', gn_layer_name: 'glo30_utm', gn_layer_hillshade_name: 'glo30_hillshade' }
        ];
        const terrainLayers = [
            { id: 'l1', name: 'geonode:glo30_utm', title: 'GLO-30 DEM', group: 'Input Data.Terrain' },
            { id: 'l2', name: 'geonode:glo30_hillshade', title: 'GLO-30 Hillshade', group: 'Input Data.Terrain' }
        ];
        const groups = buildGroupsWithProps({ terrainLayers, terrainModels });
        expect(groups.length).toBe(1);
        // demLayer must resolve (NOT null) — the dead-button precondition.
        expect(groups[0].demLayer).toExist();
        expect(groups[0].demLayer.id).toBe('l1');
        expect(groups[0].hillshadeLayer).toExist();
        expect(groups[0].hillshadeLayer.id).toBe('l2');
        // The namespaced hillshade must NOT also appear as a standalone parent row.
        expect(groups.length).toBe(1);
    });

    it('hillshade layers are excluded from unmatched (parent) candidates', () => {
        // If a terrain model has a hillshade, that hillshade should NOT appear
        // as a standalone parent row even if it appears in terrainLayers.
        const terrainModels = [
            { id: 4, title: 'DEM-A', gn_layer_name: 'dem_a', gn_layer_hillshade_name: 'dem_a_hs' }
        ];
        const terrainLayers = [
            { id: 'l6', name: 'dem_a', title: 'DEM A', group: 'Input Data.Terrain' },
            { id: 'l7', name: 'dem_a_hs', title: 'DEM A Hillshade', group: 'Input Data.Terrain' }
        ];
        const groups = buildGroupsWithProps({ terrainLayers, terrainModels });
        // Only 1 group — hillshade is nested, not a standalone parent.
        expect(groups.length).toBe(1);
        expect(groups[0].hillshadeLayer.name).toBe('dem_a_hs');
    });

    it('reorder: splice-remove-insert produces correct new ordering', () => {
        // Test the reorder logic (mirrors the onReorderTerrainLayers handler).
        const groups = [
            { terrain: { id: 1 }, demLayer: { id: 'l1', name: 'dem1' }, hillshadeLayer: null },
            { terrain: { id: 2 }, demLayer: { id: 'l2', name: 'dem2' }, hillshadeLayer: { id: 'l2hs', name: 'dem2_hs' } },
            { terrain: { id: 3 }, demLayer: { id: 'l3', name: 'dem3' }, hillshadeLayer: null }
        ];
        // Move index 2 (dem3) to index 0 (before dem1).
        const reordered = groups.slice();
        const [moved] = reordered.splice(2, 1);
        reordered.splice(0, 0, moved);
        expect(reordered.map(g => g.demLayer.name)).toEqual(['dem3', 'dem1', 'dem2']);

        // Verify desiredIds (DEM + hillshade flat) matches expected new layer order.
        const desiredIds = [];
        reordered.forEach(group => {
            if (group.demLayer) desiredIds.push(group.demLayer.id);
            if (group.hillshadeLayer) desiredIds.push(group.hillshadeLayer.id);
        });
        expect(desiredIds).toEqual(['l3', 'l1', 'l2', 'l2hs']);

        // Verify sortNode index computation from currentNodes → desiredIds.
        // currentNodes (order before drag): [l1, l2, l2hs, l3]
        const currentNodes = [{id: 'l1'}, {id: 'l2'}, {id: 'l2hs'}, {id: 'l3'}];
        const order = desiredIds
            .map(id => currentNodes.findIndex(n => n.id === id))
            .filter(idx => idx !== -1);
        // sortNode reorderedNodes = order.map(idx => nodes[idx])
        // order = [3, 0, 1, 2] → nodes[3]=l3, nodes[0]=l1, nodes[1]=l2, nodes[2]=l2hs
        expect(order).toEqual([3, 0, 1, 2]);
        const sortedNodes = order.map(idx => currentNodes[idx]);
        expect(sortedNodes.map(n => n.id)).toEqual(['l3', 'l1', 'l2', 'l2hs']);
    });
});

// ---------------------------------------------------------------------------
// TASK-1721 (W4 review FIX D): contours toggle reload-desync regression test.
//
// After a page reload, this.state.contoursEnabled is reset to {}.  If the
// toggle reads `this.state` to determine the current enabled state it will
// ALWAYS see false → always take the "enable" branch → add a DUPLICATE
// contour layer on "Hide Contours" click.
//
// The fix passes the DERIVED `contoursEnabled` value (computed from flatLayers
// by renderTerrainPane) as the second argument to _handleContoursToggle, so
// the handler uses the authoritative value from the map, not the stale local
// state.
//
// This test mounts the unconnected AnugaInputMenuClass (bypasses connect())
// with a contour layer already present in flatLayers (simulating post-reload
// state), and verifies that clicking the toggle fires onRemoveLayer
// (NOT onAddContourLayer).
// ---------------------------------------------------------------------------

describe('TASK-1721 anugaInputMenu contours toggle reload-desync (FIX D)', () => {
    let container;

    const DEM_LAYER_NAME = 'ele_7_grand_canyon_cog';
    const CONTOUR_LAYER_ID = `${DEM_LAYER_NAME}__contours`;
    const DEM_CONTOUR_STYLE_NAME_FIXD = 'dem_contours';

    // Minimal terrain model with a gn_layer_name so the contour toggle renders.
    const terrainModel = {
        id: 7,
        gn_layer_name: DEM_LAYER_NAME,
        styling_mode: 'traditional',
        rendering_type: 'dynamic_dem',
    };

    // Contour overlay layer as it would appear in flatLayers after reload.
    const contourLayer = {
        id: CONTOUR_LAYER_ID,
        type: 'wms',
        name: DEM_LAYER_NAME,
        style: DEM_CONTOUR_STYLE_NAME_FIXD,
        group: 'Input Data.Terrain',
        visibility: true,
    };

    // Base DEM layer.
    const demLayer = {
        id: 'ele-7-uuid',
        type: 'wms',
        name: DEM_LAYER_NAME,
        group: 'Input Data.Terrain',
        visibility: true,
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('clicking Hide Contours (contour layer in flatLayers, state={}) calls onRemoveLayer NOT onAddContourLayer (FIX D)', () => {
        // Use the unconnected class to control props directly, but wrap with a
        // Provider so child connected components (UploaderPanel, TerrainBboxPanel)
        // don't throw "Could not find store".
        // AnugaInputMenuClass + makeAnugaResourceState are module-imported at the top (merge 5.x→epic).

        let removeLayerCalledWith = null;
        let addContourLayerCalled = false;
        // BUG-6 (UAT 2026-06-16): the contour toggle must NOT persist the map.
        let saveMapCalled = false;

        // flatLayers contains both the DEM and the contour overlay (post-reload).
        // state.contoursEnabled is {} (reset on reload) — the bug was reading from state.
        const resources = makeAnugaResourceState('owner', 0);
        resources.terrain = [terrainModel];
        const storeState = {
            anuga: {
                resources,
                projects: { data: { id: 42, my_role: 'owner', projection: 'EPSG:32756' } },
                ui: { isCreatingAnugaLayer: false }
            },
            // Both layers in flatLayers — simulating post-reload restored map state.
            layers: { flat: [demLayer, contourLayer], groups: [] },
            security: { user: { pk: 9999 } },
            gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
            controls: {},
            localConfig: { plugins: {} }
        };
        const mockStore = {
            getState: () => storeState,
            subscribe: () => () => {},
            dispatch: () => {}
        };

        const props = {
            projectData: { id: 42, my_role: 'owner', projection: 'EPSG:32756' },
            canEditAnugaMap: true,
            projectId: 42,
            // terrainLayers: only the bare DEM layer (not the contour overlay).
            terrainLayers: [demLayer],
            terrainModels: [terrainModel],
            // flatLayers: both DEM + contour overlay (simulating map reload).
            flatLayers: [demLayer, contourLayer],
            boundaryLayers: [], inflowLayers: [], rainfallLayers: [],
            frictionLayers: [], frictionRasterLayers: [], structureLayers: [],
            meshRegionLayers: [],
            boundaryModels: [], inflowModels: [], rainfallModels: [],
            frictionModels: [], structureModels: [], meshRegionModels: [],
            pendingBoundaries: [], pendingInflows: [], pendingRainfalls: [],
            pendingFrictions: [], pendingStructures: [], pendingMeshRegions: [],
            isCreatingAnugaLayer: false,
            starterPhase: null,
            selectedScenarioId: null,
            selectedScenario: null,
            builtMeshes: [],
            onRemoveLayer: (layerId) => { removeLayerCalledWith = layerId; },
            onAddContourLayer: () => { addContourLayerCalled = true; },
            onSaveMap: () => { saveMapCalled = true; },
            onChangeTerrainLayerProperties: () => {},
            onUpdateTerrainRow: () => {},
            onAddMeshLayer: () => {},
            onZoomToExtent: () => {},
            setVisibleUploaderPanel: () => {},
            setVisibleTerrainBboxPanel: () => {},
            setCreatingAnugaLayer: () => {},
            addAnugaBoundary: () => {}, addAnugaFriction: () => {},
            addAnugaInflow: () => {}, addAnugaRainfall: () => {},
            addAnugaStructure: () => {}, addAnugaMeshRegion: () => {},
            startAnugaModelCreationPolling: () => {},
            stopAnugaModelCreationPolling: () => {},
            createAnugaBoundary: () => {}, createAnugaInflow: () => {},
            createAnugaRainfall: () => {}, createAnugaStructure: () => {},
            createAnugaFriction: () => {}, createAnugaMeshRegion: () => {},
        };

        return new Promise((resolve, reject) => {
            ReactDOM.render(
                <Provider store={mockStore}>
                    <AnugaInputMenuClass {...props} />
                </Provider>,
                container,
                () => {
                    // Terrain pane is the default (selectedCategory: 'terrain',
                    // projection is set → rail+pane layout → renderPane() → terrain).
                    // TASK-1587 (grill 2026-06-15): the Mode + Contours toggles moved OUT
                    // of the parent row INTO the expanded zone, so the row must be EXPANDED
                    // before the contour toggle button exists. Click the expand chevron.
                    const expandBtn = container.querySelector('.terrain-expand-btn');
                    expect(expandBtn).toExist('terrain row must be expandable (a real terrain model)');
                    expandBtn.click();

                    // setState from the chevron click re-renders on the event flush; reading
                    // the DOM in the same tick can be stale (karma render-callback gotcha),
                    // so defer the contour-button query + assertions to the next tick. Wrap
                    // in try/catch → reject so a deferred assertion failure surfaces loudly
                    // as a named failure (not a swallowed throw / spec timeout) and the
                    // Promise always settles inside the timer (no afterEach teardown race).
                    setTimeout(() => {
                        try {
                            // The toggle button must read "Hide Contours" because contoursInMap
                            // is true (contour IS in flatLayers).
                            const toggleBtn = container.querySelector('[data-testid^="terrain-contour-toggle-btn-"]');
                            expect(toggleBtn).toExist('contour toggle button must render (expanded)');
                            expect(toggleBtn.textContent).toContain('Hide Contours');

                            toggleBtn.click();

                            // FIX D: handler must fire onRemoveLayer (not onAddContourLayer)
                            // because the derived contoursEnabled (from flatLayers) is true,
                            // even though this.state.contoursEnabled[DEM_LAYER_NAME] === undefined.
                            expect(removeLayerCalledWith).toBe(CONTOUR_LAYER_ID,
                                'onRemoveLayer must be called with the contour layer id when contour is in flatLayers');
                            expect(addContourLayerCalled).toBe(false,
                                'onAddContourLayer must NOT be called (FIX D reload-desync)');
                            // BUG-6: the contour overlay is ephemeral view state — toggling it
                            // must NOT persist the map resource (no saveDirectContent / map PATCH).
                            expect(saveMapCalled).toBe(false,
                                'onSaveMap must NOT be called when toggling contours (BUG-6: no map save)');
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, 0);
                }
            );
        });
    });
});

// ---------------------------------------------------------------------------
// BUG-4 (UAT 2026-06-16): fold DEM & Hillshade into the collapsible section.
//
// The DEM and Hillshade rows must live INSIDE the collapsible derivatives zone
// (.terrain-derivatives), not at the top-level parent row. The parent row stays
// DEM IDENTITY ONLY (expand chevron + drag handle + a lightweight title), so it
// must NOT contain the full DEM MenuRow (.menu-row).
// ---------------------------------------------------------------------------

describe('BUG-4 anugaInputMenu DEM + Hillshade folded into collapsible section', () => {
    let container;

    const DEM_NAME = 'glo30_utm';
    const HILLSHADE_NAME = 'glo30_hillshade';

    const terrainModel = {
        id: 11,
        gn_layer_name: DEM_NAME,
        gn_layer_hillshade_name: HILLSHADE_NAME,
        styling_mode: 'traditional',
        rendering_type: 'dynamic_dem'
    };
    const demLayer = { id: 'dem-uuid', type: 'wms', name: DEM_NAME, title: 'GLO-30 DEM', group: 'Input Data.Terrain', visibility: true };
    const hillshadeLayer = { id: 'hs-uuid', type: 'wms', name: HILLSHADE_NAME, title: 'GLO-30 Hillshade', group: 'Input Data.Terrain', visibility: true };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function buildProps() {
        const resources = makeAnugaResourceState('owner', 0);
        resources.terrain = [terrainModel];
        return {
            storeState: {
                anuga: { resources, projects: { data: { id: 42, my_role: 'owner', projection: 'EPSG:32756' } }, ui: { isCreatingAnugaLayer: false } },
                layers: { flat: [demLayer, hillshadeLayer], groups: [] },
                security: { user: { pk: 9999 } },
                gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
                controls: {},
                localConfig: { plugins: {} }
            },
            props: {
                projectData: { id: 42, my_role: 'owner', projection: 'EPSG:32756' },
                canEditAnugaMap: true,
                projectId: 42,
                terrainLayers: [demLayer, hillshadeLayer],
                terrainModels: [terrainModel],
                flatLayers: [demLayer, hillshadeLayer],
                boundaryLayers: [], inflowLayers: [], rainfallLayers: [],
                frictionLayers: [], frictionRasterLayers: [], structureLayers: [],
                meshRegionLayers: [],
                boundaryModels: [], inflowModels: [], rainfallModels: [],
                frictionModels: [], structureModels: [], meshRegionModels: [],
                pendingBoundaries: [], pendingInflows: [], pendingRainfalls: [],
                pendingFrictions: [], pendingStructures: [], pendingMeshRegions: [],
                isCreatingAnugaLayer: false, starterPhase: null,
                selectedScenarioId: null, selectedScenario: null, builtMeshes: [],
                onRemoveLayer: () => {}, onAddContourLayer: () => {}, onSaveMap: () => {},
                onChangeTerrainLayerProperties: () => {}, onUpdateTerrainRow: () => {},
                onAddMeshLayer: () => {}, onZoomToExtent: () => {},
                setVisibleUploaderPanel: () => {}, setVisibleTerrainBboxPanel: () => {}, setCreatingAnugaLayer: () => {},
                addAnugaBoundary: () => {}, addAnugaFriction: () => {}, addAnugaInflow: () => {},
                addAnugaRainfall: () => {}, addAnugaStructure: () => {}, addAnugaMeshRegion: () => {},
                startAnugaModelCreationPolling: () => {}, stopAnugaModelCreationPolling: () => {},
                createAnugaBoundary: () => {}, createAnugaInflow: () => {}, createAnugaRainfall: () => {},
                createAnugaStructure: () => {}, createAnugaFriction: () => {}, createAnugaMeshRegion: () => {}
            }
        };
    }

    it('collapsed: parent row is identity-only — no DEM MenuRow at the top level', () => {
        const { storeState, props } = buildProps();
        const mockStore = { getState: () => storeState, subscribe: () => () => {}, dispatch: () => {} };
        return new Promise((resolve, reject) => {
            ReactDOM.render(
                <Provider store={mockStore}><AnugaInputMenuClass {...props} /></Provider>,
                container,
                () => {
                    setTimeout(() => {
                        try {
                            const parentRow = container.querySelector('.terrain-parent-row');
                            expect(parentRow).toExist('terrain parent row must render');
                            // Parent row holds the identity title, NOT the full MenuRow.
                            expect(parentRow.querySelector('.terrain-parent-title')).toExist('parent row shows identity title');
                            expect(parentRow.querySelector('.menu-row')).toNotExist('parent row must NOT contain the DEM MenuRow (identity-only)');
                            // Collapsed → no derivatives zone yet.
                            expect(container.querySelector('.terrain-derivatives')).toNotExist('derivatives zone hidden while collapsed');
                            resolve();
                        } catch (err) { reject(err); }
                    }, 0);
                }
            );
        });
    });

    it('expanded: DEM + Hillshade MenuRows render INSIDE the collapsible derivatives zone', () => {
        const { storeState, props } = buildProps();
        const mockStore = { getState: () => storeState, subscribe: () => () => {}, dispatch: () => {} };
        return new Promise((resolve, reject) => {
            ReactDOM.render(
                <Provider store={mockStore}><AnugaInputMenuClass {...props} /></Provider>,
                container,
                () => {
                    const expandBtn = container.querySelector('.terrain-expand-btn');
                    expect(expandBtn).toExist('terrain row must be expandable');
                    expandBtn.click();
                    setTimeout(() => {
                        try {
                            const derivatives = container.querySelector('.terrain-derivatives');
                            expect(derivatives).toExist('derivatives zone must render when expanded');
                            // BUG-4: the DEM MenuRow now lives inside the collapsible zone.
                            const demRow = derivatives.querySelector('.terrain-dem-row');
                            expect(demRow).toExist('DEM row must be inside the collapsible derivatives zone');
                            expect(demRow.querySelector('.menu-row')).toExist('DEM MenuRow renders inside the collapsible zone');
                            // Hillshade MenuRow is also inside the collapsible zone:
                            // expect at least 2 MenuRows (DEM + Hillshade) under .terrain-derivatives.
                            const menuRows = derivatives.querySelectorAll('.menu-row');
                            expect(menuRows.length >= 2).toBe(true,
                                'both DEM and Hillshade MenuRows render inside the collapsible zone');
                            // And the top-level parent row still holds NO MenuRow.
                            const parentRow = container.querySelector('.terrain-parent-row');
                            expect(parentRow.querySelector('.menu-row')).toNotExist('parent row stays identity-only when expanded');
                            resolve();
                        } catch (err) { reject(err); }
                    }, 0);
                }
            );
        });
    });
});
