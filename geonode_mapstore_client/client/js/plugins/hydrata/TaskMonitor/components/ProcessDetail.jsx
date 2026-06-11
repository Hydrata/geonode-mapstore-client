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

                {/* TASK-1651 (W1.5): terrain export "Ready – Download" affordance.
                    Shown when process_type=terrain_export, status=complete, and a
                    presigned URL is in metadata. The auto-download attempt in the
                    epic may be blocked by the browser (non-gesture context), so
                    this explicit button is the guaranteed delivery path. */}
                {process.process_type === 'terrain_export'
                    && process.status === 'complete'
                    && process.metadata?.download_url
                    ? (
                        <div className="tm-detail-actions">
                            <a
                                href={process.metadata.download_url}
                                download={process.metadata.filename || 'terrain.tif'}
                                className="btn btn-success btn-xs"
                                style={{textDecoration: 'none', color: '#fff'}}
                            >
                                <span className="glyphicon glyphicon-download-alt" style={{marginRight: 4}} />
                                Ready — Download
                            </a>
                        </div>
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
