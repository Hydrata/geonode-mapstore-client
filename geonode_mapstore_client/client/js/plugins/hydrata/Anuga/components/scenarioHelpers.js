/**
 * Pure helpers for scenario time conversion and status display.
 */

import {TERMINAL_RUN_STATES} from '../anugaConstants';

// Mid-run statuses: a scenario is actively queued/building/computing. Shared by
// the header action strip (button disable while in flight) and the container's
// Build-and-Run state machine (which must observe a real build episode go
// in-flight before it fires the deferred run).
export const IN_FLIGHT_STATUSES = ['queued', 'computing', 'processing', 'building'];

// Failure half of the run lifecycle — TERMINAL_RUN_STATES minus the success
// 'complete'. Derived (not a hand-written literal) so it can never drift from
// the canonical terminal set in anugaConstants.js. The combined "Build and Run"
// drops its pending run when the awaited build reaches one of these.
export const RUN_FAILURE_STATES = TERMINAL_RUN_STATES.filter((s) => s !== 'complete');

export const getSecondsFromHHMM = (userInputValue) => {
    const [hours, minutes] = userInputValue.split(":");

    const hoursNumber = Number(hours);
    const minutesNumber = Number(minutes);

    if (!isNaN(hoursNumber) && isNaN(minutesNumber)) {
        return hoursNumber * 60;
    }

    if (!isNaN(hoursNumber) && !isNaN(minutesNumber)) {
        return (hoursNumber * 60 + minutesNumber) * 60;
    }

    return 0;
};

