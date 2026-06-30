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
 * LIVE-WIRING: registered into the live Anuga plugin epics list in W2.3
 * (TASK-1995, Anuga.js). The live activation + gating is: require Identify ON
 * (anugaIdentifyEnableEpic) AND application/json info_format
 * (anugaIdentifyJsonFormatEpic — W2 corrective: the live Identify default is
 * text/plain, which this classifier's FeatureCollection guard would drop on
 * every real click), and suppress during a VectorDraw draw/edit phase.
 */
import Rx from 'rxjs';
import {
    LOAD_FEATURE_INFO,
    FEATURE_INFO_CLICK,
    toggleMapInfoState,
    changeMapInfoFormat,
    purgeMapInfoResults,
    hideMapinfoMarker
} from '../../../../../MapStore2/web/client/actions/mapInfo';
import {
    getAllClickTargets,
    getClickTarget,
    parseFeatureId
} from '../../shared/clickTargetRegistry';
import {
    showClickDisambiguation,
    hideClickDisambiguation,
    armClickAggregation
} from '../actions/clickDisambiguationActions';
import { canEditLayer, getProjectMyRole } from '../selectorsAnuga';
import { SET_ANUGA_PROJECT_DATA } from '../actions/dataActions';

// Normalise a resolved label() result to a plain {title, subtitle, icon}.
// Coerce each VALUE to a String (not just whitelist the keys): a future
// read-only / W3 target whose label() returns a function- or object-valued
// title would otherwise pass the raw value straight through into Redux state +
// React render (D6 serialization + render hazard). String(...) guarantees a
// scalar string for every field.
const plainLabel = (label) => ({
    title: String(label?.title || ''),
    subtitle: String(label?.subtitle || ''),
    icon: String(label?.icon || '')
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
 *
 * VECTOR PATH (non-empty featureId):
 *   Filters un-parseable ids and features that match no registered target.
 *   label() is resolved HERE (classify time) and stored as a plain object.
 *
 * RASTER PATH (empty featureId, W3.2):
 *   Raster coverage hits have id="" (empty).  The epic annotates each feature
 *   with _anugaLayerName (from action.layer.name) so we can match them here.
 *   Only readOnly-tagged registry targets handle the raster path.  The value is
 *   encoded in a SYNTHETIC featureId of the form "<layerName>#raster[=<val>]"
 *   so it survives the candidate->panel->opener round-trip (C5 note: GRAY_INDEX
 *   assumed; see rasterClickTargets.js).
 */
export const buildCandidates = (featureCollection) => {
    const features = (featureCollection && featureCollection.features) || [];
    const candidates = [];
    features.forEach((feature) => {
        const featureId = feature && feature.id;

        // RASTER PATH — empty id but layer name was annotated by the classify$ stream
        if (!featureId) {
            const rawLayerName = feature && feature._anugaLayerName;
            if (!rawLayerName) { return; }                      // no annotation, skip
            const layerName = rawLayerName.replace(/^[^:./]+:/, '');  // strip workspace
            const kind = resolveKind('', layerName);
            if (!kind) { return; }                              // no registered raster target
            const target = getClickTarget(kind);
            if (!target || !target.readOnly) { return; }        // rasters must be readOnly
            let label;
            try {
                label = target.label(feature);
            } catch (e) {
                label = null;
            }
            // Encode the band value in the synthetic featureId so buildOpenActions can
            // recover it at click time (via the panel's resolveCandidateOpenActions path
            // which passes only {id: candidate.featureId} — no original feature).
            // The value lives in label.subtitle but encoding it in the id is more robust.
            const rawValue = (() => {
                // Mirror extractBandValue from rasterClickTargets without importing it
                // (avoids potential circular dep); read GRAY_INDEX or first numeric prop.
                const props = feature && feature.properties;
                if (!props) { return null; }
                if (typeof props.GRAY_INDEX === 'number') { return props.GRAY_INDEX; }
                const first = Object.values(props).find((v) => typeof v === 'number');
                return first !== undefined ? first : null;
            })();
            const syntheticFeatureId = rawValue !== null
                ? `${layerName}#raster=${rawValue}`
                : `${layerName}#raster`;
            candidates.push({ kind, featureId: syntheticFeatureId, layerName, label: plainLabel(label) });
            return;
        }

        // VECTOR PATH — parse featureId to extract layerName
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
 * MAP-level edit gate — mirrors the SimpleView pencil's canEditMap exactly.
 *
 * The pencil renders on `canEditMap && canEditLayer` (simpleViewMenuRow.js:502),
 * where canEditMap = `!isExcludedSite && initialResource.perms.includes(
 * 'change_resourcebase')` (simpleViewMenuRow.js:1033-1034 + 1092). There is NO
 * shared excluded-sites helper to import — the list is an inline ["placeholder.com"]
 * in simpleViewMenuRow (with a TODO there to move it to localConfig), so we
 * replicate the SAME expression (optional-chaining the geonodeUrl read so an
 * absent gnsettings can never throw inside this epic).
 */
const SV_EXCLUDED_SITES = ['placeholder.com'];
const isExcludedSite = (state) =>
    SV_EXCLUDED_SITES.map((site) => !state?.gnsettings?.geonodeUrl?.includes(site)).includes(false);
const canEditMap = (state) =>
    !isExcludedSite(state)
    && state?.gnresource?.initialResource?.perms?.includes('change_resourcebase') === true;

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
 * W2 self-verify FIX: ALSO require canEditMap, so a map click is never MORE
 * permissive than the pencil (which is canEditMap && canEditLayer). A contributor
 * / viewer who holds a layer-level grant but lacks change_resourcebase on the MAP
 * must NOT get an EDIT opener.
 *
 * W3 HOOK: every registered click-target today is an EDIT opener, so we gate
 * ALL candidates on canEditMap && canEditLayer. When W3 (TASK-1996/1997) adds
 * READ-ONLY targets (legacy view-attributes / raster value-readout), those are
 * NOT canEditMap- or edit-gated — they respect visibility instead. At that point,
 * tag read-only targets on the registry and route them around BOTH gates here
 * (only edit-openers pass through this filter).
 */
const canEditCandidateLayer = (candidate, state) => {
    // Map-level gate first: never out-permission the pencil.
    if (!canEditMap(state)) { return false; }
    const layer = findLayerForCandidate(candidate, state);
    if (!layer) { return false; }
    return canEditLayer(layer, undefined, getProjectMyRole(state), state?.security?.user?.pk) === true;
};

export const filterEditableCandidates = (candidates, state) =>
    (candidates || []).filter((c) => canEditCandidateLayer(c, state));

/**
 * W3 VISIBILITY GATE — for read-only targets (legacy view-attrs / raster
 * readout), we respect layer VISIBILITY rather than edit permissions. A layer
 * that is turned off in the map (visibility:false) should not produce a
 * disambiguation candidate even in read-only mode. Falls through to false when
 * the layer is absent from state.layers.flat (belt-and-suspenders).
 */
export const isLayerVisible = (candidate, state) => {
    const layer = findLayerForCandidate(candidate, state);
    if (!layer) { return false; }
    // layer.visibility defaults to true; only explicit false hides it.
    return layer.visibility !== false;
};

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

// W2 CORRECTIVE-3 (epic 1969) — per-click aggregation window. MapStore's
// getFeatureInfoOnFeatureInfoClick (MapStore2 epics/identify.js) `mergeMap`s over
// EACH queryable layer and dispatches a SEPARATE LOAD_FEATURE_INFO per layer, each
// carrying only THAT layer's features. ANUGA's editable objects live in SEPARATE
// GeoServer layers (boundary / inflow / rainfall / structure / …), so one click =
// a BURST of single-layer LOAD_FEATURE_INFO actions. We buffer the burst until it
// goes quiet, then classify the UNION — otherwise the >=2 disambiguation panel
// (the W2.1 headline feature) NEVER fires for the normal cross-layer case and
// multiple 1-candidate opens race (last layer wins). 300ms is comfortably longer
// than the parallel GFI round-trips of one click yet short enough to feel instant;
// a straggler layer slower than this just lands in a follow-up (rare, benign).
// Mirrors swamm's catchBmpFeatureClick INTENT, but swamm's BMP types share ONE
// layer so a single response already carried them all — ANUGA must aggregate.
export const CLICK_AGGREGATION_DEBOUNCE_MS = 300;

/**
 * Classify the UNION of all features under one click into editable candidates and
 * produce the open/disambiguate actions. `allFeatures` is the concatenation of
 * every buffered LOAD_FEATURE_INFO's `data.features` for a single click.
 *   0 candidates -> []      (let the default Identify popup show; do NOT swallow it)
 *   1 candidate  -> teardown + that target's buildOpenActions() (open directly)
 *   >=2          -> teardown + showClickDisambiguation(candidates) (panel = W2.1)
 */
export const buildClickActions = (allFeatures, store) => {
    const state = store.getState();
    // TASK-1995 (W2.3) — drawing-mode guard: never hijack a click while a
    // VectorDraw draw/edit phase is active. A mid-draw GFI click must flow to the
    // active VectorDraw flow, not pop the disambiguation list.
    if (isVectorDrawActive(state)) {
        // The click belongs to the active draw/edit flow, not disambiguation.
        // hideClickDisambiguation() clears the W2-corrective-4 `aggregating` flag so
        // the deferred dock is released (pre-fix behaviour: the default popup may show).
        return [hideClickDisambiguation()];
    }
    // W3 (TASK-1996/1997) — C1 PERMS-GATE PARTITION:
    // Classify ALL candidates (edit + read-only), then route them through separate
    // gates before re-unioning for the 0/1/>=2 branch.
    //
    //   EDIT candidates   → filterEditableCandidates (canEditMap && canEditLayer)
    //   READ-ONLY targets → isLayerVisible only (bypasses the edit-perms gate;
    //                        registry target.readOnly === true is the tag)
    //
    // The registry lookup at candidate.kind drives the partition: if the registered
    // target is flagged readOnly the candidate is read-only, otherwise it is edit.
    const allCandidates = buildCandidates({ type: 'FeatureCollection', features: allFeatures });
    const editCandidates = filterEditableCandidates(
        allCandidates.filter((c) => !getClickTarget(c.kind)?.readOnly),
        state
    );
    const readOnlyCandidates = allCandidates
        .filter((c) => getClickTarget(c.kind)?.readOnly)
        .filter((c) => isLayerVisible(c, state));
    const candidates = [...editCandidates, ...readOnlyCandidates];
    if (candidates.length === 0) {
        // 0-candidate fallthrough (invariant #1): let the default Identify popup show.
        // hideClickDisambiguation() clears `aggregating` WITHOUT purging, so the
        // surviving GFI responses (requests[] intact) render the default popup as the
        // FINAL state — revealed once, not flashed. The W2-corrective-4 flag is what
        // kept the dock deferred during the 300ms aggregation window; clearing it here
        // is the deliberate REVEAL.
        return [hideClickDisambiguation()];
    }
    // W2 self-verify FIX — a CANDIDATE-handled click must not leave the default
    // Identify (GetFeatureInfo) attribute popup + click marker showing UNDER the
    // edit form / disambiguation panel (the double-UI bug). Tear them down FIRST in
    // BOTH the 1-candidate and >=2 branches. purgeMapInfoResults() clears the GFI
    // responses/requests so the popup panel stops rendering
    // (reducers/mapInfo.js PURGE_MAPINFO_RESULTS) and hideMapinfoMarker() clears the
    // click marker — the HGeval precedent (epicsHGeval.js:222-223). Both directly
    // mutate the mapInfo reducer, so suppression does NOT depend on the downstream
    // CLOSE_IDENTIFY epics being registered. The 0-candidate branch above
    // intentionally does NOT tear down (it must let the default Identify popup show).
    const identifyTeardown = [purgeMapInfoResults(), hideMapinfoMarker()];
    if (candidates.length === 1) {
        const candidate = candidates[0];
        const target = getClickTarget(candidate.kind);
        // For VECTOR candidates, find the original GFI feature (has full properties).
        // For RASTER candidates, featureId is a SYNTHETIC string (e.g. "ele_42_cog#raster=12.3")
        // that won't match any real feature; fall back to {id: candidate.featureId} so the
        // opener can recover the encoded band value via parseRasterFeatureId.
        const feature = allFeatures.find((f) => f && f.id === candidate.featureId)
            || { id: candidate.featureId };
        let openActions = [];
        try {
            openActions = target.buildOpenActions(feature, store.getState) || [];
        } catch (e) {
            console.error('clickDisambiguationEpic: buildOpenActions failed', e);
            openActions = [];
        }
        // purge FIRST (empties requests[] -> dock already closed), THEN clear the
        // W2-corrective-4 `aggregating` flag, THEN open: ordering so the flag-clear can
        // never re-open the dock (requests are already empty when aggregating goes false).
        return [...identifyTeardown, hideClickDisambiguation(), ...openActions];
    }
    // >=2: showClickDisambiguation() alone clears `aggregating` in the reducer (the
    // panel reads only state.anuga.clickDisambiguation.candidates, independent of the purge).
    return [...identifyTeardown, showClickDisambiguation(candidates)];
};

export const clickDisambiguationEpic = (action$, store) => {
    // Only the application/json FeatureCollection path is supported (text/plain
    // drops the per-feature layer-name prefix needed to disambiguate — W0 gate;
    // anugaIdentifyJsonFormatEpic guarantees json on ANUGA maps). Non-json /
    // empty responses fall through untouched (never buffered).
    const featureInfo$ = action$
        .ofType(LOAD_FEATURE_INFO)
        .filter((action) => action && action.data && action.data.type === 'FeatureCollection');
    // W2-corrective-4 (epic 1969) — the "Identify-dock flash" fix. MapStore's default
    // Identify dock is open while requests[] is in flight (IdentifyContainer.jsx:117
    // `open={enabled && requests.length !== 0}`), so during the 300ms aggregation window
    // it renders the accumulating GFI responses, and FIX-1's purge only fires at flush
    // -> a ~300ms flash. We ARM an `aggregating` flag at the START of the burst (the core
    // dock gate AND-s in `!aggregating`); the branch CLEARS it at flush.
    //
    // Arm ONCE per click, on the FIRST FeatureCollection of the burst:
    //   switchMap(FEATURE_INFO_CLICK) is the per-click latch — take(1) arms once and
    //   ignores every later/straggler response of the SAME click (so a layer that answers
    //   after the 0-candidate reveal can NOT re-suppress the just-revealed popup), and a
    //   NEW click starts a fresh inner. Epic-driven (not reducer-driven on raw
    //   LOAD_FEATURE_INFO) so SET shares the epic's page-scope with CLEAR: a stuck flag on
    //   a muted preview/dataset page is structurally impossible. Arming on the first
    //   FeatureCollection (not on FEATURE_INFO_CLICK) guarantees a buffer flush — and thus
    //   a clear — always follows, since the arm trigger IS the buffer's input.
    const arm$ = action$
        .ofType(FEATURE_INFO_CLICK)
        .switchMap(() => featureInfo$.take(1).mapTo(armClickAggregation()));
    // Buffer the per-layer burst of one click (flush CLICK_AGGREGATION_DEBOUNCE_MS
    // after the last response; in unit tests the source completes, which also
    // flushes the buffer), then classify the cross-layer UNION and branch once.
    const classify$ = featureInfo$
        .buffer(featureInfo$.debounceTime(CLICK_AGGREGATION_DEBOUNCE_MS))
        .filter((batch) => batch.length > 0)
        .switchMap((batch) => {
            // W3.2 (TASK-1997) — annotate each feature with the layer name from the
            // action so buildCandidates can identify raster features (featureId="")
            // by their source layer. Vector features (non-empty featureId) already
            // encode the layer name inside their id; rasters do not.
            const allFeatures = batch.reduce((acc, action) => {
                const features = (action.data && action.data.features) || [];
                const layerName = action.layer && action.layer.name;
                return acc.concat(features.map((f) =>
                    layerName ? Object.assign({}, f, { _anugaLayerName: layerName }) : f
                ));
            }, []);
            return Rx.Observable.from(buildClickActions(allFeatures, store));
        });
    return Rx.Observable.merge(arm$, classify$);
};

/**
 * TASK-1995 (W2.3) — ensure the Identify (GetFeatureInfo) tool is ON for ANUGA
 * maps so map clicks actually emit LOAD_FEATURE_INFO for clickDisambiguationEpic
 * to classify. Mirrors hgevalMapClickManagerEpic's enable/disable discipline,
 * inverted: HGeval DISABLES identify around its click-capture mode; ANUGA's
 * disambiguation NEEDS it enabled.
 *
 * W2 self-verify FIX — fire AT MOST ONCE for the session: the FIRST
 * SET_ANUGA_PROJECT_DATA seen while identify is explicitly disabled flips it on,
 * then the stream completes (.take(1) after the enabled===false filter).
 * SET_ANUGA_PROJECT_DATA also fires on many LATER refresh paths (membership ops,
 * dataset rename, terrain add); without the one-shot guard a user who deliberately
 * turned Identify OFF would have it flipped back ON by the next refresh. The
 * one-shot ensures-on on first load and never fights a later deliberate off-toggle
 * (the .take(1) equivalent of hgevalMapClickManagerEpic tracking what IT changed).
 */
export const anugaIdentifyEnableEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .filter(() => store.getState()?.mapInfo?.enabled === false)
        .take(1)
        .mapTo(toggleMapInfoState());

/**
 * W2 CORRECTIVE (epic 1969) — force the Identify info_format to application/json
 * for ANUGA maps.
 *
 * THE BUG this fixes: clickDisambiguationEpic only classifies an
 * application/json GFI FeatureCollection (text/plain drops the per-feature
 * layer-name prefix the classifier needs — the W0 D2 decision). But MapStore's
 * live Identify default info_format is **text/plain**, and nothing on an ANUGA
 * map ever requested application/json. So EVERY real map click returned a
 * text/plain "no features were found" blob that the epic's
 * `data.type !== 'FeatureCollection'` guard dropped — disambiguation never
 * fired on a real click. (The W2 self-verify used a SYNTHETIC, hand-built
 * FeatureCollection dispatch, which bypassed the live text/plain Identify path
 * and masked this; it only surfaces on a real on-map click against the live
 * GetFeatureInfo wiring.)
 *
 * Mirrors anugaIdentifyEnableEpic's one-shot discipline: the FIRST
 * SET_ANUGA_PROJECT_DATA seen while the format is not already application/json
 * flips it, then the stream completes (.take(1) after the format filter).
 * SET_ANUGA_PROJECT_DATA also fires on many LATER refresh paths (membership ops,
 * dataset rename, terrain add); the one-shot ensures-json on first load and
 * never fights a user who later deliberately switches the Identify format.
 *
 * Trade-off (documented; cheaper option chosen): this sets the GLOBAL
 * mapInfo.configuration.infoFormat, so the default Identify popup for the
 * 0-candidate fallthrough also renders application/json (a structured attribute
 * table — equivalent-or-richer than text/plain, all queryable layers on an
 * ANUGA map are GeoServer WMS that serve application/json). A more surgical
 * per-ANUGA-vector-layer featureInfo.format would avoid touching the global
 * default, but costs a hook into layer creation; deferred as an IMPROVEMENT.
 */
export const anugaIdentifyJsonFormatEpic = (action$, store) =>
    action$
        .ofType(SET_ANUGA_PROJECT_DATA)
        .filter(() => store.getState()?.mapInfo?.configuration?.infoFormat !== 'application/json')
        .take(1)
        .mapTo(changeMapInfoFormat('application/json'));
