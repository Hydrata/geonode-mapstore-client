/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2631 (W6.2, epic 2618) — playback perf smoke.
 *
 * A REUSABLE, re-runnable version of the W5 wave report's one-off manual
 * measurement (docs/reports/TASK-2618-W5-wave-report.md — "Frame-cost delta"
 * item, 5.81 ms/frame scalar baseline -> 7.46 ms/frame with flow-viz arrows
 * + 16,384-particle trails -> +1.66 ms/frame added, on a real 100,530-
 * triangle mesh @700x500px). That measurement was a live browser session,
 * never checked in as code — this test reproduces the SAME sync-timing
 * methodology (gl.readPixels every iteration to force a real GPU sync,
 * never rAF, matching the W0 spike's own technique) against a synthetic
 * mesh, so a gross regression shows up on every karma run, not only when
 * someone remembers to re-measure by hand.
 *
 * Deliberately NOT a tight perf budget / CI gate (per the wave brief:
 * "keep it minimal ... CI wiring is post-merge business"). The asserted
 * ceiling is intentionally generous (10x-plus the W5 measurement) because
 * karma's GPU backing varies by box (this box measured a real NVIDIA GPU
 * behind Chrome Headless at wave time; a CI runner may fall back to a
 * software rasterizer, which is legitimately much slower per-frame while
 * still being proportionally fine) — the goal is "did something make this
 * catastrophically slower", not "match the W5 number exactly". The ACTUAL
 * measured numbers are logged to console every run for a human trend-watch
 * (see the wave report for how to read a genuine regression out of them).
 */
import expect from 'expect';
import Layers from '@mapstore/framework/utils/openlayers/Layers';
import '@js/plugins/index'; // registers 'anuga-playback' (side effect)
import { LAYER_TYPE } from '../AnugaPlaybackLayer';
import { packQuantityVec3 } from '../playbackMeshGeometry';

function webgl2Available() {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
}

// A regular-grid synthetic mesh, N x N vertices -> 2*(N-1)^2 triangles.
// N=100 -> 10,000 vertices / 19,602 triangles: an order of magnitude below
// the W5 report's real 100,530-triangle mesh (deliberately smaller so this
// test stays fast in karma — see this module's header on why an exact
// magnitude match isn't the point).
function buildSyntheticMesh(n) {
    const nodeX = new Float32Array(n * n);
    const nodeY = new Float32Array(n * n);
    const elevation = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const idx = j * n + i;
            nodeX[idx] = 500000 + i * 10;
            nodeY[idx] = 6900000 + j * 10;
            elevation[idx] = 5 + Math.sin(i / 10) * 2;
        }
    }
    const triCount = 2 * (n - 1) * (n - 1);
    const faceNodeConnectivity = new Int32Array(triCount * 3);
    let t = 0;
    for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
            const a = j * n + i;
            const b = a + 1;
            const c = a + n;
            const d = c + 1;
            faceNodeConnectivity[t++] = a; faceNodeConnectivity[t++] = b; faceNodeConnectivity[t++] = c;
            faceNodeConnectivity[t++] = b; faceNodeConnectivity[t++] = d; faceNodeConnectivity[t++] = c;
        }
    }
    const depth = new Float32Array(n * n).fill(1.5);
    const xVelocity = new Float32Array(n * n).fill(0.8);
    const yVelocity = new Float32Array(n * n).fill(0.3);
    return { nodeX, nodeY, elevation, faceNodeConnectivity, depth, xVelocity, yVelocity, nNode: n * n, nTri: triCount };
}

/**
 * Times N render() calls, forcing a real GPU sync after each (gl.readPixels
 * of a single pixel) — the same anti-rAF-batching technique the W5 report's
 * manual measurement used, so a browser can't coalesce/skip work the way it
 * would under requestAnimationFrame.
 */
