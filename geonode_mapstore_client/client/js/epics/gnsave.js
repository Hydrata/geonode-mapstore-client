/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Observable } from 'rxjs';
import { mapSelector } from '@mapstore/framework/selectors/map';
import { layersSelector, groupsSelector } from '@mapstore/framework/selectors/layers';
import { backgroundListSelector } from '@mapstore/framework/selectors/backgroundselector';
import { mapOptionsToSaveSelector } from '@mapstore/framework/selectors/mapsave';
import {
    bookmarkSearchConfigSelector,
    textSearchConfigSelector
} from '@mapstore/framework/selectors/searchconfig';
import { saveMapConfiguration } from '@mapstore/framework/utils/MapUtils';
import { getConfigProp } from '@mapstore/framework/utils/ConfigUtils';
import {
    creatMapStoreMap,
    updateMapStoreMap
} from '@js/api/geonode/adapter';
import {
    SAVE_CONTENT,
    UPDATE_RESOURCE_BEFORE_SAVE,
    saveSuccess,
    saveError,
    savingResource
} from '@js/actions/gnsave';
import {
    resourceLoading,
    setResource,
    resourceError,
    updateResourceProperties
} from '@js/actions/gnresource';
import {
    getResourceByPk
} from '@js/api/geonode/v1';
import { parseDevHostname } from '@js/utils/APIUtils';

const SaveAPI = {
    map: (state, id, metadata, reload) => {
        const map =  mapSelector(state) || {};
        const layers = layersSelector(state);
        const groups = groupsSelector(state);
        const backgrounds = backgroundListSelector(state);
        const textSearchConfig = textSearchConfigSelector(state);
        const bookmarkSearchConfig = bookmarkSearchConfigSelector(state);
        const additionalOptions = mapOptionsToSaveSelector(state);
        const data = saveMapConfiguration(
            map,
            layers,
            groups,
            backgrounds,
            textSearchConfig,
            bookmarkSearchConfig,
            additionalOptions
        );
        const name = metadata.name;
        const description = metadata.description;
        const thumbnail = metadata.thumbnail;
        const body = {
            name,
            data,
            attributes: [{
                type: 'string',
                name: 'title',
                value: name,
                label: 'Title'
            },
            {
                type: 'string',
                name: 'abstract',
                value: description,
                label: 'Abstract'
            },
            ...(thumbnail
                ? [{
                    type: 'string',
                    name: 'thumbnail',
                    value: thumbnail,
                    label: 'Thumbnail'
                }]
                : [])
            ]
        };
        return id
            ? updateMapStoreMap(id, { ...body, id })
            : creatMapStoreMap(body)
                .then((response) => {
                    if (reload) {
                        window.location.href = parseDevHostname(`${getConfigProp('geonode_url')}maps/${response.id}/edit`);
                    }
                    return response.data;
                });
    }
};

export const gnSaveContent = (action$, store) =>
    action$.ofType(SAVE_CONTENT)
        .switchMap((action) => {
            const state = store.getState();
            const contentType = state.gnresource?.type || 'map';
            return Observable.defer(() => SaveAPI[contentType](state, action.id, action.metadata, action.reload))
                .switchMap((response) => {
                    return Observable.of(
                        saveSuccess(response),
                        updateResourceProperties({
                            'title': action.metadata.name,
                            'abstract': action.metadata.description,
                            'thumbnail_url': action.metadata.thumbnail
                        })
                    );
                })
                .catch((error) => {
                    return Observable.of(saveError(error.data || error.message));
                })
                .startWith(savingResource());
        });

export const gnUpdateResource = (action$, store) =>
    action$.ofType(UPDATE_RESOURCE_BEFORE_SAVE)
        .switchMap((action) => {
            const state = store.getState();
            const currentResource = state.gnresource?.data || {};
            if ( !action.id
            || currentResource.pk && action.id && currentResource.pk + '' === action.id + '') {
                return Observable.empty();
            }
            return Observable.defer(() => getResourceByPk(action.id))
                .switchMap((resource) => {
                    return Observable.of(setResource(resource));
                })
                .catch((error) => {
                    return Observable.of(resourceError(error.data || error.message));
                })
                .startWith(resourceLoading());
        });

export default {
    gnSaveContent,
    gnUpdateResource
};
