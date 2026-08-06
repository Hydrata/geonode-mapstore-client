/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackColormap — 1D LUT colormap generation for the playback mesh
 * renderer (TASK-2626, W2.2, epic 2618), productized from the W0.3 spike
 * (`spikes/w0_3_webgl_renderer/index.html`'s `makeLUT()`). The byte-array
 * build is pure (headlessly testable); only `uploadLUTTexture` touches a
 * real GL context.
 */

// Same blue -> cyan -> yellow -> red ramp as the W0.3 spike (a
// perceptually-reasonable water-depth/speed ramp, not a formal palette).
export const DEPTH_COLORMAP_STOPS = [
    [8, 29, 88],
    [37, 110, 180],
    [65, 182, 196],
    [199, 233, 180],
    [255, 237, 111],
    [227, 74, 51],
    [128, 0, 38]
];

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Build an RGBA8 1D LUT (row of `size` texels) from an ordered list of
 * [r,g,b] stops (0-255), evenly spaced along [0,1] and linearly
 * interpolated between neighbours. Alpha is always 255 (opacity is applied
 * separately at the layer level, not baked into the colormap).
 * @param {number[][]} stops at least 2 [r,g,b] triples
 * @param {number} [size=256]
 * @returns {Uint8Array} length size*4, RGBA8 row-major
 */
export function buildColormapLUT(stops, size = 256) {
    if (!Array.isArray(stops) || stops.length < 2) {
        throw new Error('playbackColormap.buildColormapLUT: stops must have at least 2 entries');
    }
    if (!(size >= 2)) {
        throw new Error('playbackColormap.buildColormapLUT: size must be >= 2');
    }
    const data = new Uint8Array(size * 4);
    const nSegments = stops.length - 1;
    for (let i = 0; i < size; i++) {
        const t = i / (size - 1);
        const seg = t * nSegments;
        const i0 = Math.min(nSegments - 1, Math.floor(seg));
        const f = seg - i0;
        const a = stops[i0];
        const b = stops[i0 + 1];
        data[i * 4 + 0] = Math.round(lerp(a[0], b[0], f));
        data[i * 4 + 1] = Math.round(lerp(a[1], b[1], f));
        data[i * 4 + 2] = Math.round(lerp(a[2], b[2], f));
        data[i * 4 + 3] = 255;
    }
    return data;
}

/**
 * Upload a LUT byte array (from buildColormapLUT) as a CLAMP_TO_EDGE,
 * LINEAR-filtered RGBA8 2D texture (1 x N, sampled as a 1D ramp — matches
 * the W0.3 spike's `texture(uLUT, vec2(vValue, 0.5))` sampling convention).
 * @param {WebGL2RenderingContext} gl
 * @param {Uint8Array} lutData
 * @param {number} size texel count (lutData.length / 4)
 * @returns {WebGLTexture}
 */
export function uploadLUTTexture(gl, lutData, size) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}
