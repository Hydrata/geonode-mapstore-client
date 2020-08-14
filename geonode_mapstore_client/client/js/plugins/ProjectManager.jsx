import React from 'react';
import { connect } from 'react-redux';
import { createPlugin } from '../../MapStore2/web/client/utils/PluginsUtils';
// import { changeZoomLevel } from '../../MapStore2/web/client/actions/map';
import { projectionSelector } from '../../MapStore2/web/client/selectors/map';
// import {get} from 'lodash';

const style = {
    position: "absolute",
    background: "blue",
    opacity: 50,
    zIndex: 1000000,
    top: 10,
    left: 10,
    minWidth: "115px",
    backgroundColor: "rgba(0,60,136,0.5)",
    borderColor: "#97b3cd",
    padding: "5px 10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "3px",
    color: "white",
    textAlign: "center"
};

const MenuButton = (props) => {
    const {projection} = props;
    return (
        <div style={style}>MenuTime {projection}</div>
    );
};

const mapStateToProps = state => {
    return {
        projection: projectionSelector(state)
    };
};

const ConnectedComponent = connect(
    mapStateToProps
)(MenuButton);

export default createPlugin('ProjectManager', {
    component: ConnectedComponent,
    containers: {
        BurgerMenu: {
            name: 'exmpale',
            position: 1500,
            text: "testsd",
            doNotHide: true
        }
    }
});
// export const ProjectManagerPlugin = ConnectedComponent;

/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
// const React = require('react');
// const {connect} = require('react-redux');
//
// const MessagePlugin = connect((state) => ({
//     content: state.my.content
// }))((props) => props.content ? <div className="myMessage" style={props.style}>{props.content}</div> : <span/>);
//
// module.exports = {
//     MessagePlugin,
//     reducers: {}
// };
