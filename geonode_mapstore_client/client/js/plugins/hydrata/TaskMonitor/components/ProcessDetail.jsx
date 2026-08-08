/**
 * ProcessDetail — TASK-1665 dark-glass migration.
 * Migrated: tm-* classes → sv-tm-* classes (styled in simpleView.css).
 * Behaviour and DOM structure unchanged.
 */

import React from 'react';
import {Button} from 'react-bootstrap';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import ProcessLogViewer from './ProcessLogViewer';

/**
 * TASK-2691 (epic 2662 W5) — the operator-useful subset of the recorded
 * hardware placement, read from `metadata.telemetry.hardware` (written by the
 * `started` fold, apps/taskmonitor/telemetry.py; collected by
 * gn_anuga.batch_common.hardware_identity.collect_hardware_identity).
 *
 * ABSENCE is the common case, not nulls. Three independent gates can leave the
 * key entirely missing: TelemetryClient.started() omits `hardware` when None,
 * the fold requires isinstance(hardware, dict), and only the few process types
 * that run in a telemetry-emitting container send a `started` event at all —
 * Celery-native types have no `metadata.telemetry` key whatsoever. So this
 * returns an EMPTY list for those, and the caller renders nothing (no header,
 * no dashes, no empty section).
 *
 * When present, sub-fields can still be null off-AWS (spec §5 portability
 * contract): on a plain workstation `cpu` populates from /proc/cpuinfo while
 * instance_type / instance_id / gpu / availability_zone are all null. Only
 * populated sub-fields are returned.
 */
const hardwareItems = (hardware) => {
    if (!hardware || typeof hardware !== 'object') return [];
    return [
        {
            key: 'instanceType',
            msgId: 'hydrata.taskMonitor.hardwareInstanceType',
            value: hardware.instance_type
        },
        {
            key: 'gpu',
            msgId: 'hydrata.taskMonitor.hardwareGpu',
            value: hardware.gpu?.name
        },
        {
            // NOTE: `model_name` (the human string, e.g. "AMD EPYC 9R14"), not
            // `model` — which hardware_identity.py fills from /proc/cpuinfo's
            // numeric "model" field and would render as e.g. "17".
            key: 'cpu',
            msgId: 'hydrata.taskMonitor.hardwareCpu',
            value: hardware.cpu?.model_name
        },
        {
            key: 'availabilityZone',
            msgId: 'hydrata.taskMonitor.hardwareAvailabilityZone',
            value: hardware.availability_zone
        }
    ].filter(item => typeof item.value === 'string' && item.value.trim() !== '');
};

const statusIcon = (status) => {
    switch (status) {
    case 'complete': return 'glyphicon glyphicon-ok text-success';
    case 'running': return 'glyphicon glyphicon-refresh sv-tm-spin';
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
        // Triple-optional-chained: metadata, telemetry and hardware are each
        // routinely absent (see hardwareItems above).
        const hardware = hardwareItems(process.metadata?.telemetry?.hardware);

        return (
            <div className="sv-tm-process-detail">
                {subtasks.length > 0 ? (
                    <div className="sv-tm-subtask-list">
                        {subtasks.map((st, i) => (
                            <div key={i} className="sv-tm-subtask-row">
                                <span className={statusIcon(st.status)} />
                                <span className="sv-tm-subtask-name">{st.name}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {process.error_message ? (
                    <div className="sv-tm-error-message">{process.error_message}</div>
                ) : null}

                {/* TASK-2691 (epic 2662 W5): "this job ran on g6e.2xlarge / L40S
                    in us-west-2b". Rendered ONLY when at least one sub-field is
                    populated — the whole section, header included, is omitted
                    otherwise so the many process types that never emit a
                    `started` event don't grow an empty hardware block. */}
                {hardware.length > 0 ? (
                    <div className="sv-tm-hardware">
                        <div className="sv-tm-hardware-title">
                            <Message msgId="hydrata.taskMonitor.hardware" />
                        </div>
                        {hardware.map((item) => (
                            <div className="sv-tm-hardware-row" key={item.key}>
                                <span className="sv-tm-hardware-label">
                                    <Message msgId={item.msgId} />
                                </span>
                                <span className="sv-tm-hardware-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
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
                        <div className="sv-tm-detail-actions">
                            <a
                                href={process.metadata.download_url}
                                download={process.metadata.filename || 'terrain.tif'}
                                className="btn btn-xs sv-tm-download-cta"
                                style={{textDecoration: 'none'}}
                            >
                                <span className="glyphicon glyphicon-download-alt" style={{marginRight: 4}} />
                                Ready — Download
                            </a>
                        </div>
                    ) : null}
                <div className="sv-tm-detail-actions">

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
