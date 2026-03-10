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
            <ButtonGroup className="tm-filter-bar">
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
