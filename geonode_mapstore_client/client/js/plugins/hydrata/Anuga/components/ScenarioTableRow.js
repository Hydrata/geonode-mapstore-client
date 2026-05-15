import React from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, toHHMM, getSecondsFromHHMM} from './scenarioHelpers';
// V2P-02 — canEditLayer/canDeleteLayer/canDownloadLayer imported for future
// per-nested-resource gating (boundaries / inflows / frictions attached to a
// scenario). Today renderSelectCell uses the scenario-level `canEdit` for all
// nested cells; once V2P-21 lazy-fetches per-resource perms into
// state.anuga.resources, those helpers will let the row gate cell-by-cell
// without changing canEditScenarioByRole's stable contract.
import {canEditScenarioByRole, canEditLayer, canDeleteLayer, canDownloadLayer} from '../selectorsAnuga'; // eslint-disable-line no-unused-vars

/**
 * Renders a single scenario <tr> with manage/advanced/compare column groups.
 * Supports 9 state machine states from v2 API.
 */
class ScenarioTableRow extends React.Component {
    static propTypes = {
        scenario: PropTypes.object.isRequired,
        scenarioTableTabs: PropTypes.array.isRequired,
        // Data lists for select dropdowns
        terrain: PropTypes.array,
        boundaries: PropTypes.array,
        inflows: PropTypes.array,
        frictions: PropTypes.array,
        structures: PropTypes.array,
        meshRegions: PropTypes.array,
        networks: PropTypes.array,
        // Callbacks
        updateAnugaScenario: PropTypes.func.isRequired,
        saveAnugaScenario: PropTypes.func.isRequired,
        setOpenMenuGroupId: PropTypes.func.isRequired,
        selectAnugaScenario: PropTypes.func.isRequired,
        showAnugaRunMenu: PropTypes.func.isRequired,
        setAnugaScenarioMenu: PropTypes.func.isRequired,
        deleteAnugaScenario: PropTypes.func.isRequired,
        // Gate mirrors canCreateScenario (owner/manager/editor/contributor),
        // wired through anugaScenarioMenu via canDuplicateScenario.
        duplicateAnugaScenario: PropTypes.func,
        canDuplicateScenario: PropTypes.bool,
        // Archive/unarchive share the duplicate gate. When the scenario is
        // already archived the button toggles label/glyph to "Unarchive".
        archiveAnugaScenario: PropTypes.func,
        unarchiveAnugaScenario: PropTypes.func,
        cancelAnugaRun: PropTypes.func.isRequired,
        retryAnugaRun: PropTypes.func,
        toggleScenarioSelected: PropTypes.func.isRequired,
        validateScenario: PropTypes.func,
        canRunScenario: PropTypes.bool,
        myRole: PropTypes.string,
        currentUserId: PropTypes.number
    };

    constructor(props) {
        super(props);
        this.state = {
            // Mirrors the TASK-723 simpleViewMenuRow inline-confirm pattern so
            // automated flows (Chrome MCP, Karma) aren't blocked by the
            // browser-native window.confirm modal. null | 'duplicate' |
            // 'archive' | 'unarchive'. Dialog is always rendered in the DOM
            // and visibility is toggled via a CSS class; both render +
            // dispatch keys off this single field.
            confirmingAction: null
        };
    }

