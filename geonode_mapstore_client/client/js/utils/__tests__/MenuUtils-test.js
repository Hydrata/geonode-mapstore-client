
/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { hasPermissionsTo } from '../MenuUtils';

const resourceWithPerms = [
    "view_resourcebase"
];

const resourceNoPerms = [
    "download_resourcebase"
];

const menuPerms = [{
    "type": "resource",
    "value": "view_resourcebase"
}];

describe('Test Menu Utils', () => {

    it('Test has Permissions To', () => {
        expect((hasPermissionsTo(resourceWithPerms, menuPerms, 'resource'))).toBe(true);
    });

    it('Test has no Permissions To', () => {
        expect((hasPermissionsTo(resourceNoPerms, menuPerms, 'resource'))).toBe(false);
    });

});
