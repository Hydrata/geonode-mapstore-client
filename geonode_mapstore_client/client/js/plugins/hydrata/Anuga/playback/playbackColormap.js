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
// TASK-2743 (W6, epic 2706) — stage was ColorBrewer RdBu, a DIVERGING map, and
// diverging is not defensible for this quantity. The strongest argument is not
// perceptual, it is semantic: the pivot is an arithmetic artefact — the middle
// of the run's own [elevationMin, elevationMax + depthMax] span. Not sea level,
// not ground level, not bankfull, not a levee crest. Two runs of the SAME site
// with different depthMax put the neutral band at different absolute
// elevations, so the same colour means different things run to run, which
// defeats the run-to-run comparison a playback exists for.
//
// It also placed a perceptual flat spot at a meaningless value. Kovesi (2015,
// arXiv:1509.03700 sec 4.4): a lightness gradient reversal "will induce a
// perceptual flat spot", making structures that straddle the centre
// "effectively isoluminant" and "the source of both type 1 and type 2 errors
// simultaneously". And it was never even a correct RdBu — the five stops skip
// #F7F7F7, RdBu's actual neutral, so the true pivot sat between fractions 0.5
// and 0.75, measurably flat (L* 89.81 vs 89.71 across the middle quarter).
//
// So: a plain sequential map. `batlow` from the same Crameri v8.0.1 archive,
// t = q. Verified in numpy: L* monotonic INCREASING under normal vision, both
// deuteranopia models, both protanopia models and tritanopia; no non-adjacent
// pair below dE2000 10 (worst 13.98); uniformity ratio 3.3 -> 1.4. Checked
// against the obvious objection that it would be confused with `div`'s viridis:
// mean dE2000 at matched positions is 33.6, so it is not.
//
// IF stage ANOMALY is ever added — stage minus initial stage, or minus a fixed
// datum or bank crest — that quantity DOES have a real zero and `vik` centred
// on it would be exactly right. That is a different quantity worth adding, not
// a reason to fake a centre here.
export const STAGE_RAMP_STOPS = [
    { quantity: 0, color: [1, 25, 89] }, // L*=12.11
    { quantity: 0.125, color: [17, 67, 96] }, // L*=26.67
    { quantity: 0.25, color: [34, 96, 97] }, // L*=37.06
    { quantity: 0.375, color: [77, 115, 77] }, // L*=44.77
    { quantity: 0.5, color: [130, 130, 49] }, // L*=52.88
    { quantity: 0.625, color: [192, 144, 54] }, // L*=62.86
    { quantity: 0.75, color: [242, 157, 109] }, // L*=72.29
    { quantity: 0.875, color: [253, 180, 182] }, // L*=80.12
    { quantity: 1, color: [250, 204, 250] } // L*=87.20
]; // fractional stops of the RUN's own [elevationMin, elevationMax+depthMax] span — see colorMinForQuantity

