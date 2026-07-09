import React, {useEffect} from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {
    secondsToHM, hmToSeconds, DURATION_MAX_HOURS, DURATION_MINUTE_STEP, validateCategoryProgress
} from './scenarioHelpers';
import {ScenarioStatusPill} from './scenarioStatusPill';
import {ScenarioStatusCard} from './scenarioStatusCard';
import {ScenarioErrorStrip} from './scenarioErrorStrip';
// TASK-1764 (epic-1758 W1) — chassis FormRow frames the scenario-detail
// label/field rows (Inputs / Advanced / Run). The legacy
// .sv-anuga-scenario-pane-section row class rides extraClassName so the
// existing chrome + the scenarioPane test's
// .sv-anuga-scenario-pane-field.is-readonly / #id assertions stay intact; the
// .sv-anuga-scenario-pane-field wrapper (carrying .is-readonly) is preserved as
// the FormRow child so the readonly-count contract holds.
import {FormRow} from '../../SimpleView/components/primitives';

/**
 * Merged-panel renderer for the Miller-columns scenarios panel (TASK-2114,
 * epic 2111 W2, dogfood findings A+B). Pane 3 stacks all three sections
 * (Required inputs / Optional inputs / Run) in ONE scrollable body, each
 * behind its own in-pane heading, so nothing is hidden behind a tab click.
 * This is the direct fix for dogfood finding F4's root cause: the old
 * Advanced tab HID mesh_region until clicked, so a drawn-but-unattached mesh
 * region silently no-op'd at build time without ever being seen.
 *
 * UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, findings 1+2) —
 * the vertical category rail (`ScenarioCategoryRail`, Pane 2) that used to
 * sit between the scenario list and this pane is REMOVED entirely: it was a
 * completeness-at-a-glance nav that no longer gated anything once the
 * sections merged into one scroll, so the operator judged it obsolete. This
 * pane (Pane 3) now expands to occupy the freed width. The per-category
 * completeness counts the rail used to show ("3/3", "0/3", "100%", ...)
 * move INTO each section's own heading instead, right-aligned in the same
 * heading band — see `renderSectionHeading` below — reusing
 * `validateCategoryProgress` (scenarioHelpers.js) with the EXACT SAME
 * arguments the rail used to pass (including the TASK-2045
 * boundaryHasFeatures gate for 'inputs'), never re-derived.
 *
 * Per-selector "selected layer" confirmation cards (`ScenarioResourceSummary`,
 * TASK-C Wave 3A) are REMOVED from the Inputs/Advanced sections (dogfood
 * finding B) — the native <select>'s own displayed value already shows the
 * chosen item's title, so the extra card beneath each dropdown was largely
 * redundant confirmation. The component + its own unit tests still exist
 * (scenarioResourceSummary.js) in case a future surface wants the same card
 * shell (e.g. a run-history list) — nothing here deletes that primitive,
 * only stops calling it per-selector.
 *
 * Field-edit callbacks (name, dropdowns, resolution, duration, compute
 * backend) dispatch through the container's `onUpdateScenario` prop.
 * UAT #8 — Build / Run / Build-and-Run / Retry / Download / Archive / Delete
 * no longer render in this pane; they moved UP to the always-visible
 * ScenarioHeaderActions strip in the Scenarios heading (anugaScenarioMenu).
 */

// TASK-1416 (ISSUE 20.7): 'runConfig' + 'statusActions' merged into single 'run'
// category. Both old IDs kept in the array for backward-compatible propType
// validation of the `selectedCategoryId` prop, which the container
// (anugaScenarioMenu.js) still threads through for now — UAT re-aim (finding
// 1) removed the only consumer that acted on it (the category rail), but the
// prop itself is left alone (harmless, no behaviour) to keep this change
// scoped to the 3 UAT findings rather than also refactoring the container's
// still-otherwise-used state machine.
const VALID_CATEGORIES = ['inputs', 'advanced', 'run', 'runConfig', 'statusActions'];

/**
 * TASK-1420 (ISSUE 30) — Format the build-log string for human readability.
 *
 * The BE (gn_anuga/models/scenario.py) appends two mesh-stat lines:
 *   "mesh area: 1234567 m2"              — large integer metres²
 *   "average triangle area: 123.45 m2"  — float metres²
 *
 * Transformations applied (pure, no side effects):
 *   1. "mesh area: N m2"               → "mesh area: X.XX km²"
 *      (N / 1e6 converted to km², shown with up to 2 decimal places,
 *       trailing zeros stripped, e.g. 1.0 → "1" not "1.00")
 *   2. "average triangle area: F m2"   → "average triangle area: INT m²"
 *      (rounded to nearest integer, formatted with locale-style commas)
 *
 * The "m2" suffix emitted by Python :, format and the "m²" Unicode
 * superscript are treated as equivalent on the way in (both matched).
 *
 * @param {string} log - raw log string from latest_run.log
 * @returns {string} formatted log (input returned unchanged when null/empty)
 */
export function formatBuildLog(log) {
    if (!log) return log;
    return log
        // 1. mesh area: N m2 → X.XX km²
        .replace(
            /^(mesh area: )(\d+)( m2| m²)/m,
            (_, prefix, numStr) => {
                const km2 = parseFloat(numStr) / 1e6;
                // maximumFractionDigits:2 strips trailing zeros (e.g. 1.0→"1", 1.5→"1.5").
                const formatted = km2.toLocaleString('en-US', {maximumFractionDigits: 2});
                return `${prefix}${formatted} km²`;
            }
        )
        // 2. average triangle area: F m2 → INT m² with comma grouping
        .replace(
            /^(average triangle area: )([0-9.]+)( m2| m²)/m,
            (_, prefix, numStr) => {
                const intVal = Math.round(parseFloat(numStr));
                return `${prefix}${intVal.toLocaleString('en-US')} m²`;
            }
        );
}

