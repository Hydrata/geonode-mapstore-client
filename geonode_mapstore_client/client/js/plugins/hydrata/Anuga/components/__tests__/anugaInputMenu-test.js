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
import MockAdapter from 'axios-mock-adapter';
// TASK-1751 (W1.8): mock the styling_mode PATCH (patchTerrainStylingMode) made by
// _handleTerrainStylingModeChange. anugaApi imports this same shared axios instance
// via the @mapstore/framework alias, so a MockAdapter on it intercepts the PATCH.
import axios from '@mapstore/framework/libs/ajax';
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

    // ── TASK-1729 (W1.7): direct-to-S3 presigned-PUT terrain upload ────────
    it('terrain upload glyph triggers the hidden file input (direct-to-S3, not the legacy panel)', () => {
        return mountMenu({ role: 'editor', layerCount: 0 }).then(() => {
            const fileInput = container.querySelector('[data-testid="anuga-terrain-file-input"]');
            expect(fileInput).toExist();
            expect(fileInput.type).toBe('file');
            // Clicking the glyph must click() the hidden input — spy on it.
            let clicked = 0;
            fileInput.click = () => { clicked += 1; };
            const glyph = container.querySelector('[data-testid="anuga-terrain-upload-button"]');
            expect(glyph).toExist();
            glyph.click();
            expect(clicked).toBe(1);
        });
    });
});

