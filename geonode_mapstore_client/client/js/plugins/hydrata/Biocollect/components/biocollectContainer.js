import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import BiocollectChart from './biocollectChart';


class BiocollectContainer extends React.Component {
    static propTypes = {
        visibleBiocollectChart: PropTypes.bool
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"biocollect-container"}>
                {
                    this.props.visibleBiocollectChart ?
                        <BiocollectChart/> :
                        null
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    console.log('state for Biocollect:', state);
    return {
        visibleBiocollectChart: state?.biocollect?.visibleBiocollectChart
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(BiocollectContainer);
