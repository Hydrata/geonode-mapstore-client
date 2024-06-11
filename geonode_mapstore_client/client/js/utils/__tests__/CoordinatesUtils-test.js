
/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import {
    bboxToExtent,
    getExtent,
    getAdjustedExtent
} from '../CoordinatesUtils';

describe('Test Coordinates Utils', () => {
    it('should keep the wms params from the url if available', () => {
        const _bbox = {
            bounds: {minx: -10, miny: -10, maxx: 10, maxy: 10},
            crs: 'EPSG:4326'
        };
        const {bbox} = bboxToExtent(_bbox, 'EPSG:4326');
        const {coords, srid} = bbox;
        expect(srid).toBe('EPSG:4326');
        expect(coords).toEqual([-10, -10, 10, 10]);
    });

    it('should get extent from Bbox', () => {
        const layers = [{
            isDataset: true,
            bbox: {
                bounds: { minx: -10, miny: -10, maxx: 10, maxy: 10 },
                crs: 'EPSG:4326'
            }
        }];

        expect(getExtent({ layers, features: [] })).toEqual([-10, -10, 10, 10]);
    });

    it('getAdjustedExtent', () => {
        const bounds = [-180, -90, 180, 90];
        expect(getAdjustedExtent(bounds)).toNotEqual(bounds);

        // Not adjusted
        expect(getAdjustedExtent(bounds, "EPSG:4326", "EPSG:2145")).toEqual(bounds);
        expect(getAdjustedExtent([])).toEqual([]);
    });
});
