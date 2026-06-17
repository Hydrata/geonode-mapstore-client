import React from "react";
import PropTypes from 'prop-types';

/**
 * LogViewer — terminal-style scrollable log pane.
 *
 * Best-of-breed source:
 *   anuga.css  .sv-anuga-scenario-pane-log-viewer  (dark #000000cc bg)
 *   taskMonitor.css  .tm-log-viewer  (#1e1e1e bg — kept per decision 1665)
 *
 * The log-viewer bg is intentionally dark (#1e1e1e) even in the dark-glass
 * theme — this is a terminal, not a panel. The value is kept as a
 * local constant (not a token) because it is terminal-convention, not
 * a panel-chrome colour.
 *
 * Auto-scrolls to the bottom when `log` changes (same behaviour as the
 * original ProcessLogViewer.jsx).
 *
 * Usage:
 *   <LogViewer log={process.log} />
 *   <LogViewer log={null} />   ← renders "(no log output)"
 */

class LogViewer extends React.Component {
    static propTypes = {
        log: PropTypes.string,
        /** Override placeholder when log is empty/null */
        emptyText: PropTypes.string
    };

    static defaultProps = {
        emptyText: '(no log output)'
    };

    constructor(props) {
        super(props);
        this.logRef = React.createRef();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.log !== this.props.log && this.logRef.current) {
            this.logRef.current.scrollTop = this.logRef.current.scrollHeight;
        }
    }

    render() {
        const { log, emptyText } = this.props;
        return (
            <pre
                ref={this.logRef}
                className="sv-log-viewer"
            >
                {log || emptyText}
            </pre>
        );
    }
}

export { LogViewer };
