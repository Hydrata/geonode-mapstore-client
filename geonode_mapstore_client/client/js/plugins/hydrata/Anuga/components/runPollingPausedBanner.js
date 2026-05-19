import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from 'react-bootstrap';
import Message from '@mapstore/framework/components/I18N/Message';
import {startActiveRunPolling, dismissRunPollingTimeout} from '../actionsAnuga';
import {trackEvent} from '@js/utils/analytics';

/**
 * W7 (TASK-1045) — paused-polling banner.
 *
 * Renders top-right of the ANUGA scenario surface when
 * `state.runs.pollingTimeoutFor[currentRunId]` is true. The flag is set by
 * pollActiveRunStatusEpic when the polling stream hits its wall-clock cap
 * without observing a terminal status, which protects the user from a
 * forever-poll when a BE Process orphans (memory pin
 * feedback-fe-epic-task-monitor-poll-cap).
 *
 * Resume affordance:
 *   - Explicit "Resume polling" button dispatches START_ACTIVE_RUN_POLLING(runId)
 *     which the reducer treats as a clear of pollingTimeoutFor[runId] AND the
 *     epic re-subscribes with a fresh cap.
 *   - Auto-dismiss on ANY click / focusin / keydown anywhere in the document.
 *     The intuition: if the user is interacting again, they are present and
 *     can re-arm polling on their own from the action toolbar; meanwhile the
 *     paused banner has done its job of surfacing the timeout.
 *
 * Lifecycle: componentDidMount registers the three document listeners and
 * componentWillUnmount removes them. We avoid React 17+ APIs (useEffect /
 * useTransition / etc.) so the component runs cleanly on react@16.14 +
 * react-dom@16.10 — memory pin feedback-mapstore-react-version-mismatch.
 *
 * The component renders nothing when no runId is paused; the connected
 * `paused`/`runId` props derive from the live store so the banner appears
 * and disappears reactively as `pollingTimeoutFor` mutates.
 */
class RunPollingPausedBanner extends React.Component {
    static propTypes = {
        paused: PropTypes.bool,
        runId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        onResume: PropTypes.func,
        onDismiss: PropTypes.func
    };

    static defaultProps = {
        paused: false,
        runId: null
    };

    constructor(props) {
        super(props);
        this._dismissHandler = this._handleDocumentInteraction.bind(this);
    }

    componentDidMount() {
        if (typeof document === 'undefined' || !document.addEventListener) return;
        document.addEventListener('click', this._dismissHandler, true);
        document.addEventListener('focusin', this._dismissHandler, true);
        document.addEventListener('keydown', this._dismissHandler, true);
    }

    componentWillUnmount() {
        if (typeof document === 'undefined' || !document.removeEventListener) return;
        document.removeEventListener('click', this._dismissHandler, true);
        document.removeEventListener('focusin', this._dismissHandler, true);
        document.removeEventListener('keydown', this._dismissHandler, true);
    }

    _handleDocumentInteraction(e) {
        if (!this.props.paused) return;
        // Clicks ON the banner's own Resume button must NOT also auto-dismiss
        // before the Resume handler fires — the dispatch flow handles the
        // clear via START_ACTIVE_RUN_POLLING reducer side-effect.
        const target = e && e.target;
        if (target && typeof target.closest === 'function') {
            if (target.closest('.run-polling-paused-banner')) return;
        }
        if (this.props.onDismiss) this.props.onDismiss(this.props.runId);
    }

    render() {
        if (!this.props.paused) return null;
        return (
            <div
                className="run-polling-paused-banner"
                role="status"
                aria-live="polite"
                style={{
                    position: 'fixed',
                    top: '12px',
                    right: '12px',
                    zIndex: 1080,
                    background: '#fff7e6',
                    border: '1px solid #d48806',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <span style={{color: '#874d00', fontWeight: 500}}>
                    <Message msgId="hydrata.anuga.pollingPaused" />
                </span>
                <Button
                    bsSize="xsmall"
                    bsStyle="warning"
                    className="run-polling-paused-resume"
                    onClick={() => {
                        if (this.props.onResume) this.props.onResume(this.props.runId);
                        trackEvent('button', 'click', 'anuga-run-polling-resume');
                    }}
                >
                    <Message msgId="hydrata.anuga.resumePolling" />
                </Button>
            </div>
        );
    }
}

// Selector helper: the banner watches the SELECTED scenario's latest_run.id
// against the pollingTimeoutFor map. If the user navigates away from the
// scenario whose poll timed out, the banner stops rendering (the map entry
// stays around so an immediate navigate-back will re-surface it). Resume
// clears it.
const mapStateToProps = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    const scenario = selectedId ? state?.anuga?.scenarios?.byId?.[selectedId] : null;
    const runId = scenario?.latest_run?.id || null;
    const paused = !!(runId && state?.anuga?.runs?.pollingTimeoutFor?.[runId]);
    return { paused, runId };
};

const mapDispatchToProps = (dispatch) => ({
    onResume: (runId) => {
        if (runId) dispatch(startActiveRunPolling(runId));
    },
    // Auto-dismiss clears the flag but does NOT re-arm polling — the user
    // has acknowledged the banner but did not explicitly say "keep polling".
    // The Resume button is the explicit re-arm path. This keeps the
    // protection from feedback-fe-epic-task-monitor-poll-cap intact (no
    // accidental forever-poll from incidental clicks).
    onDismiss: (runId) => {
        if (runId) dispatch(dismissRunPollingTimeout(runId));
    }
});

const ConnectedRunPollingPausedBanner = connect(mapStateToProps, mapDispatchToProps)(RunPollingPausedBanner);

export {RunPollingPausedBanner};
export default ConnectedRunPollingPausedBanner;
