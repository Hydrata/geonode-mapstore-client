/**
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Layers = require('@mapstore/framework/utils/leaflet/Layers');
var L = require('leaflet');

Layers.registerType('arcgis', (options) => {
    return L.esri.dynamicMapLayer({
        url: options.url,
        opacity: options.opacity || 1,
        layers: [parseInt(options.name || 0, 10)]
    });
});