/**
 * Inline log tail rendered at the bottom of the Run (statusActions) pane.
 * Auto-scrolls to the latest line when the log prop changes. Pulled from
 * `scenario?.latest_run?.log` upstream (the same string the TaskMonitor
 * ProcessLogViewer renders); kept as a tiny local class component so the
 * scenarios pane doesn't need to import a TaskMonitor component (which
 * would couple to that plugin's CSS for log styling).
 */
class ScenarioRunLog extends React.Component {
    static propTypes = {
        log: PropTypes.string,
        lineCount: PropTypes.number
    };
    constructor(props) {
        super(props);
        this.logRef = React.createRef();
    }
    componentDidUpdate(prevProps) {
        if (prevProps.log !== this.props.log && this.logRef.current) {
            this.logRef.current.scrollTop = this.logRef.current.scrollHeight;
        }
    }
    render() {
        const {log, lineCount} = this.props;
        return (
            <div className="sv-anuga-scenario-pane-log">
                <div className="sv-anuga-scenario-pane-log-head">
                    <span className="sv-anuga-scenario-pane-log-title">
                        <Message msgId="hydrata.anuga.log" />
                        {Number.isFinite(lineCount) ? ` (${lineCount})` : null}
                    </span>
                </div>
                <pre ref={this.logRef} className="sv-anuga-scenario-pane-log-viewer">
                    {formatBuildLog(log) || ''}
                </pre>
            </div>
        );
    }
}

// ------------------------------------------------------------------------
// Field primitives
// ------------------------------------------------------------------------

function renderSelectField(id, label, value, options, disabled, onChange) {
    // Wave 3B (B4) — when the user lacks edit perms (canEdit=false → disabled
    // here), tag the wrapper with .is-readonly so the field is visually dim
    // and the cursor flips to not-allowed via CSS.
    const fieldClass = 'sv-anuga-scenario-pane-field' + (disabled ? ' is-readonly' : '');
    return (
        <FormRow
            key={id}
            extraClassName="sv-anuga-scenario-pane-section"
            label={
                <label className="sv-anuga-scenario-pane-label" htmlFor={id}>
                    <Message msgId={label} />
                </label>
            }
        >
            <div className={fieldClass}>
                <select
                    id={id}
                    className={'sv-scenario-select'}
                    value={value || ''}
                    disabled={disabled}
                    onChange={(e) => {
                        const next = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        const kv = {};
                        kv[id] = next;
                        onChange(kv);
                    }}
                >
                    <option value={''}>-</option>
                    {(options || []).map(item => (
                        <option key={item?.id} value={item?.id}>{item?.title}</option>
                    ))}
                </select>
            </div>
        </FormRow>
    );
}

// ------------------------------------------------------------------------
// TASK-2116 (F4) — drawn-but-unattached MeshRegion hint
// ------------------------------------------------------------------------

/**
 * TASK-2116 (F4, epic 2111 W2) — `mesh_region` is a legitimately optional FK
 * (BE scenario.py:982); every BE consumer silently no-ops when it's unset
 * (scenario.py:1388, tasks.py:2378, run_utils.py:265-272 → uniform mesh at
 * `scenario.resolution`). The dogfood engineer drew a fine refinement
 * region, never attached it to the scenario, and the run silently ignored
 * it. `meshRegions` here is the SAME project resource list already threaded
 * into this pane for the Advanced dropdown (state.anuga.resources.meshRegions
 * — a MeshRegion only exists in this list once its draw has produced a
 * saved resource, mirroring how terrain/boundary/inflow are "drawn" i.e.
 * resource-backed). No new Redux wiring needed: "has the project got a
 * drawn mesh region" and "is one attached to THIS scenario" are both
 * already-available facts. Exported so anugaScenarioMenu.js's build-time
 * confirm dialog can reuse the exact same predicate (DRY) rather than
 * re-derive it.
 *
 * NO auto-attach (operator-rejected: TASK-2100's price_band prices off the
 * build-frozen triangle count, so silently attaching a fine region would
 * silently multiply the run's price band post-flip). This is hint + confirm
 * only — the build-time confirm dialog lives in anugaScenarioMenu.js.
 */
export function meshRegionIsUnattached(scenario, meshRegions) {
    const hasDrawnRegion = Array.isArray(meshRegions) && meshRegions.length > 0;
    if (!hasDrawnRegion) return false;
    const isAttached = scenario?.mesh_region != null && scenario?.mesh_region !== ''; // eslint-disable-line no-eq-null, eqeqeq
    return !isAttached;
}

function renderMeshRegionUnattachedHint(scenario, meshRegions) {
    if (!meshRegionIsUnattached(scenario, meshRegions)) return null;
    const names = (meshRegions || []).map(r => r?.title).filter(Boolean).join(', ');
    return (
        <div
            className="sv-anuga-scenario-pane-section sv-anuga-scenario-mesh-region-unattached-hint"
            role="status"
            aria-live="polite"
        >
            <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
            {' '}
            <Message msgId="hydrata.anuga.meshRegionUnattachedHint" msgParams={{names}} />
        </div>
    );
}

