/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AnugaPlaybackRenderer — the self-managed WebGL2 canvas the
 * AnugaPlaybackLayer's `render(frameState)` hook delegates to (TASK-2626,
 * W2.2, epic 2618). Deliberately NOT ol/webgl/Helper — that helper only
 * ever requests a WebGL1 context (`ol/webgl.js`'s CONTEXT_IDS has no
 * 'webgl2'; getSupportedExtensions() proves it never falls back to one
 * either), and this renderer wants real WebGL2 (`#version 300 es`,
 * `layout(location=n)`). COGLayer.js (ol/layer/WebGLTile + ol/webgl/Helper
 * under the hood) is the nearest in-stack reference for the
 * `Layers.registerType` SHAPE only, not for GL context management — this
 * class owns its own canvas/gl/programs/buffers end to end and self-applies
 * opacity/pixel-ratio (the layer never gets that for free the way an
 * ol/webgl/Helper-backed layer type does).
 */
import {
    MESH_VERTEX_SHADER,
    MESH_FRAGMENT_SHADER,
    WIRE_VERTEX_SHADER,
    WIRE_FRAGMENT_SHADER,
    linkProgram
} from './playbackShaders';
import {
    uploadLUTTexture,
    buildQuantityColormapLUT,
    buildDiscreteColormapLUT,
    QUANTITY_RAMPS
} from './playbackColormap';
import { QUANTITY_MODE_INDEX } from './playbackDerivedQuantities';
import {
    buildWireframeIndices, buildProjectionMatrix,
    wireframeDecimationStride, wireframeOpacityForTriangleCount,
    // TASK-2734 (W3, epic 2706) — the allocation-free replacement for
    // decimateWireframeIndices(buildWireframeIndices(...), stride) on a
    // prod-scale mesh. decimateWireframeIndices itself is deliberately NOT
    // imported here any more: nothing in this renderer builds a full edge set
    // to thin down.
    wireframeFaceStride, buildFaceDecimatedWireframeIndices
} from './playbackMeshGeometry';
import { AnugaPlaybackFlowVizRenderer } from './AnugaPlaybackFlowVizRenderer';
import { AnugaPlaybackParticleRenderer } from './AnugaPlaybackParticleRenderer';
import { clampParticleGrid } from './playbackParticles';

const WIRE_COLOR = [0.9, 0.95, 1.0, 0.35];
const QUANTITY_IDS = Object.keys(QUANTITY_RAMPS);

