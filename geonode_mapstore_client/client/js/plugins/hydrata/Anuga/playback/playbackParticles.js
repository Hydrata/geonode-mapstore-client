/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackParticles — Windy-style GPU particle system (TASK-2633, W5.2,
 * epic 2618): particles advected through the W5.1 velocity texture
 * (mapbox/webgl-wind technique — texture ping-pong particle state),
 * fading screen-space trails, spawn/kill respecting the wet mask and mesh
 * extent. Productized from the W0.3 spike's `stepParticles`/`ensureParticles`
 * /`ensureTrails`/`renderParticles` with the SAME departures documented in
 * playbackFlowViz.js's header (velocity is already signed x/y components,
 * not momentum; the velocity texture carries depth in `.a`, built ONCE by
 * TASK-2632 and reused here — never rebuilt).
 *
 * ADDITIVE departure over the spike specific to THIS subtask: the spike's
 * "not flowing" recycle test used ONLY `length(vel) < uMinSpeed`. The AC
 * asks for spawn/kill keyed on "the wet mask and mesh extent" explicitly —
 * this module's advection shader instead tests `depth <= uWetThreshold` OR
 * `speed < uMinSpeed` (`pickRespawnRate`'s mirror). This single depth check
 * ALSO covers "mesh extent": any UV never covered by a mesh triangle reads
 * back depth=0 (the velocity FBO's own clear colour, see
 * FLOWVIZ_VELOCITY_FRAGMENT_SHADER) — indistinguishable from a dry cell, so
 * it recycles at the same fast stall rate without a second, separate
 * "in-bounds" test.
 *
 * No GL/DOM here — every export is a pure function or GLSL string, so the
 * spawn/kill/speed-scaling/camera-key math is karma-testable headlessly.
 * AnugaPlaybackParticleRenderer.js is the GL-calls-only shell that owns the
 * actual ping-pong textures/FBOs/programs and issues draw calls.
 */

// A UV-space (not literal screen-px) per-second multiplier — the world
// window sampled by the velocity texture is FIXED regardless of zoom (same
// bbox-ortho convention as the arrow overlay), so a fixed UV-space rate
// already reads as a roughly-constant ON-SCREEN speed once projected
// through uProj — this IS the "m/s -> px/s" mapping the AC describes,
// achieved by keeping the sampling window fixed rather than a second
// explicit unit conversion. `speedExaggeration` (the AC's "speed-
// exaggeration... control") multiplies this baseline directly (real flood
// velocities read as visually slow at basin zoom — wave brief).
export const PARTICLE_BASE_SPEED_SCALE = 0.02;
export const DEFAULT_SPEED_EXAGGERATION = 1;

// AC: "start modest (10-50k default)" — 128x128 = 16,384 particles.
export const DEFAULT_PARTICLE_GRID = 128;
export const MIN_PARTICLE_GRID = 32; // 1,024 particles
export const MAX_PARTICLE_GRID = 256; // 65,536 particles

export const PARTICLE_MIN_SPEED = 1e-4; // m/s below which a cell counts as not flowing
export const PARTICLE_DROP_RATE = 0.004; // per-frame recycle chance for a FLOWING particle
export const PARTICLE_STALL_DROP_RATE = 0.30; // per-frame recycle chance for a NOT-FLOWING (dry/still/off-mesh) particle
export const DEFAULT_TRAIL_FADE = 0.955; // per-frame trail decay; higher = longer tails

// ── TASK-2743 UAT-02 (W6, epic 2706) — seed and cull against the VIEW ────────
//
// Particle positions are [0,1] UV over the WHOLE square-padded run bbox. On the
// 6,779,432-triangle Msimbazi store that square is 3,808.68 m on a side, while a
// working view at zoom 19 covers 388 x 349 m — 1.03% of it. So even a perfectly
// uniform population puts only ~446 of 43,264 particles on screen. It is not
// uniform either: the stall-recycle asymmetry below (0.30/frame when not
// flowing vs 0.004 when flowing) drags the population into the wet region and
// parks it there. Measured live: 36.09% of particles inside 4.15% of the domain
// — an 8.7x concentration — with 2,437 in the hottest 1/256 UV cell against a
// uniform expectation of 169. The overlay was reporting where water IS, which
// the colour fill already shows, instead of where it is GOING.
//
// The fix restricts WHERE particles respawn and where they are culled, in the
// same [0,1] UV frame they already live in. The sampling window does NOT move:
// computeBboxOrtho, worldToVelocityUv, composePosToClipMatrix,
// computeAdvectionSpeedScale, the velocity texture and every arrow code path
// are untouched. That matters — making the window follow the view would have
// (a) pushed the arrow grid from ~2.6 to ~21.9 texels between samples, turning
// the one overlay that works at this scale into a point-sampled scatter,
// (b) turned the constant fp32 rounding of `cx` in the uBboxOrtho upload into a
// per-frame-varying misregistration that flickers bank arrows on every pan,
// (c) silently divided on-screen particle speed by ~8.5x, since
// PARTICLE_BASE_SPEED_SCALE is a UV-per-second rate, and (d) changed what every
// already-stored particle UV means on every camera move.
//
// Margins are DIRECT multipliers on the view's half-extent: 1.0 is exactly the
// viewport, 1.3 is 30% larger per axis. Stated once, here, because this is
// exactly the sort of factor two readers will disagree about.
export const PARTICLE_RESPAWN_VIEW_MARGIN = 1.3;
// The cull rect is deliberately WIDER than the respawn rect: a particle must be
// able to drift out of the respawn area without being killed the moment it
// leaves, or the two rects thrash against each other.
export const PARTICLE_CULL_VIEW_MARGIN = 2.0;
// Below this UV extent the view/window intersection is degenerate — the mesh
// has been panned off screen entirely, or the clamp collapsed. Fall back to the
// FULL domain (i.e. exactly today's behaviour) rather than respawning all
// 43,264 particles onto a single texel.
export const PARTICLE_MIN_VIEW_UV_EXTENT = 0.002;
export const FULL_UV_RECT = Object.freeze({ u: 0, v: 0, du: 1, dv: 1 });

/**
 * Advection UV-space-per-second scale from the "speed exaggeration"
 * control — a direct multiplier on PARTICLE_BASE_SPEED_SCALE.
 * @param {number} [exaggeration=DEFAULT_SPEED_EXAGGERATION]
 * @returns {number}
 */
export function computeAdvectionSpeedScale(exaggeration) {
    return PARTICLE_BASE_SPEED_SCALE * Math.max(0.01, exaggeration || DEFAULT_SPEED_EXAGGERATION);
}

/**
 * Clamp/round the "density" control (particle-grid side length) into a
 * sane range — MIN_PARTICLE_GRID..MAX_PARTICLE_GRID (1,024..65,536
 * particles), matching the AC's "start modest" guidance.
 * @param {number} n
 * @returns {number}
 */
export function clampParticleGrid(n) {
    const v = Math.round(n || DEFAULT_PARTICLE_GRID);
    return Math.min(MAX_PARTICLE_GRID, Math.max(MIN_PARTICLE_GRID, v));
}

/**
 * Whether a cell counts as "flowing" for particle spawn/kill purposes — the
 * wet-mask contract (AC: "spawn/kill respecting the wet mask and mesh
 * extent"), mirrors ADVECT_FRAGMENT_SHADER's own `dry`/`still` cull exactly.
 * @param {number} depth metres
 * @param {number} wetThreshold store's minimum_storable_height
 * @param {number} speedMps
 * @param {number} [minSpeed=PARTICLE_MIN_SPEED]
 * @returns {boolean}
 */
export function isParticleFlowing(depth, wetThreshold, speedMps, minSpeed = PARTICLE_MIN_SPEED) {
    return depth > wetThreshold && speedMps >= minSpeed;
}

/**
 * The per-frame recycle PROBABILITY for a particle at a sampled point —
 * flowing particles recycle slowly (trails stay coherent); dry/still/
 * off-mesh particles recycle fast (a uniform initial seeding would
 * otherwise park most of the population permanently on dry ground/outside
 * the mesh, reading as frozen dots rather than flow — the W0 spike's own
 * documented bug). Mirrors ADVECT_FRAGMENT_SHADER's `mix(uDropRate,
 * uStallDropRate, notFlowing)` exactly.
 * @param {number} depth
 * @param {number} wetThreshold
 * @param {number} speedMps
 * @param {number} [minSpeed=PARTICLE_MIN_SPEED]
 * @param {number} [dropRate=PARTICLE_DROP_RATE]
 * @param {number} [stallDropRate=PARTICLE_STALL_DROP_RATE]
 * @returns {number}
 */
export function pickRespawnRate(
    depth, wetThreshold, speedMps, minSpeed = PARTICLE_MIN_SPEED,
    dropRate = PARTICLE_DROP_RATE, stallDropRate = PARTICLE_STALL_DROP_RATE,
    inView = true
) {
    // TASK-2743 UAT-02 — `inView` defaults true, so every pre-existing caller
    // and karma case behaves exactly as before. Off-view is treated as
    // not-flowing rather than as its own rate, mirroring the shader's single
    // `notFlowing = max(notFlowing, offView)` line: one recycle rate, one code
    // path, nothing new to keep in sync.
    if (!inView) {
        return stallDropRate;
    }
    return isParticleFlowing(depth, wetThreshold, speedMps, minSpeed) ? dropRate : stallDropRate;
}

/**
 * The respawn and cull rectangles, in the SAME [0,1] velocity-UV frame the
 * particle position texture already stores.
 *
 * Computed on the CPU in JS float64 and uploaded as two `vec4`s whose every
 * component is in [0,1] — so no world coordinate reaches the GPU and TASK-2661's
 * fp32 lattice cannot reappear through this door BY CONSTRUCTION, not by
 * promise. Mirrors playbackFlowViz.worldToVelocityUv's mapping exactly (a world
 * delta D maps to a UV delta D/(2*halfW)); pinned against it by karma.
 *
 * Rotation-aware: the view is an axis-aligned rect in SCREEN space, so under a
 * rotated camera the world-space region it covers is that rect's AABB, which is
 * larger by |cos|+|sin| per axis.
 *
 * @param {{center:[number,number], resolution:number, rotation?:number}} viewState
 * @param {[number,number]} sizeCssPx
 * @param {{cx:number,cy:number,halfW:number,halfH:number}} bboxOrtho
 * @returns {{respawn:{u:number,v:number,du:number,dv:number}, cull:{u:number,v:number,du:number,dv:number}}}
 */
export function computeParticleViewRects(viewState, sizeCssPx, bboxOrtho) {
    const full = { respawn: { ...FULL_UV_RECT }, cull: { ...FULL_UV_RECT } };
    if (!viewState || !sizeCssPx || !bboxOrtho) {
        return full;
    }
    const { center, resolution, rotation = 0 } = viewState;
    const [w, h] = sizeCssPx;
    if (!center || !(resolution > 0) || !(w > 0) || !(h > 0)
        || !(bboxOrtho.halfW > 0) || !(bboxOrtho.halfH > 0)) {
        return full;
    }
    // Screen-space half-extent in world metres, then its AABB under rotation.
    const halfWm = (w * resolution) / 2;
    const halfHm = (h * resolution) / 2;
    const c = Math.abs(Math.cos(rotation));
    const s = Math.abs(Math.sin(rotation));
    const aabbHalfW = halfWm * c + halfHm * s;
    const aabbHalfH = halfWm * s + halfHm * c;
    // Centre in UV — the same mapping as worldToVelocityUv.
    const cu = (center[0] - bboxOrtho.cx) / (2 * bboxOrtho.halfW) + 0.5;
    const cv = (center[1] - bboxOrtho.cy) / (2 * bboxOrtho.halfH) + 0.5;

    const rectFor = (margin) => {
        // A world half-extent E maps to a UV half-extent E/(2*halfW).
        const hu = (aabbHalfW * margin) / (2 * bboxOrtho.halfW);
        const hv = (aabbHalfH * margin) / (2 * bboxOrtho.halfH);
        const u0 = Math.max(0, Math.min(1, cu - hu));
        const u1 = Math.max(0, Math.min(1, cu + hu));
        const v0 = Math.max(0, Math.min(1, cv - hv));
        const v1 = Math.max(0, Math.min(1, cv + hv));
        return { u: u0, v: v0, du: u1 - u0, dv: v1 - v0 };
    };

    const respawn = rectFor(PARTICLE_RESPAWN_VIEW_MARGIN);
    const cull = rectFor(PARTICLE_CULL_VIEW_MARGIN);
    // Degenerate: the view does not meaningfully overlap the window (panned off
    // the mesh, or zoomed so far that the clamp collapsed). Today's behaviour.
    if (respawn.du < PARTICLE_MIN_VIEW_UV_EXTENT || respawn.dv < PARTICLE_MIN_VIEW_UV_EXTENT
        || cull.du < PARTICLE_MIN_VIEW_UV_EXTENT || cull.dv < PARTICLE_MIN_VIEW_UV_EXTENT) {
        return full;
    }
    return { respawn, cull };
}

/**
 * JS mirror of the advect shader's `uCullRect` test — the same four `step()`
 * comparisons, so the GLSL and the headless model can be pinned against each
 * other rather than trusted to agree.
 * @param {number} u
 * @param {number} v
 * @param {{u:number,v:number,du:number,dv:number}} rect
 * @returns {boolean}
 */
export function isParticleInView(u, v, rect) {
    if (!rect) {
        return true;
    }
    return u >= rect.u && u <= rect.u + rect.du && v >= rect.v && v <= rect.v + rect.dv;
}

/**
 * TASK-2661 (W6.75.1, epic 2618) — CPU float64 pre-composed pos->clip
 * matrix, fixing the "trails vertical-grid" bug (root-caused live 2026-08-07
 * during W6.5 UAT, epic comment #1617): PARTICLE_RENDER_VERTEX_SHADER used
 * to reconstruct `localMeters = uBboxOrtho.xy + (pos*2-1)*uBboxOrtho.zw` ON
 * THE GPU in fp32 — at an Australian-longitude bbox centre (cx ~ 16.9e6 m,
 * magnitude > 2^24) that addition itself quantizes to the fp32 ULP grid at
 * that magnitude (~2m), and `uProj * vec3(localMeters,1)` then carries that
 * quantization straight through to clip space: screen-X snapped to a
 * 3.75-7.5 device-px lattice while screen-Y (whose bbox centre, at typical
 * southern-hemisphere latitudes, sits below 2^24) stayed sub-pixel — trail
 * accumulation rendered the lattice as vertical columns (Math.fround
 * simulation: 51-52 distinct screen-X positions vs ~5000 distinct
 * screen-Y over a 20%-of-bbox sweep at a practical working zoom).
 *
 * The fix composes uProj (world->clip) with the affine
 * `[0,1]^2 -> world bbox` map (`localMeters = bboxOrtho.xy +
 * (pos*2-1)*bboxOrtho.zw`) into ONE matrix, ENTIRELY in JS double
 * precision — `uProj`'s own entries are already safe (moderate magnitude:
 * its translation term is `(-cx*cosR-cy*sinR)/halfWView`, a single
 * already-reduced quantity, never a raw world coordinate added to a small
 * delta at fp32 on the GPU) so multiplying it by the affine matrix in JS
 * doubles and uploading ONLY the resulting O(1)-magnitude coefficients
 * eliminates every large-number GPU intermediate. The shader becomes
 * `clip = uPosToClip * vec3(pos, 1.0)` — see PARTICLE_RENDER_VERTEX_SHADER.
 *
 * Matrix pre-composition only (wave brief's explicit boundary) — no
 * shader-architecture rework, and the mesh path's OWN world-frame fp32
 * (~2m x geo-accuracy bound) is untouched (separate follow-up, out of
 * scope here).
 * @param {{cx:number,cy:number,halfW:number,halfH:number}} bboxOrtho
 * @param {Float32Array|number[]} projMatrix length-9 column-major 3x3 (buildProjectionMatrix's output)
 * @returns {Float32Array} length-9 column-major 3x3, ready for gl.uniformMatrix3fv
 */
export function composePosToClipMatrix(bboxOrtho, projMatrix) {
    const { cx, cy, halfW, halfH } = bboxOrtho;
    const m = projMatrix;
    // affine: world = bboxOrtho.xy + (pos*2-1)*bboxOrtho.zw
    //   worldX = (2*halfW)*u + (cx - halfW)
    //   worldY = (2*halfH)*v + (cy - halfH)
    // composed = projMatrix * affine (column-major 3x3 multiply), all in JS doubles.
    const ax = 2 * halfW;
    const ay = 2 * halfH;
    const tx = cx - halfW;
    const ty = cy - halfH;
    return new Float32Array([
        m[0] * ax, m[1] * ax, m[2] * ax,
        m[3] * ay, m[4] * ay, m[5] * ay,
        m[0] * tx + m[3] * ty + m[6],
        m[1] * tx + m[4] * ty + m[7],
        m[2] * tx + m[5] * ty + m[8]
    ]);
}

/**
 * A stable string identity for the current camera pose + canvas size —
 * screen-space trails are meaningless across a camera move (AC/wave brief:
 * "trails RESET on any camera move ... reproject (or gracefully re-seed)");
 * this module implements the brief's explicitly-acceptable minimum ("Clear
 * + fast re-fade ... if visually clean") — a changed key means "clear the
 * trail buffer", checked by `hasCameraMoved`.
 * @param {{center:[number,number], resolution:number, rotation?:number}} viewState
 * @param {[number,number]} sizeCssPx
 * @returns {string}
 */
export function buildCameraKey(viewState, sizeCssPx) {
    const { center, resolution, rotation = 0 } = viewState || {};
    const [cx, cy] = center || [0, 0];
    const [w, h] = sizeCssPx || [0, 0];
    return `${cx}|${cy}|${resolution}|${rotation}|${w}x${h}`;
}

/**
 * @param {string} prevKey
 * @param {string} nextKey
 * @returns {boolean}
 */
export function hasCameraMoved(prevKey, nextKey) {
    return prevKey !== nextKey;
}

/**
 * Uniform-random initial particle positions in [0,1] UV space (RGBA, w=1) —
 * matches the shape a Float32Array-backed ping-pong texture upload needs.
 * `randomFn` is injectable so this is deterministically testable.
 * @param {number} gridSize
 * @param {function(): number} [randomFn=Math.random]
 * @returns {Float32Array} length gridSize*gridSize*4
 */
export function initialParticlePositions(gridSize, randomFn = Math.random) {
    const n = gridSize * gridSize;
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
        out[i * 4] = randomFn();
        out[i * 4 + 1] = randomFn();
        out[i * 4 + 2] = 0;
        out[i * 4 + 3] = 1;
    }
    return out;
}

