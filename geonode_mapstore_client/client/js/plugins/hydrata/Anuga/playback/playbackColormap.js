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

/**
 * TASK-2629 (W4.1) — dIV (depth-integrated velocity, glossary: numerically
 * the D*V hazard-conveyance product) mirrors the real
 * /opt/hydrata/apps/gn_anuga/slds/depth_integrated_velocity_5m2s.sld
 * ColorMapEntry stops verbatim (a viridis ramp, first stop fully
 * transparent at 0 — dry/still cells render invisible rather than a solid
 * colour). The file is misnamed ("5m2s") but its own stops cap at 20 m²/s,
 * which this mirrors literally rather than trusting the filename.
 */
export const DIV_SLD_STOPS = [
    { quantity: 0, color: [68, 1, 84] }, // #440154
    { quantity: 0.3, color: [68, 1, 84] }, // #440154
    { quantity: 1, color: [68, 1, 84] }, // #440154
    { quantity: 3, color: [59, 82, 139] }, // #3b528b
    { quantity: 5, color: [33, 145, 140] }, // #21918c
    { quantity: 10, color: [94, 201, 98] }, // #5ec962
    { quantity: 20, color: [253, 231, 37] } // #fde725
];
export const DIV_SLD_MAX = 20; // m²/s — depth_integrated_velocity_5m2s.sld's own cap

/**
 * TASK-2629 (W4.1) — quantities with NO real SLD precedent (stage_max.sld
 * exists but is a datum-ABSOLUTE, project-relative, occasionally-negative
 * elevation ramp — the wrong shape for this renderer's fixed zero-based
 * `value/colorMax` LUT, see AnugaPlaybackRenderer's per-run stage rescale;
 * Froude/shear/Courant have no SLD at all) — stops defined in code, same
 * {quantity, color} structure as the SLD-derived tables above so they share
 * buildQuantityColormapLUT unchanged. Not a formal palette; chosen for clear
 * low->high visual separation, documented here rather than silently
 * invented in the renderer.
 */
export const STAGE_RAMP_STOPS = [
    { quantity: 0, color: [33, 102, 172] }, // #2166ac — low (matches stage_max.sld's low-end blue)
    { quantity: 0.25, color: [103, 169, 207] }, // #67a9cf
    { quantity: 0.5, color: [209, 229, 240] }, // light blue
    { quantity: 0.75, color: [253, 219, 199] }, // light tan
    { quantity: 1, color: [178, 24, 43] } // #b2182b — high
]; // fractional stops of the RUN's own [elevationMin, elevationMax+depthMax] span — see colorMinForQuantity

export const FROUDE_RAMP_STOPS = [
    { quantity: 0, color: [49, 130, 189] }, // subcritical, calm — blue
    { quantity: 0.5, color: [116, 196, 118] }, // green
    { quantity: 1.0, color: [255, 237, 111] }, // critical (Fr=1) — yellow
    { quantity: 1.5, color: [253, 141, 60] }, // orange
    { quantity: 3.0, color: [165, 15, 21] } // supercritical — dark red
];
export const FROUDE_RAMP_MAX = 3.0;

export const SHEAR_RAMP_STOPS = [
    { quantity: 0, color: [237, 248, 233] }, // pale green
    { quantity: 10, color: [161, 217, 155] },
    { quantity: 50, color: [116, 196, 118] },
    { quantity: 100, color: [255, 237, 111] },
    { quantity: 250, color: [253, 141, 60] },
    { quantity: 500, color: [165, 15, 21] } // Pa
];
export const SHEAR_RAMP_MAX = 500; // Pa — engineering default, no SLD precedent

export const COURANT_RAMP_STOPS = [
    { quantity: 0, color: [26, 152, 80] }, // stable — green
    { quantity: 0.5, color: [166, 217, 106] },
    { quantity: 1.0, color: [255, 255, 191] }, // at the CFL=1 boundary — yellow
    { quantity: 2.0, color: [253, 174, 97] },
    { quantity: 4.0, color: [215, 48, 39] } // well past stable — red
];
export const COURANT_RAMP_MAX = 4.0;

/**
 * TASK-2629 (W4.1) — AIDR H1-H6 discrete hazard classes (playbackDerivedQuantities.
 * AIDR_HAZARD_TABLE / AIDR_HAZARD_CITATION). NOT a continuous physical ramp —
 * six fixed classes, blue (safe) through red (severe), loosely following the
 * AIDR Guideline 7-3 Figure 6 visual scheme (the guideline publishes the
 * classification boundaries in Table 2, not official swatch hex values, so
 * these are a chosen, documented palette, not a transcription).
 */
export const HAZARD_CLASS_COLORS = [
    { classIndex: 0, className: 'H1', color: [121, 134, 203] }, // blue-lavender — generally safe
    { classIndex: 1, className: 'H2', color: [79, 195, 247] }, // light blue — unsafe for small vehicles
    { classIndex: 2, className: 'H3', color: [129, 199, 132] }, // green — unsafe for vehicles/children/elderly
    { classIndex: 3, className: 'H4', color: [220, 231, 117] }, // yellow-green — unsafe for vehicles and people
    { classIndex: 4, className: 'H5', color: [255, 202, 40] }, // amber — + buildings vulnerable to damage
    { classIndex: 5, className: 'H6', color: [211, 47, 47] } // red — + buildings vulnerable to failure
];

/**
 * TASK-2629 (W4.1) — one map, keyed by the SAME quantity ids as
 * playbackDerivedQuantities.QUANTITY_IDS, from which BOTH AnugaPlaybackRenderer
 * (the live GL LUT) and PlaybackLegend (the swatch list) build their
 * colours — the single place that can never let the legend and the render
 * disagree (W3's own stated goal, extended to all eight quantities). `max`
 * is the LUT's colorMax for a FIXED-cap ramp; `stage`'s `max` of 1 is a
 * placeholder — stage rescales PER RUN (colorMinForStage/colorMaxForStage
 * in playbackController.js), unlike every other fixed SLD-style cap.
 */
