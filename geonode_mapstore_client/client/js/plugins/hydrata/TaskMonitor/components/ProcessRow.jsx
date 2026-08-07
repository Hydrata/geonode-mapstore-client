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

// TASK-2674 (epic 2662 W2.4): liveness is SERVER truth (serializer-derived
// from last_heartbeat, D5/D7) — the FE clock-staleness heuristic is deleted.
// Each non-live liveness state maps to its own badge + i18n key:
//   stalled           — >3 missed heartbeats (server threshold)
//   zombie-candidate  — >15 min silent; reaper confirms before acting, so the
//                       user-facing label is "Unresponsive", not "zombie"
//   provisioning      — no telemetry event yet; staleness-EXEMPT (a Batch
//                       queue can hold a job for hours before the container
//                       starts). Only badged while there is no progress yet:
//                       processes that never speak telemetry (celery types)
//                       read provisioning forever server-side, and once
//                       progress_pct is being written the working status
//                       badge is the truthful display.
const LIVENESS_BADGES = {
    'stalled': { badge: 'stalled', msgId: 'hydrata.taskMonitor.statusStalled' },
    'zombie-candidate': { badge: 'zombie-candidate', msgId: 'hydrata.taskMonitor.statusUnresponsive' },
    'provisioning': { badge: 'provisioning', msgId: 'hydrata.taskMonitor.statusProvisioning' }
};

// Liveness states in which the row is NOT making progress — suppress the
// progress bar (a frozen mid-bar on a stuck process is misleading).
const isSilent = (liveness) => liveness === 'stalled' || liveness === 'zombie-candidate';

/**
 * Compact "2h 15m" / "3m 20s" / "45s" rendering of the server's eta_seconds.
 * Returns null for anything non-numeric or negative (render nothing).
 * Exported for tests.
 */
export const formatEtaSeconds = (etaSeconds) => {
    if (typeof etaSeconds !== 'number' || !isFinite(etaSeconds) || etaSeconds < 0) return null;
    const s = Math.round(etaSeconds);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

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

// Map TaskMonitor process status → StatusBadge status token.
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

// TASK-2674: which liveness badge (if any) overrides the plain status badge.
// stalled/zombie-candidate ALWAYS override; provisioning only until the row
// shows progress (see LIVENESS_BADGES comment). Terminal rows arrive with
// liveness=null and synthetic FE rows (terrain-export) carry no liveness at
// all — both fall through to the plain status badge.
const livenessBadge = (process) => {
    const entry = LIVENESS_BADGES[process.liveness];
    if (!entry) return null;
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
    if (process.liveness === 'provisioning' && process.progress_pct != null) return null;
    return entry;
};

// 'processing' renders as "Processing Results" so users see the post-evolve
// phase explicitly. Unknown details fall through to a capitalized token.
const STATUS_DETAIL_LABEL = {
    processing: 'Processing Results'
};
const formatStatusDetail = (detail) =>
    STATUS_DETAIL_LABEL[detail] || (detail.charAt(0).toUpperCase() + detail.slice(1));

// TASK-1887: max chars for the inline error snippet in the collapsed row.
const ERROR_SNIPPET_MAX = 80;

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

        // TASK-2674: liveness rendered VERBATIM from the server (no FE clock
        // math). Badge precedence:
        //   1. server stalled / zombie-candidate  → their badges, always
        //   2. pending + status_detail            → detailAsBadge (existing
        //      pending sub-state contract, e.g. "Built")
        //   3. provisioning (no progress yet)     → Provisioning badge
        //   4. plain status badge
        const lBadge = livenessBadge(process);
        const silent = isSilent(process.liveness);

        // showProgress: only for running rows with a known progress_pct that
        // the server does not declare silent. Complete/error/cancelled rows
        // never render a progress bar.
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        const showProgress = process.status === 'running' && !silent && process.progress_pct != null;

        // ETA is server-computed (eta_seconds, D7) and only meaningful next
        // to a live progress bar.
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        const etaText = showProgress && process.eta_seconds != null
            ? formatEtaSeconds(process.eta_seconds)
            : null;

        // Container-reported phase (mesh-gen, evolve, …) — its own line, only
        // while the process is non-terminal (a frozen last phase is noise).
        const showPhase = !!process.phase
            && (process.status === 'pending' || process.status === 'running');

        const detailAsBadge = process.status === 'pending' && !!process.status_detail;
        // Restore the translated status label dropped in the 1665 primitive
        // migration (TASK-1679). Badge precedence per the TASK-2674 comment
        // above; every label flows through getMessageById (i18n). When
        // `silent` is true `lBadge` is always set (both silent states have
        // LIVENESS_BADGES entries).
        let badgeStatus;
        let badgeLabel;
        if (silent || (lBadge && !detailAsBadge)) {
            badgeStatus = lBadge.badge;
            badgeLabel = getMessageById(messages, lBadge.msgId);
        } else if (detailAsBadge) {
            badgeStatus = toBadgeStatus(process.status);
            badgeLabel = formatStatusDetail(process.status_detail);
        } else {
            badgeStatus = toBadgeStatus(process.status);
            badgeLabel = getMessageById(messages, statusMsgId(process.status));
        }

        // wedged: ADVISORY-ONLY (D5) — heartbeating but ~0 CPU. A small hint
        // beside the badge; never changes the badge, the progress bar, or the
        // active filter (a GPU-bound engine legitimately idles the CPU).
        const wedged = process.wedged === true;

        // TASK-1887: show a truncated error_message snippet in the COLLAPSED row
        // when status=error so the user sees the failure reason without expanding.
        // Full text is still available in ProcessDetail. Only rendered when NOT
        // expanded (expanding shows the full ProcessDetail with the error already).
        const errorSnippet = !expanded && process.status === 'error' && process.error_message
            ? (process.error_message.length > ERROR_SNIPPET_MAX
                ? process.error_message.slice(0, ERROR_SNIPPET_MAX) + '…'
                : process.error_message)
            : null;

        return (
            <div
                className={`sv-tm-process-row${expanded ? ' sv-tm-expanded' : ''}`}
                onClick={() => this.props.onClick(process.id)}
            >
                <span className={`glyphicon ${icon} sv-tm-type-icon`} />
                <div className="sv-tm-row-content">
                    <div className="sv-tm-row-header">
                        <span className="sv-tm-process-name">{process.name}</span>
                        {wedged ? (
                            <span
                                className="sv-tm-wedged-advisory"
                                title={getMessageById(messages, 'hydrata.taskMonitor.wedgedAdvisoryTitle')}
                            >
                                {getMessageById(messages, 'hydrata.taskMonitor.wedgedAdvisory')}
                            </span>
                        ) : null}
                        <StatusBadge
                            status={badgeStatus}
                            label={badgeLabel}
                            compact
                        />
                    </div>
                    {!detailAsBadge && process.status_detail ? (
                        <span className="sv-tm-status-detail">{formatStatusDetail(process.status_detail)}</span>
                    ) : null}
                    {showPhase ? (
                        <span className="sv-tm-phase">{formatStatusDetail(process.phase)}</span>
                    ) : null}
                    {showProgress ? (
                        <ProgressBar pct={process.progress_pct} />
                    ) : null}
                    {etaText ? (
                        <span className="sv-tm-eta">{`${getMessageById(messages, 'hydrata.taskMonitor.eta')} ${etaText}`}</span>
                    ) : null}
                    {errorSnippet ? (
                        <span className="sv-tm-error-message">{errorSnippet}</span>
                    ) : null}
                </div>
            </div>
        );
    }
}

export default ProcessRow;
