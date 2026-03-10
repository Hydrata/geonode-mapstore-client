import React from 'react';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
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
            <div className="tm-panel">
                <div className="tm-panel-header">
                    <h5 className="tm-panel-title">
                        <Message msgId="hydrata.taskMonitor.title" />
                    </h5>
                    <span
                        className="btn glyphicon glyphicon-remove tm-close-btn"
                        onClick={onClose}
                    />
                </div>
                <FilterBar activeFilter={filter} onSetFilter={onSetFilter} />
                <div className="tm-process-list">
                    {(!processes || processes.length === 0) ? (
                        <div className="tm-empty">
                            <Message msgId="hydrata.taskMonitor.noProcesses" />
                        </div>
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