// ---------------------------------------------------------------------------
// GLSL sources
// ---------------------------------------------------------------------------

// Ping-pong advection: each texel IS one particle's [0,1] UV position;
// sample the SAME velocity texture TASK-2632 built (depth in .a), advance,
// and stochastically recycle per pickRespawnRate's mirrored rate.
export const PARTICLE_ADVECT_VERTEX_SHADER = `#version 300 es
in vec2 aQuad;
void main() { gl_Position = vec4(aQuad, 0.0, 1.0); }`;

export const PARTICLE_ADVECT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uDt;
uniform float uSpeedScale;
uniform float uRandSeed;
uniform float uDropRate;
uniform float uStallDropRate;
uniform float uMinSpeed;
uniform float uWetThreshold;
// TASK-2743 UAT-02 — both are [0,1] UV rects (origin.xy, size.zw), computed on
// the CPU in float64 by computeParticleViewRects. Every component is O(1), so
// no large-magnitude world coordinate reaches the GPU here (TASK-2661).
// Defaulting both to the full domain makes an un-uploaded uniform behave
// exactly like the pre-2743 shader rather than killing every particle.
uniform vec4 uRespawnRect;
uniform vec4 uCullRect;
out vec4 fragColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec2 pos = texelFetch(uPosTex, texel, 0).rg;
  vec4 vd = texture(uVelTex, pos);
  vec2 vel = vd.xy;
  float depth = vd.a;
  pos = fract(pos + vel * uDt * uSpeedScale);
  // "kill outside the mesh extent" (AC) needs no separate bounds test: any
  // UV never covered by a mesh triangle reads depth=0 (the velocity FBO's
  // clear colour) — indistinguishable from a dry cell, so the dry flag
  // below already covers it (this module's header).
  float dry = step(depth, uWetThreshold);
  float still = step(length(vel), uMinSpeed);
  float notFlowing = max(dry, still);
  // TASK-2743 UAT-02 — a particle outside the CULL rect recycles at the same
  // fast stall rate as a dry one. Folded into notFlowing on its own line so the
  // two lines below stay byte-identical to the shipped shader.
  vec2 offLo = step(pos, uCullRect.xy);
  vec2 offHi = step(uCullRect.xy + uCullRect.zw, pos);
  float offView = max(max(offLo.x, offLo.y), max(offHi.x, offHi.y));
  notFlowing = max(notFlowing, offView);
  float rate = mix(uDropRate, uStallDropRate, notFlowing);
  vec2 seed = gl_FragCoord.xy + vec2(uRandSeed);
  // ... and it respawns inside the RESPAWN rect, which is narrower than the
  // cull rect so a fresh particle has room to drift before it is culled again.
  vec2 respawn = uRespawnRect.xy + vec2(hash(seed + 1.3), hash(seed + 7.7)) * uRespawnRect.zw;
  fragColor = vec4(mix(pos, respawn, step(hash(seed), rate)), 0.0, 1.0);
}`;

// Point-render program: fetches position from the ping-pong texture
// per-instance via gl_VertexID (attribute-less draw, matches the spike).
// TASK-2661 (W6.75.1) — uPosToClip is the CPU-precomposed
// composePosToClipMatrix(bboxOrtho, projMatrix) result (JS float64
// composition of uProj with the [0,1]^2->world-bbox affine): every GPU
// intermediate here is now O(1), eliminating the fp32 world-meter lattice
// (see this module's header + composePosToClipMatrix's docstring). Replaces
// the former separate uProj/uBboxOrtho pair (which reconstructed world
// meters ON THE GPU in fp32 — the root cause).
export const PARTICLE_RENDER_VERTEX_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uPosTex;
uniform int uGridSize;
uniform mat3 uPosToClip;   // CPU-precomposed pos[0,1]->clip, see composePosToClipMatrix
uniform float uPointSize;
out vec2 vPos;
void main() {
  int id = gl_VertexID;
  ivec2 texel = ivec2(id % uGridSize, id / uGridSize);
  vec2 pos = texelFetch(uPosTex, texel, 0).rg; // [0,1] normalized over the run bbox
  vPos = pos; // speed/depth looked up in the FRAGMENT shader (proven-working path — spike comment)
  vec3 clip = uPosToClip * vec3(pos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  gl_PointSize = uPointSize;
}`;

