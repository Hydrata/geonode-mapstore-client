/**
 * Regression test for TASK-1607: WMSLayer fork — vectorStyle-only update
 * must NOT call vectorSource.clear()+refresh() (restyle-in-place via applyStyle).
 *
 * Background: WMSLayer.js update() compared vectorStyle at ~:221, called
 * applyStyle at ~:222, then set needsRefresh=true at ~:223, which fed the
 * clear()+refresh() block at ~:290-298. For MVT layers this caused all cached
 * vector tiles to be dropped and re-fetched on EVERY style toggle (e.g. BMP
 * filter changes), causing 18-30 duplicate tile requests per toggle.
 *
 * The fix: the vectorStyle diff path calls applyStyle (restyle-in-place) and
 * no longer sets needsRefresh=true, so clear()+refresh() are never triggered.
 *
 * The params/_v_ refresh path (used by BmpFormContainer.js:308-311 and
 * epicsVectorDraw.js:368,552) MUST keep triggering clear()+refresh().
 *
 * Tests live here (client/js/**) — discovered by gmc karma require.context
 * over js/** only (tests-travis.webpack.js:1). NOT in MapStore2/__tests__
 * (submodule tests are never run by gmc CI — gmc-karma-never-runs-mapstore2-
 * submodule-tests gotcha).
 */
import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';

// OpenlayersLayer is the React component that drives Layers.registerType
import OpenlayersLayer from '@mapstore/framework/components/map/openlayers/Layer';
// Plugins must be imported to register the 'wms' type handler
import '@mapstore/framework/components/map/openlayers/plugins/WMSLayer';

import { Map, View } from 'ol';
import { defaults as defaultControls } from 'ol/control';

const MVT_FORMAT = 'application/vnd.mapbox-vector-tile';

const makeBaseOptions = () => ({
    type: 'wms',
    visibility: true,
    name: 'test:dec_bmp',
    group: 'BMP',
    url: 'http://sample.server/geoserver/wms',
    format: MVT_FORMAT,
    params: { _v_: 1 },
    vectorStyle: {
        color: '#ff0000',
        fillColor: '#ff0000',
        fillOpacity: 0.5
    }
});

describe('WMSLayer vectorStyle restyle-in-place (TASK-1607)', () => {
    let map;

    beforeEach(() => {
        document.body.innerHTML =
            '<div id="map" style="width:200px;height:200px;"></div>' +
            '<div id="container"></div>';
        map = new Map({
            layers: [],
            controls: defaultControls({ attributionOptions: { collapsible: false } }),
            target: 'map',
            view: new View({ center: [0, 0], zoom: 5 })
        });
    });

    afterEach(() => {
        map.setTarget(null);
        document.body.innerHTML = '';
    });

    it('(a) vectorStyle-only update does NOT call vectorSource.clear() or refresh()', () => {
        const options = makeBaseOptions();

        // Initial render — creates the VectorTileLayer
        let layer = ReactDOM.render(
            <OpenlayersLayer type="wms" options={options} map={map} />,
            document.getElementById('container')
        );
        expect(layer).toBeTruthy();
        expect(layer.layer.constructor.name).toBe('VectorTileLayer');

        const vectorSource = layer.layer.getSource();
        expect(vectorSource).toBeTruthy();

        // Spy BEFORE the re-render that triggers the update() path
        const clearSpy = expect.spyOn(vectorSource, 'clear').andCallThrough();
        const refreshSpy = expect.spyOn(vectorSource, 'refresh').andCallThrough();

        // Trigger a vectorStyle-only change (same params, different style colour)
        const updatedStyle = { ...options.vectorStyle, color: '#00ff00', fillColor: '#00ff00' };
        layer = ReactDOM.render(
            <OpenlayersLayer
                type="wms"
                options={{ ...options, vectorStyle: updatedStyle }}
                map={map}
            />,
            document.getElementById('container')
        );

        // The fix: applyStyle restyles cached tiles in-place — NO network re-fetch
        expect(clearSpy.calls.length).toBe(0,
            'vectorSource.clear() must NOT be called on vectorStyle-only update — ' +
            'restyle-in-place via applyStyle keeps cached tiles'
        );
        expect(refreshSpy.calls.length).toBe(0,
            'vectorSource.refresh() must NOT be called on vectorStyle-only update'
        );
    });

    it('(b) params/_v_ change STILL triggers vectorSource.clear()+refresh()', () => {
        const options = makeBaseOptions();

        // Initial render
        let layer = ReactDOM.render(
            <OpenlayersLayer type="wms" options={options} map={map} />,
            document.getElementById('container')
        );
        expect(layer).toBeTruthy();
        expect(layer.layer.constructor.name).toBe('VectorTileLayer');

        const vectorSource = layer.layer.getSource();
        expect(vectorSource).toBeTruthy();

        const clearSpy = expect.spyOn(vectorSource, 'clear').andCallThrough();
        const refreshSpy = expect.spyOn(vectorSource, 'refresh').andCallThrough();

        // Bump _v_ — this is the BMP-edit refresh path (BmpFormContainer.js:308-311,
        // epicsVectorDraw.js:368,552) and MUST continue to trigger clear()+refresh()
        // so that edited BMP features are reflected in the tile data.
        layer = ReactDOM.render(
            <OpenlayersLayer
                type="wms"
                options={{ ...options, params: { _v_: 2 } }}
                map={map}
            />,
            document.getElementById('container')
        );

        // The _v_ path sets needsRefresh=true via the params diff at ~:268 and
        // flows into the clear()+refresh() block at ~:290-298.
        expect(clearSpy.calls.length).toBeGreaterThan(0,
            'vectorSource.clear() MUST be called when _v_ param changes (BMP edit path)'
        );
        expect(refreshSpy.calls.length).toBeGreaterThan(0,
            'vectorSource.refresh() MUST be called when _v_ param changes (BMP edit path)'
        );
    });
});
