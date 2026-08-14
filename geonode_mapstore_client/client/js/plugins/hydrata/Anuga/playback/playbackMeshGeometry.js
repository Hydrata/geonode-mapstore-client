/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackMeshGeometry — pure geometry/buffer-packing helpers for the
 * AnugaPlaybackLayer WebGL2 mesh renderer (TASK-2626, W2.2, epic 2618). No
 * GL/DOM/OL types here — every export is a plain-data transform so the
 * layer's actual `render(frameState)` stays a thin GL-calls-only shell
 * (spec: "Keep GL smoke tests minimal in karma ... math already covered
 * headlessly").
 */

/**
 * Build a deduplicated GL_LINES edge-index buffer for wireframe rendering
 * from a (nFace, 3) face_node_connectivity array (schema §2 — the same int32
 * array the fetcher decodes as-is, no dequantization). Each triangle
 * contributes edges (v0,v1) (v1,v2) (v2,v0); an edge shared by two
 * triangles (any interior mesh edge) is only emitted once.
 * @param {Int32Array|number[]} faceNodeConnectivity flat, row-major (nFace*3)
 * @returns {Uint32Array} flat pairs [a0,b0, a1,b1, ...] for gl.LINES
 */
// TASK-2686 (W6.75.4, epic 2618) — wireframe legibility at scale. The
// >=500k / <50k boundary the AC states directly (below this, behaviour must
// be byte-identical to today; the reference point IS the AC's own <50k
// "unchanged" case, not a newly-invented constant).
export const WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES = 50000;
// A large mesh (e.g. 505k triangles = ~10x the reference) still shows SOME
// edges rather than fading toward invisible — cap how far the stride grows.
export const WIREFRAME_MAX_DECIMATION_STRIDE = 12;
// The wireframe must never fully vanish, however dense the mesh — a faint
// but present overlay beats a silently-empty one.
export const WIREFRAME_MIN_OPACITY = 0.08;

/**
 * How many edges to SKIP between each drawn edge, for a mesh of
 * `triangleCount` triangles — one of the two legibility levers (with
 * wireframeOpacityForTriangleCount) TASK-2686 applies together: at
 * >=500k triangles the RAW edge count so far exceeds screen resolution at
 * any practical working zoom that overlapping semi-transparent lines alone
 * still saturate toward solid white (accumulated coverage 1-(1-alpha)^k
 * approaches 1 as the per-pixel edge-overlap count k grows) — cutting the
 * NUMBER of edges drawn directly reduces k, which opacity alone cannot.
 * Below the reference triangle count this returns 1 (draw every edge — the
 * AC's explicit small-mesh "unchanged" case).
 * @param {number} triangleCount
 * @returns {number} >= 1
 */
export function wireframeDecimationStride(triangleCount) {
    if (!(triangleCount > WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES)) {
        return 1;
    }
    const raw = Math.round(triangleCount / WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES);
    return Math.min(WIREFRAME_MAX_DECIMATION_STRIDE, Math.max(1, raw));
}

/**
 * Edge opacity for a mesh of `triangleCount` triangles — the second
 * legibility lever, applied ALONGSIDE (not instead of) decimation above.
 * Falls off as sqrt(reference/triangleCount) — softer than a linear falloff
 * so a moderately-large mesh (e.g. 100k) isn't punished as hard as the
 * decimation stride already punishes edge COUNT; floored at
 * WIREFRAME_MIN_OPACITY so the overlay never fully disappears. Below the
 * reference triangle count this returns `baseAlpha` UNCHANGED (AC: small
 * mesh behaviour is byte-identical to today).
 * @param {number} triangleCount
 * @param {number} [baseAlpha=0.35] WIRE_COLOR's existing alpha channel
 * @returns {number}
 */
export function wireframeOpacityForTriangleCount(triangleCount, baseAlpha = 0.35) {
    if (!(triangleCount > WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES)) {
        return baseAlpha;
    }
    const scale = Math.sqrt(WIREFRAME_LEGIBILITY_REFERENCE_TRIANGLES / triangleCount);
    return Math.max(WIREFRAME_MIN_OPACITY, baseAlpha * scale);
}

/**
 * Thin a buildWireframeIndices edge-pair buffer down to every `stride`-th
 * EDGE (not vertex — the array is [a0,b0, a1,b1, ...] pairs), preserving
 * order. `stride<=1` returns the input unchanged (identity — the small-mesh
 * AC case never touches this at all in practice, since the renderer only
 * calls it when wireframeDecimationStride(...) > 1, but the identity case is
 * kept correct/testable on its own).
 * @param {Uint32Array|number[]} indices flat edge pairs
 * @param {number} stride
 * @returns {Uint32Array}
 */
export function decimateWireframeIndices(indices, stride) {
    if (!(stride > 1)) {
        return Uint32Array.from(indices);
    }
    const nEdges = indices.length / 2;
    const out = [];
    for (let e = 0; e < nEdges; e += stride) {
        out.push(indices[e * 2], indices[e * 2 + 1]);
    }
    return Uint32Array.from(out);
}

export function buildWireframeIndices(faceNodeConnectivity) {
    const n = faceNodeConnectivity.length;
    if (n % 3 !== 0) {
        throw new Error('playbackMeshGeometry.buildWireframeIndices: length must be a multiple of 3');
    }
    const seen = new Set();
    const edges = [];
    const addEdge = (a, b) => {
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        const key = lo * 4294967296 + hi; // safe: vertex indices are well under 2^32 for any real mesh
        if (!seen.has(key)) {
            seen.add(key);
            edges.push(lo, hi);
        }
    };
    for (let f = 0; f < n; f += 3) {
        const v0 = faceNodeConnectivity[f];
        const v1 = faceNodeConnectivity[f + 1];
        const v2 = faceNodeConnectivity[f + 2];
        addEdge(v0, v1);
        addEdge(v1, v2);
        addEdge(v2, v0);
    }
    return Uint32Array.from(edges);
}

/**
 * TASK-2734 (W3, epic 2706) — the DECIMATED-DIRECT wireframe builder: emit
 * only the edges that survive decimation, and never materialise the full
 * edge set at all.
 *
 * WHY THIS EXISTS. buildWireframeIndices above is correct and stays exactly
 * as it is for small meshes, but at prod scale it is the epic's single
 * largest transient. On run 1328 (6,779,432 triangles / 3,393,075 nodes) it
 * holds three structures alive simultaneously — a `Set` of ~10.2M composite
 * keys, each computed as `lo * 4294967296 + hi` and therefore boxed by V8 as
 * a HeapNumber (plus the OrderedHashSet's own doubling table), a growable JS
 * Array of 20,338,296 elements, and an 81,353,184-byte `Uint32Array.from` of
 * that array — for a MEASURED 1,021.0 MiB / 3,139.9 ms. decimateWireframeIndices
 * then throws 11 of every 12 edges away (stride 12 at this triangle count).
 * This function allocates exactly ONE Uint32Array, sized before it is filled.
 *
 * HOW. Two linear passes over faceNodeConnectivity: pass 1 counts the edges
 * that pass the canonical-orientation test, pass 2 writes every `stride`-th
 * one into an exactly-sized output. No Set, no growable Array, no full-size
 * intermediate.
 *
 * DEDUP BY CANONICAL ORIENTATION, not by a `seen` Set. A triangle contributes
 * (v0,v1) (v1,v2) (v2,v0); an edge shared by two consistently-wound triangles
 * therefore appears once in each direction, so emitting only the occurrence
 * with `v_i < v_j` yields each INTERIOR edge exactly once with no memory of
 * what came before. The trade is that a BOUNDARY edge appears only once, so
 * roughly half of them (those wound the "wrong" way) are dropped. Measured on
 * the AC5 grid (n=320, 203,522 triangles, stride 4): 152,642 indices here vs
 * 152,962 from decimateWireframeIndices(buildWireframeIndices(...), 4) — a
 * 0.21% difference, all of it boundary edges, at a triangle density where a
 * single screen pixel already carries many edges.
 *
 * @param {Int32Array|number[]} faceNodeConnectivity flat, row-major (nFace*3)
 * @param {number} stride keep every `stride`-th surviving edge (<=1 keeps all)
 * @returns {Uint32Array} flat pairs [a0,b0, a1,b1, ...] for gl.LINES
 */
export function buildDecimatedWireframeIndices(faceNodeConnectivity, stride) {
    const n = faceNodeConnectivity.length;
    if (n % 3 !== 0) {
        throw new Error('playbackMeshGeometry.buildDecimatedWireframeIndices: length must be a multiple of 3');
    }
    const step = stride > 1 ? Math.floor(stride) : 1;

    // Pass 1 — COUNT ONLY. Nothing is retained, so the peak here is the
    // input array itself (which the caller already holds) plus three locals.
    let candidates = 0;
    for (let f = 0; f < n; f += 3) {
        const v0 = faceNodeConnectivity[f];
        const v1 = faceNodeConnectivity[f + 1];
        const v2 = faceNodeConnectivity[f + 2];
        if (v0 < v1) { candidates++; }
        if (v1 < v2) { candidates++; }
        if (v2 < v0) { candidates++; }
    }
    const kept = step > 1 ? Math.ceil(candidates / step) : candidates;
    const out = new Uint32Array(kept * 2);

    // Pass 2 — FILL. `e` counts surviving edges in emission order, exactly as
    // decimateWireframeIndices indexes the buffer it is handed, so the two
    // agree about WHICH edges a given stride keeps.
    let e = 0;
    let w = 0;
    for (let f = 0; f < n; f += 3) {
        const v0 = faceNodeConnectivity[f];
        const v1 = faceNodeConnectivity[f + 1];
        const v2 = faceNodeConnectivity[f + 2];
        if (v0 < v1) {
            if (e % step === 0) { out[w++] = v0; out[w++] = v1; }
            e++;
        }
        if (v1 < v2) {
            if (e % step === 0) { out[w++] = v1; out[w++] = v2; }
            e++;
        }
        if (v2 < v0) {
            if (e % step === 0) { out[w++] = v2; out[w++] = v0; }
            e++;
        }
    }
    return out;
}

// TASK-2743 UAT-01 (W6, epic 2706) — the wireframe's decimation UNIT.
//
// wireframeDecimationStride above thins EDGES in triangle-emission order, so
// whether a given triangle keeps 0, 1, 2 or 3 of its edges depends only on
// where the global edge counter happens to land. At the shipped stride of 12
// the chance that all three edges of any one triangle survive is ~1/1728:
// measured live on map 1461 (6,779,432 triangles), the overlay drew 847,429
// edges and closed EXACTLY ZERO triangles. That is why it reads as
// disconnected speckle rather than a thinned mesh — the operator's words were
// "makes the mesh look very incorrect".
//
// Selecting FACES and emitting all three of their edges makes every drawn
// primitive a closed triangle, so a decimated wireframe still reads as a mesh.
//
// The factor of 2 is what makes this free. The deduped edge set is 1.5 edges
// per face (3 edges each, each interior edge shared by 2 faces), so edge-stride
// s draws 1.5/s edges per face while face-stride 2s draws 3/(2s) = 1.5/s.
// Identical ink, identical buffer bytes, identical draw call — only the
// STRUCTURE changes. On map 1461: 1,694,858 -> 1,694,862 line indices (+4),
// 6,779,432 -> 6,779,448 bytes (+16), 0 -> 282,477 closed triangles.
export const WIREFRAME_FACE_STRIDE_FACTOR = 2;

/**
 * The face-decimation stride for a mesh of `triangleCount` triangles.
 *
 * Deliberately DERIVED from wireframeDecimationStride rather than re-computed,
 * so the two can never disagree about which side of the <50k "leave it alone"
 * boundary a mesh falls on (TASK-2686's AC forbids changing rendering for
 * meshes that already work). Returns 1 below the boundary, which routes
 * _ensureWireframeIndices to the ORIGINAL buildWireframeIndices path — so a
 * small mesh never enters this code at all.
 * @param {number} triangleCount
 * @returns {number}
 */
export function wireframeFaceStride(triangleCount) {
    const edgeStride = wireframeDecimationStride(triangleCount);
    return edgeStride > 1 ? edgeStride * WIREFRAME_FACE_STRIDE_FACTOR : 1;
}

/**
 * Build a GL_LINES index buffer that keeps every `faceStride`-th FACE and
 * emits all three of its edges — the closed-triangle counterpart to
 * buildDecimatedWireframeIndices.
 *
 * Keeps TASK-2734's discipline: the output is exactly sized BEFORE it is
 * filled (kept*6 is known in closed form, so unlike the edge builder this
 * needs no counting pass at all) and nothing is ever accumulated in a boxed JS
 * array. It is also ~48x less work than the edge builder at prod scale —
 * 282,477 block iterations instead of two passes over 6,779,432 faces.
 *
 * Interior edges shared by two KEPT faces are drawn twice. At stride 24 that
 * is ~3/24 = 4.2% of drawn edges, compositing to alpha 0.153 instead of 0.08 —
 * invisible, and deduplicating would require exactly the Set that TASK-2734
 * removed for costing 1,021 MiB.
 *
 * @param {Int32Array|Uint32Array|number[]} faceNodeConnectivity flat [v0,v1,v2, ...]
 * @param {number} faceStride keep every `faceStride`-th face (<=1 keeps all)
 * @returns {Uint32Array} flat pairs [a0,b0, a1,b1, ...] for gl.LINES
 */
export function buildFaceDecimatedWireframeIndices(faceNodeConnectivity, faceStride) {
    const n = faceNodeConnectivity.length;
    if (n % 3 !== 0) {
        throw new Error('playbackMeshGeometry.buildFaceDecimatedWireframeIndices: length must be a multiple of 3');
    }
    const nFace = n / 3;
    const step = faceStride > 1 ? Math.floor(faceStride) : 1;
    const kept = Math.ceil(nFace / step);
    const out = new Uint32Array(kept * 6);
    let w = 0;
    for (let b = 0; b < nFace; b += step) {
        const span = Math.min(step, nFace - b);
        // JITTERED BLOCK SAMPLE — one face per block of `step`, at a
        // pseudo-random offset WITHIN the block. A plain `b` (or `f % step`)
        // selector keeps the same column of a row-major mesh in every row and
        // renders as stripes rather than an even sample.
        //
        // Math.imul is load-bearing, not a style choice: `b * 2654435761`
        // exceeds 2^53 once b > ~3.39M, which is the MIDDLE of this mesh, and
        // float64 then rounds the low bits away. Demonstrated at b=6,779,431,
        // where the naive product yields 16 and the exact one yields 15.
        const f = b + ((Math.imul(b, 2654435761) >>> 0) % span);
        const i = f * 3;
        const v0 = faceNodeConnectivity[i];
        const v1 = faceNodeConnectivity[i + 1];
        const v2 = faceNodeConnectivity[i + 2];
        out[w++] = v0; out[w++] = v1;
        out[w++] = v1; out[w++] = v2;
        out[w++] = v2; out[w++] = v0;
    }
    return out;
}

// ============================================================================
// TASK-2743 UAT-05 (W6, epic 2706) — THE WIREFRAME'S INK BUDGET.
//
// The operator, looking at a 6.78M-triangle mesh at 1:564: "Can we make the
// triangles pure white and bring them to the front? They look like they are
// somehow transparent or covered here."
//
// They were not covered. The wireframe already draws LAST, after the scalar
// fill, the flow-viz arrows and the particle trails. It was drawn at
// rgba(0.9, 0.95, 1.0, 0.08) — READ OFF THE LIVE GL CONTEXT on map 1461 — 8%
// opacity, which is TASK-2686's WIREFRAME_MIN_OPACITY floor. At 8% over a
// saturated depth ramp the fill wins and the lines read as ghosts.
//
// The 8% is not arbitrary and cannot simply be raised: it is what stops a
// >=500k-triangle mesh whiting out its own viewport at full extent. But that
// number is a function of the MESH ALONE (wireframeOpacityForTriangleCount
// takes a triangle count and nothing else), and whiteout is not a property of
// the mesh — it is a property of the mesh AS SEEN AT A GIVEN ZOOM. The same
// buffer that saturates the screen at 4 m/px is a handful of crisp lines at
// 0.15 m/px. A constant cannot express that; it can only pick the worst case
// and live there, which is exactly what shipped.
//
// So state the real invariant instead: KEEP THE TOTAL INK THE WIREFRAME ADDS
// TO THE SCREEN CONSTANT. Let
//     k = (edge pixels the wireframe paints) / (viewport pixels)
// and hold `alpha * k` at a fixed budget. k > 1 means edges overlap and alpha
// must fall; k << 1 means the edges are isolated and alpha can go to a fully
// opaque 1.0 — which is precisely the operator's "pure white, at the front".
//
// k has a closed form that needs no per-frame geometry pass, and — this is the
// part that is easy to get wrong — it does NOT depend on the window size. With
// `res` the map resolution (projection metres per CSS pixel):
//     edges on screen  = drawnEdges * min(1, viewArea / meshArea)
//     ink pixels       = edges on screen * max(1, meanEdgeMetres / res)
//     pixels they land on = min(viewportPixels, meshArea / res^2)
// Zoomed IN, the view is inside the mesh, so the first min takes the view and
// the second takes the viewport; zoomed OUT, the mesh is inside the view, so
// the first takes 1 and the second takes the mesh's screen footprint. Both
// branches reduce to the SAME expression:
//     k = drawnEdges * max(1, meanEdge / res) * res^2 / meshArea
// which is exactly right: k is a LOCAL density — ink per pixel of mesh — and a
// bigger window shows more mesh at the same density, not denser mesh.
//
// Getting that wrong is not academic. A first cut used
// max(meshArea, viewArea) as the denominator, which made k CONSTANT as the map
// zoomed out past full extent: the whole mesh crammed into a postage stamp
// scored the same 0.86 as the mesh filling the screen, and the overlay would
// have stayed at that alpha while its real local density climbed past 160.
// The "zoomed out past the mesh" case below is the test that caught it.
//
// The max(1, ...) floor is load-bearing at full extent: at 4.15 m/px a 1.81 m
// edge is 0.44 CSS px long, but GL_LINES still rasterises at least one pixel,
// so a naive length term would UNDERSTATE the ink by 2.3x exactly where
// overstating the alpha does the most damage.
// ============================================================================

/**
 * The share of the mesh's own screen area the wireframe may paint, counted as
 * alpha-weighted ink (`alpha * k`). 0.10 is chosen to REPRODUCE the shipped
 * full-extent behaviour rather than to invent a new look: on map 1461 at full
 * extent k = 1.63, which puts alpha on TASK-2686's WIREFRAME_MIN_OPACITY floor
 * of 0.08 exactly — the same faint overlay that AC asked for, now arrived at
 * from the screen instead of from a triangle count.
 */
export const WIREFRAME_INK_BUDGET = 0.10;

/**
 * `k` — edge pixels the wireframe paints, per pixel of the mesh's own screen
 * footprint. See the block comment above for the derivation, including why the
 * window size does not appear. Returns 0 when it cannot be computed (no
 * resolution yet, empty mesh), which callers must read as "no opinion", NOT
 * as "no ink".
 *
 * @param {object} p
 * @param {number} p.drawnEdgeCount edges actually in the index buffer (nWireIndices / 2)
 * @param {number} p.meanEdgeLength mean edge length, PROJECTION metres (EPSG:3857 here)
 * @param {number} p.meshArea the mesh's own area, projection metres squared
 * @param {number} p.resolution map resolution, projection metres per CSS pixel
 * @returns {number} k >= 0
 */
export function wireframeInkCoverage({ drawnEdgeCount, meanEdgeLength, meshArea, resolution }) {
    if (!(drawnEdgeCount > 0) || !(meanEdgeLength > 0) || !(resolution > 0) || !(meshArea > 0)) {
        return 0;
    }
    const edgePixels = Math.max(1, meanEdgeLength / resolution);
    return drawnEdgeCount * edgePixels * resolution * resolution / meshArea;
}

/**
 * Edge alpha for an ink coverage `k`, holding `alpha * k` at
 * WIREFRAME_INK_BUDGET. Saturates to a fully opaque 1.0 once the edges stop
 * overlapping (k <= budget) and is floored at WIREFRAME_MIN_OPACITY so a
 * pathologically dense view still shows SOMETHING — the same never-vanish
 * promise TASK-2686 made, kept.
 *
 * k === 0 means "not computable" (see wireframeInkCoverage) and returns the
 * caller's `fallbackAlpha` unchanged, so a renderer that has no viewState yet
 * behaves exactly as it did before this function existed.
 *
 * @param {number} coverage k from wireframeInkCoverage
 * @param {number} fallbackAlpha used when coverage is not computable
 * @returns {number} in [WIREFRAME_MIN_OPACITY, 1]
 */
export function wireframeOpacityForInkCoverage(coverage, fallbackAlpha) {
    if (!(coverage > 0)) {
        return fallbackAlpha;
    }
    const alpha = WIREFRAME_INK_BUDGET / coverage;
    return Math.min(1, Math.max(WIREFRAME_MIN_OPACITY, alpha));
}

// ----------------------------------------------------------------------------
// TASK-2743 UAT-06 — "what would it take to make the triangles all show,
// instead of just some? Is this possible?"
//
// Measured on map 1461 (6,779,432 triangles), in the live tab: building the
// COMPLETE non-deduped edge set (3 edges per face, every face) takes 53 ms and
// 40,676,592 indices = 155.2 MiB, and uploading that buffer to the GPU takes
// 407 ms. So "every triangle, always" is affordable to BUILD — the 1,021 MiB
// figure TASK-2734 measured belonged to the Set-based DEDUPLICATION, not to
// the edge set itself, and dropping the dedup costs only a 2x index count on
// interior edges.
//
// It is not affordable to LOOK AT. At full extent those 20.3M edges score
// k = 39.1 against a 0.10 budget — a 390x overdraw, and the whole mesh goes
// solid white. Even at the operator's own 1:564 view k = 0.62, so the ink
// model would immediately dim them back to alpha 0.16 and undo the very thing
// the request was about. A complete wireframe only reads as a mesh from
// roughly 1:150 in.
//
// The useful question is therefore not "all or some" but "as many as this
// screen can actually show", and the ink budget already answers it: pick the
// face stride that puts k AT the budget, so the wireframe is always as dense
// as it can be while still being fully opaque white. On map 1461 at 1:564 that
// is stride 8 rather than the shipped 24 — 3x more triangles (2,542,287 edges,
// 19.4 MiB) at alpha 1.0, and at 1:150 it is stride 3 (6,779,433 edges,
// 51.7 MiB), 8x more, still fully opaque.
// ----------------------------------------------------------------------------

/**
 * A coarse ladder of face strides. Rebuilds are quantised onto it so that a
 * continuous zoom (or a one-pixel window resize) cannot thrash the index
 * buffer: only a real change of scale moves you a rung.
 */
export const WIREFRAME_FACE_STRIDE_LADDER = Object.freeze([1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128]);

/**
 * The most index bytes the wireframe may hold. 64 MiB is deliberately BELOW
 * the 155.2 MiB a complete edge set costs on map 1461: the playback residency
 * plan's whole fixed-bytes term is 323.5 MiB, and silently adding half of that
 * again for an overlay would blow PLAYBACK_HEAP_BUDGET_BYTES on exactly the
 * mesh this epic exists to make work. It bounds the stride from below — see
 * minFaceStrideForIndexBudget — rather than truncating a buffer mid-flight.
 */
export const WIREFRAME_MAX_INDEX_BYTES = 64 * 1024 * 1024;

/** Uint32 index pairs, 3 edges per kept face: 6 indices x 4 bytes. */
const WIREFRAME_BYTES_PER_KEPT_FACE = 24;

/**
 * The smallest face stride whose index buffer fits WIREFRAME_MAX_INDEX_BYTES.
 * @param {number} triangleCount
 * @returns {number} >= 1
 */
export function minFaceStrideForIndexBudget(triangleCount) {
    if (!(triangleCount > 0)) {
        return 1;
    }
    return Math.max(1, Math.ceil(triangleCount * WIREFRAME_BYTES_PER_KEPT_FACE / WIREFRAME_MAX_INDEX_BYTES));
}

/**
 * The face stride to draw at, for this mesh at this zoom: the densest rung of
 * WIREFRAME_FACE_STRIDE_LADDER that keeps ink coverage at or under
 * WIREFRAME_INK_BUDGET, never below what the index budget allows, and never
 * denser than `baseStride` asked for at the widest view.
 *
 * Returns `baseStride` unchanged whenever the inputs are not computable, so
 * every existing caller and every small mesh keeps today's behaviour exactly.
 *
 * @param {object} p
 * @param {number} p.baseStride the load-time stride (wireframeFaceStride)
 * @param {number} p.triangleCount
 * @param {number} p.meanEdgeLength projection metres
 * @param {number} p.meshArea projection metres squared
 * @param {number} p.resolution projection metres per CSS pixel
 * @returns {number}
 */
export function wireframeFaceStrideForView({
    baseStride, triangleCount, meanEdgeLength, meshArea, resolution
}) {
    if (!(baseStride > 1) || !(meanEdgeLength > 0) || !(resolution > 0) || !(meshArea > 0)) {
        return baseStride;
    }
    // Edges per face is 3 at ANY stride (each kept face contributes all three
    // of its own edges — that is the UAT-01 closed-triangle property), so the
    // drawn edge count for a candidate stride is exact, not estimated.
    const floorStride = Math.max(minFaceStrideForIndexBudget(triangleCount), 1);
    const candidates = WIREFRAME_FACE_STRIDE_LADDER
        .filter((s) => s >= floorStride && s <= baseStride);
    if (!candidates.length) {
        return Math.max(baseStride, floorStride);
    }
    for (let i = 0; i < candidates.length; i++) {
        const stride = candidates[i];
        const drawnEdgeCount = Math.ceil(triangleCount / stride) * 3;
        const k = wireframeInkCoverage({ drawnEdgeCount, meanEdgeLength, meshArea, resolution });
        if (k <= WIREFRAME_INK_BUDGET) {
            return stride;
        }
    }
    return candidates[candidates.length - 1];
}

/**
 * Mean edge length and total area of a triangulation, sampled every
 * `faceStep`-th face. Both are needed by the ink model and neither is worth a
 * full pass: on map 1461, stride 64 reads 105,929 of 6,779,432 faces and lands
 * the mean edge within 0.1% of the full-mesh value (1.812 m, measured both
 * ways in the live tab).
 *
 * Coordinates must be in the SAME frame the map's `resolution` is expressed in
 * — EPSG:3857 here, not the store's UTM, which differs by the 1/cos(lat)
 * Mercator scale factor (1.0071 at Dar es Salaam).
 *
 * @param {Float64Array|Float32Array|number[]} x
 * @param {Float64Array|Float32Array|number[]} y
 * @param {Int32Array|Uint32Array|number[]} faceNodeConnectivity
 * @param {number} [faceStep=64]
 * @returns {{meanEdgeLength: number, area: number, sampledFaces: number}}
 */
export function sampleMeshEdgeScale(x, y, faceNodeConnectivity, faceStep = 64) {
    const nFace = Math.floor(faceNodeConnectivity.length / 3);
    const step = faceStep > 1 ? Math.floor(faceStep) : 1;
    if (!(nFace > 0)) {
        return { meanEdgeLength: 0, area: 0, sampledFaces: 0 };
    }
    let edgeSum = 0;
    let areaSum = 0;
    let sampled = 0;
    for (let f = 0; f < nFace; f += step) {
        const i = f * 3;
        const v0 = faceNodeConnectivity[i];
        const v1 = faceNodeConnectivity[i + 1];
        const v2 = faceNodeConnectivity[i + 2];
        const x0 = x[v0]; const y0 = y[v0]; const x1 = x[v1]; const y1 = y[v1]; const x2 = x[v2]; const y2 = y[v2];
        edgeSum += Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x0 - x2, y0 - y2);
        areaSum += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
        sampled++;
    }
    return {
        meanEdgeLength: edgeSum / (sampled * 3),
        // Scale the sampled area back up to the whole mesh.
        area: areaSum * (nFace / sampled),
        sampledFaces: sampled
    };
}

