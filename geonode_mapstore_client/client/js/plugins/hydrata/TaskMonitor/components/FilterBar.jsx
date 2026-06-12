/**
 * FilterBar — TASK-1665 dark-glass migration.
 * Migrated: .tm-filter-bar → .sv-tm-filter-bar (styled in simpleView.css).
 * Behaviour unchanged: 4 filter tabs (active/completed/failed/all).
 */

import React from 'react';
import {ButtonGroup, Button} from 'react-bootstrap';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

const filters = [
    { key: 'active', msgId: 'hydrata.taskMonitor.filterActive' },
    { key: 'completed', msgId: 'hydrata.taskMonitor.filterCompleted' },
    { key: 'failed', msgId: 'hydrata.taskMonitor.filterFailed' },
    { key: 'all', msgId: 'hydrata.taskMonitor.filterAll' }
];

class FilterBar extends React.Component {
    static propTypes = {
        activeFilter: PropTypes.string,
        onSetFilter: PropTypes.func
    };

    render() {
        return (
            <ButtonGroup className="sv-tm-filter-bar">
                {filters.map(f => (
                    <Button
                        key={f.key}
                        bsSize="xsmall"
                        active={this.props.activeFilter === f.key}
                        onClick={() => this.props.onSetFilter(f.key)}
                    >
                        <Message msgId={f.msgId} />
                    </Button>
                ))}
            </ButtonGroup>
        );
    }
}

export default FilterBar;
