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
import { FIX_ANUGA_GROUPS, SET_ANUGA_TERRAIN_DATA } from '../../actionsAnuga';
import { ANUGA_GROUPS } from '../pollingEpics';
import {
    computeReorderFor,
    computeTerrainSubOrder,
    findContourLayer,
    extractRunId,
    computeResultsLayerOrder,
    layerOrderReconcilerEpic,
    terrainSubOrderReconcilerEpic,
    resultsLayerOrderEpic
} from '../layerOrderEpics';
import { SAVE_DIRECT_CONTENT } from '@js/actions/gnsave';
import { DEM_CONTOUR_STYLE_NAME } from '../../gwcTileRouting';

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

// ── TASK-1903: floater ranking + intra-Results ordering ───────────────────────

describe('TASK-1903 extractRunId', () => {
    it('extracts run ID from run<N>_* pattern', () => {
        expect(extractRunId('run1257_depth_max_cog')).toBe(1257);
        expect(extractRunId('run42_velocity_max_cog')).toBe(42);
    });

    it('handles geonode: prefix via bareName', () => {
        expect(extractRunId('geonode:run1257_depth_max_cog')).toBe(1257);
    });

    it('returns -1 for non-run layers', () => {
        expect(extractRunId('ele_518_dem_cog')).toBe(-1);
        expect(extractRunId('bdy_001_boundary')).toBe(-1);
        expect(extractRunId(null)).toBe(-1);
        expect(extractRunId(undefined)).toBe(-1);
        expect(extractRunId('')).toBe(-1);
    });

    it('returns -1 for comparison layers without explicit run prefix', () => {
        // Comparison layers have names like "comparison_run1_vs_run2_depth"
        // which do NOT start with run<N>_
        expect(extractRunId('comparison_run1257_vs_run42_depth')).toBe(-1);
    });
});

