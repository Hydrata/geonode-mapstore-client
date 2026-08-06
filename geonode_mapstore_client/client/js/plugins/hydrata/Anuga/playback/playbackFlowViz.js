/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackFlowViz — velocity-overlay framework (TASK-2632, W5.1, epic 2618):
 * an offscreen FBO pass rendering the derived (u,v) field to a float texture
 * each displayed frame, plus a screen-space instanced-arrow overlay sampled
 * from it. Productized from the W0.3 spike
 * (spikes/w0_3_webgl_renderer/index.html's velVS/velFS/arrowVS/arrowFS,
 * `__flowVizTuning`/`__flowVizDebug`) with THREE LOCKED departures from the
 * spike (wave brief: "the scars are law"):
 *
 *   1. VELOCITY SOURCE: the spike derived (u,v) client-side from momentum
 *      via the solver epsilon-form (`denom = depth + H0/max(depth,eps)`)
 *      because the draft schema stored momentum. The SHIPPED schema v1 (W1
 *      exporter, run_anuga/playback_store.py) instead stores
 *      ALREADY-DEQUANTIZED signed x_velocity/y_velocity — the same
 *      aQty0/aQty1.yz the existing mesh shader reads for
 *      `speed = length(q.yz)` (playbackShaders.js's MESH_VERTEX_SHADER). No
 *      epsilon regularization is needed OR correct here — re-deriving
 *      velocity from a momentum epsilon-form the store no longer carries
 *      would silently diverge from the actual export convention (B7
 *      solver_epsilon, already baked in server-side). See TASK-2632's audit
 *      comment #1605 (the wave brief's "supersession note").
 *
 *   2. VELOCITY FBO FORMAT: RGBA32F/RGBA16F carrying velocity in .rg and
 *      DEPTH in .a (gate-session extension over the spike, which packed
 *      depth into .b alongside a UV pair this shipped version doesn't need
 *      to store) — this texture is the shared (u,v,h) primitive BOTH the
 *      arrow overlay here and W5.2's particle advection sample; built once,
 *      here, and reused (never rebuilt) by the particle renderer.
 *
 *   3. ARROW GRID: the spike sampled a grid FIXED IN WORLD METERS
 *      (bbox-normalized UV), so on-screen density changed with zoom (packed
 *      together zoomed-out, sparse zoomed-in). The AC wants QGIS "mesh
 *      vectors on a user grid" parity — CONSTANT density on screen at every
 *      zoom. This module instead samples a grid FIXED IN SCREEN PIXELS
 *      (`uInvProj` maps each screen grid point back to world meters to
 *      sample the velocity texture) — see playbackMeshGeometry.js's
 *      buildInverseProjectionMatrix.
 *
 * No GL/DOM here except the two extension-probe helpers (only call
 * `gl.getExtension`, trivially mockable) — every other export is a pure
 * function, so the sampling/projection/arrow-sizing math is
 * karma-testable headlessly (AC: "karma coverage for sampling/projection
 * math (headless)"). AnugaPlaybackFlowVizRenderer.js is the GL-calls-only
 * shell that owns the actual FBO/program/VAO objects and calls these.
 */

// Matches the W0 spike's own probed size (VEL_TEX_SIZE) — the velocity
// field's own spatial resolution is independent of the interactive
// viewport/mesh triangle count.
export const VEL_TEX_SIZE = 512;

// AC: "Controls stay minimal (on/off, density, scale)" — density is the
// screen-space arrow-grid spacing in px (smaller = denser); scale is a
// direct multiplier on the computed max arrow length. qRef/speedRef/minSpeed
// are epic-fixed constants (unchanged from the W0 spike's own tuned values,
// `window.__flowVizTuning`), not exposed as separate controls.
export const DEFAULT_ARROW_DENSITY_PX = 64;
export const DEFAULT_ARROW_SCALE = 1;
export const ARROW_Q_REF = 1.5; // m2/s -> full-length arrow
export const ARROW_SPEED_REF = 2.0; // m/s -> top of the arrow colour ramp
export const ARROW_MIN_SPEED = 1e-4; // m/s below which a cell counts as not flowing

/**
 * Pick the best available float-texture format for the velocity FBO,
 * mirroring the spike's fallback chain EXACTLY (W0 scar: a format the GPU
 * can't render-to silently produces an incomplete FBO with no error) —
 * RGBA32F when EXT_color_buffer_float is present, RGBA16F when only
 * EXT_color_buffer_half_float is, else null (flow-viz unsupported on this
 * GPU/browser — the caller must treat null as "skip the overlay").
 * `gl` only needs `.getExtension`/the four format constants — a plain mock
 * object exercises this function headlessly without a real WebGL2 context.
 * @param {{getExtension: function, RGBA32F: number, RGBA16F: number, FLOAT: number, HALF_FLOAT: number, RGBA: number}} gl
 * @returns {{internal: number, type: number, format: number, label: string}|null}
 */
export function pickVelocityTextureFormat(gl) {
    if (gl.getExtension('EXT_color_buffer_float')) {
        return { internal: gl.RGBA32F, type: gl.FLOAT, format: gl.RGBA, label: 'RGBA32F (EXT_color_buffer_float)' };
    }
    if (gl.getExtension('EXT_color_buffer_half_float')) {
        return { internal: gl.RGBA16F, type: gl.HALF_FLOAT, format: gl.RGBA, label: 'RGBA16F (EXT_color_buffer_half_float)' };
    }
    return null;
}

/**
 * Whether the velocity texture should use LINEAR filtering — MUST be
 * explicitly requested via OES_texture_float_linear (FLOAT format) or
 * OES_texture_half_float_linear (HALF_FLOAT format); this exact request is
 * what the epic's original W5 budget figure hinged on (wave brief: "silently
 * sample as ZERO with no error ... invalidated the original W5 probe
 * figure"). Falls back to NEAREST (correct, just blockier) rather than
 * leaving an incomplete/undefined-filtering texture.
 * @param {{getExtension: function}} gl
 * @param {boolean} isFloatType true for the RGBA32F/FLOAT format, false for RGBA16F/HALF_FLOAT
 * @returns {boolean}
 */
export function shouldUseLinearFiltering(gl, isFloatType) {
    const ext = isFloatType
        ? gl.getExtension('OES_texture_float_linear')
        : gl.getExtension('OES_texture_half_float_linear');
    return !!ext;
}

/**
 * The centered, square-padded bbox-ortho window (cx, cy, halfW, halfH) the
 * velocity FBO renders into and the arrow/particle overlays sample from —
 * ONE shared derivation so the FBO write and every overlay read can never
 * disagree about which world window UV [0,1] covers. `padFactor` mirrors
 * the spike's 1.02 (a hair of margin so edge vertices never sample exactly
 * at a UV boundary).
 * @param {[number, number, number, number]} bbox [minX, minY, maxX, maxY] — the mesh's own world-frame bbox (same frame as aPos/x3857,y3857)
 * @param {number} [padFactor=1.02]
 * @returns {{cx: number, cy: number, halfW: number, halfH: number}}
 */
export function computeBboxOrtho(bbox, padFactor = 1.02) {
    const [minX, minY, maxX, maxY] = bbox;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const half = Math.max(maxX - minX, maxY - minY) / 2 * padFactor;
    return { cx, cy, halfW: half, halfH: half };
}

/**
 * World meters -> the velocity FBO's normalized [0,1] UV, using the SAME
 * bbox-ortho convention the FBO pass itself projects with
 * (FLOWVIZ_VELOCITY_VERTEX_SHADER's `local = (aPos - uBboxOrtho.xy) /
 * uBboxOrtho.zw`, this being that mapping's [-1,1]->[0,1] remap).
 * @param {number} worldX
 * @param {number} worldY
 * @param {{cx: number, cy: number, halfW: number, halfH: number}} bboxOrtho
 * @returns {[number, number]}
 */
export function worldToVelocityUv(worldX, worldY, bboxOrtho) {
    const { cx, cy, halfW, halfH } = bboxOrtho;
    return [
        (worldX - cx) / (2 * halfW) + 0.5,
        (worldY - cy) / (2 * halfH) + 0.5
    ];
}

/**
 * How many columns/rows fit a FIXED PIXEL SPACING across the viewport (the
 * "screen-space grid" — AC: constant arrow density regardless of zoom, the
 * departure from the spike's world-fixed grid documented in this module's
 * header). At least 2x2 so a tiny viewport still gets a valid grid.
 * @param {number} viewportWidthPx
 * @param {number} viewportHeightPx
 * @param {number} spacingPx the "density" control — smaller = more, denser arrows
 * @returns {{cols: number, rows: number, count: number}}
 */
export function computeArrowGridDimensions(viewportWidthPx, viewportHeightPx, spacingPx) {
    const spacing = Math.max(4, spacingPx || 64);
    const cols = Math.max(2, Math.round(viewportWidthPx / spacing));
    const rows = Math.max(2, Math.round(viewportHeightPx / spacing));
    return { cols, rows, count: cols * rows };
}

/**
 * NDC (clip-space, [-1,1]) position of grid instance `index` in a cols x
 * rows screen-space grid, evenly spaced with a half-cell margin so the
 * outermost arrows aren't clipped exactly at the viewport edge. Mirrors
 * ARROW_VERTEX_SHADER's own per-instance grid math exactly (kept here for
 * headless coverage of that formula).
 * @param {number} index gl_InstanceID, 0..cols*rows-1
 * @param {number} cols
 * @param {number} rows
 * @returns {[number, number]}
 */
export function arrowGridNdc(index, cols, rows) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const ndcX = ((col + 0.5) / cols) * 2 - 1;
    const ndcY = ((row + 0.5) / rows) * 2 - 1;
    return [ndcX, ndcY];
}

/**
 * Arrow length in px: unit discharge q = h*|u| (m^2/s) mapped to [0,1] of
 * qRef then scaled by maxLenPx, plus a small fixed head so even a
 * near-zero-but-wet cell draws a visible stub. Mirrors the spike's
 * `clamp(q/qRef,0,1)*uMaxLenPx + 3`, GLSL-mirrored in ARROW_VERTEX_SHADER —
 * kept here for headless coverage of that SAME formula (parity-checked
 * against the shader source by playbackFlowViz-test.js, the same technique
 * playbackShaders-test.js uses for the AIDR hazard table).
 * @param {number} depth metres
 * @param {number} speedMps m/s
 * @param {number} qRef m^2/s that draws a full-length arrow
 * @param {number} maxLenPx
 * @param {number} [minLenPx=3]
 * @returns {number}
 */
export function unitDischargeArrowLengthPx(depth, speedMps, qRef, maxLenPx, minLenPx = 3) {
    const q = Math.max(0, depth) * Math.max(0, speedMps);
    const t = Math.min(1, Math.max(0, q / Math.max(qRef, 1e-9)));
    return t * maxLenPx + minLenPx;
}

/**
 * Max arrow length in px from the (already screen-space) grid spacing — the
 * "scale" control's packing-factor guard so neighbouring arrows never
 * overlap. Unlike the spike (a world-fixed grid whose spacing needed
 * cam.scale to convert to px), this module's grid IS ALREADY in px, so no
 * unit conversion is needed here — `spacingPx` is both the density control
 * and the length-cap input.
 * @param {number} spacingPx
 * @param {number} [packingFactor=0.62]
 * @returns {number}
 */
export function computeArrowMaxLengthPx(spacingPx, packingFactor = 0.62) {
    return Math.max(6, spacingPx * packingFactor);
}

/**
 * Speed -> RGB colour on the slow(pale)->brisk(orange)->fast(red) ramp
 * (ARROW_FRAGMENT_SHADER mirror — same two-segment lerp, ported unchanged
 * from the spike's arrowFS).
 * @param {number} speedMps
 * @param {number} speedRef m/s mapped to the top of the ramp
 * @returns {[number, number, number]}
 */
export function arrowSpeedColor(speedMps, speedRef) {
    const t = Math.min(1, Math.max(0, speedMps / Math.max(speedRef, 1e-9)));
    const lo = [1.00, 0.97, 0.70];
    const mid = [1.00, 0.62, 0.15];
    const hi = [0.95, 0.15, 0.08];
    const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    return t < 0.5 ? lerp3(lo, mid, t * 2) : lerp3(mid, hi, (t - 0.5) * 2);
}

/**
 * Whether an arrow should be drawn at a sampled grid point — dry/still cells
 * are masked (AC: "no glyphs in dry/film cells"), mirrors
 * ARROW_VERTEX_SHADER's own `depth <= uWetThreshold || speed < uMinSpeed`
 * cull (which pushes the instance outside the clip volume rather than
 * drawing a degenerate zero-length arrow).
 * @param {number} depth
 * @param {number} wetThreshold store's minimum_storable_height
 * @param {number} speedMps
 * @param {number} [minSpeed=1e-4]
 * @returns {boolean}
 */
export function isArrowVisible(depth, wetThreshold, speedMps, minSpeed = 1e-4) {
    return depth > wetThreshold && speedMps >= minSpeed;
}

// ---------------------------------------------------------------------------
// GLSL sources
// ---------------------------------------------------------------------------

// Renders the mesh's velocity field into the offscreen velocity FBO, in the
// bbox-ortho projection (independent of the interactive camera) so the
// overlay can sample it by normalized [0,1] UV covering the whole run.
// aQty0/aQty1.yz are ALREADY signed physical velocity (see this module's
// header, departure #1) — no epsilon-form momentum->velocity derivation.
export const FLOWVIZ_VELOCITY_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=2) in vec3 aQty0;
layout(location=3) in vec3 aQty1;
uniform vec4 uBboxOrtho; // cx, cy, halfW, halfH (centered, square-padded)
uniform float uMixT;
uniform float uWetThreshold; // store's minimum_storable_height (NOT hardcoded)
out vec3 vVelDepth; // .xy = velocity m/s (wet-masked), .z = depth m (wet-masked)
void main() {
  vec3 q = mix(aQty0, aQty1, uMixT);
  float depth = max(q.x, 0.0);
  float wet = step(uWetThreshold, depth);
  vVelDepth = vec3(q.yz * wet, depth * wet);
  vec2 local = (aPos - uBboxOrtho.xy) / uBboxOrtho.zw;
  gl_Position = vec4(local, 0.0, 1.0);
}`;

// RGBA32F/RGBA16F: .rg = velocity (m/s), .b = unused (reserved), .a = depth
// (m) — this module's header, departure #2. The SAME texture W5.2's particle
// advection samples.
export const FLOWVIZ_VELOCITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vVelDepth;
out vec4 fragColor;
void main() { fragColor = vec4(vVelDepth.xy, 0.0, vVelDepth.z); }`;

