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
        const { AnugaInputMenuClass } = require('../anugaInputMenu');
        const { makeAnugaResourceState } = require('../../__tests__/fixtures/anugaState');

        let removeLayerCalledWith = null;
        let addContourLayerCalled = false;

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
            onSaveMap: () => {},
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

        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={mockStore}>
                    <AnugaInputMenuClass {...props} />
                </Provider>,
                container,
                () => {
                    // Terrain pane is the default (selectedCategory: 'terrain',
                    // projection is set → rail+pane layout → renderPane() → terrain).
                    // The toggle button must read "Hide Contours" because contoursInMap
                    // is true (contour IS in flatLayers).
                    const toggleBtn = container.querySelector('[data-testid^="terrain-contour-toggle-btn-"]');
                    expect(toggleBtn).toExist('contour toggle button must render');
                    expect(toggleBtn.textContent).toContain('Hide Contours');

                    toggleBtn.click();

                    // FIX D: handler must fire onRemoveLayer (not onAddContourLayer)
                    // because the derived contoursEnabled (from flatLayers) is true,
                    // even though this.state.contoursEnabled[DEM_LAYER_NAME] === undefined.
                    expect(removeLayerCalledWith).toBe(CONTOUR_LAYER_ID,
                        'onRemoveLayer must be called with the contour layer id when contour is in flatLayers');
                    expect(addContourLayerCalled).toBe(false,
                        'onAddContourLayer must NOT be called (FIX D reload-desync)');
                    resolve();
                }
            );
        });
    });
});