/**
 * Interleave per-vertex depth/x_velocity/y_velocity (already-dequantized
 * physical Float32Arrays, same length) into one vec3-per-vertex buffer for
 * the GPU attribute upload (matches the W0.3 spike's packed qty0/qty1
 * buffers — depth in .x, velocity components in .y/.z).
 * @param {Float32Array} depth
 * @param {Float32Array} xVelocity
 * @param {Float32Array} yVelocity
 * @returns {Float32Array} length depth.length * 3
 */
export function packQuantityVec3(depth, xVelocity, yVelocity) {
    const n = depth.length;
    if (xVelocity.length !== n || yVelocity.length !== n) {
        throw new Error('playbackMeshGeometry.packQuantityVec3: depth/xVelocity/yVelocity length mismatch');
    }
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        out[i * 3] = depth[i];
        out[i * 3 + 1] = xVelocity[i];
        out[i * 3 + 2] = yVelocity[i];
    }
    return out;
}

/**
 * Broadcast the per-FACE `inradius` array (schema §2 — the minimum
 * centroid-to-edge-midpoint distance, one value per triangle) to a
 * per-VERTEX array the two-buffer vertex shader can consume as a plain
 * static attribute alongside elevation/friction (TASK-2629, W4.1). A vertex
 * takes the MINIMUM inradius among its incident faces — the conservative
 * choice for a risk indicator (Courant = celerity*dt/inradius: a SMALLER
 * inradius yields a LARGER, more hazardous Courant number; schema §2's own
 * B6 amendment flags "the unconservative direction for a risk indicator" as
 * the failure mode to avoid). A vertex with no incident face (degenerate
 * input) gets 0.
 * @param {Int32Array|number[]} faceNodeConnectivity flat, row-major (nFace*3)
 * @param {Float32Array|number[]} faceInradius length nFace
 * @param {number} nNode
 * @returns {Float32Array} length nNode
 */
