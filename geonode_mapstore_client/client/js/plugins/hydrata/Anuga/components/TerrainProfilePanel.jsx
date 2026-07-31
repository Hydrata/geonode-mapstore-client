/**
 * TASK-1861 (epic 1814 W4.4) — TerrainProfilePanel
 * TASK-2253 (epic 2249 W2) — Profile mode DELETED; the panel is Cross-section
 * only now (git history keeps the removed dual-y/velocity/momentum code).
 * TASK-2256 (epic 2249 W3) — picker-as-legend: a grouped TERRAIN / WATER
 * SURFACE picker (swatch + name + checkbox + n/3 counter + cap grey-out +
 * disabled reasons) renders ABOVE the Plotly chart and IS the chart's legend
 * (the Plotly legend is removed, LOCKED decision #5). Palettes + the
 * conditional fill rule live alongside buildCrossSectionData below (LOCKED
 * decisions #6/#7).
 *
 * Cross-section tool. A SimpleView side panel with the picker, a
 * "Draw profile line" button, and a Plotly chart of up to 3 terrains + 3
 * water surfaces vs distance along the drawn line.
 *
 * - "Draw profile line" dispatches startProfileDraw -> profileStartDrawEpic
 *   starts a MapStore LineString DrawSupport interaction.  On draw-complete
 *   profileEndDrawingEpic samples the checked terrains/scenarios via the
 *   profile endpoint and stores the series; this panel then renders it.
 * - Gated on a terrain/result being present: when no DEM is ready the draw
 *   button shows a "no terrain" hint instead of crashing (AC-5).  The epic
 *   ALSO guards server-side, so the panel never queries with no terrain.
 *
 * Chart: the MapStore PlotlyChart primitive (the same plotly the
 * LongitudinalProfile dock uses), with a white layout (white paper/plot, dark
 * text + light grid, axis unit titles) — TASK-2270.
 *
 * Mounted at the container level (like TerrainBboxPanel) so closing the Inputs
 * menu can't unmount it mid-draw; self-gates on profilePanelVisible.
 *
 * TASK-2585 (epic 2580 W2 UAT round 3) — operator ask: "make the whole panel
 * re-sizable and movable". The panel now rides the shared MovablePanel
 * primitive (drag by header, native corner resize, position/size persisted
 * per panelId 'crossSectionProfile' on the anuga ui slice) — the SAME
 * primitive TerrainBboxPanel/MergeTerrainsPanel/DemRampLegend already use.
 * See renderChart()'s ResizeObserver wiring for how the Plotly chart stays in
 * sync with a resized panel (react-plotly's own `useResizeHandler` only
 * listens for a WINDOW resize, which a panel-internal drag never fires).
 */
import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import PlotlyChart from '@mapstore/framework/components/charts/PlotlyChart';
import { colorToRgbaStr } from '../../../../../MapStore2/web/client/utils/ColorUtils';
// TASK-2585 (W2 UAT round 3) — the panel now rides the shared draggable +
// resizable floating-panel primitive (drag/resize + per-panelId persistence)
// instead of the fixed right-docked PanelHeader/footer shell below.
import MovablePanel from '../../shared/components/MovablePanel';
import {
    setProfilePanelVisible,
    startProfileDraw,
    clearProfile,
    // TASK-2276: dispatch the plain CLEAR_PROFILE_LINE action rather than
    // changeDrawingStatus('clean', ...) directly — clearProfileLineEpic
    // (profileEpic.js) is the one that decides whether it is safe to fire,
    // aliased here so it doesn't collide with the `clearProfileLine` PROP
    // this component already exposes (mapDispatchToProps below).
    clearProfileLine as clearProfileLineAction,
    toggleCheckedTerrain,
    toggleCheckedScenario,
    // TASK-2585 (W2 UAT round 3) — persists the MovablePanel position/size
    // for this panel (same action every other MovablePanel consumer uses).
    setMovablePanelState
} from '../actionsAnuga';
import { hasDemReady } from '../epics/cursorElevationEpic';
import {
    getTerrainPickerRows,
    getScenarioPickerRows
} from '../epics/profileEpic';
import { trackEvent } from '@js/utils/analytics';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

// TASK-2270 (epic 2249 W5) — WHITE chart background (operator UAT 2026-07-14:
// "should have a white background to maximise contrast"). Was a transparent
// dark-glass layout; now an opaque white plot with dark text + light-grey grid
// so the terrain/water lines read at maximum contrast. The axis TITLES (units)
// are injected at render time in renderChart() via this.tr() — a static layout
// object can't localize.
// TASK-2256 (epic 2249 W3) — LOCKED decision #5: the picker rows ARE the
// legend (swatch + name + checkbox); the Plotly legend is REMOVED
// (showlegend:false) so a chart with up to 6 series never doubles up its key.
export const CROSS_SECTION_LAYOUT = {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: 'rgba(0,0,0,0.85)', family: 'Montserrat, sans-serif', size: 11 },
    margin: { l: 56, r: 12, t: 8, b: 48 },
    showlegend: false,
    xaxis: {
        gridcolor: 'rgba(0,0,0,0.12)',
        zerolinecolor: 'rgba(0,0,0,0.25)',
        tickcolor: 'rgba(0,0,0,0.6)'
    },
    yaxis: {
        gridcolor: 'rgba(0,0,0,0.12)',
        zerolinecolor: 'rgba(0,0,0,0.25)',
        tickcolor: 'rgba(0,0,0,0.6)'
    }
};

/**
 * W4 UAT (TASK-1861/1862) — frame the y-axis to the data's vertical relief.
 *
 * Plotly autorange (or a 'tozeroy' fill) drags the y-axis down to include 0,
 * which squashes high-elevation terrain (e.g. 800..985 m) into the top of the
 * chart with a huge empty 0..800 band — the relief becomes invisible. Compute
 * an explicit [min - pad, max + pad] range from the ACTUAL plotted y-values so
 * the chart frames the data tightly. The 'tozeroy' terrain fill still reads as
 * solid ground: it fills from the line down past the clamped viewport bottom.
 *
 * `dataTraces` is the already-built Plotly data array (each {y:[...]}). Returns
 * a [lo, hi] tuple, or null when there is no finite value to frame (caller then
 * falls back to autorange).
 *
 * `opts`:
 *   - `filter(trace)`: only traces for which this returns truthy contribute (so
 *     the elevation 'y' range and the results 'y2' range can be computed off the
 *     same data array). Default: all traces.
 *   - `zeroBased`: clamp the low edge to 0 (the results axis — 0 depth = dry IS
 *     meaningful, so the right axis should start at 0). Default: false (frame to
 *     relief, lo = min - pad, never reaching 0 for high terrain).
 */
