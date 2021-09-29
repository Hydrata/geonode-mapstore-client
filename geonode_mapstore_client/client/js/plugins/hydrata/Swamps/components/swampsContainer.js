import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import SwampsChart from './swampsChart';
import '../swamps.css';

class SwampsContainer extends React.Component {
    static propTypes = {
        visibleSwampsChart: PropTypes.bool
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"swamps-container"}>
                {
                    this.props.visibleSwampsChart ?
                        <SwampsChart/> :
                        null
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    console.log('state for Swamps:', state);
    return {
        visibleSwampsChart: state?.swamps?.visibleSwampsChart
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SwampsContainer);