export function computeVertexInradius(faceNodeConnectivity, faceInradius, nNode) {
    const out = new Float32Array(nNode).fill(Infinity);
    const nFace = faceInradius.length;
    for (let f = 0; f < nFace; f++) {
        const r = faceInradius[f];
        const i0 = faceNodeConnectivity[f * 3];
        const i1 = faceNodeConnectivity[f * 3 + 1];
        const i2 = faceNodeConnectivity[f * 3 + 2];
        if (r < out[i0]) {
            out[i0] = r;
        }
        if (r < out[i1]) {
            out[i1] = r;
        }
        if (r < out[i2]) {
            out[i2] = r;
        }
    }
    for (let i = 0; i < nNode; i++) {
        if (!isFinite(out[i])) {
            out[i] = 0;
        }
    }
    return out;
}

/**
 * Linear mix factor in [0,1] between two known-time samples t0Seconds and
 * t1Seconds for a playhead at nowSeconds — the `uMixT` the two-buffer
 * shader interpolates aQty0/aQty1 with. Clamped (never extrapolates past
 * either buffer). t1Seconds === t0Seconds (a degenerate/final-frame window)
 * returns 0 rather than dividing by zero.
 * @param {number} nowSeconds
 * @param {number} t0Seconds
 * @param {number} t1Seconds
 * @returns {number}
 */