// TASK-2743 (W6, epic 2706) — Froude was a blue->green->yellow->orange->red
// RAINBOW: five hues with no perceptual ordering, so the green/yellow/orange
// middle band carries almost no information under red-green colour blindness.
//
// TO ITS CREDIT, and stated plainly because the first draft of this comment got
// it wrong: the OLD ramp's lightness peak WAS already at Fr=1.0. Re-measured on
// the realised 256-texel LUT, the peak sits at 1.000 in normal vision and under
// both deuteranopia and protanopia. The replacement is NOT fixing a misplaced
// peak. What it fixes is that the peak was the only thing carrying the
// threshold — the hues either side were arbitrary, and Fr=0.5 vs Fr=1.5
// separate by only dE76 17.5 under protanopia despite being on opposite sides
// of a flow regime change.
//
// Fr = 1.0 is the critical-flow threshold separating subcritical from
// supercritical, so this is a textbook case for a DIVERGING map with its
// neutral pinned to the threshold (Kovesi 2015, arXiv:1509.03700 sec 4.2:
// diverging maps are for "data having a well defined reference value", the
// reference "denoted by a neutral colour"). Cool blue = subcritical, pale
// band = critical, warm red = supercritical, and the lightness peak renders a
// hydraulic jump as a bright contour.
//
// Map: `vik` from Crameri, F. (2023) Scientific colour maps v8.0.1, Zenodo
// doi:10.5281/zenodo.8409685 (MIT). Rationale: Crameri, Shephard & Heron
// (2020) Nat. Commun. 11:5444, doi:10.1038/s41467-020-19160-7.
//
// SAMPLED ASYMMETRICALLY, because Fr=1 is at value-fraction 0.333 but must
// land on map-fraction 0.5:  t = 0.5*v      for v <= 1
//                           t = 0.5 + 0.5*(v-1)/2  for v > 1
// Verified in numpy under Vienot-Brettel-Mollon (1999) AND Machado-Oliveira-
// Fernandes (2009) at severity 1.0: L* is Lambda-shaped about Fr=1 in normal
// vision, both deuteranopia models, both protanopia models and tritanopia; no
// non-adjacent pair below dE2000 10; and the minimum separation between ANY
// subcritical and ANY supercritical stop is 20.52 in the worst condition, so
// subcritical can never be misread as supercritical.
//
// The extra stops are interpolation control points, not new breakpoints —
// every original breakpoint is retained. They are needed because the LUT
// lerps in linear RGB, not a perceptual space: with only the original five
// stops the realised ramp departs from true `vik` by up to dE2000 13.06 (a
// visible corner mid-ramp); with these it is 2.96.
export const FROUDE_RAMP_STOPS = [
    { quantity: 0, color: [0, 18, 97] }, // L*=11.25 subcritical, still
    { quantity: 0.25, color: [3, 68, 129] }, // L*=28.74
    { quantity: 0.5, color: [48, 125, 166] }, // L*=49.56
    { quantity: 0.75, color: [148, 190, 210] }, // L*=74.68
    { quantity: 1.0, color: [236, 229, 224] }, // L*=91.35 CRITICAL FLOW (Fr=1)
    { quantity: 1.25, color: [233, 202, 184] }, // L*=83.46
    { quantity: 1.5, color: [219, 170, 141] }, // L*=73.37
    { quantity: 2.0, color: [194, 112, 65] }, // L*=55.52
    { quantity: 2.5, color: [145, 45, 6] }, // L*=33.79
    { quantity: 3.0, color: [89, 0, 8] } // L*=16.21 supercritical
];
export const FROUDE_RAMP_MAX = 3.0;

// TASK-2743 (W6, epic 2706) — shear was pale-green->green->yellow->orange->
// dark-red, and it was NOT MONOTONIC IN LIGHTNESS: the 100 Pa stop was
// ColorBrewer Set3's QUALITATIVE yellow #FFED6F, which spikes L* from 72.6
// back up to 93.0. A lightness reversal mid-ramp invents a boundary in the
// data that is not there.
//
// Shear is a plain magnitude with no meaningful midpoint, so it takes a plain
// perceptually-uniform SEQUENTIAL map: `lajolla` traversed high->low index so
// it runs light->dark, from the same Crameri v8.0.1 archive. Cream -> gold ->
// salmon -> brick -> near-black keeps the old pale-low/dark-warm-high reading
// while making it monotonic.  t = 1 - q/500.
//
// THE BREAKPOINTS CHANGED, deliberately, and this is the one judgement call
// here worth stating: keeping 0/10/50/100/250/500 and sampling `lajolla`
// evenly gives a realised ramp with uniformity ratio 22.5 — WORSE than the
// ramp being replaced (13.9) and worse than `jet` (21.7), because those
// breakpoints are a pseudo-log stretch and warp the value axis so hard that a
// uniform map stops being uniform in Pa. Even spacing gives 1.3.
// Verified in numpy: L* monotonic decreasing under normal vision, both
// deuteranopia models, both protanopia models and tritanopia.
// DISCLOSED: 400 vs 500 Pa reads dE2000 8.58 under protanopia — below the 10
// bar — but dE76 is 13.13 and delta-L* is 14.6, so the ORDER is never lost;
// CIEDE2000 heavily discounts chroma at low lightness. No other pair is under.
// OPEN, not decided here: if low-Pa detail matters (sand mobilises ~0.2-2 Pa),
// the principled fix is a lower SHEAR_RAMP_MAX or an explicitly log-labelled
// axis — not re-warping a linear one, which makes the legend unreadable.
export const SHEAR_RAMP_STOPS = [
    { quantity: 0, color: [255, 254, 203] }, // L*=98.61
    { quantity: 25, color: [253, 243, 171] }, // L*=95.13
    { quantity: 50, color: [249, 227, 132] }, // L*=90.20
    { quantity: 100, color: [240, 189, 87] }, // L*=79.39
    { quantity: 150, color: [234, 158, 83] }, // L*=71.26
    { quantity: 200, color: [227, 128, 80] }, // L*=63.63
    { quantity: 250, color: [217, 96, 78] }, // L*=55.75
    { quantity: 300, color: [179, 73, 71] }, // L*=45.36
    { quantity: 350, color: [125, 59, 53] }, // L*=33.45
    { quantity: 400, color: [81, 45, 30] }, // L*=22.72
    { quantity: 450, color: [48, 33, 13] }, // L*=14.09
    { quantity: 500, color: [25, 25, 0] } // L*=8.15  Pa
];
export const SHEAR_RAMP_MAX = 500; // Pa — engineering default, no SLD precedent