export class AnugaPlaybackRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        // TASK-2655 (W6.5, epic 2618) — BLOCKER fix. This element is handed
        // back from render() below and OL's own composite renderer (core OL
        // code this class deliberately does not own/edit — see
        // AnugaPlaybackLayer.js's header) appends it as a direct child of
        // `.ol-layers`. Its DEFAULT `position: static` sits next to the
        // sibling `.ol-layer` tile-composite div, which IS `position:
        // absolute` — and CSS paint order stacks every positioned element
        // above every static one regardless of DOM order, so a static
        // canvas composites UNDER the basemap no matter how correctly it
        // draws (W6 UAT proof chain: meshReady===true, gl.readPixels
        // returned the full drawn band, yet the composited page showed
        // nothing; canvas.style.position='absolute' made it appear
        // instantly, correctly geo-aligned). Setting this HERE, before OL
        // or anything else ever touches the element, means the canvas can
        // never be observed — even for one frame — in its unpositioned
        // state. top/left pin it to the layer container's own origin (OL
        // sizes the container itself; this element only needs to fill it).
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0px';
        this.canvas.style.left = '0px';
        this.gl = this.canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
        if (!this.gl) {
            throw new Error('AnugaPlaybackRenderer: WebGL2 is not available in this browser');
        }
        const gl = this.gl;

        this.meshProgram = linkProgram(gl, MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER);
        this.wireProgram = linkProgram(gl, WIRE_VERTEX_SHADER, WIRE_FRAGMENT_SHADER);
        this.meshUniforms = {
            uProj: gl.getUniformLocation(this.meshProgram, 'uProj'),
            uMixT: gl.getUniformLocation(this.meshProgram, 'uMixT'),
            uColorMode: gl.getUniformLocation(this.meshProgram, 'uColorMode'),
            uColorMax: gl.getUniformLocation(this.meshProgram, 'uColorMax'),
            uColorMin: gl.getUniformLocation(this.meshProgram, 'uColorMin'),
            uWetThreshold: gl.getUniformLocation(this.meshProgram, 'uWetThreshold'),
            uG: gl.getUniformLocation(this.meshProgram, 'uG'),
            uRhoW: gl.getUniformLocation(this.meshProgram, 'uRhoW'),
            uDt: gl.getUniformLocation(this.meshProgram, 'uDt'),
            uLUT: gl.getUniformLocation(this.meshProgram, 'uLUT')
        };
        this.wireUniforms = {
            uProj: gl.getUniformLocation(this.wireProgram, 'uProj'),
            uColor: gl.getUniformLocation(this.wireProgram, 'uColor')
        };

        // TASK-2629 (W4.1) — one LUT PER quantity (all eight), each built
        // from that quantity's own real-or-documented colour stops
        // (playbackColormap.QUANTITY_RAMPS — see its header), so the legend
        // and the live render can never show two different ramps for the
        // same quantity. colorMax/colorMin are passed per-render (the
        // caller's display-range choice); a LUT only needs rebuilding when
        // its range actually changes. `hazard` uses a DISCRETE (not
        // interpolated) LUT + NEAREST filtering (playbackColormap.
        // buildDiscreteColormapLUT's header) since it is a classification,
        // not a continuous physical ramp.
        this.lutTextures = {};
        this.lutRange = {};
        QUANTITY_IDS.forEach((id) => {
            this.lutTextures[id] = null;
            this.lutRange[id] = null;
            this._ensureLUT(gl, id, 0, QUANTITY_RAMPS[id].max);
        });

        this.posBuf = gl.createBuffer();
        this.elevBuf = gl.createBuffer();
        this.qty0Buf = gl.createBuffer();
        this.qty1Buf = gl.createBuffer();
        this.frictionBuf = gl.createBuffer();
        this.inradiusBuf = gl.createBuffer();
        this.idxBuf = gl.createBuffer();
        this.wireIdxBuf = gl.createBuffer();

        this.meshVao = gl.createVertexArray();
        gl.bindVertexArray(this.meshVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.elevBuf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.qty0Buf);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.qty1Buf);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.frictionBuf);
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.inradiusBuf);
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
        gl.bindVertexArray(null);

        this.wireVao = gl.createVertexArray();
        gl.bindVertexArray(this.wireVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wireIdxBuf);
        gl.bindVertexArray(null);

        this.nIndices = 0;
        this.nWireIndices = 0;
        // TASK-2734 (W3, epic 2706) — lazy wireframe state. `_wireSourceFnc`
        // is the mesh's own face_node_connectivity (a reference, not a copy),
        // parked by setMesh so the FIRST render() with wireframe===true can
        // build the edge buffer. `_wireBuildCount` is the memoisation witness
        // the karma case asserts on (it must be 1 after any number of
        // wireframe frames, and 0 while the wireframe is off).
        this._wireSourceFnc = null;
        this._wireStride = 1;
        this._wireIndicesBuilt = false;
        this._wireBuildCount = 0;
        this.meshReady = false;
        // TASK-2686 — set for real in setMesh once triangleCount is known;
        // these defaults just match the small-mesh AC (byte-identical to
        // pre-TASK-2686: full WIRE_COLOR alpha, blending never enabled).
        this._wireOpacity = WIRE_COLOR[3];
        this._wireBlendEnabled = false;

        // TASK-2632 (W5.1) — the velocity FBO + instanced-arrow overlay is a
        // composed sub-renderer (own program/VAO/texture objects, own math
        // module) rather than inlined here, so its GL-calls-only shell stays
        // as thin/testable as this class's own. Gracefully no-ops end to end
        // on a GPU/browser without EXT_color_buffer_float(_half) — see its
        // own header.
        this.flowViz = new AnugaPlaybackFlowVizRenderer(gl);
        // TASK-2633 (W5.2) — the particle-advection + trails overlay shares
        // the SAME float-texture format flowViz already picked (one
        // extension probe, not two) and samples flowViz's velocity texture
        // every frame rather than owning its own copy.
        this.particles = new AnugaPlaybackParticleRenderer(gl, this.flowViz.format);
        // Real wall-clock dt for particle advection — INDEPENDENT of the
        // playback transport's own sim-time dt (uDt/mixT): particles must
        // keep animating on a frozen (paused) field just as much as an
        // evolving one (AC), so their own step needs real elapsed seconds
        // between successive render() calls, not the sim clock.
        this._lastParticleFrameTimeMs = null;
    }

    /**
     * Upload static per-vertex geometry (position already reprojected to
     * EPSG:3857, elevation, friction, inradius) + the triangle index buffer +
     * its derived wireframe edge buffer. Called once per mesh (i.e. once per
     * run/store), not per frame. `friction`/`inradius` are OPTIONAL (an
     * older caller/test that only exercises depth/speed can omit them; they
     * default to zero-filled arrays so the buffers stay well-formed for the
     * derived quantities that DO need them).
     * @param {{x3857: Float64Array, y3857: Float64Array, elevation: Float32Array, faceNodeConnectivity: Int32Array, friction?: Float32Array, inradius?: Float32Array}} mesh
     */
    setMesh({ x3857, y3857, elevation, faceNodeConnectivity, friction, inradius }) {
        const gl = this.gl;
        const n = x3857.length;
        const pos = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
            pos[i * 2] = x3857[i];
            pos[i * 2 + 1] = y3857[i];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.elevBuf);
        gl.bufferData(gl.ARRAY_BUFFER, elevation, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.frictionBuf);
        gl.bufferData(gl.ARRAY_BUFFER, friction && friction.length === n ? friction : new Float32Array(n), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.inradiusBuf);
        gl.bufferData(gl.ARRAY_BUFFER, inradius && inradius.length === n ? inradius : new Float32Array(n), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceNodeConnectivity, gl.STATIC_DRAW);
        this.nIndices = faceNodeConnectivity.length;

        // TASK-2686 (W6.75.4) — legibility at scale: a >=500k-triangle mesh's
        // FULL wireframe (every edge, fixed opacity) whites out the viewport
        // at any practical zoom (edge count alone, not per-frame draw cost,
        // is the problem — see wireframeDecimationStride's docstring), so
        // decimate the edge buffer AND dim it together, computed once here
        // (mesh load), not per frame. Below the AC's reference triangle
        // count both are no-ops — byte-identical to pre-TASK-2686 output.
        const triangleCount = faceNodeConnectivity.length / 3;
        const stride = wireframeDecimationStride(triangleCount);
        // TASK-2734 (W3, epic 2706) — THE EDGE BUFFER IS NO LONGER BUILT HERE.
        // The wireframe flag defaults false (playbackController.js:130-131) and
        // reaches the renderer only as a per-frame render() param, so on a
        // prod-scale mesh this line spent a MEASURED 1,021.0 MiB / 3,139.9 ms
        // producing a buffer whose only consumer is the draw call guarded by
        // `wireframe && this.nWireIndices > 0` in render() — thrown away
        // untouched unless the operator clicks Wireframe. Keep a REFERENCE to
        // faceNodeConnectivity instead (zero retained bytes: the same array is
        // already held for the whole session in redux at
        // playbackController.js:344 and read at playbackEpics.js:471, and the
        // residency plan already prices it via
        // playbackMemoryPolicy.GEOMETRY_BYTES_PER_FACE) and build on the FIRST
        // render() that actually asks for the wireframe — see
        // _ensureWireframeIndices below.
        this._wireSourceFnc = faceNodeConnectivity;
        this._wireStride = stride;
        // TASK-2743 UAT-01 — the FACE stride the builder actually uses above
        // the <50k boundary. Derived from `stride` (never re-computed) so the
        // two can never disagree about which side of that boundary this mesh
        // is on; it is 1 exactly where `stride` is 1, which keeps small meshes
        // on the original buildWireframeIndices path.
        this._wireFaceStride = wireframeFaceStride(triangleCount);
        this._wireIndicesBuilt = false;
        this.nWireIndices = 0;
        this._wireOpacity = wireframeOpacityForTriangleCount(triangleCount, WIRE_COLOR[3]);
        // Adversarial-review fix (still TASK-2686): `stride > 1` is the SAME
        // gate wireframeDecimationStride/wireframeOpacityForTriangleCount
        // already use — reused here (not re-derived) so all three legibility
        // decisions can never disagree about which side of the AC's <50k
        // "unchanged" boundary this mesh falls on. Blending is enabled ONLY
        // above that boundary — see render()'s draw call for why: enabling
        // it unconditionally would have changed the SMALL-mesh case's
        // rendering too (opaque -> translucent lines), which the AC
        // explicitly forbids ("no regression for the case that already
        // works"), even though _wireOpacity itself already correctly stays
        // at WIRE_COLOR's original alpha for that case.
        this._wireBlendEnabled = stride > 1;

        this.meshReady = true;

        // TASK-2632 (W5.1) — the flow-viz overlay reuses THESE SAME
        // posBuf/qty0Buf/qty1Buf/idxBuf (no buffer data is duplicated), plus
        // the mesh's own world-frame bbox (for its bbox-ortho sampling
        // window) — rebuilt whenever the mesh (re)loads, same lifecycle as
        // the mesh/wire VAOs above.
        this.flowViz.setMeshBuffers({
            posBuf: this.posBuf,
            qty0Buf: this.qty0Buf,
            qty1Buf: this.qty1Buf,
            idxBuf: this.idxBuf,
            nIndices: this.nIndices,
            x3857,
            y3857
        });
    }

    /**
     * TASK-2734 (W3, epic 2706) — build the wireframe edge buffer, ONCE, the
     * first time a frame actually asks for it. Called from render() only when
     * `wireframe === true`; a session that never enables the wireframe never
     * runs a line of this.
     *
     * GL TRAP, and why this is not just the setMesh code moved. `wireIdxBuf`
     * is bound as `wireVao`'s ELEMENT_ARRAY_BUFFER in the constructor. In
     * setMesh that binding was safe because setMesh runs with NO VAO bound;
     * render() does not have that luxury — binding ELEMENT_ARRAY_BUFFER while
     * some other VAO is current MUTATES that VAO's element binding, which
     * would silently redirect the MESH draw's indices. So: save the current
     * VAO, unbind to the default VAO for the upload, and restore.
     *
     * The stride>1 path uses buildFaceDecimatedWireframeIndices (one
     * exactly-sized allocation, TASK-2743 UAT-01) — same index count and same
     * bytes as the edge builder it replaced, but every drawn primitive is a
     * CLOSED triangle instead of an unrelated fragment. The stride===1 (<50k
     * triangle) path still goes through buildWireframeIndices UNCHANGED —
     * TASK-2686's AC pins that output byte-identical, and at that size the
     * Set/Array cost is trivial anyway.
     */
    _ensureWireframeIndices() {
        if (this._wireIndicesBuilt || !this._wireSourceFnc) {
            return;
        }
        const gl = this.gl;
        const stride = this._wireStride;
        const wireIndices = stride > 1
            ? buildFaceDecimatedWireframeIndices(this._wireSourceFnc, this._wireFaceStride)
            : buildWireframeIndices(this._wireSourceFnc);
        const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wireIdxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindVertexArray(previousVao);
        this.nWireIndices = wireIndices.length;
        this._wireIndicesBuilt = true;
        this._wireBuildCount++;
    }

    /**
     * Upload the two time-buffered quantity frames (already packed vec3
     * depth/x_velocity/y_velocity per vertex — see packQuantityVec3).
     * @param {Float32Array} frame0Vec3
     * @param {Float32Array} frame1Vec3
     */
    setFrames(frame0Vec3, frame1Vec3) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.qty0Buf);
        gl.bufferData(gl.ARRAY_BUFFER, frame0Vec3, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.qty1Buf);
        gl.bufferData(gl.ARRAY_BUFFER, frame1Vec3, gl.DYNAMIC_DRAW);
    }

    /**
     * (Re)build the LUT texture for one quantity only when its display range
     * has actually changed (a fresh texture upload per render would be
     * wasteful — the range only changes when the operator switches quantity,
     * a new store's quantization loads, or — for `stage` only — the run's
     * own elevation span becomes known).
     * @param {WebGL2RenderingContext} gl
     * @param {string} id one of playbackColormap.QUANTITY_RAMPS' keys
     * @param {number} colorMin
     * @param {number} colorMax
     */
    _ensureLUT(gl, id, colorMin, colorMax) {
        const key = `${colorMin}:${colorMax}`;
        if (this.lutTextures[id] && this.lutRange[id] === key) {
            return;
        }
        if (this.lutTextures[id]) {
            gl.deleteTexture(this.lutTextures[id]);
        }
        const ramp = QUANTITY_RAMPS[id];
        const span = Math.max(1e-9, colorMax - colorMin);
        const lutData = ramp.discrete
            ? buildDiscreteColormapLUT(ramp.stops, ramp.max, 256)
            : buildQuantityColormapLUT(ramp.stops, span, 256);
        this.lutTextures[id] = uploadLUTTexture(gl, lutData, 256, ramp.discrete ? 'nearest' : 'linear');
        this.lutRange[id] = key;
    }

    /**
     * @param {object} params
     * @param {{center:[number,number], resolution:number, rotation?:number}} params.viewState
     * @param {[number,number]} params.size CSS pixels
     * @param {number} params.pixelRatio
     * @param {number} params.opacity 0-1
     * @param {boolean} [params.wireframe]
     * @param {number} [params.mixT] 0-1
     * @param {string} [params.colorMode] one of playbackDerivedQuantities.QUANTITY_IDS
     * @param {number} [params.colorMax]
     * @param {number} [params.colorMin] non-zero only for `stage`'s per-run rescale
     * @param {number} [params.wetThreshold] store's minimum_storable_height
     * @param {number} [params.g] store attr `g`
     * @param {number} [params.rhoW] store attr `rho_w`
     * @param {number} [params.dt] frame-mixed dt(t), seconds
     * @param {boolean} [params.flowVizEnabled] TASK-2632 (W5.1) velocity-arrow overlay toggle
     * @param {number} [params.arrowDensity] screen-space grid spacing, px (smaller = denser)
     * @param {number} [params.arrowScale] multiplier on the computed max arrow length
     * @param {boolean} [params.particlesEnabled] TASK-2633 (W5.2) particle-trail overlay toggle
     * @param {number} [params.particleDensity] particle-grid side length (playbackParticles.clampParticleGrid)
     * @param {number} [params.particleSpeedExaggeration] multiplier on the advection speed scale
     * @returns {HTMLCanvasElement}
     */
    render({
        viewState, size, pixelRatio, opacity, wireframe = false, mixT = 0,
        colorMode = 'depth', colorMax = 1, colorMin = 0, wetThreshold = 1e-5,
        g = 9.8, rhoW = 1000, dt = 0,
        flowVizEnabled = false, arrowDensity, arrowScale,
        particlesEnabled = false, particleDensity, particleSpeedExaggeration
    }) {
        const gl = this.gl;
        const canvas = this.canvas;
        const width = Math.max(1, Math.round(size[0] * pixelRatio));
        const height = Math.max(1, Math.round(size[1] * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        canvas.style.width = `${size[0]}px`;
        canvas.style.height = `${size[1]}px`;
        // The layer owns opacity/visibility/pixel-ratio itself (no
        // ol/webgl/Helper doing it for us) — applied as CSS opacity on the
        // returned canvas element, the same seam ol's own canvas renderers use.
        canvas.style.opacity = String(opacity);

        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (!this.meshReady || this.nIndices === 0) {
            return canvas;
        }

        const projMatrix = buildProjectionMatrix(viewState, size);
        // TASK-2629 — pick (and lazily rebuild, on range change) the LUT for
        // the ACTIVE quantity, built from that quantity's own colour stops
        // (playbackColormap.QUANTITY_RAMPS), so no two quantities ever share
        // a ramp/legend by accident.
        const mode = QUANTITY_RAMPS[colorMode] ? colorMode : 'depth';
        const modeIndex = QUANTITY_MODE_INDEX[mode];
        const safeColorMax = colorMax > colorMin ? colorMax : colorMin + 1;
        this._ensureLUT(gl, mode, colorMin, safeColorMax);

        gl.useProgram(this.meshProgram);
        gl.bindVertexArray(this.meshVao);
        gl.uniformMatrix3fv(this.meshUniforms.uProj, false, projMatrix);
        gl.uniform1f(this.meshUniforms.uMixT, mixT);
        gl.uniform1i(this.meshUniforms.uColorMode, modeIndex);
        gl.uniform1f(this.meshUniforms.uColorMax, safeColorMax);
        gl.uniform1f(this.meshUniforms.uColorMin, colorMin);
        gl.uniform1f(this.meshUniforms.uWetThreshold, wetThreshold);
        gl.uniform1f(this.meshUniforms.uG, g);
        gl.uniform1f(this.meshUniforms.uRhoW, rhoW);
        gl.uniform1f(this.meshUniforms.uDt, dt);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.lutTextures[mode]);
        gl.uniform1i(this.meshUniforms.uLUT, 0);
        gl.drawElements(gl.TRIANGLES, this.nIndices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        // TASK-2632/2633 (W5.1/W5.2) — flow-viz arrows and particle trails
        // draw BETWEEN the scalar mesh fill and the wireframe pass (AC), so
        // wireframe stays the topmost layer. Both overlays share ONE
        // velocity-field render this frame (never rebuilt per-overlay —
        // wave brief: "the texture is ALSO W5.2's advection source. Build
        // it once in 2632"). renderVelocityField rebinds the FBO/viewport to
        // the offscreen velocity texture's own size; restore the main
        // canvas viewport before drawing either overlay into it.
        if (flowVizEnabled || particlesEnabled) {
            const bboxOrtho = this.flowViz.renderVelocityField({ mixT, wetThreshold });
            gl.viewport(0, 0, width, height);
            if (flowVizEnabled && bboxOrtho) {
                this.flowViz.renderArrows({
                    bboxOrtho, viewState, sizeCssPx: size, wetThreshold,
                    density: arrowDensity, scale: arrowScale
                });
            }
            if (particlesEnabled && bboxOrtho) {
                const gridSize = clampParticleGrid(particleDensity);
                this.particles.ensureParticles(gridSize);
                const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
                const dtSec = this._lastParticleFrameTimeMs !== null
                    ? Math.min(0.1, Math.max(0, (nowMs - this._lastParticleFrameTimeMs) / 1000))
                    : (1 / 60);
                this._lastParticleFrameTimeMs = nowMs;
                const velocityTexture = this.flowViz.getVelocityTexture();
                // TASK-2743 UAT-02 — viewState/size/bboxOrtho drive the
                // respawn+cull rects. All three are already in scope and are
                // the SAME values renderTrails below receives, so the advect
                // pass and the draw pass can never disagree about the view.
                this.particles.step({
                    velocityTexture, dtSec, speedExaggeration: particleSpeedExaggeration,
                    viewState, sizeCssPx: size, bboxOrtho
                });
                this.particles.renderTrails({
                    velocityTexture, bboxOrtho, projMatrix, viewState, sizeCssPx: size,
                    canvasWidth: width, canvasHeight: height, wetThreshold, trailsEnabled: true
                });
            }
        }
        if (!particlesEnabled) {
            // Reset the dt baseline while particles are off, so re-enabling
            // later doesn't compute one giant dt from a stale timestamp.
            this._lastParticleFrameTimeMs = null;
        }

        // TASK-2734 (W3, epic 2706) — build the edge buffer on the FIRST frame
        // that asks for it. This MUST sit before the gate below: inside it,
        // `this.nWireIndices > 0` would never be true on the first wireframe
        // frame and the buffer could never be built at all.
        if (wireframe) {
            this._ensureWireframeIndices();
        }
        if (wireframe && this.nWireIndices > 0) {
            gl.useProgram(this.wireProgram);
            gl.bindVertexArray(this.wireVao);
            gl.uniformMatrix3fv(this.wireUniforms.uProj, false, projMatrix);
            // TASK-2686 (W6.75.4) — this._wireBlendEnabled/this._wireOpacity
            // are set together in setMesh, both gated on the SAME <50k
            // triangle boundary. Below it: byte-identical to before this
            // task — original WIRE_COLOR uniform4fv call, blending never
            // touched (was never enabled for this draw call at all, so
            // WIRE_COLOR's alpha channel was always silently discarded —
            // every edge drew fully opaque; changing that for EVERY mesh
            // size would have altered the small-mesh case's actual
            // rendered pixels, which the AC forbids, even though the
            // computed opacity VALUE alone already stayed unchanged).
            // Above it: dimmed + blended, on top of the edge-buffer
            // decimation already applied in setMesh — together these are
            // the two legibility levers (AC: "zoom-gating, edge
            // opacity/width tuning, edge decimation, or a combination").
            if (this._wireBlendEnabled) {
                gl.uniform4f(this.wireUniforms.uColor, WIRE_COLOR[0], WIRE_COLOR[1], WIRE_COLOR[2], this._wireOpacity);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.drawElements(gl.LINES, this.nWireIndices, gl.UNSIGNED_INT, 0);
                gl.disable(gl.BLEND);
            } else {
                gl.uniform4fv(this.wireUniforms.uColor, WIRE_COLOR);
                gl.drawElements(gl.LINES, this.nWireIndices, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
        }

        return canvas;
    }

    dispose() {
        const gl = this.gl;
        [this.posBuf, this.elevBuf, this.qty0Buf, this.qty1Buf, this.frictionBuf, this.inradiusBuf, this.idxBuf, this.wireIdxBuf].forEach((b) => gl.deleteBuffer(b));
        [this.meshVao, this.wireVao].forEach((v) => gl.deleteVertexArray(v));
        [this.meshProgram, this.wireProgram].forEach((p) => gl.deleteProgram(p));
        Object.keys(this.lutTextures).forEach((mode) => {
            if (this.lutTextures[mode]) {
                gl.deleteTexture(this.lutTextures[mode]);
            }
        });
        // TASK-2632/2633 (W5.1/W5.2) — free the composed flow-viz + particle
        // sub-renderers' own FBO/texture/program/VAO objects too (the W2
        // wave report's simplify-pass finding — "dispose() existed but
        // nothing ever called it" — applies equally to sub-renderers added
        // later; AC: "own the memory/context-loss handling ... free
        // particle textures/FBOs on layer removal via the existing
        // detached-layer .remove() path").
        this.flowViz.dispose();
        this.particles.dispose();
    }
}

export default AnugaPlaybackRenderer;
