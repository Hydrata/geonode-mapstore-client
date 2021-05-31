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

function BrandNavbar({}) {
    // placeholder plugin component
    return (
        <div
            style={{
                top: 0,
                left: 0,
                width: '100%',
                height: 60,
                backgroundColor: '#f2f2f2'
            }}>
        </div>
    );
}

const BrandNavbarPlugin = connect(
    createSelector([], () => ({})),
    {}
)(BrandNavbar);

export default createPlugin('BrandNavbar', {
    component: BrandNavbarPlugin,
    containers: {
        ViewerLayout: {
            priority: 1,
            target: 'header'
        }
    },
    epics: {},
    reducers: {}
});
