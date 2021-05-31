/**
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { registerType } from '@mapstore/framework/utils/openlayers/Layers';

import TileLayer from 'ol/layer/Tile';
import TileArcGISRest from 'ol/source/TileArcGISRest';

registerType('arcgis', {
    create: (options) => {
        return new TileLayer({
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility !== false,
            zIndex: options.zIndex,
            source: new TileArcGISRest({
                params: { LAYERS: `show:${parseInt(options.name || 0, 10)}` },
                url: options.url
            })
        });
    }
});