// ------------------------------------------------------------------------
// TASK-2160 (epic 2147 W4) — drawn-but-unattached Rainfall hint
// ------------------------------------------------------------------------

/**
 * TASK-2160 (epic 2147 W4, "trust-signal" wave) — direct MeshRegion analog
 * (meshRegionIsUnattached above) for Rainfall. A Rainfall is drawn (a saved
 * resource exists in state.anuga.resources.rainfalls) but not attached to
 * THIS scenario (scenario.rainfall is unset) → the run silently proceeds
 * WITHOUT that rainfall, exactly the "is my rainfall actually going to run?"
 * trust gap this wave closes. Mirrors mesh_region: `rainfalls` is the SAME
 * project resource list already threaded into renderInputsPane for the
 * Rainfall dropdown, so no new Redux wiring is needed — "has the project got
 * a drawn rainfall" and "is one attached to THIS scenario" are both
 * already-available facts.
 *
 * SCOPE (red-team, Phase 0.5): this predicate detects "no rainfall attached"
 * ONLY. It deliberately does NOT try to detect "a rainfall IS attached but
 * its features carry no timeseries/constant data" — at the time this landed,
 * RainfallSerializerV2 exposed no data-presence signal to detect that
 * sub-case from data already in the pane. Warn on what we can prove; don't
 * fabricate a detection path. TASK-2189 (epic 2147 W6) closed that gap —
 * see `rainfallAttachedButEmpty` below, the direct complement of this
 * predicate.
 *
 * NO auto-attach (operator-rejected, same rationale as mesh_region): warn +
 * confirm only. The build-time confirm dialog lives in anugaScenarioMenu.js.
 * Exported so that dialog can reuse the exact same predicate (DRY).
 */
export function rainfallIsUnattached(scenario, rainfalls) {
    const hasDrawnRainfall = Array.isArray(rainfalls) && rainfalls.length > 0;
    if (!hasDrawnRainfall) return false;
    const isAttached = scenario?.rainfall != null && scenario?.rainfall !== ''; // eslint-disable-line no-eq-null, eqeqeq
    return !isAttached;
}

function renderRainfallUnattachedHint(scenario, rainfalls) {
    if (!rainfallIsUnattached(scenario, rainfalls)) return null;
    const names = (rainfalls || []).map(r => r?.title).filter(Boolean).join(', ');
    return (
        <div
            className="sv-anuga-scenario-pane-section sv-anuga-scenario-rainfall-unattached-hint"
            role="status"
            aria-live="polite"
        >
            <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
            {' '}
            <Message msgId="hydrata.anuga.rainfallUnattachedHint" msgParams={{names}} />
        </div>
    );
}

// ------------------------------------------------------------------------
// TASK-2189 (epic 2147 W6) — attached-but-empty Rainfall hint
// ------------------------------------------------------------------------

/**
 * TASK-2189 — the complement rainfallIsUnattached's JSDoc explicitly scoped
 * itself out of: a Rainfall IS attached to this scenario (scenario.rainfall
 * is set), but the attached resource's underlying PostGIS features carry NO
 * data (neither `data_constant` nor `data_timeseries_id` set on any row) —
 * the run will silently proceed as if no rainfall were attached at all.
 *
 * Driven by RainfallSerializerV2.has_feature_data (gn_anuga/serializers_v2.py),
 * a cheap EXISTS-query DATA-presence signal — distinct from Boundary's
 * `has_features`, which only proves a feature ROW exists (not that it
 * carries data). `rainfalls` is the same project resource list already
 * threaded into renderInputsPane for the Rainfall dropdown (no new Redux
 * wiring needed).
 *
 * Strict `=== false` (not falsy) on `has_feature_data`: `undefined` (a
 * cached/pre-2189 API response that hasn't been re-fetched, or an
 * in-flight-not-yet-loaded resource) must NOT be treated as "no data" — the
 * hint's whole premise is that it is driven by REAL serializer data, never
 * fabricated from an absent field.
 *
 * AC scope: an in-pane hint only (mirrors rainfallIsUnattached's shape) — no
 * build-time confirm dialog. Unlike the fully-unattached case (which the
 * user can trivially fix by picking a different value in the SAME select
 * they're already looking at), the "attached but empty" case is a data
 * problem inside the resource itself; a confirm-dialog gate would need its
 * own attach-a-different-one workflow to be actionable, which is out of this
 * task's declared scope. See TASK-2189 acceptance criteria.
 */
function findAttachedRainfall(scenario, rainfalls) {
    const attachedId = scenario?.rainfall;
    if (attachedId == null || attachedId === '') return null; // eslint-disable-line no-eq-null, eqeqeq
    return (rainfalls || []).find(r => r && r.id === attachedId) || null;
}

export function rainfallAttachedButEmpty(scenario, rainfalls) {
    const attached = findAttachedRainfall(scenario, rainfalls);
    if (!attached) return false; // unattached, or resource list not loaded / stale id — don't fabricate
    return attached.has_feature_data === false;
}

function renderRainfallAttachedEmptyHint(scenario, rainfalls) {
    if (!rainfallAttachedButEmpty(scenario, rainfalls)) return null;
    const attached = findAttachedRainfall(scenario, rainfalls);
    const name = attached?.title || '';
    return (
        <div
            className="sv-anuga-scenario-pane-section sv-anuga-scenario-rainfall-attached-empty-hint"
            role="status"
            aria-live="polite"
        >
            <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
            {' '}
            <Message msgId="hydrata.anuga.rainfallAttachedEmptyHint" msgParams={{name}} />
        </div>
    );
}