export const PARTICLE_RENDER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float uMinSpeed;
uniform float uWetThreshold;
uniform sampler2D uVelTex;
in vec2 vPos;
out vec4 fragColor;
void main() {
  vec4 vd = texture(uVelTex, vPos);
  float speed = length(vd.xy);
  float depth = vd.a;
  if (depth <= uWetThreshold || speed < uMinSpeed) discard; // dry/still/off-mesh — mirrors isParticleFlowing
  float t = clamp(speed / 2.0, 0.0, 1.0);
  fragColor = vec4(0.75 + 0.25 * t, 0.93, 1.0, 0.35 + 0.55 * t);
}`;

// Fullscreen-quad trail fade/copy/vertex programs — screen-space RGBA8
// ping-pong, faded (not cleared) each frame so particle heads leave a
// decaying tail. Reset (see AnugaPlaybackParticleRenderer.renderTrails) on
// any camera move (buildCameraKey/hasCameraMoved) — the brief's explicitly
// acceptable minimum.
export const TRAIL_QUAD_VERTEX_SHADER = `#version 300 es
layout(location=0) in vec2 aQuad;
out vec2 vUv;
void main() { vUv = aQuad * 0.5 + 0.5; gl_Position = vec4(aQuad, 0.0, 1.0); }`;

export const TRAIL_FADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uFade;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUv) * uFade; }`;

export const TRAIL_COPY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUv); }`;

export const FULLSCREEN_QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
