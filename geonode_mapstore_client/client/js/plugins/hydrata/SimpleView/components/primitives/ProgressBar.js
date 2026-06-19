import React from "react";
import PropTypes from 'prop-types';

/**
 * ProgressBar — thin horizontal track + fill.
 *
 * Best-of-breed source:
 *   anuga.css  .sv-anuga-scenario-status-card-progress-track + -fill
 *   taskMonitor.css  .tm-progress-bar-container + .tm-progress-bar
 *
 * Themed via --sv-* tokens only.
 *
 * Usage:
 *   <ProgressBar pct={42} />
 *   <ProgressBar pct={100} />
 */

const ProgressBar = ({ pct }) => {
    const clamped = Math.max(0, Math.min(100, pct || 0));
    return (
        <div className="sv-progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
            <div
                className="sv-progress-fill"
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
};

ProgressBar.propTypes = {
    /** Completion percentage 0–100 */
    pct: PropTypes.number
};

export { ProgressBar };
