// TASK-1901 (epic 1898 W2) — Canonical group-tree-order reconciler
//
// Re-asserts the canonical ORDER of ANUGA sub-group nodes in state.layers.groups
// whenever a map loads (FIX_ANUGA_GROUPS, which fires from initAnugaEpic) or a
// new layer is added (ADD_LAYER). The reconciler only touches group-node ORDER;
// it never changes layer.group (category), never flattens/re-parents groups, and
// never touches the "background" band.
//
// Design choices:
//   - Editor-gated: only runs + saves when canEditAnugaMap (same gate as all other
//     write epics). Viewers cannot persist; nothing to reconcile.
//   - Idempotent: computes desired order, compares to current, dispatches
//     sortNode + saveDirectContent ONLY when something changed. A second run on an
//     already-canonical map emits nothing.
//   - No double-save: the reconciler triggers on FIX_ANUGA_GROUPS (same tick as
//     ensureAnugaGroupsEpic + pruneOrphanTerrainLayersEpic); saveDirectContent is
//     dispatched ONCE at the end of this epic's emission ONLY WHEN a reorder was
//     needed. pruneOrphanTerrainLayersEpic fires on SET_ANUGA_TERRAIN_DATA
//     (a different action), so there is no race on that path.
//   - Background-exempt: skips any group whose id === 'background' or whose id
//     does not appear in ANUGA_GROUPS.
//   - One-way-door safe: fully reversible — disabling this epic restores prior
//     behaviour; nothing writes to the persisted blob unless the order is wrong.
//
// Canonical order is sourced from ANUGA_GROUPS in pollingEpics.js (the single
// source of truth for group definitions). This epic imports it directly so the
// order cannot diverge between ensureAnugaGroupsEpic and the reconciler.
//
// FE/BE divergence guard: the canonical Input Data child order is ALSO expressed
// as LAYER_Z_ORDER in hydrata/apps/utils.py (BE). Both must be kept in sync.
// See pollingEpics.js comment on ANUGA_GROUPS for cross-reference.

import Rx from 'rxjs';
import {
    ADD_LAYER,
    sortNode
} from '../../../../../MapStore2/web/client/actions/layers';
import {
    getNode,
    sortLayers
} from '../../../../../MapStore2/web/client/utils/LayersUtils';
import { saveDirectContent } from '@js/actions/gnsave';
import { canEditAnugaMap } from '../selectorsAnuga';
import { FIX_ANUGA_GROUPS, SET_ANUGA_TERRAIN_DATA } from '../actionsAnuga';
import { ANUGA_GROUPS } from './pollingEpics';
import { bareName } from './terrainEpics';
import { DEM_CONTOUR_STYLE_NAME } from '../gwcTileRouting';

// -- helpers ------------------------------------------------------------------

/**
 * Compute the sortNode `order` array required to reorder the current nodes of a
 * group to match the canonical child order.
 *
 * sortNode reducer: reorderedNodes = order.map(idx => nodes[idx])
 * So order[i] = the CURRENT index of the node that should end up at position i.
 *
 * Returns null when:
 *   - the group does not exist in the current groups tree
 *   - the group has no nodes
 *   - the group nodes are ALREADY in canonical order (idempotent no-op)
 *
 * Unknown children (present in the live map but absent from ANUGA_GROUPS) are
 * appended after the known canonical children, preserving any extra content.
 *
 * @param {Array}  groups        state.layers.groups
 * @param {string} parentId      e.g. 'Input Data'
 * @param {Array}  canonicalChildren  e.g. ['Structures', 'Boundaries', ...]
 * @returns {Array|null}
 */
export const computeReorderFor = (groups, parentId, canonicalChildren) => {
    const groupNode = getNode(groups, parentId);
    if (!groupNode || !groupNode.nodes || groupNode.nodes.length === 0) return null;

    const currentNodes = groupNode.nodes;

    // Build canonical order: known children first (in spec order), then any
    // nodes whose id isn't in the canonical list (appended in their current order).
    const canonicalIds = canonicalChildren.map(c => `${parentId}.${c}`);
    const knownSet = new Set(canonicalIds);

    const unknowns = currentNodes
        .filter(n => n != null && !knownSet.has(n.id || n))
        .map(n => n.id || n);

    const desiredIdOrder = [
        ...canonicalIds.filter(cid => currentNodes.some(n => (n.id || n) === cid)),
        ...unknowns
    ];

    if (desiredIdOrder.length === 0) return null;

    // Build order array: order[i] = current index of the desired-i-th node.
    const order = desiredIdOrder
        .map(id => currentNodes.findIndex(n => (n.id || n) === id))
        .filter(idx => idx !== -1);

    if (order.length === 0) return null;

    // Idempotent check: already canonical?
    const alreadySorted = order.every((idx, i) => idx === i);
    if (alreadySorted) return null;

    return order;
};

