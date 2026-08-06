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