    handleTextChange = (e) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleIntChange = (e) => {
        const kv = {};
        kv[e.target.id] = parseInt(e.target.value, 10);
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleNumberChange = (e) => {
        const kv = {};
        kv[e.target.id] = parseFloat(e.target.value);
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    handleTimeChange = (event) => {
        this.props.updateAnugaScenario(this.props.scenario, { tempTimeString: event.target.value });
    }

    handleTimeBlur = (event) => {
        const seconds = Math.max(0, getSecondsFromHHMM(event.target.value));
        const kv = {};
        kv[event.target.id] = seconds;
        delete kv.tempTimeString;
        this.props.updateAnugaScenario(this.props.scenario, kv);
    }

    buildScenario = () => {
        const {scenario} = this.props;
        this.props.saveAnugaScenario(scenario);
        this.props.setOpenMenuGroupId(null);
        trackEvent('button', 'click', 'anuga-scenario-menu-build');
    }

    // Inline-confirm openers — replace the window.confirm() that previously
    // gated each of these three actions. window.confirm blocks automated
    // flows (Chrome DevTools MCP, Karma JSDOM) and mismatches the rest of
    // the Hydrata UX (save map + SimpleView delete already use the inline
    // dialog from TASK-723). Tracking event fires on open here so cancels
    // are visible in analytics; the original `-confirm` event fires from
    // performConfirm when the user actually proceeds.
    openConfirmDuplicate = () => {
        trackEvent('button', 'click', 'anuga-scenario-menu-duplicate-scenario');
        this.setState({confirmingAction: 'duplicate'});
    };

    openConfirmArchive = () => {
        trackEvent('button', 'click', 'anuga-scenario-menu-archive-scenario');
        this.setState({confirmingAction: 'archive'});
    };

    openConfirmUnarchive = () => {
        trackEvent('button', 'click', 'anuga-scenario-menu-unarchive-scenario');
        this.setState({confirmingAction: 'unarchive'});
    };

    cancelConfirm = () => {
        const {confirmingAction} = this.state;
        trackEvent('button', 'click', `anuga-scenario-menu-${confirmingAction || 'confirm'}-cancel`);
        this.setState({confirmingAction: null});
    };

    performConfirm = () => {
        const {confirmingAction} = this.state;
        const {scenario} = this.props;
        this.setState({confirmingAction: null});
        if (confirmingAction === 'duplicate') {
            this.props.duplicateAnugaScenario(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-duplicate-scenario-confirm');
        } else if (confirmingAction === 'archive') {
            this.props.archiveAnugaScenario(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-archive-scenario-confirm');
        } else if (confirmingAction === 'unarchive') {
            this.props.unarchiveAnugaScenario(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-unarchive-scenario-confirm');
        }
    };

    renderSelectCell(id, value, options, disabled) {
        const {scenario} = this.props;
        return (
            <td>
                <select
                    id={id}
                    key={`${id}-${scenario.id}`}
                    value={value}
                    className={'scenario-select'}
                    disabled={disabled}
                    onChange={this.handleIntChange}
                >
                    <option value={""}>-</option>
                    {options?.map((item) => (
                        <option key={item?.id} value={item?.id}>{item?.title}</option>
                    ))}
                </select>
            </td>
        );
    }

    renderOwnershipBadge() {
        const {scenario, currentUserId} = this.props;
        if (!scenario?.id) return null;
        const ownerId = scenario.created_by;
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (ownerId == null) return null;
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        if (currentUserId != null && ownerId === currentUserId) {
            return (
                <span className="scenario-ownership-badge scenario-ownership-mine">
                    <Message msgId="hydrata.anuga.yourScenario" />
                </span>
            );
        }
        const username = scenario.created_by_username;
        if (!username) return null;
        return (
            <span className="scenario-ownership-badge scenario-ownership-other">
                <Message msgId="hydrata.anuga.createdByPrefix" /> {username}
            </span>
        );
    }

    renderStatusCell() {
        const {scenario} = this.props;
        const status = findScenarioStatus(scenario);
        const latestRun = scenario?.latest_run;

        switch (status) {
        case 'building':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusBuilding" />
                </td>
            );
        case 'queued':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusQueued" />
                </td>
            );
        case 'computing': {
            const pct = latestRun?.progress_pct || 0;
            const eta = latestRun?.eta_seconds;
            return (
                <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                        <div style={{flex: 1, height: 8, background: '#444', borderRadius: 4, overflow: 'hidden'}}>
                            <div style={{width: `${pct}%`, height: '100%', background: '#5cb85c', transition: 'width 0.5s'}} />
                        </div>
                        <span style={{fontSize: 10, minWidth: 32}}>{Math.round(pct)}%</span>
                        {eta ? <span style={{fontSize: 10, color: '#888'}}>{Math.ceil(eta / 60)}m</span> : null}
                    </div>
                </td>
            );
        }
        case 'processing':
            return (
                <td>
                    <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
                    <Message msgId="hydrata.anuga.statusProcessing" />
                </td>
            );
        case 'complete':
            return (
                <td className="status-complete">
                    <span className="glyphicon glyphicon-ok status-icon" />
                    <Message msgId="hydrata.anuga.statusComplete" />
                </td>
            );
        case 'error':
            return (
                <td className="status-error">
                    <Message msgId="hydrata.anuga.statusError" />
                    {latestRun?.error_message ?
                        <span title={latestRun.error_message} style={{fontSize: 10, marginLeft: 4}}>
                            {latestRun.error_message.substring(0, 30)}{latestRun.error_message.length > 30 ? '...' : ''}
                        </span> : null
                    }
                </td>
            );
        case 'cancelled':
            return (
                <td className="status-cancelled">
                    <Message msgId="hydrata.anuga.statusCancelled" />
                </td>
            );
        case 'built':
            return (<td><Message msgId="hydrata.anuga.statusBuilt" /></td>);
        case 'created':
        default:
            return (<td>{status}</td>);
        }
    }

    renderRunButton() {
        const {scenario, canRunScenario} = this.props;
        const status = findScenarioStatus(scenario);
        switch (status) {
        case 'built':
            if (!canRunScenario) return null;
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        this.props.setAnugaScenarioMenu(false);
                        this.props.selectAnugaScenario(scenario);
                        this.props.showAnugaRunMenu(true);
                        trackEvent('button', 'click', 'anuga-scenario-menu-run');
                    }}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        case 'complete':
            return (
                <Button
                    download href={scenario?.latest_run?.s3_package_url}
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-download')}
                >
                    <span className="glyphicon glyphicon-download" aria-hidden="true" />
                </Button>
            );
        case 'error':
            if (!canRunScenario) return null;
            return (
                <Button
                    bsStyle={'warning'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        if (scenario?.latest_run?.id && this.props.retryAnugaRun) {
                            this.props.retryAnugaRun(scenario.latest_run.id);
                        }
                        trackEvent('button', 'click', 'anuga-scenario-menu-retry');
                    }}
                >
                    <Message msgId="hydrata.anuga.retry" />
                </Button>
            );
        case 'cancelled':
            if (!canRunScenario) return null;
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        this.props.setAnugaScenarioMenu(false);
                        this.props.selectAnugaScenario(scenario);
                        this.props.showAnugaRunMenu(true);
                        trackEvent('button', 'click', 'anuga-scenario-menu-rerun');
                    }}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        case 'queued':
        case 'computing':
        case 'processing':
        case 'building':
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn disabled"
                >
                    <span className="glyphicon glyphicon-refresh glyphicon-spin" aria-hidden="true" />
                </Button>
            );
        case 'created':
            // Per state_machine.py the only transition from `created` is to
            // BUILDING, so the run-column action here is Build, not Run.
            if (!canRunScenario) return null;
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn"
                    onClick={() => {
                        const missingField = this.props.validateScenario
                            ? this.props.validateScenario(scenario)
                            : null;
                        if (!missingField) {
                            this.buildScenario();
                        } else {
                            // eslint-disable-next-line no-alert
                            window.alert("Scenario is not valid: " + missingField + " is required");
                        }
                    }}
                >
                    <Message msgId="hydrata.anuga.build" />
                </Button>
            );
        default:
            return (
                <Button
                    bsStyle={'success'} bsSize={'xsmall'}
                    className="anuga-btn disabled"
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-run')}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        }
    }

    renderBuildCell() {
        const {scenario} = this.props;
        const isUnsaved = scenario.unsaved;
        return (
            <Button
                bsStyle={'success'} bsSize={'xsmall'}
                className={"anuga-btn" + (isUnsaved ? '' : ' disabled')}
                onClick={() => {
                    // validateScenario returns null when valid, or the missing
                    // field name. Preserve the prop-undefined short-circuit
                    // (treat as null = valid) so callers that don't pass the
                    // prop still allow build.
                    const missingField = this.props.validateScenario
                        ? this.props.validateScenario(scenario)
                        : null;
                    if (!missingField) {
                        this.buildScenario();
                    } else {
                        // eslint-disable-next-line no-alert
                        window.alert("Scenario is not valid: " + missingField + " is required");
                    }
                }}
            >
                <Message msgId="hydrata.anuga.build" />
            </Button>
        );
    }

    render() {
        const {scenario, scenarioTableTabs, myRole, currentUserId, canRunScenario, canDuplicateScenario} = this.props;
        const showManage = scenarioTableTabs?.includes('manage');
        const showAdvanced = scenarioTableTabs?.includes('advanced');
        const showCompare = scenarioTableTabs?.includes('compare');
        const status = findScenarioStatus(scenario);
        const isCancellable = ['queued', 'computing', 'building'].includes(status);
        const canEdit = canEditScenarioByRole(myRole, currentUserId, scenario?.created_by);
        const canCancelRun = isCancellable && canRunScenario;
        const canDeleteScenario = !isCancellable && canEdit;
        const showDeleteButton = canCancelRun || canDeleteScenario;
        // Source scenario must already exist server-side (has an id) —
        // unsaved drafts can't be duplicated because the BE has no row.
        const showDuplicateButton = canDuplicateScenario && !!scenario?.id && !isCancellable;
        // Already-archived rows (scenario.archived_at truthy) render as
        // Unarchive instead. Archive shares the same gate.
        const showArchiveButton = canEdit && !!scenario?.id && !isCancellable;
        const isArchived = !!scenario?.archived_at;
        // Confirm-prompt label, shared by Duplicate/Archive/Unarchive/Cancel/Delete.
        const scenarioLabel = scenario?.name || 'this scenario';
        // Inline-confirm dialog state (Duplicate/Archive/Unarchive only).
        // Message + button label resolve from `confirmingAction`; dialog
        // markup is always rendered (visibility toggled via CSS class) so
        // tests can find buttons without depending on a setState→re-render
        // flush, mirroring the TASK-723 simpleViewMenuRow pattern.
        const {confirmingAction} = this.state;
        let confirmMsg = '';
        let confirmBtnLabel = '';
        let confirmBtnClass = 'save-confirm-btn confirm';
        if (confirmingAction === 'duplicate') {
            confirmMsg = `Duplicate scenario "${scenarioLabel}"?`;
            confirmBtnLabel = 'Duplicate';
        } else if (confirmingAction === 'archive') {
            confirmMsg = `Archive scenario "${scenarioLabel}"?`;
            confirmBtnLabel = 'Archive';
        } else if (confirmingAction === 'unarchive') {
            confirmMsg = `Restore archived scenario "${scenarioLabel}"?`;
            confirmBtnLabel = 'Restore';
        }

        return (
            <tr className={'scenario-table-row'}>
                <td>{scenario.id}</td>
                <td>
                    <input
                        id={'name'} key={`name-${scenario.id}`}
                        type={"text"} className={'scenario-input'}
                        value={scenario.name}
                        readOnly={!canEdit}
                        onChange={this.handleTextChange}
                    />
                    {this.renderOwnershipBadge()}
                </td>
                {showManage ?
                    <React.Fragment>
                        {this.renderSelectCell('terrain', scenario?.terrain, this.props.terrain, !canEdit)}
                        {this.renderSelectCell('boundary', scenario?.boundary, this.props.boundaries, !canEdit)}
                        {this.renderSelectCell('inflow', scenario?.inflow, this.props.inflows, !canEdit)}
                    </React.Fragment> : null
                }
                {showAdvanced ?
                    <React.Fragment>
                        {this.renderSelectCell('friction', scenario?.friction, this.props.frictions, !canEdit)}
                        {this.renderSelectCell('structure', scenario?.structure, this.props.structures, !canEdit)}
                        {this.renderSelectCell('mesh_region', scenario?.mesh_region, this.props.meshRegions, !canEdit)}
                        {this.renderSelectCell('network', scenario?.network, this.props.networks, !canEdit)}
                        {!showManage ?
                            <td>
                                {canEdit ? this.renderBuildCell() : null}
                            </td> : null
                        }
                    </React.Fragment> : null
                }
                {showManage ?
                    <React.Fragment>
                        <td>
                            <input
                                id={'resolution'} key={`resolution-${scenario.id}`}
                                type={"number"} className={'scenario-input scenario-input-narrow'}
                                value={scenario?.resolution}
                                readOnly={!canEdit}
                                onChange={this.handleNumberChange}
                            />
                        </td>
                        <td>
                            <input
                                id={'duration'} key={`duration-${scenario.id}`}
                                type={"text"} className={'scenario-input scenario-input-narrow'}
                                value={scenario.tempTimeString || toHHMM(scenario.duration)}
                                readOnly={!canEdit}
                                onChange={this.handleTimeChange}
                                onBlur={this.handleTimeBlur}
                            />
                        </td>
                        {this.renderStatusCell()}
                        <td>
                            {canEdit ? this.renderBuildCell() : null}
                        </td>
                        <td>{this.renderRunButton()}</td>
                        <td>
                            <Button
                                bsStyle={'info'} bsSize={'xsmall'}
                                className="anuga-btn"
                                onClick={() => {
                                    this.props.selectAnugaScenario(scenario);
                                    this.props.openTaskMonitorForRun();
                                    trackEvent('button', 'click', 'anuga-scenario-menu-view-log');
                                }}
                            >
                                <Message msgId="hydrata.anuga.log" />
                            </Button>
                        </td>
                        <td>
                            {showDuplicateButton ?
                                <Button
                                    bsStyle={'info'} bsSize={'xsmall'}
                                    className="anuga-btn anuga-btn-duplicate"
                                    onClick={this.openConfirmDuplicate}
                                >
                                    <span className="glyphicon glyphicon-duplicate" aria-hidden="true" />
                                </Button> : null
                            }
                        </td>
                        {/* Archive/Unarchive toggle: label/glyph flips based on scenario.archived_at. */}
                        <td>
                            {showArchiveButton ?
                                <Button
                                    bsStyle={isArchived ? 'success' : 'warning'}
                                    bsSize={'xsmall'}
                                    className={isArchived ? "anuga-btn anuga-btn-unarchive" : "anuga-btn anuga-btn-archive"}
                                    onClick={isArchived ? this.openConfirmUnarchive : this.openConfirmArchive}
                                >
                                    <span
                                        className={isArchived ? "glyphicon glyphicon-open" : "glyphicon glyphicon-folder-close"}
                                        aria-hidden="true"
                                    />
                                </Button> : null
                            }
                        </td>
                        <td>
                            {/* Always-rendered inline confirm dialog for
                                Duplicate/Archive/Unarchive. Visibility flips
                                via the `.is-open` class so Karma+JSDOM can
                                find the buttons without waiting for a
                                setState→re-render flush (TASK-723 pattern).
                                Reuses the `menu-row-delete-confirm` +
                                `save-confirm-btn` classes from simpleView.css
                                which is in the bundle whenever an ANUGA
                                project page is loaded (SimpleView is the
                                parent panel). */}
                            <span
                                className={
                                    "menu-row-delete-confirm anuga-scenario-row-confirm"
                                    + (confirmingAction ? " is-open" : "")
                                }
                                role="alertdialog"
                                aria-label="Confirm scenario action"
                                aria-hidden={confirmingAction ? undefined : true}
                            >
                                <span className="menu-row-delete-confirm-text">{confirmMsg}</span>
                                <button
                                    type="button"
                                    className={confirmBtnClass}
                                    onClick={this.performConfirm}
                                >
                                    {confirmBtnLabel}
                                </button>
                                <button
                                    type="button"
                                    className="save-confirm-btn cancel"
                                    onClick={this.cancelConfirm}
                                >
                                    Cancel
                                </button>
                            </span>
                            {showDeleteButton ?
                                <Button
                                    bsStyle={'danger'} bsSize={'xsmall'}
                                    className="anuga-btn-delete"
                                    onClick={
                                        isCancellable ?
                                            () => {
                                                trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run');
                                                // eslint-disable-next-line no-alert
                                                if (window.confirm(`Cancel run for "${scenarioLabel}"?`)) {
                                                    trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run-confirm');
                                                    this.props.cancelAnugaRun(scenario?.latest_run?.id);
                                                }
                                            } :
                                            () => {
                                                trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario');
                                                // eslint-disable-next-line no-alert
                                                if (window.confirm(`Delete scenario "${scenarioLabel}"?`)) {
                                                    this.props.deleteAnugaScenario(scenario);
                                                    trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario-confirm');
                                                }
                                            }
                                    }
                                >
                                    <span className={isCancellable ? "glyphicon glyphicon-ban-circle" : "glyphicon glyphicon-trash"} aria-hidden="true" />
                                </Button> : null
                            }
                        </td>
                    </React.Fragment> : null
                }
                {showCompare ?
                    <React.Fragment>
                        <td>
                            <span
                                className={"btn glyphicon menu-row-glyph scenario-compare-glyph " + (scenario?.selected ? "glyphicon-ok glyph-active" : "glyphicon-remove glyph-inactive")}
                                onClick={() => {
                                    this.props.toggleScenarioSelected(scenario);
                                    trackEvent('button', 'click', `anuga-scenario-menu-select-scenario-${scenario?.name}`);
                                }}
                            />
                        </td>
                    </React.Fragment> : null
                }
            </tr>
        );
    }
}

export default ScenarioTableRow;
