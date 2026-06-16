/**
 * TaskMonitorPanel — dark-glass migration (TASK-1665, W2 epic/1659-simpleview-design-system).
 *
 * Structural-parity migration: preserves all DOM structure + behaviour exactly.
 * Replaces the light-theme (.tm-panel) shell with .simple-view-panel (dark-glass)
 * and migrates inner classes from tm-* to sv-tm-* (all styled in simpleView.css).
 * taskMonitor.css no longer carries any panel rules — only button-positioning remains.
 *
 * Visual shifts vs BEFORE (light theme) — enumerated for operator sign-off at W2 gate:
 *   See SIMPLEVIEW-BUILD-A-PANEL-GUIDE.md § "TaskMonitor 1665 visual-shift list".
 */

import React from 'react';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {EmptyState} from '../../SimpleView/components/primitives';
import FilterBar from './FilterBar';
import ProcessRow from './ProcessRow';
import ProcessDetail from './ProcessDetail';

class TaskMonitorPanel extends React.Component {
    static propTypes = {
        processes: PropTypes.array,
        filter: PropTypes.string,
        expandedProcessId: PropTypes.string,
        showLog: PropTypes.bool,
        onClose: PropTypes.func,
        onSetFilter: PropTypes.func,
        onExpandProcess: PropTypes.func,
        onToggleLog: PropTypes.func,
        onCancel: PropTypes.func
    };

    render() {
        const {
            processes, filter, expandedProcessId, showLog,
            onClose, onSetFilter, onExpandProcess, onToggleLog, onCancel
        } = this.props;

        const expandedProcess = expandedProcessId
            ? (processes || []).find(p => p.id === expandedProcessId)
            : null;

        return (
            <div className="simple-view-panel sv-tm-container">
                <div className="sv-tm-header">
                    <h5 className="sv-tm-title">
                        <Message msgId="hydrata.taskMonitor.title" />
                    </h5>
                    <span
                        className="glyphicon glyphicon-remove legend-close"
                        onClick={onClose}
                        title="Close"
                    />
                </div>
                <FilterBar activeFilter={filter} onSetFilter={onSetFilter} />
                <div className="sv-tm-process-list">
                    {(!processes || processes.length === 0) ? (
                        // TASK-1680: compose the shared EmptyState primitive (the
                        // .sv-tm-empty hook is carried via extraClassName so the
                        // existing CSS + DOM-contract test keep working).
                        <EmptyState
                            extraClassName="sv-tm-empty"
                            heading={<Message msgId="hydrata.taskMonitor.noProcesses" />}
                        />
                    ) : (
                        processes.map(p => (
                            <div key={p.id}>
                                <ProcessRow
                                    process={p}
                                    expanded={expandedProcessId === p.id}
                                    onClick={onExpandProcess}
                                />
                                {expandedProcessId === p.id ? (
                                    <ProcessDetail
                                        process={expandedProcess}
                                        showLog={showLog}
                                        onToggleLog={onToggleLog}
                                        onCancel={onCancel}
                                    />
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }
}

export default TaskMonitorPanel;