// Instanced arrow grid, SCREEN-SPACE sampled (this module's header,
// departure #3): each instance starts as a fixed-pixel-spacing NDC grid
// point, mapped back to world meters via uInvProj to sample the velocity
// texture, then drawn AT that same screen point (offset by the arrow shape
// in px) — so density stays constant across zoom instead of the mesh's
// world-fixed sample grid.
export const FLOWVIZ_ARROW_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aShape;
uniform sampler2D uVelTex;
uniform mat3 uInvProj;      // NDC(screen) -> world meters (playbackMeshGeometry.buildInverseProjectionMatrix)
uniform vec4 uBboxOrtho;    // cx, cy, halfW, halfH — SAME window the velocity FBO renders into
uniform int uCols;
uniform int uRows;
uniform float uQRef;        // unit discharge (m2/s) that draws a full-length arrow
uniform float uMinSpeed;
uniform float uWetThreshold;
uniform float uMaxLenPx;    // tied to the screen-space grid spacing so arrows never overlap
uniform vec2 uViewportPx;
out float vSpeed;
void main() {
  int id = gl_InstanceID;
  int col = id % uCols;
  int row = id / uCols;
  float ndcX = ((float(col) + 0.5) / float(uCols)) * 2.0 - 1.0;
  float ndcY = ((float(row) + 0.5) / float(uRows)) * 2.0 - 1.0;
  vec3 world = uInvProj * vec3(ndcX, ndcY, 1.0);
  vec2 uv = (world.xy - uBboxOrtho.xy) / (2.0 * uBboxOrtho.zw) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // textureLod, NOT texture(): implicit-LOD texture() is fragment-stage-only
  // in GLSL ES 3.00 — a vertex shader must supply the LOD explicitly.
  vec4 vd = textureLod(uVelTex, uv, 0.0);
  vec2 vel = vd.xy;
  float depth = vd.a;
  float speed = length(vel);
  vSpeed = speed;
  // Dry/still cells are masked (AC: "no glyphs in dry/film cells") — push
  // the instance outside the clip volume rather than drawing a
  // degenerate/zero-length arrow (mirrors playbackFlowViz.isArrowVisible).
  if (depth <= uWetThreshold || speed < uMinSpeed) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float ang = atan(vel.y, vel.x);
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  // LENGTH = unit discharge q = h*|u| (m2/s); COLOUR (fragment shader) =
  // |u| — a deep slow channel and a shallow fast sheet read as visually
  // distinct rather than conflated (mirrors playbackFlowViz.unitDischargeArrowLengthPx).
  float q = depth * speed;
  float lenPx = clamp(q / uQRef, 0.0, 1.0) * uMaxLenPx + 3.0;
  vec2 offsetPx = rot * (aShape * lenPx);
  gl_Position = vec4(ndcX + offsetPx.x * (2.0 / uViewportPx.x), ndcY + offsetPx.y * (2.0 / uViewportPx.y), 0.0, 1.0);
}`;

export const FLOWVIZ_ARROW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float uSpeedRef;   // |u| (m/s) mapped to the top of the colour ramp
in float vSpeed;
out vec4 fragColor;
void main() {
  float t = clamp(vSpeed / uSpeedRef, 0.0, 1.0);
  vec3 lo  = vec3(1.00, 0.97, 0.70);   // slow  - pale
  vec3 mid = vec3(1.00, 0.62, 0.15);   // brisk - orange
  vec3 hi  = vec3(0.95, 0.15, 0.08);   // fast  - red
  vec3 c = t < 0.5 ? mix(lo, mid, t * 2.0) : mix(mid, hi, (t - 0.5) * 2.0);
  fragColor = vec4(c, 0.92);
}`;

// Base arrow shape in local unit space: shaft + small head, pointing +X
// (unchanged from the spike — the geometry itself has no schema/format
// dependency).
export const ARROW_SHAPE_VERTICES = new Float32Array([
    0, -0.06, 1, -0.06, 1, 0.06, 0, -0.06, 1, 0.06, 0, 0.06, // shaft (2 tris)
    1, -0.18, 1.35, 0, 1, 0.18 // arrowhead (1 tri)
]);
