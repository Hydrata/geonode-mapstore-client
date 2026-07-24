import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {
    secondsToHM, hmToSeconds, DURATION_MAX_HOURS, DURATION_MINUTE_STEP, validateCategoryProgress,
    getMeshComparison, getMeshCostDriverHint, findScenarioStatus, RUN_FAILURE_STATES, IN_FLIGHT_STATUSES,
    runSettingsMustStayOpen, formatCostEstimate, bandForEstimate
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
import {FormRow, ErrorStrip} from '../../SimpleView/components/primitives';

/**
 * Merged-panel renderer for the Miller-columns scenarios panel (TASK-2114,
 * epic 2111 W2, dogfood findings A+B). Pane 3 stacks THREE sections —
 * Required / Optional inputs / Run settings — in ONE scrollable body, so
 * nothing is hidden behind a tab click. TASK-2245 (epic 2237 W3.1) had
 * merged Optional + Run into one collapsed-by-default RUN SETTINGS section;
 * TASK-2265 (epic 2237 W5, UAT re-aim findings 3+4) restores the pre-epic
 * 3-section shape while keeping EVERY section independently collapsible —
 * generalizing the W3.1 chevron pattern (useRunSettingsCollapse ->
 * useCollapsibleSection) rather than forking a second copy. Each section
 * stays always-rendered (only CSS-collapsed, never unmounted) for the same
 * reason TASK-2245 introduced that convention: the old Advanced tab HID
 * mesh_region until clicked, so a drawn-but-unattached mesh region silently
 * no-op'd at build time without ever being seen; see useCollapsibleSection.
 *
 * UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, findings 1+2) —
 * the vertical category rail (`ScenarioCategoryRail`, Pane 2) that used to
 * sit between the scenario list and this pane is REMOVED entirely: it was a
 * completeness-at-a-glance nav that no longer gated anything once the
 * sections merged into one scroll, so the operator judged it obsolete. This
 * pane (Pane 3) now expands to occupy the freed width. The per-category
 * completeness counts the rail used to show ("3/3", "0/3", "100%", ...)
 * move INTO each section's own heading instead, right-aligned in the same
 * heading band — see `renderCollapsibleSectionHeader` below — reusing
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
/**
 * TASK-2267 — a drawn layer whose linked PostGIS table is empty
 * (`has_features === false`, from RainfallSerializerV2 / MeshRegionSerializerV2)
 * is an empty scaffold, not a real drawn resource the user forgot to attach,
 * so it must NOT trigger the "unattached" nag. Strict `!== false`: both `true`
 * and `undefined` (a pre-2267 cached API response, or a serializer that didn't
 * carry the field) count as a real drawn layer — keep the notice, never
 * fabricate suppression from a missing field (same strict-boolean guard as
 * rainfallAttachedButEmpty's `=== false`).
 */
function isNonEmptyDrawnLayer(resource) {
    return !!resource && resource.has_features !== false;
}

export function meshRegionIsUnattached(scenario, meshRegions) {
    const drawnRegions = (Array.isArray(meshRegions) ? meshRegions : []).filter(isNonEmptyDrawnLayer);
    if (drawnRegions.length === 0) return false;
    const isAttached = scenario?.mesh_region != null && scenario?.mesh_region !== ''; // eslint-disable-line no-eq-null, eqeqeq
    return !isAttached;
}

function renderMeshRegionUnattachedHint(scenario, meshRegions) {
    if (!meshRegionIsUnattached(scenario, meshRegions)) return null;
    const names = (meshRegions || []).filter(isNonEmptyDrawnLayer).map(r => r?.title).filter(Boolean).join(', ');
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
    // TASK-2267 — an empty drawn rainfall (has_features === false) is a scaffold,
    // not a resource the user forgot to attach; filter it out before nagging.
    const drawnRainfalls = (Array.isArray(rainfalls) ? rainfalls : []).filter(isNonEmptyDrawnLayer);
    if (drawnRainfalls.length === 0) return false;
    const isAttached = scenario?.rainfall != null && scenario?.rainfall !== ''; // eslint-disable-line no-eq-null, eqeqeq
    return !isAttached;
}

function renderRainfallUnattachedHint(scenario, rainfalls) {
    if (!rainfallIsUnattached(scenario, rainfalls)) return null;
    const names = (rainfalls || []).filter(isNonEmptyDrawnLayer).map(r => r?.title).filter(Boolean).join(', ');
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
// TASK-2078 — results-freshness (a newer run is building/failed while the
// results on-screen are from the last COMPLETE run), relocated into the
// notices panel (TASK-2243, epic 2237 W2.1). Previously computed inline in
// anugaScenarioMenu.js's render(); moved here since `scenario` (carrying
// both latest_run and latest_complete_run) is already a ScenarioPane prop —
// no new prop threading needed. Both variants (FAILED and BUILDING) are
// preserved — dropping BUILDING would silently kill a live trust signal.
// ------------------------------------------------------------------------

/**
 * Returns 'failed' | 'building' | null. `null` covers both "no complete
 * results to protect yet" (hasCompleteResults false) and "the newest run IS
 * the complete one" (nothing fresher in flight/failed) — the two cases the
 * old inline gate (`showFreshnessBanner`) folded into a single boolean.
 */
export function getResultsFreshnessStatus(scenario) {
    const latestCompleteRun = scenario?.latest_complete_run;
    if (!latestCompleteRun) return null;
    const latestRun = scenario?.latest_run;
    const latestRunIsNewer = !!latestRun && latestRun.id !== latestCompleteRun.id;
    if (!latestRunIsNewer) return null;
    if (RUN_FAILURE_STATES.includes(latestRun.status)) return 'failed';
    if (IN_FLIGHT_STATUSES.includes(latestRun.status)) return 'building';
    return null;
}

function renderResultsFreshnessNotice(scenario, status) {
    const latestCompleteRun = scenario?.latest_complete_run;
    const msgId = status === 'failed'
        ? 'hydrata.anuga.resultsFreshnessBannerFailed'
        : 'hydrata.anuga.resultsFreshnessBannerBuilding';
    const className = status === 'failed'
        ? 'sv-anuga-scenario-results-freshness-failed-hint'
        : 'sv-anuga-scenario-results-freshness-building-hint';
    return (
        <div className={className} role="status" aria-live="polite">
            <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
            {' '}
            <Message msgId={msgId} msgParams={{id: latestCompleteRun?.id}} />
        </div>
    );
}

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

/**
 * TASK-2205 (W0.2 epic 2204) — when the scenario's assigned terrain is a
 * ready terrain flagged with coverage gaps (TerrainSerializerV2
 * has_coverage_gaps, from the TASK-2201 import-time nodata check), surface
 * an in-pane suggestion pointing at the EXISTING Combined-surface merge
 * (anugaInputMenu.js's "Combined surface" panel) rather than leaving the
 * user to discover the gap ~2 hours later at build (dogfood run 1283).
 * `has_coverage_gaps === true` only — `false` (clean) and `null`/`undefined`
 * (unstamped legacy terrain, pre-backfill) both stay silent; a legacy
 * terrain must not falsely claim to have gaps it was never checked for.
 */
function renderTerrainCoverageGapSuggestion(scenario, terrain, onOpenMergeTerrainsPanel) {
    const selectedTerrain = (terrain || []).find(t => t && t.id === scenario?.terrain);
    if (selectedTerrain?.has_coverage_gaps !== true) return null;
    return (
        <div
            className="sv-anuga-scenario-terrain-gap-suggestion"
            role="alert"
        >
            <Message msgId="hydrata.anuga.terrainCoverageGapSuggestion" />
            {' '}
            <a
                href="#"
                data-testid="anuga-terrain-gap-suggestion-merge-link"
                onClick={(e) => {
                    e.preventDefault();
                    if (onOpenMergeTerrainsPanel) onOpenMergeTerrainsPanel();
                }}
            >
                <Message msgId="hydrata.anuga.terrainCoverageGapSuggestionLink" />
            </a>
        </div>
    );
}

// ------------------------------------------------------------------------
// TASK-2243 (epic 2237 W2.1) — the notices panel: single collapsible
// amber advisory surface between the toolbar and the Required-inputs
// section. Centralizes derivation of every member notice (the 7-item
// inventory below, plus the W2.2 Run-failed notice) so the pane's
// individual sections no longer render these hints inline — but the
// existing predicate functions + their classnames/msgIds are reused
// UNCHANGED (DRY: no re-derivation, no new test-visible contract).
//
// Always-render + .is-open CSS-collapse convention (project-wide pin): the
// panel body itself never unmounts on toggle — only `.is-open` on the
// wrapper flips visibility via CSS — so a mounted child (e.g. the Run-failed
// notice's embedded ScenarioErrorStrip, TASK-2244) never loses its own
// internal state (logTailOpen) across a collapse/expand. The panel's own
// mount/unmount (returning null at N=0) is a DIFFERENT axis — there is
// nothing stateful to protect when no notice is active.
// ------------------------------------------------------------------------

/**
 * TASK-2244 (epic 2237 W2.2) — ordering matches the TASK-2243 inventory
 * (freshness-failed, freshness-building, rainfall-unattached,
 * rainfall-attached-empty, meshregion-unattached, inflow-anchor-mismatch,
 * terrain-coverage-gap), with the Run-failed notice appended last.
 */
/**
 * TASK-2264 — a failed archive (412: the scenario has an active/queued run)
 * stashes the BE detail on the scenario as `archiveError` (scenariosReducer).
 * Render it in the pane's consolidated notices surface via the shared
 * ErrorStrip primitive so the message is anchored beside the scenario the
 * archive was attempted on, not only in the easy-to-miss top-centre toast
 * (W4.2: the toast alone was never seen). Cleared on the next archive attempt
 * or a successful archive.
 */
function renderArchiveErrorNotice(scenario) {
    const detail = scenario?.archiveError;
    if (!detail) return null;
    return (
        <ErrorStrip
            extraClassName="sv-anuga-scenario-archive-error-strip"
            head={<Message msgId="hydrata.anuga.archiveErrorHead" />}
            payload={detail}
        />
    );
}

function buildScenarioNotices(props) {
    const {scenario, meshRegions, rainfalls, terrain, onOpenMergeTerrainsPanel, isStaff} = props;
    const notices = [];

    // TASK-2264 — a transient archive failure is the most actionable notice
    // (the user just clicked Archive); surface it first.
    const archiveErrorNode = renderArchiveErrorNotice(scenario);
    if (archiveErrorNode) notices.push({key: 'archive-error', node: archiveErrorNode});

    const freshnessStatus = getResultsFreshnessStatus(scenario);
    if (freshnessStatus === 'failed') {
        notices.push({key: 'results-freshness-failed', node: renderResultsFreshnessNotice(scenario, 'failed')});
    } else if (freshnessStatus === 'building') {
        notices.push({key: 'results-freshness-building', node: renderResultsFreshnessNotice(scenario, 'building')});
    }

    const rainfallUnattachedNode = renderRainfallUnattachedHint(scenario, rainfalls);
    if (rainfallUnattachedNode) notices.push({key: 'rainfall-unattached', node: rainfallUnattachedNode});

    const rainfallAttachedEmptyNode = renderRainfallAttachedEmptyHint(scenario, rainfalls);
    if (rainfallAttachedEmptyNode) notices.push({key: 'rainfall-attached-empty', node: rainfallAttachedEmptyNode});

    const meshRegionUnattachedNode = renderMeshRegionUnattachedHint(scenario, meshRegions);
    if (meshRegionUnattachedNode) notices.push({key: 'meshregion-unattached', node: meshRegionUnattachedNode});

    const inflowAnchorMismatchNode = renderInflowAnchorMismatchWarning(scenario);
    if (inflowAnchorMismatchNode) notices.push({key: 'inflow-anchor-mismatch', node: inflowAnchorMismatchNode});

    const terrainCoverageGapNode = renderTerrainCoverageGapSuggestion(scenario, terrain, onOpenMergeTerrainsPanel);
    if (terrainCoverageGapNode) notices.push({key: 'terrain-coverage-gap', node: terrainCoverageGapNode});

    // TASK-2244 (W2.2) — hosts the EXISTING ScenarioErrorStrip (cause line,
    // collapsible log tail, staff CloudWatch link) as this notice's body —
    // embedded verbatim, not re-implemented. Member only while the
    // scenario's resolved lifecycle status is 'error' (mirrors the strip's
    // own internal gate, so the notice and its content activate together).
    if (findScenarioStatus(scenario) === 'error') {
        notices.push({key: 'run-failed', node: <ScenarioErrorStrip scenario={scenario} isStaff={isStaff} />});
    }

    return notices;
}

/**
 * TASK-2243 (AC#1) — header '{N} notices' toggles collapse; dynamic count;
 * default open; NO persistence (plain useState, resets on remount — e.g. a
 * scenario switch remounts this component at a new tree position only if
 * the parent keys it, which it does not, so state naturally persists across
 * re-renders of the SAME scenario, exactly like every other local-state
 * component on this pane). Whole panel hidden at N=0 (nothing to toggle).
 */
function ScenarioNoticesPanel({notices}) {
    const [isOpen, setIsOpen] = useState(true);
    const count = notices.length;
    if (count === 0) return null;
    const panelClass = 'sv-anuga-notices-panel' + (isOpen ? ' is-open' : '');
    const toggleIconClass = 'sv-anuga-notices-panel-toggle-icon glyphicon'
        + (isOpen ? ' glyphicon-chevron-up' : ' glyphicon-chevron-down');
    return (
        <div className={panelClass}>
            <button
                type="button"
                className="sv-anuga-notices-panel-header"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="glyphicon glyphicon-info-sign sv-anuga-notices-panel-icon" aria-hidden="true" />
                <span className="sv-anuga-notices-panel-header-label">
                    <Message msgId="hydrata.anuga.noticesPanelHeader" msgParams={{count}} />
                </span>
                <span className={toggleIconClass} aria-hidden="true" />
            </button>
            {/* Always-render + .is-open CSS-collapse convention (karma
                determinism + logTailOpen survival, see block comment above). */}
            <div className="sv-anuga-notices-panel-body">
                {notices.map((notice) => (
                    <React.Fragment key={notice.key}>{notice.node}</React.Fragment>
                ))}
            </div>
        </div>
    );
}

ScenarioNoticesPanel.propTypes = {
    notices: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string,
        node: PropTypes.node
    }))
};

