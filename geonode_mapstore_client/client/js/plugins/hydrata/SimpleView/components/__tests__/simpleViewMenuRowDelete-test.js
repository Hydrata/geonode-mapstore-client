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

describe('V2P-714 simpleViewMenuRow cascade-delete', () => {
    let container;
    let originalConfirm;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        dispatched.length = 0;
        originalConfirm = window.confirm;
        window.confirm = () => true;  // auto-accept by default
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        window.confirm = originalConfirm;
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

    it('trash click confirms then dispatches DELETE_TERRAIN when layer.group=Terrain', (done) => {
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
                const trash = container.querySelector('.glyphicon-trash');
                expect(trash).toExist();
                Simulate.click(trash);
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
                const a = dispatched.find(x => x?.type === DELETE_LINKS);
                expect(a).toExist();
                expect(a.id).toBe(31);
                done();
            }
        );
    });

    // TASK-723 — confirm-cancel branch must skip the cascade dispatch for the
    // new types too. One representative test (Structure) keeps the cancel
    // branch coverage proportional to V2P-714 while still asserting the
    // dispatcher is correctly wired for the new fan-out.
    it('confirm-no aborts the Structure dispatch (no DELETE_STRUCTURE emitted)', (done) => {
        window.confirm = () => false;
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                    refreshlayerVersion={() => {}}
                />
            </Provider>,
            container,
            () => {
                Simulate.click(container.querySelector('.glyphicon-trash'));
                // No ANUGA:DELETE_* action should have been dispatched.
                const cascadeAction = dispatched.find(a => typeof a?.type === 'string' && a.type.startsWith('ANUGA:DELETE_'));
                expect(cascadeAction).toBe(undefined);
                expect(dispatched.find(a => a?.type === 'REMOVE_NODE')).toExist();
                expect(dispatched.find(a => a?.type === 'REMOVE_LAYER')).toExist();
                done();
            }
        );
    });

    it('confirm-no aborts the dispatch (no DELETE_TERRAIN emitted)', (done) => {
        window.confirm = () => false;
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
                Simulate.click(container.querySelector('.glyphicon-trash'));
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
                    refreshlayerVersion={() => {}}
                />
            </Provider>,
            container,
            () => {
                Simulate.click(container.querySelector('.glyphicon-trash'));
                // No cascade action dispatched
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                // Legacy REMOVE_NODE / REMOVE_LAYER dispatched instead
                expect(dispatched.find(a => a?.type === 'REMOVE_NODE')).toExist();
                expect(dispatched.find(a => a?.type === 'REMOVE_LAYER')).toExist();
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
                            message: 'Cannot delete: 2 active scenarios reference this terrain',
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
                const errBlock = container.querySelector('.menu-row-delete-error');
                expect(errBlock).toExist();
                expect(errBlock.textContent).toInclude('Cannot delete');
                expect(errBlock.textContent).toInclude('Scenario A');
                expect(errBlock.textContent).toInclude('Scenario B');
                expect(errBlock.textContent).toInclude('computing');
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
                const errBlock = container.querySelector('.menu-row-delete-error');
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
                const errBlock = container.querySelector('.menu-row-delete-error');
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
                const trash = container.querySelector('.glyphicon-trash');
                expect(trash).toExist();
                expect(trash.getAttribute('aria-disabled')).toBe('true');
                Simulate.click(trash);
                // No new dispatch should occur — onClick was undefined while deleting
                expect(dispatched.find(a => a?.type === DELETE_TERRAIN)).toBe(undefined);
                done();
            }
        );
    });
});
