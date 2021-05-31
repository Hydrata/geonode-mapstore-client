/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const UPDATE_GEONODE_SETTINGS = 'GEONODE_SETTINGS:UPDATE';

export function updateGeoNodeSettings(settings) {
    return {
        type: UPDATE_GEONODE_SETTINGS,
        settings
    };
}