export const toHHMM = (secs) => {
    // Convert seconds to whole minutes, then split into zero-padded HH:MM (hours may exceed 99 for long durations).
    const n = Number(secs);
    if (!Number.isFinite(n) || n <= 0) {
        return '00:00';
    }
    const totalMinutes = Math.floor(n / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
};

// UAT #9 — the Run-tab duration entry is two dropdowns (Hours + Minutes). The
// stored field (scenario.duration) is unchanged: total SECONDS. These pure
// helpers convert between the stored seconds value and the {hours, minutes}
// the dropdowns bind to, so there is no unit drift.
export const DURATION_MAX_HOURS = 72;        // matches the approved Option-B mockup
export const DURATION_MINUTE_STEP = 5;       // minutes dropdown advances in 5s

/**
 * Split a stored duration (total seconds) into {hours, minutes} for the
 * two-dropdown widget. Minutes snap to the nearest DURATION_MINUTE_STEP and
 * hours clamp to DURATION_MAX_HOURS so the derived value always lands on a
 * selectable option. Display-only snapping never mutates the stored value —
 * the stored field changes only when the user picks a new option.
 */
export const secondsToHM = (secs) => {
    const n = Number(secs);
    if (!Number.isFinite(n) || n <= 0) {
        return {hours: 0, minutes: 0};
    }
    const totalMinutes = Math.floor(n / 60);
    let hours = Math.floor(totalMinutes / 60);
    let minutes = Math.round((totalMinutes % 60) / DURATION_MINUTE_STEP) * DURATION_MINUTE_STEP;
    if (minutes >= 60) {
        minutes = 0;
        hours += 1;
    }
    if (hours > DURATION_MAX_HOURS) {
        hours = DURATION_MAX_HOURS;
        minutes = 0;
    }
    return {hours, minutes};
};

/**
 * Inverse of secondsToHM — combine the two dropdown values back into the
 * stored seconds value. Negative/non-numeric inputs are floored at 0 so the
 * existing "duration > 0" build validation contract is preserved.
 */
export const hmToSeconds = (hours, minutes) => {
    const h = Math.max(0, Number(hours) || 0);
    const m = Math.max(0, Number(minutes) || 0);
    return (h * 60 + m) * 60;
};

export const findScenarioStatus = (scenario) => {
    return scenario?.computed_status || scenario?.status || 'created';
};

// TASK-2245 (epic 2237 W3.1) — RUN SETTINGS auto-expand predicate (a): the
// merged section (scenarioPane.js) must not hide the progress card + log
// viewer it hosts while a build/run is actively in flight, or once it has
// failed (the same combined-status test the notices panel's Run-failed
// member and the divergence machinery already key off). Pure + exported so
// scenarioPane.js's collapse hook and this file's own unit tests share one
// source rather than re-deriving the IN_FLIGHT_STATUSES-or-'error' check.
export const runSettingsMustStayOpen = (scenario) => {
    const status = findScenarioStatus(scenario);
    return IN_FLIGHT_STATUSES.includes(status) || status === 'error';
};

// W1.2 (TASK-2207, epic 2204) — maps Run.error_class (BE, TASK-2206) to the
// translation key for its human label. Null/unrecognised classes (pre-2206
// rows, or a class not in this map) resolve to undefined so the caller can
// skip rendering the cause line entirely rather than showing a broken key.
//
// P2-B (TASK-2217/2204 gate-fix) — 'build-blocked' (BE Run.BUILD_BLOCKED):
// a synchronous pre-flight/build-guard failure (e.g. the TASK-2213 Inflow/
// Raised-structure guard) that happened BEFORE the run was ever dispatched
// to compute. An honest label, NOT "Unknown failure" — the guard's own
// error_message (rendered right below the Cause line) already explains
// exactly what happened; this just names WHEN in the pipeline it stopped.
export const ERROR_CLASS_MESSAGE_IDS = {
    'oom': 'hydrata.anuga.errorClassOom',
    'entrypoint-failure': 'hydrata.anuga.errorClassEntrypointFailure',
    'in-process': 'hydrata.anuga.errorClassInProcess',
    'build-blocked': 'hydrata.anuga.errorClassBuildBlocked',
    'unknown': 'hydrata.anuga.errorClassUnknown'
};

// P3-A (TASK-2217/2204 gate-fix) — total character cap, independent of any
// line-count cap: tailLines' maxLines guard does nothing for a single
// arbitrarily long line with NO newlines (a raw traceback with escaped
// newlines, or garbled binary output from a crashed container) — such a
// blob renders into the DOM in full when the user expands the collapsible
// tail. Truncates from the HEAD (oldest content dropped, the most recent —
// closest to the failure — survives) with a leading marker, mirroring the
// BE's own capture_cloudwatch_tail cap (P2-C, gn_anuga/services.py).
export const TAIL_MAX_CHARS = 20000;

export const capChars = (text, maxChars = TAIL_MAX_CHARS) => {
    const str = text ? String(text) : '';
    if (str.length <= maxChars) return str;
    const marker = '... truncated ...\n';
    // Self-review: if maxChars is smaller than the marker itself (only
    // reachable via an explicit small override — the two real callers
    // always use TAIL_MAX_CHARS = 20000), `maxChars - marker.length` goes
    // NEGATIVE and `str.slice(-negative)` becomes `str.slice(positive)` —
    // slicing from the HEAD instead of the tail, and the result can end up
    // LONGER than maxChars. Clamp so the tail-anchored contract always
    // holds, even in that degenerate case.
    const budget = Math.max(maxChars - marker.length, 0);
    return marker + (budget > 0 ? str.slice(-budget) : '');
};

// W1.2 (TASK-2207, epic 2204) — last N lines of a log-like string, for the
// error strip's bounded/collapsible tail (NOT a substitute for the full
// ScenarioRunLog viewer, which stays as-is). Returns '' for null/empty
// input so callers can treat the result as a plain falsy-check.
export const tailLines = (text, maxLines) => {
    if (!text) return '';
    const lines = String(text).split('\n');
    const byLines = lines.length <= maxLines ? String(text) : lines.slice(lines.length - maxLines).join('\n');
    // P3-A — the line-count cap alone does not bound a single huge
    // no-newline line; always ALSO apply the char cap.
    return capChars(byLines);
};

// W1.2 (TASK-2207, epic 2204) — best-effort AWS Console CloudWatch Logs
// deep link for a (log_group_name, log_stream_name) pair. Returns null when
// either is missing (nothing to link to yet — e.g. a local-backend run, or
// a Batch run whose describe_jobs capture hasn't landed).
//
// AWS's console logsV2 route uses its OWN escaping for path segments in the
// URL fragment (NOT standard encodeURIComponent): '/' -> '$252F' and
// '$' -> '$2524'. This is a documented AWS-console-specific quirk, not a
// general-purpose URI encoder — do not reuse `cloudWatchConsoleSegment` for
// anything else.
const cloudWatchConsoleSegment = (value) => String(value)
    .replace(/\$/g, '$2524')
    .replace(/\//g, '$252F');

export const buildCloudWatchDeepLink = (logGroupName, logStreamName, region = 'us-west-2') => {
    if (!logGroupName || !logStreamName) return null;
    const group = cloudWatchConsoleSegment(logGroupName);
    const stream = cloudWatchConsoleSegment(logStreamName);
    return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${group}/log-events/${stream}`;
};

/**
 * Validate that a scenario has all required fields populated.
 *
 * Returns `null` when every required field is present, or the name of the
 * first missing field as a string. Callers can surface that name in a
 * user-facing message (e.g. "<field> is required"). Fields are checked in
 * a stable order so the returned name is deterministic.
 *
 * TASK-868: previously returned a bare boolean. Field-name return shape lets
 * the Build-button alert tell the user which field is missing instead of
 * a generic "Scenario is not valid".
 */
export const validateScenario = (scenario) => {
    if (!scenario || typeof scenario !== 'object') {
        return 'scenario';
    }
    if (!(scenario?.name?.length > 0)) {
        return 'name';
    }
    if (!scenario?.terrain) {
        return 'terrain';
    }
    if (!scenario?.inflow && !scenario?.rainfall) {
        return 'inflowOrRainfall';
    }
    if (!(scenario?.resolution > 0)) {
        return 'resolution';
    }
    if (!(scenario?.duration > 0)) {
        return 'duration';
    }
    if (!scenario?.boundary) {
        return 'boundary';
    }
    return null;
};

/**
 * TASK-C-scenarios-miller Wave 3A — derive a tag + severity for one
 * category rail item from a scenario. Returns:
 *
 *   { satisfied, total, tag, severity, unsaved }
 *
 * Severities map to the .is-ok / .is-warn / .is-err tag CSS variants on
 * the category rail item. `tag` is the short string painted in the
 * trailing pill (e.g. "4/4", "OK", "47%", "err", "—").
 *
 * Wave 3C C4 — the `unsaved` flag mirrors the scenario-level
 * `scenario.unsaved` boolean. Per-category diffing is out of scope (we
 * don't keep a persisted-backend snapshot cache on the FE) so every
 * category tag returns the SAME `unsaved` value — true when the scenario
 * has unsaved changes anywhere, false otherwise. The category rail uses
 * this to paint a small dot/asterisk prefix on the tag pill so users see
 * "this scenario has unsaved diffs" surfaces on every visible category.
 *
 * Categories handled:
 *   - 'inputs'        — required count of {terrain, boundary, (inflow OR
 *                       rainfall)}. Inflow and rainfall are mutually
 *                       substitutable water sources (validateScenario
 *                       requires one of the two), so they share a single
 *                       slot. Tag reads "N/3". severity=ok at 3/3, warn
 *                       at 1-2/3, err at 0/3.
 *   - 'advanced'      — count of {friction, structure, mesh_region,
 *                       network}. ALL FIELDS OPTIONAL in
 *                       validateScenario, so severity stays ok-or-empty
 *                       (never err). Tag still reads "N/4" for parity.
 *   - 'runConfig'     — {resolution > 0, duration > 0}. Tag "OK" when
 *                       both set, "X/2" otherwise. severity err only
 *                       when neither is set.
 *   - 'statusActions' — derived from findScenarioStatus(scenario):
 *                       computing → "{pct}%" + ok
 *                       error     → "err" + err
 *                       complete  → "100%" + ok
 *                       built     → "built" + ok
 *                       cancelled → "—" + warn
 *                       created   → "—" + warn
 *                       queued/processing/building → "..." + warn
 *
 * Defensive contract: null/undefined scenarios return a no-op tag
 * ({satisfied: 0, total: N, tag: '—', severity: 'warn'}) so the caller
 * still renders a neutral tag before a scenario is selected.
 *
 * @param {object} [opts] — TASK-2045 (F3, epic 2037 W1b). Only the
 *   'inputs' category reads this. `opts.boundaryHasFeatures` is a BE-only
 *   signal (BoundarySerializerV2.has_features via resources.boundaries) —
 *   an auto-scaffolded boundary can be SELECTED while its underlying
 *   PostGIS table holds zero features, which used to read "ready" here and
 *   then hard-fail the BE build (gn_anuga/utils.py
 *   in_place_trim_terrain_tif_with_boundary: "No boundary features found").
 *   Backward-safe default: when `opts` is omitted, or
 *   `opts.boundaryHasFeatures` is anything other than the literal `false`
 *   (including undefined — e.g. the boundaries list hasn't loaded yet, or a
 *   legacy caller that predates this fix), selection-only truthiness is
 *   preserved. The caller — originally scenarioCategoryRail, now
 *   scenarioPane.js's section-heading badges after the UAT re-aim
 *   (2026-07-06, finding 1) removed the rail — is the one place that MUST
 *   resolve the real boolean and pass it explicitly, so a genuinely empty
 *   boundary reads NOT-ready once resources.boundaries has loaded.
 */
export const validateCategoryProgress = (category, scenario, opts) => {
    // Defensive: missing scenario means tag rendering should be neutral.
    if (!scenario || typeof scenario !== 'object') {
        return {satisfied: 0, total: 0, tag: '—', severity: 'warn', unsaved: false};
    }
    // Wave 3C C4 — scenario-level unsaved flag, propagated identically to
    // every category tag. The FE doesn't keep a persisted-backend snapshot
    // so per-category diffing isn't available; the dot is intentionally
    // coarse ("this scenario has unsaved diffs somewhere").
    const unsaved = !!scenario.unsaved;

    if (category === 'inputs') {
        // Inflow and Rainfall are mutually substitutable water sources — the
        // build-time validateScenario requires only one of the two — so the
        // category-rail tag counts them as a single slot
        // (terrain + boundary + (inflow|rainfall) = 3).
        const hasTerrain = scenario.terrain != null && scenario.terrain !== ''; // eslint-disable-line no-eq-null, eqeqeq
        // TASK-2045 (F3, epic 2037 W1b) — a boundary must be SELECTED *and*
        // have at least one feature. `opts.boundaryHasFeatures === false` is
        // the only value that downgrades readiness; see the JSDoc above for
        // the full backward-safe-default contract.
        const boundarySelected = scenario.boundary != null && scenario.boundary !== ''; // eslint-disable-line no-eq-null, eqeqeq
        const boundaryHasFeatures = !(opts && opts.boundaryHasFeatures === false);
        const hasBoundary = boundarySelected && boundaryHasFeatures;
        const hasWaterSource = (scenario.inflow != null && scenario.inflow !== '') // eslint-disable-line no-eq-null, eqeqeq
            || (scenario.rainfall != null && scenario.rainfall !== ''); // eslint-disable-line no-eq-null, eqeqeq
        const satisfied = (hasTerrain ? 1 : 0) + (hasBoundary ? 1 : 0) + (hasWaterSource ? 1 : 0);
        const total = 3;
        let severity = 'warn';
        if (satisfied === total) severity = 'ok';
        else if (satisfied === 0) severity = 'err';
        return {satisfied, total, tag: `${satisfied}/${total}`, severity, unsaved};
    }

    if (category === 'advanced') {
        // TASK-1412 (ISSUE 20.3): 'network' removed from the scenario-config
        // advanced pane; the tag counts only the 3 remaining optional fields.
        const fields = ['friction', 'structure', 'mesh_region'];
        const satisfied = fields.filter(f => scenario[f] != null && scenario[f] !== '').length; // eslint-disable-line no-eq-null, eqeqeq
        const total = fields.length;
        // Advanced fields are optional; never err.
        return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'ok', unsaved};
    }

    if (category === 'runConfig') {
        const hasResolution = (scenario.resolution || 0) > 0;
        const hasDuration = (scenario.duration || 0) > 0;
        const satisfied = (hasResolution ? 1 : 0) + (hasDuration ? 1 : 0);
        const total = 2;
        if (satisfied === total) {
            return {satisfied, total, tag: 'OK', severity: 'ok', unsaved};
        }
        if (satisfied === 0) {
            return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'err', unsaved};
        }
        return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'warn', unsaved};
    }

    // TASK-1416 (ISSUE 20.7): merged 'run' category combines runConfig config
    // fields (resolution/duration) with the execution status signal. Tag
    // priority: execution status (error/computing/complete/built) > config
    // completeness — the user is most interested in whether the scenario ran.
    if (category === 'run') {
        const status = findScenarioStatus(scenario);
        const pct = scenario?.latest_run?.progress_pct;
        const hasResolution = (scenario.resolution || 0) > 0;
        const hasDuration = (scenario.duration || 0) > 0;
        const configReady = hasResolution && hasDuration;
        // If the scenario has run (or is running), show execution status as tag.
        if (status === 'computing') {
            return {satisfied: 0, total: 1, tag: Number.isFinite(pct) ? `${Math.round(pct)}%` : '...', severity: 'ok', unsaved};
        }
        if (status === 'error') {
            return {satisfied: 0, total: 1, tag: 'err', severity: 'err', unsaved};
        }
        if (status === 'complete') {
            return {satisfied: 1, total: 1, tag: '100%', severity: 'ok', unsaved};
        }
        if (status === 'built') {
            return {satisfied: 1, total: 1, tag: 'built', severity: 'ok', unsaved};
        }
        if (status === 'cancelled') {
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        }
        if (status === 'queued' || status === 'processing' || status === 'building') {
            return {satisfied: 0, total: 1, tag: '...', severity: 'warn', unsaved};
        }
        // status === 'created' — show config completeness tag instead.
        if (configReady) {
            return {satisfied: 1, total: 1, tag: 'OK', severity: 'ok', unsaved};
        }
        const configSatisfied = (hasResolution ? 1 : 0) + (hasDuration ? 1 : 0);
        return {satisfied: configSatisfied, total: 2, tag: `${configSatisfied}/2`, severity: configSatisfied === 0 ? 'err' : 'warn', unsaved};
    }

    if (category === 'statusActions') {
        const status = findScenarioStatus(scenario);
        const pct = scenario?.latest_run?.progress_pct;
        switch (status) {
        case 'computing':
            return {
                satisfied: 0,
                total: 1,
                tag: Number.isFinite(pct) ? `${Math.round(pct)}%` : '...',
                severity: 'ok',
                unsaved
            };
        case 'error':
            return {satisfied: 0, total: 1, tag: 'err', severity: 'err', unsaved};
        case 'complete':
            return {satisfied: 1, total: 1, tag: '100%', severity: 'ok', unsaved};
        case 'built':
            return {satisfied: 1, total: 1, tag: 'built', severity: 'ok', unsaved};
        case 'cancelled':
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        case 'queued':
        case 'processing':
        case 'building':
            return {satisfied: 0, total: 1, tag: '...', severity: 'warn', unsaved};
        case 'created':
        default:
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        }
    }

    // Unknown category — neutral fallback (defensive default so adding a
    // new category in the rail data doesn't crash the helper).
    return {satisfied: 0, total: 0, tag: '—', severity: 'warn', unsaved};
};

// ---------------------------------------------------------------------------
// TASK-2210/2211 (W3.1/W3.2, epic 2204) — mesh cost transparency + the
// divergence-interrupt gate. Pure functions over a Run object shaped by
// RunSerializerV2 (BE: mesh_provenance / mesh_triangle_count /
// mesh_actual_cost_estimate) so scenarioPane.js's post-build comparison
// (2210 AC#3) and anugaScenarioMenu.js's Build-and-Run pause (2211 AC#1)
// share ONE arithmetic source — they can never disagree about what
// "diverged" means.
// ---------------------------------------------------------------------------

// od-4 (2026-07-10 grill): default 2x. Overridden by the BE's
// ANUGA_MESH_DIVERGENCE_THRESHOLD (AC#4, settings/env-tunable), surfaced to
// the FE via GET /api/v2/anuga/config/ -> state.anuga.ui.meshDivergenceThreshold.
export const DEFAULT_MESH_DIVERGENCE_THRESHOLD = 2;

/**
 * The actual-vs-estimate mesh comparison for a completed build, or `null`
 * when there is nothing honest to show.
 *
 * mesh_provenance REALITY (epic 2204 environment note, verified live): a
 * FAILED build carries an EMPTY `{}`; a pre-epic/legacy run carries `null`.
 * Both — and a run with no actual triangles yet — degrade to `null` here
 * rather than a fabricated comparison (never show "0 vs 0" or "NaN%").
 *
 * @param {object} run - a Run as RunSerializerV2 shapes it (or any object
 *   carrying `mesh_provenance` + `mesh_triangle_count` + optionally
 *   `mesh_actual_cost_estimate`).
 * @returns {{estimate: number, actual: number, ratio: number|null, actualCost: number|null}|null}
 */
export const getMeshComparison = (run) => {
    const mp = run && typeof run.mesh_provenance === 'object' && run.mesh_provenance !== null
        ? run.mesh_provenance : null;
    if (!mp) return null;
    const estimate = mp.pre_build_triangle_estimate;
    const actual = run.mesh_triangle_count;
    if (estimate === null || estimate === undefined || !actual) return null;
    const actualCost = run.mesh_actual_cost_estimate !== null && run.mesh_actual_cost_estimate !== undefined
        ? run.mesh_actual_cost_estimate : null;
    return {
        estimate,
        actual,
        ratio: estimate > 0 ? actual / estimate : null,
        actualCost
    };
};

/**
 * The divergence verdict a completed build's comparison should gate a
 * deferred "Build and Run" on (TASK-2211 AC#1). Missing/incomplete
 * comparison data ALWAYS resolves to `exceedsThreshold: false` — the
 * documented edge case (a legacy scenario built pre-W2, or a failed build)
 * must take the below-threshold (auto-fire) path, never pause on missing
 * data.
 *
 * @param {object} run
 * @param {number} [thresholdMultiplier] - defaults to DEFAULT_MESH_DIVERGENCE_THRESHOLD.
 * @returns {{exceedsThreshold: boolean, comparison: object|null, threshold: number}}
 */
export const getMeshDivergence = (run, thresholdMultiplier) => {
    const threshold = (typeof thresholdMultiplier === 'number' && thresholdMultiplier > 0)
        ? thresholdMultiplier : DEFAULT_MESH_DIVERGENCE_THRESHOLD;
    const comparison = getMeshComparison(run);
    const exceedsThreshold = !!comparison && comparison.ratio !== null && comparison.ratio > threshold;
    return {exceedsThreshold, comparison, threshold};
};

// Human-readable driver keys getMeshCostDriverHint may report, in the SAME
// order _mesh_estimate_terms (gn_anuga/models/scenario.py) computes them.
// 'holes' is deliberately excluded — it is a NEGATIVE term (Reflective
// structures remove mesh), never a cost driver; its positive conformance
// cost is 'hole_perimeter'.
const MESH_COST_DRIVER_KEYS = ['base', 'regions', 'hole_perimeter', 'breaklines'];

/**
 * TASK-2210 AC#2 — which W2.1 estimate term dominates the pre-build
 * estimate, e.g. "your mesh region drives ~85% of mesh cost" (the dogfood
 * finding that Resolution — the one visible lever — barely moved a mesh a
 * MeshRegion actually dominated). Returns `null` when the breakdown is
 * missing (resolution unset), the total is non-positive, or 'base' (the
 * expected/unsurprising driver) dominates — the hint exists to surface a
 * SURPRISING driver, not to restate the obvious.
 *
 * @param {object} breakdown - Scenario.mesh_triangle_count_estimate_breakdown
 *   shape (W2.1): {base, regions, holes, hole_perimeter, breaklines, total, ...}.
 * @returns {{driver: string, share: number}|null} share is a rounded 0-100 percentage.
 */
export const getMeshCostDriverHint = (breakdown) => {
    if (!breakdown || typeof breakdown !== 'object') return null;
    const total = breakdown.total;
    if (!(total > 0)) return null;
    let bestKey = null;
    let bestValue = -Infinity;
    MESH_COST_DRIVER_KEYS.forEach((key) => {
        const value = breakdown[key];
        if (typeof value === 'number' && value > bestValue) {
            bestValue = value;
            bestKey = key;
        }
    });
    if (!bestKey || bestKey === 'base' || bestValue <= 0) return null;
    return {driver: bestKey, share: Math.round((bestValue / total) * 100)};
};

// TASK-2400 (dogfood F1 #2a/#3) — shared pre-build cost-estimate formatter,
// used by BOTH the in-pane estimate section (scenarioPane.js) and the
// Build/Build-and-Run tooltip echo (scenarioHeaderActions.js), which used to
// each carry their own copy of this same $0-vs-hedge logic (mechanical
// simplify — one formatter, one place to fix the wording again).
//   (b) a $0 (free-band) run never renders as "$0.00" — reads "Free".
//   (c) a non-zero figure is hedged ("est.") rather than bare precision — it
//       is dollar_estimate() rounded to 2dp, NOT the coarse customer-BILLED
//       price_band (gn_anuga.estimate.band) that actually determines the
//       charge; the Built line's price_band is the one number that IS the
//       actual charge (scenarioHeaderActions.js's priceLabel, TASK-2100).
// Returns '' when computeCostEstimate is null/undefined (nothing to show).
export const formatCostEstimate = (computeCostEstimate) => {
    if (computeCostEstimate === null || computeCostEstimate === undefined) return '';
    if (Number(computeCostEstimate) === 0) return 'Free';
    return `~$${Number(computeCostEstimate).toFixed(2)} est.`;
};

/**
 * TASK-2420 (epic 2359 W4.5) — the coarse, customer-BILLED price band for a
 * PRE-BUILD dollar estimate, mirroring gn_anuga.estimate.band()'s bucketing
 * EXACTLY (free threshold, then ascending table lookup) so the Account
 * panel's over-balance estimate badge can never disagree with what a build
 * would actually be charged. band() itself needs a build-frozen Run and
 * can't run pre-build — this is the same two-step bucketing applied to the
 * scenario's own pre-build `compute_cost_estimate` instead.
 *
 * @param {number} dollars - the scenario's compute_cost_estimate.
 * @param {string|number} freeThresholdStr - free_band.edge (account summary).
 * @param {Array<[string|null, string]>} table - free_band.table (account summary):
 *   [(upperBoundUsdOrNull, bandPriceUsd), ...] ascending, last entry's upper
 *   is null (catch-all) in the shipped default.
 * @returns {number|null} the band price, or null when inputs are missing/malformed.
 */
export const bandForEstimate = (dollars, freeThresholdStr, table) => {
    if (dollars === null || dollars === undefined || !Array.isArray(table) || !table.length) return null;
    const dollarsNum = Number(dollars);
    const freeThreshold = Number(freeThresholdStr);
    if (dollarsNum <= freeThreshold) return 0;
    for (const [upper, price] of table) {
        if (upper === null || dollarsNum <= Number(upper)) return Number(price);
    }
    return Number(table[table.length - 1][1]);
};
