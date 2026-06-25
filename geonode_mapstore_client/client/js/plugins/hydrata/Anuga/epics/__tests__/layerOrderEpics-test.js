// TASK-1901 (epic 1898 W2) — Tests for the canonical layer-order reconciler
//
// Proof points required by the spec:
//   (a) REAL reducer + REAL sortLayers → flat[] actually moves to canonical order
//   (b) Idempotent: 2nd run on an already-canonical map dispatches nothing/no save
//   (c) Background group is never reordered
//   (d) No double-save with prune (reconciler only saves when something changed)
//   (e) FE/BE divergence guard: canonical Input Data order is pinned exactly
//
// TASK-1752 REAL-REDUCER DISCIPLINE: the sortNode/sortLayers path is driven
// through the REAL layers reducer wired in a REAL redux store (same pattern as
// anugaInputMenu-test.js TASK-1752 block). This catches the "flat[] unchanged"
// regression (a mock that fakes sortNode would pass for the WRONG reason).

import expect from 'expect';
import Rx from 'rxjs';
import { combineReducers, createStore } from 'redux';
import { FIX_ANUGA_GROUPS } from '../../actionsAnuga';
import { ANUGA_GROUPS } from '../pollingEpics';
import { computeReorderFor, layerOrderReconcilerEpic } from '../layerOrderEpics';
import { SAVE_DIRECT_CONTENT } from '@js/actions/gnsave';

const layersReducer = require('../../../../../../MapStore2/web/client/reducers/layers').default;
const LayersUtils = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
const { getNode, getLayersByGroup } = LayersUtils;

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeActions$ = (actions) => {
    const subject = new Rx.Subject();
    const action$ = subject.asObservable();
    action$.ofType = (...types) => action$.filter(a => types.includes(a.type));
    setTimeout(() => {
        actions.forEach(a => subject.next(a));
        subject.complete();
    }, 0);
    return action$;
};

/** Build a store pre-loaded with layers in a given group order. */
const makeStore = ({ groupOrder = null, role = 'editor' } = {}) => {
    // Default: Input Data children in NON-canonical order (Boundaries first, not Structures)
    const inputDataChildren = groupOrder || [
        'Boundaries', 'Inflows', 'Rainfalls', 'Structures', 'Catchments',
        'Nodes', 'Links', 'Mesh Regions', 'Full Mesh', 'Friction', 'Friction Rasters', 'Terrain'
    ];
    const flat = inputDataChildren.map(name => ({
        id: `l_${name.toLowerCase().replace(/ /g, '_')}`,
        name: `layer_${name.toLowerCase().replace(/ /g, '_')}`,
        group: `Input Data.${name}`
    }));

    // Build explicit groups tree preserving the given child order
    const groups = [
        {
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: inputDataChildren.map(name => ({
                id: `Input Data.${name}`,
                name,
                expanded: true,
                nodes: flat
                    .filter(l => l.group === `Input Data.${name}`)
                    .map(l => l.id)
            }))
        },
        {
            id: 'Results',
            name: 'Results',
            expanded: true,
            nodes: [
                { id: 'Results.Depth', name: 'Depth', nodes: [] },
                { id: 'Results.Momentum', name: 'Momentum', nodes: [] }
            ]
        },
        {
            id: 'background',
            name: 'background',
            nodes: [
                { id: 'osm_bg', name: 'OSM' }
            ]
        }
    ];

    const reduxStore = createStore(
        combineReducers({ layers: layersReducer }),
        { layers: { flat, groups } }
    );

    return {
        getState: () => ({
            ...reduxStore.getState(),
            anuga: {
                projects: {
                    data: {
                        id: 1,
                        my_role: role
                    }
                }
            }
        }),
        dispatch: reduxStore.dispatch
    };
};

// ── FE/BE divergence guard — pin the canonical order exactly ─────────────────

