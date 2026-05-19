import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {toHHMM, getSecondsFromHHMM} from './scenarioHelpers';
import {ScenarioStatusPill} from './scenarioStatusPill';
import {ScenarioActionToolbar} from './scenarioActionToolbar';
import {ScenarioCategoryRail} from './scenarioCategoryRail';
import {ScenarioResourceSummary, summariseResource} from './scenarioResourceSummary';
import {ScenarioStatusCard} from './scenarioStatusCard';
import {ScenarioErrorStrip} from './scenarioErrorStrip';

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

const VALID_CATEGORIES = ['inputs', 'advanced', 'runConfig', 'statusActions'];

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
                    {log || ''}
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
        <div className="anuga-scenario-pane-section" key={id}>
            <label className="anuga-scenario-pane-label" htmlFor={id}>
                <Message msgId={label} />
            </label>
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
        </div>
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
            <div className="anuga-scenario-pane-section">
                <label className="anuga-scenario-pane-label" htmlFor="name">
                    <Message msgId="hydrata.anuga.name" />
                </label>
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
            </div>
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

function renderAdvancedPane({scenario, canEdit, onUpdateScenario, frictions, structures, meshRegions, networks}) {
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
            {renderSelectField('network', 'hydrata.anuga.network', scenario?.network, networks, !canEdit, handleField)}
            {renderResourceSummary(scenario, 'network', networks)}
        </div>
    );
}

function renderRunConfigPane({scenario, canEdit, onUpdateScenario, computeInstances}) {
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
            <div className="anuga-scenario-pane-section">
                <label className="anuga-scenario-pane-label" htmlFor="resolution">
                    <Message msgId="hydrata.anuga.resolutionM2" />
                </label>
                <div className={unitFieldClass}>
                    <input
                        id="resolution"
                        type="number"
                        className="scenario-input scenario-input-narrow"
                        value={scenario?.resolution != null ? scenario.resolution : ''} // eslint-disable-line no-eq-null, eqeqeq
                        readOnly={!canEdit}
                        onChange={handleResolutionChange}
                    />
                    <span className="anuga-scenario-pane-field-unit">m²</span>
                </div>
            </div>
            <div className="anuga-scenario-pane-section">
                <label className="anuga-scenario-pane-label" htmlFor="duration">
                    <Message msgId="hydrata.anuga.duration" />
                </label>
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
                    <span className="anuga-scenario-pane-field-unit">h</span>
                </div>
            </div>
            <div className="anuga-scenario-pane-section">
                <label className="anuga-scenario-pane-label" htmlFor="compute_backend">
                    <Message msgId="hydrata.anuga.computeBackend" />
                </label>
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
                            ? computeInstances.map((opt, idx) => (
                                <option key={idx} value={opt.value || opt.id || opt}>
                                    {opt.label || opt.title || opt.name || (opt.value || opt.id || opt)}
                                </option>
                            ))
                            : (
                                <React.Fragment>
                                    <option value="local">Local</option>
                                    <option value="ec2">EC2</option>
                                    <option value="batch">AWS Batch</option>
                                </React.Fragment>
                            )
                        }
                    </select>
                </div>
            </div>
            <div className="anuga-scenario-pane-section anuga-scenario-pane-section--help">
                <span className="anuga-scenario-pane-help">
                    <Message msgId="hydrata.anuga.runConfigHelp" />
                </span>
            </div>
        </div>
    );
}

function renderStatusActionsPane({
    scenario, canEdit, canRunScenario, canDuplicateScenario,
    onBuildClick, onRunClick, onRetryClick, onLogClick,
    onDuplicateClick, onArchiveClick, onUnarchiveClick,
    onConfirmDelete, onConfirmCancelRun
}) {
    return (
        <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-status-actions">
            <ScenarioErrorStrip scenario={scenario} />
            <ScenarioStatusCard scenario={scenario} />
            <div className="anuga-scenario-pane-actions">
                <ScenarioActionToolbar
                    scenario={scenario}
                    canEdit={canEdit}
                    canRunScenario={canRunScenario}
                    canDuplicateScenario={canDuplicateScenario}
                    onBuildClick={onBuildClick}
                    onRunClick={onRunClick}
                    onRetryClick={onRetryClick}
                    onLogClick={onLogClick}
                    onDuplicateClick={onDuplicateClick}
                    onArchiveClick={onArchiveClick}
                    onUnarchiveClick={onUnarchiveClick}
                    onConfirmDelete={onConfirmDelete}
                    onConfirmCancelRun={onConfirmCancelRun}
                />
            </div>
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
        runConfig: 'hydrata.anuga.runConfig',
        statusActions: 'hydrata.anuga.statusActions'
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

const ScenarioPane = (props) => {
    const {scenario, selectedCategoryId, onSelectCategory, canEdit} = props;
    const resolvedCategory = VALID_CATEGORIES.includes(selectedCategoryId)
        ? selectedCategoryId
        : 'inputs';

    return (
        <div className="menu-rows-pane anuga-pane anuga-scenario-pane">
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
                                {resolvedCategory === 'runConfig' && renderRunConfigPane(props)}
                                {resolvedCategory === 'statusActions' && renderStatusActionsPane(props)}
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
    canDuplicateScenario: PropTypes.bool,
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
    onLogClick: PropTypes.func,
    onDuplicateClick: PropTypes.func,
    onArchiveClick: PropTypes.func,
    onUnarchiveClick: PropTypes.func,
    onConfirmDelete: PropTypes.func,
    onConfirmCancelRun: PropTypes.func
};

ScenarioPane.defaultProps = {
    selectedCategoryId: 'inputs',
    canEdit: false,
    canRunScenario: false,
    canDuplicateScenario: false
};

export {ScenarioPane, VALID_CATEGORIES};
