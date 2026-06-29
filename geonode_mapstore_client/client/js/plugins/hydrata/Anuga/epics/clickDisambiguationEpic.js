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
import { LOAD_FEATURE_INFO, toggleMapInfoState } from '../../../../../MapStore2/web/client/actions/mapInfo';
import {
    getAllClickTargets,
    getClickTarget,
    parseFeatureId
} from '../../shared/clickTargetRegistry';
import { showClickDisambiguation } from '../actions/clickDisambiguationActions';
import { canEditLayer, getProjectMyRole } from '../selectorsAnuga';
import { SET_ANUGA_PROJECT_DATA } from '../actions/dataActions';

// Normalise a resolved label() result to a plain {title, subtitle, icon}.
const plainLabel = (label) => ({
    title: label?.title || '',
    subtitle: label?.subtitle || '',
    icon: label?.icon || ''
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

// Strip an optional leading workspace namespace ("geonode:") so a BARE GFI
// layer name matches the workspace-qualified state.layers.flat name.
const bareLayerName = (name) => String(name || '').replace(/^[^:./]+:/, '');

/**
 * Resolve the live MapStore layer for a candidate by (namespace-insensitive)
 * name. state.layers.flat carries "geonode:<layer>"; the candidate's layerName
 * comes straight off the GFI feature id (usually bare). Returns null if absent.
 */
const findLayerForCandidate = (candidate, state) => {
    const flat = (state && state.layers && state.layers.flat) || [];
    const target = bareLayerName(candidate && candidate.layerName);
    return flat.find((l) => l && bareLayerName(l.name) === target) || null;
};

/**
 * TASK-1994 (W2.2) — EDIT-permission gate.
 *
 * Reuses the EXACT my-perms / canEditLayer helper the SimpleView edit pencil
 * uses (selectorsAnuga.canEditLayer with anugaResources=undefined → layer.perms
 * + project my_role, simpleViewMenuRow.onEdit gate) so a map click can never
 * open the EDIT flow on a layer the user may not edit. This is the ANUGA
 * my-perms edit-gate, separate from (and NOT a substitute for) GeoNode resource
 * perms. Fail-closed: if the layer can't be resolved in state.layers.flat we
 * DROP the candidate — a map click must not become a perms bypass.
 *
 * W3 HOOK: every registered click-target today is an EDIT opener, so we gate
 * ALL candidates. When W3 (TASK-1996/1997) adds READ-ONLY targets (legacy
 * view-attributes / raster value-readout), those are NOT edit-gated — they
 * respect visibility instead. At that point, tag read-only targets on the
 * registry and skip them here (only edit-openers pass through this filter).
 */
const canEditCandidateLayer = (candidate, state) => {
    const layer = findLayerForCandidate(candidate, state);
    if (!layer) { return false; }
    return canEditLayer(layer, undefined, getProjectMyRole(state), state?.security?.user?.pk) === true;
};

export const filterEditableCandidates = (candidates, state) =>
    (candidates || []).filter((c) => canEditCandidateLayer(c, state));

/**
 * TASK-1995 (W2.3) — true while a VectorDraw draw/edit phase is in progress.
 * Mirrors the swammContainer vectorDrawActive gate: any phase other than the
 * resting 'idle' / transient 'cancelling' means the user is mid-flow and the
 * click belongs to that flow, NOT to disambiguation.
 */
export const isVectorDrawActive = (state) => {
    const phase = state?.vectorDraw?.phase;
    return !!phase && phase !== 'idle' && phase !== 'cancelling';
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
            const state = store.getState();
            // TASK-1995 (W2.3) — drawing-mode guard: never hijack a click while
            // a VectorDraw draw/edit phase is active. A mid-draw GFI click must
            // flow to the active VectorDraw flow, not pop the disambiguation list.
            if (isVectorDrawActive(state)) {
                return Rx.Observable.empty();
            }
            // Classify, then drop EDIT candidates on layers the user may not
            // edit (TASK-1994 W2.2) before branching on the count.
            const candidates = filterEditableCandidates(buildCandidates(data), state);
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

/**
 * TASK-1995 (W2.3) — ensure the Identify (GetFeatureInfo) tool is ON for ANUGA
 * maps so map clicks actually emit LOAD_FEATURE_INFO for clickDisambiguationEpic
 * to classify. Mirrors hgevalMapClickManagerEpic's enable/disable discipline,
 * inverted: HGeval DISABLES identify around its click-capture mode; ANUGA's
 * disambiguation NEEDS it enabled. Fires once on ANUGA project load and only
 * toggles when identify is explicitly disabled (no-op when already on / unset),
 * so it never fights the VectorDraw / bbox / profile draw tools that legitimately
 * toggle identify off mid-draw.
 */
export const anugaIdentifyEnableEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .filter(() => store.getState()?.mapInfo?.enabled === false)
        .mapTo(toggleMapInfoState());
