import React, {useEffect} from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {toHHMM, getSecondsFromHHMM} from './scenarioHelpers';
import {ScenarioStatusPill} from './scenarioStatusPill';
import {ScenarioActionToolbar} from './scenarioActionToolbar';
import {ScenarioCategoryRail} from './scenarioCategoryRail';
import {ScenarioResourceSummary, summariseResource} from './scenarioResourceSummary';
import {ScenarioStatusCard} from './scenarioStatusCard';
import {ScenarioErrorStrip} from './scenarioErrorStrip';
// TASK-1764 (epic-1758 W1) — chassis FormRow frames the scenario-detail
// label/field rows (Inputs / Advanced / Run). The legacy
// .anuga-scenario-pane-section row class rides extraClassName so the
// existing chrome + the scenarioPane test's
// .anuga-scenario-pane-field.is-readonly / #id assertions stay intact; the
// .anuga-scenario-pane-field wrapper (carrying .is-readonly) is preserved as
// the FormRow child so the readonly-count contract holds.
import {FormRow} from '../../SimpleView/components/primitives';

/**
 * Per-category pane renderer for the Miller-columns scenarios panel. The
 * vertical category rail (`ScenarioCategoryRail`, Pane 2) drives a per-
 * category detail body (Pane 3).
 *
 * 4 categories: 'inputs' / 'advanced' / 'runConfig' / 'statusActions'.
 * runConfig absorbs the resolution/duration/compute-backend choice that
 * used to live in Advanced + the legacy AnugaRunMenu modal. statusActions
 * consolidates the legacy Run + Actions subtabs and adds the new
 * ScenarioStatusCard + ScenarioErrorStrip. The inline ScenarioRunLog is
 * embedded at the bottom of the statusActions pane.
 *
 * Field-edit callbacks (name, dropdowns, resolution, duration, compute
 * backend) dispatch through the container's `onUpdateScenario` prop.
 * Build/Run/Log/Duplicate/Archive/Delete dispatches stay on the
 * ScenarioActionToolbar.
 */

