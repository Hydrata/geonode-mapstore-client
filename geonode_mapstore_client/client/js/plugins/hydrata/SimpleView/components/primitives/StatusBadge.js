import React from "react";
import PropTypes from 'prop-types';

/**
 * StatusBadge — inline status pill.
 *
 * Process states: running | pending | complete | error | cancelled
 * Liveness states (TASK-2689, epic 2662): stalled | zombie-candidate |
 *   provisioning — the server-derived D5 liveness values TaskMonitor renders
 *   verbatim (TASK-2674). Display-only styling: stalled reads as warn,
 *   zombie-candidate as error-adjacent, provisioning as pending-adjacent.
 *
 * Best-of-breed source:
 *   anuga.css  .sv-anuga-scenario-category-item-tag.is-ok/.is-warn/.is-err
 *   anuga.css  .sv-scenario-status-pill + .is-compact + status modifiers
 *
 * Themed via --sv-* tokens only; no hardcoded colour values.
 *
 * Usage:
 *   <StatusBadge status="running" />
 *   <StatusBadge status="complete" label="Done" />
 */

const STATUS_MAP = {
    running: { cssState: 'is-running',   glyph: 'glyphicon-refresh' },
    pending: { cssState: 'is-pending',   glyph: 'glyphicon-time' },
    complete: { cssState: 'is-ok',        glyph: 'glyphicon-ok' },
    error: { cssState: 'is-err',       glyph: 'glyphicon-exclamation-sign' },
    cancelled: { cssState: 'is-cancelled', glyph: 'glyphicon-ban-circle' },
    // TASK-2689 — liveness states (no heartbeat >3min / >15min / no event yet)
    stalled: { cssState: 'is-stalled', glyph: 'glyphicon-hourglass' },
    'zombie-candidate': { cssState: 'is-zombie-candidate', glyph: 'glyphicon-alert' },
    provisioning: { cssState: 'is-provisioning', glyph: 'glyphicon-cloud' }
};

const StatusBadge = ({ status, label, showGlyph, compact }) => {
    const entry = STATUS_MAP[status] || { cssState: 'is-unknown', glyph: 'glyphicon-question-sign' };
    const classes = [
        'sv-status-badge',
        entry.cssState,
        compact ? 'is-compact' : ''
    ].filter(Boolean).join(' ');

    return (
        <span className={classes}>
            {showGlyph && (
                <span
                    className={`glyphicon ${entry.glyph} sv-status-badge-glyph`}
                    aria-hidden="true"
                />
            )}
            {label !== undefined ? label : status}
        </span>
    );
};

StatusBadge.propTypes = {
    /** One of: running | pending | complete | error | cancelled */
    status: PropTypes.string.isRequired,
    /** Override display text; defaults to the status string */
    label: PropTypes.string,
    /** Show the status glyph before the label */
    showGlyph: PropTypes.bool,
    /** Compact (small) variant */
    compact: PropTypes.bool
};

StatusBadge.defaultProps = {
    showGlyph: false,
    compact: false
};

export { StatusBadge };