function timeFrames(renderer, renderParams, nFrames) {
    const gl = renderer.gl;
    const pixel = new Uint8Array(4);
    const frameState = { viewState: { center: [500500, 6900500], resolution: 2, rotation: 0 }, size: [700, 500], pixelRatio: 1 };
    // Warm-up (shader/texture/driver JIT) — not timed, matches W5 methodology.
    for (let i = 0; i < 5; i++) {
        renderer.render({ ...frameState, ...renderParams });
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    const start = performance.now();
    for (let i = 0; i < nFrames; i++) {
        renderer.render({ ...frameState, ...renderParams });
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    const elapsed = performance.now() - start;
    return elapsed / nFrames;
}

describe('playback perf smoke (TASK-2631, W6.2) — gross-regression guard, not a tight budget', function() {
    before(function() {
        if (!webgl2Available()) {
            this.skip();
        }
    });

    it('flow-viz (arrows + particles) overhead over a scalar-mesh baseline stays well under a generous ceiling', function() {
        this.timeout(20000);
        const mesh = buildSyntheticMesh(100);
        const layer = Layers.createLayer(LAYER_TYPE, { id: 'perf-smoke' });
        const renderer = layer.__anugaPlaybackRenderer;
        renderer.setMesh({
            x3857: mesh.nodeX,
            y3857: mesh.nodeY,
            elevation: mesh.elevation,
            faceNodeConnectivity: mesh.faceNodeConnectivity
        });
        const frameVec3 = packQuantityVec3(mesh.depth, mesh.xVelocity, mesh.yVelocity);
        renderer.setFrames(frameVec3, frameVec3);

        const NFRAMES = 30;
        const baseline = timeFrames(renderer, {
            opacity: 1, wireframe: false, mixT: 0.5, colorMode: 'depth', colorMax: 5, colorMin: 0,
            wetThreshold: 0.01, g: 9.8, rhoW: 1000, dt: 1,
            flowVizEnabled: false, particlesEnabled: false
        }, NFRAMES);
        const withFlowViz = timeFrames(renderer, {
            opacity: 1, wireframe: false, mixT: 0.5, colorMode: 'depth', colorMax: 5, colorMin: 0,
            wetThreshold: 0.01, g: 9.8, rhoW: 1000, dt: 1,
            flowVizEnabled: true, arrowDensity: 64, arrowScale: 1,
            particlesEnabled: true, particleDensity: 128, particleSpeedExaggeration: 1
        }, NFRAMES);
        const delta = withFlowViz - baseline;

        // eslint-disable-next-line no-console -- deliberate: this IS the perf record, see this module's header
        console.log(
            `[playback perf smoke] mesh=${mesh.nTri} tri, baseline=${baseline.toFixed(2)} ms/frame, ` +
            `withFlowViz=${withFlowViz.toFixed(2)} ms/frame, delta=${delta.toFixed(2)} ms/frame ` +
            `(W5 reference on a real GPU, 100,530-tri mesh: baseline 5.81, withFlowViz 7.46, delta +1.66 ms/frame)`
        );

        // Generous, deliberately loose ceiling (see header) — this is a
        // gross-regression trip-wire, not a tight budget.
        const REGRESSION_CEILING_MS = 50;
        if (delta > REGRESSION_CEILING_MS) {
            throw new Error(
                `playback perf smoke: flow-viz overhead ${delta.toFixed(2)} ms/frame exceeds the ` +
                `${REGRESSION_CEILING_MS} ms/frame gross-regression ceiling (W5 reference: +1.66 ms/frame ` +
                `on a real GPU) — investigate before shipping.`
            );
        }

        layer.remove();
    });

    // TASK-2734 (W3, epic 2706) — AC7. THE automated proof of the epic's
    // headline fix: setMesh must not touch the wireframe edge buffer at all,
    // and the first render() that asks for the wireframe must build it once
    // and then never again.
    //
    // RED against gmc 2819b2a07: setMesh there called
    // decimateWireframeIndices(buildWireframeIndices(fnc), 2) eagerly, so
    // nWireIndices was 119,202 immediately after setMesh — the first
    // assertion below failed on the pre-fix tree, which is what makes a
    // post-fix pass mean something.
    it('setMesh builds no wireframe buffer; the first wireframe render builds it once', function() {
        this.timeout(20000);
        // 2*(200-1)^2 = 79,202 triangles -> wireframeDecimationStride === 2,
        // i.e. the DECIMATED path, not the small-mesh identity path.
        const mesh = buildSyntheticMesh(200);
        expect(mesh.nTri).toBe(79202);

        const layer = Layers.createLayer(LAYER_TYPE, { id: 'lazy-wireframe' });
        const renderer = layer.__anugaPlaybackRenderer;
        renderer.setMesh({
            x3857: mesh.nodeX,
            y3857: mesh.nodeY,
            elevation: mesh.elevation,
            faceNodeConnectivity: mesh.faceNodeConnectivity
        });
        const frameVec3 = packQuantityVec3(mesh.depth, mesh.xVelocity, mesh.yVelocity);
        renderer.setFrames(frameVec3, frameVec3);

        // (1) DEFAULT PATH IS FREE — nothing built, nothing uploaded.
        expect(renderer.nWireIndices).toBe(0);
        expect(renderer._wireBuildCount).toBe(0);

        const frameState = {
            viewState: { center: [500995, 6900995], resolution: 4, rotation: 0 },
            size: [700, 500], pixelRatio: 1
        };
        const params = {
            opacity: 1, mixT: 0.5, colorMode: 'depth', colorMax: 5, colorMin: 0,
            wetThreshold: 0.01, g: 9.8, rhoW: 1000, dt: 1,
            flowVizEnabled: false, particlesEnabled: false
        };

        // A wireframe-OFF frame must still build nothing.
        renderer.render({ ...frameState, ...params, wireframe: false });
        expect(renderer.nWireIndices).toBe(0);
        expect(renderer._wireBuildCount).toBe(0);

        // (2) FIRST wireframe frame builds it.
        renderer.render({ ...frameState, ...params, wireframe: true });
        expect(renderer.nWireIndices).toBeGreaterThan(0);
        expect(renderer._wireBuildCount).toBe(1);
        const builtCount = renderer.nWireIndices;

        // (3) MEMOISED — further wireframe frames rebuild nothing.
        renderer.render({ ...frameState, ...params, wireframe: true });
        renderer.render({ ...frameState, ...params, wireframe: false });
        renderer.render({ ...frameState, ...params, wireframe: true });
        expect(renderer._wireBuildCount).toBe(1);
        expect(renderer.nWireIndices).toBe(builtCount);

        // (4) The GL trap: building inside render() must not have clobbered
        // the mesh VAO's ELEMENT_ARRAY_BUFFER binding (wireIdxBuf is bound
        // into wireVao, so an unguarded bufferData would have redirected
        // whichever VAO happened to be current). The mesh draw still uses
        // idxBuf with the full triangle index count.
        const gl = renderer.gl;
        gl.bindVertexArray(renderer.meshVao);
        expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(renderer.idxBuf);
        gl.bindVertexArray(renderer.wireVao);
        expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(renderer.wireIdxBuf);
        gl.bindVertexArray(null);
        expect(renderer.nIndices).toBe(mesh.faceNodeConnectivity.length);

        // (5) setMesh INVALIDATES — a second store load rebuilds on demand.
        renderer.setMesh({
            x3857: mesh.nodeX,
            y3857: mesh.nodeY,
            elevation: mesh.elevation,
            faceNodeConnectivity: mesh.faceNodeConnectivity
        });
        expect(renderer.nWireIndices).toBe(0);
        renderer.render({ ...frameState, ...params, wireframe: true });
        expect(renderer._wireBuildCount).toBe(2);
        expect(renderer.nWireIndices).toBe(builtCount);

        // eslint-disable-next-line no-console -- deliberate: this IS the record for TASK-2734 AC7
        console.log(
            `[TASK-2734 AC7] mesh=${mesh.nTri} tri, nWireIndices after setMesh=0 ` +
            `(pre-fix HEAD 2819b2a07: 119202), after first wireframe render=${builtCount}, ` +
            `builds after 4 wireframe frames + one reload=${renderer._wireBuildCount}`
        );

        layer.remove();
    });
});
