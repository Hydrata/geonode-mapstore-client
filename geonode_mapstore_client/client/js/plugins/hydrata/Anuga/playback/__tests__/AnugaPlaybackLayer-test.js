/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2626 (W2.2, epic 2618) — AnugaPlaybackLayer registration + create/
 * update/isCompatible tests.
 *
 * "mount-order test is MANDATORY" (AC): proves Layers.createLayer(
 * 'anuga-playback', ...) resolves non-null once gmc's OWN eager plugin-
 * registry module (@js/plugins/index, imported by js/apps/gn-map.js before
 * any lazy plugin chunk) has run — alongside a KNOWN-REGISTERED control
 * type ('wms', registered by the MapStore2 core's own WMSLayer.js) so the
 * test would fail loudly if Layers itself were ever the wrong/stale module
 * instance (prove the detector on a known-positive,
 * feedback-prove-the-detector-before-trusting-a-zero).
 *
 * Caveat this test CANNOT prove by itself: karma bundles every spec file
 * into ONE webpack build, so by the time any test body runs, the WHOLE
 * module graph (including @js/plugins/index) has already executed — this
 * proves the WIRING (plugins/index.js really does import
 * AnugaPlaybackLayer.js, which really does call Layers.registerType) but
 * not real cold-load TIMING the way a fresh browser tab does. The wave's
 * live self-verify (fiber-walk a fresh page's Redux store) is what proves
 * actual runtime ordering — see the W2 wave report.
 */
import expect from 'expect';
import OlLayer from 'ol/layer/Layer';
import Layers from '@mapstore/framework/utils/openlayers/Layers';
// Side effect: registers 'anuga-playback'. Also pulls in the MapStore2
// core's OL layer plugins (which register 'wms' etc) transitively via the
// app's normal import graph, but we import the WMS registration explicitly
// too so this test's "known-registered control" doesn't depend on load
// order of OTHER test files in the bundle.
import '@js/plugins/index';
// Explicitly force the MapStore2 core's OL-layer-type barrel to evaluate
// (registers 'wms'/'vector'/'wmts'/etc as an import side effect — see
// MapStore2/.../openlayers/plugins/index.js) so the "known-registered
// control" below never depends on load order of some OTHER spec file
// happening to have pulled it in first.
import '@mapstore/framework/components/map/openlayers/plugins';

import { LAYER_TYPE, isCompatible } from '../AnugaPlaybackLayer';

function webgl2Available() {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
}

describe('AnugaPlaybackLayer', () => {
    describe('registration (mount-order)', () => {
        it('LAYER_TYPE is the literal "anuga-playback"', () => {
            expect(LAYER_TYPE).toBe('anuga-playback');
        });

        it('createLayer resolves a KNOWN-REGISTERED control type (wms) — proves this is the live Layers singleton', () => {
            const controlLayer = Layers.createLayer('wms', {
                id: 'control-wms',
                name: 'test:layer',
                url: 'http://example.invalid/geoserver/wms'
            });
            expect(controlLayer).toExist();
        });

        it('createLayer resolves "anuga-playback" to a non-null ol/layer/Layer instance (the TASK-2580-class regression this guards)', function() {
            if (!webgl2Available()) {
                this.skip();
                return;
            }
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-1' });
            expect(layer).toExist();
            expect(layer instanceof OlLayer).toBe(true);
        });

        it('an UNREGISTERED type still resolves null (sanity: Layers really does gate on registration, not always-truthy)', () => {
            expect(Layers.createLayer('definitely-not-a-registered-type', {})).toBe(null);
        });
    });

    describe('isCompatible', () => {
        it('permits creation before mesh/epsg is known', () => {
            expect(isCompatible({})).toBe(true);
            expect(isCompatible({ mesh: {} })).toBe(true);
        });

        it('accepts a UTM WGS84 epsg (326xx/327xx)', () => {
            expect(isCompatible({ mesh: { epsg: 32756 } })).toBe(true);
            expect(isCompatible({ mesh: { epsg: 32640 } })).toBe(true);
        });

        it('rejects a non-UTM epsg (e.g. plain WGS84 or Web Mercator)', () => {
            expect(isCompatible({ mesh: { epsg: 4326 } })).toBe(false);
            expect(isCompatible({ mesh: { epsg: 3857 } })).toBe(false);
        });
    });

    describe('create/update (requires a real WebGL2 context)', function() {
        before(function() {
            if (!webgl2Available()) {
                this.skip();
            }
        });

        it('is a "detached" layer that self-attaches to the map — the regression this guards: MapStore\'s <Layer> wrapper unconditionally calls layer.getSource().on(...) for any NON-detached layer, which throws for a source-less custom-render layer like this one (caught live, W2 wave report)', () => {
            const addLayerCalls = [];
            const removeLayerCalls = [];
            const fakeMap = {
                addLayer: (l) => addLayerCalls.push(l),
                removeLayer: (l) => removeLayerCalls.push(l)
            };
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-detached' }, fakeMap);
            expect(layer.detached).toBe(true);
            expect(typeof layer.getSource).toBe('function');
            expect(layer.getSource()).toBe(null); // proves WHY detached is required: no source exists
            expect(addLayerCalls).toEqual([layer]); // create() attached it itself
            layer.remove();
            expect(removeLayerCalls).toEqual([layer]); // remove() detaches it itself too
        });

        it('remove() disposes the renderer\'s GL resources (buffers/VAOs/programs/textures), not just map detach', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-dispose' }, { addLayer() {}, removeLayer() {} });
            const renderer = layer.__anugaPlaybackRenderer;
            let disposed = false;
            renderer.dispose = () => { disposed = true; };
            layer.remove();
            expect(disposed).toBe(true);
        });

        it('create() without a map still returns a usable layer (map is optional — used by karma/tests)', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-no-map' });
            expect(layer.detached).toBe(true);
            expect(() => layer.remove()).toNotThrow();
        });

        it('create() applies opacity/visibility defaults and stores custom playback properties', () => {
            const layer = Layers.createLayer(LAYER_TYPE, {
                id: 'playback-2',
                opacity: 0.5,
                visibility: false,
                wireframe: true,
                mixT: 0.25,
                colorMode: 'speed',
                colorMax: 3
            });
            expect(layer.getOpacity()).toBe(0.5);
            expect(layer.getVisible()).toBe(false);
            expect(layer.get('wireframe')).toBe(true);
            expect(layer.get('mixT')).toBe(0.25);
            expect(layer.get('colorMode')).toBe('speed');
            expect(layer.get('colorMax')).toBe(3);
        });

        it('create() defaults opacity to 1 and visibility to true when omitted', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-3' });
            expect(layer.getOpacity()).toBe(1);
            expect(layer.getVisible()).toBe(true);
        });

        it('update() toggles wireframe/opacity/visibility in place and returns null (no replacement)', () => {
            const oldOptions = { id: 'playback-4', opacity: 1, visibility: true, wireframe: false };
            const layer = Layers.createLayer(LAYER_TYPE, oldOptions);
            const newOptions = { ...oldOptions, opacity: 0.4, visibility: false, wireframe: true };
            const result = Layers.updateLayer(LAYER_TYPE, layer, newOptions, oldOptions);
            expect(result).toBe(null);
            expect(layer.getOpacity()).toBe(0.4);
            expect(layer.getVisible()).toBe(false);
            expect(layer.get('wireframe')).toBe(true);
        });

        it('render(frameState) returns the same canvas element on repeated calls (no per-frame element churn)', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-5' });
            const frameState = { viewState: { center: [0, 0], resolution: 100, rotation: 0 }, size: [200, 150], pixelRatio: 1 };
            const el1 = layer.render(frameState, null);
            const el2 = layer.render(frameState, null);
            expect(el1).toExist();
            expect(el1.tagName).toBe('CANVAS');
            expect(el1).toBe(el2);
        });

        it('render(frameState) does not throw before any mesh has loaded (blank-canvas path)', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-6' });
            const frameState = { viewState: { center: [500000, 6900000], resolution: 25, rotation: 0.1 }, size: [400, 300], pixelRatio: 2 };
            expect(() => layer.render(frameState, null)).toNotThrow();
        });

        // TASK-2629 (W4.1) — minimal GL smoke check (per the wave brief:
        // "keep GL smoke tests minimal ... SwiftShader slow") that every one
        // of the eight uColorMode branches actually links/draws without a GL
        // error against a REAL mesh (incl. the new friction/inradius static
        // attributes) — the math itself is covered headlessly by
        // playbackDerivedQuantities-test.js/playbackShaders-test.js; this
        // only proves the GPU pipeline (LUT bind, attribute layout, uniform
        // wiring) doesn't fall over for any of the eight modes.
        it('renders all eight derived-quantity colorModes against a real mesh without a GL error', (done) => {
            const layer = Layers.createLayer(LAYER_TYPE, {
                id: 'playback-gl-smoke',
                mesh: {
                    nodeX: Float32Array.from([0, 10, 0, 10]),
                    nodeY: Float32Array.from([0, 0, 10, 10]),
                    elevation: Float32Array.from([1, 2, 3, 4]),
                    friction: Float32Array.from([0.03, 0.03, 0.05, 0.05]),
                    vertexInradius: Float32Array.from([2, 2, 3, 3]),
                    faceNodeConnectivity: Int32Array.from([0, 1, 2, 1, 3, 2]),
                    epsg: 32756, xllcorner: 500000, yllcorner: 6900000
                },
                frame0: { depth: Float32Array.from([1, 2, 3, 4]), xVelocity: Float32Array.from([0.5, 0.5, 0.5, 0.5]), yVelocity: Float32Array.from([0, 0, 0, 0]) },
                frame1: { depth: Float32Array.from([2, 3, 4, 5]), xVelocity: Float32Array.from([0.5, 0.5, 0.5, 0.5]), yVelocity: Float32Array.from([0, 0, 0, 0]) }
            });
            const renderer = layer.__anugaPlaybackRenderer;
            const gl = renderer.gl;
            const frameState = { viewState: { center: [500000, 6900000], resolution: 1, rotation: 0 }, size: [64, 64], pixelRatio: 1 };
            // setMesh runs off a microtask (async reprojection, see
            // AnugaPlaybackLayer.loadMesh) — poll until it lands rather than
            // assuming a fixed number of ticks.
            const waitForMesh = () => {
                if (renderer.meshReady) {
                    ['depth', 'speed', 'stage', 'div', 'hazard', 'froude', 'shear', 'courant'].forEach((colorMode) => {
                        renderer.render({
                            viewState: frameState.viewState, size: frameState.size, pixelRatio: 1, opacity: 1,
                            mixT: 0.4, colorMode, colorMax: 10, colorMin: 0,
                            wetThreshold: 0.005, g: 9.8, rhoW: 1023, dt: 1.2
                        });
                        expect(gl.getError()).toBe(gl.NO_ERROR);
                    });
                    done();
                    return;
                }
                setTimeout(waitForMesh, 10);
            };
            waitForMesh();
        });
    });
});