ScenarioNoticesPanel.defaultProps = {
    notices: []
};

// ------------------------------------------------------------------------
// Pane renderers — one per category
// ------------------------------------------------------------------------

// TASK-2210 (W3.1, epic 2204, AC#2) — which W2.1 estimate term the hint
// should name, keyed off getMeshCostDriverHint's driver key. 'holes' is
// deliberately absent (see scenarioHelpers.js — it is never reported as a
// driver: a negative term, not a cost source).
const MESH_COST_DRIVER_HINT_MESSAGE_IDS = {
    regions: 'hydrata.anuga.meshCostDriverHintRegions',
    breaklines: 'hydrata.anuga.meshCostDriverHintBreaklines',
    hole_perimeter: 'hydrata.anuga.meshCostDriverHintHolePerimeter'
};

/**
 * TASK-2210 (W3.1, AC#2) — the pre-build cost-driver hint: "your mesh
 * regions drive ~85% of your mesh cost" when a source OTHER than the base
 * mesh dominates the W2.1 estimate decomposition (the dogfood finding:
 * Resolution — the one visible lever — barely moved a mesh a MeshRegion
 * actually dominated). Reuses the amber advisory family (anuga.css: extend,
 * don't invent a parallel style) shared with the anchor-mismatch warning /
 * mesh-region-unattached hint / terrain-gap suggestion above. Silent
 * (returns null) when the breakdown is missing or 'base' dominates — see
 * getMeshCostDriverHint's own contract.
 */
