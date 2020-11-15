/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Rx = require('rxjs');
const axios = require('@mapstore/framework/libs/ajax');
const ConfigUtils = require("@mapstore/framework/utils/ConfigUtils");


const createAttributesFromMetadata = ({ name, description }) => {
    return [{
        "type": "string",
        "name": "title",
        "value": name,
        "label": "Title"
    },
    {
        "type": "string",
        "name": "abstract",
        "value": description,
        "label": "Abstract"
    }];
};
const addThumbToAttributes = ({ data }, attributes) => {
    return [...attributes, {
        "type": "string",
        "name": "thumbnail",
        "value": data,
        "label": "Thumbnail"
    }
    ];
};
const patchResource = (id, resource) => {
    const baseUrl = ConfigUtils.getConfigProp("genode_rest_api") || "./";
    return axios.patch(`${baseUrl}resources/${id}/?full=true`, resource);
};

const postResource = (data, metadata, { thumbnail }) => {
    const baseUrl = ConfigUtils.getConfigProp("genode_rest_api") || "./";
    const attributes = thumbnail ? addThumbToAttributes(thumbnail, createAttributesFromMetadata(metadata)) : createAttributesFromMetadata(metadata);
    return axios.post(`${baseUrl}resources/?full=true`, { data, attributes, name: metadata.name }, { timeout: 10000 });
};
const getLayerEditPerimissions = (name) => {
    const baseUrl = ConfigUtils.getConfigProp("geonode_url") || "./";
    return axios.get(`${baseUrl}gs/${name}/edit-check`);
};
const getStyleEditPerimissions = (name) => {
    const baseUrl = ConfigUtils.getConfigProp("geonode_url") || "./";
    return axios.get(`${baseUrl}gs/${name}/style-check`);
};
const postThumbnail = (endPoint, id, body = {}) => {
    const baseUrl = ConfigUtils.getConfigProp("geonode_url") || "./";
    return axios.post(`${baseUrl}${endPoint}/${id}/thumbnail`, body, { timeout: 10000 });
};

/**
 * Retrieves a resource with data with all information about user's permission on that resource, attributes and data.
 * @param {number} id the id of the resource to get
 * @param {options} param1 `includeAttributes` and `withData` flags, both true by default
 * @param {object} API the API to use
 * @return and observable that emits the resource
 */
const getResource = () => Rx.Observable.empty();


/*
* @param {resource} param0 resource content
* @return an observable that emits the id of the resource
*/
const createResource = ({ data, metadata, linkedResources = {} }) =>
    Rx.Observable.defer(() => postResource(data, metadata, linkedResources))
        .pluck('data')
        .do((res) => window.location.href = `${ConfigUtils.getConfigProp("geonode_url")}maps/${res.id}/edit`) // eslint-disable-line no-return-assign
        .filter(() => false);
/**
 * Patch a resource
 * @param {resource} param0 the resource to update (must contain the id)
 */
const updateResource = ({ id, data } = {}) =>
    Rx.Observable.defer(
        () => patchResource(id, { id, data }))
        .switchMap(
            res => Rx.Observable.of(res))
        .pluck('data')
        .map(res => res.id);
/**
 * Deletes a resource and the linked resources
 * @param {object} resource the resource with the id
 * @param {object} options options
 * @param {object} API the API to use
 */
const deleteResource = () => Rx.Observable.empty();
/**
 * Retrieve layer's edit permission from local gs otherwise are false
 */
const layerEditPermissions = (layer) =>
    Rx.Observable.defer(() => getLayerEditPerimissions(layer.name))
        .pluck("data")
        .map(({ authorized }) => ({ canEdit: authorized }));
const styleEditPermissions = (layer) =>
    Rx.Observable.defer(() => getStyleEditPerimissions(layer.name))
        .pluck("data")
        .map(({ authorized }) => ({ canEdit: authorized }));
const updateThumb = (endPoint, id, body) =>
    Rx.Observable.defer(() => postThumbnail(endPoint, id, body));

module.exports = {
    getResource,
    createResource,
    updateResource,
    deleteResource,
    layerEditPermissions,
    styleEditPermissions,
    updateThumb
};
