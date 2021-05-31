/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import isEqual from 'lodash/isEqual';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import usePluginItems from '@js/hooks/usePluginItems';

function ViewerLayout({
    items
}, context) {
    const { loadedPlugins } = context;
    const configuredItems = usePluginItems({ items, loadedPlugins });
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}>
            <header>
                {configuredItems
                    .filter(({ target }) => target === 'header')
                    .map(({ Component, name }) => <Component key={name} />)}
            </header>
            <div style={{display: 'flex'}}>
                <div
                    style={{
                        display: 'flex',
                        flex: 1,
                        position: 'relative'
                    }}
                >
                    {configuredItems
                        .filter(({ target }) => !target)
                        .map(({ Component, name }) => <Component key={name} />)}
                </div>
                <div>
                    <div
                        className={`rightColumn`}
                        style={{
                            display: 'flex',
                            flex: 1,
                            position: 'relative'
                        }}
                    >
                        {configuredItems
                            .filter(({ target }) => target === 'rightColumn')
                            .map(({ Component, name }) => <Component key={name} />)}

                    </div>
                </div>
            </div>
            <footer>
                {configuredItems
                    .filter(({ target }) => target === 'footer')
                    .map(({ Component, name }) => <Component key={name} />)}
            </footer>
        </div>
    );
}

ViewerLayout.contextTypes = {
    loadedPlugins: PropTypes.object
};

function arePropsEqual(prevProps, nextProps) {
    return isEqual(prevProps, nextProps);
}

const MemoizeViewerLayout = memo(ViewerLayout, arePropsEqual);

const ViewerLayoutPlugin = connect(
    createSelector([], () => ({})),
    {}
)(MemoizeViewerLayout);

export default createPlugin('ViewerLayout', {
    component: ViewerLayoutPlugin,
    containers: {},
    epics: {},
    reducers: {}
});
