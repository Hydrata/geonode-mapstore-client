/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useRef, useMemo } from 'react';
import join from 'lodash/join';
import { getConfiguredPlugin } from '@mapstore/framework/utils/PluginsUtils';

const usePluginItems = ({
    items,
    loadedPlugins,
    loaderComponent
}) => {
    function configurePluginItems(props) {
        return [...props.items]
            .sort((a, b) => a.position > b.position ? 1 : -1)
            .map(plg => ({
                ...plg,
                Component: getConfiguredPlugin(plg, props.loadedPlugins, props.loaderComponent || <div />)
            })) || [];
    }
    const props = useRef({});
    props.current = {
        items,
        loadedPlugins,
        loaderComponent
    };
    const loadedPluginsKeys = join(Object.keys(loadedPlugins || {}), ',');
    const configuredItems = useMemo(() => configurePluginItems(props.current), [loadedPluginsKeys]);
    return configuredItems;
};

export default usePluginItems;