// ------------------------------------------------------------------------
// Pane renderers — one per category
// ------------------------------------------------------------------------

/**
 * TASK-2085 (epic-2077, part (b)) — pre-build warning when a scenario's
 * inflow-location series have MISMATCHED first-timestamp anchors.
 *
 * A Run merges every inflow-location series onto ONE absolute-time index
 * anchored at `model_start` — the EARLIEST first-timestamp across all of
 * the scenario's inflow-location series (BE: Scenario.make_package,
 * scenario.py ~1218-1242, stamps `run.model_start` from
 * `sorted(timeseries_starts)[0]`; run_anuga.run_utils._merge_timeseries,
 * ~1153-1177, left-merges + ffills every other series onto that anchor).
 * A series whose own first timestamp is LATER than model_start therefore
 * has its FIRST value silently repeated backward over the missing lead-in
 * window — it never truly has "no flow" there.
 *
 * `scenario.inflow_anchor_mismatch` (BE-computed, see
 * `Scenario.inflow_anchor_mismatch`) is `null` when there's nothing to
 * warn about, or `{series: [{timeseries_id, name, first_timestamp}, ...]}`
 * naming EVERY timeseries-backed inflow location when 2+ distinct anchors
 * exist. Rendered as a visible (non-blocking) warning naming every series.
 */
function renderInflowAnchorMismatchWarning(scenario) {
    const series = scenario?.inflow_anchor_mismatch?.series;
    if (!Array.isArray(series) || series.length < 2) return null;
    const names = series.map(s => s?.name).filter(Boolean).join(', ');
    return (
        <div
            className="sv-anuga-scenario-pane-section sv-anuga-scenario-anchor-mismatch-warning"
            role="alert"
        >
            <Message msgId="hydrata.anuga.inflowAnchorMismatchWarning" msgParams={{names}} />
        </div>
    );
}

function renderInputsPane({scenario, canEdit, onUpdateScenario, terrain, boundaries, inflows, rainfalls}) {
    const handleField = (kv) => {
        if (onUpdateScenario) onUpdateScenario(scenario, kv);
    };
    // TASK-1587 W1.9 UAT (2026-06-19): the V2 terrain list now (correctly)
    // surfaces layer-less terrains (status 'creating' / 'error') so they can be
    // cleaned up from the Terrain menu — but a non-runnable terrain must NOT be
    // selectable as a scenario's terrain. Filter the PICKER options to
    // status === 'ready' (the runnable status, matching the BE
    // Terrain.objects.filter(status='ready') gate). The resource SUMMARY below
    // keeps the full list so an already-assigned terrain still resolves.
    const selectableTerrain = (terrain || []).filter(t => t?.status === 'ready');
    // Wave 3B (B4) — wrappers get .is-readonly when canEdit=false so the
    // dim + cursor:not-allowed treatment in anuga.css applies. Input keeps
    // readOnly (not disabled) so the user can still focus + copy the value.
    const nameFieldClass = 'sv-anuga-scenario-pane-field' + (!canEdit ? ' is-readonly' : '');
    return (
        <div className="sv-anuga-scenario-pane-rows sv-anuga-scenario-pane-rows-inputs">
            <FormRow
                extraClassName="sv-anuga-scenario-pane-section"
                label={
                    <label className="sv-anuga-scenario-pane-label" htmlFor="name">
                        <Message msgId="hydrata.anuga.name" />
                    </label>
                }
            >
                <div className={nameFieldClass}>
                    <input
                        id="name"
                        type="text"
                        className="sv-scenario-input"
                        value={scenario?.name || ''}
                        readOnly={!canEdit}
                        onChange={(e) => handleField({name: e.target.value})}
                    />
                </div>
            </FormRow>
            {renderSelectField('terrain', 'hydrata.anuga.terrain', scenario?.terrain, selectableTerrain, !canEdit, handleField)}
            {renderSelectField('boundary', 'hydrata.anuga.boundary', scenario?.boundary, boundaries, !canEdit, handleField)}
            {renderSelectField('inflow', 'hydrata.anuga.inflow', scenario?.inflow, inflows, !canEdit, handleField)}
            {renderInflowAnchorMismatchWarning(scenario)}
            {/* TASK-2083 (epic 2077) — empty-state helper explaining an Inflow
                (the layer) can hold more than one inflow location (a feature
                inside it), each with its own hydrograph. Shown only while the
                scenario has no Inflow assigned yet — once one is picked, the
                resource summary above carries the context instead. */}
            {!scenario?.inflow ?
                <div className="sv-anuga-scenario-pane-section sv-anuga-scenario-pane-section--help">
                    <span className="sv-anuga-scenario-pane-help">
                        <Message msgId="hydrata.anuga.inflowMultiLocationHelp" />
                    </span>
                </div> : null
            }
            {renderSelectField('rainfall', 'hydrata.anuga.rainfall', scenario?.rainfall, rainfalls, !canEdit, handleField)}
            {renderRainfallUnattachedHint(scenario, rainfalls)}
            {renderRainfallAttachedEmptyHint(scenario, rainfalls)}
        </div>
    );
}

