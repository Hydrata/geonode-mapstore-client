/*
 * TASK-1990 (W1.1) — Click-target registry (map-click disambiguation).
 *
 * WHY THIS EXISTS
 * ---------------
 * Map-click disambiguation needs to turn a GetFeatureInfo FeatureCollection
 * into a list of "things you can open" and then OPEN one of them. Each
 * click-target declares three behaviours:
 *
 *   match(featureId, layerName) -> bool                 (does this feature belong to me?)
 *   label(feature)              -> {title, subtitle, icon}  (how to show me in a chooser)
 *   buildOpenActions(feature, getState) -> Action[]     (the plain Redux actions that open me)
 *
 * Those behaviours are FUNCTIONS. They MUST NOT ride inside a dispatched
 * Redux action or be parked in Redux state — that is the exact prod-only
 * trap the sibling VectorDraw/discriminatorRegistry.js:1-44 documents: on
 * PRODUCTION, OpenReplay's tracker-redux middleware does
 * `Worker.postMessage(action)` for every dispatched action; postMessage uses
 * the structured-clone algorithm, which CANNOT serialize functions and throws
 * an uncaught DataCloneError. Localhost has no OpenReplay so it ships broken.
 *
 * THE INVARIANT (D6)
 * ------------------
 * The match/label/buildOpenActions functions live MODULE-SIDE only, keyed by a
 * serializable `kind` string in this registry. The classifier epic resolves a
 * target with getClickTarget(kind) and calls buildOpenActions AT CONSUMPTION
 * TIME, dispatching the RESULTING plain actions. The functions themselves never
 * enter an action or state; actions/state carry only plain data
 * ({kind, featureId, layerName, label}, where label is the RESOLVED plain
 * object — call label(feature) at classify time and store the result).
 *
 * Shape-mirrors widgetRegistry.js / translateRegistry.js / discriminatorRegistry.js
 * (register / get / getAll / clean, keyed by a string, resolved at consumption
 * time, no functions in Redux). Unlike widgetRegistry there are NO defaults
 * registered at module load — callers (e.g. the ANUGA registration in
 * anugaClickTargets.js) register explicitly, so tests can clean() freely.
 *
 * LONGEST-PREFIX / ID-PATTERN MATCHING is the responsibility of each target's
 * own match() — e.g. the ANUGA targets delegate to getAnugaPrefix() which
 * resolves the longest matching prefix, making the per-target matches mutually
 * exclusive by construction. This registry is a plain keyed store; the epic
 * walks getAllClickTargets() and asks each match().
 */

let clickTargets = {};

// Register a click-target under a serializable `kind` string. Defensive:
// ignores entries with no kind or no match() (mirrors widgetRegistry.register).
// label / buildOpenActions fall back to safe no-op shapes so a partial target
// can never crash the classifier.
export const registerClickTarget = (kind, target) => {
    if (!kind || !target || typeof target.match !== 'function') {
        return;
    }
    clickTargets[kind] = {
        match: target.match,
        label: typeof target.label === 'function'
            ? target.label
            : () => ({ title: kind, subtitle: '', icon: '' }),
        buildOpenActions: typeof target.buildOpenActions === 'function'
            ? target.buildOpenActions
            : () => [],
        // W3 — read-only flag. true = this target is a view/readout, NOT an EDIT opener.
        // The classifier epic routes read-only candidates AROUND the edit-perms gate
        // (filterEditableCandidates) and instead checks layer visibility only.
        readOnly: target.readOnly === true
    };
};

// Resolve the {match, label, buildOpenActions} target for a kind, or undefined
// if unregistered (unknown kind -> no match).
export const getClickTarget = (kind) => clickTargets[kind];

export const getAllClickTargets = () => clickTargets;

export const cleanClickTargets = () => {
    clickTargets = {};
};

/**
 * Parse a GetFeatureInfo feature id of the form "<layerName>.<fid>" on the
 * LAST dot (per the W0 gate). The layerName is "<prefix>_<resourceId>_<slug>";
 * the slug never contains a dot, so splitting on the last dot is safe. Returns
 * {layerName, fid} or null for empty / dotless / trailing-dot ids.
 *
 * Raster GFI features come back with id="" (empty) — those return null here so
 * the classifier filters them out (rasters are handled in W3.2, not W1).
 *
 *   parseFeatureId('bdy_659_boundary_01.5') -> {layerName:'bdy_659_boundary_01', fid:'5'}
 *   parseFeatureId('')                      -> null
 *   parseFeatureId('no_dot')                -> null
 *   parseFeatureId('trailing.')             -> null
 *
 * Pure string transform — no Redux, no axios. Lives here (not in the epic) so
 * both the classifier epic and the per-target buildOpenActions parse identically.
 */
export const parseFeatureId = (featureId) => {
    if (typeof featureId !== 'string' || featureId === '') {
        return null;
    }
    const lastDot = featureId.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === featureId.length - 1) {
        return null;
    }
    return {
        layerName: featureId.slice(0, lastDot),
        fid: featureId.slice(lastDot + 1)
    };
};
