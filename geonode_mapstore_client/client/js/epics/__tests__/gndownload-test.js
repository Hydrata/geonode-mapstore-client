/*
 * Copyright 2022, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';
import { testEpic } from '@mapstore/framework/epics/__tests__/epicTestUtils';
import { downloadMetaData, DOWNLOAD_METADATA_COMPLETE } from '@js/actions/gndownload';
import { gnDownloadMetaData } from '@js/epics/gndownload';

let mockAxios;

describe('gnDownloadMetaData epic', () => {
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
    it('should download metadata', (done) => {
        const NUM_ACTIONS = 1;
        mockAxios.onGet(/iso_metadata_xml/).reply(200, '<gmd:MD_Metadata/>', { 'content-type': 'application/octet-stream' });

        testEpic(
            gnDownloadMetaData,
            NUM_ACTIONS,
            downloadMetaData('ISO', 1),
            (actions) => {
                try {
                    expect(actions.map(({type}) => type)).toEqual([ DOWNLOAD_METADATA_COMPLETE ]);
                    done();
                } catch (e) {
                    done(e);
                }
            },
            {},
            done
        );
    });

});
