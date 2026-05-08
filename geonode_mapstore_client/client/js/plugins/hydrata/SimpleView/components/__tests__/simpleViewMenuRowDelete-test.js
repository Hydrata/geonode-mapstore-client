/*
 * V2P-714 — tests for the simpleViewMenuRow trash button cascade-delete wiring.
 *
 * Covers:
 *   - getDeleteDatasetType helper maps layer.group -> {elevation,boundary,friction,inflow}
 *   - trash click confirms, then dispatches the right cascade action per type
 *   - blockingError renders inline with the blocking-scenarios list
 *   - deleteError renders an inline generic error
 *   - 401/403 error renders the permission-denied variant
 *   - deleting:true disables the trash glyph
 *   - non-cascade types (e.g. structures) fall back to the legacy redux-only path
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
                elevations: [],
                boundaries: [],
                frictions: [],
                inflows: []
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
    group: 'Input Data.Elevations',
    type: 'wms',
    title: 'My Elevation',
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

        it('maps Input Data.Elevations -> elevation', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Elevations' })).toBe('elevation');
        });
        it('maps Input Data.Boundaries -> boundary', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Boundaries' })).toBe('boundary');
        });
        it('maps Input Data.Friction Maps -> friction', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Friction Maps' })).toBe('friction');
        });
        it('maps Input Data.Inflows -> inflow', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Inflows' })).toBe('inflow');
        });
        it('returns null for non-cascade groups', () => {
            expect(getDeleteDatasetType({ group: 'Input Data.Structures' })).toBe(null);
            expect(getDeleteDatasetType({ group: 'Input Data.Catchments' })).toBe(null);
            expect(getDeleteDatasetType({ group: 'Default' })).toBe(null);
        });
        it('returns null when layer or group is missing', () => {
            expect(getDeleteDatasetType(null)).toBe(null);
            expect(getDeleteDatasetType({})).toBe(null);
        });
    });

    it('trash click confirms then dispatches DELETE_ELEVATION when layer.group=Elevations', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_ELEVATION } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    elevations: [{ id: 99, gn_layer_name: 'ele_xxxxxx' }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const trash = container.querySelector('.glyphicon-trash');
                expect(trash).toExist();
                Simulate.click(trash);
                const deleteAction = dispatched.find(a => a?.type === DELETE_ELEVATION);
                expect(deleteAction).toExist();
                expect(deleteAction.projectId).toBe(42);
                expect(deleteAction.id).toBe(99);
                expect(deleteAction.layerId).toBe('l1');
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

    it('trash click dispatches DELETE_FRICTION for Friction Maps group', (done) => {
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
                    group: 'Input Data.Friction Maps', name: 'geonode:fri_zzz', title: 'Friction 1'
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

    it('confirm-no aborts the dispatch (no DELETE_ELEVATION emitted)', (done) => {
        window.confirm = () => false;
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_ELEVATION } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: { elevations: [{ id: 99, gn_layer_name: 'ele_xxxxxx' }] }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                Simulate.click(container.querySelector('.glyphicon-trash'));
                expect(dispatched.find(a => a?.type === DELETE_ELEVATION)).toBe(undefined);
                done();
            }
        );
    });

    it('non-cascade types fall back to legacy removeNode/removeLayer (no DELETE_ELEVATION)', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const { DELETE_ELEVATION } = require('../../../Anuga/actionsAnuga');
        // Structures live in Input Data.Structures — not a V2P-714 type.
        const store = createMockStore();
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow
                    layer={baseLayer({ group: 'Input Data.Structures', name: 'geonode:str_qqq', title: 'Struct 1' })}
                    refreshlayerVersion={() => {}}
                />
            </Provider>,
            container,
            () => {
                Simulate.click(container.querySelector('.glyphicon-trash'));
                // No cascade action dispatched
                expect(dispatched.find(a => a?.type === DELETE_ELEVATION)).toBe(undefined);
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
                    elevations: [{
                        id: 99,
                        gn_layer_name: 'ele_xxxxxx',
                        blockingError: {
                            message: 'Cannot delete: 2 active scenarios reference this elevation',
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
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
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
                    elevations: [{
                        id: 99, gn_layer_name: 'ele_xxxxxx',
                        deleteError: { status: 500, data: { detail: 'boom' } }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
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
                    elevations: [{
                        id: 99, gn_layer_name: 'ele_xxxxxx',
                        deleteError: { status: 403, data: { detail: 'forbidden' } }
                    }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
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
        const { DELETE_ELEVATION } = require('../../../Anuga/actionsAnuga');
        const store = createMockStore({
            anuga: {
                projects: { data: { id: 42, my_role: 'editor' } },
                resources: {
                    elevations: [{ id: 99, gn_layer_name: 'ele_xxxxxx', deleting: true }]
                }
            }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={baseLayer({ group: 'Input Data.Elevations', name: 'geonode:ele_xxxxxx' })} />
            </Provider>,
            container,
            () => {
                const trash = container.querySelector('.glyphicon-trash');
                expect(trash).toExist();
                expect(trash.getAttribute('aria-disabled')).toBe('true');
                Simulate.click(trash);
                // No new dispatch should occur — onClick was undefined while deleting
                expect(dispatched.find(a => a?.type === DELETE_ELEVATION)).toBe(undefined);
                done();
            }
        );
    });
});