// ── TASK-1728 (W1.7): terrain upload surfaces on the Tasks Panel ───────────
//
// The blocking modal AND the interim inline progress strip (TASK-1729) are gone:
// _renderTerrainUploadProgress / _dismissTerrainUpload no longer exist, and
// renderTerrainPane no longer renders any upload-status node. Progress, success,
// and failure all surface on the W1.5 Tasks Panel via onUpdateProcess +
// onOpenTaskMonitor. These tests pin that contract. The presign→PUT→finalize
// chain itself (incl. the new onPresign callback) is covered by anugaApi-test.js.
describe('TASK-1728 terrain upload — no inline strip, surfaces on Tasks Panel', () => {
    function makeInstance(props) {
        const { AnugaInputMenuClass } = require('../anugaInputMenu');
        // _onTerrainFileSelected is a bound class-field arrow fn (assigned in the
        // constructor), so it does NOT live on the prototype — construct a real
        // instance. The constructor only sets state/refs/timers (no DOM).
        const instance = new AnugaInputMenuClass(props);
        instance.props = props;
        instance.setState = (updater) => {
            const patch = typeof updater === 'function' ? updater(instance.state) : updater;
            instance.state = Object.assign({}, instance.state, patch);
        };
        return instance;
    }

    it('the legacy inline progress-strip method is removed (lives on the Tasks Panel now)', () => {
        const { AnugaInputMenuClass } = require('../anugaInputMenu');
        expect(AnugaInputMenuClass.prototype._renderTerrainUploadProgress).toBe(undefined);
    });

    it('no project → opens the Tasks Panel and injects an ERROR process row (no inline strip)', () => {
        let opened = null;
        const processes = [];
        const instance = makeInstance({
            projectId: null,
            onOpenTaskMonitor: (open) => { opened = open; },
            onUpdateProcess: (p) => processes.push(p)
        });
        instance._onTerrainFileSelected({ target: { files: [{ name: 'dem.tif', size: 10, type: 'image/tiff' }] } });
        // Panel opened, one synthetic error row injected, no in-flight latch.
        expect(opened).toBe(true);
        expect(processes.length).toBe(1);
        expect(processes[0].status).toBe('error');
        expect(processes[0].process_type).toBe('terrain_create');
        expect(processes[0].name).toContain('dem.tif');
        expect(instance.state.terrainUpload.uploading).toBe(false);
    });

    it('no-ops when no file is selected (no panel open, no process row)', () => {
        let opened = null;
        const processes = [];
        const instance = makeInstance({
            projectId: 7,
            onOpenTaskMonitor: (open) => { opened = open; },
            onUpdateProcess: (p) => processes.push(p)
        });
        instance._onTerrainFileSelected({ target: { files: [] } });
        expect(opened).toBe(null);
        expect(processes.length).toBe(0);
        expect(instance.state.terrainUpload.uploading).toBe(false);
    });

    it('with a project → latches in-flight, opens the Tasks Panel, and starts the upload', () => {
        let opened = null;
        const instance = makeInstance({
            projectId: 7,
            onOpenTaskMonitor: (open) => { opened = open; },
            onUpdateProcess: () => {}
        });
        // A real File-shaped object so uploadTerrainDirect kicks off (the presign
        // POST is async — we don't await it; we assert the synchronous side effects).
        instance._onTerrainFileSelected({ target: { files: [{ name: 'dem.tif', size: 10, type: 'image/tiff' }] } });
        expect(opened).toBe(true);
        expect(instance.state.terrainUpload.uploading).toBe(true);
        expect(instance.state.terrainUpload.filename).toBe('dem.tif');
    });

    it('_emitTerrainUploadProcess builds a terrain_create row keyed on the given id', () => {
        const processes = [];
        const instance = makeInstance({ projectId: 7, onUpdateProcess: (p) => processes.push(p) });
        instance._emitTerrainUploadProcess('proc-9', { name: 'Terrain upload: dem.tif', status: 'running', progress_pct: 42, status_detail: 'Uploading' });
        expect(processes.length).toBe(1);
        expect(processes[0].id).toBe('proc-9');
        expect(processes[0].process_type).toBe('terrain_create');
        expect(processes[0].status).toBe('running');
        expect(processes[0].progress_pct).toBe(42);
        expect(processes[0].status_detail).toBe('Uploading');
        // ProcessRow renders a ProgressBar only for running rows with progress_pct.
        expect(typeof processes[0].created).toBe('string');
    });

    it('_emitTerrainUploadProcess is a no-op when onUpdateProcess is absent (defensive)', () => {
        const instance = makeInstance({ projectId: 7 });
        // Must not throw.
        instance._emitTerrainUploadProcess('x', { name: 'n', status: 'running' });
        expect(true).toBe(true);
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
// TASK-1674: TW* presentational pieces are imported here too (single import to
// satisfy no-duplicate-imports) for the SimpleView-primitive conform specs below.
import { AnugaInputMenuClass, TWStaleBadge, TWSurfaceList, TWRecipeBuilder } from '../anugaInputMenu';

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
                            // TASK-1749 (W1.8 #5): the contour toggle is now ICON-ONLY (no text
                            // label) — the "Hide Contours"/"Show Contours" semantics live on the
                            // aria-label, so assert there rather than on textContent.
                            const toggleBtn = container.querySelector('[data-testid^="terrain-contour-toggle-btn-"]');
                            expect(toggleBtn).toExist('contour toggle button must render (expanded)');
                            expect(toggleBtn.getAttribute('aria-label')).toContain('Hide Contours');

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

// ── TASK-1674 (1673 rollout, Phase C): SimpleView-primitive conform ──────────
// The terrain recipe builder's hand-rolled dark-glass chrome (tw-error blocks,
// the tw-empty-hint, the CSS-orphaned stale pill) is now the shared token-backed
// ErrorStrip / EmptyState / StatusBadge. These specs render the presentational
// TW pieces in isolation and assert: (a) the SimpleView primitive class hooks
// are emitted, (b) the per-panel tw-* variant hooks survive (extraClassName), and
// (c) the stable data-testids are preserved.
// (TWStaleBadge / TWSurfaceList / TWRecipeBuilder imported alongside
//  AnugaInputMenuClass above to satisfy no-duplicate-imports.)

describe('TASK-1674 terrain recipe builder conformed onto SimpleView primitives', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const surface = {
        id: 7,
        title: 'Surface A',
        inputs_ordered: [],
        use_culverts: false,
        feather_width_m: 10,
        target_resolution_m: 1,
        breach_max_cost: 100,
        breach_search_dist: 50
    };

    it('TWStaleBadge renders the shared StatusBadge (amber pending) when stale, nothing when fresh', () => {
        ReactDOM.render(<TWStaleBadge isStale />, container);
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist('stale badge must be the shared StatusBadge primitive');
        expect(badge.className).toContain('is-pending'); // amber warn palette
        expect(badge.textContent).toContain('stale');
        // The tooltip-bearing wrapper hook survives so the title/selector is intact.
        expect(container.querySelector('.terrain-workbench-stale-badge')).toExist('stale wrapper hook preserved');

        ReactDOM.unmountComponentAtNode(container);
        ReactDOM.render(<TWStaleBadge isStale={false} />, container);
        expect(container.querySelector('.sv-status-badge')).toNotExist('fresh surface renders no badge');
    });

    it('TWSurfaceList empty state is the shared EmptyState (sv-empty-state + tw-empty-hint hook)', () => {
        ReactDOM.render(
            <TWSurfaceList
                surfaces={[]}
                selectedId={null}
                onSelect={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onNew={() => {}}
            />,
            container
        );
        const empty = container.querySelector('.sv-empty-state');
        expect(empty).toExist('empty surfaces use the shared EmptyState primitive');
        expect(empty.className).toContain('tw-empty-hint'); // per-panel variant hook preserved
        expect(empty.textContent).toContain('No analysis surfaces yet');
        // The "+ New analysis surface" emphasis survives as the EmptyState subcopy.
        expect(empty.querySelector('strong')).toExist('the "+ New analysis surface" emphasis survives');
    });

    it('TWSurfaceList create error renders the shared ErrorStrip under the create-error testid', () => {
        ReactDOM.render(
            <TWSurfaceList
                surfaces={[]}
                selectedId={null}
                createError={'Boom: create failed'}
                onSelect={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onNew={() => {}}
            />,
            container
        );
        const wrap = container.querySelector('[data-testid="create-error"]');
        expect(wrap).toExist('create-error testid is preserved');
        const strip = wrap.querySelector('.sv-error-strip');
        expect(strip).toExist('create error uses the shared ErrorStrip primitive');
        expect(strip.className).toContain('tw-error'); // per-panel variant hook preserved
        expect(strip.getAttribute('role')).toBe('alert');
        expect(strip.textContent).toContain('Boom: create failed');
    });

    it('TWSurfaceList renders NO create-error wrapper / ErrorStrip on the happy path', () => {
        ReactDOM.render(
            <TWSurfaceList
                surfaces={[]}
                selectedId={null}
                createError={null}
                onSelect={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onNew={() => {}}
            />,
            container
        );
        expect(container.querySelector('[data-testid="create-error"]')).toNotExist('no error wrapper when createError is falsy');
        expect(container.querySelector('.sv-error-strip')).toNotExist('no ErrorStrip on the happy path');
    });

    it('TWRecipeBuilder save + derive errors are shared ErrorStrips under their testids', () => {
        ReactDOM.render(
            <TWRecipeBuilder
                surface={surface}
                terrains={[]}
                saveError={'save kaput'}
                deriveError={'derive kaput'}
                onUpdate={() => {}}
                onDerive={() => {}}
            />,
            container
        );
        const saveWrap = container.querySelector('[data-testid="save-error"]');
        expect(saveWrap).toExist('save-error testid preserved');
        expect(saveWrap.querySelector('.sv-error-strip')).toExist('save error is a shared ErrorStrip');
        expect(saveWrap.querySelector('.sv-error-strip').className).toContain('tw-error');
        expect(saveWrap.textContent).toContain('save kaput');

        const deriveWrap = container.querySelector('[data-testid="derive-error"]');
        expect(deriveWrap).toExist('derive-error testid preserved');
        expect(deriveWrap.querySelector('.sv-error-strip')).toExist('derive error is a shared ErrorStrip');
        expect(deriveWrap.textContent).toContain('derive kaput');
    });

    it('TWRecipeBuilder shows NO ErrorStrip when there are no errors (self-hide guard)', () => {
        ReactDOM.render(
            <TWRecipeBuilder
                surface={surface}
                terrains={[]}
                onUpdate={() => {}}
                onDerive={() => {}}
            />,
            container
        );
        expect(container.querySelector('[data-testid="save-error"]')).toNotExist();
        expect(container.querySelector('[data-testid="derive-error"]')).toNotExist();
        expect(container.querySelector('.sv-error-strip')).toNotExist('no ErrorStrip without an error');
    });
});

// ── TASK-1750 (W1.8): Analysis Surfaces recipe panel — labels, badges, headings,
//    modifiable/unmodified pencil toggle, stale-only-when-derived, zero-terrain
//    section guard. (re-UAT findings #1,#9,#10,#11,#14,#15,#16) ─────────────────
describe('TASK-1750 Analysis Surfaces recipe panel — labels/badges/pencil/headings', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // A 3-entry DEM stack: index 0 = top, index 2 = base.
    const terrains3 = [
        { id: 11, title: 'Top DEM' },
        { id: 12, title: 'Mid DEM' },
        { id: 13, title: 'Base DEM' }
    ];
    const surface3 = {
        id: 7, title: 'Surface A',
        inputs_ordered: [
            { id: 1, terrain: 11, priority: 0, unmodified: true },
            { id: 2, terrain: 12, priority: 1, unmodified: false },
            { id: 3, terrain: 13, priority: 2, unmodified: false }
        ],
        use_culverts: false, feather_width_m: 10, target_resolution_m: 1,
        breach_max_cost: 100, breach_search_dist: 50
    };

    function renderRecipe(props) {
        ReactDOM.render(
            <TWRecipeBuilder
                surface={surface3}
                terrains={terrains3}
                onUpdate={() => {}}
                onDerive={() => {}}
                {...props}
            />,
            container
        );
    }

    // #15: the DEM-stack heading is the normal-case "Merge terrains" (internal
    //      term stays "DEM priority stack"); NOT the old "DEM Stack".
    it('#15: DEM-stack heading reads "Merge terrains" in normal case (tw-label-normalcase)', () => {
        renderRecipe();
        const label = container.querySelector('.tw-design-inputs .tw-label');
        expect(label).toExist('the DEM-stack heading label exists');
        expect(label.textContent).toContain('Merge terrains');
        expect(label.textContent).toNotContain('DEM Stack');
        expect(label.className).toContain('tw-label-normalcase');
    });

    // #14: bottom = BASE, top = TOP, in-between numbered (1 = closest to TOP).
    it('#14: stack badges are TOP / 1 / BASE (top, in-between numbered, base)', () => {
        renderRecipe();
        const badges = [...container.querySelectorAll('.tw-priority-badge')].map(b => b.textContent.trim());
        expect(badges).toEqual(['TOP', '1', 'BASE']);
    });

    // #16: per-entry toggle is a PENCIL. Greyed (no .tw-modifiable-on) = unmodified;
    //      GREEN (.tw-modifiable-on) = modifiable. Tooltips say modifiable/unmodified
    //      (never fixed/adjustable). Base pencil is locked-on (green, disabled).
    it('#16: pencil toggle — greyed=unmodified, green=modifiable, base locked-on green', () => {
        renderRecipe();
        // Every toggle renders a pencil glyph (no ⊙/○).
        const pencils = container.querySelectorAll('.tw-pencil-toggle .glyphicon-pencil');
        expect(pencils.length).toBe(3);
        expect(container.textContent).toNotContain('⊙');
        expect(container.textContent).toNotContain('○');

        const topBtn = container.querySelector('[data-testid="unmodified-toggle-11"]');  // unmodified
        const midBtn = container.querySelector('[data-testid="unmodified-toggle-12"]');  // modifiable
        const baseBtn = container.querySelector('[data-testid="unmodified-toggle-13"]'); // base, locked-on

        // Top entry is unmodified → greyed pencil (NOT modifiable-on).
        expect(topBtn.className).toNotContain('tw-modifiable-on');
        expect(topBtn.getAttribute('aria-pressed')).toBe('false');
        expect(topBtn.getAttribute('title')).toBe('unmodified');

        // Mid entry is modifiable → green pencil.
        expect(midBtn.className).toContain('tw-modifiable-on');
        expect(midBtn.getAttribute('aria-pressed')).toBe('true');
        expect(midBtn.getAttribute('title')).toBe('modifiable');

        // Base is always modifiable (locked-on green) and disabled.
        expect(baseBtn.className).toContain('tw-modifiable-on');
        expect(baseBtn.disabled).toBe(true);
        expect(baseBtn.getAttribute('title')).toContain('modifiable');

        // Glossary: never "fixed"/"adjustable"/"locked"/"frozen" in the affordance copy.
        const toggleCopy = [topBtn, midBtn, baseBtn]
            .map(b => `${b.getAttribute('title')} ${b.getAttribute('aria-label')}`)
            .join(' ')
            .toLowerCase();
        expect(toggleCopy).toNotContain('fixed');
        expect(toggleCopy).toNotContain('adjustable');
    });

    // #9: the derive button is renamed "Create" (was "Derive terrain").
    it('#9: the derive action button reads "Create" (not "Derive terrain")', () => {
        renderRecipe();
        const btn = container.querySelector('[data-testid="derive-btn"]');
        expect(btn).toExist();
        expect(btn.textContent).toContain('Create');
        expect(btn.textContent).toNotContain('Derive terrain');
    });

    // #10: the redundant "PARAMETERS" sub-heading is removed.
    it('#10: the redundant "Parameters" sub-heading is gone', () => {
        renderRecipe();
        const labels = [...container.querySelectorAll('.tw-params-section .tw-label')];
        expect(labels.length).toBe(0);
    });

    // #10: the redundant "ANALYSIS SURFACES" sub-heading (surface-list header) is removed.
    it('#10: the redundant "Analysis Surfaces" sub-heading is gone from the list header', () => {
        ReactDOM.render(
            <TWSurfaceList
                surfaces={[]}
                selectedId={null}
                onSelect={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onNew={() => {}}
            />,
            container
        );
        const header = container.querySelector('.tw-surface-list-header');
        expect(header).toExist('the header (with the + New action) survives');
        expect(header.querySelector('.tw-label')).toNotExist('no sub-heading label in the header');
        expect(header.className).toContain('tw-surface-list-header--no-label');
        // The + New action is still present.
        expect(container.querySelector('[data-testid="new-surface-btn"]')).toExist();
    });

    // #11: never show "stale" on a surface that has never been derived.
    it('#11: stale badge hidden when never derived (no output_terrain), shown once derived + stale', () => {
        const base = {
            id: 9, title: 'Surf', inputs_ordered: [], use_culverts: false,
            feather_width_m: 10, target_resolution_m: 1, breach_max_cost: 100, breach_search_dist: 50
        };
        const renderList = (s) => ReactDOM.render(
            <TWSurfaceList
                surfaces={[s]}
                selectedId={null}
                onSelect={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
                onNew={() => {}}
            />,
            container
        );

        // Never derived: is_stale true (BE returns true with no output), output_terrain null.
        renderList({ ...base, is_stale: true, output_terrain: null });
        expect(container.querySelector('.sv-status-badge')).toNotExist('no stale pill before any derive');

        // Derived but inputs changed since: a derived output exists AND is_stale.
        ReactDOM.unmountComponentAtNode(container);
        renderList({ ...base, is_stale: true, output_terrain: 1234 });
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist('stale pill shows once a derived output exists and inputs changed');
        expect(badge.textContent).toContain('stale');

        // Derived and fresh: no stale pill.
        ReactDOM.unmountComponentAtNode(container);
        renderList({ ...base, is_stale: false, output_terrain: 1234 });
        expect(container.querySelector('.sv-status-badge')).toNotExist('no stale pill when fresh');
    });

    // #1: with ZERO terrains, the whole Analysis Surfaces section is absent.
    //     Walk the React-element tree returned by renderTerrainPane (avoids a full
    //     connected mount) looking for the .anuga-terrain-recipe-section node.
    function findClassInTree(el, cls) {
        if (!el || typeof el !== 'object') return false;
        if (Array.isArray(el)) return el.some(c => findClassInTree(c, cls));
        const cn = el.props && el.props.className;
        if (typeof cn === 'string' && cn.split(/\s+/).indexOf(cls) !== -1) return true;
        const children = el.props && el.props.children;
        return findClassInTree(children, cls);
    }

    function renderTerrainPaneTree(twTerrains) {
        const instance = Object.create(AnugaInputMenuClass.prototype);
        instance.props = {
            terrainLayers: [], canEditAnugaMap: true, flatLayers: [],
            projectId: 42, twTerrains,
            twSurfaces: [], twSelectedSurfaceId: null,
            twLoading: false, twError: null, twSaving: false, twSaveError: null,
            twDeriving: false, twDeriveError: null,
            onTwLoadData: () => {}, onTwSelectSurface: () => {}, onTwCreateSurface: () => {},
            onTwUpdateSurface: () => {}, onTwDeleteSurface: () => {}, onTwDerive: () => {},
            setVisibleTerrainBboxPanel: () => {}
        };
        instance.state = {
            twSurfaceSectionOpen: false, expandedTerrainIds: new Set(), contoursEnabled: {}
        };
        // Stub the heavy helpers renderTerrainPane delegates to.
        instance.renderPaneHead = () => null;
        instance.renderTerrainEmpty = () => null;
        instance._buildTerrainGroups = () => [];
        instance._terrainFileInputRef = { current: null };
        instance._openTerrainFilePicker = () => {};
        instance._onTerrainFileSelected = () => {};
        instance._handleTerrainStylingModeChange = () => {};
        instance._handleContoursToggle = () => {};
        return instance.renderTerrainPane();
    }

    it('#1: Analysis Surfaces section is ABSENT with zero terrains, PRESENT with >=1', () => {
        const treeZero = renderTerrainPaneTree([]);
        expect(findClassInTree(treeZero, 'anuga-terrain-recipe-section'))
            .toBe(false, 'recipe section must not render with zero terrains');

        const treeOne = renderTerrainPaneTree([{ id: 11, title: 'Top DEM' }]);
        expect(findClassInTree(treeOne, 'anuga-terrain-recipe-section'))
            .toBe(true, 'recipe section renders once at least one terrain exists');
    });
});

// ---------------------------------------------------------------------------
// TASK-1751 (W1.8): terrain Mode toggle — no map-blob save + Dynamic restyle nudge.
//
// #8: _handleTerrainStylingModeChange must NOT persist the map blob (no
//     onSaveMap/saveDirectContent). styling_mode is the single source of truth
//     and persists via the BE PATCH (patchTerrainStylingMode) ONLY; the
//     transient singleTile/env= params are reconstructed from styling_mode on
//     load by demRescaleEpic. This mirrors _handleContoursToggle (BUG-6).
// #20: switching to Dynamic must re-emit the current map view (onNudgeMapView)
//      so demRescaleEpic — which keys ONLY on CHANGE_MAP_VIEW — stamps env=
//      immediately, instead of producing NO visible restyle until a manual pan.
//
// These call the handler directly on an Object.create(prototype) instance
// (no React render) and mock the patchTerrainStylingMode axios PATCH so we can
// assert the post-PATCH dispatch behaviour deterministically.
// ---------------------------------------------------------------------------
describe('TASK-1751 terrain Mode toggle — no map save + Dynamic restyle nudge', () => {
    const TERRAIN = { id: 7, gn_layer_name: 'ele_7_my_dem_cog', styling_mode: 'traditional', rendering_type: 'dynamic_dem' };
    const MAP_LAYER = { id: 'ele-7-uuid', type: 'wms', name: 'ele_7_my_dem_cog', group: 'Input Data.Terrain', params: {} };

    let mockAxios;
    let calls;

    function makeInstance() {
        calls = { saveMap: 0, nudge: 0, updateRow: [], layerProps: [] };
        const props = {
            projectId: 42,
            onSaveMap: () => { calls.saveMap++; },
            onNudgeMapView: () => { calls.nudge++; },
            onUpdateTerrainRow: (id, fields) => { calls.updateRow.push({ id, fields }); },
            onChangeTerrainLayerProperties: (layerId, p) => { calls.layerProps.push({ layerId, props: p }); }
        };
        // _handleTerrainStylingModeChange is a bound class-field arrow fn (assigned in
        // the constructor), so it does NOT live on the prototype — construct a real
        // instance (the constructor only sets state/refs/timers, no DOM).
        const instance = new AnugaInputMenuClass(props);
        instance.props = props;
        return instance;
    }

    beforeEach((done) => {
        mockAxios = new MockAdapter(axios);
        // The BE PATCH that persists styling_mode — succeed so the .then() chain runs.
        mockAxios.onPatch(/\/api\/v2\/anuga\/projects\/42\/terrain\/7\//).reply(200, { id: 7, styling_mode: 'dynamic' });
        setTimeout(done);
    });

    afterEach((done) => {
        mockAxios.restore();
        setTimeout(done);
    });

    it('#8(b): switching to Dynamic fires the styling_mode PATCH and syncs the Redux row', (done) => {
        const instance = makeInstance();
        let patchedBody = null;
        mockAxios.onPatch(/\/api\/v2\/anuga\/projects\/42\/terrain\/7\//).reply((config) => {
            patchedBody = JSON.parse(config.data);
            return [200, { id: 7, styling_mode: 'dynamic' }];
        });
        instance._handleTerrainStylingModeChange(TERRAIN, MAP_LAYER, 'dynamic');
        // Let the patch promise + .then() chain settle.
        setTimeout(() => {
            try {
                // (b) the BE PATCH carries the new styling_mode (the persistence path).
                expect(patchedBody).toEqual({ styling_mode: 'dynamic' });
                // and the Redux terrain row is synced so findDynamicDemPairs reads it.
                expect(calls.updateRow.length).toBe(1);
                expect(calls.updateRow[0]).toEqual({ id: 7, fields: { styling_mode: 'dynamic' } });
                done();
            } catch (e) { done(e); }
        }, 50);
    });

    it('#8(a): the Dynamic toggle does NOT save the map blob (no onSaveMap)', (done) => {
        const instance = makeInstance();
        instance._handleTerrainStylingModeChange(TERRAIN, MAP_LAYER, 'dynamic');
        setTimeout(() => {
            try {
                // styling_mode persists via the BE PATCH only — NOT a map-blob save.
                expect(calls.saveMap).toBe(0,
                    'onSaveMap must NOT be called on a Mode toggle (#8: no silent map PATCH)');
                done();
            } catch (e) { done(e); }
        }, 50);
    });

    it('#8(a): the Traditional toggle also does NOT save the map blob', (done) => {
        const instance = makeInstance();
        const dynTerrain = { ...TERRAIN, styling_mode: 'dynamic' };
        instance._handleTerrainStylingModeChange(dynTerrain, MAP_LAYER, 'traditional');
        setTimeout(() => {
            try {
                expect(calls.saveMap).toBe(0,
                    'onSaveMap must NOT be called when switching to Traditional either');
                done();
            } catch (e) { done(e); }
        }, 50);
    });

    it('#20: switching to Dynamic re-emits the map view (onNudgeMapView) to trigger the rescale', (done) => {
        const instance = makeInstance();
        instance._handleTerrainStylingModeChange(TERRAIN, MAP_LAYER, 'dynamic');
        setTimeout(() => {
            try {
                // The nudge re-emits CHANGE_MAP_VIEW so demRescaleEpic stamps env=
                // immediately — without it, switching to Dynamic showed no restyle
                // until a manual pan (#20 root cause).
                expect(calls.nudge).toBe(1,
                    'onNudgeMapView must fire on Dynamic so demRescaleEpic runs at once');
                // singleTile:true must be stamped so the rescale GetMap is untiled.
                const stamp = calls.layerProps.find(c => c.props && c.props.singleTile === true);
                expect(stamp).toExist('singleTile:true must be stamped on the Dynamic branch');
                done();
            } catch (e) { done(e); }
        }, 50);
    });

    it('#20: switching to Traditional does NOT nudge the map view (GWC tiling, no rescale loop)', (done) => {
        const instance = makeInstance();
        const dynTerrain = { ...TERRAIN, styling_mode: 'dynamic' };
        const layerWithEnv = { ...MAP_LAYER, params: { env: 'elevMin:1.000', _v_: 123 } };
        instance._handleTerrainStylingModeChange(dynTerrain, layerWithEnv, 'traditional');
        setTimeout(() => {
            try {
                expect(calls.nudge).toBe(0,
                    'onNudgeMapView must NOT fire for Traditional (it leaves the dynamic rescale loop)');
                // Traditional drops env=/_v_ and turns tiling back on.
                const stamp = calls.layerProps.find(c => c.props && c.props.singleTile === false);
                expect(stamp).toExist('singleTile:false must be stamped on the Traditional branch');
                expect(stamp.props.params.env).toBe(undefined, 'env= must be removed for Traditional');
                expect(stamp.props.params._v_).toBe(undefined, '_v_ must be removed for Traditional');
                done();
            } catch (e) { done(e); }
        }, 50);
    });
});

// ---------------------------------------------------------------------------
// TASK-1752 (W1.8): terrain reorder drag-and-drop regression.
//
// The onReorderTerrainLayers thunk dispatches a single sortNode('Input
// Data.Terrain', order, sortLayers) so the Terrain group re-orders and
// state.layers.flat is rebuilt in the new order, then saveDirectContent()
// persists the blob.
//
// THE REGRESSION (root cause): the SORT_NODE reducer invokes its sortLayers
// callback as sortLayers(newGroups, state.flat) where `newGroups` is the WHOLE
// reordered state.groups TREE (deepChange returns the full top-level groups
// array — 'Input Data', 'Results', … — with only the Terrain group's nodes
// replaced). The old hand-rolled callback assumed its first argument was the
// flat array of reordered TERRAIN nodes, so it built `new Set(newGroupNodes.map(
// n => n.id || n))` from the TOP-LEVEL GROUP ids, found no flat layer matching
// them, kept every layer in `nonTerrain`, produced an empty `newTerrain`, and
// returned state.flat UNCHANGED. The TOC tree re-rendered (groups moved) but the
// map z-order + the persisted blob (both driven by flat) never moved — so the
// reorder visibly "didn't land". The fix uses the canonical
// LayersUtils.sortLayers, which rebuilds flat from the whole groups tree (the
// exact callback MapStore2's own TOC DnD passes via sortUsing(sortLayers,
// sortNode)).
//
// This test drives the REAL onReorderTerrainLayers thunk (the exported production
// mapDispatchToProps) through a REAL redux store wired to the REAL MapStore2
// layers reducer + thunk middleware — NOT a hand-rolled re-derivation. That is
// load-bearing: the bug lived in the sortLayers CALLBACK the thunk passes to
// sortNode, so a test that re-implements the algorithm (or passes the canonical
// sortLayers itself) would pass against BOTH the broken and fixed code. Calling
// the real thunk and asserting on the resulting state.flat is what makes this a
// genuine regression guard: it FAILS against the old callback (flat unchanged)
// and PASSES against the fix.
// ---------------------------------------------------------------------------
describe('TASK-1752 anugaInputMenu terrain reorder lands on state.flat (regression)', () => {
    const { combineReducers, createStore, applyMiddleware } = require('redux');
    const reduxThunk = require('redux-thunk');
    const thunkMiddleware = reduxThunk.default || reduxThunk.thunk || reduxThunk;
    const layersReducer = require('../../../../../../MapStore2/web/client/reducers/layers').default;
    const { getLayersByGroup } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
    const { getNode } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
    const { SAVE_DIRECT_CONTENT } = require('@js/actions/gnsave');
    const { mapDispatchToProps } = require('../anugaInputMenu');

    // Two DEMs, each with a hillshade derivative, plus a contour overlay on dem1.
    // group nodes are render-top-first; flat carries every layer.
    const mkLayers = () => ([
        { id: 'l_d1', name: 'dem1', group: 'Input Data.Terrain' },
        { id: 'l_d1_hs', name: 'dem1_hs', group: 'Input Data.Terrain' },
        { id: 'dem1__contours', name: 'dem1', style: 'dem_contours', group: 'Input Data.Terrain' },
        { id: 'l_d2', name: 'dem2', group: 'Input Data.Terrain' },
        { id: 'l_d2_hs', name: 'dem2_hs', group: 'Input Data.Terrain' },
        // a non-terrain layer must be left untouched by the reorder
        { id: 'l_bnd', name: 'bnd1', group: 'Input Data.Boundaries' }
    ]);

    // terrainGroups as _buildTerrainGroups yields them: group order dem1, dem2.
    const mkTerrainGroups = () => ([
        { terrain: { id: 1 }, demLayer: { id: 'l_d1', name: 'dem1' }, hillshadeLayer: { id: 'l_d1_hs', name: 'dem1_hs' } },
        { terrain: { id: 2 }, demLayer: { id: 'l_d2', name: 'dem2' }, hillshadeLayer: { id: 'l_d2_hs', name: 'dem2_hs' } }
    ]);

    const makeRealStore = () => {
        const flat = mkLayers();
        const groups = getLayersByGroup(flat, []);
        const dispatched = [];
        // capture every plain action AFTER the reducer has applied it.
        const captureLast = () => (next) => (action) => {
            if (action && action.type) dispatched.push(action);
            return next(action);
        };
        const store = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } },
            applyMiddleware(thunkMiddleware, captureLast)
        );
        return { store, dispatched };
    };

    it('reorder fires the thunk → state.flat is rebuilt so the moved DEM rides with its hillshade + contour, then saveDirectContent persists', () => {
        const { store, dispatched } = makeRealStore();

        const baselineFlatTerrain = store.getState().layers.flat
            .filter(l => l.group === 'Input Data.Terrain')
            .map(l => l.id);
        const terrainNode = getNode(store.getState().layers.groups, 'Input Data.Terrain');
        expect(terrainNode).toExist('Terrain group node must exist');
        expect(terrainNode.nodes.length).toBe(5, 'Terrain group must hold dem1+hs+contour and dem2+hs');

        // Drive the REAL production thunk. Move dem2 (index 1) to the TOP (index 0).
        const thunk = mapDispatchToProps(store.dispatch).onReorderTerrainLayers;
        thunk(mkTerrainGroups(), 1, 0);

        const state = store.getState().layers;

        // GROUPS reordered (this part worked even with the old broken callback)…
        const newTerrainNodes = getNode(state.groups, 'Input Data.Terrain').nodes
            .map(n => (n && n.id) || n);
        expect(newTerrainNodes).toEqual(
            ['l_d2', 'l_d2_hs', 'l_d1', 'l_d1_hs', 'dem1__contours'],
            'Terrain group nodes must follow the new order (dem2 group on top)'
        );

        // …and CRITICALLY state.flat must ALSO be reordered (the regression).
        // MapStore2's flat is the REVERSE of group-node order (flat is bottom-to-top,
        // nodes are top-to-bottom — see LayersUtils.initialReorderLayers).
        const flatTerrainOrder = state.flat
            .filter(l => l.group === 'Input Data.Terrain')
            .map(l => l.id);

        // 1) flat genuinely CHANGED — the old callback returned state.flat UNCHANGED
        //    so the reorder "didn't land" on the map / persisted blob.
        expect(flatTerrainOrder).toNotEqual(
            baselineFlatTerrain,
            'state.flat terrain order must change — the reorder must LAND on flat, not just groups'
        );

        // 2) flat mirrors the reordered group nodes (every node rebuilt; none dropped).
        expect(flatTerrainOrder).toEqual(
            ['l_d2', 'l_d2_hs', 'l_d1', 'l_d1_hs', 'dem1__contours'].slice().reverse(),
            'state.flat must mirror the reordered group nodes (reverse convention)'
        );

        // 3) each DEM stays adjacent to its derivatives — the group moved as a unit.
        const i = (id) => flatTerrainOrder.indexOf(id);
        expect(Math.abs(i('l_d2_hs') - i('l_d2'))).toBe(1, 'dem2 hillshade stays adjacent to dem2');
        expect(Math.abs(i('l_d1_hs') - i('l_d1'))).toBe(1, 'dem1 hillshade stays adjacent to dem1');
        const dem1Slots = [i('l_d1'), i('l_d1_hs'), i('dem1__contours')].sort((a, b) => a - b);
        expect(dem1Slots[2] - dem1Slots[0]).toBe(2,
            'dem1 + hillshade + contour are contiguous in flat (derivatives ride along)');
        const dem2Slots = [i('l_d2'), i('l_d2_hs')];
        expect(Math.min(...dem2Slots)).toBeGreaterThan(Math.max(...dem1Slots),
            'the moved dem2 group changed sides relative to the dem1 group');

        // 4) the non-terrain layer survives untouched.
        expect(state.flat.some(l => l.id === 'l_bnd')).toBe(true, 'non-terrain layer must survive the reorder');

        // 5) the blob is persisted (saveDirectContent dispatched after the sort).
        expect(dispatched.some(a => a.type === SAVE_DIRECT_CONTENT)).toBe(true,
            'saveDirectContent must fire so the new order persists to the map blob');
    });

    it('no-op guards: same index / single group do not dispatch anything', () => {
        const { store, dispatched } = makeRealStore();
        const baseFlat = store.getState().layers.flat.map(l => l.id);
        const thunk = mapDispatchToProps(store.dispatch).onReorderTerrainLayers;
        // fromIndex === toIndex → early return.
        thunk(mkTerrainGroups(), 1, 1);
        // single group → early return.
        thunk([mkTerrainGroups()[0]], 0, 0);
        expect(dispatched.length).toBe(0, 'guarded no-ops must not dispatch SORT_NODE or saveDirectContent');
        expect(store.getState().layers.flat.map(l => l.id)).toEqual(baseFlat, 'flat untouched on a no-op reorder');
    });
});