export function computeYRange(dataTraces, opts) {
    if (!Array.isArray(dataTraces) || dataTraces.length === 0) return null;
    const filter = (opts && typeof opts.filter === 'function') ? opts.filter : () => true;
    const zeroBased = !!(opts && opts.zeroBased);
    let min = Infinity;
    let max = -Infinity;
    dataTraces.forEach((trace) => {
        if (!filter(trace)) return;
        const ys = (trace && Array.isArray(trace.y)) ? trace.y : [];
        ys.forEach((v) => {
            if (typeof v === 'number' && isFinite(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        });
    });
    if (!isFinite(min) || !isFinite(max)) return null;
    const span = max - min;
    // Pad ~5% of the span, with a small absolute floor so a flat profile (or a
    // single point) still gets a readable band rather than a zero-height axis.
    const pad = Math.max(0.05 * span, 0.5);
    const lo = zeroBased ? 0 : (min - pad);
    return [lo, max + pad];
}

// ── TASK-2256 (epic 2249 W3) — earthy/watery palettes (LOCKED decision #6) ──
// Colour slots are keyed by STABLE picker-list position (id order), NOT check
// order — getColorSlot (profileEpic.js, TASK-2254) already guarantees this
// for the picker rows; getProfileTraces (TASK-2255) emits dem/stage traces in
// that SAME stable-checked-order, so a trace's index within its own role
// subset (computed below in buildCrossSectionData) IS its colour slot — no
// second lookup needed to keep swatch-colour === trace-colour (AC1).
// TASK-2585 (epic 2580 W2 UAT round 2) — operator ask: "increase the breadth
// of the terrain and water colour palettes, the contrast is very hard to
// read right now. Stronger colours...". The original 3 slots per family sat
// within a narrow ~30pt hue band at pastel saturation/lightness (36-50% sat),
// so adjacent slots read as near-identical at a glance. Each family's 3 slots
// now span a WIDE hue + lightness range at higher saturation (rust / ochre-
// gold / deep olive for terrain; strong blue / teal / indigo for water) while
// staying inside its family's character (earthy vs watery) — no logic here
// changed, only these six hex values (+ the fill alpha below).
export const TERRAIN_PALETTE = ['#AF491D', '#CC9719', '#45762D'];
export const WATER_PALETTE = ['#006EB2', '#07A297', '#1B24DA'];
// TASK-2585 — one shared alpha for both families' fills (operator ask: "30%
// opacity so they read better when on top of each other too"); previously
// TERRAIN_FILL_ALPHA=0.30 / WATER_FILL_ALPHA=0.25 (unused while fill was
// disabled) — unified since the operator asked for one consistent figure.
const CROSS_SECTION_FILL_ALPHA = 0.30;
// TASK-2585 (epic 2580 W2 UAT round 3) — operator ask: "The lines in the
// actual graph should be 0.7 opacity." Applies ONLY to the plotted chart
// line STROKES (terrainLineColor/waterLineColor below) — the picker/legend
// swatches stay FULL-STRENGTH solid (terrainColor/waterColor, unchanged;
// they must stay maximally legible as the chart's legend, LOCKED decision
// #5) — only the in-chart lines soften.
const CROSS_SECTION_LINE_ALPHA = 0.7;

// TASK-2269 (epic 2249 W5) — the terrain/water area FILL was disabled
// (operator UAT 2026-07-14: "the shading is not working properly, it extended
// off the graph — drop it for now until the rest is sorted"; the 'tozeroy'
// terrain fill spilled below the relief-clamped y-axis). The fill-SELECTION
// logic in buildCrossSectionData was preserved intact behind this flag, and
// the TASK-2273 water<terrain mask (below) was written specifically to make
// re-enabling artefact-free.
// TASK-2585 (epic 2580 W2 UAT round 2) — briefly RE-ENABLED at 30% opacity;
// TASK-2585 (round 3, operator UAT live on the wider palettes) — REVERTED
// back OFF ("remove the shaded fill area"). Back to false, same as the
// original W5 disable — the fill-SELECTION logic + the opt-in escape hatch
// (`opts.enableFill`, buildCrossSectionData below) are UNCHANGED, so a future
// pass can re-enable with zero rework, same as last time.
export const CROSS_SECTION_FILL_ENABLED = false;

/**
 * TASK-2577 (gap in TASK-2572) — does the STORED chart (the `traces` array
 * from the last draw, profileTraces in redux) reference a terrain that has
 * SINCE become superseded (a datum-shift conversion stamps
 * metadata.superseded_by, TASK-2326/2327 — same predicate as
 * getTerrainPickerRows/terrainEpics.js's supersededLayerNames)?
 *
 * The chart is sample-on-draw BY DESIGN (traces are stored at END_DRAWING,
 * TASK-2261/2262) — it never live-resamples — so a conversion that happens
 * AFTER a line was drawn leaves the plotted DEM trace silently stale (still
 * showing the pre-conversion ellipsoid elevation) with nothing on screen
 * saying so. This surfaces that staleness as a hint; it does not touch the
 * chart data itself (display-only, same policy as
 * supersededTerrainVisibilityEpic — never persists supersede state).
 *
 * `terrainResources` is the RAW state.anuga.resources.terrain list — NOT
 * getTerrainPickerRows, which already excludes superseded rows and so could
 * never detect one. Clears itself on the next redraw with no extra
 * bookkeeping: profileEndDrawingEpic builds `traces` from
 * getTerrainPickerRows (TASK-2577), which already excludes superseded
 * terrains, so a fresh draw can never reference one again.
 */
export function hasSupersededTraceTerrain(traces, terrainResources) {
    if (!Array.isArray(traces) || traces.length === 0) return false;
    const supersededIds = new Set(
        (terrainResources || [])
            .filter(t => t && t.metadata && t.metadata.superseded_by)
            .map(t => t.id)
    );
    if (supersededIds.size === 0) return false;
    return traces.some(t => t && t.role === 'dem' && supersededIds.has(t.terrainId));
}

/**
 * TASK-2262 — the checked-in-picker-list-order slot for EVERY row in `rows`,
 * computed ONCE (a single filter+map pass) rather than once PER ROW.
 * renderPickerGroup previously called getColorSlot(rows, checkedIds, row.id)
 * inside its rows.map() — getColorSlot itself does a fresh
 * filter+map+indexOf on every call, so a group of N rows did O(N^2) work
 * just to render its swatches. Returns a {id: slot} map (only checked ids
 * are present — same as getColorSlot returning -1 for an unchecked id, a
 * caller here should treat a missing key as "not checked"). getColorSlot's
 * own exported (rows, checkedIds, id) signature/contract is untouched — this
 * is a CALL-SITE optimisation in the picker component only.
 */
export function buildCheckedSlotMap(rows, checkedIds) {
    const map = {};
    if (!Array.isArray(checkedIds)) return map;
    (rows || [])
        .filter(r => r && checkedIds.includes(r.id))
        .forEach((r, idx) => { map[r.id] = idx; });
    return map;
}

/**
 * TASK-2261 (W-followup independent review) — the colour slot of every row
 * whose trace is ON the currently DISPLAYED chart, read from the STORED profile
 * traces (the exact array buildCrossSectionData renders). The picker rows ARE
 * the chart's legend (LOCKED decision #5), so while a chart is up the swatch
 * must match the plotted line, NOT the live selection: a trace's index within
 * its role subset IS the colour slot buildCrossSectionData assigns
 * (terrainColor(i) / waterColor(j)), so a swatch keyed here is pixel-identical
 * to its line even when live checkability or the selection has since diverged
 * from what was drawn (an external stage un-publish, or a toggle not yet
 * applied via Redraw). `{rowId: slot}` keyed by terrainId (terrain) /
 * scenarioId (water); a row not plotted is absent (transparent swatch). The
 * live-selection preview (buildCheckedSlotMap) is used instead BEFORE the first
 * draw, when there is no chart to be the legend for.
 */
export function buildChartSlotMap(traces, kind) {
    const role = kind === 'terrain' ? 'dem' : 'stage';
    const idKey = kind === 'terrain' ? 'terrainId' : 'scenarioId';
    const map = {};
    (traces || [])
        .filter(t => t && t.role === role)
        .forEach((t, idx) => { if (t[idKey] !== null && t[idKey] !== undefined) map[t[idKey]] = idx; });
    return map;
}

// Slot is the 0-based index within the CHECKED subset of a role, in stable
// picker-list order (see getColorSlot). Clamped to the last palette entry so
// a 4th+ trace (should never happen — the 3+3 cap enforces this upstream)
// degrades rather than returning undefined.
export function terrainColor(slot) {
    return TERRAIN_PALETTE[slot] || TERRAIN_PALETTE[TERRAIN_PALETTE.length - 1];
}
// hex -> rgba(...) at a fixed alpha via MapStore's own colorToRgbaStr
// (ColorUtils.js, tinycolor-backed) — reuse the framework's colour-parsing
// rather than hand-rolling a #rrggbb regex.
export function terrainFillColor(slot) {
    return colorToRgbaStr(terrainColor(slot), CROSS_SECTION_FILL_ALPHA);
}
// TASK-2585 (W2 UAT round 3) — the CHART LINE stroke, at 0.7 alpha. Same
// hex->rgba helper as terrainFillColor above, different alpha constant. The
// picker swatch keeps calling terrainColor() (full strength) directly — this
// is only for the line drawn inside buildCrossSectionData.
export function terrainLineColor(slot) {
    return colorToRgbaStr(terrainColor(slot), CROSS_SECTION_LINE_ALPHA);
}
export function waterColor(slot) {
    return WATER_PALETTE[slot] || WATER_PALETTE[WATER_PALETTE.length - 1];
}
export function waterFillColor(slot) {
    return colorToRgbaStr(waterColor(slot), CROSS_SECTION_FILL_ALPHA);
}
// TASK-2585 (W2 UAT round 3) — the CHART LINE stroke, at 0.7 alpha (see
// terrainLineColor above).
export function waterLineColor(slot) {
    return colorToRgbaStr(waterColor(slot), CROSS_SECTION_LINE_ALPHA);
}

/**
 * TASK-1862 (W4.5) — combined terrain + water-surface cross-section.
 * TASK-2255 (epic 2249 W2) — the water surface is the PUBLISHED stage_max
 * value, SAMPLED DIRECTLY (role='stage') — never derived from terrain+depth.
 * (DEM+depth_max=stage derivation was explicitly rejected: raster-level max
 * identity fails, and there is no run->terrain pairing record. LOCKED
 * decision #3 / AC4.)
 * TASK-2256 (epic 2249 W3) — multi-series + fill rules (LOCKED decision #7):
 *   - Up to 3 terrain traces (role='dem') and 3 water traces (role='stage'),
 *     one per CHECKED row, in STABLE picker-list order (the order
 *     getProfileTraces already emits them in — TASK-2255).
 *   - Terrain SLOT-1 (the first dem trace) is a FILLED area ('tozeroy');
 *     slots 2-3 are lines only — multiple terrain fills would double-shade
 *     and obscure each other on a shared y-axis.
 *   - A SINGLE checked water fills DOWN TO slot-1 terrain ('tonexty') ONLY
 *     when that terrain is its scenario's CURRENT terrain (`opts.
 *     scenarioTerrainById[stageTrace.scenarioId] === slot-1's terrainId`) —
 *     otherwise (0/2/3 waters checked, or a terrain mismatch) every water is
 *     a plain LINE. This is the "no inverted water-underground fill" guard:
 *     a stage sampled against a DIFFERENT (finer/coarser) terrain than the
 *     one it was run against can legitimately dip below that OTHER terrain's
 *     line at mesh-smoothing artefacts, which would fill as if the ground
 *     were submerged from below — never plausible hydraulically.
 *   - The DEFAULT SEED (active terrain + selected scenario) is exactly the
 *     single-terrain/single-water case with a real terrain match (a
 *     scenario's own terrain IS the terrain it was built against) — AC3's
 *     pixel-parity guard.
 *
 * `opts.scenarioTerrainById` is a { [scenarioId]: terrainId } lookup built by
 * the caller from the scenario picker rows (TerrainProfilePanelClass) — kept
 * OUT of this pure function so it stays trivially testable without redux.
 *
 * Uses the trace `role` (getProfileTraces tag) to find terrain (role='dem')
 * and water (role='stage') series unambiguously — never name sniffing. With
 * no DEM trace at all it returns [] (cannot build a cross-section without a
 * bed to anchor the x/y frame).
 *
 * Trace ORDER in the returned array matters: the FILLING water (if any) is
 * placed immediately after slot-1 terrain so Plotly's 'tonexty' fills against
 * the correct baseline (fill semantics key off array ADJACENCY, not role) —
 * every other line-only trace can safely follow in any order.
 */
export function buildCrossSectionData(samples, traces, opts) {
    if (!Array.isArray(samples) || samples.length === 0 || !Array.isArray(traces)) return [];
    const demTraces = traces.filter(t => t && t.role === 'dem');
    if (demTraces.length === 0) return [];
    const stageTraces = traces.filter(t => t && t.role === 'stage');
    const scenarioTerrainById = (opts && opts.scenarioTerrainById) || {};
    // The module constant (CROSS_SECTION_FILL_ENABLED) sets the default — OFF
    // (TASK-2269, reverted again by TASK-2585 round 3 after a brief round-2
    // re-enable); an explicit opts.enableFill overrides it either way so the
    // fill-selection logic below stays unit-testable regardless of the
    // current default.
    const fillEnabled = (opts && Object.prototype.hasOwnProperty.call(opts, 'enableFill'))
        ? !!opts.enableFill
        : CROSS_SECTION_FILL_ENABLED;

    const x = samples.map(s => s && s.distance_m);
    const yFor = (trace) => samples.map((s) => {
        const v = s && s[trace.key];
        return (typeof v === 'number') ? v : null;
    });

    // TASK-2273 (epic 2249 W5) — mask a water sample to a GAP wherever the
    // published stage sits STRICTLY BELOW the ground it is drawn against.
    // stage_max is rasterized at the coarse mesh/output resolution (~8 m) while
    // the terrain trace is the finer input DEM, so at shallow pond MARGINS the
    // flat stage can dip a few cm below the finer ground — a pure resolution
    // artefact that reads as "water below the terrain" (operator UAT 2026-07-14).
    // Each water is compared ONLY against ITS OWN scenario's terrain column; the
    // point is dropped where stage < terrain. Strict `<` keeps the depth-0
    // shoreline (stage == terrain, which coincides with the ground line and is
    // harmless). This never derives a stage from bed+depth (LOCKED decision #3) —
    // it only HIDES a published value that cannot legitimately be shown below its
    // own ground.
    // NO fallback to slot-1 terrain: if the water's own terrain isn't among the
    // sampled dem traces (e.g. a proposed-design scenario whose terrain isn't
    // checked), we CANNOT tell this resolution artefact from a legitimate
    // below-a-DIFFERENT-terrain water (which the W3 fill rule already treats as
    // plausible), so we leave the raw stage unmasked rather than silently delete
    // a whole trace. The artefact only exists relative to the scenario's OWN
    // terrain. (W5 review fix.)
    const demByTerrainId = {};
    demTraces.forEach((d) => { if (d && d.terrainId !== null && d.terrainId !== undefined) demByTerrainId[d.terrainId] = d; });
    const maskedWaterYFor = (stageTrace) => {
        const raw = yFor(stageTrace);
        const refTerrain = demByTerrainId[scenarioTerrainById[stageTrace.scenarioId]];
        if (!refTerrain) return raw;
        const terrainY = yFor(refTerrain);
        return raw.map((v, idx) => {
            if (v === null) return null;
            const g = terrainY[idx];
            return (typeof g === 'number' && v < g) ? null : v;
        });
    };

    const slot1Terrain = demTraces[0];
    // The single-water-fills-to-terrain rule: exactly one checked water, AND
    // its scenario's current terrain (per the caller-supplied lookup) is
    // slot-1's own terrain. A missing lookup entry / missing terrainId never
    // coerces to a false match beyond the deliberate undefined===undefined
    // case a caller that omits both ids altogether gets (documented on the
    // exported palette helpers above; real getProfileTraces output always
    // carries both ids, so this only matters for minimal test fixtures).
    const fillingStage = (stageTraces.length === 1 && slot1Terrain
        && scenarioTerrainById[stageTraces[0].scenarioId] === slot1Terrain.terrainId)
        ? stageTraces[0]
        : null;

    const data = [];
    demTraces.forEach((t, i) => {
        data.push({
            x,
            y: yFor(t),
            name: t.label || t.key,
            type: 'scatter',
            mode: 'lines',
            connectgaps: false,
            // TASK-2585 (W2 UAT round 3) — the line STROKE renders at 0.7
            // alpha (terrainLineColor); the fillcolor below (when enabled)
            // stays at its own 30% alpha (terrainFillColor) — unrelated knobs.
            line: { color: terrainLineColor(i), width: 2 },
            // Only slot-1 (i===0) is a filled area — slots 2-3 are lines.
            // TASK-2585: fillEnabled defaults OFF again (round 3 revert); the
            // selection logic (which slot fills) is unchanged either way.
            ...(i === 0 && fillEnabled ? { fill: 'tozeroy', fillcolor: terrainFillColor(i) } : {})
        });
        // Immediately after slot-1, splice in the filling water (if any) so
        // 'tonexty' fills against THIS terrain regardless of how many other
        // line-only terrain/water traces exist in the full set.
        if (i === 0 && fillingStage) {
            const stageY = maskedWaterYFor(fillingStage);
            if (stageY.some(v => v !== null)) {
                data.push({
                    x,
                    y: stageY,
                    name: fillingStage.waterLabel || fillingStage.label || 'Water surface',
                    type: 'scatter',
                    mode: 'lines',
                    // TASK-2585: fillEnabled defaults OFF again (round 3 revert);
                    // when a caller opts in the TASK-2273 mask keeps the water
                    // from ever sitting below terrain so this 'tonexty' fill
                    // stays artefact-free.
                    ...(fillEnabled ? { fill: 'tonexty', fillcolor: waterFillColor(0) } : {}),
                    connectgaps: false,
                    line: { color: waterLineColor(0), width: 2 }
                });
            }
        }
    });
    // Every other checked water (i.e. NOT the single filling one above) is a
    // plain line, keyed by its own stable slot within the stage subset so
    // its colour always matches its picker-row swatch (AC1).
    stageTraces.forEach((t, j) => {
        if (t === fillingStage) return;
        const stageY = maskedWaterYFor(t);
        if (!stageY.some(v => v !== null)) return;
        data.push({
            x,
            y: stageY,
            name: t.waterLabel || t.label || 'Water surface',
            type: 'scatter',
            mode: 'lines',
            connectgaps: false,
            line: { color: waterLineColor(j), width: 2 }
        });
    });
    return data;
}

// TASK-2585 (epic 2580 W2 UAT round 3) — MovablePanel panelId; persisted
// position/size lives at state.anuga.ui.movablePanels[CROSS_SECTION_PANEL_ID]
// (same convention as terrainBbox / mergeTerrains / demRampLegend).
export const CROSS_SECTION_PANEL_ID = 'crossSectionProfile';

// The panel's old CSS spot was right-docked (right:20px, base
// .simple-view-panel min-width:500px, top: var(--sv-panel-top, 65px) — see
// anuga.css). MovablePanel positions via a translate offset from the
// viewport's top-left, so this mimics that same on-screen spot for the
// FIRST open (matches defaultBboxPosition/defaultLegendPosition's own
// precedent in terrainBboxPanel.js / DemRampLegend.js); MovablePanel clamps
// it back on-screen anyway once the user actually drags it. Width (500) must
// match the CSS width rule below (.sv-profile-panel).
const DEFAULT_PROFILE_PANEL_WIDTH = 500;
function defaultProfilePanelPosition() {
    if (typeof window === 'undefined') return { x: 20, y: 65 };
    return { x: Math.max(20, window.innerWidth - DEFAULT_PROFILE_PANEL_WIDTH - 20), y: 65 };
}

// TASK-2585 (W2 UAT round 3, tweak 3) — the panel is now resizable
// (MovablePanel's native CSS corner-resize handle), but PlotlyChart's own
// `useResizeHandler` prop (react-plotly.js factory.js) only reacts to a
// WINDOW 'resize' event — a panel-internal drag never fires one, so the
// chart would otherwise stay frozen at its mount-time pixel size while the
// panel around it grows/shrinks (the explicit fail case the acceptance
// criteria rules out: "a resized panel with a frozen chart is a fail").
// TerrainProfilePanelClass wires a ResizeObserver on the chart's own
// container (see attachChartResizeObserver below) and calls this on every
// observed size change — it synthesises a window 'resize' event so the
// EXISTING useResizeHandler wiring calls Plotly.Plots.resize() with no new
// Plotly import needed here (config={{responsive:true}} alone does not
// auto-resize on a container change in this bundled plotly.js build — no
// ResizeObserver reference exists anywhere in it).
export function triggerChartReflow() {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new Event('resize'));
}

export class TerrainProfilePanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        drawingActive: PropTypes.bool,
        loading: PropTypes.bool,
        samples: PropTypes.array,
        traces: PropTypes.array,
        error: PropTypes.string,
        demReady: PropTypes.bool,
        setProfilePanelVisible: PropTypes.func,
        startProfileDraw: PropTypes.func,
        clearProfile: PropTypes.func,
        clearProfileLine: PropTypes.func,
        // TASK-2256 (epic 2249 W3) — picker-as-legend rows + checked-id state.
        terrainRows: PropTypes.array,
        scenarioRows: PropTypes.array,
        checkedTerrainIds: PropTypes.array,
        checkedScenarioIds: PropTypes.array,
        toggleCheckedTerrain: PropTypes.func,
        toggleCheckedScenario: PropTypes.func,
        // TASK-2577 — RAW terrain resources (not picker rows, which already
        // exclude superseded terrains) so the stored-chart staleness hint
        // can detect one.
        terrainResources: PropTypes.array,
        // TASK-2585 (W2 UAT round 3) — persisted MovablePanel position/size
        // + its setter (same shape as terrainBboxPanel.js/MergeTerrainsPanel).
        panelState: PropTypes.object,
        onPanelStateChange: PropTypes.func
    };

    static defaultProps = {
        terrainRows: [],
        scenarioRows: [],
        checkedTerrainIds: [],
        checkedScenarioIds: [],
        terrainResources: [],
        clearProfile: () => {},
        clearProfileLine: () => {},
        toggleCheckedTerrain: () => {},
        toggleCheckedScenario: () => {},
        onPanelStateChange: () => {}
    };

    // TASK-2585 (W2 UAT round 3) — attach/detach the chart ResizeObserver on
    // mount/update/unmount. See attachChartResizeObserver's own doc for why
    // this is needed at all (react-plotly's useResizeHandler only hears a
    // WINDOW resize).
    componentDidMount() {
        this.syncChartResizeObserver();
    }

    componentDidUpdate() {
        this.syncChartResizeObserver();
    }

    componentWillUnmount() {
        this.detachChartResizeObserver();
    }

    // Re-sync the observer to whatever DOM node is CURRENTLY the chart
    // container (renderChart() returns null — no container at all — until
    // there is data to plot, and a Clear/redraw can swap it out for a fresh
    // node). A no-op when already wired to the same element.
    syncChartResizeObserver() {
        const el = this.chartContainerEl;
        if (!el) {
            this.detachChartResizeObserver();
            return;
        }
        if (this._chartResizeObserverEl === el) return;
        this.detachChartResizeObserver();
        // Guarded (not every test/older-browser environment has it) — no
        // reflow-on-resize wiring rather than a crash when it's absent.
        if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') return;
        this._chartResizeObserver = new window.ResizeObserver(() => triggerChartReflow());
        this._chartResizeObserver.observe(el);
        this._chartResizeObserverEl = el;
    }

    detachChartResizeObserver() {
        if (this._chartResizeObserver) {
            this._chartResizeObserver.disconnect();
        }
        this._chartResizeObserver = null;
        this._chartResizeObserverEl = null;
    }

    handleClose = () => {
        this.props.setProfilePanelVisible(false);
        trackEvent('button', 'click', 'anuga-profile-close');
    };

    handleDraw = () => {
        this.props.startProfileDraw();
        trackEvent('button', 'click', 'anuga-profile-draw-start');
    };

    // TASK-2272 (epic 2249 W5) — the "Clear" button: wipe ALL transient profile
    // state (samples/traces/error/loading/drawing, via clearProfile) AND remove
    // the drawn LineString from the map (changeDrawingStatus('clean')) so the
    // panel returns to the empty "Draw profile line" state for a fresh line.
    handleClear = () => {
        this.props.clearProfile();
        this.props.clearProfileLine();
        trackEvent('button', 'click', 'anuga-profile-clear');
    };

    // Resolve a msgId off legacy context, falling back to plain English when
    // the messages dictionary isn't populated yet (initial render / locale
    // boot) — same helper precedent as anugaScenarioMenu.js's `tr`.
    // getMessageById returns the msgId itself on a lookup miss.
    tr = (msgId, fallback) => {
        const messages = (this.context && this.context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return (!resolved || resolved === msgId) ? fallback : resolved;
    };

    // ── TASK-2256 (epic 2249 W3) — picker-as-legend rows ───────────────────
    // The picker rows ARE the legend (LOCKED decision #5): swatch + name +
    // checkbox, a live n/3 counter, cap grey-out with a hint, and — for water
    // rows — a checkability reason / run date / staleness flag. `kind` is
    // 'terrain' | 'water'; `colorFn` is the matching palette lookup so the
    // swatch colour is PIXEL-IDENTICAL to the chart trace colour (AC1) —
    // both derive from the exact same getColorSlot(rows, checkedIds, id)
    // assignment — TASK-2262: renderPickerGroup now computes this ONCE per
    // group (buildCheckedSlotMap) and passes the resulting `slotMap` in,
    // rather than this method calling getColorSlot itself per row.
    renderPickerRow(kind, slotMap, chartMode, checkedIds, row, colorFn) {
        const isTerrain = kind === 'terrain';
        const checkable = isTerrain ? true : row.status === 'ready';
        const checked = checkedIds.includes(row.id);
        const atCap = checkedIds.length >= 3;
        const capBlocked = checkable && !checked && atCap;
        const disabled = !checkable || capBlocked;
        const slot = Object.prototype.hasOwnProperty.call(slotMap, row.id) ? slotMap[row.id] : -1;
        // TASK-2261 (W-followup review): the picker rows ARE the chart's legend
        // (LOCKED decision #5), so the swatch must match what is on screen.
        //  - chartMode (a chart is displayed): `slotMap` is buildChartSlotMap —
        //    the swatch is coloured iff this row's trace is plotted (present in
        //    the stored traces), in that trace's EXACT colour, even if the row's
        //    live checkability has since flipped (external stage un-publish) or
        //    the selection changed without a Redraw. No `checkable` gate: a
        //    still-plotted-but-now-disabled row keeps its line's colour until
        //    the next Redraw drops the line.
        //  - preview (no chart yet): `slotMap` is buildCheckedSlotMap — the
        //    swatch previews the current SELECTION's colour, gated on live
        //    checkability so a disabled row shows no preview swatch.
        const swatchColor = slot >= 0 && (chartMode || checkable) ? colorFn(slot) : null;
        const label = isTerrain
            ? (row.title || row.name || row.gn_layer_name)
            : (row.scenario.name || `Scenario ${row.scenario.id}`);
        const run = !isTerrain ? row.scenario.latest_complete_run : null;
        const runDate = run && run.real_world_end ? new Date(run.real_world_end).toLocaleDateString() : null;
        const stale = !isTerrain && row.scenario.latest_run_is_valid === false;

        let hint = null;
        if (!isTerrain && row.status === 'no-run') {
            hint = this.tr('hydrata.anuga.crossSectionNoRunHint', 'No completed run yet');
        } else if (!isTerrain && row.status === 'no-stage') {
            hint = this.tr('hydrata.anuga.crossSectionNoStageHint', 'Re-run to get a water surface');
        } else if (capBlocked) {
            hint = this.tr('hydrata.anuga.crossSectionCapReachedHint', 'Uncheck another row first (max 3)');
        }

        return (
            <label
                key={row.id}
                className={`sv-picker-row${disabled ? ' sv-picker-row-disabled' : ''}`}
                data-testid={`picker-row-${kind}-${row.id}`}
                title={hint || undefined}
            >
                <input
                    type="checkbox"
                    data-testid={`picker-checkbox-${kind}-${row.id}`}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => {
                        if (isTerrain) this.props.toggleCheckedTerrain(row.id);
                        else this.props.toggleCheckedScenario(row.id);
                    }}
                />
                <span
                    className="sv-picker-swatch"
                    data-testid={`picker-swatch-${kind}-${row.id}`}
                    style={{ backgroundColor: swatchColor || 'transparent' }}
                />
                <span className="sv-picker-label">{label}</span>
                {runDate ?
                    <span className="sv-picker-rundate" data-testid={`picker-rundate-${row.id}`}>{runDate}</span>
                    : null}
                {stale ?
                    <span className="sv-picker-stale" data-testid={`picker-stale-${row.id}`}>
                        {this.tr('hydrata.anuga.crossSectionStaleHint', 'Results may be stale — scenario edited since this run')}
                    </span>
                    : null}
                {hint ?
                    <span className="sv-picker-hint" data-testid={`picker-hint-${kind}-${row.id}`}>{hint}</span>
                    : null}
            </label>
        );
    }

    renderPickerGroup(kind) {
        const isTerrain = kind === 'terrain';
        const rows = isTerrain ? this.props.terrainRows : this.props.scenarioRows;
        const checkedIds = isTerrain ? this.props.checkedTerrainIds : this.props.checkedScenarioIds;
        const colorFn = isTerrain ? terrainColor : waterColor;
        // TASK-2261/2262: pick the swatch colour source. While a chart is
        // displayed the picker legend MIRRORS it (buildChartSlotMap, keyed on
        // the stored traces buildCrossSectionData renders) so swatch === plotted
        // line regardless of live-selection drift; before the first draw it
        // PREVIEWS the live selection (buildCheckedSlotMap). Either map is
        // computed ONCE per group render, not once per row inside the .map()
        // below (TASK-2262 O(N) not O(N^2)). buildCheckedSlotMap ready-filters
        // water rows so a checked-but-no-longer-ready row never consumes a
        // preview slot (terrain rows are ready-filtered at the selector).
        const chartMode = Array.isArray(this.props.samples) && this.props.samples.length > 0
            && Array.isArray(this.props.traces) && this.props.traces.some(t => t && t.role === 'dem');
        const slotMap = chartMode
            ? buildChartSlotMap(this.props.traces, kind)
            : buildCheckedSlotMap(
                isTerrain ? rows : rows.filter(r => r && r.status === 'ready'),
                checkedIds
            );
        return (
            <div className="sv-picker-group" data-testid={`picker-group-${kind}`}>
                <div className="sv-picker-group-header">
                    <span className="sv-picker-group-title">
                        <Message msgId={isTerrain ? 'hydrata.anuga.crossSectionTerrainGroup' : 'hydrata.anuga.crossSectionWaterGroup'} />
                    </span>
                    <span className="sv-picker-counter" data-testid={`picker-counter-${kind}`}>
                        {checkedIds.length}/3
                    </span>
                </div>
                {rows.map((row) => this.renderPickerRow(kind, slotMap, chartMode, checkedIds, row, colorFn))}
            </div>
        );
    }

    renderPicker() {
        return (
            <div className="sv-picker" data-testid="cross-section-picker">
                {this.renderPickerGroup('terrain')}
                {this.renderPickerGroup('water')}
            </div>
        );
    }

    // TASK-2253 — Cross-section is the ONLY mode now: build the combined
    // terrain + water-surface chart. TASK-2255 — the water-surface trace is
    // the PUBLISHED stage sampled directly (role='stage'). TASK-2256 — the
    // panel now carries a "current terrain" lookup per scenario (built from
    // the scenario picker rows, which already ride `scenario.terrain`) so
    // buildCrossSectionData can apply the conditional single-water fill rule
    // (LOCKED decision #7) without redux state leaking into that pure function.
    renderChart() {
        const fallback = 'Water surface';
        const waterLabel = this.tr('hydrata.anuga.profileWaterSurface', fallback);
        const traces = (this.props.traces || []).map(t => (
            t && t.role === 'stage' ? { ...t, waterLabel } : t
        ));
        const scenarioTerrainById = {};
        (this.props.scenarioRows || []).forEach((r) => {
            scenarioTerrainById[r.id] = r.scenario && r.scenario.terrain;
        });
        const data = buildCrossSectionData(this.props.samples, traces, { scenarioTerrainById });
        if (data.length === 0) return null;
        // Terrain + stage are both elevation magnitude, framed to relief on a
        // SINGLE axis (W4.5).
        const range = computeYRange(data);
        // TASK-2270 — axis UNIT titles injected here (a static layout can't
        // localize): x = distance along the transect, y = elevation.
        const xaxis = {
            ...CROSS_SECTION_LAYOUT.xaxis,
            title: { text: this.tr('hydrata.anuga.crossSectionXAxis', 'Distance (m)') }
        };
        const yaxis = {
            ...CROSS_SECTION_LAYOUT.yaxis,
            title: { text: this.tr('hydrata.anuga.crossSectionYAxis', 'Elevation (m)') },
            ...(range ? { range, autorange: false } : {})
        };
        const layout = { ...CROSS_SECTION_LAYOUT, xaxis, yaxis };
        return (
            <div
                className="sv-profile-chart"
                data-testid="profile-chart"
                // TASK-2585 (W2 UAT round 3) — ref feeds syncChartResizeObserver
                // (componentDidMount/componentDidUpdate above); flex:1 1 auto
                // (anuga.css) lets this container GROW past its 240px basis
                // when the panel is resized taller, and the ResizeObserver then
                // tells Plotly to reflow to whatever size this ends up at.
                ref={(el) => { this.chartContainerEl = el; }}
                style={{ width: '100%', height: 240 }}
            >
                <PlotlyChart
                    data={data}
                    layout={layout}
                    // TASK-2271 — trimmed Plotly mode bar so the user gets
                    // zoom-in / zoom-out / reset (+ scroll-zoom). Zoom-in already
                    // worked via drag-select; zoom-out + reset were missing.
                    config={{
                        displayModeBar: true,
                        displaylogo: false,
                        responsive: true,
                        scrollZoom: true,
                        modeBarButtons: [['zoomIn2d', 'zoomOut2d', 'resetScale2d']]
                    }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                />
            </div>
        );
    }

    renderBody() {
        // AC-5: gate on a terrain/result. No DEM ready -> hint, no draw button.
        if (!this.props.demReady) {
            return (
                <div className="sv-profile-no-terrain" data-testid="profile-no-terrain">
                    <Message msgId="hydrata.anuga.profileNoTerrain" />
                </div>
            );
        }
        const hasSamples = Array.isArray(this.props.samples) && this.props.samples.length > 0;
        return (
            <React.Fragment>
                <div className="sv-profile-help" data-testid="profile-help" style={{ marginBottom: 10 }}>
                    <Message msgId="hydrata.anuga.crossSectionHelp" />
                </div>
                {this.renderPicker()}
                <div style={{ marginBottom: 10 }}>
                    <Button
                        data-testid="profile-draw-button"
                        bsSize="small"
                        bsStyle={this.props.drawingActive ? 'info' : 'success'}
                        onClick={this.handleDraw}
                    >
                        <Message msgId={hasSamples ? 'hydrata.anuga.profileRedrawButton' : 'hydrata.anuga.profileDrawButton'} />
                    </Button>
                    {/* TASK-2272 — Clear: reset all state + remove the drawn line,
                        shown once there is something to clear (samples, an error,
                        or an in-flight sample). Same react-bootstrap Button as the
                        other panel buttons (no SimpleView Button primitive — the
                        primitives barrel deliberately omits one). */}
                    {hasSamples || this.props.error || this.props.loading ?
                        <Button
                            data-testid="profile-clear-button"
                            bsSize="small"
                            bsStyle="default"
                            style={{ marginLeft: 10 }}
                            onClick={this.handleClear}
                        >
                            <Message msgId="hydrata.anuga.crossSectionClear" />
                        </Button> : null
                    }
                    {this.props.drawingActive ?
                        <span style={{ marginLeft: 10 }} data-testid="profile-drawing-hint">
                            <Message msgId="hydrata.anuga.profileDrawing" />
                        </span> : null
                    }
                </div>
                {this.props.loading ?
                    <div className="sv-profile-loading" data-testid="profile-loading">
                        <Message msgId="hydrata.anuga.profileLoading" />
                    </div> : null
                }
                {this.props.error ?
                    <div
                        className="alert alert-danger sv-profile-error"
                        data-testid="profile-error"
                        style={{ padding: '6px 10px', marginBottom: 10 }}
                    >
                        <Message msgId={this.props.error} />
                    </div> : null
                }
                {!hasSamples && !this.props.loading && !this.props.error ?
                    <div className="sv-profile-empty" data-testid="profile-empty">
                        <Message msgId="hydrata.anuga.profileEmpty" />
                    </div> : null
                }
                {/* TASK-2577 — the chart is sample-on-draw (never live-
                    resampled); if a stored trace's terrain has since become
                    superseded, say so rather than silently plotting a DEM
                    the rest of the UI no longer considers current. Clears
                    on the next redraw with no extra state (see
                    hasSupersededTraceTerrain doc). */}
                {hasSamples && hasSupersededTraceTerrain(this.props.traces, this.props.terrainResources) ?
                    <div
                        className="alert alert-warning sv-profile-terrain-superseded"
                        data-testid="profile-terrain-superseded-hint"
                        style={{ padding: '6px 10px', marginBottom: 10 }}
                    >
                        <Message msgId="hydrata.anuga.crossSectionTerrainSupersededHint" />
                    </div> : null
                }
                {this.renderChart()}
            </React.Fragment>
        );
    }

    render() {
        if (!this.props.visible) return null;
        const persist = this.props.onPanelStateChange || (() => {});
        return (
            // TASK-2585 (epic 2580 W2 UAT round 3) — MovablePanel replaces the
            // fixed right-docked PanelHeader/footer shell: drag by header,
            // native corner resize, position/size persisted per panelId
            // 'crossSectionProfile' (same convention as TerrainBboxPanel /
            // MergeTerrainsPanel / DemRampLegend's FloatingDemLegendPanel —
            // see those for the sibling idiom this mirrors). defaultPosition
            // mimics the old right-docked spot so the panel looks unchanged
            // until the user actually drags/resizes it.
            <MovablePanel
                panelId={CROSS_SECTION_PANEL_ID}
                className="sv-profile-panel"
                title={<Message msgId="hydrata.anuga.crossSectionPanelTitle" />}
                onClose={this.handleClose}
                position={this.props.panelState?.position}
                size={this.props.panelState?.size}
                defaultPosition={defaultProfilePanelPosition()}
                onMove={(position) => persist(CROSS_SECTION_PANEL_ID, { position })}
                onResize={(size) => persist(CROSS_SECTION_PANEL_ID, { size })}
            >
                {/* TASK-2274 — sv-profile-body (anuga.css) owns its own
                    padding + the flex/overflow rules that make it scroll
                    independently within the panel's max-height. TASK-2585 —
                    now nested inside MovablePanel's own .sv-movable-panel-body
                    (which anuga.css turns into a flex column scoped to THIS
                    panel only, so the chart below can flex-grow into a
                    resize) rather than owning the panel's outer chrome. */}
                <div data-testid="profile-panel" className="sv-profile-body">
                    {this.renderBody()}
                </div>
                <div className={'simple-view-panel-footer'}>
                    <Button data-testid="profile-cancel" bsStyle="default" onClick={this.handleClose}>
                        <Message msgId="hydrata.anuga.profileCancel" />
                    </Button>
                </div>
            </MovablePanel>
        );
    }
}