// TASK-1901: This test pins the exact canonical Input Data order. If you need to
// change it, update ANUGA_GROUPS in pollingEpics.js AND the BE LAYER_Z_ORDER in
// hydrata/apps/utils.py in the same PR.
describe('TASK-1901 canonical ANUGA_GROUPS order (FE/BE divergence guard)', () => {
    it('Input Data canonical order is exactly Structures > Boundaries > Inflows > Rainfalls > Catchments > Nodes > Links > Mesh Regions > Full Mesh > Friction > Friction Rasters > Terrain', () => {
        const expected = [
            'Structures',
            'Boundaries',
            'Inflows',
            'Rainfalls',
            'Catchments',
            'Nodes',
            'Links',
            'Mesh Regions',
            'Full Mesh',
            'Friction',
            'Friction Rasters',
            'Terrain'
        ];
        expect(ANUGA_GROUPS['Input Data']).toEqual(expected);
    });

    it('Structures is first (visually highest — structures must overlay boundaries)', () => {
        expect(ANUGA_GROUPS['Input Data'][0]).toBe('Structures');
    });

    it('Terrain is last (visually lowest — raster underneath all vectors)', () => {
        const inputData = ANUGA_GROUPS['Input Data'];
        expect(inputData[inputData.length - 1]).toBe('Terrain');
    });

    it('Friction Rasters comes before Terrain (rasters above terrain but below vectors)', () => {
        const inputData = ANUGA_GROUPS['Input Data'];
        expect(inputData.indexOf('Friction Rasters')).toBeLessThan(inputData.indexOf('Terrain'));
    });

    it('contains no Culverts entry (BE reserved the rank only; no live layer)', () => {
        expect(ANUGA_GROUPS['Input Data'].includes('Culverts')).toBe(false);
    });

    it('Results canonical order: Depth, Momentum, Velocity, then Comparison groups', () => {
        const results = ANUGA_GROUPS['Results'];
        expect(results[0]).toBe('Depth');
        expect(results[1]).toBe('Momentum');
        expect(results[2]).toBe('Velocity');
        expect(results.some(r => r.startsWith('Comparison'))).toBe(true);
    });
});

// ── computeReorderFor unit tests ─────────────────────────────────────────────

describe('TASK-1901 computeReorderFor helper', () => {
    const makeGroups = (childOrder) => [
        {
            id: 'Input Data',
            nodes: childOrder.map(name => ({ id: `Input Data.${name}`, name }))
        }
    ];

    it('returns null when group does not exist', () => {
        const result = computeReorderFor([], 'Input Data', ['Structures', 'Boundaries']);
        expect(result).toBe(null);
    });

    it('returns null when group has no nodes', () => {
        const groups = [{ id: 'Input Data', nodes: [] }];
        const result = computeReorderFor(groups, 'Input Data', ['Structures', 'Boundaries']);
        expect(result).toBe(null);
    });

    it('returns null when nodes are already in canonical order (idempotent)', () => {
        const groups = makeGroups(['Structures', 'Boundaries', 'Terrain']);
        const result = computeReorderFor(groups, 'Input Data', ['Structures', 'Boundaries', 'Terrain']);
        expect(result).toBe(null);
    });

    it('returns an order array when nodes are out of order', () => {
        // Current: Boundaries(0), Structures(1) — canonical wants Structures(0), Boundaries(1)
        const groups = makeGroups(['Boundaries', 'Structures', 'Terrain']);
        const canonical = ['Structures', 'Boundaries', 'Terrain'];
        const order = computeReorderFor(groups, 'Input Data', canonical);
        expect(order).toNotBe(null);
        // order[0]=1 (Structures is at current index 1), order[1]=0 (Boundaries at 0), order[2]=2
        expect(order).toEqual([1, 0, 2]);
    });

    it('appends unknown children after the canonical ones', () => {
        // "Mystery" is not in canonical list
        const groups = makeGroups(['Mystery', 'Boundaries', 'Structures']);
        const canonical = ['Structures', 'Boundaries'];
        const order = computeReorderFor(groups, 'Input Data', canonical);
        // desired: Structures(idx 2), Boundaries(idx 1), Mystery(idx 0)
        expect(order).toEqual([2, 1, 0]);
    });

    it('handles sparse canonical list (some children missing from live tree)', () => {
        // Only 2 of 3 canonical children exist in the live groups
        const groups = makeGroups(['Boundaries', 'Terrain']);
        const canonical = ['Structures', 'Boundaries', 'Terrain'];
        const order = computeReorderFor(groups, 'Input Data', canonical);
        // Structures is absent → desired order: Boundaries(0), Terrain(1) — already canonical
        expect(order).toBe(null);
    });
});

