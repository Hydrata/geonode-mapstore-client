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

        it('an envelope handed over BEFORE the mesh lands is applied by setMesh, not discarded (TASK-2814)', () => {
            // create() uploads options.envelopeData synchronously while the
            // mesh only lands after the async reproject promise — so a layer
            // recreate with Max on used to zero-fill ("everything dry").
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-pending-envelope' });
            const renderer = layer.__anugaPlaybackRenderer;
            renderer.setEnvelope(new Float32Array([0.5, 1.5, 2.5])); // pre-mesh: _envelopeLength still 0
            renderer.setMesh({
                x3857: new Float32Array([0, 1, 0]),
                y3857: new Float32Array([0, 0, 1]),
                elevation: new Float32Array([0, 0, 0]),
                faceNodeConnectivity: new Uint32Array([0, 1, 2])
            });
            const gl = renderer.gl;
            const out = new Float32Array(3);
            gl.bindBuffer(gl.ARRAY_BUFFER, renderer.envelopeBuf);
            gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
            expect(Array.from(out)).toEqual([0.5, 1.5, 2.5]);
            layer.remove();
        });

        it('a pending envelope whose length mismatches the mesh is dropped, never uploaded (stale data guard)', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-pending-mismatch' });
            const renderer = layer.__anugaPlaybackRenderer;
            renderer.setEnvelope(new Float32Array([9, 9])); // wrong length for the 3-node mesh below
            renderer.setMesh({
                x3857: new Float32Array([0, 1, 0]),
                y3857: new Float32Array([0, 0, 1]),
                elevation: new Float32Array([0, 0, 0]),
                faceNodeConnectivity: new Uint32Array([0, 1, 2])
            });
            const gl = renderer.gl;
            const out = new Float32Array(3);
            gl.bindBuffer(gl.ARRAY_BUFFER, renderer.envelopeBuf);
            gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
            expect(Array.from(out)).toEqual([0, 0, 0]); // setMesh's zero-fill stands
            expect(renderer._pendingEnvelope).toBe(null); // and the stale array is not retained
            layer.remove();
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

        // TASK-2784 (W7, epic 2706) — the ramp mode has to survive the trip
        // through the layer, and has to be DIFFED, or toggling the ceiling off
        // would leave a stretched LUT behind on a layer that no longer has one.
        it('carries colorRescaled through create() and update()', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-rescale', colorMode: 'speed', colorMax: 4, colorRescaled: true });
            expect(layer.get('colorRescaled')).toBe(true);

            const stretched = { id: 'playback-rescale', colorMode: 'speed', colorMax: 4, colorRescaled: true };
            const plain = { id: 'playback-rescale', colorMode: 'speed', colorMax: 4 };

            Layers.updateLayer(LAYER_TYPE, layer, plain, stretched);
            expect(layer.get('colorRescaled')).toBe(false, 'clearing the ceiling must clear the stretch');

            Layers.updateLayer(LAYER_TYPE, layer, stretched, plain);
            expect(layer.get('colorRescaled')).toBe(true);
        });

        it('defaults colorRescaled to false — no ceiling means SLD-absolute colours', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-rescale-default' });
            expect(layer.get('colorRescaled')).toBe(false);
        });

        /*
         * TASK-2788 (W7, epic 2706) — dry-ground alpha. The trap this guards is
         * `||`: 0 is both the DEFAULT and the most-used real value here, so any
         * `options.backgroundOpacity || <fallback>` on the way through would be
         * indistinguishable from "unset" and a deliberate 0 could never round-trip.
         */
        it('carries backgroundOpacity through create() and update(), including a deliberate 0', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-bg', backgroundOpacity: 0.4 });
            expect(layer.get('backgroundOpacity')).toBe(0.4);

            const dim = { id: 'playback-bg', backgroundOpacity: 0.4 };
            const clear = { id: 'playback-bg', backgroundOpacity: 0 };
            Layers.updateLayer(LAYER_TYPE, layer, clear, dim);
            expect(layer.get('backgroundOpacity')).toBe(0, 'a deliberate 0 must survive, not fall back');

            Layers.updateLayer(LAYER_TYPE, layer, dim, clear);
            expect(layer.get('backgroundOpacity')).toBe(0.4);
        });

        it('defaults backgroundOpacity to 0 — the dry ground starts transparent', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-bg-default' });
            expect(layer.get('backgroundOpacity')).toBe(0);
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

        // TASK-2752 (W8.2, epic 2706) AC5/AC6 — the Max envelope toggle,
        // same plain layer-property class as wireframe above.
        it('carries envelopeMode through create() and update(), defaulting to false', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-envelope-mode' });
            expect(layer.get('envelopeMode')).toBe(false);

            const off = { id: 'playback-envelope-mode' };
            const on = { id: 'playback-envelope-mode', envelopeMode: true };
            Layers.updateLayer(LAYER_TYPE, layer, on, off);
            expect(layer.get('envelopeMode')).toBe(true);

            Layers.updateLayer(LAYER_TYPE, layer, off, on);
            expect(layer.get('envelopeMode')).toBe(false);
        });

        it('setEnvelope() runs without a GL error at create() time and on update(), and resets on null', () => {
            const layer = Layers.createLayer(LAYER_TYPE, {
                id: 'playback-envelope-data',
                mesh: {
                    nodeX: Float32Array.from([0, 10, 0, 10]),
                    nodeY: Float32Array.from([0, 0, 10, 10]),
                    elevation: Float32Array.from([1, 2, 3, 4]),
                    faceNodeConnectivity: Int32Array.from([0, 1, 2, 1, 3, 2]),
                    epsg: 32756, xllcorner: 500000, yllcorner: 6900000
                },
                envelopeData: Float32Array.from([1, 2, 3, 4])
            });
            const renderer = layer.__anugaPlaybackRenderer;
            const gl = renderer.gl;
            expect(gl.getError()).toBe(gl.NO_ERROR);

            const withEnvelope = { id: 'playback-envelope-data', envelopeData: Float32Array.from([9, 9, 9, 9]) };
            const cleared = { id: 'playback-envelope-data', envelopeData: null };
            Layers.updateLayer(LAYER_TYPE, layer, cleared, withEnvelope);
            expect(gl.getError()).toBe(gl.NO_ERROR);
            Layers.updateLayer(LAYER_TYPE, layer, withEnvelope, cleared);
            expect(gl.getError()).toBe(gl.NO_ERROR);
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

        // TASK-2655 (W6.5, epic 2618) — BLOCKER regression. A `position:
        // static` canvas composites UNDER OL's `.ol-layer` basemap div (CSS
        // paint order stacks positioned elements above static ones
        // regardless of DOM order) — every pixel renders correctly and the
        // composited page still shows nothing. `gl.readPixels`/GL-level
        // assertions are STRUCTURALLY BLIND to this failure class (they
        // read the back buffer, never the composited page) — this is why
        // 5,401 green karma tests and every prior wave's live-dispatch
        // check missed it (W6 UAT findings). Only a DOM-level style
        // assertion catches a regression back to the default.
        it('BLOCKER regression: the canvas is absolutely positioned at creation, never `static` (DOM-level assert — a GL readback assert does NOT catch this)', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-position-regression' });
            const renderer = layer.__anugaPlaybackRenderer;
            expect(renderer.canvas.style.position).toBe('absolute');
            expect(renderer.canvas.style.top).toBe('0px');
            expect(renderer.canvas.style.left).toBe('0px');
            // Also assert on the actual element render() hands back to OL
            // for DOM attachment — proves the SAME element is positioned,
            // not a copy that happens to differ from the one OL appends.
            const frameState = { viewState: { center: [0, 0], resolution: 100, rotation: 0 }, size: [200, 150], pixelRatio: 1 };
            const rendered = layer.render(frameState, null);
            expect(rendered).toBe(renderer.canvas);
            expect(rendered.style.position).toBe('absolute');
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

        // TASK-2632 (W5.1) — minimal GL smoke check (per the wave brief:
        // "keep GL smoke tests minimal ... SwiftShader slow") that the
        // velocity FBO pass + instanced arrow overlay draw call actually
        // links/runs without a GL error against a real mesh. NAMED SKIP
        // (wave brief: "GL shell wiring may skip, name the skip case"): this
        // does NOT also assert on AnugaPlaybackFlowVizRenderer.
        // debugReadVelocityField()'s numeric readback here — a
        // gl.readPixels of the full 512x512 RGBA32F FBO hangs/times out
        // under this project's headless karma launcher (ChromeHeadlessCI,
        // `--disable-gpu` -> SwiftShader software path; confirmed by
        // isolating render() alone, which passes in <1s, from the readback,
        // which alone exceeded a 15s mocha timeout with zero GL error
        // reported first). That numeric "texture is non-zero where flow
        // exists" proof — the wave brief's own "port the FBO/particle
        // readback DEBUG technique into your live verification" — runs
        // instead against the REAL browser during this wave's live-verify
        // pass (see the W5 wave report), not this automated suite. Broader
        // math coverage (density/scale variations, screen-space grid
        // sampling, arrow length/colour/direction formulas) is headlessly
        // covered by playbackFlowViz-test.js.
        it('flowVizEnabled: velocity FBO + arrow overlay render without a GL error', (done) => {
            const layer = Layers.createLayer(LAYER_TYPE, {
                id: 'playback-flowviz-gl-smoke',
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
            const frameState = { viewState: { center: [500005, 6900005], resolution: 0.2, rotation: 0 }, size: [64, 64], pixelRatio: 1 };
            const waitForMesh = () => {
                if (renderer.meshReady) {
                    renderer.render({
                        viewState: frameState.viewState, size: frameState.size, pixelRatio: 1, opacity: 1,
                        mixT: 0.5, colorMode: 'depth', colorMax: 10, colorMin: 0,
                        wetThreshold: 0.005, g: 9.8, rhoW: 1023, dt: 1.2,
                        flowVizEnabled: true, arrowDensity: 16, arrowScale: 1
                    });
                    expect(gl.getError()).toBe(gl.NO_ERROR);
                    done();
                    return;
                }
                setTimeout(waitForMesh, 10);
            };
            waitForMesh();
        });

        // TASK-2633 (W5.2) — minimal GL smoke check, same NAMED SKIP as the
        // TASK-2632 test above (no readPixels-based numeric readback here —
        // confirmed to hang under this project's headless SwiftShader
        // launcher; the particle system doesn't even own a readback helper
        // for the SAME reason). Proves the advection step + trail
        // fade/composite + point draw pipeline links/runs across TWO
        // consecutive frames (so the ping-pong swap itself is exercised)
        // without a GL error, both alone and combined with the W5.1 arrow
        // overlay (both read the SAME velocity texture the same frame).
        it('particlesEnabled: advection + trail render across two frames without a GL error, combined with flowVizEnabled', (done) => {
            const layer = Layers.createLayer(LAYER_TYPE, {
                id: 'playback-particles-gl-smoke',
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
            const frameState = { viewState: { center: [500005, 6900005], resolution: 0.2, rotation: 0 }, size: [64, 64], pixelRatio: 1 };
            const waitForMesh = () => {
                if (renderer.meshReady) {
                    const renderOnce = () => renderer.render({
                        viewState: frameState.viewState, size: frameState.size, pixelRatio: 1, opacity: 1,
                        mixT: 0.5, colorMode: 'depth', colorMax: 10, colorMin: 0,
                        wetThreshold: 0.005, g: 9.8, rhoW: 1023, dt: 1.2,
                        flowVizEnabled: true, arrowDensity: 16, arrowScale: 1,
                        particlesEnabled: true, particleDensity: 32, particleSpeedExaggeration: 1
                    });
                    renderOnce();
                    expect(gl.getError()).toBe(gl.NO_ERROR);
                    renderOnce(); // second frame — exercises the ping-pong swap + camera-key-unchanged (no trail reset) path
                    expect(gl.getError()).toBe(gl.NO_ERROR);
                    expect(renderer.particles.getGridSize()).toBe(32);
                    done();
                    return;
                }
                setTimeout(waitForMesh, 10);
            };
            waitForMesh();
        });
    });

    // ========================================================================
    // TASK-2743 UAT-07 (W6, epic 2706) — the playback stall.
    //
    // Measured in the live tab on map 1461: 36 gl.bufferData calls moving
    // 1,397.9 MB cost 3,443 ms — 95.6 ms per 40.7 MB upload, TWO per timestep.
    // Stepping the playhead one frame makes the old frame1 the new frame0, so
    // one of those two uploads is re-sending bytes that are already in VRAM.
    //
    // The property under test is not "it is faster" (a timing assertion in
    // karma is a flake generator) but the MECHANISM: on a forward step the
    // renderer must do exactly one CPU->GPU upload and one GPU-side copy, and
    // on anything else it must do two uploads. Counted off the live GL
    // context, so a refactor that quietly drops the recycling fails here.
    // ========================================================================
    describe('frame recycling (TASK-2743 UAT-07, requires a real WebGL2 context)', function() {
        before(function() {
            if (!webgl2Available()) {
                this.skip();
            }
        });

        const countGlCalls = (renderer) => {
            const gl = renderer.gl;
            const counts = { bufferData: 0, copyBufferSubData: 0 };
            const originals = {};
            ['bufferData', 'copyBufferSubData'].forEach((name) => {
                originals[name] = gl[name];
                gl[name] = function(...args) {
                    counts[name]++;
                    return originals[name].apply(gl, args);
                };
            });
            counts.restore = () => Object.keys(originals).forEach((n) => { gl[n] = originals[n]; });
            return counts;
        };
        const frame = (n, seed) => Float32Array.from({ length: n * 3 }, (_, i) => (i + seed) % 7);

        it('a FORWARD step uploads once and copies once — the redundant 40.7 MB re-upload is gone', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-recycle' });
            const renderer = layer.__anugaPlaybackRenderer;
            const a = frame(64, 0); const b = frame(64, 1); const c = frame(64, 2);
            renderer.setFrames(a, b);                                      // first frames: full
            const counts = countGlCalls(renderer);
            renderer.setFrames(b, c, { frame0WasPreviousFrame1: true });   // forward step
            counts.restore();
            expect(counts.bufferData).toBe(1);
            expect(counts.copyBufferSubData).toBe(1);
        });

        it('a SEEK (no identity match) still does both uploads and copies nothing', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-seek' });
            const renderer = layer.__anugaPlaybackRenderer;
            const a = frame(64, 0); const b = frame(64, 1);
            renderer.setFrames(a, b);
            const counts = countGlCalls(renderer);
            renderer.setFrames(frame(64, 5), frame(64, 6));                // no flag at all
            counts.restore();
            expect(counts.bufferData).toBe(2);
            expect(counts.copyBufferSubData).toBe(0);
        });

        it('the FIRST setFrames can never recycle, however it is flagged — there is nothing in VRAM to copy', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-first' });
            const renderer = layer.__anugaPlaybackRenderer;
            const counts = countGlCalls(renderer);
            renderer.setFrames(frame(64, 0), frame(64, 1), { frame0WasPreviousFrame1: true });
            counts.restore();
            expect(counts.bufferData).toBe(2);
            expect(counts.copyBufferSubData).toBe(0);
        });

        it('a frame of a DIFFERENT length forces the full path — a size-mismatched copy would be silent corruption', () => {
            const layer = Layers.createLayer(LAYER_TYPE, { id: 'playback-resize' });
            const renderer = layer.__anugaPlaybackRenderer;
            renderer.setFrames(frame(64, 0), frame(64, 1));
            const counts = countGlCalls(renderer);
            renderer.setFrames(frame(128, 1), frame(128, 2), { frame0WasPreviousFrame1: true });
            counts.restore();
            expect(counts.bufferData).toBe(2);
            expect(counts.copyBufferSubData).toBe(0);
        });
    });

});
