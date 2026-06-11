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