// ── layerOrderReconcilerEpic: REAL reducer end-to-end ────────────────────────

describe('TASK-1901 layerOrderReconcilerEpic (real reducer)', () => {

    // (a) REAL reducer + REAL sortLayers — flat[] moves to canonical order
    it('(a) reorders Input Data children to canonical order and updates state.flat', (done) => {
        // Start with Boundaries-first (non-canonical). Canonical wants Structures first.
        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            (() => {
                const inputDataOrder = [
                    'Boundaries', 'Inflows', 'Rainfalls', 'Structures', 'Catchments',
                    'Nodes', 'Links', 'Mesh Regions', 'Full Mesh', 'Friction', 'Friction Rasters', 'Terrain'
                ];
                const flat = inputDataOrder.map(name => ({
                    id: `l_${name.replace(/ /g, '_').toLowerCase()}`,
                    name: `layer_${name.replace(/ /g, '_').toLowerCase()}`,
                    group: `Input Data.${name}`
                }));
                const groups = [{
                    id: 'Input Data',
                    name: 'Input Data',
                    expanded: true,
                    nodes: inputDataOrder.map(name => ({
                        id: `Input Data.${name}`,
                        name,
                        expanded: true,
                        nodes: flat.filter(l => l.group === `Input Data.${name}`).map(l => l.id)
                    }))
                }];
                return { layers: { flat, groups } };
            })()
        );

        const store = {
            getState: () => ({
                ...reduxStore.getState(),
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: reduxStore.dispatch
        };

        const action$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted = [];

        layerOrderReconcilerEpic(action$, store).subscribe(
            a => {
                emitted.push(a);
                // Dispatch actions through the real store so state.flat updates
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                // At least one SORT_NODE and a SAVE_DIRECT_CONTENT
                const sortNodeActions = emitted.filter(a => a.type === 'SORT_NODE');
                const saveActions = emitted.filter(a => a.type === SAVE_DIRECT_CONTENT);
                expect(sortNodeActions.length).toBeGreaterThan(0);
                expect(saveActions.length).toBe(1);

                // Verify the Input Data group node order is now canonical
                const state = reduxStore.getState().layers;
                const inputDataNode = getNode(state.groups, 'Input Data');
                const newChildOrder = inputDataNode.nodes.map(n => n.name || n.id);
                const canonical = ANUGA_GROUPS['Input Data'];

                // Structures must come before Boundaries
                const idxStructures = newChildOrder.indexOf('Structures');
                const idxBoundaries = newChildOrder.indexOf('Boundaries');
                expect(idxStructures).toBeLessThan(idxBoundaries);

                // Terrain must be last
                expect(newChildOrder[newChildOrder.length - 1]).toBe('Terrain');

                // Verify flat[] also updated (the regression TASK-1752 caused it not to)
                // state.flat is bottom-to-top (reverse of groups node order)
                const flatGroupOrder = state.flat.map(l => l.group).filter(Boolean);
                const idxStructuresInFlat = flatGroupOrder.lastIndexOf('Input Data.Structures');
                const idxBoundariesInFlat = flatGroupOrder.lastIndexOf('Input Data.Boundaries');
                // Structures is visually ON TOP = later in flat (flat is bottom-to-top)
                expect(idxStructuresInFlat).toBeGreaterThan(idxBoundariesInFlat);

                done();
            }
        );
    }).timeout(3000);

    // (b) Idempotent: 2nd run on already-canonical map dispatches nothing
    it('(b) emits nothing when Input Data is already in canonical order', (done) => {
        const canonicalOrder = ANUGA_GROUPS['Input Data'];
        const flat = canonicalOrder.map(name => ({
            id: `l_${name.replace(/ /g, '_').toLowerCase()}`,
            name: `layer_${name.replace(/ /g, '_').toLowerCase()}`,
            group: `Input Data.${name}`
        }));
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: canonicalOrder.map(name => ({
                id: `Input Data.${name}`,
                name,
                expanded: true,
                nodes: flat.filter(l => l.group === `Input Data.${name}`).map(l => l.id)
            }))
        }];

        const store = {
            getState: () => ({
                layers: { flat, groups },
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted = [];

        layerOrderReconcilerEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                // Already canonical → nothing dispatched
                expect(emitted.length).toBe(0);
                done();
            }
        );
    }).timeout(3000);

    // (c) Background group is never touched
    it('(c) never emits a SORT_NODE for the background group', (done) => {
        // Non-canonical Input Data so we get a reorder action, but background must be immune
        const flat = [
            { id: 'l_bnd', name: 'bnd1', group: 'Input Data.Boundaries' },
            { id: 'l_str', name: 'str1', group: 'Input Data.Structures' },
            { id: 'osm', name: 'OpenStreetMap', group: 'background' }
        ];
        const groups = [
            {
                id: 'Input Data',
                name: 'Input Data',
                expanded: true,
                nodes: [
                    { id: 'Input Data.Boundaries', name: 'Boundaries', nodes: ['l_bnd'] },
                    { id: 'Input Data.Structures', name: 'Structures', nodes: ['l_str'] }
                ]
            },
            {
                id: 'background',
                name: 'background',
                nodes: ['osm']
            }
        ];
        const store = {
            getState: () => ({
                layers: { flat, groups },
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted = [];

        layerOrderReconcilerEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                // No SORT_NODE action must reference 'background'
                const bgSort = emitted.filter(a => a.type === 'SORT_NODE' && a.node === 'background');
                expect(bgSort.length).toBe(0);
                done();
            }
        );
    }).timeout(3000);

    // (d) Non-editor: no dispatch when not editable
    it('(d) emits nothing when user cannot edit the map (no save on viewer)', (done) => {
        const store = {
            getState: () => ({
                layers: { flat: [], groups: [{ id: 'Input Data', nodes: [
                    { id: 'Input Data.Boundaries', nodes: [] },
                    { id: 'Input Data.Structures', nodes: [] }
                ]}] },
                anuga: { projects: { data: { id: 1, my_role: 'viewer' } } }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted = [];

        layerOrderReconcilerEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                expect(emitted.length).toBe(0);
                done();
            }
        );
    }).timeout(3000);

    // (d) No double-save: only one saveDirectContent per reconcile pass
    it('(d) dispatches at most one saveDirectContent per reconcile pass (no double-save)', (done) => {
        // Multiple groups out-of-order → multiple sortNode, but ONE save
        const flat = [
            { id: 'l_bnd', name: 'bnd1', group: 'Input Data.Boundaries' },
            { id: 'l_str', name: 'str1', group: 'Input Data.Structures' },
            { id: 'l_depth', name: 'depth1', group: 'Results.Depth' },
            { id: 'l_mom', name: 'mom1', group: 'Results.Momentum' }
        ];
        const groups = [
            {
                id: 'Input Data',
                name: 'Input Data',
                expanded: true,
                nodes: [
                    { id: 'Input Data.Boundaries', name: 'Boundaries', nodes: ['l_bnd'] },
                    { id: 'Input Data.Structures', name: 'Structures', nodes: ['l_str'] }
                ]
            },
            {
                id: 'Results',
                name: 'Results',
                expanded: true,
                nodes: [
                    { id: 'Results.Momentum', name: 'Momentum', nodes: ['l_mom'] },
                    { id: 'Results.Depth', name: 'Depth', nodes: ['l_depth'] }
                ]
            }
        ];
        const store = {
            getState: () => ({
                layers: { flat, groups },
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted = [];

        layerOrderReconcilerEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                const saveActions = emitted.filter(a => a.type === SAVE_DIRECT_CONTENT);
                // Exactly 1 save, regardless of how many groups were reordered
                expect(saveActions.length).toBe(1);
                // Multiple SORT_NODE (one per out-of-order group)
                const sortActions = emitted.filter(a => a.type === 'SORT_NODE');
                expect(sortActions.length).toBe(2); // Input Data + Results both out of order
                done();
            }
        );
    }).timeout(3000);
});