export function computeMixFactor(nowSeconds, t0Seconds, t1Seconds) {
    if (t1Seconds === t0Seconds) {
        return 0;
    }
    const t = (nowSeconds - t0Seconds) / (t1Seconds - t0Seconds);
    return Math.min(1, Math.max(0, t));
}

/**
 * Build the column-major 3x3 world->clip-space matrix for an OL
 * `render(frameState)` callback, from the frame's viewState — the layer
 * owns its own WebGL2 canvas/context (no ol/webgl/Helper), so it must build
 * this itself rather than relying on ol's internal WebGL pipeline.
 *
 * Derivation: for world point p, let d = p - center, rotated by -rotation
 * to align with screen axes, then normalized by the world-space half-extent
 * of the viewport (resolution is world-units-per-CSS-pixel):
 *   clip.x = (cos(rot)*dx + sin(rot)*dy) / halfWidthWorld
 *   clip.y = (-sin(rot)*dx + cos(rot)*dy) / halfHeightWorld
 * WebGL clip-space +Y already renders as "up" on screen (no manual Y-flip),
 * so a rotation=0 map with north-up world data renders north-up.
 * @param {{center:[number,number], resolution:number, rotation?:number}} viewState
 * @param {[number,number]} sizeCssPx [width,height] in CSS pixels (frameState.size)
 * @returns {Float32Array} length 9, column-major (ready for gl.uniformMatrix3fv(loc, false, m))
 */
