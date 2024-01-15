import React from 'react';
import { connect } from 'react-redux';

import PiwikPro from '@piwikpro/react-piwik-pro';
const PropTypes = require('prop-types');

import { } from "../actionsPiwikPro";

class PiwikProContainer extends React.Component {
    static propTypes = {};

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"piwik-pro-container"}></div>
        );
    }
}

const mapStateToProps = (state) => {
    return { };
};

const mapDispatchToProps = ( dispatch ) => {
    return { };
};

export default connect(mapStateToProps, mapDispatchToProps)(PiwikProContainer);