function renderMeshCostDriverHint(scenario) {
    const hint = getMeshCostDriverHint(scenario?.mesh_triangle_count_estimate_breakdown);
    const msgId = hint && MESH_COST_DRIVER_HINT_MESSAGE_IDS[hint.driver];
    if (!hint || !msgId) return null;
    return (
        <div
            className="sv-anuga-scenario-pane-section sv-anuga-scenario-mesh-cost-driver-hint"
            role="note"
        >
            <Message msgId={msgId} msgParams={{share: hint.share}} />
        </div>
    );
}

/**
 * TASK-2210 (W3.1, AC#3) — post-build transparency: actual triangle count
 * vs. the stamped pre-build estimate + a re-priced actual-$ cost, once a
 * build has completed. Reads scenario.latest_run (RunSerializerV2's
 * mesh_provenance / mesh_triangle_count / mesh_actual_cost_estimate, W3.1
 * BE) via the SAME getMeshComparison the divergence-interrupt gate
 * (anugaScenarioMenu.js, TASK-2211) uses — one arithmetic source.
 *
 * Degrades gracefully (renders nothing) when there is nothing honest to
 * show: mesh_provenance REALITY (epic 2204 environment note, verified
 * live) — a FAILED build carries an EMPTY {}; a pre-epic/legacy run
 * carries NULL. Never fabricates a comparison from either.
 */