// TASK-1412 (ISSUE 20.3): 'Network' row removed — not applicable in the
// scenario-config context (per glossary: Mesh spec is the authored skeleton;
// Network belongs in the Hydrology panel, not scenario inputs).
// 'networks' prop intentionally not destructured to avoid breaking the
// parent's prop-passing (anugaScenarioMenu still passes it for future use).
function renderAdvancedPane({scenario, canEdit, onUpdateScenario, frictions, structures, meshRegions}) {
    const handleField = (kv) => {
        if (onUpdateScenario) onUpdateScenario(scenario, kv);
    };
    return (
        <div className="sv-anuga-scenario-pane-rows sv-anuga-scenario-pane-rows-advanced">
            {renderSelectField('friction', 'hydrata.anuga.friction', scenario?.friction, frictions, !canEdit, handleField)}
            {renderSelectField('structure', 'hydrata.anuga.structures', scenario?.structure, structures, !canEdit, handleField)}
            {renderSelectField('mesh_region', 'hydrata.anuga.meshRegions', scenario?.mesh_region, meshRegions, !canEdit, handleField)}
            {renderMeshRegionUnattachedHint(scenario, meshRegions)}
        </div>
    );
}

// TASK-2194 (epic 2190 W2) — staff-only compute-target selector (replaces the
// TASK-1415 superuser-only local/batch selector). Advisory FE gate only: real
// enforcement is server-side in StartRunView.post (non-staff choices are
// overridden; out-of-allowlist -> 409). Options are the site allowlist from
// GET /api/v2/anuga/config/ rendered VERBATIM with plain descriptive labels —
// deliberately NO cost/duration estimates (GPU coefficients are uncalibrated;
// no fabricated numbers). An unknown target falls back to its raw name.
const COMPUTE_TARGET_LABELS = {
    'local': 'Local box',
    'batch-x4': 'AWS Batch — 4 vCPU',
    'batch-x32': 'AWS Batch — 32 vCPU',
    'batch-gpu-a10g': 'AWS Batch — GPU A10G'
};

function computeTargetLabel(target, defaultComputeTarget) {
    const base = COMPUTE_TARGET_LABELS[target] || target;
    return target === defaultComputeTarget ? `${base} (site default)` : base;
}

