import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {initAnuga} from '../actionsAnuga';
import AnugaControls from './anugaControls';
import '../anuga.css';

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        viewAnugaGroupId: PropTypes.string,
        openMenuGroupId: PropTypes.string
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        this.props.initAnuga();
    }

    render() {
        return (
            <div id={"anuga-container"}>
                <p>Anuga Hello World</p>
                {
                    (this.props.openMenuGroupId && this.props.viewAnugaGroupId === this.props.openMenuGroupId) ?
                        <div>
                            <AnugaControls/>
                        </div>
                        : null
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // console.log('state for Anuga:', state);
    return {
        viewAnugaGroupId: state?.mapConfigRawData?.map?.groups?.filter((group) => group.title === "Anuga")[0]?.id,
        openMenuGroupId: state?.simpleView?.openMenuGroupId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
