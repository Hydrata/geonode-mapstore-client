import React from 'react';
import { connect } from 'react-redux';

import PiwikPro from '@piwikpro/react-piwik-pro';
const PropTypes = require('prop-types');

import { } from "../actionsPiwikPro";


PiwikPro.initialize('abcdd6c8-5b23-4263-8616-04442c6c5f8f', 'https://hydrata.piwik.pro');
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
