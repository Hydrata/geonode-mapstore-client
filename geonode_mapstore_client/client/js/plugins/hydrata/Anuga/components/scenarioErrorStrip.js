import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {ErrorStrip, LogViewer} from '../../SimpleView/components/primitives';
import {findScenarioStatus, ERROR_CLASS_MESSAGE_IDS, tailLines, buildCloudWatchDeepLink} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller Wave 3A — error-state strip for the
 * Status-and-actions Pane 3. Only renders when the scenario's resolved
 * lifecycle status is 'error'.
 *
 * TASK-1730 (Phase-C rollout) — PARITY-migrated onto the shared
 * {ErrorStrip} primitive. The primitive was harvested FROM this very
 * `.sv-anuga-scenario-error-strip` (left-border red + tinted bg + uppercase
 * head + monospace `<code>` payload), so the structure is unchanged: the
 * outer `role="alert"` div is preserved and still carries the
 * `sv-anuga-scenario-error-strip` class (via `extraClassName`) for the legacy
 * CSS + scenarioPane assertions, while the inner head/payload hooks
 * canonicalise to `sv-error-strip-head` / `sv-error-strip-payload`.
 *
 * Reads `scenario.latest_run.error_message` and surfaces it verbatim in
 * the `<code>` payload, mirroring the legacy table cell. When the
 * latest_run has no message we fall back to the localised
 * `hydrata.anuga.statusError` string so the strip still anchors the
 * user's attention (the primitive renders the fallback as a `<code>`
 * payload too — a one-element-name change from the legacy `<span>`,
 * structure otherwise identical).
 *
 * W1.2 (TASK-2207, epic 2204) — three additions built on top of the W1.1
 * (TASK-2206, BE) capture + classification:
 *   - classified cause line (`latest_run.error_class` -> a translated
 *     label via ERROR_CLASS_MESSAGE_IDS; renders nothing extra for
 *     null/unrecognised classes, e.g. pre-2206 rows)
 *   - a collapsible, bounded tail of `latest_run.log` (falls back to
 *     `latest_run.cloudwatch_log_tail` when there's no in-process log to
 *     show — the CloudWatch backstop for entrypoint deaths where nothing
 *     useful was POSTed); collapsed by default so the strip stays compact
 *   - a staff-only AWS Console CloudWatch deep link (gated by the SAME
 *     is_staff/is_superuser precedent as the compute-target selector —
 *     TASK-2194, epic 2190 W2 — see AnugaRunsDashboard/runsDashboardUtils
 *     .isStaffUser); renders nothing for non-staff even when the BE has
 *     already captured log_group_name/log_stream_name (those are not
 *     secret, but the AWS console link itself is a staff affordance)
 */

const LOG_TAIL_MAX_LINES = 40;

// W1.2 (TASK-2207) / simplify-pass — inline token-backed styles for the new
// interactive bits, mirroring ErrorStrip.js's own convention (self-styled
// via --sv-* tokens, no new stylesheet dependency, cascade-proof). Without
// these the toggle button/link would render with bare browser-default
// chrome inside the dark-glass panel — legible but visually foreign.
const causeStyle = {fontSize: '11px', marginTop: '2px', color: 'var(--sv-text-danger, #ffb3b3)'};
const toggleStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    marginTop: '4px',
    fontSize: '11px',
    textDecoration: 'underline',
    cursor: 'pointer',
    color: 'var(--sv-text-danger, #ffb3b3)'
};
const cwLinkStyle = {display: 'block', marginTop: '4px', fontSize: '11px'};
const cwLinkAnchorStyle = {color: 'var(--sv-text-danger, #ffb3b3)', textDecoration: 'underline'};

class ScenarioErrorStrip extends React.Component {
    static propTypes = {
        scenario: PropTypes.object,
        isStaff: PropTypes.bool
    };

    static defaultProps = {
        isStaff: false
    };

    constructor(props) {
        super(props);
        this.state = {logTailOpen: false};
        this.toggleLogTail = this.toggleLogTail.bind(this);
    }

    toggleLogTail() {
        this.setState((prev) => ({logTailOpen: !prev.logTailOpen}));
    }

    render() {
        const {scenario, isStaff} = this.props;
        if (!scenario) return null;
        const status = findScenarioStatus(scenario);
        if (status !== 'error') return null;

        const latestRun = scenario.latest_run || {};
        const errorMessage = latestRun.error_message || null;
        const causeMsgId = ERROR_CLASS_MESSAGE_IDS[latestRun.error_class];
        // In-process failures already have their traceback in `log` (zero
        // AWS calls to show it); everything else falls back to the
        // best-effort CloudWatch backstop, if one was captured.
        const tail = tailLines(latestRun.log, LOG_TAIL_MAX_LINES) || latestRun.cloudwatch_log_tail || '';
        const deepLink = isStaff
            ? buildCloudWatchDeepLink(latestRun.log_group_name, latestRun.log_stream_name)
            : null;
        const {logTailOpen} = this.state;

        return (
            <ErrorStrip
                extraClassName="sv-anuga-scenario-error-strip"
                head={<Message msgId="hydrata.anuga.runFailedHead" />}
                payload={errorMessage || <Message msgId="hydrata.anuga.statusError" />}
            >
                {causeMsgId ? (
                    <div className="sv-anuga-scenario-error-cause" style={causeStyle}>
                        <Message msgId="hydrata.anuga.errorCausePrefix" />
                        {' '}
                        <Message msgId={causeMsgId} />
                    </div>
                ) : null}
                {tail ? (
                    <div className="sv-anuga-scenario-error-log-tail">
                        <button
                            type="button"
                            className="sv-anuga-scenario-error-log-tail-toggle"
                            style={toggleStyle}
                            onClick={this.toggleLogTail}
                        >
                            <Message msgId={logTailOpen ? 'hydrata.anuga.hideLogTail' : 'hydrata.anuga.showLogTail'} />
                        </button>
                        {logTailOpen ? <LogViewer log={tail} /> : null}
                    </div>
                ) : null}
                {deepLink ? (
                    <div className="sv-anuga-scenario-error-cw-link" style={cwLinkStyle}>
                        <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sv-anuga-scenario-error-cw-link-anchor"
                            style={cwLinkAnchorStyle}
                        >
                            <Message msgId="hydrata.anuga.cloudwatchDeepLink" />
                        </a>
                    </div>
                ) : null}
            </ErrorStrip>
        );
    }
}

// Wave 3D Tier B7 — error strip is pure on its scenario/isStaff props and
// only renders when the scenario lifecycle resolves to 'error'. Default
// shallow comparator is sufficient (React.memo(Component-class) still
// wraps class components in a memoised functional shell).
const MemoScenarioErrorStrip = React.memo(ScenarioErrorStrip);

export {MemoScenarioErrorStrip as ScenarioErrorStrip};
