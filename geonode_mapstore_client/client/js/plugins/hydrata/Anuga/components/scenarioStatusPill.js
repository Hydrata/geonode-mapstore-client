import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {findScenarioStatus} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller W1 — presentational status pill extracted from
 * ScenarioTableRow.renderStatusCell (lines 241-313). Renders the 9-state
 * scenario status display:
 *
 *   created  | building  | queued     | computing | processing
 *   complete | error     | cancelled  | built
 *
 * Visual contract preserved 1:1 with the legacy table cell (same glyph,
 * same Message keys, same sv-status-complete / sv-status-error / sv-status-cancelled
 * CSS hooks). The pill is presentation-only — `findScenarioStatus` is the
 * only logic dependency.
 *
 * `compact` mode (used by the rail item) hides the ETA-minutes badge and
 * the truncated error_message tooltip so the rail row stays one-line.
 *
 * Wave 3B (B1, B2) — R2 + R3 mitigations:
 *   - B1: compact + computing renders a 2px mini progress bar UNDER a
 *         pulsing dot so the rail row still shows at-a-glance progress
 *         percentage even without the numeric track that the Pane 3
 *         status card displays.
 *   - B2: compact + error sets `title=` on the pill wrapper carrying the
 *         full error_message (truncated to 200 chars). Native browser
 *         tooltip on hover, same UX as the legacy 30-char inline detail.
 */
const ScenarioStatusPill = ({scenario, compact}) => {
    const status = findScenarioStatus(scenario);
    const latestRun = scenario?.latest_run;

    switch (status) {
    case 'building':
        return (
            <span className={"sv-scenario-status-pill status-building" + (compact ? " is-compact" : "")}>
                <span className="glyphicon glyphicon-refresh glyphicon-spin sv-status-icon" />
                <Message msgId="hydrata.anuga.statusBuilding" />
            </span>
        );
    case 'queued':
        return (
            <span className={"sv-scenario-status-pill status-queued" + (compact ? " is-compact" : "")}>
                <span className="glyphicon glyphicon-refresh glyphicon-spin sv-status-icon" />
                <Message msgId="hydrata.anuga.statusQueued" />
            </span>
        );
    case 'computing': {
        const pct = latestRun?.progress_pct || 0;
        const eta = latestRun?.eta_seconds;
        if (compact) {
            // Wave 3B (B1) — R2 mitigation. Compact rail pill loses the full
            // progress track + numeric pct vs the Pane 3 status card. Replace
            // the legacy spinner with a thin 2px progress sliver UNDER the pulse
            // so the rail row still gives at-a-glance progress feedback.
            return (
                <span className="sv-scenario-status-pill sv-status-computing is-compact">
                    <span className="sv-scenario-status-mini-pulse" aria-hidden="true" />
                    <span className="sv-scenario-status-mini-label">
                        <Message msgId="hydrata.anuga.statusComputing" />
                    </span>
                    <span
                        className="sv-scenario-status-mini-bar"
                        style={{width: `${Math.max(0, Math.min(100, pct))}%`}}
                        aria-hidden="true"
                    />
                </span>
            );
        }
        return (
            <span className="sv-scenario-status-pill sv-status-computing">
                <span className="sv-scenario-status-progress-track">
                    <span
                        className="sv-scenario-status-progress-fill"
                        style={{width: `${pct}%`}}
                    />
                </span>
                <span className="sv-scenario-status-progress-pct">{Math.round(pct)}%</span>
                {eta ?
                    <span className="sv-scenario-status-progress-eta">{Math.ceil(eta / 60)}m</span> : null
                }
            </span>
        );
    }
    case 'processing':
        return (
            <span className={"sv-scenario-status-pill status-processing" + (compact ? " is-compact" : "")}>
                <span className="glyphicon glyphicon-refresh glyphicon-spin sv-status-icon" />
                <Message msgId="hydrata.anuga.statusProcessing" />
            </span>
        );
    case 'complete':
        return (
            <span className={"sv-scenario-status-pill sv-status-complete" + (compact ? " is-compact" : "")}>
                <span className="glyphicon glyphicon-ok sv-status-icon" />
                <Message msgId="hydrata.anuga.statusComplete" />
            </span>
        );
    case 'error': {
    // Wave 3B (B2) — R3 mitigation. Compact rail pill is icon-only so the
    // legacy 30-char preview is hidden. Surface the full error message as
    // a native `title=` tooltip on the pill wrapper so hovering the rail
    // row still shows the failure reason. Truncate to 200 chars so a
    // multi-page stack trace doesn't make the tooltip unreadable.
    //
    // TASK-2860 (W3, epic 2815) — AC3: reads `user_message` (BE-derived,
    // human-facing), NEVER `error_message`, which stays raw for operators
    // (TASK-2824) and can hold a traceback line or bare exception class
    // name.
        const fullMsg = latestRun?.user_message;
        const tooltip = (compact && fullMsg)
            ? (fullMsg.length > 200 ? fullMsg.substring(0, 200) + '...' : fullMsg)
            : undefined;
        return (
            <span
                className={"sv-scenario-status-pill sv-status-error" + (compact ? " is-compact" : "")}
                title={tooltip}
            >
                <Message msgId="hydrata.anuga.statusError" />
                {fullMsg && !compact ?
                    <span
                        className="sv-scenario-status-error-detail"
                        title={fullMsg}
                    >
                        {fullMsg.substring(0, 30)}{fullMsg.length > 30 ? '...' : ''}
                    </span> : null
                }
            </span>
        );
    }
    case 'cancelled':
        return (
            <span className={"sv-scenario-status-pill sv-status-cancelled" + (compact ? " is-compact" : "")}>
                <Message msgId="hydrata.anuga.statusCancelled" />
            </span>
        );
    case 'built':
        return (
            <span className={"sv-scenario-status-pill sv-status-built" + (compact ? " is-compact" : "")}>
                <Message msgId="hydrata.anuga.statusBuilt" />
            </span>
        );
    case 'created':
    default:
        return (
            <span className={"sv-scenario-status-pill status-created" + (compact ? " is-compact" : "")}>
                {status}
            </span>
        );
    }
};

ScenarioStatusPill.propTypes = {
    scenario: PropTypes.object,
    compact: PropTypes.bool
};

ScenarioStatusPill.defaultProps = {
    compact: false
};

// Wave 3D Tier B7 — pill is rendered N times per rail (once per scenario row)
// plus once on the status card. Memoising trims wasted reconciliation when
// the parent re-renders for unrelated state.
const MemoScenarioStatusPill = React.memo(ScenarioStatusPill);

export {MemoScenarioStatusPill as ScenarioStatusPill};
