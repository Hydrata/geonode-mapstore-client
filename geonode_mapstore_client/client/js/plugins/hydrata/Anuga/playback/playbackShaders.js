/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackShaders — GLSL sources for the AnugaPlaybackLayer mesh renderer
 * (TASK-2626, W2.2, epic 2618), productized from the W0.3 spike
 * (`spikes/w0_3_webgl_renderer/index.html`'s meshVS/meshFS).
 *
 * Departure from the spike: the spike packed depth/xmomentum/ymomentum and
 * derived velocity IN-SHADER via the solver epsilon-form. This renderer
 * instead consumes depth/x_velocity/y_velocity already dequantized to
 * physical units by playbackDecode.js (TASK-2625) — the W1 exporter already
 * baked the authoritative `compute_velocity` (B7 solver_epsilon) formula
 * into the store server-side, so re-deriving it client-side from momentum
 * would be redundant and risks drifting from the schema's own convention.
 */

// aQty0/aQty1 = (depth, x_velocity, y_velocity) at the two buffered
// timesteps, already physical (post-dequantize). uMixT interpolates them
// GPU-side (the "two-buffer mix" AC) exactly like the spike's aQty0/aQty1.
export const MESH_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in float aElev;
layout(location=2) in vec3 aQty0;
layout(location=3) in vec3 aQty1;
uniform mat3 uProj;
uniform float uMixT;
uniform int uColorMode; // 0 = depth, 1 = speed
uniform float uColorMax;
uniform float uWetThreshold;
out float vValue;
out float vWet;
void main() {
  vec3 q = mix(aQty0, aQty1, uMixT);
  float depth = max(q.x, 0.0);
  float wet = step(uWetThreshold, depth);
  float speed = length(q.yz) * wet;
  float raw = (uColorMode == 0) ? depth : speed;
  vValue = clamp(raw / max(uColorMax, 1e-9), 0.0, 1.0);
  vWet = wet;
  vec3 clip = uProj * vec3(aPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

export const MESH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vValue;
in float vWet;
uniform sampler2D uLUT;
out vec4 fragColor;
void main() {
  if (vWet < 0.5) {
    fragColor = vec4(0.16, 0.15, 0.13, 1.0); // dry ground, flat tint (matches W0.3 spike)
    return;
  }
  fragColor = vec4(texture(uLUT, vec2(vValue, 0.5)).rgb, 1.0);
}`;

// Wireframe: position-only, flat colour, same world->clip projection matrix
// as the mesh program so both draw calls stay perfectly aligned.
export const WIRE_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform mat3 uProj;
void main() {
  vec3 clip = uProj * vec3(aPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

export const WIRE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}`;

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type gl.VERTEX_SHADER | gl.FRAGMENT_SHADER
 * @param {string} source
 * @returns {WebGLShader}
 */
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`playbackShaders.compileShader: ${info}`);
    }
    return shader;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
export function linkProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`playbackShaders.linkProgram: ${info}`);
    }
    return program;
}
