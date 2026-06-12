/**
 * ProcessRow — TASK-1665 dark-glass migration.
 * Migrated: tm-* classes → sv-tm-* classes (styled in simpleView.css).
 * StatusBadge primitive replaces hand-rolled tm-badge-* spans.
 * Behaviour and DOM structure unchanged.
 */

import React from 'react';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {StatusBadge} from '../../SimpleView/components/primitives';
import {ProgressBar} from '../../SimpleView/components/primitives';

const typeIcons = {
    anuga_run: 'glyphicon-flash',
    terrain_create: 'glyphicon-signal',
    layer_create: 'glyphicon-globe',
    swamm_import: 'glyphicon-import',
    geonode_upload: 'glyphicon-upload',
    comparison: 'glyphicon-transfer'
};

// Map TaskMonitor process status → StatusBadge status
const toBadgeStatus = (status) => {
    switch (status) {
    case 'running':   return 'running';
    case 'pending':   return 'pending';
    case 'complete':  return 'complete';
    case 'error':     return 'error';
    case 'cancelled': return 'cancelled';
    default:          return 'pending';
    }
};

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
                className={`sv-tm-process-row${expanded ? ' sv-tm-expanded' : ''}`}
                onClick={() => this.props.onClick(process.id)}
            >
                <span className={`glyphicon ${icon} sv-tm-type-icon`} />
                <div className="sv-tm-row-content">
                    <div className="sv-tm-row-header">
                        <span className="sv-tm-process-name">{process.name}</span>
                        <StatusBadge
                            status={toBadgeStatus(process.status)}
                            label={detailAsBadge
                                ? formatStatusDetail(process.status_detail)
                                : undefined}
                            compact
                        />
                    </div>
                    {!detailAsBadge && process.status_detail ? (
                        <span className="sv-tm-status-detail">{formatStatusDetail(process.status_detail)}</span>
                    ) : null}
                    {showProgress ? (
                        <ProgressBar pct={process.progress_pct} />
                    ) : null}
                </div>
            </div>
        );
    }
}

export default ProcessRow;
