/**
 * ProcessLogViewer — TASK-1665 dark-glass migration.
 * Delegates to the LogViewer primitive (sv-log-viewer CSS in simpleView.css).
 * Behaviour unchanged: auto-scroll on log change.
 */

import React from 'react';
const PropTypes = require('prop-types');
import {LogViewer} from '../../SimpleView/components/primitives';

class ProcessLogViewer extends React.Component {
    static propTypes = {
        log: PropTypes.string
    };

    render() {
        return <LogViewer log={this.props.log} />;
    }
}

export default ProcessLogViewer;
