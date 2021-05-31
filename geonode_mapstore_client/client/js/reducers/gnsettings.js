/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import {
    UPDATE_GEONODE_SETTINGS
} from '@js/actions/gnsettings';

function gnsettings(state = {}, action) {
    switch (action.type) {
    case UPDATE_GEONODE_SETTINGS: {
        return {
            ...action.settings
        };
    }
    default:
        return state;
    }
}

export default gnsettings;
