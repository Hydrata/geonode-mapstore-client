/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';
import {
    creatMapStoreMap,
    updateMapStoreMap
} from '@js/api/geonode/adapter';

let mockAxios;

describe('GeoNode adapter api', () => {
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
    it('should post new configuration to mapstore rest (creatMapStoreMap)', (done) => {
        const mapConfiguration = {
            id: 1,
            attributes: [],
            data: {},
            name: 'Map'
        };
        mockAxios.onPost(/\/mapstore\/rest\/resources/)
            .reply((config) => {
                try {
                    expect(config.data).toBe(JSON.stringify(mapConfiguration));
                } catch (e) {
                    done(e);
                }
                done();
                return [ 200, { }];
            });

        creatMapStoreMap(mapConfiguration);
    });
    it('should patch configuration to mapstore rest (updateMapStoreMap)', (done) => {
        const id = 1;
        const mapConfiguration = {
            id: 1,
            attributes: [],
            data: {},
            name: 'Map'
        };
        mockAxios.onPatch(new RegExp(`/mapstore/rest/resources/${id}`))
            .reply((config) => {
                try {
                    expect(config.data).toBe(JSON.stringify(mapConfiguration));
                } catch (e) {
                    done(e);
                }
                done();
                return [ 200, { }];
            });

        updateMapStoreMap(id, mapConfiguration);
    });
});
