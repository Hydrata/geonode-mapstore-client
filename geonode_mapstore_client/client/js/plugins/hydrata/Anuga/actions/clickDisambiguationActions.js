/*
 * TASK-1991 (W1.2) — Map-click disambiguation actions.
 *
 * Plain serializable actions only (D6 — see shared/clickTargetRegistry.js).
 * `candidates` carries only {kind, featureId, layerName, label} where label is
 * the RESOLVED plain {title, subtitle, icon} object. No functions ever ride in
 * these payloads — the openers are resolved from the module-side registry
 * inside the classifier epic, never placed in an action.
 *
 * The chooser PANEL UI and the pick -> buildOpenActions resolution epic are
 * W2.1 (TASK-1993); these two actions are the spine the panel will consume.
 */

export const SHOW_CLICK_DISAMBIGUATION = 'ANUGA:SHOW_CLICK_DISAMBIGUATION';
export const HIDE_CLICK_DISAMBIGUATION = 'ANUGA:HIDE_CLICK_DISAMBIGUATION';
// W2-corrective-4 (epic 1969) — arm the "aggregating" flag that defers the default
// MapStore Identify dock while clickDisambiguationEpic buffers a per-click cross-layer
// GetFeatureInfo burst. Plain {type} only (D6). Dispatched by the epic (NOT the
// reducer) so SET shares the epic's page-scope with CLEAR — see clickDisambiguationEpic.
export const ARM_CLICK_AGGREGATION = 'ANUGA:ARM_CLICK_AGGREGATION';

export const showClickDisambiguation = (candidates) => ({
    type: SHOW_CLICK_DISAMBIGUATION,
    candidates
});

export const hideClickDisambiguation = () => ({
    type: HIDE_CLICK_DISAMBIGUATION
});

export const armClickAggregation = () => ({
    type: ARM_CLICK_AGGREGATION
});