// TASK-2743 (W6, epic 2706) — Courant had the worst measured defect of the
// four, and this one was independently re-verified rather than taken on trust:
// its colours were ColorBrewer RdYlGn, the one diverging scheme
// colorbrewer2.org explicitly flags as NOT colourblind-safe, and on it CFL=0.5
// and CFL=2.0 separate by only dE76 6.68 under deuteranopia (Vienot-Brettel-
// Mollon). "Stable" and "twice the stability limit" were very nearly the same
// colour for roughly 8% of men. As with Froude, the old lightness peak WAS
// already at the threshold (measured 1.004) — that part was never broken.
//
// CFL = 1.0 is the stability threshold, so this takes the same treatment as
// Froude: `vik` with its neutral pinned to the threshold. Reusing the same map
// is deliberate — it gives one visual grammar across the two threshold
// quantities (the pale band is ALWAYS the threshold), and they are never on
// screen together.
//   t = 0.5*v            for v <= 1
//   t = 0.5 + 0.5*(v-1)/3  for v > 1
// Verified as for Froude: L* Lambda-shaped about CFL=1 in all five conditions,
// no non-adjacent pair below dE2000 10, worst-case separation between any
// stable and any unstable stop 19.55.
//
// STATED TRADEOFF: uniformity-per-CFL is 4.3 vs the old 4.2 — no gain, BY
// DESIGN. Pinning neutral at CFL=1 under a cap of 4.0 gives 0..1 half the
// colour budget, so the ramp is deliberately 3x steeper below the threshold.
// Uniformity is the wrong metric for a threshold map; the Lambda shape and the
// cross-threshold separation are the right ones, and both pass cleanly.
export const COURANT_RAMP_STOPS = [
    { quantity: 0, color: [0, 18, 97] }, // L*=11.25 well inside stability
    { quantity: 0.25, color: [3, 68, 129] }, // L*=28.74
    { quantity: 0.5, color: [48, 125, 166] }, // L*=49.56
    { quantity: 0.75, color: [148, 190, 210] }, // L*=74.68
    { quantity: 1.0, color: [236, 229, 224] }, // L*=91.35 CFL=1 (stability limit)
    { quantity: 1.25, color: [237, 213, 200] }, // L*=86.88
    { quantity: 1.5, color: [228, 191, 170] }, // L*=79.99
    { quantity: 2.0, color: [211, 151, 116] }, // L*=67.46
    { quantity: 3.0, color: [169, 69, 18] }, // L*=42.36
    { quantity: 4.0, color: [89, 0, 8] } // L*=16.21 well past stable
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
// TASK-2743 (W6, epic 2706) — H1..H6 is a REGULATORY classification, so before
// changing anything we asked whether there are canonical colours to conform to.
// THERE ARE NONE. Searched for colour|color|rgb|hex|legend|symbology across ten
// primary documents — AIDR Guideline 7-3 (BOTH the 2016 and 2017 editions),
// AIDR Handbook 7, Guidelines 7-2 and 7-5, WRL TR 2014/07 (Smith, Davey & Cox,
// the source study), ARR 2019 Book 6, NSW guideline FB03, the NSW Flood Risk
// Management Manual 2023, and Melbourne Water — and got ZERO specification
// hits. Every one defines the classes by D*V thresholds only (AIDR Tables 1-2
// p.11; ARR Tables 6.7.3-6.7.4 pp.260-261). AIDR confirms no edition newer than
// 2017. Decisively: AIDR REPAINTED ITS OWN FIGURE between the 2016 and 2017
// editions of the same guideline, and its example maps use a third scheme. A
// body that silently changes its own artwork is not maintaining a standard.
//
// The published FIGURE palettes, extracted from the PDFs and verified
// geometrically against the thresholds rather than read off labels, recorded
// here as the reference artwork they are:
//   ARR 2019 Book 6 Fig 6.7.9  #96B9E1 #BEE5E9 #BFDCB7 #D9E8AD #FFE7A6 #FABDA6
//     (CC BY 4.0, (c) Commonwealth of Australia / Geoscience Australia; figure
//      credited to Smith et al. 2014. The widely-copied HEC-RAS community
//      palette is BYTE-IDENTICAL to this, so it is the de-facto practitioner
//      artwork if anything is.)
//   AIDR 7-3 Fig 6             #C3CBE7 #C1E8FB #C0DFB1 #E8EEB1 #FFECAC #FBC2AC
//   NSW FB03 Fig 1             #83A6BC #ACE0EE #9ED7CE #D1D193 #FEE69C #F8A48C
// TUFLOW ships no hazard style at all; InfoWorks ICM uses the UK DEFRA rating.
//
// EVERY ONE OF THOSE FAILS A COLOUR-VISION CHECK, and they fail in the same
// place: H4 vs H5 collapses in all of them (ARR dE2000 2.36 under protanopia,
// AIDR 1.22, NSW 5.96, FLO-2D 4.96, Melbourne Water 7.40) — the yellow-green
// to yellow step is where Australian flood-practice palettes break under CVD.
// None has monotonic lightness; the two most discriminable achieve it by
// abandoning ordinality outright (Melbourne Water makes H3 LIGHTER than H1).
//
// So this is a HYDRATA HOUSE CHOICE, not conformance — there is nothing to
// conform to — and we choose accessibility: six even samples of matplotlib
// `inferno` REVERSED, light-safe to dark-severe. L* monotonic 98.0 -> 0.1 under
// normal vision, both deuteranopia models, both protanopia models and
// tritanopia, with ZERO of fifteen pairs below dE2000 10. `inferno` is
// perceptually uniform by construction (Smith & van der Walt, matplotlib,
// CC0). To switch to the ARR artwork instead, replace the six values with the
// ARR row above and accept its measured numbers.
export const HAZARD_CLASS_COLORS = [
    { classIndex: 0, className: 'H1', color: [252, 255, 164] }, // L*=98.0 generally safe
    { classIndex: 1, className: 'H2', color: [252, 165, 10] }, // L*=76.0 unsafe for small vehicles
    { classIndex: 2, className: 'H3', color: [221, 81, 58] }, // L*=52.6 unsafe for vehicles/children/elderly
    { classIndex: 3, className: 'H4', color: [147, 38, 103] }, // L*=33.5 unsafe for vehicles and people
    { classIndex: 4, className: 'H5', color: [66, 10, 104] }, // L*=16.1 + buildings vulnerable to damage
    { classIndex: 5, className: 'H6', color: [0, 0, 4] } // L*=0.1  + buildings vulnerable to failure
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
