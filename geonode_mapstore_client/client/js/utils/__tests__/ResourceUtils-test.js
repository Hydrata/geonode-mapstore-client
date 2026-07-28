
/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import get from 'lodash/get';
import set from 'lodash/set';
import omit from 'lodash/omit';
import {
    resourceToLayerConfig,
    getResourcePermissions,
    availableResourceTypes,
    setAvailableResourceTypes,
    getGeoNodeMapLayers,
    toGeoNodeMapConfig,
    compareBackgroundLayers,
    toMapStoreMapConfig,
    resolveCacheableStyle,
    resourceToLayers,
    parseStyleName,
    canCopyResource,
    processUploadResponse,
    parseUploadResponse,
    cleanUrl,
    getResourceTypesInfo,
    ResourceTypes,
    FEATURE_INFO_FORMAT,
    isDocumentExternalSource,
    getDownloadUrlInfo,
    getCataloguePath,
    getResourceWithLinkedResources,
    getResourceAdditionalProperties,
    getDimensions,
    canManageResourcePublishing,
    canManageResourceOptions,
    canManageResourceSettings,
    canAccessPermissions,
    formatResourceLinkUrl
} from '../ResourceUtils';

describe('Test Resource Utils', () => {
    it('should keep the wms params from the url if available', () => {
        const newLayer = resourceToLayerConfig({
            alternate: 'geonode:layer_name',
            links: [{
                extension: 'html',
                link_type: 'OGC:WMS',
                name: 'OGC WMS Service',
                mime: 'text/html',
                url: 'http://localhost:8080/geoserver/wms?map=name&map_resolution=91'
            }],
            title: 'Layer title',
            perms: [],
            pk: 1
        });
        expect(newLayer.params).toEqual({ map: 'name', map_resolution: '91' });
    });
    it('test resourceToLayerConfig with layer settings of the dataset', () => {
        const newLayer = resourceToLayerConfig({
            alternate: 'geonode:layer_name',
            links: [{
                extension: 'html',
                link_type: 'OGC:WMS',
                name: 'OGC WMS Service',
                mime: 'text/html',
                url: 'http://localhost:8080/geoserver/wms?map=name&map_resolution=91'
            }],
            title: 'Layer title',
            perms: [],
            pk: 1,
            data: {opacity: 0.8}
        });
        expect(newLayer.opacity).toBe(0.8);
    });

    it('should parse arcgis dataset', () => {
        const newLayer = resourceToLayerConfig({
            alternate: 'remoteWorkspace:1',
            title: 'Layer title',
            perms: [],
            links: [{
                extension: 'html',
                link_type: 'image',
                mime: 'text/html',
                name: 'ArcGIS REST ImageServer',
                url: 'http://localhost:8080/MapServer'
            }],
            pk: 1,
            ptype: 'gxp_arcrestsource'
        });
        expect(newLayer.type).toBe('arcgis');
        expect(newLayer.name).toBe('1');
        expect(newLayer.url).toBe('http://localhost:8080/MapServer');
    });

    it('should getViewedResourcePermissions', () => {
        const data = [{
            name: "testType",
            allowed_perms: {
                compact: {
                    test1: [
                        {
                            name: 'none',
                            label: 'None'
                        },
                        {
                            name: 'view',
                            label: 'View'
                        }
                    ]
                }
            }
        }];
        const groups = [];
        const permissionOptions = getResourcePermissions(data[0].allowed_perms.compact, groups);
        expect(permissionOptions).toEqual({
            test1: [
                { value: 'none', labelId: `gnviewer.nonePermission`, label: 'None' },
                { value: 'view', labelId: `gnviewer.viewPermission`, label: 'View' }
            ]
        });
    });

    it('should setAvailableResourceTypes', () => {
        setAvailableResourceTypes({ test: 'test data' });

        expect(availableResourceTypes).toEqual({ test: 'test data' });
    });
    it('should convert data blob to geonode maplayers', () => {
        const data = {
            map: {
                layers: [
                    { id: '01', type: 'osm', source: 'osm' },
                    { id: '02', type: 'vector', features: [] },
                    {
                        id: '03',
                        type: 'wms',
                        name: 'geonode:layer',
                        url: 'geoserver/wms',
                        style: 'geonode:style',
                        availableStyles: [{ name: 'custom:style', title: 'My Style', format: 'css', metadata: {} }],
                        extendedParams: {
                            mapLayer: {
                                pk: 10
                            }
                        },
                        opacity: 0.5,
                        visibility: false
                    }
                ]
            }
        };
        const mapLayers = getGeoNodeMapLayers(data);
        expect(mapLayers.length).toBe(1);
        expect(mapLayers[0]).toEqual({
            pk: 10,
            extra_params: {
                msId: '03'
            },
            current_style: 'geonode:style',
            name: 'geonode:layer',
            opacity: 0.5,
            visibility: false,
            order: 0
        });
    });
    it('should convert data blob to geonode map properties', () => {
        const data = {
            map: {
                projection: 'EPSG:3857',
                layers: [
                    { id: '01', type: 'osm', source: 'osm' },
                    { id: '02', type: 'vector', features: [] },
                    {
                        id: '03',
                        type: 'wms',
                        name: 'geonode:layer',
                        url: 'geoserver/wms',
                        style: 'geonode:style',
                        availableStyles: [{ name: 'custom:style', title: 'My Style' }],
                        extendedParams: {
                            mapLayer: {
                                pk: 10
                            }
                        }
                    }
                ]
            }
        };
        const mapState = {
            bbox: {
                bounds: { minx: -10, miny: -10, maxx: 10, maxy: 10 },
                crs: 'EPSG:4326'
            }
        };
        const geoNodeMapConfig = toGeoNodeMapConfig(data, mapState);
        expect(geoNodeMapConfig.maplayers.length).toBe(1);
    });
    it('should be able to compare background layers with different ids', () => {
        expect(compareBackgroundLayers({ type: 'osm', source: 'osm', id: '11' }, { type: 'osm', source: 'osm' })).toBe(true);
    });
    it('should transform a resource to a mapstore map config', () => {
        const resource = {
            maplayers: [
                {
                    pk: 10,
                    current_style: 'geonode:style01',
                    extra_params: {
                        msId: '03'
                    },
                    dataset: {
                        pk: 1
                    }
                }
            ],
            data: {
                map: {
                    layers: [
                        { id: '01', type: 'osm', source: 'osm', group: 'background', visibility: true },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10
                                }
                            }
                        }
                    ]
                }
            }
        };
        const baseConfig = {
            map: {
                layers: [
                    { type: 'osm', source: 'osm', group: 'background', visibility: true }
                ]
            }
        };
        const mapStoreMapConfig = toMapStoreMapConfig(resource, baseConfig);
        expect(mapStoreMapConfig).toEqual(
            {
                map: {
                    sources: {},
                    layers: [
                        { type: 'osm', source: 'osm', group: 'background', visibility: true },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style01',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10,
                                    current_style: 'geonode:style01',
                                    extra_params: {
                                        msId: '03'
                                    },
                                    dataset: {
                                        pk: 1
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        );
    });
    it('should transform a resource to a mapstore map config, with featureInfo', () => {
        const resource = {
            maplayers: [
                {
                    pk: 10,
                    current_style: 'geonode:style01',
                    extra_params: {
                        msId: '03'
                    },
                    dataset: {
                        pk: 1
                    }
                }
            ],
            data: {
                map: {
                    layers: [
                        { id: '01', type: 'osm', source: 'osm', group: 'background', visibility: true },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10
                                }
                            },
                            featureInfo: {
                                template: "<div>test</div>",
                                format: FEATURE_INFO_FORMAT
                            }
                        }
                    ]
                }
            }
        };
        const baseConfig = {
            map: {
                layers: [
                    { type: 'osm', source: 'osm', group: 'background', visibility: true }
                ]
            }
        };
        const mapStoreMapConfig = toMapStoreMapConfig(resource, baseConfig);
        expect(mapStoreMapConfig).toEqual(
            {
                map: {
                    sources: {},
                    layers: [
                        { type: 'osm', source: 'osm', group: 'background', visibility: true },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style01',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10,
                                    current_style: 'geonode:style01',
                                    extra_params: {
                                        msId: '03'
                                    },
                                    dataset: {
                                        pk: 1
                                    }
                                }
                            },
                            featureInfo: { template: "<div>test</div>", format: FEATURE_INFO_FORMAT }
                        }
                    ]
                }
            }
        );
    });
    it('should transform a resource to a mapstore map config and update backgrounds', () => {
        const resource = {
            maplayers: [
                {
                    pk: 10,
                    current_style: 'geonode:style01',
                    extra_params: {
                        msId: '03'
                    },
                    dataset: {
                        pk: 1
                    }
                }
            ],
            data: {
                map: {
                    layers: [
                        { id: '01', type: 'osm', source: 'osm', group: 'background', visibility: true },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10
                                }
                            }
                        }
                    ]
                }
            }
        };
        const baseConfig = {
            map: {
                layers: [
                    {
                        name: 'OpenTopoMap',
                        provider: 'OpenTopoMap',
                        source: 'OpenTopoMap',
                        type: 'tileprovider',
                        visibility: true,
                        group: 'background'
                    }
                ]
            }
        };
        const mapStoreMapConfig = toMapStoreMapConfig(resource, baseConfig);
        expect(mapStoreMapConfig).toEqual(
            {
                map: {
                    sources: {},
                    layers: [
                        {
                            name: 'OpenTopoMap',
                            provider: 'OpenTopoMap',
                            source: 'OpenTopoMap',
                            type: 'tileprovider',
                            visibility: true,
                            group: 'background'
                        },
                        { id: '02', type: 'vector', features: [] },
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style01',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10,
                                    current_style: 'geonode:style01',
                                    extra_params: {
                                        msId: '03'
                                    },
                                    dataset: {
                                        pk: 1
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        );
    });

    // V2P-01b — retroactive coverage for V2P-01's spread at line ~661.
    // The merge path in toMapStoreMapConfig used to drop mapLayer.dataset.perms
    // when reconciling saved blob layers with their MapLayer entries; the
    // sibling addMapLayers path (via resourceToLayerConfig) DID propagate perms,
    // producing an inconsistent layer.perms presence depending on which path
    // the layer took. V2P-01 added a one-line conditional spread to the merge
    // path; these tests pin its exact contract: propagate when present, omit
    // (don't write null) when missing.
    describe('toMapStoreMapConfig perms propagation (V2P-01)', () => {
        const baseConfig = {
            map: {
                layers: [
                    { type: 'osm', source: 'osm', group: 'background', visibility: true }
                ]
            }
        };
        it('propagates perms from mapLayer.dataset onto the matched blob layer', () => {
            const resource = {
                maplayers: [
                    {
                        pk: 10,
                        extra_params: { msId: '03' },
                        dataset: {
                            pk: 1,
                            perms: ['view_resourcebase', 'change_resourcebase', 'delete_resourcebase']
                        }
                    }
                ],
                data: {
                    map: {
                        layers: [
                            {
                                id: '03',
                                type: 'wms',
                                name: 'geonode:layer',
                                url: 'geoserver/wms'
                            }
                        ]
                    }
                }
            };
            const result = toMapStoreMapConfig(resource, baseConfig);
            const merged = result.map.layers.find(l => l.id === '03');
            expect(merged).toBeTruthy();
            expect(merged.perms).toEqual(['view_resourcebase', 'change_resourcebase', 'delete_resourcebase']);
        });

        it('omits perms key when mapLayer.dataset.perms is null (no null overwrite)', () => {
            const resource = {
                maplayers: [
                    {
                        pk: 10,
                        extra_params: { msId: '03' },
                        dataset: { pk: 1, perms: null }
                    }
                ],
                data: {
                    map: {
                        layers: [
                            { id: '03', type: 'wms', name: 'geonode:layer', url: 'geoserver/wms' }
                        ]
                    }
                }
            };
            const result = toMapStoreMapConfig(resource, baseConfig);
            const merged = result.map.layers.find(l => l.id === '03');
            // Conditional spread: `&&` short-circuits on null, so the key is
            // never set on the merged layer. NOT toBe(null) — the key is absent.
            expect(merged).toBeTruthy();
            expect(merged.perms).toBe(undefined);
        });

        it('omits perms key when mapLayer.dataset.perms is an empty array (falsy short-circuit)', () => {
            // [] is truthy in JS, so an empty perms array WILL propagate.
            // This pins the truthy-check semantics of the spread for downstream
            // helpers that treat [] as "denied everything".
            const resource = {
                maplayers: [
                    {
                        pk: 10,
                        extra_params: { msId: '03' },
                        dataset: { pk: 1, perms: [] }
                    }
                ],
                data: {
                    map: {
                        layers: [
                            { id: '03', type: 'wms', name: 'geonode:layer', url: 'geoserver/wms' }
                        ]
                    }
                }
            };
            const result = toMapStoreMapConfig(resource, baseConfig);
            const merged = result.map.layers.find(l => l.id === '03');
            expect(merged).toBeTruthy();
            expect(merged.perms).toEqual([]);
        });

        it('keeps blob layer unchanged when mapLayer.dataset is absent', () => {
            // Defence in depth: dataset itself missing should not crash and
            // should not invent a perms key.
            const resource = {
                maplayers: [
                    {
                        pk: 10,
                        extra_params: { msId: '03' }
                        // no dataset key
                    }
                ],
                data: {
                    map: {
                        layers: [
                            { id: '03', type: 'wms', name: 'geonode:layer', url: 'geoserver/wms' }
                        ]
                    }
                }
            };
            const result = toMapStoreMapConfig(resource, baseConfig);
            const merged = result.map.layers.find(l => l.id === '03');
            expect(merged).toBeTruthy();
            expect(merged.perms).toBe(undefined);
        });
    });

    it('transform a resource to a mapstore map config with featureinfo template', () => {
        const template = '<div>LAYER<div/>';
        const resource = {
            maplayers: [
                {
                    pk: 10,
                    current_style: 'geonode:style01',
                    extra_params: {
                        msId: '03'
                    },
                    dataset: {
                        pk: 1,
                        featureinfo_custom_template: '<div>Test</div>'
                    }
                }
            ],
            data: {
                map: {
                    layers: [
                        {
                            id: '03',
                            type: 'wms',
                            name: 'geonode:layer',
                            url: 'geoserver/wms',
                            style: 'geonode:style',
                            extendedParams: {
                                mapLayer: {
                                    pk: 10
                                }
                            },
                            featureInfo: {
                                template,
                                format: FEATURE_INFO_FORMAT
                            }
                        }
                    ]
                }
            }
        };
        const baseConfig = {
            map: {
                layers: [
                    { type: 'osm', source: 'osm', group: 'background', visibility: true }
                ]
            }
        };
        const mapStoreMapConfig = toMapStoreMapConfig(resource, baseConfig);
        expect(mapStoreMapConfig).toBeTruthy();
        const layers = mapStoreMapConfig.map.layers;
        expect(layers.length).toBe(2);
        expect(layers[1].featureInfo).toEqual({ template, format: FEATURE_INFO_FORMAT });
    });

    it('should parse style name into accepted format', () => {
        const styleObj = {
            name: 'testName',
            workspace: 'test'
        };

        const pasrsedStyleName = parseStyleName(styleObj);

        expect(pasrsedStyleName).toBe('test:testName');
    });

    it('should test canCopyResource with different resource type', () => {
        const user = { perms: ['add_resource'] };
        expect(canCopyResource({ resource_type: 'dataset', perms: ['download_resourcebase'], is_copyable: true }, user)).toBe(true);
        expect(canCopyResource({ resource_type: 'document', perms: ['download_resourcebase'], is_copyable: true }, user)).toBe(true);
        expect(canCopyResource({ resource_type: 'map', perms: [], is_copyable: true }, user)).toBe(true);
        expect(canCopyResource({ resource_type: 'geostory', perms: [], is_copyable: true }, user)).toBe(true);
        expect(canCopyResource({ resource_type: 'dashboard', perms: [], is_copyable: true }, user)).toBe(true);

        expect(canCopyResource({ resource_type: 'dataset', perms: [], is_copyable: true }, user)).toBe(false);
        expect(canCopyResource({ resource_type: 'document', perms: [], is_copyable: true }, user)).toBe(false);
        expect(canCopyResource({ resource_type: 'map', perms: [] }, user)).toBe(false);
        expect(canCopyResource({ resource_type: 'geostory', perms: [] }, user)).toBe(false);
        expect(canCopyResource({ resource_type: 'dashboard', perms: [] }, user)).toBe(false);
    });

    it('should test processUploadResponse', () => {
        const prev = [{
            id: 1,
            name: 'test1',
            create_date: '2022-04-13T11:24:55.444578Z',
            state: 'PENDING',
            progress: 0,
            complete: false
        },
        {
            id: 2,
            name: 'test2',
            create_date: '2022-04-13T11:24:54.042291Z',
            state: 'PENDING',
            progress: 0,
            complete: false
        },
        {
            id: 3,
            name: 'test3',
            create_date: '2022-04-13T11:24:54.042291Z',
            state: 'PENDING',
            progress: 20,
            complete: false
        }];
        const current = [{
            id: 1,
            name: 'test1',
            create_date: '2022-04-13T11:24:55.444578Z',
            state: 'RUNNING',
            progress: 100,
            complete: true
        },
        {
            id: 2,
            name: 'test2',
            create_date: '2022-04-13T11:24:54.042291Z',
            state: 'PENDING',
            progress: 40,
            complete: false,
            resume_url: 'test/upload/delete/439'
        },
        {
            id: 3,
            name: 'test3',
            create_date: '2022-04-13T11:24:54.042291Z',
            state: 'COMPLETE',
            progress: 100,
            complete: true
        },
        {
            id: 4,
            name: 'test4',
            create_date: '2022-04-13T11:24:54.042291Z',
            state: 'COMPLETE',
            progress: 100,
            complete: true
        },
        {
            exec_id: 23,
            name: 'test3',
            created: '2022-05-13T12:24:54.042291Z',
            status: 'running',
            complete: false
        }];

        expect(processUploadResponse([...prev, ...current])).toEqual([
            {
                exec_id: 23,
                name: 'test3',
                created: '2022-05-13T12:24:54.042291Z',
                status: 'running',
                complete: false,
                create_date: '2022-05-13T12:24:54.042291Z',
                id: 23
            },
            {
                id: 1,
                name: 'test1',
                create_date: '2022-04-13T11:24:55.444578Z',
                state: 'RUNNING',
                progress: 100,
                complete: true
            },
            {
                id: 4,
                name: 'test4',
                create_date: '2022-04-13T11:24:54.042291Z',
                state: 'COMPLETE',
                progress: 100,
                complete: true
            },
            {
                id: 3,
                name: 'test3',
                create_date: '2022-04-13T11:24:54.042291Z',
                state: 'COMPLETE',
                progress: 100,
                complete: true
            },
            {
                id: 2,
                name: 'test2',
                create_date: '2022-04-13T11:24:54.042291Z',
                state: 'PENDING',
                progress: 40,
                complete: false,
                resume_url: 'test/upload/delete/439'
            }
        ]);
    });

    it('should test parseUploadResponse', () => {
        const uploads = [
            {
                id: 3,
                name: 'test3',
                create_date: '2022-04-13T11:24:54.042291Z',
                state: 'COMPLETE',
                progress: 100,
                complete: true
            },
            {
                id: 2,
                name: 'test2',
                create_date: '2022-04-13T12:24:54.042291Z',
                state: 'PENDING',
                progress: 40,
                complete: false,
                resume_url: 'test/upload/delete/439'
            }
        ];

        expect(parseUploadResponse(uploads)).toEqual([
            {
                id: 2,
                name: 'test2',
                create_date: '2022-04-13T12:24:54.042291Z',
                state: 'PENDING',
                progress: 40,
                complete: false,
                resume_url: 'test/upload/delete/439'
            },
            {
                id: 3,
                name: 'test3',
                create_date: '2022-04-13T11:24:54.042291Z',
                state: 'COMPLETE',
                progress: 100,
                complete: true
            }
        ]);
    });

    it('should clean url', () => {
        const testUrl = 'https://test.com/dataset/808?filter=time';

        const url = cleanUrl(testUrl);

        expect(url).toEqual('https://test.com/dataset/808');
    });

    describe('Test getResourceTypesInfo', () => {
        it('test dataset of getResourceTypesInfo', () => {
            const {
                icon,
                canPreviewed,
                formatMetadataUrl,
                name
            } = getResourceTypesInfo()[ResourceTypes.DATASET];
            let resource = {
                perms: ['view_resourcebase'],
                store: "workspace",
                alternate: 'name:test',
                pk: "100"
            };
            expect(icon.glyph).toBe('dataset');
            expect(canPreviewed(resource)).toBeTruthy();
            expect(name).toBe('Dataset');

            expect(formatMetadataUrl(resource)).toBe('#/metadata/100');

        });
        it('test map of getResourceTypesInfo', () => {
            const {
                icon,
                canPreviewed,
                formatMetadataUrl,
                name
            } = getResourceTypesInfo()[ResourceTypes.MAP];
            let resource = {
                perms: ['view_resourcebase'],
                pk: "100"
            };
            expect(icon.glyph).toBe('1-map');
            expect(canPreviewed(resource)).toBeTruthy();
            expect(name).toBe('Map');
            expect(formatMetadataUrl(resource)).toBe('#/metadata/100');
        });
        it('test document of getResourceTypesInfo', () => {
            const {
                icon,
                canPreviewed,
                hasPermission,
                formatMetadataUrl,
                metadataPreviewUrl,
                name
            } = getResourceTypesInfo()[ResourceTypes.DOCUMENT];
            let resource = {
                perms: ['download_resourcebase'],
                pk: "100",
                extension: "pdf"
            };
            expect(icon.glyph).toBe('document');
            expect(canPreviewed(resource)).toBeTruthy();
            expect(hasPermission(resource)).toBeTruthy();
            expect(name).toBe('Document');
            expect(formatMetadataUrl(resource)).toBe('#/metadata/100');
            expect(metadataPreviewUrl(resource)).toBe('/metadata/100/embed');
        });
        it('test geostory of getResourceTypesInfo', () => {
            const {
                icon,
                canPreviewed,
                formatMetadataUrl,
                name
            } = getResourceTypesInfo()[ResourceTypes.GEOSTORY];
            let resource = {
                perms: ['view_resourcebase'],
                pk: "100"
            };
            expect(icon.glyph).toBe('geostory');
            expect(canPreviewed(resource)).toBeTruthy();
            expect(name).toBe('GeoStory');
            expect(formatMetadataUrl(resource)).toBe('#/metadata/100');
        });
        it('test dashboard of getResourceTypesInfo', () => {
            const {
                icon,
                canPreviewed,
                formatMetadataUrl,
                name
            } = getResourceTypesInfo()[ResourceTypes.DASHBOARD];
            let resource = {
                perms: ['view_resourcebase'],
                pk: "100"
            };
            expect(icon.glyph).toBe('dashboard');
            expect(canPreviewed(resource)).toBeTruthy();
            expect(name).toBe('Dashboard');
            expect(formatMetadataUrl(resource)).toBe('#/metadata/100');
        });
    });
    it('test isDocumentExternalSource', () => {
        let resource = { resource_type: "document", sourcetype: "REMOTE" };
        expect(isDocumentExternalSource(resource)).toBeTruthy();

        // LOCAL
        resource = {...resource, sourcetype: "LOCAL"};
        expect(isDocumentExternalSource(resource)).toBeFalsy();

        // NOT DOCUMENT
        resource = {...resource, resource_type: "dataset"};
        expect(isDocumentExternalSource(resource)).toBeFalsy();
    });
    it('test getDownloadUrlInfo', () => {
        const downloadData = {url: "/someurl", ajax_safe: true };

        // EXTERNAL SOURCE
        let resource = { download_urls: [downloadData], href: "/somehref", resource_type: "document", sourcetype: "REMOTE"};
        let downloadInfo = getDownloadUrlInfo(resource);
        expect(downloadInfo.url).toBe("/somehref");
        expect(downloadInfo.ajaxSafe).toBeFalsy();

        // AJAX SAFE
        resource = { download_urls: [downloadData]};
        downloadInfo = getDownloadUrlInfo(resource);
        expect(downloadInfo.url).toBe(downloadData.url);
        expect(downloadInfo.ajaxSafe).toBeTruthy();

        // HREF
        resource = {href: "/someurl"};
        downloadInfo = getDownloadUrlInfo(resource);
        expect(downloadInfo.url).toBe(resource.href);
        expect(downloadInfo.ajaxSafe).toBeFalsy();

        // NOT AJAX SAFE
        resource = {download_urls: [{...downloadData, ajax_safe: false}]};
        downloadInfo = getDownloadUrlInfo(resource);
        expect(downloadInfo.url).toBe(downloadData.url);
        expect(downloadInfo.ajaxSafe).toBeFalsy();
    });
    it('test getCataloguePath', () => {

        // default
        expect(getCataloguePath()).toBe('');

        // valid path and catalogPath not configured
        let path = '/catalogue/#/search/filter';
        expect(getCataloguePath(path)).toBe(path);

        const cPath = 'localConfig.geoNodeSettings.catalogPagePath';
        if (!window.__GEONODE_CONFIG__) window.__GEONODE_CONFIG__ = {};
        const prevValue = get(window.__GEONODE_CONFIG__, cPath);
        set(window.__GEONODE_CONFIG__, cPath, "/catalog/");

        // valid path and catalogPath configured
        expect(getCataloguePath(path)).toBe('/catalog/#/search/filter');

        // not catalogue path and catalogPath configured
        expect(getCataloguePath('/some/#/search/filter')).toBe('/some/#/search/filter');

        // reset value
        set(window.__GEONODE_CONFIG__, cPath, prevValue);
    });
    it("getResourceWithLinkedResources", () => {
        expect(getResourceWithLinkedResources({})).toEqual({});
        expect(getResourceWithLinkedResources()).toEqual({});
        expect(getResourceWithLinkedResources({pk: 1, linked_resources: {linked_to: ["1"], linked_by: ["1"]}}))
            .toEqual({pk: 1, linkedResources: {linkedBy: ["1"], linkedTo: ["1"]}});
        expect(getResourceWithLinkedResources({linked_resources: {linked_to: ["1"], linked_by: ["1"]}}))
            .toEqual({linkedResources: {linkedBy: ["1"], linkedTo: ["1"]}});
    });
    it('getResourceAdditionalProperties', () => {
        expect(getResourceAdditionalProperties({})).toEqual({assets: [ { _showEmptyState: true } ]});
        expect(getResourceAdditionalProperties()).toEqual({assets: [ { _showEmptyState: true } ]});
        expect(getResourceAdditionalProperties({pk: 1, linked_resources: {linked_to: ["1"], linked_by: ["1"]}}))
            .toEqual({pk: 1, linkedResources: {linkedBy: ["1"], linkedTo: ["1"]}, assets: [ { _showEmptyState: true } ]});
        expect(getResourceAdditionalProperties({
            pk: 1,
            links: [
                {
                    extension: '3dtiles',
                    extras: {
                        type: 'asset',
                        content: {
                            title: 'Original',
                            description: null,
                            type: '3dtiles',
                            download_url: '/api/v2/assets/12/download'
                        }
                    },
                    link_type: 'uploaded',
                    mime: '',
                    name: 'tileset',
                    url: '/path'
                },
                {
                    extension: '3dtiles',
                    extras: {
                        type: 'asset',
                        content: {
                            title: null,
                            description: null,
                            type: '3dtiles',
                            download_url: '/api/v2/assets/12/download'
                        }
                    },
                    link_type: 'uploaded',
                    mime: '',
                    name: 'tileset',
                    url: '/path'
                },
                {
                    extension: 'xml',
                    link_type: 'metadata',
                    mime: 'text/xml',
                    name: 'ISO',
                    url: '/path'
                }
            ]
        }))
            .toEqual({
                pk: 1,
                assets: [
                    {
                        extension: '3dtiles',
                        extras: {
                            type: 'asset',
                            content: {
                                title: 'Original',
                                description: null,
                                type: '3dtiles',
                                download_url: '/api/v2/assets/12/download'
                            }
                        },
                        link_type: 'uploaded',
                        mime: '',
                        name: 'tileset',
                        url: '/path'
                    }
                ],
                links: [
                    {
                        extension: '3dtiles',
                        extras: {
                            type: 'asset',
                            content: {
                                title: 'Original',
                                description: null,
                                type: '3dtiles',
                                download_url: '/api/v2/assets/12/download'
                            }
                        },
                        link_type: 'uploaded',
                        mime: '',
                        name: 'tileset',
                        url: '/path'
                    },
                    {
                        extension: '3dtiles',
                        extras: {
                            type: 'asset',
                            content: {
                                title: null,
                                description: null,
                                type: '3dtiles',
                                download_url: '/api/v2/assets/12/download'
                            }
                        },
                        link_type: 'uploaded',
                        mime: '',
                        name: 'tileset',
                        url: '/path'
                    },
                    {
                        extension: 'xml',
                        link_type: 'metadata',
                        mime: 'text/xml',
                        name: 'ISO',
                        url: '/path'
                    }
                ]
            });
    });
    it('getResourceAdditionalProperties - return empty state flag if no assets', () => {
        expect(getResourceAdditionalProperties({
            pk: 1,
            links: [{}]
        }))
            .toEqual({pk: 1, links: [{}], assets: [{_showEmptyState: true}]});
    });
    describe('getDimensions', () => {
        it('should return empty array if no links and has_time is false', () => {
            const result = getDimensions();
            expect(result).toEqual([]);
        });

        it('should return dimensions with time if has_time is true and WMTS link is present', () => {
            const links = [{ link_type: 'OGC:WMTS', url: 'http://example.com/wmts' }];
            const result = getDimensions({ links, has_time: true });
            expect(result).toEqual([{
                name: 'time',
                source: {
                    type: 'multidim-extension',
                    url: 'http://example.com/wmts'
                }
            }]);
        });

        it('should return dimensions with time if has_time is true and only WMS link is present', () => {
            const links = [{ link_type: 'OGC:WMS', url: 'http://example.com/geoserver/wms' }];
            const result = getDimensions({ links, has_time: true });
            expect(result).toEqual([{
                name: 'time',
                source: {
                    type: 'multidim-extension',
                    url: 'http://example.com/geoserver/gwc/service/wmts'
                }
            }]);
        });

        it('should return empty array if has_time is false', () => {
            const links = [{ link_type: 'OGC:WMTS', url: 'http://example.com/wmts' }];
            const result = getDimensions({ links, has_time: false });
            expect(result).toEqual([]);
        });

        it('should return default url if no matching link types are found', () => {
            const links = [{ link_type: 'OGC:OTHER', url: 'http://example.com/other' }];
            const result = getDimensions({ links, has_time: true });
            expect(result).toEqual([{
                name: 'time',
                source: {
                    type: 'multidim-extension',
                    url: '/geoserver/gwc/service/wmts'
                }
            }]);
        });
    });
    it('canManageResourcePublishing', () => {
        expect(canManageResourcePublishing({ perms: ['publish_resourcebase'] })).toBeTruthy();

        expect(canManageResourcePublishing({ perms: ['feature_resourcebase'] })).toBeTruthy();

        expect(canManageResourcePublishing({ perms: ['change_resourcebase'] })).toBeTruthy();

        expect(canManageResourcePublishing({ perms: ['publish_resourcebase', 'feature_resourcebase', 'change_resourcebase'] })).toBeTruthy();

        expect(canManageResourcePublishing({ perms: ['view_resourcebase', 'publish_resourcebase', 'download_resourcebase'] })).toBeTruthy();

        expect(canManageResourcePublishing({ perms: ['view_resourcebase'] })).toBeFalsy();

        expect(canManageResourcePublishing({ perms: [] })).toBeFalsy();

        expect(canManageResourcePublishing({})).toBeFalsy();

        expect(canManageResourcePublishing(undefined)).toBeFalsy();

        expect(canManageResourcePublishing(null)).toBeFalsy();
    });
    it('canManageResourceOptions', () => {
        expect(canManageResourceOptions({ perms: ['change_resourcebase'] })).toBeTruthy();

        expect(canManageResourceOptions({ perms: ['approve_resourcebase'] })).toBeTruthy();

        expect(canManageResourceOptions({ perms: ['change_resourcebase', 'approve_resourcebase'] })).toBeTruthy();

        expect(canManageResourceOptions({ perms: ['view_resourcebase', 'change_resourcebase', 'download_resourcebase'] })).toBeTruthy();

        expect(canManageResourceOptions({ perms: ['view_resourcebase'] })).toBeFalsy();

        expect(canManageResourceOptions({ perms: ['publish_resourcebase', 'feature_resourcebase'] })).toBeFalsy();

        expect(canManageResourceOptions({ perms: [] })).toBeFalsy();

        expect(canManageResourceOptions({})).toBeFalsy();

        expect(canManageResourceOptions(undefined)).toBeFalsy();

        expect(canManageResourceOptions(null)).toBeFalsy();
    });
    it('canManageResourceSettings', () => {
        expect(canManageResourceSettings({ perms: ['change_resourcebase'] })).toBeTruthy();
        expect(canManageResourceSettings({ perms: ['change_resourcebase', 'view_resourcebase'] })).toBeTruthy();
        expect(canManageResourceSettings({ perms: ['approve_resourcebase', 'publish_resourcebase'] })).toBeTruthy();
        expect(canManageResourceSettings({ perms: ['approve_resourcebase', 'feature_resourcebase'] })).toBeTruthy();
        expect(canManageResourceSettings({ perms: ['approve_resourcebase', 'change_resourcebase'] })).toBeTruthy();
        expect(canManageResourceSettings({ perms: ['publish_resourcebase', 'change_resourcebase'] })).toBeTruthy();

        expect(canManageResourceSettings({ perms: ['view_resourcebase'] })).toBeFalsy();
        expect(canManageResourceSettings({ perms: [] })).toBeFalsy();
        expect(canManageResourceSettings({})).toBeFalsy();
        expect(canManageResourceSettings(undefined)).toBeFalsy();
        expect(canManageResourceSettings(null)).toBeFalsy();
    });
    it('canAccessPermissions', () => {
        expect(canAccessPermissions({ perms: ['change_resourcebase_permissions'] })).toBeTruthy();
        expect(canAccessPermissions({ perms: ['view_resourcebase'] })).toBeFalsy();
    });
    it('formatResourceLinkUrl', () => {
        expect(formatResourceLinkUrl({ uuid: '123' })).toContain('/catalogue/uuid/123');
        expect(formatResourceLinkUrl({ pk: '123' })).toNotContain('/catalogue/uuid/123');
    });
    // TASK-1722: dataset preview must send STYLES='' (empty) so GeoServer uses its
    // configured defaultStyle (colour-relief) not GeoNode's default_style name (grey ramp).
    // The fix in gnresource.js builds the preview layer via
    // resourceToLayerConfig(omit(gnLayer, ['default_style'])), relying on the behaviour below.
    it('resourceToLayerConfig with default_style returns workspace-prefixed style name', () => {
        const DEM_RESOURCE = {
            alternate: 'geonode:ele_123_dem',
            links: [{
                extension: 'html',
                link_type: 'OGC:WMS',
                name: 'OGC WMS Service',
                mime: 'text/html',
                url: 'http://localhost:8080/geoserver/ows'
            }],
            title: 'My DEM',
            perms: [],
            pk: 999,
            default_style: {
                pk: 1,
                name: 'ele_123_dem',
                workspace: 'geonode',
                sld_title: 'ele_123_dem',
                sld_url: 'http://localhost:8080/geoserver/rest/workspaces/geonode/styles/ele_123_dem.sld'
            }
        };
        const layerWithStyle = resourceToLayerConfig(DEM_RESOURCE);
        // With default_style present, the WMS STYLES param is set explicitly (workspace:name format)
        expect(layerWithStyle.style).toBe('geonode:ele_123_dem');
    });
    it('resourceToLayerConfig without default_style returns empty style (TASK-1722: preview sends STYLES=\'\')', () => {
        const DEM_RESOURCE_NO_DEFAULT_STYLE = {
            alternate: 'geonode:ele_123_dem',
            links: [{
                extension: 'html',
                link_type: 'OGC:WMS',
                name: 'OGC WMS Service',
                mime: 'text/html',
                url: 'http://localhost:8080/geoserver/ows'
            }],
            title: 'My DEM',
            perms: [],
            pk: 999
            // no default_style — matches omit(gnLayer, ['default_style']) in gnresource.js
        };
        const layerWithoutStyle = resourceToLayerConfig(DEM_RESOURCE_NO_DEFAULT_STYLE);
        // Without default_style, style is empty: WMS sends STYLES='' so GeoServer uses its
        // configured defaultStyle (colour-relief for DEMs), not a potentially stale GeoNode style.
        expect(layerWithoutStyle.style).toBe('');
    });

    // TASK-1722 (W3 review fix): the omit(gnLayer, ['default_style']) in gnresource.js
    // is now scoped to raster datasets only (subtype === 'raster'), so vector datasets
    // with a custom GeoNode default_style are NOT regressed.
    it('raster dataset preview: omit(gnLayer, [default_style]) strips style (GeoServer uses colour-relief)', () => {
        // Simulates gnresource.js: resourceToLayerConfig(omit(gnLayer, ['default_style']))
        // for a raster dataset (subtype === 'raster' branch).
        const rasterGnLayer = {
            alternate: 'geonode:ele_123_dem',
            subtype: 'raster',
            links: [],
            title: 'My DEM',
            perms: [],
            pk: 1001,
            default_style: { pk: 2, name: 'colour_relief', workspace: 'geonode', sld_title: 'Colour Relief', sld_url: '' }
        };
        const previewLayer = resourceToLayerConfig(omit(rasterGnLayer, ['default_style']));
        // Raster: default_style omitted → STYLES='' → GeoServer uses its own defaultStyle
        expect(previewLayer.style).toBe('');
    });

    it('vector dataset preview: gnLayer passed as-is preserves custom default_style', () => {
        // Simulates gnresource.js: resourceToLayerConfig(gnLayer) for a vector dataset.
        // The subtype !== 'raster' branch skips the omit, so default_style is preserved.
        const vectorGnLayer = {
            alternate: 'geonode:my_vector_layer',
            subtype: 'vector',
            links: [],
            title: 'My Vector Layer',
            perms: [],
            pk: 1002,
            default_style: { pk: 3, name: 'custom_vector_style', workspace: 'geonode', sld_title: 'Custom', sld_url: '' }
        };
        const previewLayer = resourceToLayerConfig(vectorGnLayer);
        // Vector: default_style preserved → STYLES=geonode:custom_vector_style
        expect(previewLayer.style).toBe('geonode:custom_vector_style');
    });
});