export function buildProjectionMatrix(viewState, sizeCssPx) {
    const { center, resolution, rotation = 0 } = viewState || {};
    const [cx, cy] = center || [0, 0];
    const [width, height] = sizeCssPx || [0, 0];
    if (!(resolution > 0) || !(width > 0) || !(height > 0)) {
        throw new Error('playbackMeshGeometry.buildProjectionMatrix: resolution/width/height must be > 0');
    }
    const halfW = (resolution * width) / 2;
    const halfH = (resolution * height) / 2;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    // column-major: [col0(3), col1(3), col2(3)]
    return new Float32Array([
        cosR / halfW, -sinR / halfH, 0, // col0 (x basis)
        sinR / halfW, cosR / halfH, 0, // col1 (y basis)
        (-cx * cosR - cy * sinR) / halfW, (cx * sinR - cy * cosR) / halfH, 1 // col2 (translation)
    ]);
}

/**
 * Apply a 3x3 column-major matrix (as built by buildProjectionMatrix) to a
 * homogeneous 2D point [x, y, 1]. Test-only helper (production code applies
 * the matrix on the GPU) — kept here so the projection matrix's correctness
 * can be asserted without duplicating the multiply in every test file.
 * @param {Float32Array|number[]} m length-9 column-major 3x3
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
export function applyProjectionMatrix(m, x, y) {
    return [
        m[0] * x + m[3] * y + m[6],
        m[1] * x + m[4] * y + m[7]
    ];
}

/**
 * The axis-aligned world-frame bounding box of the mesh's vertex positions
 * (already-reprojected x3857/y3857 — same frame as aPos/the renderer's
 * posBuf), used by the flow-viz overlay's bbox-ortho window
 * (TASK-2632, W5.1 — playbackFlowViz.computeBboxOrtho) — computed once per
 * mesh load, not per frame.
 * @param {Float64Array|Float32Array|number[]} x3857
 * @param {Float64Array|Float32Array|number[]} y3857
 * @returns {[number, number, number, number]} [minX, minY, maxX, maxY]
 */
