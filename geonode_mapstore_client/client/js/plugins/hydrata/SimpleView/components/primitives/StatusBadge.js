import React from "react";
import PropTypes from 'prop-types';

/**
 * StatusBadge — 5-state inline status pill.
 *
 * States: running | pending | complete | error | cancelled
 *
 * Best-of-breed source:
 *   anuga.css  .anuga-scenario-category-item-tag.is-ok/.is-warn/.is-err
 *   anuga.css  .scenario-status-pill + .is-compact + status modifiers
 *
 * Themed via --sv-* tokens only; no hardcoded colour values.
 *
 * Usage:
 *   <StatusBadge status="running" />
 *   <StatusBadge status="complete" label="Done" />
 */

const STATUS_MAP = {
    running:   { cssState: 'is-running',   glyph: 'glyphicon-refresh' },
    pending:   { cssState: 'is-pending',   glyph: 'glyphicon-time' },
    complete:  { cssState: 'is-ok',        glyph: 'glyphicon-ok' },
    error:     { cssState: 'is-err',       glyph: 'glyphicon-exclamation-sign' },
    cancelled: { cssState: 'is-cancelled', glyph: 'glyphicon-ban-circle' }
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
