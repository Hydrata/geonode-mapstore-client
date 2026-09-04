/*
 * V2P-714 + TASK-723 — tests for the simpleViewMenuRow trash button
 * cascade-delete wiring.
 *
 * Covers:
 *   - getDeleteDatasetType helper maps layer.group -> {terrain,boundary,
 *     friction,inflow,structure,mesh_region,catchment,nodes,links}
 *   - trash click confirms, then dispatches the right cascade action per type
 *   - blockingError renders inline with the blocking-scenarios list
 *   - deleteError renders an inline generic error
 *   - 401/403 error renders the permission-denied variant
 *   - deleting:true disables the trash glyph
 *   - non-cascade types (e.g. Full Mesh) fall back to the legacy redux-only path
 *
 * TASK-723 note: the legacy fallback test was switched from Structures to
 * Full Mesh because Structures became a typed cascade type in TASK-723.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Simulate } from 'react-dom/test-utils';

const dispatched = [];
function createMockStore(overrides = {}) {
    const defaults = {
        simpleView: { openMenuGroupId: null, config: {} },
        layers: { flat: [], groups: [] },
        gnresource: { initialResource: { perms: ['change_resourcebase', 'delete_resourcebase'] } },
        gnsettings: { geonodeUrl: 'https://hydrata.com', jobName: 'hydratabase' },
        controls: {},
        localConfig: { plugins: { map_viewer: [] } },
        anuga: {
            projects: { data: { id: 42, my_role: 'editor' } },
            resources: {
                terrain: [],
                boundaries: [],
                frictions: [],
                inflows: [],
                // TASK-723 — cascade-delete fan-out slots
                structures: [],
                meshRegions: [],
                catchments: [],
                nodes: [],
                links: []
            }
        },
        security: { user: { pk: 1 } }
    };
    const merged = {
        ...defaults,
        ...overrides,
        gnsettings: { ...defaults.gnsettings, ...(overrides.gnsettings || {}) },
        gnresource: { ...defaults.gnresource, ...(overrides.gnresource || {}) },
        anuga: {
            ...defaults.anuga,
            ...(overrides.anuga || {}),
            resources: {
                ...defaults.anuga.resources,
                ...((overrides.anuga && overrides.anuga.resources) || {})
            }
        }
    };
    return {
        getState: () => merged,
        subscribe: () => () => {},
        dispatch: (action) => {
            // unwrap thunks (some action creators return functions)
            if (typeof action === 'function') {
                action((a) => dispatched.push(a));
            } else {
                dispatched.push(action);
            }
            return action;
        }
    };
}

const baseLayer = (overrides = {}) => ({
    id: 'l1',
    visibility: true,
    group: 'Input Data.Terrain',
    type: 'wms',
    title: 'My Terrain',
    name: 'geonode:ele_xxxxxx',
    opacity: 1,
    perms: ['delete_resourcebase'],
    ...overrides
});

// TASK-723 — the trash glyph now opens a React confirm dialog rather than
// firing window.confirm(). The dialog is always rendered in the DOM
// (hidden by CSS until the trash is clicked) so we can find its buttons
// without waiting for a setState→re-render flush; that flush is unreliable
// under the react@16.14 / react-dom@16.10 mismatch in this repo when running
// under Karma+JSDOM. Production UX is unchanged: clicking trash flips a
// `.is-open` class via setState, CSS reveals the dialog.
const confirmDelete = (c) => {
    const btn = c.querySelector('.sv-menu-row-delete-confirm .sv-save-confirm-btn.danger');
    if (!btn) throw new Error('confirm dialog Delete button not found in row DOM');
    Simulate.click(btn);
};
const cancelDelete = (c) => {
    const btn = c.querySelector('.sv-menu-row-delete-confirm .sv-save-confirm-btn.cancel');
    if (!btn) throw new Error('confirm dialog Cancel button not found in row DOM');
    Simulate.click(btn);
};

describe('V2P-714 simpleViewMenuRow cascade-delete', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        dispatched.length = 0;
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    describe('getDeleteDatasetType helper', () => {
        const { getDeleteDatasetType } = require('../simpleViewMenuRow');

        it('maps Input Data.Terrain -> terrain', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Terrain' })).toBe('terrain');
        });
        it('maps Input Data.Boundaries -> boundary', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Boundaries' })).toBe('boundary');
        });
        it('maps Input Data.Friction -> friction', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Friction' })).toBe('friction');
        });
        it('maps Input Data.Inflows -> inflow', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Inflows' })).toBe('inflow');
        });
        // TASK-723 — 5 new cascade types added; Structures and Catchments
        // are no longer non-cascade.
        it('maps Input Data.Structures -> structure', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Structures' })).toBe('structure');
        });
        it('maps Input Data.Mesh Regions -> mesh_region', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Mesh Regions' })).toBe('mesh_region');
        });
        it('maps Input Data.Catchments -> catchment', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Catchments' })).toBe('catchment');
        });
        it('maps Input Data.Nodes -> nodes', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Nodes' })).toBe('nodes');
        });
        it('maps Input Data.Links -> links', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Links' })).toBe('links');
        });
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain).
        it('maps Input Data.Friction Rasters -> friction_raster', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Friction Rasters' })).toBe('friction_raster');
        });
        it('returns null for non-cascade groups', () => {
            // TASK-723: Full Mesh is excluded (computed artefact, not user-edited).
            // Network is excluded (no gn_layer, no menu UI).
            expect(getDeleteDatasetType({ group: 'Input Data.Full Mesh' })).toBe(null);
            expect(getDeleteDatasetType({ group: 'Default' })).toBe(null);
            expect(getDeleteDatasetType({ group: 'Results.Depth' })).toBe(null);
        });
        it('returns null when layer or group is missing', () => {
            expect(getDeleteDatasetType(null)).toBe(null);
            expect(getDeleteDatasetType({})).toBe(null);
        });
    });

    it('trash click + dialog confirm dispatches DELETE_TERRAIN when layer.group=Terrain', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{ id: 99, gn_layer_name: 'ele_xxxxxx' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                expect(container.querySelector('.glyphicon-trash')).toExist();
                confirmDelete(container);
                const deleteAction = dispatched.find(a => a?.type === DELETE_TERRAIN);
                expect(deleteAction).toExist();
                expect(deleteAction.projectId).toBe(42);
                expect(deleteAction.id).toBe(99);
                // V2P-714 sibling-orphan: action carries an array of all
                // sibling layer ids. With state.layers.flat empty in the
                // mock and only the utm sibling rendered as MenuRow, the
                // fallback returns the clicked layer's id alone.
                expect(deleteAction.layerIds).toEqual(['l1']);
                done();
            }
        );
    });

    it('trash on Terrain row collects BOTH utm + hillshade siblings from layers.flat', (done) => {
        // V2P-714 sibling-orphan: when a Terrain has both gn_layer_name
        // and gn_layer_hillshade_name exposed by the BE serializer, the
        // dispatched layerIds must include both sibling layer ids so the
        // epic can remove them in lockstep — leaving the hillshade
        // sibling stranded was the original bug.
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            layers: {
                flat: [
                    { id: 'utm-id', name: 'geonode:ele_5433_utm_xxx' },
                    { id: 'hillshade-id', name: 'geonode:ele_5433_hillshade_xxx' }
                ],
                groups: []
            },
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{
                        id: 99,
                        gn_layer_name: 'ele_5433_utm_xxx',
                        gn_layer_hillshade_name: 'ele_5433_hillshade_xxx'
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    id: 'utm-id',
                    group: 'Input Data.Terrain',
                    name: 'geonode:ele_5433_utm_xxx'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const deleteAction = dispatched.find(a => a?.type === DELETE_TERRAIN);
                expect(deleteAction).toExist();
                expect(deleteAction.id).toBe(99);
                expect(deleteAction.layerIds.length).toBe(2);
                expect(deleteAction.layerIds).toContain('utm-id');
                expect(deleteAction.layerIds).toContain('hillshade-id');
                done();
            }
        );
    });

    it('trash on hillshade row resolves to same Terrain pk via gn_layer_hillshade_name', (done) => {
        // Clicking the hillshade FE layer must resolve to the same
        // Terrain row as clicking the utm FE layer — without this
        // getDatasetIdForLayer would have to hit the single-row fallback
        // and would mis-target once the project has 2+ terrains.
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            layers: {
                flat: [
                    { id: 'utm-id', name: 'geonode:ele_5433_utm_xxx' },
                    { id: 'hillshade-id', name: 'geonode:ele_5433_hillshade_xxx' }
                ],
                groups: []
            },
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    // Two terrains so the single-row fallback can't bail us out.
                    terrain: [
                        { id: 88, gn_layer_name: 'ele_other_utm', gn_layer_hillshade_name: 'ele_other_hillshade' },
                        { id: 99, gn_layer_name: 'ele_5433_utm_xxx', gn_layer_hillshade_name: 'ele_5433_hillshade_xxx' }
                    ]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    id: 'hillshade-id',
                    group: 'Input Data.Terrain',
                    name: 'geonode:ele_5433_hillshade_xxx'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const deleteAction = dispatched.find(a => a?.type === DELETE_TERRAIN);
                expect(deleteAction).toExist();
                expect(deleteAction.id).toBe(99);  // not 88
                expect(deleteAction.layerIds).toContain('utm-id');
                expect(deleteAction.layerIds).toContain('hillshade-id');
                done();
            }
        );
    });

    it('trash click dispatches DELETE_BOUNDARY for Boundaries group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_BOUNDARY } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    boundaries: [{ id: 5, gn_layer_name: 'bdy_yyy' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Boundaries', name: 'geonode:bdy_yyy', title: 'Boundary 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_BOUNDARY);
                expect(a).toExist();
                expect(a.id).toBe(5);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_FRICTION for Friction group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_FRICTION } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    frictions: [{ id: 7, gn_layer_name: 'fri_zzz' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Friction', name: 'geonode:fri_zzz', title: 'Friction 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_FRICTION);
                expect(a).toExist();
                expect(a.id).toBe(7);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_INFLOW for Inflows group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_INFLOW } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    inflows: [{ id: 11, gn_layer_name: 'inf_aaa' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Inflows', name: 'geonode:inf_aaa', title: 'Inflow 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_INFLOW);
                expect(a).toExist();
                expect(a.id).toBe(11);
                done();
            }
        );
    });

    // TASK-723 — cascade-delete fan-out: 5 new typed dispatchers must dispatch
    // the matching ANUGA:DELETE_* action when the corresponding layer.group
    // trash button is clicked. Mirrors the boundary/friction/inflow shape.

    it('trash click dispatches DELETE_STRUCTURE for Structures group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_STRUCTURE } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    structures: [{ id: 13, gn_layer_name: 'str_qqq' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Structures', name: 'geonode:str_qqq', title: 'Structure 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_STRUCTURE);
                expect(a).toExist();
                expect(a.projectId).toBe(42);
                expect(a.id).toBe(13);
                expect(a.layerIds).toEqual(['l1']);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_MESH_REGION for Mesh Regions group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_MESH_REGION } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    meshRegions: [{ id: 17, gn_layer_name: 'mes_rrr' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Mesh Regions', name: 'geonode:mes_rrr', title: 'Mesh Region 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_MESH_REGION);
                expect(a).toExist();
                expect(a.id).toBe(17);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_CATCHMENT for Catchments group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_CATCHMENT } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    catchments: [{ id: 23, gn_layer_name: 'cat_sss' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Catchments', name: 'geonode:cat_sss', title: 'Catchment 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_CATCHMENT);
                expect(a).toExist();
                expect(a.id).toBe(23);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_NODES for Nodes group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_NODES } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    nodes: [{ id: 29, gn_layer_name: 'nod_ttt' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Nodes', name: 'geonode:nod_ttt', title: 'Nodes 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_NODES);
                expect(a).toExist();
                expect(a.id).toBe(29);
                done();
            }
        );
    });

    it('trash click dispatches DELETE_LINKS for Links group', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_LINKS } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    links: [{ id: 31, gn_layer_name: 'lin_uuu' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Links', name: 'geonode:lin_uuu', title: 'Links 1'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                const a = dispatched.find(x => x?.type === DELETE_LINKS);
                expect(a).toExist();
                expect(a.id).toBe(31);
                done();
            }
        );
    });

    // TASK-723 — dialog-cancel branch must skip the cascade dispatch for the
    // new types too. One representative test (Structure) keeps the cancel
    // branch coverage proportional to V2P-714 while still asserting the
    // dispatcher is correctly wired for the new fan-out.
    it('dialog cancel aborts the Structure dispatch (no DELETE_STRUCTURE emitted)', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_STRUCTURE } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: { structures: [{ id: 13, gn_layer_name: 'str_qqq' }] }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Structures', name: 'geonode:str_qqq'
                })} />
            </Provider>,
            container,
            () => {
                cancelDelete(container);
                expect(dispatched.find(a => a?.type === DELETE_STRUCTURE)).toBe(undefined);
                done();
            }
        );
    });

    // TASK-723 — Network is intentionally NOT in the dispatcher map
    // (separate lifecycle, no gn_layer, no menu UI). It must fall back to
    // the legacy redux-only path.
    it('Network group falls back to legacy removeNode/removeLayer (no cascade)', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore();
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow
                    layer={baseLayer({
                        group: 'Input Data.Network',
                        name: 'geonode:network_vvv',
                        title: 'Network 1'
                    })}
                />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                // No ANUGA:DELETE_* action should have been dispatched.
                const cascadeAction = dispatched.find(a => typeof a?.type === 'string' && a.type.startsWith('ANUGA:DELETE_'));
                expect(cascadeAction).toBe(undefined);
                expect(dispatched.find(a => a?.type === 'REMOVE_NODE')).toExist();
                expect(dispatched.find(a => a?.type === 'REMOVE_LAYER')).toExist();
                // The legacy fallback must also PERSIST the removal to the blob
                // (else the layer re-appears from base_resourcebase.blob on the
                // next load — the orphan-terrain "re-appears" bug).
                expect(dispatched.find(a => a?.type === 'GEONODE:SAVE_DIRECT_CONTENT')).toExist();
                done();
            }
        );
    });

    it('dialog cancel aborts the dispatch (no DELETE_TERRAIN emitted)', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: { terrain: [{ id: 99, gn_layer_name: 'ele_xxxxxx' }] }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                cancelDelete(container);
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                done();
            }
        );
    });

    it('non-cascade types fall back to legacy removeNode/removeLayer (no DELETE_TERRAIN)', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        // TASK-723: switched from Structures to Full Mesh because Structures
        // is now a typed cascade type. Full Mesh (fms_) is a computed
        // artefact, not a user-edited input dataset, so it stays on the
        // legacy redux-only delete path.
        const store = createMockStore();
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow
                    layer={baseLayer({ group: 'Input Data.Full Mesh', name: 'geonode:fms_qqq', title: 'Full Mesh 1' })}
                />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                // No cascade action dispatched
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                // Legacy REMOVE_NODE / REMOVE_LAYER dispatched instead
                expect(dispatched.find(a => a?.type === 'REMOVE_NODE')).toExist();
                expect(dispatched.find(a => a?.type === 'REMOVE_LAYER')).toExist();
                // …and persisted to the blob so it does not re-appear on reload.
                expect(dispatched.find(a => a?.type === 'GEONODE:SAVE_DIRECT_CONTENT')).toExist();
                done();
            }
        );
    });

    // The reported bug: an ORPHAN terrain layer — group 'Input Data.Terrain'
    // but with NO matching anuga.resources.terrain row (its Terrain row +
    // Datasets were deleted server-side, e.g. a re-derived combined surface) —
    // resolves datasetId=null, so the typed deleteTerrain cascade is skipped and
    // we hit the legacy fallback. Pre-fix that fallback omitted saveDirectContent,
    // so the layer vanished from the live tree but was restored from the blob on
    // the next load. Two non-matching rows defeat the single-row last-resort in
    // getDatasetIdForLayer, mirroring the real hydrata.com/map/5528 blob.
    it('orphan Terrain layer (no matching model) removes redux AND persists via saveDirectContent', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 649, my_role: 'owner' } },
                resources: {
                    terrain: [
                        { id: 510, gn_layer_name: 'ele_510_utm_spa_dcp3_cog' },
                        { id: 508, gn_layer_name: 'ele_508_utm_copernicus_cog' }
                    ]
                }
            },
            layers: { flat: [{ id: 'ghost-dem', name: 'geonode:ele_512_utm_combined_surface_derived_cog', group: 'Input Data.Terrain' }], groups: [] }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    id: 'ghost-dem',
                    group: 'Input Data.Terrain',
                    name: 'geonode:ele_512_utm_combined_surface_derived_cog',
                    title: 'Combined surface (derived)'
                })} />
            </Provider>,
            container,
            () => {
                confirmDelete(container);
                // No typed cascade (no resolvable Terrain row).
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                // Redux removal …
                expect(dispatched.find(a => a?.type === 'REMOVE_LAYER' && a.layerId === 'ghost-dem')).toExist();
                expect(dispatched.find(a => a?.type === 'REMOVE_NODE')).toExist();
                // … AND persisted so the ghost does not re-appear on reload.
                expect(dispatched.find(a => a?.type === 'GEONODE:SAVE_DIRECT_CONTENT')).toExist();
                done();
            }
        );
    });

    it('renders blocking-error message + scenario list inline', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{
                        id: 99,
                        gn_layer_name: 'ele_xxxxxx',
                        blockingError: {
                            // TASK-2823 — verbatim shape of the API's 409 `message`
                            // (gn_anuga/api_v2.py blocked_delete_message). This is the
                            // path production actually takes: the API ALWAYS sends a
                            // message, so `row.blockingError.message` wins over the
                            // locally-composed fallback below.
                            message: 'Cannot delete: this terrain is referenced by "Scenario A", '
                                + '"Scenario B". Detach it from those scenarios first.',
                            blocking: [
                                { type: 'scenario', id: 11, name: 'Scenario A', state: 'computing' },
                                { type: 'scenario', id: 12, name: 'Scenario B', state: 'queued' }
                            ]
                        }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const errBlock = container.querySelector('.sv-menu-row-delete-error');
                expect(errBlock).toExist();
                expect(errBlock.textContent).toInclude('Cannot delete');
                expect(errBlock.textContent).toInclude('Scenario A');
                expect(errBlock.textContent).toInclude('Scenario B');
                expect(errBlock.textContent).toInclude('computing');
                done();
            }
        );
    });

    // TASK-2823 — the fallback branch. `row.blockingError.message` is empty
    // whenever the 409 body reached the reducer without a `message` (an older
    // backend, a proxy that stripped the body, or crudEpics' `data.message ||
    // ''`), and pre-2823 the fallback still said "active scenarios" — the
    // pre-TASK-2855 claim, with no names and no instruction. It must now
    // compose the same detach-first copy the backend sends, from blocking[].
    it('composes the detach-first copy from blocking[] when the API sent no message', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{
                        id: 99,
                        gn_layer_name: 'ele_xxxxxx',
                        blockingError: {
                            message: '',
                            blocking: [
                                { type: 'scenario', id: 11, name: 'Ubungo baseline', state: 'idle' },
                                { type: 'scenario', id: 12, name: 'Ubungo 100yr ARI', state: 'idle' }
                            ]
                        }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const msg = container.querySelector('.sv-menu-row-delete-error-message');
                expect(msg).toExist();
                // Names, not a count.
                expect(msg.textContent).toInclude('"Ubungo baseline"');
                expect(msg.textContent).toInclude('"Ubungo 100yr ARI"');
                // The corrective action, and the dataset type from the group.
                expect(msg.textContent).toInclude('this terrain is referenced by');
                expect(msg.textContent).toInclude('Detach it from those scenarios first.');
                // The pre-2855 claim is gone (an idle scenario blocks too).
                expect(msg.textContent).toNotInclude('active scenario');
                done();
            }
        );
    });

    it('composes singular detach-first copy, naming an unnamed scenario by id', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    inflows: [{
                        id: 1440,
                        gn_layer_name: 'inf_770_c2ubungo_1c3f',
                        blockingError: {
                            blocking: [{ type: 'scenario', id: 77, name: '', state: 'idle' }]
                        }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({
                    group: 'Input Data.Inflows',
                    name: 'geonode:inf_770_c2ubungo_1c3f',
                    title: 'C2Ubungo'
                })} />
            </Provider>,
            container,
            () => {
                const msg = container.querySelector('.sv-menu-row-delete-error-message');
                expect(msg).toExist();
                // Matches the backend's own fallback label for a nameless scenario.
                expect(msg.textContent).toInclude('Scenario 77');
                expect(msg.textContent).toInclude('this inflow is referenced by');
                expect(msg.textContent).toInclude('Detach it from that scenario first.');
                expect(msg.textContent).toNotInclude('those scenarios');
                done();
            }
        );
    });

    it('renders generic deleteError when not 401/403', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{
                        id: 99, gn_layer_name: 'ele_xxxxxx',
                        deleteError: { status: 500, data: { detail: 'boom' } }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const errBlock = container.querySelector('.sv-menu-row-delete-error');
                expect(errBlock).toExist();
                expect(errBlock.textContent).toInclude('Delete failed');
                done();
            }
        );
    });

    it('renders permission-denied variant for 401/403 deleteError', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{
                        id: 99, gn_layer_name: 'ele_xxxxxx',
                        deleteError: { status: 403, data: { detail: 'forbidden' } }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const errBlock = container.querySelector('.sv-menu-row-delete-error');
                expect(errBlock).toExist();
                expect(errBlock.textContent).toInclude('do not have permission');
                done();
            }
        );
    });

    it('disables the trash glyph while deleting:true', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_TERRAIN } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    terrain: [{ id: 99, gn_layer_name: 'ele_xxxxxx', deleting: true }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Terrain', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                // .sv-glyph-delete is the interactive trash; .glyphicon-trash alone
                // also matches the decorative trash inside the always-rendered
                // confirm dialog so we narrow with the sv-menu-row class.
                const trash = container.querySelector('.sv-menu-row-glyph.glyphicon-trash');
                expect(trash).toExist();
                expect(trash.getAttribute('aria-disabled')).toBe('true');
                Simulate.click(trash);
                // Dialog is rendered (always-in-DOM) but stays in its closed
                // state — no `.is-open` class — and no dispatch occurs because
                // onClick was undefined while deleting:true.
                const dialog = container.querySelector('.sv-menu-row-delete-confirm');
                expect(dialog).toExist();
                expect(dialog.classList.contains('is-open')).toBe(false);
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                done();
            }
        );
    });
});
