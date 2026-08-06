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
 *
 * The W0.3 spike's own evenly-spaced placeholder ramp (blue->cyan->yellow->
 * red, "not a formal palette") was superseded in TASK-2628 (W3.2) by the
 * real SLD-derived quantity stops below + buildQuantityColormapLUT — the
 * renderer now always uses those, so the placeholder was removed rather
 * than left as an unused, confusing "which ramp is real" second option
 * (Phase 1.7 simplify pass, epic 2618 W3 wave report).
 */

/**
 * TASK-2628 (W3.2, epic 2618) — the real per-quantity SLD colour stops
 * (mirrored from /opt/hydrata/apps/gn_anuga/slds/depth_6m.sld and
 * velocity_6ms.sld's ColorMapEntry list — same "mirror the SLD, don't
 * re-derive" convention as utils/demRamp.js's DEM_RAMP_COLORS). The AC
 * ("ramps consistent with the existing SLD colour stops") means BOTH the
 * legend swatches AND the live GL render must agree — a legend that shows
 * SLD colours while the mesh renders a different placeholder ramp would be
 * actively misleading, so AnugaPlaybackRenderer now builds its LUTs from
 * these too (see its dual-texture colorMode switch).
 *
 * Each SLD is a FIXED (non-rescaling) ramp saturating at a hard cap
 * (depth_6m.sld: 6m; velocity_6ms.sld: 6m/s, its last stop labelled
 * ">6.0 m/s") — unlike the dynamic DEM ramp, there is no live min/max to
 * rescale to. `quantity` is the real physical value (metres / m per
 * second) each colour begins at, NOT an evenly-spaced index — a real flood
 * event can exceed either cap (Merewether's W2/W3 fixture store's own
 * depth valid_max is 22m), so values above the cap clamp to the last
 * (darkest/most-saturated) colour, exactly like GeoServer's own SLD would.
 */
export const DEPTH_SLD_STOPS = [
    { quantity: 0.00, color: [218, 255, 228] }, // #daffe4
    { quantity: 0.05, color: [218, 255, 228] },
    { quantity: 0.10, color: [218, 255, 228] },
    { quantity: 0.20, color: [177, 245, 255] }, // #b1f5ff
    { quantity: 0.50, color: [135, 224, 249] }, // #87e0f9
    { quantity: 1, color: [93, 203, 241] }, // #5dcbf1
    { quantity: 2, color: [52, 182, 233] }, // #34b6e9
    { quantity: 3, color: [41, 145, 217] }, // #2991D9
    { quantity: 4, color: [30, 109, 169] }, // #1E6DA9
    { quantity: 5, color: [20, 69, 121] }, // #144579
    { quantity: 6, color: [7, 30, 73] } // #071E49
];
export const DEPTH_SLD_MAX = 6; // metres — depth_6m.sld's own cap

export const VELOCITY_SLD_STOPS = [
    { quantity: 0, color: [239, 248, 33] }, // #EFF821
    { quantity: 0.5, color: [240, 248, 118] }, // #F0F876
    { quantity: 1, color: [253, 201, 119] }, // #FDC977
    { quantity: 2, color: [251, 136, 97] }, // #FB8861
    { quantity: 3, color: [233, 98, 97] }, // #E96261
    { quantity: 4, color: [176, 42, 143] }, // #B02A8F
    { quantity: 5, color: [108, 1, 165] }, // #6C01A5
    { quantity: 6, color: [13, 8, 135] } // #0D0887, SLD label ">6.0 m/s"
];
export const VELOCITY_SLD_MAX = 6; // m/s — velocity_6ms.sld's own cap

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * TASK-2628 (W3.2) — build an RGBA8 1D LUT from REAL (non-uniformly-spaced)
 * SLD quantity stops (DEPTH_SLD_STOPS / VELOCITY_SLD_STOPS), so the ramp the
 * GPU actually samples is bucketed at the SAME physical breakpoints the SLD
 * defines (e.g. depth's first three stops span only 0-0.1m of the full 6m
 * cap) — a naive evenly-spaced buildColormapLUT() would stretch/compress
 * those buckets and silently stop matching the SLD. Texel `i` represents
 * physical value `(i/(size-1)) * colorMax`; a value past the last stop's
 * quantity clamps to the last stop's colour (the SLD's own saturation
 * behaviour — see VELOCITY_SLD_STOPS' ">6.0 m/s" label).
 * @param {Array<{quantity: number, color: number[]}>} stops ascending by quantity, >= 2 entries
 * @param {number} colorMax the physical value texel size-1 represents (matches the renderer's uColorMax uniform)
 * @param {number} [size=256]
 * @returns {Uint8Array} length size*4, RGBA8 row-major
 */
export function buildQuantityColormapLUT(stops, colorMax, size = 256) {
    if (!Array.isArray(stops) || stops.length < 2) {
        throw new Error('playbackColormap.buildQuantityColormapLUT: stops must have at least 2 entries');
    }
    if (!(colorMax > 0)) {
        throw new Error('playbackColormap.buildQuantityColormapLUT: colorMax must be > 0');
    }
    if (!(size >= 2)) {
        throw new Error('playbackColormap.buildQuantityColormapLUT: size must be >= 2');
    }
    const data = new Uint8Array(size * 4);
    const last = stops.length - 1;
    for (let i = 0; i < size; i++) {
        const value = (i / (size - 1)) * colorMax;
        let a = stops[0];
        let b = stops[last];
        let f = 0;
        if (value <= stops[0].quantity) {
            a = b = stops[0];
        } else if (value >= stops[last].quantity) {
            a = b = stops[last];
        } else {
            for (let s = 0; s < last; s++) {
                if (value >= stops[s].quantity && value <= stops[s + 1].quantity) {
                    a = stops[s];
                    b = stops[s + 1];
                    const span = b.quantity - a.quantity;
                    f = span > 0 ? (value - a.quantity) / span : 0;
                    break;
                }
            }
        }
        data[i * 4 + 0] = Math.round(lerp(a.color[0], b.color[0], f));
        data[i * 4 + 1] = Math.round(lerp(a.color[1], b.color[1], f));
        data[i * 4 + 2] = Math.round(lerp(a.color[2], b.color[2], f));
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