// -- terrain sub-order helpers (TASK-1902) ------------------------------------

/**
 * Identify the contour overlay for a DEM layer.
 *
 * Convention (from buildContourLayer in gwcTileRouting.js):
 *   id = `${demLayerName}__contours`  (canonical; used when layer comes from blob)
 *   OR name === demLayerName && style === DEM_CONTOUR_STYLE_NAME
 *
 * @param {Array}  flatLayers  state.layers.flat
 * @param {string} demLayerName  bare DEM layer name (e.g. 'ele_518_dem_cog')
 * @returns {object|null}
 */
export const findContourLayer = (flatLayers, demLayerName) => {
    if (!demLayerName) return null;
    const bare = bareName(demLayerName);
    return (flatLayers || []).find(
        l => l?.id === `${bare}__contours` ||
             (bareName(l?.name) === bare && l?.style === DEM_CONTOUR_STYLE_NAME)
    ) || null;
};

/**
 * Compute the desired ordering of layers within the 'Input Data.Terrain' group.
 *
 * Canonical sub-order per terrain cluster: [contour, dem, hillshade]
 *   - contour: visually ON TOP (index 0 in nodes = top of z-stack)
 *   - dem: DEM colourmap below contour lines
 *   - hillshade: underneath dem (provides lighting/shadow)
 *
 * Inter-terrain order (which terrain cluster sits above another) is PRESERVED
 * from the current node order — the reconciler only fixes the WITHIN-terrain
 * 3-layer sequence, not the cross-terrain ranking.
 *
 * Hillshade is resolved via the gn_layer_hillshade_name FK on the terrain model
 * (NOT a "/hillshade/" name substring).
 *
 * @param {Array}  currentNodes  the terrain group's nodes[] (layer IDs or node objects)
 * @param {Array}  flatLayers    state.layers.flat
 * @param {Array}  terrainModels state.anuga.resources.terrain (with gn_layer_name,
 *                               gn_layer_hillshade_name fields)
 * @returns {Array|null}  order[] for sortNode, or null if already canonical
 */
export const computeTerrainSubOrder = (currentNodes, flatLayers, terrainModels) => {
    if (!currentNodes || currentNodes.length < 2) return null;

    // For each node ID, build a lookup of current index.
    const nodeIds = currentNodes.map(n => n?.id || n);

    // Build terrain clusters: for each model, gather [contourId, demId, hillshadeId]
    // that ARE present in the current Terrain group nodes.
    const clustered = [];
    const memberOf = {}; // nodeId → cluster index (for fast lookup)

    (terrainModels || []).forEach(model => {
        if (!model?.gn_layer_name) return;
        const demBare = bareName(model.gn_layer_name);
        const hsBare = model.gn_layer_hillshade_name ? bareName(model.gn_layer_hillshade_name) : null;

        // Find dem node in the terrain group: must match bare DEM name AND not be a
        // contour overlay (contour layer uses the same name but has style=DEM_CONTOUR_STYLE_NAME).
        const demId = nodeIds.find(id => {
            const layer = flatLayers.find(l => (l?.id || l) === id);
            return layer &&
                bareName(layer.name) === demBare &&
                layer.style !== DEM_CONTOUR_STYLE_NAME &&
                !id.endsWith('__contours');
        });
        if (!demId) return; // DEM not in map yet; skip

        // Find hillshade node via FK (gn_layer_hillshade_name), NOT substring.
        // Must not be the DEM itself.
        const hsId = hsBare ? nodeIds.find(id => {
            if (id === demId) return false;
            const layer = flatLayers.find(l => (l?.id || l) === id);
            return layer &&
                bareName(layer.name) === hsBare &&
                layer.style !== DEM_CONTOUR_STYLE_NAME;
        }) : null;

        // Find contour overlay
        const contourLayer = findContourLayer(flatLayers, demBare);
        const contourId = contourLayer ? nodeIds.find(id => id === contourLayer.id) : null;

        // Desired cluster order: contour (if present), dem, hillshade (if present)
        const cluster = [contourId, demId, hsId].filter(Boolean);
        const clusterIdx = clustered.length;
        cluster.forEach(id => { memberOf[id] = clusterIdx; });
        clustered.push({ cluster });
    });

    // Build the desired node order: walk current node order; when we encounter
    // the FIRST member of a cluster (by current position), emit the whole cluster
    // in canonical sub-order. Unclaimed nodes (not in any cluster) emit at their
    // current position. This preserves inter-terrain order because the cluster
    // anchor is the earliest-appearing member of that cluster.
    const emitted = new Set();
    const desired = [];
    const clusterEmitted = new Set();

    nodeIds.forEach(id => {
        if (emitted.has(id)) return;

        const cIdx = memberOf[id];
        if (cIdx !== undefined) {
            if (!clusterEmitted.has(cIdx)) {
                // First encounter of this cluster — emit all cluster members in canonical order
                clustered[cIdx].cluster.forEach(cid => {
                    if (nodeIds.includes(cid) && !emitted.has(cid)) {
                        desired.push(cid);
                        emitted.add(cid);
                    }
                });
                clusterEmitted.add(cIdx);
            }
            // Subsequent members of this cluster are already emitted; skip.
        } else {
            desired.push(id);
            emitted.add(id);
        }
    });

    // Idempotent check
    if (desired.length !== nodeIds.length) return null;
    const alreadySorted = desired.every((id, i) => id === nodeIds[i]);
    if (alreadySorted) return null;

    // Build order array: order[i] = index in nodeIds of the i-th desired element
    return desired.map(id => nodeIds.indexOf(id)).filter(idx => idx !== -1);
};

