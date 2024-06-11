/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';
import { testEpic } from '@mapstore/framework/epics/__tests__/epicTestUtils';
import {
    gnGetFacetItems
} from '@js/epics/gnsearch';
import {
    getFacetItems,
    GET_FACET_FILTERS
} from '@js/actions/gnsearch';

let mockAxios;

describe('gnsearch epics', () => {
    beforeEach(done => {
        global.__DEVTOOLS__ = true;
        mockAxios = new MockAdapter(axios);
        setTimeout(done);
    });
    afterEach(done => {
        delete global.__DEVTOOLS__;
        mockAxios.restore();
        setTimeout(done);
    });
    it('gnGetFacetItems', (done) => {
        const NUM_ACTIONS = 1;
        const testState = {
            gnresource: {}
        };
        const facets = ["1", "2"];
        mockAxios.onGet().reply(() => [200, {facets}]);

        testEpic(
            gnGetFacetItems,
            NUM_ACTIONS,
            getFacetItems(),
            (actions) => {
                try {
                    expect(actions.map(({ type }) => type))
                        .toEqual([
                            GET_FACET_FILTERS
                        ]);
                } catch (e) {
                    done(e);
                }
                done();
            },
            testState
        );
    });
});
