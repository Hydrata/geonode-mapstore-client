/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';

function ActionNavbar({}) {
    // placeholder plugin component
    return (
        <div
            style={{
                top: 0,
                left: 0,
                width: '100%',
                height: 50,
                backgroundColor: '#2c689c'
            }}>
        </div>
    );
}

const ActionNavbarPlugin = connect(
    createSelector([], () => ({})),
    {}
)(ActionNavbar);

export default createPlugin('ActionNavbar', {
    component: ActionNavbarPlugin,
    containers: {
        ViewerLayout: {
            priority: 1,
            target: 'header'
        }
    },
    epics: {},
    reducers: {}
});
