/**
 * ProcessRow — TASK-1665 dark-glass migration.
 * Migrated: tm-* classes → sv-tm-* classes (styled in simpleView.css).
 * StatusBadge primitive replaces hand-rolled tm-badge-* spans.
 * Behaviour and DOM structure unchanged.
 *
 * TASK-1679: restore the i18n status label. The 1665 migration to the
 * StatusBadge primitive dropped the translated <Message msgId> that the
 * legacy span rendered, so the badge regressed to the StatusBadge fallback
 * (the raw status key, e.g. "running"). We resolve the localised label via
 * getMessageById (the same `messages` context the rest of the panel uses) and
 * pass it as StatusBadge's `label` prop — keeping `label` a plain string so the
 * shared StatusBadge primitive's `string` propType is untouched. When no i18n
 * catalogue is present (e.g. under karma without an IntlProvider) getMessageById
 * returns the msgId unchanged, which is the named proof for this task.
 */

import React from 'react';
const PropTypes = require('prop-types');
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {StatusBadge, ProgressBar} from '../../SimpleView/components/primitives';

// hydrata.taskMonitor.statusRunning / statusPending / statusComplete /
// statusError / statusCancelled — the exact key scheme the legacy span used
// (geonode serves these translations at runtime), preserved so existing
// catalogue entries keep resolving.
const statusMsgId = (status) =>
    `hydrata.taskMonitor.status${status.charAt(0).toUpperCase()}${status.slice(1)}`;

const typeIcons = {
    anuga_run: 'glyphicon-flash',
    terrain_create: 'glyphicon-signal',
    // TASK-1651 (W1.5): synthetic terrain-export process type.
    terrain_export: 'glyphicon-download-alt',
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

    // i18n catalogue, supplied by the IntlProvider higher in the tree
    // (same convention as hydrologyListDetailContainer / hgevalSignupForm).
    static contextTypes = {
        messages: PropTypes.object
    };

    render() {
        const { process, expanded } = this.props;
        if (!process) return null;

        const messages = (this.context && this.context.messages) || {};
        const icon = typeIcons[process.process_type] || 'glyphicon-cog';
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        const showProgress = process.status === 'running' && process.progress_pct != null;
        const detailAsBadge = process.status === 'pending' && !!process.status_detail;
        // Restore the translated status label dropped in the 1665 primitive
        // migration (TASK-1679). For the pending-detail sub-state the badge keeps
        // showing the formatted status_detail; otherwise it shows the localised
        // status word instead of StatusBadge's raw-key fallback.
        const badgeLabel = detailAsBadge
            ? formatStatusDetail(process.status_detail)
            : getMessageById(messages, statusMsgId(process.status));

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
                            label={badgeLabel}
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