// Resolve the localized "Water surface" label off legacy context for the
// derived cross-section stage trace.
TerrainProfilePanelClass.contextTypes = {
    messages: PropTypes.object
};

const mapStateToProps = (state) => ({
    visible: !!state?.anuga?.ui?.profilePanelVisible,
    drawingActive: !!state?.anuga?.ui?.profileDrawingActive,
    loading: !!state?.anuga?.ui?.profileLoading,
    samples: state?.anuga?.ui?.profileSamples || null,
    traces: state?.anuga?.ui?.profileTraces || null,
    error: state?.anuga?.ui?.profileError || null,
    demReady: hasDemReady(state),
    // TASK-2256 (epic 2249 W3) — picker-as-legend rows + checked-id state.
    // The series model + seeding/cap live in profileEpic.js (TASK-2254); this
    // panel only renders them.
    terrainRows: getTerrainPickerRows(state),
    scenarioRows: getScenarioPickerRows(state),
    checkedTerrainIds: state?.anuga?.ui?.checkedTerrainIds || [],
    checkedScenarioIds: state?.anuga?.ui?.checkedScenarioIds || [],
    // TASK-2577 — RAW list (not terrainRows above, which already excludes
    // superseded rows) so hasSupersededTraceTerrain can detect one.
    terrainResources: state?.anuga?.resources?.terrain || [],
    // TASK-2585 (W2 UAT round 3) — persisted MovablePanel position/size for
    // this panelId (same selector shape as the other MovablePanel consumers).
    panelState: state?.anuga?.ui?.movablePanels?.[CROSS_SECTION_PANEL_ID]
});

