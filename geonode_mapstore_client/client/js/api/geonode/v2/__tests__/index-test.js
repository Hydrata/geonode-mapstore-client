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
    createMap,
    updateMap,
    getConfiguration
} from '@js/api/geonode/v2';

let mockAxios;

describe('GeoNode v2 api', () => {
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
    it('should post new configuration to mapstore rest (createMap)', (done) => {
        const mapConfiguration = {
            id: 1,
            attributes: [],
            data: {},
            name: 'Map'
        };
        mockAxios.onPost(/\/api\/v2\/maps/)
            .reply((config) => {
                try {
                    expect(config.data).toBe(JSON.stringify(mapConfiguration));
                } catch (e) {
                    done(e);
                }
                done();
                return [ 200, { }];
            });

        createMap(mapConfiguration);
    });
    it('should patch configuration to mapstore rest (updateMap)', (done) => {
        const id = 1;
        const mapConfiguration = {
            id: 1,
            attributes: [],
            data: {},
            name: 'Map'
        };
        mockAxios.onPatch(new RegExp(`/api/v2/maps/${id}`))
            .reply((config) => {
                try {
                    expect(config.data).toBe(JSON.stringify(mapConfiguration));
                } catch (e) {
                    done(e);
                }
                done();
                return [ 200, { }];
            });

        updateMap(id, mapConfiguration);
    });

    // TASK-2422 (epic 2359 W4.5) — mergeCfg patch rules (Hydrata extension):
    // site defaults must merge over a plugin entry's cfg, not replace it.
    it('should merge mergeCfg rules over plugin cfg without clobbering unrelated keys (getConfiguration)', (done) => {
        window.__GEONODE_CONFIG__ = {
            pluginsConfigPatchRules: [
                { op: 'mergeCfg', section: 'map_viewer', pluginName: 'SimpleView', value: { menuSpaces: 0, customMenus: [] } }
            ]
        };
        mockAxios.onGet(/localConfig\.json/)
            .reply(200, {
                plugins: {
                    map_viewer: [
                        { name: 'SimpleView', cfg: { paywallEnabled: true } },
                        { name: 'Anuga', cfg: { paywallEnabled: true } }
                    ]
                }
            });
        getConfiguration('/static/mapstore/configs/localConfig.json')
            .then((localConfig) => {
                try {
                    const simpleView = localConfig.plugins.map_viewer.find(p => p.name === 'SimpleView');
                    const anuga = localConfig.plugins.map_viewer.find(p => p.name === 'Anuga');
                    expect(simpleView.cfg).toEqual({ paywallEnabled: true, menuSpaces: 0, customMenus: [] });
                    expect(anuga.cfg).toEqual({ paywallEnabled: true });
                    delete window.__GEONODE_CONFIG__;
                    done();
                } catch (e) {
                    delete window.__GEONODE_CONFIG__;
                    done(e);
                }
            });
    });
    it('should create cfg via mergeCfg when the entry ships without one (getConfiguration)', (done) => {
        window.__GEONODE_CONFIG__ = {
            pluginsConfigPatchRules: [
                { op: 'mergeCfg', section: 'map_viewer', pluginName: 'SimpleView', value: { menuSpaces: 2 } }
            ]
        };
        mockAxios.onGet(/localConfig\.json/)
            .reply(200, {
                plugins: {
                    map_viewer: [
                        { name: 'SimpleView' }
                    ]
                }
            });
        getConfiguration('/static/mapstore/configs/localConfig.json')
            .then((localConfig) => {
                try {
                    const simpleView = localConfig.plugins.map_viewer.find(p => p.name === 'SimpleView');
                    expect(simpleView.cfg).toEqual({ menuSpaces: 2 });
                    delete window.__GEONODE_CONFIG__;
                    done();
                } catch (e) {
                    delete window.__GEONODE_CONFIG__;
                    done(e);
                }
            });
    });
});
