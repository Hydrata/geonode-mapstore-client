/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AnugaPlaybackFlowVizRenderer — the GL-calls-only shell for the velocity
 * FBO + instanced-arrow overlay (TASK-2632, W5.1, epic 2618). Owned/composed
 * by AnugaPlaybackRenderer (never instantiated standalone in production —
 * see that class's `render()`, which draws this BETWEEN the scalar mesh
 * fill and the wireframe pass, per the AC). All sampling/projection/sizing
 * MATH lives in playbackFlowViz.js (headlessly karma-tested); this class
 * only owns the FBO/program/VAO/texture objects and issues draw calls —
 * mirrors AnugaPlaybackRenderer's own math/GL split.
 *
 * Gracefully no-ops end to end when `pickVelocityTextureFormat` finds
 * neither EXT_color_buffer_float nor EXT_color_buffer_half_float — every
 * public method becomes a safe no-op (`this.supported === false`) rather
 * than throwing, so a GPU/browser without either extension just never shows
 * the overlay (AC scope is additive — flow-viz on top of the existing
 * scalar mesh, which always renders regardless of this class's support).
 */
import { linkProgram } from './playbackShaders';
import { computeMeshBounds } from './playbackMeshGeometry';
import {
    VEL_TEX_SIZE,
    resolveVelocityTextureSize,
    pickVelocityTextureFormat,
    shouldUseLinearFiltering,
    computeBboxOrtho,
    computeArrowGridDimensions,
    computeArrowMaxLengthPx,
    composeNdcToVelocityUvMatrix,
    DEFAULT_ARROW_DENSITY_PX,
    DEFAULT_ARROW_SCALE,
    ARROW_Q_REF,
    ARROW_SPEED_REF,
    ARROW_MIN_SPEED,
    FLOWVIZ_VELOCITY_VERTEX_SHADER,
    FLOWVIZ_VELOCITY_FRAGMENT_SHADER,
    FLOWVIZ_ARROW_VERTEX_SHADER,
    FLOWVIZ_ARROW_FRAGMENT_SHADER,
    ARROW_SHAPE_VERTICES
} from './playbackFlowViz';

export class AnugaPlaybackFlowVizRenderer {
    constructor(gl) {
        this.gl = gl;
        this.format = pickVelocityTextureFormat(gl);
        this.supported = !!this.format;
        this.velTex = null;
        this.velFbo = null;
        this.velFboComplete = false;
        // TASK-2743 UAT-03 — the size actually accepted (may be < VEL_TEX_SIZE
        // if the GPU refused the FBO); 0 until _ensureVelocityTexture runs.
        this.velTexSize = 0;
        this.velVao = null;
        this.arrowVao = null;
        this.arrowShapeBuf = null;
        this.meshNIndices = 0;
        this.meshBbox = null; // [minX, minY, maxX, maxY], set by setMeshBuffers
        if (!this.supported) {
            return;
        }
        this.velProgram = linkProgram(gl, FLOWVIZ_VELOCITY_VERTEX_SHADER, FLOWVIZ_VELOCITY_FRAGMENT_SHADER);
        this.arrowProgram = linkProgram(gl, FLOWVIZ_ARROW_VERTEX_SHADER, FLOWVIZ_ARROW_FRAGMENT_SHADER);
        this.velUniforms = {
            uBboxOrtho: gl.getUniformLocation(this.velProgram, 'uBboxOrtho'),
            uMixT: gl.getUniformLocation(this.velProgram, 'uMixT'),
            uWetThreshold: gl.getUniformLocation(this.velProgram, 'uWetThreshold')
        };
        this.arrowUniforms = {
            uVelTex: gl.getUniformLocation(this.arrowProgram, 'uVelTex'),
            // TASK-2661 audit — CPU-precomposed NDC->velocity-UV matrix,
            // replacing the former separate uInvProj/uBboxOrtho pair (see
            // composeNdcToVelocityUvMatrix's docstring).
            uNdcToUv: gl.getUniformLocation(this.arrowProgram, 'uNdcToUv'),
            uCols: gl.getUniformLocation(this.arrowProgram, 'uCols'),
            uRows: gl.getUniformLocation(this.arrowProgram, 'uRows'),
            uQRef: gl.getUniformLocation(this.arrowProgram, 'uQRef'),
            uSpeedRef: gl.getUniformLocation(this.arrowProgram, 'uSpeedRef'),
            uMinSpeed: gl.getUniformLocation(this.arrowProgram, 'uMinSpeed'),
            uWetThreshold: gl.getUniformLocation(this.arrowProgram, 'uWetThreshold'),
            uMaxLenPx: gl.getUniformLocation(this.arrowProgram, 'uMaxLenPx'),
            uViewportPx: gl.getUniformLocation(this.arrowProgram, 'uViewportPx')
        };
        this._ensureVelocityTexture();
        this._ensureArrowGeometry();
    }

    _ensureVelocityTexture() {
        if (this.velFbo) {
            return;
        }
        const gl = this.gl;
        // W0 scar: an incomplete/undefined filtering mode silently samples
        // as zero — request LINEAR only when its extension is actually
        // present, else NEAREST (correct, just blockier).
        const linear = shouldUseLinearFiltering(gl, this.format.type === gl.FLOAT);
        const filter = linear ? gl.LINEAR : gl.NEAREST;
        // TASK-2743 UAT-03 — try VEL_TEX_SIZE, halving on an incomplete FBO.
        // Before this, velFboComplete was computed here and read by NOTHING, so
        // an incomplete FBO rendered garbage instead of disabling the overlay;
        // raising the requested size makes that path more reachable, so it is
        // now actually handled. Each failed attempt frees its own objects.
        const accepted = resolveVelocityTextureSize(VEL_TEX_SIZE, (size) => {
            this.velTex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.velTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format.internal, size, size, 0, this.format.format, this.format.type, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.velFbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.velFbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.velTex, 0);
            const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (!ok) {
                gl.deleteFramebuffer(this.velFbo);
                gl.deleteTexture(this.velTex);
                this.velFbo = null;
                this.velTex = null;
            }
            return ok;
        });
        this.velTexSize = accepted;
        this.velFboComplete = accepted > 0;
        if (!accepted) {
            // Nothing renders rather than something wrong.
            this.supported = false;
        }
    }

    _ensureArrowGeometry() {
        if (this.arrowVao) {
            return;
        }
        const gl = this.gl;
        this.arrowShapeBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowShapeBuf);
        gl.bufferData(gl.ARRAY_BUFFER, ARROW_SHAPE_VERTICES, gl.STATIC_DRAW);
        this.arrowVao = gl.createVertexArray();
        gl.bindVertexArray(this.arrowVao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }

    /**
     * (Re)bind the SAME mesh buffers AnugaPlaybackRenderer already owns
     * (posBuf/qty0Buf/qty1Buf/idxBuf) into this renderer's OWN VAO — no
     * buffer DATA is duplicated, only the attribute/index bindings. Called
     * whenever the mesh (re)loads (AnugaPlaybackRenderer.setMesh).
     * @param {{posBuf: WebGLBuffer, qty0Buf: WebGLBuffer, qty1Buf: WebGLBuffer, idxBuf: WebGLBuffer, nIndices: number, x3857: (Float64Array|Float32Array), y3857: (Float64Array|Float32Array)}} params
     */
    setMeshBuffers({ posBuf, qty0Buf, qty1Buf, idxBuf, nIndices, x3857, y3857 }) {
        this.meshNIndices = nIndices;
        this.meshBbox = computeMeshBounds(x3857, y3857);
        if (!this.supported) {
            return;
        }
        const gl = this.gl;
        this.velVao = this.velVao || gl.createVertexArray();
        gl.bindVertexArray(this.velVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, qty0Buf);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, qty1Buf);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bindVertexArray(null);
    }

    /**
     * Render the (u,v,h) field into the offscreen velocity texture — must
     * run before renderArrows (or a W5.2 particle-advection step) in the
     * same frame. Restores neither viewport nor framebuffer binding beyond
     * its own work — the caller (AnugaPlaybackRenderer.render) owns the main
     * canvas viewport/framebuffer state between draw calls, same convention
     * the existing mesh/wireframe passes already follow.
     * @returns {{cx:number,cy:number,halfW:number,halfH:number}|null} the bbox-ortho window used this frame (callers MUST reuse it — arrows/particles have to sample the SAME window), or null if unsupported/no mesh yet
     */
    renderVelocityField({ mixT, wetThreshold }) {
        if (!this.supported || !this.meshNIndices || !this.meshBbox) {
            return null;
        }
        const gl = this.gl;
        const bboxOrtho = computeBboxOrtho(this.meshBbox);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velFbo);
        gl.viewport(0, 0, this.velTexSize, this.velTexSize);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.velProgram);
        gl.bindVertexArray(this.velVao);
        gl.uniform4f(this.velUniforms.uBboxOrtho, bboxOrtho.cx, bboxOrtho.cy, bboxOrtho.halfW, bboxOrtho.halfH);
        gl.uniform1f(this.velUniforms.uMixT, mixT || 0);
        gl.uniform1f(this.velUniforms.uWetThreshold, wetThreshold || 1e-5);
        gl.drawElements(gl.TRIANGLES, this.meshNIndices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return bboxOrtho;
    }

    /**
     * Draw the instanced screen-space arrow grid, sampling the velocity
     * texture `renderVelocityField` just wrote. Must run AFTER
     * renderVelocityField in the same frame, with the caller's main-canvas
     * viewport already active (this does not touch gl.viewport itself).
     * @param {{bboxOrtho: object, viewState: object, sizeCssPx: [number,number], wetThreshold: number, density?: number, scale?: number}} params
     */
    renderArrows({ bboxOrtho, viewState, sizeCssPx, wetThreshold, density, scale }) {
        if (!this.supported || !bboxOrtho) {
            return;
        }
        const gl = this.gl;
        const [widthCss, heightCss] = sizeCssPx;
        const spacingPx = Math.max(4, density || DEFAULT_ARROW_DENSITY_PX);
        const { cols, rows, count } = computeArrowGridDimensions(widthCss, heightCss, spacingPx);
        // TASK-2661 audit — CPU-precomposed NDC->velocity-UV matrix, JS
        // float64 throughout (see composeNdcToVelocityUvMatrix's docstring).
        const ndcToUv = composeNdcToVelocityUvMatrix(viewState, sizeCssPx, bboxOrtho);
        const maxLenPx = computeArrowMaxLengthPx(spacingPx) * Math.max(0.1, scale || DEFAULT_ARROW_SCALE);
        gl.useProgram(this.arrowProgram);
        gl.bindVertexArray(this.arrowVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velTex);
        gl.uniform1i(this.arrowUniforms.uVelTex, 0);
        gl.uniformMatrix3fv(this.arrowUniforms.uNdcToUv, false, ndcToUv);
        gl.uniform1i(this.arrowUniforms.uCols, cols);
        gl.uniform1i(this.arrowUniforms.uRows, rows);
        gl.uniform1f(this.arrowUniforms.uQRef, ARROW_Q_REF);
        gl.uniform1f(this.arrowUniforms.uSpeedRef, ARROW_SPEED_REF);
        gl.uniform1f(this.arrowUniforms.uMinSpeed, ARROW_MIN_SPEED);
        gl.uniform1f(this.arrowUniforms.uWetThreshold, wetThreshold || 1e-5);
        gl.uniform1f(this.arrowUniforms.uMaxLenPx, maxLenPx);
        gl.uniform2f(this.arrowUniforms.uViewportPx, widthCss, heightCss);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, count);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
    }

    /** @returns {WebGLTexture|null} the shared velocity texture — W5.2's particle-advection source (built once here, never rebuilt). */
    getVelocityTexture() {
        return this.supported ? this.velTex : null;
    }

    /** @returns {[number,number,number,number]|null} the mesh's world-frame bbox, for a caller (the particle renderer) that needs computeBboxOrtho independently. */
    getMeshBbox() {
        return this.meshBbox;
    }

    /**
     * Debug readback (ports the W0 spike's `__flowVizDebug` technique, wave
     * brief: "port the FBO/particle readback DEBUG technique into your live
     * verification") — proves the velocity texture is non-zero where flow
     * exists and zero/masked where dry, from DATA rather than a screenshot.
     */
    debugReadVelocityField() {
        if (!this.supported) {
            return { supported: false };
        }
        const gl = this.gl;
        const n = this.velTexSize;
        const buf = new Float32Array(n * n * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velFbo);
        const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.readPixels(0, 0, n, n, gl.RGBA, gl.FLOAT, buf);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        let vMax = 0;
        let vNonZero = 0;
        for (let i = 0; i < n * n; i++) {
            const s = Math.hypot(buf[i * 4], buf[i * 4 + 1]);
            if (s > vMax) {
                vMax = s;
            }
            if (s > ARROW_MIN_SPEED) {
                vNonZero++;
            }
        }
        return {
            supported: true,
            velFboComplete: complete,
            velMaxSpeed: vMax,
            velFlowingTexels: vNonZero,
            velTotalTexels: n * n,
            velFlowingFraction: +(vNonZero / (n * n)).toFixed(4),
            glError: gl.getError()
        };
    }

    dispose() {
        if (!this.supported) {
            return;
        }
        const gl = this.gl;
        if (this.velTex) {
            gl.deleteTexture(this.velTex);
        }
        if (this.velFbo) {
            gl.deleteFramebuffer(this.velFbo);
        }
        if (this.arrowShapeBuf) {
            gl.deleteBuffer(this.arrowShapeBuf);
        }
        [this.velVao, this.arrowVao].forEach((v) => v && gl.deleteVertexArray(v));
        [this.velProgram, this.arrowProgram].forEach((p) => p && gl.deleteProgram(p));
    }
}

export default AnugaPlaybackFlowVizRenderer;
