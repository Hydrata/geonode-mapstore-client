import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import {
    toggleTaskMonitorPanel,
    setTaskMonitorFilter,
    expandProcess,
    toggleProcessLog,
    cancelProcess
} from '../actionsTaskMonitor';
import {
    getActiveCount,
    getPanelOpen,
    getFilter,
    getExpandedProcessId,
    getShowLog,
    getFilteredProcesses
} from '../selectorsTaskMonitor';
import TaskMonitorButton from './TaskMonitorButton';
import TaskMonitorPanel from './TaskMonitorPanel';
import '../taskMonitor.css';

class TaskMonitorContainer extends React.Component {
    static propTypes = {
        panelOpen: PropTypes.bool,
        activeCount: PropTypes.number,
        filter: PropTypes.string,
        expandedProcessId: PropTypes.string,
        showLog: PropTypes.bool,
        processes: PropTypes.array,
        togglePanel: PropTypes.func,
        setFilter: PropTypes.func,
        onExpandProcess: PropTypes.func,
        onToggleLog: PropTypes.func,
        onCancel: PropTypes.func,
        loggedIn: PropTypes.bool
    };

    render() {
        if (!this.props.loggedIn) return null;

        return (
            <div id="task-monitor-container">
                <TaskMonitorButton
                    panelOpen={this.props.panelOpen}
                    activeCount={this.props.activeCount}
                    onClick={() => this.props.togglePanel(!this.props.panelOpen)}
                />
                {this.props.panelOpen ? (
                    <TaskMonitorPanel
                        processes={this.props.processes}
                        filter={this.props.filter}
                        expandedProcessId={this.props.expandedProcessId}
                        showLog={this.props.showLog}
                        onClose={() => this.props.togglePanel(false)}
                        onSetFilter={this.props.setFilter}
                        onExpandProcess={this.props.onExpandProcess}
                        onToggleLog={this.props.onToggleLog}
                        onCancel={this.props.onCancel}
                    />
                ) : null}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    panelOpen: getPanelOpen(state),
    activeCount: getActiveCount(state),
    filter: getFilter(state),
    expandedProcessId: getExpandedProcessId(state),
    showLog: getShowLog(state),
    processes: getFilteredProcesses(state),
    loggedIn: !!state?.security?.user
});

const mapDispatchToProps = (dispatch) => ({
    togglePanel: (open) => dispatch(toggleTaskMonitorPanel(open)),
    setFilter: (filter) => dispatch(setTaskMonitorFilter(filter)),
    onExpandProcess: (processId) => dispatch(expandProcess(processId)),
    onToggleLog: (show) => dispatch(toggleProcessLog(show)),
    onCancel: (processId) => dispatch(cancelProcess(processId))
});

export default connect(mapStateToProps, mapDispatchToProps)(TaskMonitorContainer);
