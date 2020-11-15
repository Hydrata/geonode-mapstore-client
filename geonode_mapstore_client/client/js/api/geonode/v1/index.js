/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from '@mapstore/framework/libs/ajax';
import { getConfigProp } from '@mapstore/framework/utils/ConfigUtils';

/**
* Api for GeoNode v1
* @name api.geonode.v1
*/

/**
* Get resource by primary key
* @memberof api.geonode.v1
* @param {number|string} pk primary key
* @return {promise} it returns an object with requested resource
*/
export const getResourceByPk = (pk) => {
    const { endpointV1 = '/api' } = getConfigProp('geoNodeApi') || {};
    return axios.get(`${endpointV1}/base/${pk}`)
        // add pk as alias to id
        // used in save and save as for map
        .then(({ data }) => ({ pk: data.id, ...data }));
};

export default {
    getResourceByPk
};