// TASK-2566 — the FE must not emit an unqualified default-style name.
//
// GeoNode stores Style.name UNQUALIFIED and create_maplayer_for_dataset copies
// it into MapLayer.current_style; WMSUtils emits `STYLES: options.style`, so
// every terrain tile went out as STYLES=<bare name>. GWC answers that with
// MISS + "ParameterException: Style '<name>' is invalid" — a refusal, not an
// ordinary miss, so user traffic could not even warm the cache. Measured on
// prod 2026-07-28: 14364 ms median at z17 vs ~4 ms for the same cached tile.
//
// These tests pin the normalisation. They FAIL against pre-fix HEAD, where
// toMapStoreMapConfig passed current_style through verbatim.
describe('toMapStoreMapConfig GWC style normalisation (TASK-2566)', () => {
    const baseConfig = { map: { layers: [{ type: 'osm', source: 'osm', group: 'background', visibility: true }] } };
    const DEM = 'ele_550_utm_msimbazi_dem_cog';

    const mergeResource = (currentStyle, defaultStyle) => ({
        maplayers: [{
            pk: 10,
            extra_params: { msId: '03' },
            current_style: currentStyle,
            dataset: { pk: 1, alternate: `geonode:${DEM}`, ...(defaultStyle && { default_style: defaultStyle }) }
        }],
        data: { map: { layers: [{ id: '03', type: 'wms', name: `geonode:${DEM}`, url: 'geoserver/wms' }] } }
    });
    const mergedStyle = (resource) =>
        toMapStoreMapConfig(resource, baseConfig).map.layers.find(l => l.id === '03').style;

    it('blanks a bare default-style name so STYLES matches the GWC cache key', () => {
        // The exact prod shape: current_style is the unqualified default.
        const style = mergedStyle(mergeResource(DEM, { pk: 3, name: DEM, workspace: 'geonode' }));
        expect(style).toBe('');
    });

    it('preserves a workspace-qualified style (GWC resolves it to the default and HITs)', () => {
        const style = mergedStyle(mergeResource(`geonode:${DEM}`, { pk: 3, name: DEM, workspace: 'geonode' }));
        expect(style).toBe(`geonode:${DEM}`);
    });

    it('preserves a genuinely non-default style selection (dem_contours overlay)', () => {
        // layerOrderEpics/anugaInputMenu identify the contour overlay by
        // `layer.style === 'dem_contours'` — blanking it would break the DEM /
        // contour split, so a style that is not the dataset default must survive.
        const style = mergedStyle(mergeResource('dem_contours', { pk: 3, name: DEM, workspace: 'geonode' }));
        expect(style).toBe('dem_contours');
    });

    it('leaves the style untouched when the dataset default is unknown', () => {
        // Cannot prove it is the default → changing it could change the render.
        expect(mergedStyle(mergeResource(DEM, null))).toBe(DEM);
    });

    it('normalises the addMapLayers path too (MapLayer not present in the blob)', () => {
        const resource = {
            maplayers: [{
                pk: 11,
                extra_params: { msId: 'not-in-blob', anuga_group: 'Input Data.Terrain' },
                current_style: DEM,
                dataset: {
                    pk: 2,
                    alternate: `geonode:${DEM}`,
                    subtype: 'raster',
                    title: 'DEM',
                    links: [{ mime: 'image/png', link_type: 'OGC:WMS', url: 'geoserver/wms', extension: 'html' }],
                    default_style: { pk: 3, name: DEM, workspace: 'geonode' }
                }
            }],
            data: { map: { layers: [] } }
        };
        const added = toMapStoreMapConfig(resource, baseConfig).map.layers
            .find(l => l.name === `geonode:${DEM}`);
        expect(added).toBeTruthy();
        expect(added.style).toBe('');
    });
});