function renderRunConfigPane({scenario, canEdit, onUpdateScenario, isStaff, availableComputeTargets, defaultComputeTarget, sessionComputeTarget, onSetSessionComputeTarget}) {
    const handleField = (kv) => {
        if (onUpdateScenario) onUpdateScenario(scenario, kv);
    };
    // UAT #9 — duration is entered via two dropdowns (Hours + Minutes), not a
    // free-typed HH:MM string. The stored field is unchanged
    // (scenario.duration = total SECONDS); the dropdowns bind to it through
    // secondsToHM / hmToSeconds so there is no unit drift, and the existing
    // "duration > 0" build validation still holds.
    const {hours: durationHours, minutes: durationMinutes} = secondsToHM(scenario?.duration);
    const handleHoursChange = (e) => {
        handleField({duration: hmToSeconds(parseInt(e.target.value, 10), durationMinutes)});
    };
    const handleMinutesChange = (e) => {
        handleField({duration: hmToSeconds(durationHours, parseInt(e.target.value, 10))});
    };
    const hourOptions = [];
    for (let h = 0; h <= DURATION_MAX_HOURS; h++) hourOptions.push(h);
    const minuteOptions = [];
    for (let m = 0; m < 60; m += DURATION_MINUTE_STEP) minuteOptions.push(m);
    const handleResolutionChange = (e) => {
        // Empty/non-finite input: skip dispatch so the last good value is preserved (K4 guard).
        const raw = e.target.value;
        if (raw === '') return;
        const next = parseFloat(raw);
        if (!Number.isFinite(next)) return;
        handleField({resolution: next});
    };
    // TASK-2194 (review fix) — the chosen target is SESSION state on the ui
    // slice (state.anuga.ui.sessionComputeTargets, keyed per scenario), NOT a
    // field on the scenario object: handleField/UPDATE_ANUGA_SCENARIO would
    // flip scenario.unsaved (detouring the next Build-and-Run into save-only)
    // and any save/refresh wholesale-replace would wipe the choice. Dispatch
    // paths read the ui slot: set -> POSTed verbatim (including an explicit
    // pick of the site default), unset -> the field is omitted and the server
    // default applies.
    const handleTargetChange = (e) => {
        const next = e.target.value || null;
        if (onSetSessionComputeTarget) onSetSessionComputeTarget(scenario, next);
    };
    // Hidden for non-staff, while the config is still loading (null), and for
    // a site with an EMPTY allowlist (retired sites) — all three cases fall
    // through to "dispatch omits compute_target".
    const showComputeTargetSelector = !!isStaff
        && Array.isArray(availableComputeTargets)
        && availableComputeTargets.length > 0;
    // Wave 3B (B4) — same is-readonly wrapper toggle as renderInputsPane.
    const unitFieldClass = 'sv-anuga-scenario-pane-field sv-anuga-scenario-pane-field--unit'
        + (!canEdit ? ' is-readonly' : '');
    const selectFieldClass = 'sv-anuga-scenario-pane-field' + (!canEdit ? ' is-readonly' : '');

    return (
        <div className="sv-anuga-scenario-pane-rows sv-anuga-scenario-pane-rows-run-config">
            <FormRow
                extraClassName="sv-anuga-scenario-pane-section"
                label={
                    <label className="sv-anuga-scenario-pane-label" htmlFor="resolution">
                        <Message msgId="hydrata.anuga.resolutionM2" />
                    </label>
                }
            >
                <div className={unitFieldClass}>
                    <input
                        id="resolution"
                        type="number"
                        className="sv-scenario-input sv-scenario-input-narrow"
                        value={scenario?.resolution != null ? scenario.resolution : ''} // eslint-disable-line no-eq-null, eqeqeq
                        readOnly={!canEdit}
                        onChange={handleResolutionChange}
                    />
                    {/* TASK-1413: resolution is a target edge-length in metres (not m²).
                        Formula: triangles ≈ area / (resolution² / 2) confirms linear m. */}
                    <span className="sv-anuga-scenario-pane-field-unit">m</span>
                </div>
            </FormRow>
            <FormRow
                extraClassName="sv-anuga-scenario-pane-section"
                label={
                    <label className="sv-anuga-scenario-pane-label" htmlFor="duration-hours">
                        <Message msgId="hydrata.anuga.duration" />
                    </label>
                }
            >
                {/* UAT #9 — Option B: two labelled dropdowns (Hours 0-72,
                    Minutes in 5-min steps), no seconds. Stored value is still
                    scenario.duration in seconds (bound via secondsToHM /
                    hmToSeconds). Both selects share one .sv-anuga-scenario-pane-field
                    wrapper so the readonly-wrapper count is unchanged. */}
                <div className={selectFieldClass}>
                    <div className="sv-anuga-duration-widget">
                        <div className="sv-anuga-duration-unit">
                            <select
                                id="duration-hours"
                                className="sv-scenario-select sv-anuga-duration-select"
                                value={durationHours}
                                disabled={!canEdit}
                                onChange={handleHoursChange}
                            >
                                {hourOptions.map(h => (<option key={h} value={h}>{h}</option>))}
                            </select>
                            <label className="sv-anuga-duration-unit-label" htmlFor="duration-hours">
                                <Message msgId="hydrata.anuga.hours" />
                            </label>
                        </div>
                        <div className="sv-anuga-duration-unit">
                            <select
                                id="duration-minutes"
                                className="sv-scenario-select sv-anuga-duration-select"
                                value={durationMinutes}
                                disabled={!canEdit}
                                onChange={handleMinutesChange}
                            >
                                {minuteOptions.map(m => (
                                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                                ))}
                            </select>
                            <label className="sv-anuga-duration-unit-label" htmlFor="duration-minutes">
                                <Message msgId="hydrata.anuga.minutes" />
                            </label>
                        </div>
                    </div>
                </div>
            </FormRow>
            {/* TASK-2194 (epic 2190 W2): compute-target selector is staff-only
                  (FE advisory gate; server-side enforcement is in
                  StartRunView.post — non-staff are silently overridden there).
                  Non-staff DOM never contains this field; an empty/unloaded
                  allowlist hides it for staff too. With nothing chosen the
                  select shows the marked site default and dispatch OMITS the
                  field (server resolves its own default). */}
            {showComputeTargetSelector ? (
                <FormRow
                    extraClassName="sv-anuga-scenario-pane-section"
                    label={
                        <label className="sv-anuga-scenario-pane-label" htmlFor="compute_target">
                            <Message msgId="hydrata.anuga.computeTarget" />
                        </label>
                    }
                >
                    <div className={selectFieldClass}>
                        <select
                            id="compute_target"
                            className="sv-scenario-select"
                            value={sessionComputeTarget || defaultComputeTarget || ''}
                            disabled={!canEdit}
                            onChange={handleTargetChange}
                        >
                            {availableComputeTargets.map(target => (
                                <option key={target} value={target}>
                                    {computeTargetLabel(target, defaultComputeTarget)}
                                </option>
                            ))}
                        </select>
                    </div>
                </FormRow>
            ) : null}
            <div className="sv-anuga-scenario-pane-section sv-anuga-scenario-pane-section--help">
                <span className="sv-anuga-scenario-pane-help">
                    <Message msgId="hydrata.anuga.runConfigHelp" />
                </span>
            </div>
            {/* W3.2 (TASK-1267); re-based TASK-2093 (epic 2092 W1.1) — pre-dispatch
                triangle count + DOLLAR cost estimate. compute_cost_estimate used to
                be raw vCPU-hours mislabeled as a cost and printed with a '$' AND a
                'vCPU-h' suffix on the same number (the "$5237" bug) — the BE now
                returns a genuine dollar figure (canonical model x the configured
                $/vCPU-hour rate), so this renders ONE consistent dollar amount. */}
            {((scenario?.mesh_triangle_count_estimate !== null && scenario?.mesh_triangle_count_estimate !== undefined) || (scenario?.compute_cost_estimate !== null && scenario?.compute_cost_estimate !== undefined)) && (
                <div className="sv-anuga-scenario-pane-section anuga-scenario-estimate-section">
                    <span className="sv-anuga-scenario-estimate-label">
                        {'Estimate: '}
                        {scenario.mesh_triangle_count_estimate !== null && scenario.mesh_triangle_count_estimate !== undefined
                            ? `~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`
                            : ''}
                        {scenario.compute_cost_estimate !== null && scenario.compute_cost_estimate !== undefined
                            ? ` — ~$${Number(scenario.compute_cost_estimate).toFixed(2)}`
                            : ''}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * TASK-1416 (ISSUE 20.7): Merged Run pane — replaces the two separate
 * "Run config" and "Run" (statusActions) categories with a single "Run"
 * panel laid out top-to-bottom:
 *   (a) Resolution / Duration / Compute config fields
 *   (b) Error strip (only when status=error) + Status card (ETA/progress)
 *   (c) [moved] action buttons now live in the Scenarios heading
 *       (ScenarioHeaderActions) — always visible, not gated on the Run tab (UAT #8)
 *   (d) LOG output viewer
 *
 * The former separate feedback panel (ScenarioStatusCard + ScenarioErrorStrip)
 * is preserved — it shows ETA, progress, and error messages which the user
 * needs before deciding to retry or cancel. No data is dropped.
 */
function renderRunPane(props) {
    const {
        scenario, canEdit, isStaff, onUpdateScenario,
        availableComputeTargets, defaultComputeTarget,
        sessionComputeTarget, onSetSessionComputeTarget
    } = props;
    return (
        <div className="sv-anuga-scenario-pane-rows sv-anuga-scenario-pane-rows-run">
            {/* Section (a): config fields */}
            {renderRunConfigPane({scenario, canEdit, onUpdateScenario, isStaff, availableComputeTargets, defaultComputeTarget, sessionComputeTarget, onSetSessionComputeTarget})}
            {/* Section (b): status feedback (ETA, progress, error) */}
            <ScenarioErrorStrip scenario={scenario} />
            <ScenarioStatusCard scenario={scenario} />
            {/* Section (c): UAT #8 — the Build / Run / Build-and-Run / Retry /
                Download / Archive / Delete action strip moved UP into the
                Scenarios heading (ScenarioHeaderActions) so the user can act
                from anywhere in the panel, not just when the Run tab is open. */}
            {/* Section (d): LOG output */}
            <ScenarioRunLog
                log={scenario?.latest_run?.log}
                lineCount={scenario?.latest_run?.log_line_count}
            />
        </div>
    );
}

// ------------------------------------------------------------------------
// Section headings (inside the merged Pane 3 body)
// ------------------------------------------------------------------------

// TASK-2114 (A+B) — Required/Optional/Run no longer gate separate panes; each
// gets an in-body heading instead, reusing the same
// .sv-anuga-scenario-pane-detail-head(-title) chrome the single selected-
// category head used to own (border-bottom rule, font sizing) so no parallel
// heading style is introduced — see anuga.css's `--merged` rule for the
// small top-margin added between repeated headings.
//
// UAT re-aim (finding 2) — `progress` is the SAME `validateCategoryProgress`
// result object the now-removed category rail rendered as its tag pill
// (`{tag, severity, ...}`); this just relocates that pill into the heading
// band, right-aligned via the title's own `flex: 1` (anuga.css) pushing it
// to the far edge. Reuses the rail's severity-class naming convention
// (is-ok/is-warn/is-err) under a NEW classname (not the rail's, which is
// gone) so the pill visually extends the existing token system rather than
// inventing a parallel one.
function renderSectionHeading(msgId, progress) {
    const severity = progress && progress.severity;
    const badgeClass = 'sv-anuga-scenario-pane-detail-head-badge'
        + (severity === 'ok' ? ' is-ok' : '')
        + (severity === 'warn' ? ' is-warn' : '')
        + (severity === 'err' ? ' is-err' : '');
    return (
        <div className="sv-anuga-scenario-pane-detail-head">
            <h3 className="sv-anuga-scenario-pane-detail-head-title">
                <Message msgId={msgId} />
            </h3>
            {progress ? <span className={badgeClass}>{progress.tag}</span> : null}
        </div>
    );
}

// ------------------------------------------------------------------------
// Top-level pane render
// ------------------------------------------------------------------------

/**
 * TASK-1410 (ISSUE 20.1): Auto-populate Required-tab selects for new
 * (unsaved) scenarios so the user doesn't have to touch every dropdown
 * before building. Only fires when the scenario is new (id===null) AND
 * canEdit is true AND a given field is not already set AND options exist.
 * Picks the first available option per field.
 */
function useAutoPopulateDefaults(scenario, canEdit, resources, onUpdateScenario) {
    const {terrain, boundaries, inflows} = resources;
    // Depend on scenario identity (new vs existing) + first-option ids.
    const scenarioId = scenario ? (scenario.id || scenario._tempId) : null;
    // TASK-1587 W1.9 UAT (2026-06-19): auto-default to the first RUNNABLE terrain
    // ('ready') — never a layer-less failed/creating terrain that the V2 list now
    // surfaces (it can't be selected in the picker either).
    const firstReadyTerrain = (terrain || []).find(t => t?.status === 'ready');
    const firstTerrainId = firstReadyTerrain ? firstReadyTerrain.id : null;
    const firstBoundaryId = boundaries && boundaries[0] ? boundaries[0].id : null;
    const firstInflowId = inflows && inflows[0] ? inflows[0].id : null;

    useEffect(() => {
        if (!scenario || !canEdit || !onUpdateScenario) return;
        // Only auto-populate for new (unsaved) scenarios — don't overwrite
        // user choices on existing saved scenarios that genuinely have no input.
        if (scenario.id !== null && scenario.id !== undefined) return; // eslint-disable-line no-eq-null, eqeqeq
        const updates = {};
        if (!scenario.terrain && firstTerrainId != null) updates.terrain = firstTerrainId; // eslint-disable-line no-eq-null, eqeqeq
        if (!scenario.boundary && firstBoundaryId != null) updates.boundary = firstBoundaryId; // eslint-disable-line no-eq-null, eqeqeq
        if (!scenario.inflow && !scenario.rainfall && firstInflowId != null) updates.inflow = firstInflowId; // eslint-disable-line no-eq-null, eqeqeq
        if (Object.keys(updates).length > 0) {
            onUpdateScenario(scenario, updates);
        }
    }, [scenarioId, firstTerrainId, firstBoundaryId, firstInflowId]);
}

const ScenarioPane = (props) => {
    const {scenario, canEdit} = props;

    // UAT re-aim (finding 2) — completeness badges for the 3 section
    // headings, reusing validateCategoryProgress verbatim (same function,
    // same arguments) rather than re-deriving. boundaryHasFeatures
    // resolution (TASK-2045) moves here from the now-deleted
    // ScenarioCategoryRail — same one-line lookup against `boundaries`.
    const selectedBoundary = (props.boundaries || []).find(b => b && b.id === scenario?.boundary);
    const boundaryHasFeatures = selectedBoundary?.has_features;
    const inputsProgress = validateCategoryProgress('inputs', scenario, {boundaryHasFeatures});
    const advancedProgress = validateCategoryProgress('advanced', scenario);
    const runProgress = validateCategoryProgress('run', scenario);

    // TASK-1410: auto-populate required dropdowns for new scenarios.
    useAutoPopulateDefaults(
        scenario,
        canEdit,
        {terrain: props.terrain, boundaries: props.boundaries, inflows: props.inflows},
        props.onUpdateScenario
    );

    return (
        <div className="sv-menu-rows-pane sv-anuga-pane sv-anuga-scenario-pane">
            <div className="sv-anuga-pane-toolbar">
                <span className="sv-anuga-pane-head-label">
                    <Message msgId="hydrata.anuga.scenarios" />
                </span>
                {scenario ?
                    <span className="sv-anuga-pane-head-actions">
                        <ScenarioStatusPill scenario={scenario} compact />
                    </span> : null
                }
            </div>
            <div className="sv-anuga-scenario-pane-shell">
                <div className="sv-anuga-scenario-pane-detail">
                    {!scenario ?
                        <div className="sv-anuga-scenario-empty-pane">
                            <span
                                className="sv-anuga-scenario-empty-pane-glyph glyphicon glyphicon-info-sign"
                                aria-hidden="true"
                            />
                            <Message msgId="hydrata.anuga.emptyPaneSelectScenario" />
                        </div> :
                        <React.Fragment>
                            {!canEdit ?
                                <div className="sv-anuga-scenario-pane-readonly-hint" role="note">
                                    <span
                                        className="sv-anuga-scenario-pane-readonly-hint-glyph glyphicon glyphicon-lock"
                                        aria-hidden="true"
                                    />
                                    <Message msgId="hydrata.anuga.readOnlyPaneHint" />
                                </div> : null
                            }
                            {/* TASK-2114 (A+B) — Required/Optional/Run stack in ONE
                                scrollable body; no category gates which section
                                renders. UAT re-aim (finding 2) — each heading now
                                carries its own completeness badge (right-aligned),
                                replacing the removed rail's at-a-glance nav. */}
                            <div className="sv-anuga-scenario-pane-detail-body sv-anuga-scenario-pane-detail-body--merged">
                                {renderSectionHeading('hydrata.anuga.requiredInputs', inputsProgress)}
                                {renderInputsPane(props)}
                                {renderSectionHeading('hydrata.anuga.optionalInputs', advancedProgress)}
                                {renderAdvancedPane(props)}
                                {renderSectionHeading('hydrata.anuga.run', runProgress)}
                                {renderRunPane(props)}
                            </div>
                        </React.Fragment>
                    }
                </div>
            </div>
        </div>
    );
};

ScenarioPane.propTypes = {
    scenario: PropTypes.object,
    selectedCategoryId: PropTypes.oneOf(VALID_CATEGORIES),
    onSelectCategory: PropTypes.func,
    canEdit: PropTypes.bool,
    canRunScenario: PropTypes.bool,
    // TASK-2194 (epic 2190 W2) — staff gate + site compute-target config for
    // the Run section's advisory selector (server is the real gate).
    isStaff: PropTypes.bool,
    availableComputeTargets: PropTypes.array,
    defaultComputeTarget: PropTypes.string,
    // TASK-2194 (review fix) — the CURRENT scenario's session choice from
    // state.anuga.ui.sessionComputeTargets (undefined = none: the select
    // shows the marked site default) + the setter that records a pick on
    // that ui slot (never onUpdateScenario — see renderRunConfigPane).
    sessionComputeTarget: PropTypes.string,
    onSetSessionComputeTarget: PropTypes.func,
    currentUserId: PropTypes.number,
    terrain: PropTypes.array,
    boundaries: PropTypes.array,
    inflows: PropTypes.array,
    rainfalls: PropTypes.array,
    frictions: PropTypes.array,
    structures: PropTypes.array,
    meshRegions: PropTypes.array,
    networks: PropTypes.array,
    onUpdateScenario: PropTypes.func
};

ScenarioPane.defaultProps = {
    selectedCategoryId: 'inputs',
    canEdit: false,
    canRunScenario: false,
    isStaff: false
};

export {ScenarioPane, VALID_CATEGORIES};
