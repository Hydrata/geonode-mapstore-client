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
 *
 * TASK-2629 (W4.1) extends the two primitive colour modes (depth/speed) to
 * the full eight-quantity derived-quantity menu (glossary: "a formula, not
 * a dataset" — every mode below is computed per-vertex from primitives
 * already resident on the GPU, no new stored arrays/fetches). Mirrors
 * playbackDerivedQuantities.js's formulas + QUANTITY_MODE_INDEX exactly —
 * see that module's header for the formula citations (AIDR hazard table,
 * Manning shear, Courant/celerity). aFriction/aInradius are new STATIC
 * per-vertex attributes (friction: store's real per-vertex Manning n;
 * inradius: the store's per-FACE inradius broadcast to vertices by
 * playbackMeshGeometry.computeVertexInradius — see AnugaPlaybackRenderer.setMesh).
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
layout(location=4) in float aFriction;
layout(location=5) in float aInradius;
uniform mat3 uProj;
uniform float uMixT;
// 0=depth 1=speed 2=stage 3=dIV 4=hazard 5=froude 6=shear 7=courant —
// playbackDerivedQuantities.QUANTITY_MODE_INDEX, kept in lockstep by
// playbackColormap-test.js.
uniform int uColorMode;
uniform float uColorMax;
uniform float uColorMin; // non-zero only for stage's per-run rescale (mode 2)
uniform float uWetThreshold; // store's minimum_storable_height (NOT hardcoded)
uniform float uG; // store attr g (9.8), NOT the textbook 9.81
uniform float uRhoW; // store attr rho_w
uniform float uDt; // frame-mixed dt(t), SECONDS — approximate/global-dt (review F6)
out float vValue;
out float vWet;

float classifyHazardIndex(float d, float v) {
  // AIDR Guideline 7-3 (2017) Table 2, p.11 — see playbackDerivedQuantities.js
  // AIDR_HAZARD_TABLE / AIDR_HAZARD_CITATION for the authoritative source;
  // this is a hand transcription of the SAME six thresholds (GLSL cannot
  // import the JS/JSON table at runtime) — kept identical by the karma GL
  // smoke test in playbackColormap-test.js.
  float dv = d * v;
  if (dv <= 0.3 && d <= 0.3 && v <= 2.0) return 0.0;
  if (dv <= 0.6 && d <= 0.5 && v <= 2.0) return 1.0;
  if (dv <= 0.6 && d <= 1.2 && v <= 2.0) return 2.0;
  if (dv <= 1.0 && d <= 2.0 && v <= 2.0) return 3.0;
  if (dv <= 4.0 && d <= 4.0 && v <= 4.0) return 4.0;
  return 5.0;
}

void main() {
  vec3 q = mix(aQty0, aQty1, uMixT);
  float depth = max(q.x, 0.0);
  float wet = step(uWetThreshold, depth);
  float speed = length(q.yz) * wet;
  // Guarded (never zero) denominator for the div-heavy formulas below —
  // schema §8: "GLSL divide-by-zero is undefined per spec ... the mask
  // should be applied before the formula" — dry cells still render the flat
  // dry-ground tint in the fragment shader regardless of this value.
  float safeDepth = max(depth, 1e-6);

  float raw;
  if (uColorMode == 0) {
    raw = depth;
  } else if (uColorMode == 1) {
    raw = speed;
  } else if (uColorMode == 2) {
    raw = aElev + depth; // stage
  } else if (uColorMode == 3) {
    raw = depth * speed; // dIV
  } else if (uColorMode == 4) {
    raw = classifyHazardIndex(depth, speed) * wet; // hazard class index 0..5
  } else if (uColorMode == 5) {
    raw = (speed / sqrt(uG * safeDepth)) * wet; // Froude
  } else if (uColorMode == 6) {
    raw = (uRhoW * uG * aFriction * aFriction * speed * speed / pow(safeDepth, 1.0 / 3.0)) * wet; // Manning shear
  } else {
    raw = (sqrt(uG * safeDepth) * uDt / max(aInradius, 1e-6)) * wet; // Courant (celerity*dt/inradius)
  }
  vValue = clamp((raw - uColorMin) / max(uColorMax - uColorMin, 1e-9), 0.0, 1.0);
  vWet = wet;
  vec3 clip = uProj * vec3(aPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

export const MESH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vValue;
in float vWet;
uniform sampler2D uLUT;
// TASK-2788 — alpha of the DRY-GROUND sheet, 0 by default. The results layer
// covers the whole model domain, most of which is dry for most of a run, so an
// opaque sheet hides the catchment the water is moving over. This is a separate
// knob from the layer's own opacity (a CSS opacity on the whole canvas): this
// one fades ONLY the dry ground, leaving the water at full strength.
uniform float uBackgroundAlpha;
out vec4 fragColor;
void main() {
  if (vWet < 0.5) {
    // PREMULTIPLIED. The context is created with the WebGL defaults
    // alpha:true + premultipliedAlpha:true, and the mesh pass draws with
    // BLEND DISABLED (blending is enabled only for the wireframe pass), so
    // this value lands in the drawing buffer verbatim and the compositor
    // reads it as premultiplied. Writing vec4(0.16, 0.15, 0.13, a) would be
    // an invalid premultiplied colour for every a < 1 — at a = 0 it is the
    // classic "transparent black that still tints" bug, because RGB > A.
    fragColor = vec4(vec3(0.16, 0.15, 0.13) * uBackgroundAlpha, uBackgroundAlpha);
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