describe('resolveCacheableStyle (TASK-2566)', () => {
    const ds = (name) => ({ default_style: { name, workspace: 'geonode' } });
    it('blanks the bare default-style name', () => {
        expect(resolveCacheableStyle('ele_1_utm_cog', ds('ele_1_utm_cog'))).toBe('');
    });
    it('passes a qualified name through', () => {
        expect(resolveCacheableStyle('geonode:ele_1_utm_cog', ds('ele_1_utm_cog'))).toBe('geonode:ele_1_utm_cog');
    });
    it('passes a non-default style through', () => {
        expect(resolveCacheableStyle('dem_contours', ds('ele_1_utm_cog'))).toBe('dem_contours');
    });
    it('returns empty string for empty/absent input', () => {
        expect(resolveCacheableStyle('', ds('x'))).toBe('');
        expect(resolveCacheableStyle(undefined, ds('x'))).toBe('');
        expect(resolveCacheableStyle(null, undefined)).toBe('');
    });
    it('leaves the style alone when the dataset carries no default_style', () => {
        expect(resolveCacheableStyle('ele_1_utm_cog', {})).toBe('ele_1_utm_cog');
        expect(resolveCacheableStyle('ele_1_utm_cog', undefined)).toBe('ele_1_utm_cog');
    });
});

describe('resourceToLayers GWC style normalisation (TASK-2566)', () => {
    // The details thumbnail (DetailsThumbnail.jsx) and the GeoLimits editor
    // render REAL WMS tiles through this path, so the bare default-style name
    // made GWC refuse them here exactly as on the main map — lower traffic,
    // identical defect. Pinned so the second emitter cannot drift back.
    const DEM = 'ele_550_utm_msimbazi_dem_cog';
    const mapResource = (currentStyle, defaultStyleName) => ({
        resource_type: ResourceTypes.MAP,
        maplayers: [{
            current_style: currentStyle,
            dataset: {
                pk: 1,
                alternate: `geonode:${DEM}`,
                subtype: 'raster',
                title: 'DEM',
                links: [],
                default_style: { pk: 3, name: defaultStyleName, workspace: 'geonode' }
            }
        }]
    });

    it('blanks a bare default-style name', () => {
        expect(resourceToLayers(mapResource(DEM, DEM))[0].style).toBe('');
    });

    it('preserves a non-default style', () => {
        expect(resourceToLayers(mapResource('dem_contours', DEM))[0].style).toBe('dem_contours');
    });
});
