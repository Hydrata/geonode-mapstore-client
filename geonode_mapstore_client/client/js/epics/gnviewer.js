/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Observable } from 'rxjs';
import axios from '@mapstore/framework/libs/ajax';
import turfBbox from '@turf/bbox';
import {
    REQUEST_LAYER_CONFIG,
    REQUEST_MAP_CONFIG,
    REQUEST_GEOSTORY_CONFIG,
    REQUEST_DOCUMENT_CONFIG
} from '@js/actions/gnviewer';
import { getBaseMapConfiguration } from '@js/api/geonode/config';
import {
    getLayerByPk,
    getGeoStoryByPk,
    getDocumentByPk
} from '@js/api/geonode/v2';
import { getMapStoreMapById } from '@js/api/geonode/adapter';
import { configureMap } from '@mapstore/framework/actions/config';
import { zoomToExtent } from '@mapstore/framework/actions/map';
import { getConfigProp } from '@mapstore/framework/utils/ConfigUtils';
import {
    // setResourcePermissions,
    // setNewResource,
    setResource
} from '@js/actions/gnresource';
import { setCurrentStory } from '@mapstore/framework/actions/geostory';

export const gnViewerRequestLayerConfig = (action$) =>
    action$.ofType(REQUEST_LAYER_CONFIG)
        .switchMap(({ pk }) => {
            return Observable.defer(() => axios.all([
                getBaseMapConfiguration(),
                getLayerByPk(pk)
            ])).switchMap((response) => {
                const [mapConfig, gnLayer] = response;
                const geoserverUrl = getConfigProp('geoserverUrl') || '/geoserver/';
                const geonodeUrl = getConfigProp('geonodeUrl') || '/';
                const extent = turfBbox({
                    type: 'Feature',
                    properties: {},
                    geometry: gnLayer.ll_bbox_polygon
                });
                const [minx, miny, maxx, maxy] = extent;
                const bbox = {
                    crs: 'EPSG:4326',
                    bounds: { minx, miny, maxx, maxy }
                };
                return Observable.of(
                    configureMap({
                        ...mapConfig,
                        map: {
                            ...mapConfig.map,
                            layers: [
                                ...mapConfig.map.layers,
                                {
                                    id: `pk:${gnLayer.pk}`,
                                    pk: gnLayer.pk,
                                    type: 'wms',
                                    name: `${gnLayer.workspace}:${gnLayer.name}`,
                                    url: `${geoserverUrl}/ows`,
                                    format: 'image/png',
                                    ...(gnLayer.storeType === 'dataStore' && {
                                        search: {
                                            type: 'wfs',
                                            url: `${geonodeUrl}/gs/ows`
                                        }
                                    }),
                                    bbox,
                                    ...(gnLayer.featureinfo_custom_template && {
                                        featureInfo: {
                                            format: 'TEMPLATE',
                                            template: gnLayer.featureinfo_custom_template
                                        }
                                    }),
                                    style: '',
                                    title: gnLayer.title,
                                    visibility: true
                                }
                            ]
                        }
                    }),
                    zoomToExtent(extent, 'EPSG:4326'),
                    setResource(gnLayer)
                );
            }).catch(() => {
                // TODO: implement various error cases
                return Observable.empty();
            });
        });

export const gnViewerRequestMapConfig = (action$) =>
    action$.ofType(REQUEST_MAP_CONFIG)
        .switchMap(({ pk }) => {
            return Observable.defer(() => axios.all([
                getMapStoreMapById(pk)
            ])).switchMap((response) => {
                const [adapterMap] = response;
                return Observable.of(
                    configureMap(adapterMap.data)// ,
                    // setResource(gnLayer)
                );
            }).catch(() => {
                // TODO: implement various error cases
                return Observable.empty();
            });
        });

export const gnViewerRequestGeoStoryConfig = (action$) =>
    action$.ofType(REQUEST_GEOSTORY_CONFIG)
        .switchMap(({ pk }) => {
            return Observable.defer(() => axios.all([
                getGeoStoryByPk(pk)
            ])).switchMap((response) => {
                const [gnGeoStory] = response;
                const { data, ...resource } = gnGeoStory;
                return Observable.of(
                    setCurrentStory(data),
                    setResource(resource)
                );
            }).catch(() => {
                // TODO: implement various error cases
                return Observable.empty();
            });
        });

export const gnViewerRequestDocumentConfig = (action$) =>
    action$.ofType(REQUEST_DOCUMENT_CONFIG)
        .switchMap(({ pk }) => {
            return Observable.defer(() => axios.all([
                getDocumentByPk(pk)
            ])).switchMap((response) => {
                const [gnDocument] = response;
                return Observable.of(
                    setResource(gnDocument)
                );
            }).catch(() => {
                // TODO: implement various error cases
                return Observable.empty();
            });
        });

export default {
    gnViewerRequestLayerConfig,
    gnViewerRequestMapConfig,
    gnViewerRequestGeoStoryConfig,
    gnViewerRequestDocumentConfig
};