function renderMeshBuildComparison(scenario) {
    const comparison = getMeshComparison(scenario?.latest_run);
    if (!comparison) return null;
    return (
        <div className="sv-anuga-scenario-pane-section anuga-scenario-mesh-comparison-section">
            <span className="sv-anuga-scenario-mesh-comparison-label">
                <Message
                    msgId="hydrata.anuga.meshComparisonLabel"
                    msgParams={{
                        actual: Number(comparison.actual).toLocaleString(),
                        estimate: Number(comparison.estimate).toLocaleString()
                    }}
                />
                {comparison.actualCost !== null
                    ? ` — ~$${Number(comparison.actualCost).toFixed(2)}`
                    : ''}
            </span>
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

function renderEstimateOrBuiltSection(scenario, paywallEnabled, accountBalance, freeBand, onOpenAccountBilling) {
    const hasEstimate = (scenario?.mesh_triangle_count_estimate !== null && scenario?.mesh_triangle_count_estimate !== undefined)
        || (scenario?.compute_cost_estimate !== null && scenario?.compute_cost_estimate !== undefined);
    const comparison = getMeshComparison(scenario?.latest_run);
    const showBuilt = !scenario?.unsaved && !!comparison;

    if (showBuilt) {
        return renderMeshBuildComparison(scenario);
    }
    if (!hasEstimate) {
        return null;
    }
    // TASK-2420 (epic 2359 W4.5) — over-balance estimate badge: highlight +
    // link to the Billing tab when the estimate's BAND charge (never raw
    // cents — bandForEstimate mirrors gn_anuga.estimate.band()'s bucketing)
    // exceeds the account's balance. The free band ($0) never highlights —
    // a $0 run is never blocked by balance. Dark behind paywallEnabled
    // (AC1/AC3): flags-off renders nothing here regardless of balance data.
    const band = paywallEnabled
        ? bandForEstimate(scenario.compute_cost_estimate, freeBand?.edge, freeBand?.table)
        : null;
    // band === Infinity: estimate exceeds the finite dispatch ceiling — the
    // BE refuses these outright (review A14), so say that, never a band price.
    const overCeiling = paywallEnabled && band === Infinity;
    const overBalance = paywallEnabled && band !== null && Number.isFinite(band)
        && band > 0
        && accountBalance !== null && accountBalance !== undefined
        && band > Number(accountBalance);
    return (
        <div className="sv-anuga-scenario-pane-section anuga-scenario-estimate-section">
            <span className="sv-anuga-scenario-estimate-label">
                {'Estimate: '}
                {scenario.mesh_triangle_count_estimate !== null && scenario.mesh_triangle_count_estimate !== undefined
                    ? `~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`
                    : ''}
                {scenario.compute_cost_estimate !== null && scenario.compute_cost_estimate !== undefined
                    ? ` — ${formatCostEstimate(scenario.compute_cost_estimate)}`
                    : ''}
            </span>
            {overCeiling ? (
                <span
                    className="sv-anuga-scenario-estimate-over-balance-badge"
                    data-testid="sv-anuga-scenario-estimate-over-ceiling-badge"
                >
                    {'Above the automatic dispatch ceiling — contact us for a quote'}
                </span>
            ) : null}
            {overBalance ? (
                <button
                    type="button"
                    className="sv-anuga-scenario-estimate-over-balance-badge"
                    data-testid="sv-anuga-scenario-estimate-over-balance-badge"
                    onClick={() => { if (onOpenAccountBilling) onOpenAccountBilling(); }}
                >
                    {'Over balance — view account'}
                </button>
            ) : null}
            {/* TASK-2400(a)/2421 — when local edits are unsaved (scenario.unsaved,
                set by UPDATE_ANUGA_SCENARIO, cleared by SAVE_ANUGA_SCENARIO_SUCCESS
                or by a poll tick that delivers a genuinely refreshed estimate —
                scenariosReducer.js SET_ANUGA_POLLING_DATA), the figure above may
                still reflect the LAST SAVED config, not what the user is
                currently editing — surface that explicitly rather than let a
                stale number read as current. */}
            {scenario.unsaved ? (
                <span className="sv-anuga-scenario-estimate-stale" data-testid="sv-anuga-scenario-estimate-stale">
                    {' (estimate outdated — rebuild to refresh)'}
                </span>
            ) : null}
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
function renderRunConfigPane({scenario, canEdit, onUpdateScenario, isStaff, availableComputeTargets, defaultComputeTarget, sessionComputeTarget, onSetSessionComputeTarget, paywallEnabled, accountBalance, freeBand, onOpenAccountBilling}) {
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
                    // TASK-2210 (W3.1, epic 2204, od-2) — honest relabel: this field
                    // was "Resolution", implying it sets THE mesh size. It only sets
                    // an upper bound on the BASE mesh — MeshRegions (each with their
                    // OWN resolution, simpleViewMenuRow.js's 'mes_' field), Reflective
                    // structures and breaklines mesh finer wherever they're drawn, and
                    // in a refinement-heavy scenario THEY dominate triangle count, not
                    // this field (the dogfood finding: halving this moved a 768k-tri
                    // mesh ~5%). Glossary: "Mesh resolution" entry.
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
            {/* TASK-2242 (epic 2237 W1.4) — the runConfigHelp paragraph that used
                to render here is REMOVED: its content (mesh-region/structure/
                breakline fine-mesh note, duration requirement, compute-backend
                default) is now fully covered by the Build / Build-and-Run
                executable tooltips in the header strip (ScenarioHeaderActions),
                which additionally echo the live estimate right where the user's
                cursor already is. hydrata.anuga.runConfigHelp is retired
                deliberately (kept in the locale files as a historical, now-
                unreferenced key rather than deleted — see the wave report). */}
            {/* W3.2 (TASK-1267); re-based TASK-2093 (epic 2092 W1.1) — pre-dispatch
                triangle count + DOLLAR cost estimate. compute_cost_estimate used to
                be raw vCPU-hours mislabeled as a cost and printed with a '$' AND a
                'vCPU-h' suffix on the same number (the "$5237" bug) — the BE now
                returns a genuine dollar figure (canonical model x the configured
                $/vCPU-hour rate), so this renders ONE consistent dollar amount.
                TASK-2421 (UAT-1 findings 2+3) — Estimate and Built are now
                MUTUALLY EXCLUSIVE (renderEstimateOrBuiltSection below): a
                scenario with unsaved edits (or no build yet) shows Estimate
                only; a built, non-stale scenario shows Built only. Before
                this fix both blocks rendered independently and could appear
                stacked together post-build. */}
            {renderEstimateOrBuiltSection(scenario, paywallEnabled, accountBalance, freeBand, onOpenAccountBilling)}
            {renderMeshCostDriverHint(scenario)}
        </div>
    );
}

/**
 * TASK-2421 (UAT-1 findings 2+3) — ONE estimate/actual line at a time:
 *   - `scenario.unsaved` (edited since the last build/save): Estimate line,
 *     WITH the staleness hint — even if a prior build's comparison exists,
 *     since the edit has invalidated it.
 *   - otherwise, a completed build's mesh comparison exists (getMeshComparison):
 *     Built line only.
 *   - otherwise (pre-build, no edits pending): Estimate line, no stale hint.
 */
function renderRunPane(props) {
    const {
        scenario, canEdit, isStaff, onUpdateScenario,
        availableComputeTargets, defaultComputeTarget,
        sessionComputeTarget, onSetSessionComputeTarget,
        paywallEnabled, accountBalance, freeBand, onOpenAccountBilling
    } = props;
    return (
        <div className="sv-anuga-scenario-pane-rows sv-anuga-scenario-pane-rows-run">
            {/* Section (a): config fields */}
            {renderRunConfigPane({scenario, canEdit, onUpdateScenario, isStaff, availableComputeTargets, defaultComputeTarget, sessionComputeTarget, onSetSessionComputeTarget, paywallEnabled, accountBalance, freeBand, onOpenAccountBilling})}
            {/* Section (b): status feedback (ETA, progress). TASK-2244
                (epic 2237 W2.2) — the standalone ScenarioErrorStrip render
                that used to sit here is REMOVED: it's now embedded as the
                Run-failed notice's body in the notices panel (single error
                surface — see buildScenarioNotices), not re-implemented, just
                relocated. ScenarioStatusCard is untouched (own ETA/progress
                display, not one of the consolidated error indicators). */}
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

// TASK-2114 (A+B) — Required no longer gates a separate pane; it gets an
// in-body heading instead, reusing the same
// .sv-anuga-scenario-pane-detail-head(-title) chrome the single selected-
// category head used to own (border-bottom rule, font sizing) so no parallel
// heading style is introduced.
//
// UAT re-aim (finding 2) — `progress` is the SAME `validateCategoryProgress`
// result object the now-removed category rail rendered as its tag pill
// (`{tag, severity, ...}`); this just relocates that pill into the heading
// band, right-aligned via the title's own `flex: 1` (anuga.css) pushing it
// to the far edge. Reuses the rail's severity-class naming convention
// (is-ok/is-warn/is-err) under a NEW classname (not the rail's, which is
// gone) so the pill visually extends the existing token system rather than
// inventing a parallel one.
//
// TASK-2265 (epic 2237 W5, UAT re-aim findings 3+4) — every section heading
// is now a chevron TOGGLE (a <button>, not a plain <div>), generalizing the
// TASK-2245 RUN SETTINGS-only chevron pattern to all three sections
// (Required / Optional inputs / Run settings) rather than forking a second
// copy. `suppressErrBadge` carries forward TASK-2244's render-level 'err'
// suppression for the Run settings heading ONLY (the title pill + the
// Run-failed notice remain the sole standing error indicators there);
// Required legitimately shows every severity including 'err' (0/3 required
// fields is a real error), and 'advanced' progress (Optional inputs) can
// never BE 'err' in the first place (validateCategoryProgress), so
// suppression is a no-op for both — pass `false` for them.
function renderCollapsibleSectionHeader(kebabName, msgId, progress, isOpen, onToggle, suppressErrBadge) {
    const severity = progress && progress.severity;
    const suppressed = severity === 'err' && !!suppressErrBadge;
    const badgeClass = 'sv-anuga-scenario-pane-detail-head-badge'
        + (severity === 'ok' ? ' is-ok' : '')
        + (severity === 'warn' ? ' is-warn' : '')
        + (severity === 'err' && !suppressed ? ' is-err' : '');
    const toggleIconClass = `sv-anuga-scenario-pane-${kebabName}-toggle-icon glyphicon`
        + (isOpen ? ' glyphicon-chevron-up' : ' glyphicon-chevron-down');
    return (
        <button
            type="button"
            className={`sv-anuga-scenario-pane-detail-head sv-anuga-scenario-pane-${kebabName}-header`}
            aria-expanded={isOpen}
            onClick={onToggle}
        >
            <h3 className="sv-anuga-scenario-pane-detail-head-title">
                <Message msgId={msgId} />
            </h3>
            {progress && !suppressed ? <span className={badgeClass}>{progress.tag}</span> : null}
            <span className={toggleIconClass} aria-hidden="true" />
        </button>
    );
}

/**
 * TASK-2265 — wraps a section's chevron header + body in the always-render +
 * `.is-open` CSS-collapse convention (project-wide pin, TASK-2243/2245
 * precedent): the body never unmounts on toggle, only `.is-open` on the
 * wrapper flips CSS visibility — so karma stays deterministic and no mounted
 * child (e.g. the Run settings log viewer) ever loses internal state across
 * a collapse/expand.
 */
function renderCollapsibleSection(kebabName, headerNode, bodyNode, isOpen) {
    const sectionClass = `sv-anuga-scenario-pane-${kebabName}` + (isOpen ? ' is-open' : '');
    return (
        <div className={sectionClass}>
            {headerNode}
            <div className={`sv-anuga-scenario-pane-${kebabName}-body`}>
                {bodyNode}
            </div>
        </div>
    );
}

// ------------------------------------------------------------------------
// TASK-2265 (epic 2237 W5) — generalized collapse + expand-then-focus bridge
// ------------------------------------------------------------------------

/**
 * Collapse-state + expand-then-focus bridge, generalized (TASK-2265, UAT
 * re-aim findings 3+4) from TASK-2245's RUN-SETTINGS-only
 * `useRunSettingsCollapse` so all THREE ScenarioPane sections (Required /
 * Optional inputs / Run settings) share one implementation rather than
 * forking a second near-identical copy. Shaped like `useAutoPopulateDefaults`
 * below — a plain hook-like function called directly from ScenarioPane's
 * render body (never as a JSX component) so its hook calls stay attributed
 * to ScenarioPane itself and run in a stable order every render.
 *
 * @param {boolean} initialOpen - this section's starting isOpen (Required:
 *   true; Optional inputs / Run settings: false — TASK-2265 AC#3).
 * @param {*} expandToken - null/undefined means "no request yet" (the
 *   menu's own initial state); any OTHER value whose IDENTITY changes from
 *   the last one HANDLED counts as a new expand-then-focus request from
 *   anugaScenarioMenu.js (the menu uses an incrementing counter that starts
 *   at null and is bumped to 1, 2, ... — never starts at 0, which would
 *   itself look like an unhandled request on the very first mount). Every
 *   section now has a bridge (TASK-2268 adds Required's, closing the W5 gap
 *   where a Build-validation failure on a Required-section field left the
 *   field CSS-hidden if the user had collapsed it) — none is passed `null`
 *   for lack of a bridge any more, but the contract still allows it for any
 *   FUTURE section that legitimately has none.
 * @param {function} onExpanded - fired once the open state has actually
 *   committed to the DOM (see the useLayoutEffect ordering below) so the
 *   menu's own `.focus()` call never races a still-collapsed element.
 * @param {boolean} mustStayOpen - two independent triggers keep the section
 *   open, both landing on the SAME underlying `isOpen` boolean:
 *     (a) `mustStayOpen === true` forces a plain `setIsOpen(true)` (not a
 *         mere OR) so the section is STILL open once the condition clears,
 *         unless the user has since clicked to collapse it (Run settings
 *         only: `runSettingsMustStayOpen`, scenarioHelpers.js — a build/run
 *         in flight or errored must not hide the progress card + log viewer
 *         it hosts). Pass `false` for Required/Optional inputs — nothing
 *         forces those open.
 *     (b) the returned `displayOpen = isOpen || mustStayOpen` ALSO forces
 *         the section visually open independent of (a) ever having run —
 *         e.g. a user click to collapse arriving mid-run sets the
 *         underlying `isOpen` to false, but `displayOpen` stays true until
 *         the condition actually clears (at which point the collapse the
 *         user asked for finally takes visual effect — still "by user
 *         action", just deferred).
 *
 * `useLayoutEffect` (never `useEffect`) is deliberate throughout: a
 * `.focus()` fired in the same tick as the setState that reveals the field
 * would race the commit and land on a still-collapsed (`display:none`)
 * element (the W2 karma flush gotcha, generalised here to a real-browser
 * CSS-collapse).
 */
function useCollapsibleSection(initialOpen, expandToken, onExpanded, mustStayOpen) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const handledTokenRef = useRef(null);
    const pendingNotifyRef = useRef(false);
    const displayOpen = isOpen || !!mustStayOpen;

    useLayoutEffect(() => {
        if (mustStayOpen) setIsOpen(true);
    }, [mustStayOpen]);

    useLayoutEffect(() => {
        if (expandToken === null || expandToken === undefined || expandToken === handledTokenRef.current) return; // eslint-disable-line no-eq-null, eqeqeq
        handledTokenRef.current = expandToken;
        if (displayOpen) {
            // Already open (e.g. a run is in flight) — no OPEN transition
            // will fire below, so notify immediately.
            if (onExpanded) onExpanded();
        } else {
            pendingNotifyRef.current = true;
            setIsOpen(true);
        }
        // Deliberately keyed on `expandToken` alone (not `displayOpen` /
        // `onExpanded`) — this effect must fire exactly once PER REQUEST
        // (a new token), not on every render where those happen to change;
        // handledTokenRef is the de-dupe guard, not the dep array. (No
        // react-hooks/exhaustive-deps rule is configured in this project's
        // eslint config, so no suppression comment is needed here.)
    }, [expandToken]);

    // Fires exactly once the isOpen->true transition armed above has
    // actually committed (a NEW render with displayOpen===true has
    // painted its DOM) — i.e. only now is it safe for the menu to focus.
    useLayoutEffect(() => {
        if (displayOpen && pendingNotifyRef.current) {
            pendingNotifyRef.current = false;
            if (onExpanded) onExpanded();
        }
    }, [displayOpen]);

    const toggle = () => setIsOpen((prev) => !prev);
    return [displayOpen, toggle];
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
    // TASK-2205 (W0.2 epic 2204): among ready terrains, prefer a full-coverage
    // one (has_coverage_gaps === false, TerrainSerializerV2) over an
    // earlier-listed gappy fine survey — auto-defaulting to a known-gappy
    // terrain silently seeds a new scenario for the run-1283 class of
    // build-time failure. Falls back to the first ready terrain (even gappy,
    // or unstamped/null) so an all-gappy or pre-epic project still gets a
    // usable default.
    const readyTerrains = (terrain || []).filter(t => t?.status === 'ready');
    const fullCoverageTerrain = readyTerrains.find(t => t?.has_coverage_gaps === false);
    const firstReadyTerrain = fullCoverageTerrain || readyTerrains[0];
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

    // UAT re-aim (finding 2) — completeness badges for the section headings,
    // reusing validateCategoryProgress verbatim (same function, same
    // arguments) rather than re-deriving. boundaryHasFeatures resolution
    // (TASK-2045) moves here from the now-deleted ScenarioCategoryRail —
    // same one-line lookup against `boundaries`. TASK-2265 (epic 2237 W5) —
    // Optional inputs is its own section again (the W3.1 merge that had
    // stopped painting 'advanced' progress anywhere is reverted), so it is
    // computed here again too.
    const selectedBoundary = (props.boundaries || []).find(b => b && b.id === scenario?.boundary);
    const boundaryHasFeatures = selectedBoundary?.has_features;
    const inputsProgress = validateCategoryProgress('inputs', scenario, {boundaryHasFeatures});
    const advancedProgress = validateCategoryProgress('advanced', scenario);
    const runProgress = validateCategoryProgress('run', scenario);

    // TASK-2265 (epic 2237 W5, UAT re-aim findings 3+4) — three
    // independently collapsible sections (see useCollapsibleSection's doc
    // comment for the full contract). Required starts OPEN; Optional inputs
    // and Run settings start COLLAPSED. mesh_region's "Attach first" flow
    // targets Optional inputs; resolution/duration build-validation and the
    // in-flight/errored guarantee target Run settings. TASK-2268 (epic 2237
    // W5.3) gives Required its OWN expand-then-focus bridge too: a Build /
    // Build-and-Run validation failure on a Required-section field
    // (name/terrain/boundary/inflowOrRainfall) must still expand-then-focus
    // even though Required starts open — the user may have manually
    // collapsed it (TASK-2265 made Required collapsible), which is exactly
    // the gap that left the offending field CSS-hidden behind the fired
    // dialog.
    const [isRequiredOpen, toggleRequired] = useCollapsibleSection(
        true, props.requiredExpandToken, props.onRequiredExpanded, false
    );
    const [isOptionalInputsOpen, toggleOptionalInputs] = useCollapsibleSection(
        false, props.optionalInputsExpandToken, props.onOptionalInputsExpanded, false
    );
    const [isRunSettingsOpen, toggleRunSettings] = useCollapsibleSection(
        false, props.runSettingsExpandToken, props.onRunSettingsExpanded, runSettingsMustStayOpen(scenario)
    );

    // TASK-2244 (epic 2237 W2.2) — the title pill: the ONE standing error
    // indicator that survives the error-surface consolidation (alongside the
    // Run-failed notice below). Reuses ScenarioStatusPill verbatim (compact)
    // — it already renders the exact "Error" chip this needs — but now ONLY
    // for the errored case; for every other status this slot renders
    // nothing (previously it showed a compact pill for ANY status, which is
    // one of the "duplicate 'Error' label" sources this wave removes: the
    // Run pane's own ScenarioStatusCard already carries the canonical
    // status pill for the non-error case).
    const latestRunErrored = findScenarioStatus(scenario) === 'error';

    // TASK-2243/2244 (epic 2237 W2) — every member notice (7-item inventory
    // + the Run-failed notice), single source computed here so the panel
    // below and nothing else derives them.
    const notices = buildScenarioNotices(props);

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
                {scenario && latestRunErrored ?
                    <span className="sv-anuga-pane-head-actions">
                        <ScenarioStatusPill scenario={scenario} compact />
                    </span> : null
                }
            </div>
            {/* TASK-2243 (epic 2237 W2.1) — the notices panel: single
                collapsible amber advisory surface, between the toolbar and
                the Required-inputs section (below, inside the shell). */}
            <ScenarioNoticesPanel notices={notices} />
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
                            {/* TASK-2114 (A+B) — no category gates which
                                section renders; all three stack in one
                                scroll. UAT re-aim (finding 2) — each heading
                                carries its own completeness badge
                                (right-aligned), replacing the removed rail's
                                at-a-glance nav. TASK-2265 (epic 2237 W5) —
                                Required / Optional inputs / Run settings are
                                THREE independently collapsible sections again
                                (the pre-epic shape, restored from TASK-2245's
                                merge) — see useCollapsibleSection for the
                                collapse + expand-then-focus contract. */}
                            <div className="sv-anuga-scenario-pane-detail-body sv-anuga-scenario-pane-detail-body--merged">
                                {renderCollapsibleSection(
                                    'required',
                                    renderCollapsibleSectionHeader(
                                        'required', 'hydrata.anuga.requiredInputs', inputsProgress,
                                        isRequiredOpen, toggleRequired, false
                                    ),
                                    renderInputsPane(props),
                                    isRequiredOpen
                                )}
                                {renderCollapsibleSection(
                                    'optional-inputs',
                                    renderCollapsibleSectionHeader(
                                        'optional-inputs', 'hydrata.anuga.optionalInputs', advancedProgress,
                                        isOptionalInputsOpen, toggleOptionalInputs, false
                                    ),
                                    renderAdvancedPane(props),
                                    isOptionalInputsOpen
                                )}
                                {renderCollapsibleSection(
                                    'run-settings',
                                    renderCollapsibleSectionHeader(
                                        'run-settings', 'hydrata.anuga.runSettings', runProgress,
                                        isRunSettingsOpen, toggleRunSettings, true
                                    ),
                                    renderRunPane(props),
                                    isRunSettingsOpen
                                )}
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
    // TASK-2205 (W0.2 epic 2204) — opens the stand-alone "Combined surface"
    // merge panel from the gap-suggestion link (see
    // renderTerrainCoverageGapSuggestion). Same action anugaInputMenu.js's
    // header button dispatches (setTerrainWorkbenchVisible(true)).
    onOpenMergeTerrainsPanel: PropTypes.func,
    // TASK-2420 (epic 2359 W4.5) — over-balance estimate badge.
    paywallEnabled: PropTypes.bool,
    accountBalance: PropTypes.string,
    freeBand: PropTypes.shape({cap: PropTypes.number, usedToday: PropTypes.number, edge: PropTypes.string, table: PropTypes.array}),
    onOpenAccountBilling: PropTypes.func,
    terrain: PropTypes.array,
    boundaries: PropTypes.array,
    inflows: PropTypes.array,
    rainfalls: PropTypes.array,
    frictions: PropTypes.array,
    structures: PropTypes.array,
    meshRegions: PropTypes.array,
    networks: PropTypes.array,
    onUpdateScenario: PropTypes.func,
    // TASK-2268 (epic 2237 W5.3) — expand-then-focus bridge for the
    // REQUIRED section, mirroring runSettingsExpandToken/
    // optionalInputsExpandToken below exactly: the menu bumps
    // `requiredExpandToken` (any value whose IDENTITY changes per request)
    // whenever a build-validation failure targets a Required-section field
    // (name/terrain/boundary/inflowOrRainfall) while the section is
    // collapsed; `onRequiredExpanded` fires back once the section has
    // actually committed open.
    requiredExpandToken: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onRequiredExpanded: PropTypes.func,
    // TASK-2245 (epic 2237 W3.1); re-targeted TASK-2265 (epic 2237 W5) —
    // expand-then-focus bridge for the RUN SETTINGS collapse: the menu bumps
    // `runSettingsExpandToken` (any value whose IDENTITY changes per
    // request) whenever a build-validation failure on resolution/duration
    // targets a field inside this section; `onRunSettingsExpanded` fires
    // back once the section has actually committed open, so the menu's own
    // .focus() call never races the collapse. See useCollapsibleSection's
    // doc comment for the full contract.
    runSettingsExpandToken: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onRunSettingsExpanded: PropTypes.func,
    // TASK-2265 (epic 2237 W5, UAT re-aim finding 4) — the Optional inputs
    // analog of the pair above: mesh_region's "Attach first" flow
    // (anugaScenarioMenu.js's handleMeshRegionWarningAttachFirst) now bumps
    // THIS token instead, since mesh_region moved out of the merged RUN
    // SETTINGS section into its own Optional inputs section.
    optionalInputsExpandToken: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onOptionalInputsExpanded: PropTypes.func
};

ScenarioPane.defaultProps = {
    selectedCategoryId: 'inputs',
    canEdit: false,
    canRunScenario: false,
    isStaff: false
};

export {ScenarioPane, VALID_CATEGORIES};
