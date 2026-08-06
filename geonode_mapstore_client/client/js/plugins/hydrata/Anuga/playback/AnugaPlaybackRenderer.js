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
import { buildWireframeIndices, buildProjectionMatrix } from './playbackMeshGeometry';

const WIRE_COLOR = [0.9, 0.95, 1.0, 0.35];
const QUANTITY_IDS = Object.keys(QUANTITY_RAMPS);

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
        this.meshReady = false;
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
     * @returns {HTMLCanvasElement}
     */
    render({
        viewState, size, pixelRatio, opacity, wireframe = false, mixT = 0,
        colorMode = 'depth', colorMax = 1, colorMin = 0, wetThreshold = 1e-5,
        g = 9.8, rhoW = 1000, dt = 0
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
        [this.posBuf, this.elevBuf, this.qty0Buf, this.qty1Buf, this.frictionBuf, this.inradiusBuf, this.idxBuf, this.wireIdxBuf].forEach((b) => gl.deleteBuffer(b));
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
