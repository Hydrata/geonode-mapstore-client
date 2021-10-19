import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {initSwamps} from '../actionsSwamps';
import SwampsChart from './swampsChart';
import SwampsControls from './swampsControls';
import '../swamps.css';

class SwampsContainer extends React.Component {
    static propTypes = {
        visibleSwampsChart: PropTypes.bool,
        initSwamps: PropTypes.func,
        viewSwampsGroupId: PropTypes.string,
        openMenuGroupId: PropTypes.string
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        this.props.initSwamps();
    }

    render() {
        return (
            <div id={"swamps-container"}>
                {
                    this.props.visibleSwampsChart ?
                        <SwampsChart/>
                        : null
                }
                {
                    this.props.viewSwampsGroupId === this.props.openMenuGroupId ?
                        <div>
                            <SwampsControls/>
                        </div>
                        : null
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // console.log('state for Swamps:', state);
    return {
        visibleSwampsChart: state?.swamps?.visibleSwampsChart,
        viewSwampsGroupId: state?.mapConfigRawData?.map?.groups?.filter((group) => group.title === "Swamps")[0]?.id,
        openMenuGroupId: state?.simpleView?.openMenuGroupId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initSwamps: () => dispatch(initSwamps())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SwampsContainer);
