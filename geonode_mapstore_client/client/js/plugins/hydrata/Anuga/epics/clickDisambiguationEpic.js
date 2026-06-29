/*
 * TASK-1991 (W1.2) — Map-click disambiguation classifier epic.
 *
 * Mirrors the swamm flow (Swamm/epicsSwamm.js:129-189 catchBmpFeatureClick):
 * a GetFeatureInfo response (LOAD_FEATURE_INFO) is classified into a list of
 * openable candidates, then branched:
 *
 *   0 candidates -> no-op  (let the default Identify popup show; do NOT swallow it)
 *   1 candidate  -> dispatch that target's buildOpenActions() directly
 *   >=2          -> dispatch showClickDisambiguation(candidates) (panel = W2.1)
 *
 * D6 SERIALIZATION INVARIANT (shared/clickTargetRegistry.js): the registry's
 * match/label/buildOpenActions FUNCTIONS are resolved + invoked INSIDE this
 * epic. Only the RESULTING plain actions are dispatched. Candidate objects
 * carry only {kind, featureId, layerName, label} where label is the RESOLVED
 * plain {title, subtitle, icon} — no function ever reaches a dispatched action
 * or Redux state.
 *
 * LIVE-WIRING SAFETY: this epic is NOT registered into the live plugin epics
 * list in W1 — the live activation + gating (require Identify ON, suppress
 * during a VectorDraw draw/edit phase) is W2.3 (TASK-1995). It is exported for
 * unit tests only here.
 */
import Rx from 'rxjs';
import { LOAD_FEATURE_INFO } from '../../../../../MapStore2/web/client/actions/mapInfo';
import {
    getAllClickTargets,
    getClickTarget,
    parseFeatureId
} from '../../shared/clickTargetRegistry';
import { showClickDisambiguation } from '../actions/clickDisambiguationActions';

// Normalise a resolved label() result to a plain {title, subtitle, icon}.
const plainLabel = (label) => ({
    title: (label && label.title) || '',
    subtitle: (label && label.subtitle) || '',
    icon: (label && label.icon) || ''
});

/**
 * Resolve the single best-matching registered kind for a feature, or null.
 * Walks every registered target asking match(featureId, layerName); when more
 * than one matches (future overlapping targets), the LONGEST kind wins
 * (longest-prefix semantics). ANUGA targets are already mutually exclusive
 * (match delegates to getAnugaPrefix), so this is a belt-and-suspenders.
 */
const resolveKind = (featureId, layerName) => {
    const targets = getAllClickTargets();
    let best = null;
    Object.keys(targets).forEach((kind) => {
        let matched = false;
        try {
            matched = targets[kind].match(featureId, layerName) === true;
        } catch (e) {
            matched = false;
        }
        if (matched && (best === null || kind.length > best.length)) {
            best = kind;
        }
    });
    return best;
};

/**
 * Pure classifier: a GFI FeatureCollection -> ordered candidate list.
 * Filters empty-id features (rasters return id="") and un-parseable ids, and
 * any feature that matches no registered target. label() is resolved HERE
 * (classify time) and stored as a plain object.
 */
export const buildCandidates = (featureCollection) => {
    const features = (featureCollection && featureCollection.features) || [];
    const candidates = [];
    features.forEach((feature) => {
        const featureId = feature && feature.id;
        if (!featureId) { return; }              // filter empty-id (rasters)
        const parsed = parseFeatureId(featureId);
        if (!parsed) { return; }
        const { layerName } = parsed;
        const kind = resolveKind(featureId, layerName);
        if (!kind) { return; }
        let label;
        try {
            label = getClickTarget(kind).label(feature);
        } catch (e) {
            label = null;
        }
        candidates.push({ kind, featureId, layerName, label: plainLabel(label) });
    });
    return candidates;
};

export const clickDisambiguationEpic = (action$, store) =>
    action$
        .ofType(LOAD_FEATURE_INFO)
        .switchMap((action) => {
            const data = action && action.data;
            // Only the application/json FeatureCollection path is supported
            // (text/plain drops the per-feature layer-name prefix needed to
            // disambiguate — W0 gate). Anything else falls through untouched.
            if (!data || data.type !== 'FeatureCollection') {
                return Rx.Observable.empty();
            }
            const candidates = buildCandidates(data);
            if (candidates.length === 0) {
                // Let the default Identify popup show — do NOT swallow it.
                return Rx.Observable.empty();
            }
            if (candidates.length === 1) {
                const candidate = candidates[0];
                const target = getClickTarget(candidate.kind);
                const feature = (data.features || [])
                    .find((f) => f && f.id === candidate.featureId);
                let openActions = [];
                try {
                    openActions = target.buildOpenActions(feature, store.getState) || [];
                } catch (e) {
                    console.error('clickDisambiguationEpic: buildOpenActions failed', e);
                    openActions = [];
                }
                return Rx.Observable.from(openActions);
            }
            return Rx.Observable.of(showClickDisambiguation(candidates));
        });