const mapDispatchToProps = (dispatch) => ({
    setProfilePanelVisible: (visible) => dispatch(setProfilePanelVisible(visible)),
    startProfileDraw: () => dispatch(startProfileDraw()),
    clearProfile: () => dispatch(clearProfile()),
    // TASK-2272 — remove the drawn LineString from the map (clean stops
    // DrawSupport and clears its feature layer for this tool's owner).
    // TASK-2276 — routed through CLEAR_PROFILE_LINE + clearProfileLineEpic
    // rather than dispatching changeDrawingStatus('clean', ...) directly, so
    // the epic can gate it on this tool actually owning (or nobody owning)
    // the current map draw before wiping anything.
    clearProfileLine: () => dispatch(clearProfileLineAction()),
    toggleCheckedTerrain: (id) => dispatch(toggleCheckedTerrain(id)),
    toggleCheckedScenario: (id) => dispatch(toggleCheckedScenario(id)),
    // TASK-2585 (W2 UAT round 3) — persist the MovablePanel position/size
    // per panelId (same action every other MovablePanel consumer uses).
    onPanelStateChange: (panelId, patch) => dispatch(setMovablePanelState(panelId, patch))
});

export const TerrainProfilePanel = connect(mapStateToProps, mapDispatchToProps)(TerrainProfilePanelClass);
export default TerrainProfilePanel;
