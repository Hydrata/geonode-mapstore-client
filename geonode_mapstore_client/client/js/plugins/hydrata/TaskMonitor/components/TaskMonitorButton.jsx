import React from 'react';
import {Glyphicon} from 'react-bootstrap';
const PropTypes = require('prop-types');

class TaskMonitorButton extends React.Component {
    static propTypes = {
        panelOpen: PropTypes.bool,
        activeCount: PropTypes.number,
        onClick: PropTypes.func
    };

    render() {
        const { panelOpen, activeCount } = this.props;
        return (
            <button
                className={`simple-view-right-button tm-button ${panelOpen ? 'active' : ''}`}
                onClick={this.props.onClick}
                title="Tasks"
            >
                <Glyphicon glyph="tasks" />
                {activeCount > 0 && !panelOpen ? (
                    <span className="tm-notification-dot" />
                ) : null}
            </button>
        );
    }
}

export default TaskMonitorButton;
