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
import { FIX_ANUGA_GROUPS } from '../actionsAnuga';
import { ANUGA_GROUPS } from './pollingEpics';

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

// -- epic ---------------------------------------------------------------------

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