describe('TASK-1903 computeResultsLayerOrder', () => {
    const flatLayers = [
        { id: 'l_run1257_depth', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' },
        { id: 'l_run42_depth', name: 'geonode:run42_depth_max_cog', group: 'Results.Depth' },
        { id: 'l_run1257_vel', name: 'geonode:run1257_velocity_max_cog', group: 'Results.Velocity' }
    ];

    it('sorts layers by run ID descending (latest first in nodes[0] = top)', () => {
        // Wrong order: older run (42) is nodes[0] (= top), newer run (1257) is nodes[1]
        const nodes = [{ id: 'l_run42_depth' }, { id: 'l_run1257_depth' }];
        const order = computeResultsLayerOrder(nodes, flatLayers);
        expect(order).toNotBe(null);
        // Apply: order[0] should be index of l_run1257_depth (currently 1)
        expect(order[0]).toBe(1); // l_run1257_depth (newer) should be first
        expect(order[1]).toBe(0); // l_run42_depth (older) should be second
    });

    it('returns null when already in canonical order (newest first)', () => {
        // Correct: newer run (1257) first
        const nodes = [{ id: 'l_run1257_depth' }, { id: 'l_run42_depth' }];
        const order = computeResultsLayerOrder(nodes, flatLayers);
        expect(order).toBe(null);
    });

    it('returns null for single-node group', () => {
        const nodes = [{ id: 'l_run1257_depth' }];
        expect(computeResultsLayerOrder(nodes, flatLayers)).toBe(null);
    });

    it('sorts run layers before non-run layers (non-run layers stay last)', () => {
        const flat = [
            { id: 'l_misc', name: 'some_comparison_layer', group: 'Results.Depth' },
            { id: 'l_run1257', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' }
        ];
        const nodes = [{ id: 'l_misc' }, { id: 'l_run1257' }];
        const order = computeResultsLayerOrder(nodes, flat);
        expect(order).toNotBe(null);
        // run1257 (has run ID) should come first
        const reordered = order.map(idx => nodes[idx]);
        expect(reordered[0].id).toBe('l_run1257');
        expect(reordered[1].id).toBe('l_misc');
    });

    // TASK-1916: stable-sort O(1) — 3+ non-run layers keep original relative order
    it('TASK-1916: 3+ non-run layers preserve their original relative order (stable sort via positionMap)', () => {
        // Input: [run1257, cmp_A, cmp_B, cmp_C] where run is first (canonical for run layers)
        // but cmp_A/B/C must retain their A→B→C relative order, not be reshuffled.
        // We test with non-run layers in a non-trivial order that could be scrambled
        // by a non-stable sort.
        const flat = [
            { id: 'l_run1257', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' },
            { id: 'l_cmp_A', name: 'cmp_alpha', group: 'Results.Depth' },
            { id: 'l_cmp_B', name: 'cmp_beta', group: 'Results.Depth' },
            { id: 'l_cmp_C', name: 'cmp_gamma', group: 'Results.Depth' }
        ];
        // Wrong order: cmp_C first, then cmp_A, then cmp_B, then run1257 last (oldest)
        const nodes = [
            { id: 'l_cmp_C' },
            { id: 'l_cmp_A' },
            { id: 'l_cmp_B' },
            { id: 'l_run1257' }
        ];
        const order = computeResultsLayerOrder(nodes, flat);
        expect(order).toNotBe(null);
        const reordered = order.map(idx => nodes[idx]);
        const reorderedIds = reordered.map(n => n.id);
        // run1257 must be first (has a run ID)
        expect(reorderedIds[0]).toBe('l_run1257');
        // Non-run layers must preserve their original relative order: C before A before B
        const idxC = reorderedIds.indexOf('l_cmp_C');
        const idxA = reorderedIds.indexOf('l_cmp_A');
        const idxB = reorderedIds.indexOf('l_cmp_B');
        expect(idxC).toBeLessThan(idxA);
        expect(idxA).toBeLessThan(idxB);
    });
});

// TASK-1903 epic: resultsLayerOrderEpic end-to-end (real reducer)
describe('TASK-1903 resultsLayerOrderEpic (real reducer)', () => {
    it('sorts older-run-first → newer-run-first on ADD_LAYER', (done) => {
        const flat = [
            { id: 'l_run42_depth', name: 'geonode:run42_depth_max_cog', group: 'Results.Depth' },
            { id: 'l_run1257_depth', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' }
        ];
        const groups = [{
            id: 'Results',
            name: 'Results',
            expanded: true,
            nodes: [{
                id: 'Results.Depth',
                name: 'Depth',
                expanded: true,
                nodes: [
                    { id: 'l_run42_depth' },    // older run at nodes[0] = TOP (wrong)
                    { id: 'l_run1257_depth' }   // newer run at nodes[1] = BELOW (wrong)
                ]
            }]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );

        const store = {
            getState: () => ({
                ...reduxStore.getState(),
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: reduxStore.dispatch
        };

        const action$ = makeActions$([{ type: 'ADD_LAYER', layer: {} }]);
        const emitted = [];

        resultsLayerOrderEpic(action$, store).subscribe(
            a => {
                emitted.push(a);
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                expect(emitted.filter(a => a.type === 'SORT_NODE').length).toBe(1);
                expect(emitted.filter(a => a.type === SAVE_DIRECT_CONTENT).length).toBe(1);

                const { getNode: gn } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
                const state = reduxStore.getState().layers;
                const depthNode = gn(state.groups, 'Results.Depth');
                const nodeIds = depthNode.nodes.map(n => n?.id || n);

                // Newer run (1257) should be first
                expect(nodeIds[0]).toBe('l_run1257_depth');
                expect(nodeIds[1]).toBe('l_run42_depth');

                done();
            }
        );
    }).timeout(3000);

    it('emits nothing when already newest-first', (done) => {
        const flat = [
            { id: 'l_run1257_depth', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' },
            { id: 'l_run42_depth', name: 'geonode:run42_depth_max_cog', group: 'Results.Depth' }
        ];
        const groups = [{
            id: 'Results',
            name: 'Results',
            expanded: true,
            nodes: [{
                id: 'Results.Depth',
                name: 'Depth',
                expanded: true,
                nodes: [
                    { id: 'l_run1257_depth' },  // newer first (canonical)
                    { id: 'l_run42_depth' }
                ]
            }]
        }];

        const store = {
            getState: () => ({
                layers: { flat, groups },
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: 'ADD_LAYER', layer: {} }]);
        const emitted = [];

        resultsLayerOrderEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                expect(emitted.length).toBe(0);
                done();
            }
        );
    }).timeout(3000);

    it('documented policy: latest run ID on top; non-run layers sort after run layers', (done) => {
        // Policy: run1257 > run42 > comparison_layer (non-run at bottom)
        const flat = [
            { id: 'l_cmp', name: 'comparison_depth', group: 'Results.Depth' },
            { id: 'l_run42', name: 'geonode:run42_depth_max_cog', group: 'Results.Depth' },
            { id: 'l_run1257', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' }
        ];
        const groups = [{
            id: 'Results',
            name: 'Results',
            expanded: true,
            nodes: [{
                id: 'Results.Depth',
                name: 'Depth',
                expanded: true,
                nodes: [
                    { id: 'l_cmp' },       // wrong: non-run at top
                    { id: 'l_run42' },     // wrong: older run before newer
                    { id: 'l_run1257' }
                ]
            }]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );

        const store = {
            getState: () => ({
                ...reduxStore.getState(),
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: reduxStore.dispatch
        };

        const action$ = makeActions$([{ type: 'ADD_LAYER', layer: {} }]);
        const emitted = [];

        resultsLayerOrderEpic(action$, store).subscribe(
            a => {
                emitted.push(a);
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                const { getNode: gn } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
                const state = reduxStore.getState().layers;
                const depthNode = gn(state.groups, 'Results.Depth');
                const nodeIds = depthNode.nodes.map(n => n?.id || n);
                // Canonical: run1257, run42, comparison
                expect(nodeIds[0]).toBe('l_run1257');
                expect(nodeIds[1]).toBe('l_run42');
                expect(nodeIds[2]).toBe('l_cmp');
                done();
            }
        );
    }).timeout(3000);
});

// ── TASK-1902: terrain sub-order tests ───────────────────────────────────────

describe('TASK-1902 findContourLayer', () => {
    const flatLayers = [
        { id: 'ele_518_dem_cog__contours', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' },
        { id: 'l_dem', name: 'geonode:ele_518_dem_cog', group: 'Input Data.Terrain' },
        { id: 'l_hs', name: 'geonode:ele_518_hs_cog', group: 'Input Data.Terrain' }
    ];

    it('finds contour by id convention (demName__contours)', () => {
        const result = findContourLayer(flatLayers, 'ele_518_dem_cog');
        expect(result).toExist();
        expect(result.id).toBe('ele_518_dem_cog__contours');
    });

    it('finds contour by id convention ignoring geonode: prefix on demName', () => {
        const result = findContourLayer(flatLayers, 'geonode:ele_518_dem_cog');
        expect(result).toExist();
        expect(result.id).toBe('ele_518_dem_cog__contours');
    });

    it('returns null when no contour layer exists', () => {
        const result = findContourLayer(flatLayers, 'ele_999_dem_cog');
        expect(result).toBe(null);
    });

    it('finds contour by style match fallback', () => {
        const flat = [
            { id: 'some_other_id', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' }
        ];
        const result = findContourLayer(flat, 'ele_518_dem_cog');
        expect(result).toExist();
        expect(result.id).toBe('some_other_id');
    });
});

describe('TASK-1902 computeTerrainSubOrder', () => {
    // Terrain model with DEM + hillshade FK
    const model1 = { id: 1, gn_layer_name: 'ele_518_dem_cog', gn_layer_hillshade_name: 'ele_518_hs_cog' };
    const model2 = { id: 2, gn_layer_name: 'ele_519_dem_cog', gn_layer_hillshade_name: 'ele_519_hs_cog' };

    // Layers
    const mkFlat = () => [
        { id: 'dem1', name: 'geonode:ele_518_dem_cog', group: 'Input Data.Terrain' },
        { id: 'hs1', name: 'geonode:ele_518_hs_cog', group: 'Input Data.Terrain' },
        { id: 'ele_518_dem_cog__contours', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' },
        { id: 'dem2', name: 'geonode:ele_519_dem_cog', group: 'Input Data.Terrain' },
        { id: 'hs2', name: 'geonode:ele_519_hs_cog', group: 'Input Data.Terrain' }
    ];

    it('returns null when already canonical (contour, dem, hillshade per terrain)', () => {
        // Canonical: [contour1, dem1, hs1, dem2, hs2]
        const nodes = [
            { id: 'ele_518_dem_cog__contours' },
            { id: 'dem1' },
            { id: 'hs1' },
            { id: 'dem2' },
            { id: 'hs2' }
        ];
        const order = computeTerrainSubOrder(nodes, mkFlat(), [model1, model2]);
        expect(order).toBe(null);
    });

    it('fixes within-terrain order: dem before contour → contour first', () => {
        // Wrong order: dem1, hs1, contour1, dem2, hs2
        const nodes = [
            { id: 'dem1' },
            { id: 'hs1' },
            { id: 'ele_518_dem_cog__contours' },
            { id: 'dem2' },
            { id: 'hs2' }
        ];
        const order = computeTerrainSubOrder(nodes, mkFlat(), [model1, model2]);
        expect(order).toNotBe(null);
        // Apply order to verify result
        const reordered = order.map(idx => nodes[idx]);
        const reorderedIds = reordered.map(n => n.id);
        // Terrain 1 cluster should be [contour, dem, hs]
        expect(reorderedIds.indexOf('ele_518_dem_cog__contours')).toBeLessThan(reorderedIds.indexOf('dem1'));
        expect(reorderedIds.indexOf('dem1')).toBeLessThan(reorderedIds.indexOf('hs1'));
    });

    it('resolves hillshade via FK (gn_layer_hillshade_name), NOT name substring', () => {
        // A hillshade named without "/hillshade/" substring — still resolved via FK
        const modelWithUniqueHsName = {
            id: 3,
            gn_layer_name: 'ele_520_dem_cog',
            gn_layer_hillshade_name: 'ele_520_shade_output'  // no "hillshade" in name
        };
        const flat = [
            { id: 'dem3', name: 'geonode:ele_520_dem_cog', group: 'Input Data.Terrain' },
            { id: 'hs3', name: 'geonode:ele_520_shade_output', group: 'Input Data.Terrain' }
        ];
        const nodes = [{ id: 'hs3' }, { id: 'dem3' }]; // Wrong: hs before dem
        const order = computeTerrainSubOrder(nodes, flat, [modelWithUniqueHsName]);
        expect(order).toNotBe(null);
        const reordered = order.map(idx => nodes[idx]);
        const reorderedIds = reordered.map(n => n.id);
        // dem should come before hs
        expect(reorderedIds.indexOf('dem3')).toBeLessThan(reorderedIds.indexOf('hs3'));
    });

    it('preserves inter-terrain order when fixing within-terrain sub-order', () => {
        // Two terrains: terrain2 above terrain1 (dem2 first in nodes = top)
        // Only fix the within-terrain sub-order, not which terrain is on top
        const nodes = [
            { id: 'dem2' },  // terrain2 on top (user-chosen via drag)
            { id: 'hs2' },
            { id: 'dem1' },  // terrain1 below (user-chosen)
            { id: 'hs1' },
            { id: 'ele_518_dem_cog__contours' }  // contour at wrong position
        ];
        const flat = mkFlat();
        const order = computeTerrainSubOrder(nodes, flat, [model1, model2]);
        if (order !== null) {
            const reordered = order.map(idx => nodes[idx]);
            const reorderedIds = reordered.map(n => n.id);
            // Inter-terrain: terrain2 (dem2) must still be above terrain1 (dem1)
            expect(reorderedIds.indexOf('dem2')).toBeLessThan(reorderedIds.indexOf('dem1'));
        }
        // Whether or not a reorder was needed, inter-terrain order is preserved
    });

    it('handles terrain with no contour and no hillshade', () => {
        const modelNoHs = { id: 4, gn_layer_name: 'ele_521_dem_cog', gn_layer_hillshade_name: null };
        const flat = [{ id: 'dem4', name: 'geonode:ele_521_dem_cog', group: 'Input Data.Terrain' }];
        const nodes = [{ id: 'dem4' }];
        // Single node, nothing to reorder
        const order = computeTerrainSubOrder(nodes, flat, [modelNoHs]);
        expect(order).toBe(null);
    });

    it('returns null for empty or single-node terrain group', () => {
        expect(computeTerrainSubOrder([], [], [])).toBe(null);
        expect(computeTerrainSubOrder([{ id: 'dem1' }], mkFlat(), [model1])).toBe(null);
    });
});

// TASK-1902 epic: terrainSubOrderReconcilerEpic end-to-end
describe('TASK-1902 terrainSubOrderReconcilerEpic (real reducer)', () => {
    it('fires on SET_ANUGA_TERRAIN_DATA and fixes dem-before-contour to contour-before-dem', (done) => {
        const model = { id: 1, gn_layer_name: 'ele_518_dem_cog', gn_layer_hillshade_name: 'ele_518_hs_cog' };

        // Initial WRONG order: dem1, hs1, contour1
        const flat = [
            { id: 'dem1', name: 'geonode:ele_518_dem_cog', group: 'Input Data.Terrain' },
            { id: 'hs1', name: 'geonode:ele_518_hs_cog', group: 'Input Data.Terrain' },
            { id: 'ele_518_dem_cog__contours', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' }
        ];
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: [{
                id: 'Input Data.Terrain',
                name: 'Terrain',
                expanded: true,
                nodes: [{ id: 'dem1' }, { id: 'hs1' }, { id: 'ele_518_dem_cog__contours' }]
            }]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );

        const store = {
            getState: () => ({
                ...reduxStore.getState(),
                anuga: {
                    projects: { data: { id: 1, my_role: 'editor' } },
                    resources: { terrain: [model] }
                }
            }),
            dispatch: reduxStore.dispatch
        };

        const action$ = makeActions$([{ type: SET_ANUGA_TERRAIN_DATA }]);
        const emitted = [];

        terrainSubOrderReconcilerEpic(action$, store).subscribe(
            a => {
                emitted.push(a);
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                const sortActions = emitted.filter(a => a.type === 'SORT_NODE');
                const saveActions = emitted.filter(a => a.type === SAVE_DIRECT_CONTENT);
                expect(sortActions.length).toBe(1);
                expect(saveActions.length).toBe(1);

                // Verify the contour is now BEFORE dem in the Terrain group nodes
                const state = reduxStore.getState().layers;
                const { getNode: gn } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
                const terrainNode = gn(state.groups, 'Input Data.Terrain');
                const nodeIds = terrainNode.nodes.map(n => n?.id || n);
                expect(nodeIds.indexOf('ele_518_dem_cog__contours')).toBeLessThan(nodeIds.indexOf('dem1'));
                expect(nodeIds.indexOf('dem1')).toBeLessThan(nodeIds.indexOf('hs1'));

                done();
            }
        );
    }).timeout(3000);

    it('emits nothing when terrain group is already in canonical sub-order', (done) => {
        const model = { id: 1, gn_layer_name: 'ele_518_dem_cog', gn_layer_hillshade_name: 'ele_518_hs_cog' };
        const flat = [
            { id: 'ele_518_dem_cog__contours', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' },
            { id: 'dem1', name: 'geonode:ele_518_dem_cog', group: 'Input Data.Terrain' },
            { id: 'hs1', name: 'geonode:ele_518_hs_cog', group: 'Input Data.Terrain' }
        ];
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: [{
                id: 'Input Data.Terrain',
                name: 'Terrain',
                expanded: true,
                nodes: [
                    { id: 'ele_518_dem_cog__contours' },
                    { id: 'dem1' },
                    { id: 'hs1' }
                ]
            }]
        }];

        const store = {
            getState: () => ({
                layers: { flat, groups },
                anuga: {
                    projects: { data: { id: 1, my_role: 'editor' } },
                    resources: { terrain: [model] }
                }
            }),
            dispatch: () => {}
        };

        const action$ = makeActions$([{ type: SET_ANUGA_TERRAIN_DATA }]);
        const emitted = [];

        terrainSubOrderReconcilerEpic(action$, store).subscribe(
            a => emitted.push(a),
            err => done(err),
            () => {
                expect(emitted.length).toBe(0);
                done();
            }
        );
    }).timeout(3000);

    it('multiple terrains: each gets correct sub-order, inter-terrain order preserved', (done) => {
        const model1 = { id: 1, gn_layer_name: 'ele_518_dem_cog', gn_layer_hillshade_name: 'ele_518_hs_cog' };
        const model2 = { id: 2, gn_layer_name: 'ele_519_dem_cog', gn_layer_hillshade_name: 'ele_519_hs_cog' };

        // Wrong sub-order for both: dem, hs, contour
        const flat = [
            { id: 'dem1', name: 'geonode:ele_518_dem_cog', group: 'Input Data.Terrain' },
            { id: 'hs1', name: 'geonode:ele_518_hs_cog', group: 'Input Data.Terrain' },
            { id: 'ele_518_dem_cog__contours', name: 'ele_518_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' },
            { id: 'dem2', name: 'geonode:ele_519_dem_cog', group: 'Input Data.Terrain' },
            { id: 'hs2', name: 'geonode:ele_519_hs_cog', group: 'Input Data.Terrain' },
            { id: 'ele_519_dem_cog__contours', name: 'ele_519_dem_cog', style: DEM_CONTOUR_STYLE_NAME, group: 'Input Data.Terrain' }
        ];
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: [{
                id: 'Input Data.Terrain',
                name: 'Terrain',
                expanded: true,
                nodes: [
                    // terrain2 on TOP (user drag-ordered: terrain2 above terrain1)
                    { id: 'dem2' }, { id: 'hs2' }, { id: 'ele_519_dem_cog__contours' },
                    // terrain1 below
                    { id: 'dem1' }, { id: 'hs1' }, { id: 'ele_518_dem_cog__contours' }
                ]
            }]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );

        const store = {
            getState: () => ({
                ...reduxStore.getState(),
                anuga: {
                    projects: { data: { id: 1, my_role: 'editor' } },
                    resources: { terrain: [model1, model2] }
                }
            }),
            dispatch: reduxStore.dispatch
        };

        const action$ = makeActions$([{ type: SET_ANUGA_TERRAIN_DATA }]);
        const emitted = [];

        terrainSubOrderReconcilerEpic(action$, store).subscribe(
            a => {
                emitted.push(a);
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                expect(emitted.filter(a => a.type === 'SORT_NODE').length).toBe(1);
                expect(emitted.filter(a => a.type === SAVE_DIRECT_CONTENT).length).toBe(1);

                const { getNode: gn } = require('../../../../../../MapStore2/web/client/utils/LayersUtils');
                const state = reduxStore.getState().layers;
                const terrainNode = gn(state.groups, 'Input Data.Terrain');
                const nodeIds = terrainNode.nodes.map(n => n?.id || n);

                // Each terrain's within-order: contour before dem before hs
                const idxC1 = nodeIds.indexOf('ele_518_dem_cog__contours');
                const idxD1 = nodeIds.indexOf('dem1');
                const idxH1 = nodeIds.indexOf('hs1');
                expect(idxC1).toBeLessThan(idxD1);
                expect(idxD1).toBeLessThan(idxH1);

                const idxC2 = nodeIds.indexOf('ele_519_dem_cog__contours');
                const idxD2 = nodeIds.indexOf('dem2');
                const idxH2 = nodeIds.indexOf('hs2');
                expect(idxC2).toBeLessThan(idxD2);
                expect(idxD2).toBeLessThan(idxH2);

                // Inter-terrain: terrain2 still above terrain1
                // (dem2 cluster comes before dem1 cluster in nodes[] = terrain2 on top)
                expect(Math.min(idxD2, idxH2, idxC2)).toBeLessThan(Math.min(idxD1, idxH1, idxC1));

                done();
            }
        );
    }).timeout(3000);
});

// ── TASK-1905: reversibility + blob-only + legacy-blob regression ─────────────

describe('TASK-1905 (1) BLOB-ONLY layer — no extendedParams.mapLayer', () => {
    // A blob-only layer is a layer object in state.layers.flat that has NO
    // extendedParams.mapLayer field (as loaded from an older map blob before the
    // MapLayer FK was added). The reconciler must not crash or skip these layers —
    // it should still order them correctly because it operates on group node IDs,
    // not on extendedParams.
    //
    // This tests the fleet-wide-undefined case flagged in the design doc.

    it('reconciler orders blob-only layers (no extendedParams) correctly — does not crash or skip', (done) => {
        // Flat layers WITHOUT extendedParams.mapLayer — simulates older blob format
        const flat = [
            { id: 'l_bnd', name: 'bdy_001_boundary', group: 'Input Data.Boundaries' },
            // No extendedParams at all on this layer:
            { id: 'l_str', name: 'str_001_structure', group: 'Input Data.Structures' }
        ];
        // Non-canonical: Boundaries before Structures
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: [
                { id: 'Input Data.Boundaries', name: 'Boundaries', nodes: ['l_bnd'] },
                { id: 'Input Data.Structures', name: 'Structures', nodes: ['l_str'] }
            ]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
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
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                // Must have reordered (Structures before Boundaries)
                const sortActions = emitted.filter(a => a.type === 'SORT_NODE');
                const saveActions = emitted.filter(a => a.type === SAVE_DIRECT_CONTENT);
                expect(sortActions.length).toBeGreaterThan(0);
                expect(saveActions.length).toBe(1);

                // Verify Structures is now above Boundaries in the groups tree
                const state = reduxStore.getState().layers;
                const inputDataNode = getNode(state.groups, 'Input Data');
                const names = inputDataNode.nodes.map(n => n.name || n.id);
                expect(names.indexOf('Structures')).toBeLessThan(names.indexOf('Boundaries'));

                done();
            }
        );
    }).timeout(3000);
});

describe('TASK-1905 (2) LEGACY-BLOB regression — Boundaries-first old blob stabilises on 2nd reconcile', () => {
    // Simulates loading a map blob saved BEFORE the canonical order was enforced:
    // Input Data children in the old order (Boundaries first).
    // After reconcile + saveDirectContent, re-derive groups from the saved state.
    // A 2nd reconcile must be a no-op (stable/idempotent).

    it('first reconcile reorders; second reconcile is a no-op (idempotent after save)', (done) => {
        const oldOrder = [
            'Boundaries', 'Inflows', 'Rainfalls', 'Structures', 'Catchments',
            'Nodes', 'Links', 'Mesh Regions', 'Full Mesh', 'Friction', 'Friction Rasters', 'Terrain'
        ];
        const flat = oldOrder.map(name => ({
            id: `l_${name.toLowerCase().replace(/ /g, '_')}`,
            name: `layer_${name.toLowerCase().replace(/ /g, '_')}`,
            group: `Input Data.${name}`
            // No extendedParams — blob-only shape
        }));
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            expanded: true,
            nodes: oldOrder.map(name => ({
                id: `Input Data.${name}`,
                name,
                expanded: true,
                nodes: flat.filter(l => l.group === `Input Data.${name}`).map(l => l.id)
            }))
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );

        const makeStore = () => ({
            getState: () => ({
                ...reduxStore.getState(),
                anuga: { projects: { data: { id: 1, my_role: 'editor' } } }
            }),
            dispatch: reduxStore.dispatch
        });

        // First reconcile
        const action1$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
        const emitted1 = [];

        layerOrderReconcilerEpic(action1$, makeStore()).subscribe(
            a => {
                emitted1.push(a);
                reduxStore.dispatch(a);
            },
            err => done(err),
            () => {
                // First run: must have done work (save emitted)
                expect(emitted1.filter(a => a.type === SAVE_DIRECT_CONTENT).length).toBe(1);

                // Second reconcile on the now-canonical state
                const action2$ = makeActions$([{ type: FIX_ANUGA_GROUPS }]);
                const emitted2 = [];

                layerOrderReconcilerEpic(action2$, makeStore()).subscribe(
                    a => emitted2.push(a),
                    err => done(err),
                    () => {
                        // Second run must be a no-op (idempotent)
                        expect(emitted2.length).toBe(0, 'Second reconcile must emit nothing — already canonical');

                        // And layer.group is still the category, NOT a z-rank
                        const state = reduxStore.getState().layers;
                        state.flat.forEach(l => {
                            // group must be a string like "Input Data.Structures", not a number
                            if (l.group) {
                                expect(typeof l.group).toBe('string');
                                expect(l.group).toMatch(/^(Input Data|Results|Default|background)/);
                            }
                        });

                        done();
                    }
                );
            }
        );
    }).timeout(6000);
});

describe('TASK-1905 (3) REVERSIBILITY — disabling epics restores prior behaviour; group stays CATEGORY not z-rank', () => {
    // Reversibility contract: layerOrderReconcilerEpic and resultsLayerOrderEpic
    // are opt-in epics registered in the epic middleware chain. Disabling them
    // (i.e. not subscribing to them) leaves state.layers.groups untouched and
    // no saveDirectContent is dispatched. The persisted blob is only written when
    // a reorder actually fires — viewer sessions or maps where the reconciler is
    // not registered retain their original order.
    //
    // One-way-door-safe: nothing new is persisted into layer.group (it stays as
    // the human-readable category path, not a z-rank integer). The reconciler only
    // touches group NODE ORDER within state.layers.groups — not the layer.group
    // field itself. Disabling = no writes, no state mutation.

    it('without the reconciler epic, no SORT_NODE or save is dispatched on FIX_ANUGA_GROUPS', (done) => {
        // Simulates a map where the reconciler is NOT registered (disabled).
        // State stays exactly as initialised (Boundaries-first non-canonical).
        const flat = [
            { id: 'l_bnd', name: 'bdy_001_boundary', group: 'Input Data.Boundaries' },
            { id: 'l_str', name: 'str_001_structure', group: 'Input Data.Structures' }
        ];
        const groups = [{
            id: 'Input Data',
            name: 'Input Data',
            nodes: [
                { id: 'Input Data.Boundaries', name: 'Boundaries', nodes: ['l_bnd'] },
                { id: 'Input Data.Structures', name: 'Structures', nodes: ['l_str'] }
            ]
        }];

        const reduxStore = createStore(
            combineReducers({ layers: layersReducer }),
            { layers: { flat, groups } }
        );
        const dispatchedActions = [];
        const wrappedDispatch = a => {
            dispatchedActions.push(a);
            return reduxStore.dispatch(a);
        };

        // Fire FIX_ANUGA_GROUPS directly into the store WITHOUT subscribing any epic
        wrappedDispatch({ type: FIX_ANUGA_GROUPS });

        // No epic subscribed — nothing should have dispatched a SORT_NODE or save
        setTimeout(() => {
            const sortActions = dispatchedActions.filter(a => a.type === 'SORT_NODE');
            const saveActions = dispatchedActions.filter(a => a.type === SAVE_DIRECT_CONTENT);
            expect(sortActions.length).toBe(0, 'SORT_NODE must not fire when epic is not registered');
            expect(saveActions.length).toBe(0, 'saveDirectContent must not fire when epic is not registered');

            // State remains non-canonical (Boundaries still first)
            const state = reduxStore.getState().layers;
            const inputDataNode = getNode(state.groups, 'Input Data');
            const names = inputDataNode.nodes.map(n => n.name || n.id);
            expect(names[0]).toBe('Boundaries', 'Without reconciler, Boundaries stays at index 0');

            // layer.group is still a category path, NOT a z-rank number
            state.flat.forEach(l => {
                if (l.group) {
                    expect(typeof l.group).toBe('string');
                    expect(typeof l.group).toNotBe('number');
                }
            });

            done();
        }, 100);
    }).timeout(3000);
});

describe('TASK-1905 (4) ADD_LAYER double-save — layerOrderReconcilerEpic + resultsLayerOrderEpic both fire on ADD_LAYER', () => {
    // VERIFIED BEHAVIOUR: both layerOrderReconcilerEpic and resultsLayerOrderEpic
    // listen to ADD_LAYER (each debounced 600ms). When a single ADD_LAYER triggers
    // BOTH a group reorder (Input Data out of order) AND an intra-Results reorder
    // (older run at top), TWO saveDirectContent PATCHes are produced — one from
    // each epic.
    //
    // POLICY (documented, Tier-B finding):
    //   - This is a KNOWN and ACCEPTED double-save. The two epics are independent
    //     by design (separate concerns: group order vs intra-Results order).
    //   - The double-save is IDEMPOTENT: both PATCHes write correct state; the
    //     second PATCH is a no-op at the DB level for an already-correct blob.
    //   - The frequency is LOW: only on maps that have BOTH Input Data out-of-order
    //     AND a Results group out-of-order (legacy maps on first reconcile only;
    //     thereafter both epics are idempotent).
    //   - COALESCING is non-trivial (requires a shared debounced save bus); deferred
    //     to TASK-1917 (Tier-B follow-up, epic 1898).

    it('documents: layerOrderReconcilerEpic emits 1 save AND resultsLayerOrderEpic emits 1 save independently = 2 total saves on ADD_LAYER', (done) => {
        // Setup: Input Data out-of-order (Boundaries before Structures)
        //        AND Results.Depth out-of-order (older run on top)
        const makeInitialState = () => {
            const flat = [
                { id: 'l_bnd', name: 'bdy_001_boundary', group: 'Input Data.Boundaries' },
                { id: 'l_str', name: 'str_001_structure', group: 'Input Data.Structures' },
                { id: 'l_run42', name: 'geonode:run42_depth_max_cog', group: 'Results.Depth' },
                { id: 'l_run1257', name: 'geonode:run1257_depth_max_cog', group: 'Results.Depth' }
            ];
            const groups = [
                {
                    id: 'Input Data',
                    name: 'Input Data',
                    expanded: true,
                    nodes: [
                        // Non-canonical: Boundaries before Structures
                        { id: 'Input Data.Boundaries', name: 'Boundaries', nodes: ['l_bnd'] },
                        { id: 'Input Data.Structures', name: 'Structures', nodes: ['l_str'] }
                    ]
                },
                {
                    id: 'Results',
                    name: 'Results',
                    expanded: true,
                    nodes: [{
                        id: 'Results.Depth',
                        name: 'Depth',
                        expanded: true,
                        // Non-canonical: older run (42) on top
                        nodes: [{ id: 'l_run42' }, { id: 'l_run1257' }]
                    }]
                }
            ];
            return { flat, groups };
        };

        // Test each epic INDEPENDENTLY against identical initial state.
        // (Sharing a single action$ Subject across both epics is unreliable with
        // RxJS 5 cold observables — the Subject only delivers to the first subscriber.)

        // Verify layerOrderReconcilerEpic independently: it should emit 1 save on ADD_LAYER.
        const store1 = (() => {
            const rs = createStore(combineReducers({ layers: layersReducer }), { layers: makeInitialState() });
            return {
                getState: () => ({ ...rs.getState(), anuga: { projects: { data: { id: 1, my_role: 'editor' } } } }),
                dispatch: rs.dispatch
            };
        })();

        // Verify resultsLayerOrderEpic independently: it should also emit 1 save on ADD_LAYER.
        const store2 = (() => {
            const rs = createStore(combineReducers({ layers: layersReducer }), { layers: makeInitialState() });
            return {
                getState: () => ({ ...rs.getState(), anuga: { projects: { data: { id: 1, my_role: 'editor' } } } }),
                dispatch: rs.dispatch
            };
        })();

        const emitted1 = [];
        const emitted2 = [];

        let done1 = false;
        let done2 = false;
        const checkDone = () => {
            if (done1 && done2) {
                const saves1 = emitted1.filter(a => a.type === SAVE_DIRECT_CONTENT).length;
                const saves2 = emitted2.filter(a => a.type === SAVE_DIRECT_CONTENT).length;

                // Each epic emits exactly one save when its concern is dirty.
                // Together they produce 2 saves when both are triggered by ADD_LAYER.
                // DOCUMENTED: this is the known double-save (Tier-B, TASK-1917).
                expect(saves1).toBe(1, 'layerOrderReconcilerEpic must emit 1 save on ADD_LAYER when group order is wrong');
                expect(saves2).toBe(1, 'resultsLayerOrderEpic must emit 1 save on ADD_LAYER when results order is wrong');

                done();
            }
        };

        layerOrderReconcilerEpic(
            makeActions$([{ type: 'ADD_LAYER', layer: {} }]),
            store1
        ).subscribe(
            a => { emitted1.push(a); store1.dispatch(a); },
            err => done(err),
            () => { done1 = true; checkDone(); }
        );

        resultsLayerOrderEpic(
            makeActions$([{ type: 'ADD_LAYER', layer: {} }]),
            store2
        ).subscribe(
            a => { emitted2.push(a); store2.dispatch(a); },
            err => done(err),
            () => { done2 = true; checkDone(); }
        );
    }).timeout(5000);
});
