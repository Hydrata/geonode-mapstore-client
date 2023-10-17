/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import gnsearch from '@js/reducers/gnsearch';
import {
    setFacetItems
} from '@js/actions/gnsearch';

describe('gnsearch reducer', () => {
    it('should test setFacetItems', () => {
        const facetItems = ["1", "2"];
        const state = gnsearch({}, setFacetItems(facetItems));

        expect(state).toEqual({
            facetItems
        });
    });
});
