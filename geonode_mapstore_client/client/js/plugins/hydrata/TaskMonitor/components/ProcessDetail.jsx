import React from 'react';
import {Button} from 'react-bootstrap';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import ProcessLogViewer from './ProcessLogViewer';

const statusIcon = (status) => {
    switch (status) {
    case 'complete': return 'glyphicon glyphicon-ok text-success';
    case 'running': return 'glyphicon glyphicon-refresh tm-spin';
    case 'error': return 'glyphicon glyphicon-exclamation-sign text-danger';
    case 'pending': return 'glyphicon glyphicon-time text-muted';
    default: return 'glyphicon glyphicon-time text-muted';
    }
};

class ProcessDetail extends React.Component {
    static propTypes = {
        process: PropTypes.object,
        showLog: PropTypes.bool,
        onToggleLog: PropTypes.func,
        onCancel: PropTypes.func
    };

    render() {
        const { process, showLog } = this.props;
        if (!process) return null;

        const subtasks = process.subtasks || [];
        const isCancellable = process.status === 'pending' || process.status === 'running';

        return (
            <div className="tm-process-detail">
                {subtasks.length > 0 ? (
                    <div className="tm-subtask-list">
                        {subtasks.map((st, i) => (
                            <div key={i} className="tm-subtask-row">
                                <span className={statusIcon(st.status)} />
                                <span className="tm-subtask-name">{st.name}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {process.error_message ? (
                    <div className="tm-error-message">{process.error_message}</div>
                ) : null}

                <div className="tm-detail-actions">
                    <Button bsSize="xsmall" bsStyle="default"
                        onClick={() => this.props.onToggleLog(!showLog)}>
                        <Message msgId="hydrata.taskMonitor.log" />
                    </Button>
                    {isCancellable ? (
                        <Button bsSize="xsmall" bsStyle="danger"
                            onClick={() => this.props.onCancel(process.id)}>
                            <Message msgId="hydrata.taskMonitor.cancel" />
                        </Button>
                    ) : null}
                </div>

                {showLog ? <ProcessLogViewer log={process.log} /> : null}
            </div>
        );
    }
}

export default ProcessDetail;