export const QUANTITY_RAMPS = Object.freeze({
    depth: { stops: DEPTH_SLD_STOPS, max: DEPTH_SLD_MAX, discrete: false },
    speed: { stops: VELOCITY_SLD_STOPS, max: VELOCITY_SLD_MAX, discrete: false },
    div: { stops: DIV_SLD_STOPS, max: DIV_SLD_MAX, discrete: false },
    stage: { stops: STAGE_RAMP_STOPS, max: 1, discrete: false },
    froude: { stops: FROUDE_RAMP_STOPS, max: FROUDE_RAMP_MAX, discrete: false },
    shear: { stops: SHEAR_RAMP_STOPS, max: SHEAR_RAMP_MAX, discrete: false },
    courant: { stops: COURANT_RAMP_STOPS, max: COURANT_RAMP_MAX, discrete: false },
    hazard: {
        stops: HAZARD_CLASS_COLORS.map((c) => ({ quantity: c.classIndex, classIndex: c.classIndex, className: c.className, color: c.color })),
        max: HAZARD_CLASS_COLORS.length - 1,
        discrete: true
    }
});

/**
 * A CSS `linear-gradient` of one result quantity's ramp (TASK-2751).
 *
 * Built from QUANTITY_RAMPS — the SAME stops the renderer's dual-LUT draws
 * with — so a swatch beside a row in the colour-scale table shows the colours
 * that quantity will actually be drawn in, not a decorative approximation.
 *
 * Continuous ramps place each stop at its own position in the ramp's value
 * range, so an uneven SLD (depth's 0/0.05/0.1/0.2/0.5/1/2/3/4/5/6) reads with
 * the same crowding at the low end that the map shows. Discrete ramps are
 * banded with hard edges — H1..H6 are classes and must never look blended.
 *
 * @param {string} quantityId
 * @returns {string} a `linear-gradient(...)` value
 */
export function rampGradientCss(quantityId) {
    const ramp = QUANTITY_RAMPS[quantityId] || QUANTITY_RAMPS.depth;
    const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
    if (ramp.discrete) {
        const n = ramp.stops.length;
        const bands = ramp.stops.map((s, i) => {
            const from = (i / n * 100).toFixed(2);
            const to = ((i + 1) / n * 100).toFixed(2);
            return `${rgb(s.color)} ${from}%, ${rgb(s.color)} ${to}%`;
        });
        return `linear-gradient(to right, ${bands.join(', ')})`;
    }
    const lo = ramp.stops[0].quantity;
    const hi = ramp.stops[ramp.stops.length - 1].quantity;
    const span = (hi - lo) || 1;
    const parts = ramp.stops.map((s) => `${rgb(s.color)} ${((s.quantity - lo) / span * 100).toFixed(2)}%`);
    return `linear-gradient(to right, ${parts.join(', ')})`;
}

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
 * TASK-2629 (W4.1) — build a DISCRETE (step-function, not interpolated) LUT
 * for the AIDR hazard classes: unlike buildQuantityColormapLUT (which
 * LINEARLY BLENDS between adjacent stops' colours), every texel maps to
 * exactly ONE class's flat colour — a continuous ramp would show illegal
 * "H2.5"-style blended colours at class boundaries, actively misleading for
 * a classification (AC: "the legend must render discrete classes"). Pairs
 * with uploadLUTTexture's NEAREST filter option so no GPU-side sampling
 * blend can reintroduce a blend at the seam either.
 * @param {Array<{classIndex: number, color: number[]}>} classStops ordered by classIndex, 0..N-1
 * @param {number} colorMax the shader's uColorMax for hazard (= N-1, the last classIndex)
 * @param {number} [size=256]
 * @returns {Uint8Array}
 */
export function buildDiscreteColormapLUT(classStops, colorMax, size = 256) {
    if (!Array.isArray(classStops) || classStops.length < 1) {
        throw new Error('playbackColormap.buildDiscreteColormapLUT: classStops must have at least 1 entry');
    }
    if (!(colorMax > 0)) {
        throw new Error('playbackColormap.buildDiscreteColormapLUT: colorMax must be > 0');
    }
    const data = new Uint8Array(size * 4);
    const n = classStops.length;
    for (let i = 0; i < size; i++) {
        const value = (i / (size - 1)) * colorMax;
        const idx = Math.max(0, Math.min(n - 1, Math.round(value)));
        const c = classStops[idx].color;
        data[i * 4 + 0] = c[0];
        data[i * 4 + 1] = c[1];
        data[i * 4 + 2] = c[2];
        data[i * 4 + 3] = 255;
    }
    return data;
}

/**
 * Upload a LUT byte array (from buildColormapLUT/buildDiscreteColormapLUT)
 * as a CLAMP_TO_EDGE RGBA8 2D texture (1 x N, sampled as a 1D ramp — matches
 * the W0.3 spike's `texture(uLUT, vec2(vValue, 0.5))` sampling convention).
 * @param {WebGL2RenderingContext} gl
 * @param {Uint8Array} lutData
 * @param {number} size texel count (lutData.length / 4)
 * @param {'linear'|'nearest'} [filter='linear'] NEAREST for discrete
 *   (hazard-class) LUTs — see buildDiscreteColormapLUT's header.
 * @returns {WebGLTexture}
 */
export function uploadLUTTexture(gl, lutData, size, filter = 'linear') {
    const glFilter = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}