// -- epics --------------------------------------------------------------------

/**
 * Reconciler epic: re-asserts canonical sub-group order after map load and
 * after any ADD_LAYER. Dispatches sortNode(parent, order, sortLayers) for each
 * group that is out of order, then a single saveDirectContent when at least one
 * group was reordered.
 */
export const layerOrderReconcilerEpic = (action$, store) =>
    action$
        .ofType(FIX_ANUGA_GROUPS, ADD_LAYER)
        // On FIX_ANUGA_GROUPS: defer so ensureAnugaGroupsEpic has created the
        // group nodes first (500ms matches anugaMapLayerGroupEpic's delay).
        // On ADD_LAYER: debounce to coalesce rapid sequential adds (e.g. a full
        // scenario payload) into one reconcile pass.
        .debounceTime(600)
        .switchMap(() => {
            const state = store.getState();

            // Editor-gate: viewers/anonymous cannot persist.
            if (!canEditAnugaMap(state)) return Rx.Observable.empty();

            const groups = state?.layers?.groups || [];
            const actions = [];

            Object.entries(ANUGA_GROUPS).forEach(([parentId, canonicalChildren]) => {
                const order = computeReorderFor(groups, parentId, canonicalChildren);
                if (order !== null) {
                    actions.push(sortNode(parentId, order, sortLayers));
                }
            });

            if (actions.length === 0) return Rx.Observable.empty();

            // Emit all sortNode actions + one saveDirectContent at the end.
            return Rx.Observable.from([...actions, saveDirectContent()]);
        });

// -- intra-Results ordering helpers (TASK-1903) --------------------------------
//
// Intra-Results ordering policy (documented per spec):
//   1. LATEST RUN ON TOP: within each Results.* sub-group (Depth, Momentum,
//      Velocity, etc.) layers are sorted by run ID descending so the most recent
//      run's result is always highest in the z-stack.
//      Run ID is extracted from the layer name pattern "run<N>_..." (e.g.
//      "run1257_depth_max_cog" → 1257). Layers without a parseable run ID sort
//      AFTER layers with one (least priority).
//   2. COMPARISON vs ABSOLUTE: each comparison result already lives in its own
//      dedicated sub-group (Results.Comparison: Depth, etc.); the sub-group
//      ORDER within the Results band is governed by ANUGA_GROUPS['Results'].
//      In Phase-1 (this wave), comparison diffs are kept BELOW the absolute
//      result sub-groups (i.e. ANUGA_GROUPS['Results'] = ['Depth', 'Momentum',
//      'Velocity', 'Comparison: Velocity', 'Comparison: Depth', 'Comparison:
//      'Momentum']). This means absolute results paint OVER comparison diffs.
//      Phase-2 may introduce a tree-flatten to interleave them by run (deferred
//      per TASK-1901 comment#1071).

/**
 * Extract the numeric run ID from a result layer name.
 * Pattern: "run{id}_{rest}" or "geonode:run{id}_{rest}".
 * Returns the run ID (integer) or -1 if the name doesn't match.
 *
 * @param {string} layerName
 * @returns {number}
 */
export const extractRunId = (layerName) => {
    if (!layerName) return -1;
    const match = bareName(layerName).match(/^run(\d+)_/);
    return match ? parseInt(match[1], 10) : -1;
};

/**
 * Compute the desired order for layers WITHIN a Results.* sub-group:
 * sort by run ID descending (latest run on top / nodes[0]).
 *
 * @param {Array}  currentNodes  the sub-group's nodes[] (layer IDs or node objects)
 * @param {Array}  flatLayers    state.layers.flat
 * @returns {Array|null}  order[] for sortNode, or null if already canonical
 */
