/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const FETCH_SUGGESTIONS = 'GEONODE_SEARCH:FETCH_SUGGESTIONS';
export const UPDATE_SUGGESTIONS = 'GEONODE_SEARCH:UPDATE_SUGGESTIONS';
export const LOADING_SUGGESTIONS = 'GEONODE_SEARCH:LOADING_SUGGESTIONS';
export const SEARCH_RESOURCES = 'GEONODE_SEARCH:SEARCH_RESOURCES';
export const UPDATE_RESOURCES = 'GEONODE_SEARCH:UPDATE_RESOURCES';
export const LOADING_RESOURCES = 'GEONODE_SEARCH:LOADING_RESOURCES';
export const SELECT_RESOURCE = 'GEONODE_SEARCH:SELECT_RESOURCE';
export const REQUEST_RESOURCE = 'GEONODE_SEARCH:REQUEST_RESOURCE';
export const UPDATE_RESOURCES_METADATA = 'GEONODE_SEARCH:UPDATE_RESOURCES_METADATA';

export function fetchSuggestions(text) {
    return {
        type: FETCH_SUGGESTIONS,
        text
    };
}

export function updateSuggestions(suggestions) {
    return {
        type: UPDATE_SUGGESTIONS,
        suggestions
    };
}

export function loadingSuggestions(loading) {
    return {
        type: LOADING_SUGGESTIONS,
        loading
    };
}

export function searchResources(params, pathname) {
    return {
        type: SEARCH_RESOURCES,
        params,
        pathname
    };
}

export function updateResources(resources, reset) {
    return {
        type: UPDATE_RESOURCES,
        resources,
        reset
    };
}

export function updateResourcesMetadata(metadata) {
    return {
        type: UPDATE_RESOURCES_METADATA,
        metadata
    };
}

export function loadingResources(loading) {
    return {
        type: LOADING_RESOURCES,
        loading
    };
}

export function requestResource(pk, ctype) {
    return {
        type: REQUEST_RESOURCE,
        pk,
        ctype
    };
}

export default {
    FETCH_SUGGESTIONS,
    fetchSuggestions,
    UPDATE_SUGGESTIONS,
    updateSuggestions,
    LOADING_SUGGESTIONS,
    loadingSuggestions,
    SEARCH_RESOURCES,
    searchResources,
    UPDATE_RESOURCES,
    updateResources,
    LOADING_RESOURCES,
    loadingResources,
    REQUEST_RESOURCE,
    requestResource
};
