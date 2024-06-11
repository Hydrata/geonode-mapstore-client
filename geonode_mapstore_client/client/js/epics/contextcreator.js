/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Observable } from 'rxjs';
import isEmpty from 'lodash/isEmpty';
import { pluginsSelector } from '@mapstore/framework/selectors/contextcreator';
import { enablePlugins, LOAD_FINISHED } from '@mapstore/framework/actions/contextcreator';
import { defaultViewerPluginsSelector } from '@js/selectors/resource';
import { setDefaultViewerPlugins } from '@js/actions/gnresource';

/**
* @module epics/contextcreator
*/

/**
 * Set default enabled plugins in the plugin selector of context creator
 */
export const gnSetDefaultViewerEnabledPlugins = (action$, { getState } = {}) =>
    action$.ofType(LOAD_FINISHED)
        .filter(()=> !isEmpty(defaultViewerPluginsSelector(getState())))
        .switchMap(() => {
            const state = getState();
            const { pk, mapPk } = state?.gnresource?.params ?? {};
            if (pk === 'new' && mapPk) {
                const availablePlugins = (pluginsSelector(state) ?? []).map(plugin => plugin.name);
                const defaultViewerPlugins = defaultViewerPluginsSelector(state) ?? [];
                const defaultPlugins = defaultViewerPlugins.filter(plugin => availablePlugins.includes(plugin));
                return Observable.of(enablePlugins(defaultPlugins));
            }
            return Observable.of(setDefaultViewerPlugins([]));
        });

export default {
    gnSetDefaultViewerEnabledPlugins
};
