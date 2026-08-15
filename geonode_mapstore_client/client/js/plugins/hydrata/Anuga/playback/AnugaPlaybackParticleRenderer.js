/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AnugaPlaybackParticleRenderer — the GL-calls-only shell for the GPU
 * particle-advection + fading-trails overlay (TASK-2633, W5.2, epic 2618).
 * Owned/composed by AnugaPlaybackRenderer, drawn in the SAME
 * scalar-fill -> overlay -> wireframe slot the W5.1 arrow overlay occupies
 * (AC). Samples the velocity texture AnugaPlaybackFlowVizRenderer builds —
 * this class NEVER builds its own velocity FBO (the wave brief: "the
 * texture is ALSO W5.2's advection source. Build it once in 2632").
 *
 * All sampling/spawn-kill/speed-scaling/camera-key MATH lives in
 * playbackParticles.js (headlessly karma-tested); this class only owns the
 * ping-pong position/trail FBOs/textures/programs and issues draw calls —
 * mirrors AnugaPlaybackFlowVizRenderer's own math/GL split.
 *
 * Gracefully no-ops end to end when the shared float-texture format is
 * unavailable (`supported === false`, mirrors the flow-viz renderer).
 *
 * Own memory/context-loss handling (AC): `dispose()` frees every
 * texture/FBO/program/VAO this class owns; `resize()`/`ensureParticles()`
 * dispose their OWN stale objects before rebuilding — no GL resource is
 * ever silently leaked across a canvas resize or a density-control change.
 */
import { linkProgram } from './playbackShaders';
import {
    PARTICLE_MIN_SPEED,
    PARTICLE_DROP_RATE,
    PARTICLE_STALL_DROP_RATE,
    DEFAULT_TRAIL_FADE,
    computeAdvectionSpeedScale,
    initialParticlePositions,
    buildCameraKey,
    hasCameraMoved,
    composePosToClipMatrix,
    computeParticleViewRects,
    PARTICLE_ADVECT_VERTEX_SHADER,
    PARTICLE_ADVECT_FRAGMENT_SHADER,
    PARTICLE_RENDER_VERTEX_SHADER,
    PARTICLE_RENDER_FRAGMENT_SHADER,
    TRAIL_QUAD_VERTEX_SHADER,
    TRAIL_FADE_FRAGMENT_SHADER,
    TRAIL_COPY_FRAGMENT_SHADER,
    FULLSCREEN_QUAD_VERTICES
} from './playbackParticles';

export class AnugaPlaybackParticleRenderer {
    /**
     * @param {WebGL2RenderingContext} gl
     * @param {{internal:number,type:number,format:number,label:string}|null} format the SAME format AnugaPlaybackFlowVizRenderer picked (shared — no second extension probe)
     */
    constructor(gl, format) {
        this.gl = gl;
        this.format = format;
        this.supported = !!format;
        this.gridSize = 0;
        this.particleTexs = null;
        this.particleFbos = null;
        this.particlePing = 0;
        this.trailTexs = null;
        this.trailFbos = null;
        this.trailPing = 0;
        this.trailW = 0;
        this.trailH = 0;
        this.lastCameraKey = '';
        if (!this.supported) {
            return;
        }
        this.advectProgram = linkProgram(gl, PARTICLE_ADVECT_VERTEX_SHADER, PARTICLE_ADVECT_FRAGMENT_SHADER);
        this.renderProgram = linkProgram(gl, PARTICLE_RENDER_VERTEX_SHADER, PARTICLE_RENDER_FRAGMENT_SHADER);
        this.fadeProgram = linkProgram(gl, TRAIL_QUAD_VERTEX_SHADER, TRAIL_FADE_FRAGMENT_SHADER);
        this.copyProgram = linkProgram(gl, TRAIL_QUAD_VERTEX_SHADER, TRAIL_COPY_FRAGMENT_SHADER);
        this.advectUniforms = {
            uPosTex: gl.getUniformLocation(this.advectProgram, 'uPosTex'),
            uVelTex: gl.getUniformLocation(this.advectProgram, 'uVelTex'),
            uDt: gl.getUniformLocation(this.advectProgram, 'uDt'),
            uSpeedScale: gl.getUniformLocation(this.advectProgram, 'uSpeedScale'),
            uRandSeed: gl.getUniformLocation(this.advectProgram, 'uRandSeed'),
            uDropRate: gl.getUniformLocation(this.advectProgram, 'uDropRate'),
            uStallDropRate: gl.getUniformLocation(this.advectProgram, 'uStallDropRate'),
            uMinSpeed: gl.getUniformLocation(this.advectProgram, 'uMinSpeed'),
            uWetThreshold: gl.getUniformLocation(this.advectProgram, 'uWetThreshold'),
            // TASK-2743 UAT-02 — [0,1] UV rects, see computeParticleViewRects.
            uRespawnRect: gl.getUniformLocation(this.advectProgram, 'uRespawnRect'),
            uCullRect: gl.getUniformLocation(this.advectProgram, 'uCullRect')
        };
        this.renderUniforms = {
            uPosTex: gl.getUniformLocation(this.renderProgram, 'uPosTex'),
            uVelTex: gl.getUniformLocation(this.renderProgram, 'uVelTex'),
            uGridSize: gl.getUniformLocation(this.renderProgram, 'uGridSize'),
            // TASK-2661 — CPU-precomposed pos->clip matrix (composePosToClipMatrix),
            // replacing the former separate uProj/uBboxOrtho pair.
            uPosToClip: gl.getUniformLocation(this.renderProgram, 'uPosToClip'),
            uPointSize: gl.getUniformLocation(this.renderProgram, 'uPointSize'),
            uMinSpeed: gl.getUniformLocation(this.renderProgram, 'uMinSpeed'),
            uWetThreshold: gl.getUniformLocation(this.renderProgram, 'uWetThreshold')
        };
        this.fadeUniforms = { uTex: gl.getUniformLocation(this.fadeProgram, 'uTex'), uFade: gl.getUniformLocation(this.fadeProgram, 'uFade') };
        this.copyUniforms = { uTex: gl.getUniformLocation(this.copyProgram, 'uTex') };

        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTICES, gl.STATIC_DRAW);
        // Bound to location 0 for BOTH the advect program (`aQuad`, no
        // layout qualifier -> attribute 0 by link order) and the trail
        // quad program (`layout(location=0) in vec2 aQuad`) — same buffer,
        // two VAOs (the advect draw needs no other attributes; the quad
        // draw is identical geometry, kept as a separate VAO for clarity).
        this.advectVao = gl.createVertexArray();
        gl.bindVertexArray(this.advectVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        this.quadVao = gl.createVertexArray();
        gl.bindVertexArray(this.quadVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        // Attribute-less VAO for the points draw — gl_VertexID drives the
        // fetch (spike comment: an attribute-less VAO drew nothing on
        // ANGLE/NVIDIA when bound to a buffer with too few vertices for the
        // instance count; binding a genuinely empty VAO avoids that).
        this.pointsVao = gl.createVertexArray();
    }

    /**
     * (Re)build the ping-pong particle-position textures/FBOs for a given
     * grid side length (the "density" control) — disposes any PREVIOUS
     * particle textures/FBOs first (own eviction discipline, AC) so a
     * runtime density change never leaks GL objects. A no-op if `gridSize`
     * is unchanged.
     * @param {number} gridSize
     */
    ensureParticles(gridSize) {
        if (!this.supported || this.gridSize === gridSize) {
            return;
        }
        const gl = this.gl;
        this._disposeParticleTextures();
        this.gridSize = gridSize;
        const initial = initialParticlePositions(gridSize);
        this.particleTexs = [0, 1].map(() => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format.internal, gridSize, gridSize, 0, this.format.format, this.format.type,
                this.format.type === gl.FLOAT ? initial : null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return tex;
        });
        this.particleFbos = this.particleTexs.map((tex) => {
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            return fbo;
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.particlePing = 0;
    }

    _disposeParticleTextures() {
        const gl = this.gl;
        if (this.particleTexs) {
            this.particleTexs.forEach((t) => gl.deleteTexture(t));
        }
        if (this.particleFbos) {
            this.particleFbos.forEach((f) => gl.deleteFramebuffer(f));
        }
        this.particleTexs = null;
        this.particleFbos = null;
    }

    /**
     * (Re)build the screen-space RGBA8 trail ping-pong buffers for the
     * current canvas size — disposes any previous ones first. A no-op if
     * the size is unchanged.
     */
    ensureTrails(width, height) {
        if (!this.supported || (this.trailTexs && this.trailW === width && this.trailH === height)) {
            return;
        }
        const gl = this.gl;
        this._disposeTrailTextures();
        this.trailW = width;
        this.trailH = height;
        this.trailTexs = [0, 1].map(() => {
            const t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        });
        this.trailFbos = this.trailTexs.map((t) => {
            const f = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, f);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return f;
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.trailPing = 0;
    }

    _disposeTrailTextures() {
        const gl = this.gl;
        if (this.trailTexs) {
            this.trailTexs.forEach((t) => gl.deleteTexture(t));
        }
        if (this.trailFbos) {
            this.trailFbos.forEach((f) => gl.deleteFramebuffer(f));
        }
        this.trailTexs = null;
        this.trailFbos = null;
    }

    _clearTrails() {
        const gl = this.gl;
        this.trailFbos.forEach((f) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, f);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * One advection step — reads the CURRENT ping-pong position texture +
     * the shared velocity texture, writes the NEXT position texture, swaps.
     * `viewState`/`sizeCssPx`/`bboxOrtho` are TASK-2743 UAT-02's view-restricted
     * respawn+cull rects. All three optional: without them the rects fall back
     * to the full [0,1] domain, i.e. exactly the pre-2743 behaviour.
     * @param {{velocityTexture: WebGLTexture, dtSec: number, speedExaggeration?: number, viewState?: object, sizeCssPx?: number[], bboxOrtho?: object}} params
     */
    step({ velocityTexture, dtSec, speedExaggeration, viewState, sizeCssPx, bboxOrtho }) {
        if (!this.supported || !this.particleFbos) {
            return;
        }
        const gl = this.gl;
        const src = this.particlePing;
        const dst = 1 - this.particlePing;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.particleFbos[dst]);
        gl.viewport(0, 0, this.gridSize, this.gridSize);
        gl.useProgram(this.advectProgram);
        gl.bindVertexArray(this.advectVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.particleTexs[src]);
        gl.uniform1i(this.advectUniforms.uPosTex, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
        gl.uniform1i(this.advectUniforms.uVelTex, 1);
        gl.uniform1f(this.advectUniforms.uDt, dtSec || 0);
        gl.uniform1f(this.advectUniforms.uSpeedScale, computeAdvectionSpeedScale(speedExaggeration));
        gl.uniform1f(this.advectUniforms.uRandSeed, Math.random() * 1000);
        gl.uniform1f(this.advectUniforms.uDropRate, PARTICLE_DROP_RATE);
        gl.uniform1f(this.advectUniforms.uStallDropRate, PARTICLE_STALL_DROP_RATE);
        gl.uniform1f(this.advectUniforms.uMinSpeed, PARTICLE_MIN_SPEED);
        gl.uniform1f(this.advectUniforms.uWetThreshold, this._lastWetThreshold || 1e-5);
        // TASK-2743 UAT-02 — seed and cull against the view, in UV space. The
        // sampling window is NOT moved; see computeParticleViewRects' header.
        const rects = computeParticleViewRects(viewState, sizeCssPx, bboxOrtho);
        gl.uniform4f(this.advectUniforms.uRespawnRect,
            rects.respawn.u, rects.respawn.v, rects.respawn.du, rects.respawn.dv);
        gl.uniform4f(this.advectUniforms.uCullRect,
            rects.cull.u, rects.cull.v, rects.cull.du, rects.cull.dv);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.particlePing = dst;
    }

    _drawPoints({ velocityTexture, bboxOrtho, projMatrix, wetThreshold, pointSize }) {
        const gl = this.gl;
        gl.useProgram(this.renderProgram);
        gl.bindVertexArray(this.pointsVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.particleTexs[this.particlePing]);
        gl.uniform1i(this.renderUniforms.uPosTex, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
        gl.uniform1i(this.renderUniforms.uVelTex, 1);
        gl.uniform1i(this.renderUniforms.uGridSize, this.gridSize);
        // TASK-2661 — compose pos->clip in JS float64 (never a raw world
        // coordinate on the GPU); see composePosToClipMatrix's docstring.
        const posToClip = composePosToClipMatrix(bboxOrtho, projMatrix);
        gl.uniformMatrix3fv(this.renderUniforms.uPosToClip, false, posToClip);
        gl.uniform1f(this.renderUniforms.uMinSpeed, PARTICLE_MIN_SPEED);
        gl.uniform1f(this.renderUniforms.uWetThreshold, wetThreshold || 1e-5);
        gl.uniform1f(this.renderUniforms.uPointSize, pointSize || 1.6);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, this.gridSize * this.gridSize);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
    }

    _drawQuad(program) {
        const gl = this.gl;
        gl.useProgram(program);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
    }

    /**
     * Render this frame's particle heads, with fading trails (unless
     * `trailsEnabled` is false, in which case just the heads are drawn — AC:
     * "animates both paused ... and during playback"; trails/points are
     * whatever this call is told to draw, independent of the playback
     * transport). Handles the camera-move reset (AC/wave brief) internally.
     * Restores neither viewport nor framebuffer beyond its own work — the
     * caller owns the main canvas viewport/framebuffer between draw calls
     * (same convention AnugaPlaybackFlowVizRenderer follows).
     * @param {object} params
     * @param {WebGLTexture} params.velocityTexture
     * @param {{cx:number,cy:number,halfW:number,halfH:number}} params.bboxOrtho
     * @param {Float32Array} params.projMatrix
     * @param {{center:[number,number], resolution:number, rotation?:number}} params.viewState
     * @param {[number,number]} params.sizeCssPx
     * @param {number} params.canvasWidth device-px canvas width (trail buffer size)
     * @param {number} params.canvasHeight device-px canvas height
     * @param {number} [params.wetThreshold]
     * @param {boolean} [params.trailsEnabled=true]
     * @param {number} [params.trailFade]
     * @param {number} [params.pointSize]
     */
    renderTrails({
        velocityTexture, bboxOrtho, projMatrix, viewState, sizeCssPx,
        canvasWidth, canvasHeight, wetThreshold, trailsEnabled = true,
        trailFade = DEFAULT_TRAIL_FADE, pointSize
    }) {
        if (!this.supported || !this.particleFbos || !bboxOrtho) {
            return;
        }
        this._lastWetThreshold = wetThreshold;
        const gl = this.gl;
        if (!trailsEnabled) {
            gl.viewport(0, 0, canvasWidth, canvasHeight);
            this._drawPoints({ velocityTexture, bboxOrtho, projMatrix, wetThreshold, pointSize });
            return;
        }
        this.ensureTrails(canvasWidth, canvasHeight);
        const cameraKey = buildCameraKey(viewState, sizeCssPx);
        if (hasCameraMoved(this.lastCameraKey, cameraKey)) {
            this._clearTrails();
            this.lastCameraKey = cameraKey;
        }
        const src = this.trailPing;
        const dst = 1 - this.trailPing;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[dst]);
        gl.viewport(0, 0, this.trailW, this.trailH);
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.trailTexs[src]);
        gl.useProgram(this.fadeProgram);
        gl.uniform1i(this.fadeUniforms.uTex, 0);
        gl.uniform1f(this.fadeUniforms.uFade, trailFade);
        this._drawQuad(this.fadeProgram);
        this._drawPoints({ velocityTexture, bboxOrtho, projMatrix, wetThreshold, pointSize }); // this frame's heads, on top of the faded tail
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // composite the trail buffer over the mesh
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.trailTexs[dst]);
        gl.useProgram(this.copyProgram);
        gl.uniform1i(this.copyUniforms.uTex, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        this._drawQuad(this.copyProgram);
        gl.disable(gl.BLEND);
        this.trailPing = dst;
    }

    /** @returns {number} the currently built particle-grid side length (0 if not yet built). */
    getGridSize() {
        return this.gridSize;
    }

    dispose() {
        if (!this.supported) {
            return;
        }
        const gl = this.gl;
        this._disposeParticleTextures();
        this._disposeTrailTextures();
        if (this.quadBuf) {
            gl.deleteBuffer(this.quadBuf);
        }
        [this.advectVao, this.quadVao, this.pointsVao].forEach((v) => v && gl.deleteVertexArray(v));
        [this.advectProgram, this.renderProgram, this.fadeProgram, this.copyProgram].forEach((p) => p && gl.deleteProgram(p));
    }
}

export default AnugaPlaybackParticleRenderer;