export const computeResultsLayerOrder = (currentNodes, flatLayers) => {
    if (!currentNodes || currentNodes.length < 2) return null;

    const nodeIds = currentNodes.map(n => n?.id || n);

    // For each node, resolve the layer from flat and extract its run ID
    const withRunId = nodeIds.map(id => {
        const layer = (flatLayers || []).find(l => (l?.id || l) === id);
        return { id, runId: layer ? extractRunId(layer.name) : -1 };
    });

    // Pre-build a positionMap for O(1) tie-break lookup (avoids O(n) indexOf
    // per comparison when many non-run layers are present).
    const positionMap = new Map(nodeIds.map((id, i) => [id, i]));

    // Sort: layers with a valid run ID (≥ 0) first, by run ID descending.
    // Layers without a run ID (comparison diffs, non-run layers) sort last,
    // preserving their relative order among themselves.
    const sorted = withRunId.slice().sort((a, b) => {
        const aHas = a.runId >= 0;
        const bHas = b.runId >= 0;
        if (aHas && bHas) return b.runId - a.runId; // descending (latest first)
        if (aHas) return -1; // a has run ID, b doesn't → a first
        if (bHas) return 1;  // b has run ID, a doesn't → b first
        // Both lack run IDs: preserve current relative order via O(1) positionMap
        return positionMap.get(a.id) - positionMap.get(b.id);
    });

    const desiredIds = sorted.map(x => x.id);
    const alreadySorted = desiredIds.every((id, i) => id === nodeIds[i]);
    if (alreadySorted) return null;

    return desiredIds.map(id => nodeIds.indexOf(id)).filter(idx => idx !== -1);
};

/**
 * TASK-1902: Terrain sub-order reconciler.
 *
 * Fires on SET_ANUGA_TERRAIN_DATA (when terrain models are loaded, providing the
 * gn_layer_hillshade_name FK needed to identify hillshade layers). Re-asserts
 * the canonical within-terrain layer order: Contour > DEM > Hillshade for each
 * terrain cluster in the 'Input Data.Terrain' group.
 *
 * Preserves inter-terrain order (which terrain cluster is above another) — only
 * fixes the 3-layer sub-sequence within each cluster.
 *
 * Hillshade is resolved via gn_layer_hillshade_name FK, NOT a name substring.
 */
export const terrainSubOrderReconcilerEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_TERRAIN_DATA)
        .debounceTime(200)
        .switchMap(() => {
            const state = store.getState();

            if (!canEditAnugaMap(state)) return Rx.Observable.empty();

            const groups = state?.layers?.groups || [];
            const flat = state?.layers?.flat || [];
            const terrainModels = state?.anuga?.resources?.terrain || [];

            if (terrainModels.length === 0) return Rx.Observable.empty();

            const terrainGroupNode = getNode(groups, 'Input Data.Terrain');
            if (!terrainGroupNode || !terrainGroupNode.nodes || terrainGroupNode.nodes.length < 2) {
                return Rx.Observable.empty();
            }

            const order = computeTerrainSubOrder(terrainGroupNode.nodes, flat, terrainModels);
            if (order === null) return Rx.Observable.empty();

            return Rx.Observable.from([
                sortNode('Input Data.Terrain', order, sortLayers),
                saveDirectContent()
            ]);
        });

/**
 * TASK-1903: Intra-Results band ordering reconciler.
 *
 * Fires on ADD_LAYER (debounced) to sort layers within each Results.* sub-group
 * by run ID descending (latest run on top).
 *
 * Floater policy:
 *   - Layers with a parseable run ID (run<N>_*) sort by N descending (newest first).
 *   - Layers without a run ID (comparison diffs, misc layers) sort after
 *     the run layers, preserving their current relative order.
 *   - The intra-sub-group sort is idempotent: emits nothing when already canonical.
 *
 * This does NOT touch the sub-group order (Results.Depth vs Results.Momentum) —
 * that is handled by layerOrderReconcilerEpic (TASK-1901). It only reorders
 * individual layers WITHIN each Results.* sub-group.
 */
export const resultsLayerOrderEpic = (action$, store) =>
    action$
        .ofType(ADD_LAYER)
        .debounceTime(600)
        .switchMap(() => {
            const state = store.getState();
            if (!canEditAnugaMap(state)) return Rx.Observable.empty();

            const groups = state?.layers?.groups || [];
            const flat = state?.layers?.flat || [];
            const actions = [];

            // Iterate over all Results.* sub-groups
            (ANUGA_GROUPS['Results'] || []).forEach(childName => {
                const groupId = `Results.${childName}`;
                const groupNode = getNode(groups, groupId);
                if (!groupNode || !groupNode.nodes || groupNode.nodes.length < 2) return;

                const order = computeResultsLayerOrder(groupNode.nodes, flat);
                if (order !== null) {
                    actions.push(sortNode(groupId, order, sortLayers));
                }
            });

            if (actions.length === 0) return Rx.Observable.empty();
            return Rx.Observable.from([...actions, saveDirectContent()]);
        });