// TASK-1416 (ISSUE 20.7): 'runConfig' + 'statusActions' merged into single 'run'
// category. Both old IDs kept in the array for graceful fallback (existing Redux
// state may carry either; they redirect to 'run' via resolvedCategory below).
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
            <div className="anuga-scenario-pane-log">
                <div className="anuga-scenario-pane-log-head">
                    <span className="anuga-scenario-pane-log-title">
                        <Message msgId="hydrata.anuga.log" />
                        {Number.isFinite(lineCount) ? ` (${lineCount})` : null}
                    </span>
                </div>
                <pre ref={this.logRef} className="anuga-scenario-pane-log-viewer">
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
    const fieldClass = 'anuga-scenario-pane-field' + (disabled ? ' is-readonly' : '');
    return (
        <FormRow
            key={id}
            extraClassName="anuga-scenario-pane-section"
            label={
                <label className="anuga-scenario-pane-label" htmlFor={id}>
                    <Message msgId={label} />
                </label>
            }
        >
            <div className={fieldClass}>
                <select
                    id={id}
                    className={'scenario-select'}
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

function renderResourceSummary(scenario, kind, resourceList) {
    const assignedId = scenario?.[kind];
    const summary = summariseResource(resourceList, assignedId, kind);
    if (summary) {
        return (
            <ScenarioResourceSummary
                kind={kind}
                body={summary.body}
                meta={summary.meta}
            />
        );
    }
    // Always render the summary card so layout is stable as the user picks
    // values from each dropdown. Empty-state body is a single em-dash.
    return (
        <ScenarioResourceSummary
            kind={kind}
            body={<span className="anuga-scenario-resource-summary-placeholder">—</span>}
            meta={null}
            extraClassName="is-empty"
        />
    );
}

// ------------------------------------------------------------------------
// Pane renderers — one per category
// ------------------------------------------------------------------------

function renderInputsPane({scenario, canEdit, onUpdateScenario, terrain, boundaries, inflows, rainfalls}) {
    const handleField = (kv) => {
        if (onUpdateScenario) onUpdateScenario(scenario, kv);
    };
    // Wave 3B (B4) — wrappers get .is-readonly when canEdit=false so the
    // dim + cursor:not-allowed treatment in anuga.css applies. Input keeps
    // readOnly (not disabled) so the user can still focus + copy the value.
    const nameFieldClass = 'anuga-scenario-pane-field' + (!canEdit ? ' is-readonly' : '');
    return (
        <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-inputs">
            <FormRow
                extraClassName="anuga-scenario-pane-section"
                label={
                    <label className="anuga-scenario-pane-label" htmlFor="name">
                        <Message msgId="hydrata.anuga.name" />
                    </label>
                }
            >
                <div className={nameFieldClass}>
                    <input
                        id="name"
                        type="text"
                        className="scenario-input"
                        value={scenario?.name || ''}
                        readOnly={!canEdit}
                        onChange={(e) => handleField({name: e.target.value})}
                    />
                </div>
            </FormRow>
            {renderSelectField('terrain', 'hydrata.anuga.terrain', scenario?.terrain, terrain, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'terrain', terrain)}
            {renderSelectField('boundary', 'hydrata.anuga.boundary', scenario?.boundary, boundaries, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'boundary', boundaries)}
            {renderSelectField('inflow', 'hydrata.anuga.inflow', scenario?.inflow, inflows, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'inflow', inflows)}
            {renderSelectField('rainfall', 'hydrata.anuga.rainfall', scenario?.rainfall, rainfalls, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'rainfall', rainfalls)}
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
        <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-advanced">
            {renderSelectField('friction', 'hydrata.anuga.friction', scenario?.friction, frictions, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'friction', frictions)}
            {renderSelectField('structure', 'hydrata.anuga.structures', scenario?.structure, structures, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'structure', structures)}
            {renderSelectField('mesh_region', 'hydrata.anuga.meshRegions', scenario?.mesh_region, meshRegions, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'mesh_region', meshRegions)}
        </div>
    );
}

// TASK-1415 (ISSUE 20.6): compute selector is superuser-only (advisory FE gate;
// real enforcement is server-side in StartRunView.post). Shows Local/Cloud only
// (not raw enum values like 'ec2'). Mapping: local→"Local", batch→"Cloud".
const COMPUTE_LABEL_MAP = {local: 'Local', batch: 'Cloud'};
const SUPERUSER_COMPUTE_OPTIONS = [
    {value: 'local', label: 'Local'},
    {value: 'batch', label: 'Cloud'}
];

function renderRunConfigPane({scenario, canEdit, onUpdateScenario, computeInstances, isSuperuser}) {
    const handleField = (kv) => {
        if (onUpdateScenario) onUpdateScenario(scenario, kv);
    };
    const handleTimeChange = (e) => {
        handleField({tempTimeString: e.target.value});
    };
    const handleTimeBlur = (e) => {
        const seconds = Math.max(0, getSecondsFromHHMM(e.target.value));
        handleField({duration: seconds, tempTimeString: undefined});
    };
    const handleResolutionChange = (e) => {
        // Empty/non-finite input: skip dispatch so the last good value is preserved (K4 guard).
        const raw = e.target.value;
        if (raw === '') return;
        const next = parseFloat(raw);
        if (!Number.isFinite(next)) return;
        handleField({resolution: next});
    };
    const handleBackendChange = (e) => {
        const next = e.target.value || null;
        handleField({compute_backend: next});
    };
    // Wave 3B (B4) — same is-readonly wrapper toggle as renderInputsPane.
    const unitFieldClass = 'anuga-scenario-pane-field anuga-scenario-pane-field--unit'
        + (!canEdit ? ' is-readonly' : '');
    const selectFieldClass = 'anuga-scenario-pane-field' + (!canEdit ? ' is-readonly' : '');

    return (
        <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-run-config">
            <FormRow
                extraClassName="anuga-scenario-pane-section"
                label={
                    <label className="anuga-scenario-pane-label" htmlFor="resolution">
                        <Message msgId="hydrata.anuga.resolutionM2" />
                    </label>
                }
            >
                <div className={unitFieldClass}>
                    <input
                        id="resolution"
                        type="number"
                        className="scenario-input scenario-input-narrow"
                        value={scenario?.resolution != null ? scenario.resolution : ''} // eslint-disable-line no-eq-null, eqeqeq
                        readOnly={!canEdit}
                        onChange={handleResolutionChange}
                    />
                    {/* TASK-1413: resolution is a target edge-length in metres (not m²).
                        Formula: triangles ≈ area / (resolution² / 2) confirms linear m. */}
                    <span className="anuga-scenario-pane-field-unit">m</span>
                </div>
            </FormRow>
            <FormRow
                extraClassName="anuga-scenario-pane-section"
                label={
                    <label className="anuga-scenario-pane-label" htmlFor="duration">
                        <Message msgId="hydrata.anuga.duration" />
                    </label>
                }
            >
                <div className={unitFieldClass}>
                    <input
                        id="duration"
                        type="text"
                        className="scenario-input scenario-input-narrow"
                        value={scenario?.tempTimeString != null ? scenario.tempTimeString : toHHMM(scenario?.duration)} // eslint-disable-line no-eq-null, eqeqeq
                        readOnly={!canEdit}
                        onChange={handleTimeChange}
                        onBlur={handleTimeBlur}
                    />
                    {/* TASK-1414: duration stored in seconds, displayed as hh:mm */}
                    <span className="anuga-scenario-pane-field-unit">hh:mm</span>
                </div>
            </FormRow>
            {/* TASK-1415: compute selector is superuser-only (FE advisory gate;
                  server-side enforcement is in StartRunView.post). Non-superusers
                  never see this field — the backend ignores their compute_backend
                  and always uses ANUGA_DEFAULT_COMPUTE_BACKEND. */}
            {isSuperuser ? (
                <FormRow
                    extraClassName="anuga-scenario-pane-section"
                    label={
                        <label className="anuga-scenario-pane-label" htmlFor="compute_backend">
                            <Message msgId="hydrata.anuga.computeBackend" />
                        </label>
                    }
                >
                    <div className={selectFieldClass}>
                        <select
                            id="compute_backend"
                            className="scenario-select"
                            value={scenario?.compute_backend || ''}
                            disabled={!canEdit}
                            onChange={handleBackendChange}
                        >
                            <option value="">-</option>
                            {(Array.isArray(computeInstances) && computeInstances.length > 0)
                                ? computeInstances.filter(opt => {
                                    // Only show options that map to Local or Cloud.
                                    const val = opt.value || opt.id || opt;
                                    return COMPUTE_LABEL_MAP[val] !== undefined;
                                }).map((opt, idx) => {
                                    const val = opt.value || opt.id || opt;
                                    return (
                                        <option key={idx} value={val}>
                                            {COMPUTE_LABEL_MAP[val] || opt.label || val}
                                        </option>
                                    );
                                })
                                : SUPERUSER_COMPUTE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))
                            }
                        </select>
                    </div>
                </FormRow>
            ) : null}
            <div className="anuga-scenario-pane-section anuga-scenario-pane-section--help">
                <span className="anuga-scenario-pane-help">
                    <Message msgId="hydrata.anuga.runConfigHelp" />
                </span>
            </div>
            {/* W3.2 (TASK-1267) — pre-dispatch triangle count + cost estimate */}
            {((scenario?.mesh_triangle_count_estimate !== null && scenario?.mesh_triangle_count_estimate !== undefined) || (scenario?.compute_cost_estimate !== null && scenario?.compute_cost_estimate !== undefined)) && (
                <div className="anuga-scenario-pane-section anuga-scenario-estimate-section">
                    <span className="anuga-scenario-estimate-label">
                        {'Estimate: '}
                        {scenario.mesh_triangle_count_estimate !== null && scenario.mesh_triangle_count_estimate !== undefined
                            ? `~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`
                            : ''}
                        {scenario.compute_cost_estimate !== null && scenario.compute_cost_estimate !== undefined
                            ? ` — ~$${scenario.compute_cost_estimate.toFixed(2)} vCPU-h`
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
 *   (c) Build / Run / Cancel / Delete action toolbar
 *   (d) LOG output viewer
 *
 * The former separate feedback panel (ScenarioStatusCard + ScenarioErrorStrip)
 * is preserved — it shows ETA, progress, and error messages which the user
 * needs before deciding to retry or cancel. No data is dropped.
 */
function renderRunPane(props) {
    const {
        scenario, canEdit, canRunScenario, isSuperuser, onUpdateScenario,
        computeInstances, onBuildClick, onRunClick, onRetryClick,
        onArchiveClick, onUnarchiveClick, onConfirmDelete, onConfirmCancelRun
    } = props;
    return (
        <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-run">
            {/* Section (a): config fields */}
            {renderRunConfigPane({scenario, canEdit, onUpdateScenario, computeInstances, isSuperuser})}
            {/* Section (b): status feedback (ETA, progress, error) */}
            <ScenarioErrorStrip scenario={scenario} />
            <ScenarioStatusCard scenario={scenario} />
            {/* Section (c): action toolbar */}
            <div className="anuga-scenario-pane-actions">
                <ScenarioActionToolbar
                    scenario={scenario}
                    canEdit={canEdit}
                    canRunScenario={canRunScenario}
                    onBuildClick={onBuildClick}
                    onRunClick={onRunClick}
                    onRetryClick={onRetryClick}
                    onArchiveClick={onArchiveClick}
                    onUnarchiveClick={onUnarchiveClick}
                    onConfirmDelete={onConfirmDelete}
                    onConfirmCancelRun={onConfirmCancelRun}
                />
            </div>
            {/* Section (d): LOG output */}
            <ScenarioRunLog
                log={scenario?.latest_run?.log}
                lineCount={scenario?.latest_run?.log_line_count}
            />
        </div>
    );
}

// ------------------------------------------------------------------------
// Pane head (above Pane 3)
// ------------------------------------------------------------------------

function renderDetailHead(selectedCategoryId) {
    const labelMap = {
        inputs: 'hydrata.anuga.requiredInputs',
        advanced: 'hydrata.anuga.optionalInputs',
        run: 'hydrata.anuga.run',
        // Legacy keys kept for redirect-safety (shouldn't normally render as heads)
        runConfig: 'hydrata.anuga.run',
        statusActions: 'hydrata.anuga.run'
    };
    const msgId = labelMap[selectedCategoryId] || labelMap.inputs;
    return (
        <div className="anuga-scenario-pane-detail-head">
            <h3 className="anuga-scenario-pane-detail-head-title">
                <Message msgId={msgId} />
            </h3>
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
    const firstTerrainId = terrain && terrain[0] ? terrain[0].id : null;
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
    const {scenario, selectedCategoryId, onSelectCategory, canEdit} = props;
    // TASK-1416: redirect legacy 'runConfig'/'statusActions' ids → 'run'
    const _rawCategory = VALID_CATEGORIES.includes(selectedCategoryId)
        ? selectedCategoryId
        : 'inputs';
    const resolvedCategory = (_rawCategory === 'runConfig' || _rawCategory === 'statusActions')
        ? 'run'
        : _rawCategory;

    // TASK-1410: auto-populate required dropdowns for new scenarios.
    useAutoPopulateDefaults(
        scenario,
        canEdit,
        {terrain: props.terrain, boundaries: props.boundaries, inflows: props.inflows},
        props.onUpdateScenario
    );

    return (
        <div className="sv-menu-rows-pane anuga-pane anuga-scenario-pane">
            <div className="anuga-pane-toolbar">
                <span className="anuga-pane-head-label">
                    <Message msgId="hydrata.anuga.scenarios" />
                </span>
                {scenario ?
                    <span className="anuga-pane-head-actions">
                        <ScenarioStatusPill scenario={scenario} compact />
                    </span> : null
                }
            </div>
            <div className="anuga-scenario-pane-shell">
                <ScenarioCategoryRail
                    scenario={scenario}
                    selectedCategoryId={resolvedCategory}
                    onSelectCategory={onSelectCategory}
                />
                <div className="anuga-scenario-pane-detail">
                    {!scenario ?
                        <div className="anuga-scenario-empty-pane">
                            <span
                                className="anuga-scenario-empty-pane-glyph glyphicon glyphicon-info-sign"
                                aria-hidden="true"
                            />
                            <Message msgId="hydrata.anuga.emptyPaneSelectScenario" />
                        </div> :
                        <React.Fragment>
                            {renderDetailHead(resolvedCategory)}
                            {!canEdit ?
                                <div className="anuga-scenario-pane-readonly-hint" role="note">
                                    <span
                                        className="anuga-scenario-pane-readonly-hint-glyph glyphicon glyphicon-lock"
                                        aria-hidden="true"
                                    />
                                    <Message msgId="hydrata.anuga.readOnlyPaneHint" />
                                </div> : null
                            }
                            <div className="anuga-scenario-pane-detail-body">
                                {resolvedCategory === 'inputs' && renderInputsPane(props)}
                                {resolvedCategory === 'advanced' && renderAdvancedPane(props)}
                                {resolvedCategory === 'run' && renderRunPane(props)}
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
    isSuperuser: PropTypes.bool,
    currentUserId: PropTypes.number,
    terrain: PropTypes.array,
    boundaries: PropTypes.array,
    inflows: PropTypes.array,
    rainfalls: PropTypes.array,
    frictions: PropTypes.array,
    structures: PropTypes.array,
    meshRegions: PropTypes.array,
    networks: PropTypes.array,
    computeInstances: PropTypes.array,
    onUpdateScenario: PropTypes.func,
    onBuildClick: PropTypes.func,
    onRunClick: PropTypes.func,
    onRetryClick: PropTypes.func,
    onArchiveClick: PropTypes.func,
    onUnarchiveClick: PropTypes.func,
    onConfirmDelete: PropTypes.func,
    onConfirmCancelRun: PropTypes.func
};

ScenarioPane.defaultProps = {
    selectedCategoryId: 'inputs',
    canEdit: false,
    canRunScenario: false,
    isSuperuser: false
};

export {ScenarioPane, VALID_CATEGORIES};
