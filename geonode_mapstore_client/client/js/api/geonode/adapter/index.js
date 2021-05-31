/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from '@mapstore/framework/libs/ajax';
import { getConfigProp } from '@mapstore/framework/utils/ConfigUtils';
import { parseDevHostname } from '@js/utils/APIUtils';

/**
* Api for GeoNode MapStore adapter
* @name api.geonode.adapter
*/

/**
* Create a new MapStore map configuration
* @memberof api.geonode.adapter
* @param {object} body new map configuration
* @return {promise} it returns an object with the success map object response
*/
export const creatMapStoreMap = (body = {}) => {
    const { endpointAdapter = '/mapstore/rest' } = getConfigProp('geoNodeApi') || {};
    return axios.post(parseDevHostname(`${endpointAdapter}/resources/`),
        body,
        {
            timeout: 10000,
            params: {
                full: true
            }
        })
        .then(({ data }) => data);
};

/**
* Update an existing MapStore map configuration
* @memberof api.geonode.adapter
* @param {number|string} id resource id
* @param {object} body map configuration
* @return {promise} it returns an object with the success map object response
*/
export const updateMapStoreMap = (id, body = {}) => {
    const { endpointAdapter = '/mapstore/rest' } = getConfigProp('geoNodeApi') || {};
    return axios.patch(parseDevHostname(`${endpointAdapter}/resources/${id}/`),
        body,
        {
            params: {
                full: true
            }
        })
        .then(({ data }) => data);
};

/**
* Get a map configuration
* @memberof api.geonode.adapter
* @param {number|string} id resource id
* @return {promise} it returns an object with the success map object response
*/
export const getMapStoreMapById = (id) => {
    const { endpointAdapter = '/mapstore/rest' } = getConfigProp('geoNodeApi') || {};
    return axios.get(parseDevHostname(`${endpointAdapter}/resources/${id}/`),
        {
            params: {
                full: true
            }
        })
        .then(({ data }) => data);
};

export default {
    creatMapStoreMap,
    updateMapStoreMap,
    getMapStoreMapById
};
