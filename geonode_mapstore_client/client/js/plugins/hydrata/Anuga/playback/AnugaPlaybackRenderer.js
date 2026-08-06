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
    DEPTH_SLD_STOPS,
    DEPTH_SLD_MAX,
    VELOCITY_SLD_STOPS,
    VELOCITY_SLD_MAX
} from './playbackColormap';
import { buildWireframeIndices, buildProjectionMatrix } from './playbackMeshGeometry';

const WIRE_COLOR = [0.9, 0.95, 1.0, 0.35];

export class AnugaPlaybackRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
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
            uWetThreshold: gl.getUniformLocation(this.meshProgram, 'uWetThreshold'),
            uLUT: gl.getUniformLocation(this.meshProgram, 'uLUT')
        };
        this.wireUniforms = {
            uProj: gl.getUniformLocation(this.wireProgram, 'uProj'),
            uColor: gl.getUniformLocation(this.wireProgram, 'uColor')
        };

        // TASK-2628 (W3.2) — one LUT PER quantity, each built from that
        // quantity's own real SLD colour stops (depth_6m.sld /
        // velocity_6ms.sld — see playbackColormap.js's header), so the
        // legend and the live render can never show two different ramps for
        // "depth" vs "speed". colorMax is passed per-render (the caller's
        // display-range choice — e.g. the store's own valid_max for a flood
        // that exceeds the SLD's fixed 6-unit cap); the LUT itself only
        // needs rebuilding when colorMax actually changes.
        this.lutTextures = { depth: null, speed: null };
        this.lutColorMax = { depth: null, speed: null };
        this.sldStops = { depth: DEPTH_SLD_STOPS, speed: VELOCITY_SLD_STOPS };
        this._ensureLUT(gl, 'depth', DEPTH_SLD_MAX);
        this._ensureLUT(gl, 'speed', VELOCITY_SLD_MAX);

        this.posBuf = gl.createBuffer();
        this.elevBuf = gl.createBuffer();
        this.qty0Buf = gl.createBuffer();
        this.qty1Buf = gl.createBuffer();
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
        this.meshReady = false;
    }

    /**
     * Upload static per-vertex geometry (position already reprojected to
     * EPSG:3857, elevation) + the triangle index buffer + its derived
     * wireframe edge buffer. Called once per mesh (i.e. once per run/store),
     * not per frame.
     * @param {{x3857: Float64Array, y3857: Float64Array, elevation: Float32Array, faceNodeConnectivity: Int32Array}} mesh
     */
    setMesh({ x3857, y3857, elevation, faceNodeConnectivity }) {
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
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceNodeConnectivity, gl.STATIC_DRAW);
        this.nIndices = faceNodeConnectivity.length;

        const wireIndices = buildWireframeIndices(faceNodeConnectivity);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wireIdxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);
        this.nWireIndices = wireIndices.length;

        this.meshReady = true;
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
     * (Re)build the LUT texture for one colour mode only when its display
     * colorMax has actually changed (a fresh texture upload per render
     * would be wasteful — colorMax only changes when the operator switches
     * quantity or a new store's quantization loads).
     * @param {WebGL2RenderingContext} gl
     * @param {'depth'|'speed'} mode
     * @param {number} colorMax
     */
    _ensureLUT(gl, mode, colorMax) {
        if (this.lutTextures[mode] && this.lutColorMax[mode] === colorMax) {
            return;
        }
        if (this.lutTextures[mode]) {
            gl.deleteTexture(this.lutTextures[mode]);
        }
        const lutData = buildQuantityColormapLUT(this.sldStops[mode], colorMax, 256);
        this.lutTextures[mode] = uploadLUTTexture(gl, lutData, 256);
        this.lutColorMax[mode] = colorMax;
    }

    /**
     * @param {object} params
     * @param {{center:[number,number], resolution:number, rotation?:number}} params.viewState
     * @param {[number,number]} params.size CSS pixels
     * @param {number} params.pixelRatio
     * @param {number} params.opacity 0-1
     * @param {boolean} [params.wireframe]
     * @param {number} [params.mixT] 0-1
     * @param {'depth'|'speed'} [params.colorMode]
     * @param {number} [params.colorMax]
     * @param {number} [params.wetThreshold]
     * @returns {HTMLCanvasElement}
     */
    render({ viewState, size, pixelRatio, opacity, wireframe = false, mixT = 0, colorMode = 'depth', colorMax = 1, wetThreshold = 1e-5 }) {
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
        // TASK-2628 — pick (and lazily rebuild, on colorMax change) the LUT
        // for the ACTIVE quantity, built from that quantity's own real SLD
        // stops (playbackColormap.js), so depth and speed never share a ramp.
        const mode = colorMode === 'speed' ? 'speed' : 'depth';
        this._ensureLUT(gl, mode, colorMax > 0 ? colorMax : 1);

        gl.useProgram(this.meshProgram);
        gl.bindVertexArray(this.meshVao);
        gl.uniformMatrix3fv(this.meshUniforms.uProj, false, projMatrix);
        gl.uniform1f(this.meshUniforms.uMixT, mixT);
        gl.uniform1i(this.meshUniforms.uColorMode, colorMode === 'speed' ? 1 : 0);
        gl.uniform1f(this.meshUniforms.uColorMax, colorMax);
        gl.uniform1f(this.meshUniforms.uWetThreshold, wetThreshold);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.lutTextures[mode]);
        gl.uniform1i(this.meshUniforms.uLUT, 0);
        gl.drawElements(gl.TRIANGLES, this.nIndices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        if (wireframe && this.nWireIndices > 0) {
            gl.useProgram(this.wireProgram);
            gl.bindVertexArray(this.wireVao);
            gl.uniformMatrix3fv(this.wireUniforms.uProj, false, projMatrix);
            gl.uniform4fv(this.wireUniforms.uColor, WIRE_COLOR);
            gl.drawElements(gl.LINES, this.nWireIndices, gl.UNSIGNED_INT, 0);
            gl.bindVertexArray(null);
        }

        return canvas;
    }

    dispose() {
        const gl = this.gl;
        [this.posBuf, this.elevBuf, this.qty0Buf, this.qty1Buf, this.idxBuf, this.wireIdxBuf].forEach((b) => gl.deleteBuffer(b));
        [this.meshVao, this.wireVao].forEach((v) => gl.deleteVertexArray(v));
        [this.meshProgram, this.wireProgram].forEach((p) => gl.deleteProgram(p));
        Object.keys(this.lutTextures).forEach((mode) => {
            if (this.lutTextures[mode]) {
                gl.deleteTexture(this.lutTextures[mode]);
            }
        });
    }
}

export default AnugaPlaybackRenderer;
