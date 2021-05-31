/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import url from 'url';
import { createSelector } from 'reselect';
import BorderLayout from '@mapstore/framework/components/layout/BorderLayout';
import { getMonitoredState } from '@mapstore/framework/utils/PluginsUtils';
import { getConfigProp } from '@mapstore/framework/utils/ConfigUtils';
import PluginsContainer from '@mapstore/framework/components/plugins/PluginsContainer';
import useLazyPlugins from '@js/hooks/useLazyPlugins';
import { requestMapConfig } from '@js/actions/gnviewer';

const urlQuery = url.parse(window.location.href, true).query;

const ConnectedPluginsContainer = connect((state) => ({
    mode: urlQuery.mode || (urlQuery.mobile || state.browser && state.browser.mobile ? 'mobile' : 'desktop'),
    monitoredState: getMonitoredState(state, getConfigProp('monitorState')),
    pluginsState: {
        ...state.controls
    }
}))(PluginsContainer);

function MapViewerRoute({
    name,
    pluginsConfig: propPluginsConfig,
    params,
    onUpdate,
    loaderComponent,
    lazyPlugins,
    plugins,
    match
}) {

    const { pk } = match.params || {};
    const pluginsConfig = propPluginsConfig && propPluginsConfig[name] || [];

    const [loading, setLoading] = useState(true);
    const { plugins: loadedPlugins } = useLazyPlugins({
        pluginsEntries: lazyPlugins,
        pluginsConfig
    });

    useEffect(() => {
        if (!loading) {
            onUpdate(pk);
        }
    }, [loading, pk]);

    const Loader = loaderComponent;

    return (
        <>
            <ConnectedPluginsContainer
                key="page-map-viewer"
                id="page-map-viewer"
                className="page page-map-viewer"
                component={BorderLayout}
                pluginsConfig={pluginsConfig}
                plugins={{ ...loadedPlugins, ...plugins }}
                params={params}
                onPluginsLoaded={() => setLoading(false)}
            />
            {loading && Loader && <Loader />}
        </>
    );
}

MapViewerRoute.propTypes = {
    onUpdate: PropTypes.func
};

const ConnectedMapViewerRoute = connect(
    createSelector([], () => ({})),
    {
        onUpdate: requestMapConfig
    }
)(MapViewerRoute);

ConnectedMapViewerRoute.displayName = 'ConnectedMapViewerRoute';

export default ConnectedMapViewerRoute;
