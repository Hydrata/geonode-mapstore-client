import React from 'react';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

const typeIcons = {
    anuga_run: 'glyphicon-flash',
    terrain_create: 'glyphicon-signal',
    layer_create: 'glyphicon-globe',
    swamm_import: 'glyphicon-import',
    geonode_upload: 'glyphicon-upload',
    comparison: 'glyphicon-transfer'
};

const statusBadgeClass = (status) => {
    switch (status) {
    case 'running': return 'tm-badge tm-badge-running';
    case 'pending': return 'tm-badge tm-badge-pending';
    case 'complete': return 'tm-badge tm-badge-complete';
    case 'error': return 'tm-badge tm-badge-error';
    case 'cancelled': return 'tm-badge tm-badge-cancelled';
    default: return 'tm-badge';
    }
};

const statusMsgId = (status) => `hydrata.taskMonitor.status${status.charAt(0).toUpperCase() + status.slice(1)}`;

// 'processing' renders as "Processing Results" so users see the post-evolve
// phase explicitly. Unknown details fall through to a capitalized token.
const STATUS_DETAIL_LABEL = {
    processing: 'Processing Results'
};
const formatStatusDetail = (detail) =>
    STATUS_DETAIL_LABEL[detail] || (detail.charAt(0).toUpperCase() + detail.slice(1));

class ProcessRow extends React.Component {
    static propTypes = {
        process: PropTypes.object,
        expanded: PropTypes.bool,
        onClick: PropTypes.func
    };

    render() {
        const { process, expanded } = this.props;
        if (!process) return null;

        const icon = typeIcons[process.process_type] || 'glyphicon-cog';
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        const showProgress = process.status === 'running' && process.progress_pct != null;
        const detailAsBadge = process.status === 'pending' && !!process.status_detail;

        return (
            <div
                className={`tm-process-row ${expanded ? 'tm-expanded' : ''}`}
                onClick={() => this.props.onClick(process.id)}
            >
                <span className={`glyphicon ${icon} tm-type-icon`} />
                <div className="tm-row-content">
                    <div className="tm-row-header">
                        <span className="tm-process-name">{process.name}</span>
                        <span className={statusBadgeClass(process.status)}>
                            {detailAsBadge
                                ? formatStatusDetail(process.status_detail)
                                : <Message msgId={statusMsgId(process.status)} />}
                        </span>
                    </div>
                    {!detailAsBadge && process.status_detail ? (
                        <span className="tm-status-detail">{formatStatusDetail(process.status_detail)}</span>
                    ) : null}
                    {showProgress ? (
                        <div className="tm-progress-bar-container">
                            <div className="tm-progress-bar" style={{width: `${process.progress_pct}%`}} />
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}

export default ProcessRow;
