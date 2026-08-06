/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackIdentify — click-to-inspect at the current timestep (TASK-2628,
 * W3.2, epic 2618). Locates the mesh triangle containing a click point
 * (already reprojected to the SAME coordinate space the renderer draws in
 * — EPSG:3857), barycentric-interpolates the field across the triangle's 3
 * corner vertex values, and mixes frame0/frame1 by mixT exactly the way
 * the two-buffer GPU shader does — so this readout can never disagree with
 * what's on screen (both barycentric interpolation and time-mixing are
 * linear, so mixing-then-interpolating and interpolating-then-mixing give
 * the identical result; this mixes per-vertex first to mirror the shader's
 * own `q = mix(aQty0, aQty1, uMixT)` structure).
 *
 * AC (2628 context): this reads the SMOOTHED VERTEX field (schema §5's
 * "smoothing": "vertex-averaged" — every node already carries a
 * vertex-averaged value from the exporter). This is a DIFFERENT surface
 * than the *_max COG raster layers (centroid-IDW rasterization of
 * face-centroid max values) — a peak-frame identify at the same point can
 * visibly differ from the *_max raster's reading at that pixel. Every
 * result names `surface: 'vertex-smoothed'` so callers/UI can label it.
 */

const DEFAULT_WET_THRESHOLD = 1e-5;

/**
 * Signed-area barycentric coordinates of point (px,py) w.r.t. triangle
 * (ax,ay)-(bx,by)-(cx,cy). Returns null for a point outside the triangle or
 * a degenerate (zero-area) triangle. A tiny negative-epsilon tolerance
 * treats points exactly ON an edge (shared between two triangles) as
 * "inside" the first triangle the caller tests, rather than falling through
 * every face due to floating-point noise.
 * @returns {{u: number, v: number, w: number}|null} barycentric weights for (a,b,c), summing to 1
 */
export function computeBarycentric(px, py, ax, ay, bx, by, cx, cy) {
    const v0x = bx - ax;
    const v0y = by - ay;
    const v1x = cx - ax;
    const v1y = cy - ay;
    const v2x = px - ax;
    const v2y = py - ay;
    const den = v0x * v1y - v1x * v0y;
    if (den === 0) {
        return null; // degenerate (zero-area) triangle
    }
    const v = (v2x * v1y - v1x * v2y) / den;
    const w = (v0x * v2y - v2x * v0y) / den;
    const u = 1 - v - w;
    const EPS = 1e-7;
    if (u < -EPS || v < -EPS || w < -EPS) {
        return null;
    }
    return { u: Math.max(0, u), v: Math.max(0, v), w: Math.max(0, w) };
}

/**
 * Find the first mesh triangle containing (px, py) — a plain linear scan
 * over faces. O(nFace); acceptable for a single click interaction (not a
 * per-frame/per-vertex hot path) even at the ~100k-triangle real-store
 * scale (memory: 2618 W0/W2 fixture stores).
 * @param {Float64Array|Float32Array|number[]} x3857
 * @param {Float64Array|Float32Array|number[]} y3857
 * @param {Int32Array|number[]} faceNodeConnectivity flat, row-major (nFace*3)
 * @param {number} px
 * @param {number} py
 * @returns {{faceIndex: number, i0: number, i1: number, i2: number, u: number, v: number, w: number}|null}
 */
export function locatePointInMesh(x3857, y3857, faceNodeConnectivity, px, py) {
    const n = faceNodeConnectivity.length;
    for (let f = 0, faceIndex = 0; f < n; f += 3, faceIndex++) {
        const i0 = faceNodeConnectivity[f];
        const i1 = faceNodeConnectivity[f + 1];
        const i2 = faceNodeConnectivity[f + 2];
        const bary = computeBarycentric(
            px, py,
            x3857[i0], y3857[i0],
            x3857[i1], y3857[i1],
            x3857[i2], y3857[i2]
        );
        if (bary) {
            return { faceIndex, i0, i1, i2, u: bary.u, v: bary.v, w: bary.w };
        }
    }
    return null;
}

/** Barycentric-weighted sum of three per-vertex scalars. */
export function barycentricInterpolate(bary, v0, v1, v2) {
    return bary.u * v0 + bary.v * v1 + bary.w * v2;
}

/**
 * Sample the smoothed vertex field at a click point, mixing frame0/frame1
 * by mixT exactly like the renderer's two-buffer shader.
 * @param {{x3857: (Float64Array|number[]), y3857: (Float64Array|number[]), faceNodeConnectivity: (Int32Array|number[])}} mesh reprojected mesh (renderer's own x3857/y3857 — NOT the raw local nodeX/nodeY)
 * @param {{depth: Float32Array, xVelocity: Float32Array, yVelocity: Float32Array}} frame0
 * @param {{depth: Float32Array, xVelocity: Float32Array, yVelocity: Float32Array}} frame1
 * @param {number} mixT 0-1
 * @param {number} px
 * @param {number} py
 * @param {number} [wetThreshold]
 * @returns {{located: boolean, surface: 'vertex-smoothed', faceIndex?: number, depth?: number, xVelocity?: number, yVelocity?: number, speed?: number, wet?: boolean}}
 */
export function sampleFieldAtPoint(mesh, frame0, frame1, mixT, px, py, wetThreshold = DEFAULT_WET_THRESHOLD) {
    const located = locatePointInMesh(mesh.x3857, mesh.y3857, mesh.faceNodeConnectivity, px, py);
    if (!located) {
        return { located: false, surface: 'vertex-smoothed' };
    }
    const { faceIndex, i0, i1, i2, u, v, w } = located;
    const bary = { u, v, w };
    const mixVertex = (field, idx) => frame0[field][idx] + (frame1[field][idx] - frame0[field][idx]) * mixT;
    const mixedDepth = [mixVertex('depth', i0), mixVertex('depth', i1), mixVertex('depth', i2)];
    const mixedXVel = [mixVertex('xVelocity', i0), mixVertex('xVelocity', i1), mixVertex('xVelocity', i2)];
    const mixedYVel = [mixVertex('yVelocity', i0), mixVertex('yVelocity', i1), mixVertex('yVelocity', i2)];
    const depth = Math.max(0, barycentricInterpolate(bary, mixedDepth[0], mixedDepth[1], mixedDepth[2]));
    const wet = depth >= wetThreshold;
    const xVelocity = wet ? barycentricInterpolate(bary, mixedXVel[0], mixedXVel[1], mixedXVel[2]) : 0;
    const yVelocity = wet ? barycentricInterpolate(bary, mixedYVel[0], mixedYVel[1], mixedYVel[2]) : 0;
    return {
        located: true,
        surface: 'vertex-smoothed',
        faceIndex,
        depth,
        xVelocity,
        yVelocity,
        speed: Math.sqrt(xVelocity * xVelocity + yVelocity * yVelocity),
        wet
    };
}