export function computeMeshBounds(x3857, y3857) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < x3857.length; i++) {
        const x = x3857[i];
        const y = y3857[i];
        if (x < minX) {
            minX = x;
        }
        if (x > maxX) {
            maxX = x;
        }
        if (y < minY) {
            minY = y;
        }
        if (y > maxY) {
            maxY = y;
        }
    }
    return [minX, minY, maxX, maxY];
}

/**
 * Build the INVERSE of buildProjectionMatrix — clip(NDC)-space -> world
 * meters (TASK-2632, W5.1, epic 2618). The flow-viz arrow overlay samples a
 * grid fixed in SCREEN pixels (not a grid fixed in world meters, which is
 * what the W0.3 spike did — see playbackFlowViz.js's header for why that
 * departure matters for the AC's "constant density at every zoom" / QGIS
 * "on user grid" parity requirement): each grid point starts as an NDC
 * coordinate, which this matrix maps back to the world-meters point the
 * velocity FBO's bbox-normalized UV needs.
 *
 * buildProjectionMatrix's forward map is a pure rotation + independent
 * per-axis scale (halfW, halfH) + translation — no shear — so its inverse is
 * closed-form (rotation inverse = transpose, since R is orthonormal) rather
 * than a general 3x3 adjugate/cofactor computation:
 *   forward:  clip.x = ( cosR*dx + sinR*dy) / halfW
 *             clip.y = (-sinR*dx + cosR*dy) / halfH   where d = world - center
 *   inverse:  dx = cosR*halfW*clip.x - sinR*halfH*clip.y
 *             dy = sinR*halfW*clip.x + cosR*halfH*clip.y
 *             world = center + d
 * Feed the result through applyProjectionMatrix(inv, ndcX, ndcY) — same
 * generic 3x3-apply helper the forward matrix already uses, so a caller
 * doesn't need a second "apply" function for the inverse direction.
 * @param {{center:[number,number], resolution:number, rotation?:number}} viewState
 * @param {[number,number]} sizeCssPx [width,height] in CSS pixels (frameState.size)
 * @returns {Float32Array} length 9, column-major (ready for gl.uniformMatrix3fv(loc, false, m))
 */
export function buildInverseProjectionMatrix(viewState, sizeCssPx) {
    const { center, resolution, rotation = 0 } = viewState || {};
    const [cx, cy] = center || [0, 0];
    const [width, height] = sizeCssPx || [0, 0];
    if (!(resolution > 0) || !(width > 0) || !(height > 0)) {
        throw new Error('playbackMeshGeometry.buildInverseProjectionMatrix: resolution/width/height must be > 0');
    }
    const halfW = (resolution * width) / 2;
    const halfH = (resolution * height) / 2;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    return new Float32Array([
        cosR * halfW, sinR * halfW, 0, // col0 (clip.x basis)
        -sinR * halfH, cosR * halfH, 0, // col1 (clip.y basis)
        cx, cy, 1 // col2 (translation)
    ]);
}
