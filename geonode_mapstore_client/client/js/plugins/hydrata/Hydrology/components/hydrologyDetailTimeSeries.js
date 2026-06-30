/**
 * TASK-1501 (W4b) — Design Storms browser.
 *
 * Reworks the "Timeseries" surface into a DESIGN STORMS BROWSER.
 *
 * Layout (AC3):
 *   ┌─────────────────────────────────────────────────────┐
 *   │  FILTERS: IDF-variant · Pattern · RP · Duration     │
 *   │  [Gallery of preview cards]                         │
 *   │  [Focused hyetograph chart — HyetographChart]       │
 *   │  [New Time Series] button → manual editor (demoted) │
 *   └─────────────────────────────────────────────────────┘
 *
 * Design storms are COMPUTED PREVIEWS from the W4a mode='preview' batch
 * endpoint — never a materialised table (AC1). RP and duration are VIEW
 * FILTERS (AC2). Pattern list is data-driven so a W5 custom pattern
 * appears automatically (AC8). Loads IDF tables independent of the full
 * hydrology init gate (AC9).
 *
 * Manual entry demoted behind "New Time Series" button (AC4, fixes the
 * stray "New Time Series2" label).
 */
import React, {useState, useEffect, useCallback} from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
// TASK-1556/1558 (W2) — the slim DETAIL no longer dispatches design-storm
// actions; the Create panel (DesignStormCreatePanel) owns its own connect and
// passes dispatchers into ManualPasteGrid as props. DesignStormsBrowser /
// ManualEntryForm receive their dispatchers via props (from W3 callers).
import {
    updateTimeSeriesRowData,
    replaceTimeSeriesRowData,
    // TASK-1561 (W3b) — preview + bulk save
    previewDesignStormsRequest,
    saveDesignStormsRequest
} from '../actionsHydrology';
import {PRESET_FAMILIES, ALTERNATING_BLOCK, CUSTOM} from '../temporalPatternPresets';
import ManualPasteGrid from './ManualPasteGrid';
// TASK-2008 (epic-2001 W2b) — shared RP x duration tick/cross matrix primitive.
import MatrixGrid from './MatrixGrid';
// TASK-1760 (epic-1758 W1) — chassis primitives. Card carries the dark-glass
// frame for the design-storm cards (default variant) and the dark-frame/light-body
// carve-out for the recharts hyetograph cards (variant="chart", TASK-1534).
import { ErrorStrip, EmptyState, Card } from '../../SimpleView/components/primitives';

import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import moment from 'moment';
import Message from '@mapstore/framework/components/I18N/Message';

// ---------------------------------------------------------------------------
// Hyetograph bar chart (reused from W4 — the "good bit", AC3)
// ---------------------------------------------------------------------------

/**
 * Build bar-chart data from the TimeSeries rowData returned by the BE.
 * Each point is {label, intensity} where intensity = rainfall rate (mm/hr).
 * The derive endpoint stores values as mm/hr intensity per timestep.
 *
 * @param {Array<{timestamp: string, value: number}>} rowData
 * @returns {Array<{label: string, intensity: number}>}
 */
export function rowDataToHyetograph(rowData) {
    if (!Array.isArray(rowData) || rowData.length === 0) return [];
    return rowData.map((pt) => ({
        label: pt.timestamp
            ? moment(pt.timestamp).format('HH:mm')
            : String(pt.timestamp),
        intensity: typeof pt.value === 'number'
            ? Math.max(0, pt.value)
            : Math.max(0, parseFloat(pt.value) || 0)
    }));
}

// ---------------------------------------------------------------------------
// Axis-tick helpers — give the hyetograph human, round ticks instead of
// recharts' auto-thinned per-bar labels (operator UAT, TASK-1549):
//   - intensity (Y) ticks land on round multiples (10 / 20 / 50 / 100 …);
//   - time (X) ticks land on round ELAPSED marks (10 min / 30 min / hourly …)
//     measured from storm start (the clock start of a design storm is synthetic).
// ---------------------------------------------------------------------------

// Round Y ticks: smallest 1-2-5 step (×10ⁿ, ≥10) that yields ≤ ~6 ticks.
export function niceIntensityTicks(maxIntensity) {
    const max = Number(maxIntensity) || 0;
    if (max <= 0) return {ticks: [0, 10], max: 10};
    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let step = steps[steps.length - 1];
    for (const s of steps) { if (max / s <= 6) { step = s; break; } }
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return {ticks, max: top};
}

// Round X ticks: smallest 10 / 30 / 60-min (and up) interval giving ≤ ~8 ticks.
export function niceTimeTicks(durationMin) {
    const dur = Number(durationMin) || 0;
    if (dur <= 0) return {ticks: [0], interval: 10};
    const intervals = [10, 30, 60, 120, 180, 360, 720, 1440];
    let interval = intervals[intervals.length - 1];
    for (const iv of intervals) { if (dur / iv <= 8) { interval = iv; break; } }
    const ticks = [];
    for (let v = 0; v <= dur + interval / 2; v += interval) ticks.push(v);
    return {ticks, interval};
}

// Format elapsed minutes as h:mm (0→"0:00", 30→"0:30", 90→"1:30").
export function formatElapsedMin(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// TASK-2027/2028/2030 (W5.5/W5.6/W5.8): HyetographChart now accepts
// activeHydrologyPage to discriminate hydrograph vs hyetograph presentation.
// When activeHydrologyPage==='hydrographs':
//   - Renders a LineChart (continuous flow curve) instead of BarChart (rainfall bars).
//   - Y-axis label: 'Flow (m3/s)' instead of 'Intensity (mm/hr)'.
//   - Tooltip: 'm3/s' unit + 'Flow' label.
//   - No entrance animation (isAnimationActive=false on the Line series).
//   - Summary stat: 'Estimated Total Flow Volume (m3)' = integral(flow*timestep_s).
// Design Storms (no activeHydrologyPage or activeHydrologyPage!=='hydrographs'):
//   - All existing behaviour preserved verbatim (BarChart, mm/hr, depth, animation).
const HyetographChart = ({rowData, timestepMin, title, activeHydrologyPage}) => {
    const chartData = rowDataToHyetograph(rowData);
    if (!chartData.length) return null;
    const ts = timestepMin || 6;
    // Elapsed minutes from the first timestamp give a NUMERIC time axis, so the
    // ticks can sit on round 10/30/60-min marks independent of where the bars
    // (and the synthetic clock start) fall. recharts derives the bar band width
    // from the minimum spacing between numeric points, so the bars still render.
    const t0 = moment(rowData[0] && rowData[0].timestamp);
    const data = chartData.map((d, i) => {
        const at = rowData[i] && rowData[i].timestamp;
        const elapsedMin = (t0.isValid() && at) ? moment(at).diff(t0, 'minutes') : i * ts;
        return {...d, elapsedMin};
    });
    const durationMin = data.length ? data[data.length - 1].elapsedMin : 0;
    const maxIntensity = data.reduce((m, d) => Math.max(m, d.intensity), 0);
    const {ticks: yTicks, max: yMax} = niceIntensityTicks(maxIntensity);
    // TASK-2032 (W5.10): capture interval alongside ticks so the hydrograph LineChart
    // can extend its domain + ticks one interval past the final data point.
    const {ticks: xTicks, interval: xInterval} = niceTimeTicks(durationMin);

    // TASK-2027/2028/2030: page discriminator.
    const isHydrograph = activeHydrologyPage === 'hydrographs';

    // TASK-2032 (W5.10): extend the LineChart (hydrograph-only) X-axis one tick past the
    // last data point so the curve has visible white-space after it (truncation cue).
    // xDomainMax = durationMin + one tick interval; extended ticks = base ticks +
    // one additional tick at the interval boundary (if the last base tick <= durationMin).
    // The BarChart (Design Storms) uses the unmodified xTicks + domain=[0,durationMin].
    const xDomainMax = isHydrograph ? durationMin + xInterval : durationMin;
    const xTicksExtended = (() => {
        if (!isHydrograph) return xTicks;
        const lastBase = xTicks.length ? xTicks[xTicks.length - 1] : 0;
        const extended = lastBase <= durationMin ? [...xTicks, lastBase + xInterval] : [...xTicks];
        // Keep only ticks that are <= xDomainMax so recharts renders them.
        return extended.filter(t => t <= xDomainMax);
    })();

    // TASK-2030: summary stat values (computed unconditionally; only one is rendered).
    // Hydrograph: integral of flow over time = sum(flow_m3s * timestep_seconds) in m3.
    // Design Storm: mm/hr intensity × (timestep/60) = mm depth per interval for total.
    const totalVolume = data.reduce((s, d) => s + d.intensity * ts * 60, 0).toFixed(1);
    const totalDepth = data.reduce((s, d) => s + d.intensity * (ts / 60), 0).toFixed(1);

    return (
        <div id="design-storm-hyetograph" className="sv-hyetograph-chart-card">
            {title && (
                <p style={{fontSize: '0.9rem', fontWeight: 700, marginBottom: 4, color: '#333'}}>
                    {title}
                </p>
            )}
            {isHydrograph ? (
                <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 6}}>
                    Estimated Total Flow Volume (m3): <strong>{totalVolume} m3</strong>
                </p>
            ) : (
                <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 6}}>
                    Estimated total depth: <strong>{totalDepth} mm</strong>
                </p>
            )}
            {/* HTML axis-title layout — mirrors IdfCurveChart (.sv-idf-curve-*) because
                recharts 0.22.4 silently IGNORES the YAxis/XAxis `label` object prop,
                so axis units must be HTML around the SVG, not a recharts <Label>. */}
            <div className="sv-hyetograph-chart-layout">
                {/* TASK-2028: Y-axis label switches per page. */}
                <div className="sv-hyetograph-yaxis-title">
                    {isHydrograph ? 'Flow (m3/s)' : 'Intensity (mm/hr)'}
                </div>
                <div className="sv-hyetograph-plot-area">
                    <div className="sv-hyetograph-plot">
                        <ResponsiveContainer width="100%" height={260}>
                            {/* TASK-2028: LineChart for hydrographs; BarChart for Design Storms. */}
                            {isHydrograph ? (
                                <LineChart
                                    data={data}
                                    margin={{top: 10, right: 20, left: 8, bottom: 8}}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f0" />
                                    {/* TASK-2032 (W5.10): domain + ticks extended one interval past
                                        the last data point (LineChart / hydrograph branch ONLY). */}
                                    <XAxis
                                        dataKey="elapsedMin"
                                        type="number"
                                        domain={[0, xDomainMax]}
                                        ticks={xTicksExtended}
                                        tickFormatter={formatElapsedMin}
                                        height={28}
                                        tick={{fontSize: 10, fill: '#333'}}
                                    />
                                    <YAxis
                                        domain={[0, yMax]}
                                        ticks={yTicks}
                                        allowDecimals={false}
                                        tick={{fontSize: 10, fill: '#333'}}
                                    />
                                    <Tooltip
                                        labelFormatter={(v) => `Time ${formatElapsedMin(v)}`}
                                        formatter={(v) => [`${v.toFixed(3)} m3/s`, 'Flow']}
                                    />
                                    {/* TASK-2027: isAnimationActive=false for hydrographs (no live-preview). */}
                                    <Line
                                        type="monotone"
                                        dataKey="intensity"
                                        stroke="#5178af"
                                        dot={false}
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            ) : (
                                <BarChart
                                    data={data}
                                    margin={{top: 10, right: 20, left: 8, bottom: 8}}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#dce6f0" />
                                    <XAxis
                                        dataKey="elapsedMin"
                                        type="number"
                                        domain={[0, durationMin]}
                                        ticks={xTicks}
                                        tickFormatter={formatElapsedMin}
                                        height={28}
                                        tick={{fontSize: 10, fill: '#333'}}
                                    />
                                    <YAxis
                                        domain={[0, yMax]}
                                        ticks={yTicks}
                                        allowDecimals={false}
                                        tick={{fontSize: 10, fill: '#333'}}
                                    />
                                    <Tooltip
                                        labelFormatter={(v) => `Time ${formatElapsedMin(v)}`}
                                        formatter={(v) => [`${v.toFixed(2)} mm/hr`, 'Intensity']}
                                    />
                                    <Bar dataKey="intensity" fill="#5178af" />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                    <div className="sv-hyetograph-xaxis-title">Time from start (h:mm)</div>
                </div>
            </div>
        </div>
    );
};

HyetographChart.propTypes = {
    rowData: PropTypes.array,
    timestepMin: PropTypes.number,
    title: PropTypes.string,
    // TASK-2025/2027/2028/2030: page discriminator. 'hydrographs' -> flow presentation.
    activeHydrologyPage: PropTypes.string
};

// ---------------------------------------------------------------------------
// Preview card — one cell in the gallery
// ---------------------------------------------------------------------------

/**
 * Build a stable composite key from a preview object.
 * Used to track focus and filter gallery items (AC2 — view filter not a keyed row).
 */
export function previewKey(preview) {
    return `${preview.pattern}|${preview.ari}|${preview.duration_min}`;
}

/**
 * TASK-2007 (epic-2001 W2a) — map a selected project Temporal Pattern item to
 * the BE design-storm pattern parameters.
 *
 * The Derive dropdown now lists the project's OWN TemporalPattern rows (decision
 * 5), so the selected value is a TemporalPattern row, not a hardcoded
 * PRESET_FAMILIES id. The BE derive engine still keys on a pattern string (+ a
 * custom_curve for CUSTOM rows, threaded in W2c / TASK-2006), so resolve:
 *   - pattern_type 'custom'            -> {patternKey: 'custom', customCurve: data.rowData}
 *   - pattern_type 'alternating_block' -> {patternKey: 'alternating_block'}
 *   - pattern_type 'preset'            -> {patternKey: <pattern_key>}  (e.g. 'SCS_TYPE_II')
 *
 * Defensive fallbacks: a row missing pattern_type but carrying pattern_key is
 * treated as a preset; a CUSTOM row's curve comes from data.rowData (the
 * {t, cum} ordinates TemporalPattern.clean() validates).
 *
 * @param {object} item a TemporalPattern row from state.hydrology.temporalPatterns
 * @returns {{patternKey: string|null, customCurve: object[]|null}}
 */
export function resolveDerivePattern(item) {
    if (!item) return {patternKey: null, customCurve: null};
    if (item.pattern_type === CUSTOM) {
        const rowData = (item.data && item.data.rowData) || null;
        return {patternKey: CUSTOM, customCurve: rowData};
    }
    if (item.pattern_type === ALTERNATING_BLOCK) {
        return {patternKey: ALTERNATING_BLOCK, customCurve: null};
    }
    // preset (or a legacy row with only pattern_key set).
    return {patternKey: item.pattern_key || null, customCurve: null};
}

/**
 * TASK-2008 (epic-2001 W2b) — derive the RP x duration matrix axes from a FE
 * IDF table object. The FE represents an IDF as a grid (columnDefs = RP columns
 * + a duration column; rowData = one row per duration), so the axes come from
 * there — NOT from return_periods_yr / durations_min arrays (which the FE IDF
 * object does not carry). Shared by buildCells (preview/save) and the matrix
 * render so the cells and the grid axes never drift.
 *   - durations: each rowData row's positive `duration`.
 *   - aris: the RP columns (every columnDef except `duration`) that carry at
 *     least one non-zero intensity, parsed from the header (e.g. "100yr ARI"
 *     -> 100). An all-zero column = no IDF data for that RP -> dropped.
 *
 * @returns {{durations: number[], aris: number[]}}
 */
export function deriveMatrixAxes(table) {
    if (!table) return {durations: [], aris: []};
    const columnDefs = table.columnDefs || [];
    const rowData = table.rowData || [];
    const durations = rowData
        .map(r => Number(r.duration))
        .filter(d => d > 0);
    const aris = columnDefs
        .filter(c => c.accessorKey && c.accessorKey !== 'duration')
        .filter(c => rowData.some(r => Number(r[c.accessorKey]) > 0))
        .map(c => parseFloat(String(c.header || c.id).replace(/[^0-9.]/g, '')))
        .filter(v => v > 0);
    return {durations, aris};
}

const PreviewCard = ({preview, isFocused, onFocus, onAttach, attachInFlight, rainfallPk}) => {
    const key = previewKey(preview);
    const durationHr = preview.duration_min >= 60
        ? `${(preview.duration_min / 60).toFixed(1)} hr`
        : `${preview.duration_min} min`;
    const ariLabel = preview.ari ? `ARI ${preview.ari} yr` : (preview.aep ? `AEP ${preview.aep}%` : '');

    return (
        <div
            id={`preview-card-${key}`}
            className={`sv-design-storm-preview-card${isFocused ? ' focused' : ''}`}
            style={{
                borderRadius: 4,
                padding: '8px 12px',
                marginBottom: 6,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6
            }}
            onClick={() => onFocus(key)}
        >
            <div style={{flex: 1, minWidth: 200}}>
                <span className="sv-design-storm-preview-title" style={{fontSize: '0.88rem', marginRight: 6}}>
                    {preview.pattern}
                </span>
                <span className="sv-design-storm-preview-meta" style={{fontSize: '0.82rem', marginRight: 6}}>
                    {ariLabel}
                </span>
                <span className="sv-design-storm-preview-meta" style={{fontSize: '0.82rem'}}>
                    {durationHr}
                </span>
                {preview.total_depth_mm !== undefined && (
                    // TASK-1758 W3 conform — dark-glass chip (was light #e8f0fe pill).
                    <span style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: '0.8rem',
                        color: 'var(--sv-text)'
                    }}>
                        {Number(preview.total_depth_mm).toFixed(1)} mm
                    </span>
                )}
                {preview.persisted === false && (
                    // TASK-1758 W3 conform — lime-tinted "preview" chip (was light #f0f5e8).
                    <span style={{
                        display: 'inline-block',
                        marginLeft: 6,
                        background: 'rgba(202, 227, 59, 0.18)',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: '0.78rem',
                        color: 'var(--sv-accent-lime)'
                    }}>
                        preview
                    </span>
                )}
            </div>
            {rainfallPk && (
                <button
                    className="btn btn-xs btn-primary"
                    disabled={attachInFlight}
                    onClick={e => { e.stopPropagation(); onAttach(preview); }}
                    title="Attach this design storm to the rainfall"
                >
                    {attachInFlight ? 'Attaching…' : 'Attach'}
                </button>
            )}
        </div>
    );
};

PreviewCard.propTypes = {
    preview: PropTypes.object.isRequired,
    isFocused: PropTypes.bool,
    onFocus: PropTypes.func.isRequired,
    onAttach: PropTypes.func,
    attachInFlight: PropTypes.bool,
    rainfallPk: PropTypes.number
};

// ---------------------------------------------------------------------------
// Design Storms browser — filters + gallery + focused chart
// ---------------------------------------------------------------------------

const DesignStormsBrowser = ({
    idfTables,
    temporalPatterns,
    projection,
    onSpecChange,
    onViewFilterChange,
    onFocus,
    onPreview,
    onAttach,
    rainfallPk
}) => {
    const {
        selectedIdfTableId,
        selectedPatterns,
        viewFilter,
        timestepMin,
        previews,
        inFlight,
        error,
        stale,
        focusedKey,
        attachInFlight
    } = projection;

    // Derive the available patterns: PRESET_FAMILIES IDs + any custom (W5-ready, AC8).
    // Build from PRESET_FAMILIES as base; custom TemporalPatterns appear too.
    const presetIds = new Set(PRESET_FAMILIES.map(f => f.id));
    const customPatterns = (temporalPatterns || [])
        .filter(tp => tp.pattern_type === 'custom' || !presetIds.has(tp.id));
    const allPatternOptions = [
        ...PRESET_FAMILIES.map(f => ({id: f.id, label: f.label})),
        ...customPatterns.map(tp => ({id: tp.id || tp.name, label: tp.name}))
    ];

    // Derive available ARIs and durations from the selected IDF table.
    const selectedTable = (idfTables || []).find(t => t.id === Number(selectedIdfTableId));
    const availableAris = selectedTable?.data?.return_periods_yr
        || selectedTable?.return_periods_yr
        || selectedTable?.columnDefs?.filter(c => c.ari).map(c => c.ari)
        || [];
    const availableDurations = selectedTable?.data?.durations_min
        || selectedTable?.durations_min
        || (selectedTable?.rowData || []).map(r => r.duration).filter(Boolean)
        || [];

    // Apply view filters to previews (AC2 — never create/delete rows, just narrow display).
    const filteredPreviews = (previews || []).filter(p => {
        if (viewFilter?.ari && p.ari !== viewFilter.ari) return false;
        if (viewFilter?.durationMin && p.duration_min !== viewFilter.durationMin) return false;
        return true;
    });

    const focusedPreview = filteredPreviews.find(p => previewKey(p) === focusedKey)
        || filteredPreviews[0]
        || null;

    const handleTogglePattern = (patternId) => {
        const current = selectedPatterns || [];
        const updated = current.includes(patternId)
            ? current.filter(p => p !== patternId)
            : [...current, patternId];
        onSpecChange({selectedPatterns: updated});
    };

    const handleRefresh = useCallback(() => {
        if (!selectedIdfTableId || !selectedTable) return;
        const patternsToUse = selectedPatterns && selectedPatterns.length > 0
            ? selectedPatterns
            : allPatternOptions.map(p => p.id);
        const aris = viewFilter?.ari ? [viewFilter.ari] : availableAris;
        const durations = viewFilter?.durationMin ? [viewFilter.durationMin] : availableDurations;
        const ts = timestepMin || 60;
        const cells = [];
        for (const pattern of patternsToUse) {
            for (const ari of aris) {
                for (const duration of durations) {
                    cells.push({
                        pattern,
                        ari: Number(ari),
                        duration_min: Number(duration),
                        timestep_min: ts
                    });
                }
            }
        }
        if (cells.length > 0) {
            onPreview(cells, Number(selectedIdfTableId), ts);
        }
    }, [selectedIdfTableId, selectedPatterns, viewFilter, timestepMin, availableAris, availableDurations]); // eslint-disable-line

    // Auto-refresh preview when spec or filters change (AC5 — reproject on change).
    useEffect(() => {
        if (selectedIdfTableId && !inFlight) {
            handleRefresh();
        }
    }, [selectedIdfTableId, JSON.stringify(selectedPatterns), JSON.stringify(viewFilter), timestepMin]); // eslint-disable-line

    // Also re-trigger if marked stale (from reprojectOnSaveEpic, AC5).
    useEffect(() => {
        if (stale && selectedIdfTableId && !inFlight) {
            handleRefresh();
        }
    }, [stale]); // eslint-disable-line

    return (
        <div id="design-storms-browser" style={{maxWidth: 720}}>
            {/* FILTERS row — TASK-1760: chassis Card (default dark-glass). The
                sv-design-storm-card class rides extraClassName so the nested
                .sv-design-storm-label/-hint/-muted text rules still apply. */}
            <Card
                extraClassName="sv-design-storm-card"
                style={{marginBottom: 12}}
                bodyStyle={{padding: '10px 14px'}}
            >
                <div id="design-storms-filters">
                    <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start'}}>
                        {/* IDF Variant picker */}
                        <div style={{flex: '1 1 180px'}}>
                            <label className="sv-design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            IDF Table
                            </label>
                            <select
                                id="ds-browser-idf-table"
                                className="sv-hydrology-text-input"
                                style={{width: '100%'}}
                                value={selectedIdfTableId ?? ''}
                                onChange={e => onSpecChange({
                                    selectedIdfTableId: e.target.value ? Number(e.target.value) : null
                                })}
                            >
                                <option value="">-- select IDF table --</option>
                                {(idfTables || []).map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* RP view filter (AC2) */}
                        <div style={{flex: '1 1 120px'}}>
                            <label className="sv-design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            RP filter (yr)
                            </label>
                            <select
                                id="ds-browser-ari-filter"
                                className="sv-hydrology-text-input"
                                style={{width: '100%'}}
                                value={viewFilter?.ari ?? ''}
                                onChange={e => onViewFilterChange({ari: e.target.value ? Number(e.target.value) : null})}
                            >
                                <option value="">All RPs</option>
                                {availableAris.map(a => (
                                    <option key={a} value={a}>{a} yr</option>
                                ))}
                            </select>
                        </div>

                        {/* Duration view filter (AC2) */}
                        <div style={{flex: '1 1 120px'}}>
                            <label className="sv-design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            Duration filter
                            </label>
                            <select
                                id="ds-browser-duration-filter"
                                className="sv-hydrology-text-input"
                                style={{width: '100%'}}
                                value={viewFilter?.durationMin ?? ''}
                                onChange={e => onViewFilterChange({durationMin: e.target.value ? Number(e.target.value) : null})}
                            >
                                <option value="">All durations</option>
                                {availableDurations.map(d => (
                                    <option key={d} value={d}>
                                        {d >= 60 ? `${(d / 60).toFixed(1)} hr` : `${d} min`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Timestep */}
                        <div style={{flex: '0 0 90px'}}>
                            <label className="sv-design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            Timestep (min)
                            </label>
                            <input
                                id="ds-browser-timestep"
                                type="number"
                                className="sv-hydrology-text-input"
                                style={{width: '100%'}}
                                value={timestepMin || 60}
                                min={1}
                                step={1}
                                onChange={e => onSpecChange({timestepMin: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    {/* Pattern multi-select (AC8 — data-driven, not hardcoded) */}
                    <div style={{marginTop: 10}}>
                        <label className="sv-design-storm-label" style={{fontSize: '0.82rem', marginBottom: 4}}>
                        Patterns (all = no filter)
                        </label>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                            {allPatternOptions.map(opt => {
                                const active = !selectedPatterns || selectedPatterns.length === 0
                                || selectedPatterns.includes(opt.id);
                                return (
                                    <button
                                        key={opt.id}
                                        id={`ds-pattern-toggle-${opt.id}`}
                                        className={`btn btn-xs ${active ? 'btn-primary' : 'btn-default'}`}
                                        style={{fontSize: '0.78rem'}}
                                        onClick={() => handleTogglePattern(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Status / stale banner */}
            {stale && !inFlight && (
                // TASK-1758 W3 conform — dark-glass amber warning (was light #fff8e1).
                <div
                    className="sv-idf-derive-banner sv-idf-derive-banner--warning"
                    style={{margin: '0 0 8px', fontSize: '0.82rem'}}
                >
                    IDF or pattern changed — previews will refresh.
                    <button className="btn btn-xs btn-default" style={{marginLeft: 8}} onClick={handleRefresh}>
                        Refresh now
                    </button>
                </div>
            )}

            {inFlight && (
                <div className="sv-design-storm-muted" style={{padding: '8px 0', fontSize: '0.85rem'}}>
                    <span className="glyphicon glyphicon-refresh" style={{marginRight: 6}} />
                    Computing previews…
                </div>
            )}

            {error && (
                <div id="design-storm-preview-error">
                    <ErrorStrip message={error} style={{margin: '0 0 8px'}} />
                </div>
            )}

            {!selectedIdfTableId && (
                <EmptyState heading="Select an IDF table to browse design storms." />
            )}

            {/* Focused hyetograph chart — defaults to first preview (AC3).
                TASK-1760: chassis Card variant="chart" gives the recharts body a
                LIGHT surface inside a dark-glass frame (TASK-1534 carve-out). */}
            {focusedPreview && (
                <Card
                    variant="chart"
                    extraClassName="sv-design-storm-chart-card"
                    style={{marginBottom: 14}}
                    bodyStyle={{padding: '12px 16px'}}
                >
                    <div id="design-storm-focused-chart">
                        <HyetographChart
                            rowData={focusedPreview.rowData}
                            timestepMin={focusedPreview.timestep_min || timestepMin}
                            title={focusedPreview.name || focusedPreview.source || 'Design Storm'}
                        />
                        {focusedPreview.source && (
                            // TASK-1758 W3: this source line lives INSIDE the white
                            // chart Card body (sv-design-storm-chart-card, variant="chart"),
                            // so #666 dark-on-white is correct chart-card carve-out — keep.
                            <p style={{fontSize: '0.78rem', color: '#666', marginTop: 4, marginBottom: 0}}>
                                Source: {focusedPreview.source}
                            </p>
                        )}
                    </div>
                </Card>
            )}

            {/* Gallery of preview cards */}
            {filteredPreviews.length > 0 && (
                <div id="design-storm-gallery" style={{marginBottom: 12}}>
                    <p className="sv-design-storm-muted" style={{fontSize: '0.82rem', marginBottom: 6}}>
                        {filteredPreviews.length} preview{filteredPreviews.length !== 1 ? 's' : ''}
                        {previews.length !== filteredPreviews.length
                            ? ` (${previews.length} total, filtered)`
                            : ''}
                        — click a row to focus its chart
                    </p>
                    {filteredPreviews.map(p => (
                        <PreviewCard
                            key={previewKey(p)}
                            preview={p}
                            isFocused={previewKey(p) === (focusedKey || (filteredPreviews[0] && previewKey(filteredPreviews[0])))}
                            onFocus={onFocus}
                            onAttach={onAttach}
                            attachInFlight={attachInFlight}
                            rainfallPk={rainfallPk || null}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

DesignStormsBrowser.propTypes = {
    idfTables: PropTypes.array,
    temporalPatterns: PropTypes.array,
    projection: PropTypes.object.isRequired,
    onSpecChange: PropTypes.func.isRequired,
    onViewFilterChange: PropTypes.func.isRequired,
    onFocus: PropTypes.func.isRequired,
    onPreview: PropTypes.func.isRequired,
    onAttach: PropTypes.func,
    rainfallPk: PropTypes.number
};

// ---------------------------------------------------------------------------
// Manual entry form (W4 — demoted behind "New Time Series" button, AC4)
// ---------------------------------------------------------------------------

const ManualEntryForm = ({
    idfTables,
    designStorm,
    onFieldChange,
    onDerive
}) => {
    const {
        idfTableId,
        patternKey,
        aep,
        ari,
        durationMin,
        timestepMin,
        peakPosition,
        name,
        inFlight,
        error
    } = designStorm;

    const isAlternatingBlock = patternKey === ALTERNATING_BLOCK;
    const canDerive = idfTableId && patternKey
        && (aep !== '' || ari !== '')
        && durationMin > 0 && timestepMin > 0
        && !inFlight;

    // The derived result's rowData for the hyetograph preview.
    const derivedRowData = designStorm?.result?.data?.rowData || null;

    return (
        <div id="manual-entry-form">
            <Card
                extraClassName="sv-design-storm-card"
                style={{maxWidth: 700, marginBottom: 16}}
                bodyStyle={{padding: '12px 16px'}}
            >
                <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '0.95rem', fontWeight: 700, color: 'var(--sv-text)'}}>
                    Manual Design Storm Derive
                </h4>

                {/* IDF Table picker */}
                <div style={{marginBottom: 10}}>
                    <label
                        htmlFor="ds-idf-table"
                        className="sv-design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
                    >
                        IDF Table
                    </label>
                    <select
                        id="ds-idf-table"
                        className="sv-hydrology-text-input"
                        style={{width: '100%'}}
                        value={idfTableId ?? ''}
                        onChange={e => onFieldChange('idfTableId', e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">-- select an IDF table --</option>
                        {(idfTables || []).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {/* Pattern picker */}
                <div style={{marginBottom: 10}}>
                    <label
                        htmlFor="ds-pattern"
                        className="sv-design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
                    >
                        Temporal Pattern
                    </label>
                    <select
                        id="ds-pattern"
                        className="sv-hydrology-text-input"
                        style={{width: '100%'}}
                        value={patternKey}
                        onChange={e => onFieldChange('patternKey', e.target.value)}
                    >
                        {PRESET_FAMILIES.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                    </select>
                </div>

                {/* AEP / ARI row */}
                <div style={{display: 'flex', gap: 12, marginBottom: 10}}>
                    <div style={{flex: 1}}>
                        <label
                            htmlFor="ds-aep"
                            className="sv-design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            AEP (%)
                            <span className="sv-design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
                                e.g. 1 = 1-in-100
                            </span>
                        </label>
                        <input
                            id="ds-aep"
                            type="number"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={aep}
                            min={0}
                            max={100}
                            step={0.1}
                            onChange={e => {
                                onFieldChange('aep', e.target.value);
                                if (e.target.value !== '') onFieldChange('ari', '');
                            }}
                        />
                    </div>
                    <div style={{flex: 1}}>
                        <label
                            htmlFor="ds-ari"
                            className="sv-design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            ARI (years)
                            <span className="sv-design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
                                e.g. 100
                            </span>
                        </label>
                        <input
                            id="ds-ari"
                            type="number"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={ari}
                            min={0}
                            step={1}
                            onChange={e => {
                                onFieldChange('ari', e.target.value);
                                if (e.target.value !== '') onFieldChange('aep', '');
                            }}
                        />
                    </div>
                </div>

                {/* Duration + Timestep row */}
                <div style={{display: 'flex', gap: 12, marginBottom: 10}}>
                    <div style={{flex: 1}}>
                        <label
                            htmlFor="ds-duration"
                            className="sv-design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            Duration (min)
                        </label>
                        <input
                            id="ds-duration"
                            type="number"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={durationMin}
                            min={1}
                            step={1}
                            onChange={e => onFieldChange('durationMin', Number(e.target.value))}
                        />
                    </div>
                    <div style={{flex: 1}}>
                        <label
                            htmlFor="ds-timestep"
                            className="sv-design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            Timestep (min)
                        </label>
                        <input
                            id="ds-timestep"
                            type="number"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={timestepMin}
                            min={1}
                            step={1}
                            onChange={e => onFieldChange('timestepMin', Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* Peak position — alternating-block only */}
                {isAlternatingBlock && (
                    <div style={{marginBottom: 10}}>
                        <label
                            htmlFor="ds-peak-position"
                            className="sv-design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            Peak position (0–1)
                            <span className="sv-design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
                                0.5 = centre, 0.33 = early peak
                            </span>
                        </label>
                        <input
                            id="ds-peak-position"
                            type="number"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={peakPosition}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={e => onFieldChange('peakPosition', Number(e.target.value))}
                        />
                    </div>
                )}

                {/* Optional name */}
                <div style={{marginBottom: 12}}>
                    <label
                        htmlFor="ds-name"
                        className="sv-design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
                    >
                        Name <span className="sv-design-storm-hint">(optional — auto-generated if blank)</span>
                    </label>
                    <input
                        id="ds-name"
                        type="text"
                        className="sv-hydrology-text-input"
                        style={{width: '100%'}}
                        value={name}
                        onChange={e => onFieldChange('name', e.target.value)}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div id="design-storm-error">
                        <ErrorStrip message={error} style={{margin: '0 0 10px'}} />
                    </div>
                )}

                {/* Derive button — uses mode='derive' (back-compat persist path) */}
                <button
                    id="design-storm-derive-btn"
                    className="btn btn-primary"
                    style={{width: '100%'}}
                    disabled={!canDerive}
                    onClick={onDerive}
                >
                    {inFlight
                        ? <span><span className="glyphicon glyphicon-refresh" style={{marginRight: 6}} />Deriving…</span>
                        : 'Derive & Save Design Storm'}
                </button>
            </Card>

            {/* Hyetograph preview — shown after a successful derive. TASK-1760:
                chassis Card variant="chart" (light body for recharts). */}
            {derivedRowData && derivedRowData.length > 0 && (
                <Card
                    variant="chart"
                    extraClassName="sv-design-storm-chart-card"
                    style={{maxWidth: 700, marginBottom: 16}}
                    bodyStyle={{padding: '12px 16px'}}
                >
                    <div id="design-storm-preview">
                        <h4 style={{marginTop: 0, marginBottom: 4, fontSize: '0.95rem', fontWeight: 700, color: '#333'}}>
                            Hyetograph Preview
                        </h4>
                        {designStorm.result.name && (
                            <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 0}}>
                                Saved as: <strong>{designStorm.result.name}</strong>
                                {designStorm.result.source && (
                                    <span style={{marginLeft: 8, color: '#666', fontSize: '0.8rem'}}>
                                        ({designStorm.result.source})
                                    </span>
                                )}
                            </p>
                        )}
                        <HyetographChart rowData={derivedRowData} timestepMin={designStorm?.timestepMin} />
                    </div>
                </Card>
            )}
        </div>
    );
};

ManualEntryForm.propTypes = {
    idfTables: PropTypes.array,
    designStorm: PropTypes.object,
    onFieldChange: PropTypes.func.isRequired,
    onDerive: PropTypes.func.isRequired
};

// ---------------------------------------------------------------------------
// Estimate the timestep (minutes) of a saved record from its rowData. The
// hyetograph total-depth conversion (mm/hr × timestep/60) needs the spacing;
// derive it from the first two timestamps, default 6 min if undeterminable.
// ---------------------------------------------------------------------------

export function estimateTimestepMin(rowData) {
    if (!Array.isArray(rowData) || rowData.length < 2) return 6;
    const t0 = moment(rowData[0].timestamp);
    const t1 = moment(rowData[1].timestamp);
    if (!t0.isValid() || !t1.isValid()) return 6;
    const diff = Math.abs(t1.diff(t0, 'minutes'));
    return diff > 0 ? diff : 6;
}

// ---------------------------------------------------------------------------
// Main HydrologyTimeSeries DETAIL — TASK-1556 (W2): slim, record-centric.
//
// When a SAVED design storm is selected the detail (this component) shows ONLY
// the hyetograph of the SAVED record (activeHydrologyItem.rowData). The
// name/source/description header + Save/Delete footer live in the parent
// hydrologyListDetailContainer; source is rendered there read-only.
//
// The browser / manual-entry / paste-grid machinery (DesignStormsBrowser,
// ManualEntryForm, ManualPasteGrid) is NO LONGER rendered here — it moves into
// the Create panel (TASK-1558), which the container renders in create mode.
// Those components remain exported in this file for the Create panel and W3.
// ---------------------------------------------------------------------------

// TASK-2031 (W5.9): HydrologyTimeSeries receives dispatch props so the
// editable ManualPasteGrid can update + replace row data for saved hydrographs.
// The wiring mirrors createPanelDispatchToProps (below) exactly.
const HydrologyTimeSeries = ({
    activeHydrologyItem,
    activeHydrologyPage,
    dispatchUpdateRowData,
    dispatchReplaceRowData
}) => {
    // TASK-1556 (AC2) — feed the SAVED record's rowData to the existing
    // exported HyetographChart (the only gap was that activeHydrologyItem.rowData
    // was never wired in). .rowData is the saved Array<{timestamp,value}>
    // (reducer's createTimeSeriesFromJson sets it via instance.data = json.data).
    const rowData = activeHydrologyItem?.rowData || [];
    const hasData = Array.isArray(rowData) && rowData.length > 0;
    // TASK-2025 (W5.3): page-aware labels. 'hydrographs' -> 'Hydrograph' title +
    // noHydrographData empty-state; 'time-series' (Design Storms) unchanged.
    const isHydrograph = activeHydrologyPage === 'hydrographs';
    const titleFallback = isHydrograph ? 'Hydrograph' : 'Design Storm';
    const emptyMsgId = isHydrograph
        ? 'hydrata.hydrology.noHydrographData'
        : 'hydrata.hydrology.noTimeSeriesData';

    return (
        <div id="timeseries-detail-hyetograph" style={{maxWidth: 720}}>
            {/* TASK-2031 (W5.9): hydrographs page -> editable ManualPasteGrid (table + live
                line-chart preview). Design Storms page -> unchanged read-only HyetographChart.
                ManualPasteGrid derives activeHydrologyPage from item.series_type internally,
                so the preview chart inside it shows the correct flow/line presentation. */}
            {isHydrograph ? (
                hasData ? (
                    <ManualPasteGrid
                        activeHydrologyItem={activeHydrologyItem}
                        dispatchUpdateRowData={dispatchUpdateRowData}
                        dispatchReplaceRowData={dispatchReplaceRowData}
                    />
                ) : (
                    <p className="sv-design-storm-muted" style={{fontSize: '0.85rem', padding: '8px 0'}}>
                        <Message msgId={emptyMsgId} />
                    </p>
                )
            ) : (
                hasData ? (
                    <HyetographChart
                        rowData={rowData}
                        timestepMin={estimateTimestepMin(rowData)}
                        title={activeHydrologyItem?.name || titleFallback}
                        activeHydrologyPage={activeHydrologyPage}
                    />
                ) : (
                    <p className="sv-design-storm-muted" style={{fontSize: '0.85rem', padding: '8px 0'}}>
                        <Message msgId={emptyMsgId} />
                    </p>
                )
            )}
        </div>
    );
};

HydrologyTimeSeries.propTypes = {
    activeHydrologyItem: PropTypes.object,
    // TASK-2025 (W5.3): page discriminator for label / empty-state / chart behaviour.
    activeHydrologyPage: PropTypes.string,
    // TASK-2031 (W5.9): dispatch props for the editable hydrograph grid.
    dispatchUpdateRowData: PropTypes.func,
    dispatchReplaceRowData: PropTypes.func
};

// TASK-1556 (W2) — the slim detail only needs the active item. The
// design-storm/projection/idf state + dispatch wiring moved to the Create
// panel (TASK-1558), which owns its own connect.
// TASK-2025 (W5.3): also thread activeHydrologyPage for page-aware labels.
// TASK-2031 (W5.9): add mapDispatchToProps to wire updateTimeSeriesRowData +
// replaceTimeSeriesRowData — mirrors createPanelDispatchToProps exactly.
const mapStateToProps = (state) => {
    return {
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage
    };
};

const mapDispatchToProps = (dispatch) => ({
    dispatchUpdateRowData: (timeSeriesId, rowIndex, columnId, value) =>
        dispatch(updateTimeSeriesRowData(timeSeriesId, rowIndex, columnId, value)),
    dispatchReplaceRowData: (timeSeriesId, newRowData) =>
        dispatch(replaceTimeSeriesRowData(timeSeriesId, newRowData))
});

export {HydrologyTimeSeries as HydrologyTimeSeriesClass};
export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTimeSeries);

// ---------------------------------------------------------------------------
// TASK-1558 (W2) — Derive tab SHELL.
//
// IDF-table <select> + temporal-pattern <select> + an empty preview area.
// This is a SHELL only: it does NOT compute or persist anything — that's the
// W3 keystone (TASK-1560/1561). The picker markup mirrors DesignStormsBrowser's
// pickers (same className/option shape) so W3 can wire the preview + Save-subset
// without restyling. Pattern options are data-driven: PRESET_FAMILIES + any
// custom TemporalPattern from state (mirrors DesignStormsBrowser, AC8-ready).
// ---------------------------------------------------------------------------

// Pick a per-cell timestep that divides the duration (~24 steps) so the BE's
// `duration_min % timestep_min == 0` rule holds for any duration (incl. sub-60min).
const pickTimestep = (dur) => {
    const d = Number(dur);
    if (!d || d < 1) return 1;
    const target = Math.max(1, Math.round(d / 24));
    for (let ts = target; ts >= 1; ts--) { if (d % ts === 0) return ts; }
    return 1;
};

// TASK-1561 (W3b) — fully wired Derive tab.
// Previews + tick-to-select + "Save these N" for the given pattern × IDF.
const DesignStormDerive = ({
    idfTables,
    temporalPatterns,
    selectedIdfTableId,
    selectedPattern,
    onChange,
    // from connect
    previews,
    previewInFlight,
    saveInFlight,
    lastSavedCount,
    onPreview,
    onSave
}) => {
    // TASK-2007 (epic-2001 W2a): the dropdown lists the project's OWN Temporal
    // Pattern items STRICTLY (decision 5) — NOT the hardcoded PRESET_FAMILIES.
    // Standard patterns (SCS/Huff/Alternating Block) are reached by the user
    // first CREATING a project Temporal Pattern from a preset family (an
    // existing flow). A new project therefore starts EMPTY -> deliberate gate
    // -> empty-state nudge. The option value is the TemporalPattern id (string)
    // so a project can carry several items of the same pattern_type.
    const patternItems = (temporalPatterns || []).filter(tp => tp && tp.id !== null && tp.id !== undefined);
    const patternOptions = patternItems.map(tp => ({
        id: String(tp.id),
        label: tp.name
    }));

    // Resolve the selected Temporal Pattern row to its BE pattern + (custom)
    // curve. selectedPattern holds the TemporalPattern id as a string.
    const selectedItem = patternItems.find(tp => String(tp.id) === String(selectedPattern));
    const {patternKey: selectedPatternKey, customCurve: selectedCustomCurve} =
        resolveDerivePattern(selectedItem);

    // Local tick state — a Set of previewKey strings.
    const [ticked, setTicked] = useState(new Set());
    // Clear ticks when the selection changes.
    useEffect(() => { setTicked(new Set()); }, [selectedIdfTableId, selectedPattern]);
    // Also clear ticks on successful save.
    useEffect(() => {
        if (lastSavedCount !== null) { setTicked(new Set()); }
    }, [lastSavedCount]);

    const selectedTable = (idfTables || []).find(t => t.id === Number(selectedIdfTableId));

    // Build the derive cells from the selected IDF. The FE represents an IDF as
    // a grid (columnDefs = RP columns + a duration column; rowData = one row per
    // duration), so the axes come from there — NOT from return_periods_yr /
    // durations_min arrays (which the FE IDF object does not carry).
    //   - durations: each rowData row's `duration`.
    //   - ARIs: the RP columns (every columnDef except the duration column),
    //     parsed from the header (e.g. "100yr ARI" -> 100), keeping only columns
    //     that actually carry data (an all-zero column = no IDF data for that RP).
    //   - timestep: per-cell, a divisor of the duration (~24 steps) so the BE's
    //     `duration_min % timestep_min == 0` rule holds for sub-60-min durations
    //     (a fixed 60 would 400 a 5/10/30-min duration). (Decision D3.)
    // TASK-2007 (W2a): cells carry the RESOLVED BE pattern (patternKey) — and,
    // for a custom-curve item, the custom_curve threaded into the W2c batch.
    // TASK-2011 (W3b): the selected Temporal Pattern ITEM id. After W2a's strict
    // dropdown every derive/save targets a real project item, so this is always
    // available. It re-keys the BE mode='save' REPLACE on (idf, temporal_pattern_id)
    // so two items sharing a pattern_key (two SCS-II presets, or two custom items)
    // don't clobber each other's auto-derived rows. Coerced to Number — the option
    // value is the id as a string.
    const selectedTemporalPatternId =
        selectedItem && selectedItem.id !== null && selectedItem.id !== undefined
            ? Number(selectedItem.id)
            : null;

    const buildCells = useCallback((patternKey, customCurve, temporalPatternId) => {
        if (!selectedIdfTableId || !selectedTable || !patternKey) return [];
        const {durations, aris} = deriveMatrixAxes(selectedTable);
        const cells = [];
        for (const ari of aris) {
            for (const duration of durations) {
                const cell = {
                    pattern: patternKey,
                    ari,
                    duration_min: duration,
                    timestep_min: pickTimestep(duration)
                };
                // TASK-2011: tag each cell with the Temporal Pattern item id so
                // the BE save can re-key the REPLACE per item (additive — a cell
                // without it falls back to the legacy pattern-keyed REPLACE).
                if (temporalPatternId !== null && temporalPatternId !== undefined) {
                    cell.temporal_pattern_id = temporalPatternId;
                }
                // Only a custom-curve item carries custom_curve (additive; the
                // BE ignores it for non-custom patterns).
                if (patternKey === CUSTOM && customCurve) {
                    cell.custom_curve = customCurve;
                }
                cells.push(cell);
            }
        }
        return cells;
    }, [selectedIdfTableId, selectedTable]);

    // Auto-trigger preview when IDF + a resolvable pattern are both set. Mirrors
    // the DesignStormsBrowser auto-refresh useEffect (lines 321-325).
    useEffect(() => {
        if (selectedIdfTableId && selectedPatternKey && !previewInFlight) {
            const cells = buildCells(
                selectedPatternKey, selectedCustomCurve, selectedTemporalPatternId
            );
            if (cells.length > 0) {
                onPreview(cells, Number(selectedIdfTableId), 60);
            }
        }
    }, [selectedIdfTableId, selectedPattern]); // eslint-disable-line

    // Filter previews to the resolved BE pattern key (the preview echoes the BE
    // pattern, e.g. 'custom' / 'SCS_TYPE_II', NOT the TemporalPattern id).
    const patternPreviews = (previews || []).filter(p => p.pattern === selectedPatternKey);

    // TASK-2008 (W2b): RP x duration matrix. Rows = durations, cols = return
    // periods (both off the selected IDF). A cell is DERIVABLE iff a preview
    // exists for that (ari, duration); a non-derivable cell renders a disabled
    // cross (mirrors the BE silent-skip — e.g. a sparse-IDF gap). The tick key
    // matches the preview's previewKey so save (handleSave) is unchanged.
    const {durations: matrixDurations, aris: matrixAris} = deriveMatrixAxes(selectedTable);
    const previewByCell = new Map(
        patternPreviews.map(p => [`${p.ari}|${p.duration_min}`, p])
    );
    const matrixRows = matrixDurations.map(d => ({
        key: String(d),
        duration: d,
        label: d >= 60 ? `${(d / 60).toFixed(1)} hr` : `${d} min`,
        title: `${d} min duration`
    }));
    const matrixCols = matrixAris.map(ari => ({
        key: String(ari),
        ari,
        label: `${ari}yr`,
        title: `${ari}-year ARI`
    }));

    const toggleTick = (key) => {
        setTicked(prev => {
            const next = new Set(prev);
            if (next.has(key)) { next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    const handleSave = () => {
        if (!onSave || ticked.size === 0 || saveInFlight) return;
        const tickedCells = patternPreviews
            .filter(p => ticked.has(previewKey(p)))
            .map(p => {
                const cell = {
                    pattern: p.pattern,
                    ari: p.ari,
                    duration_min: p.duration_min,
                    // preview always echoes timestep_min; fall back to a valid divisor
                    // (never a fixed 60, which would 400 a sub-60-min duration).
                    timestep_min: p.timestep_min || pickTimestep(p.duration_min)
                };
                // TASK-2011 (W3b): re-attach the Temporal Pattern item id on save
                // (the preview echo does not carry it back) so the BE keys the
                // REPLACE per item — two items sharing a pattern_key no longer
                // clobber each other's auto-derived rows.
                if (selectedTemporalPatternId !== null
                    && selectedTemporalPatternId !== undefined) {
                    cell.temporal_pattern_id = selectedTemporalPatternId;
                }
                // TASK-2007 (W2a): re-thread the custom_curve on save so the W2c
                // save batch can derive the custom row (the preview echo does not
                // carry the curve back).
                if (p.pattern === CUSTOM && selectedCustomCurve) {
                    cell.custom_curve = selectedCustomCurve;
                }
                return cell;
            });
        if (tickedCells.length > 0) {
            onSave(tickedCells, Number(selectedIdfTableId));
        }
    };

    const noSelection = !selectedIdfTableId || !selectedPatternKey;

    return (
        <Card
            extraClassName="sv-design-storm-card"
            style={{maxWidth: 700}}
            bodyStyle={{padding: '12px 16px'}}
        >
            <div id="design-storm-derive-shell">
                {/* IDF table picker */}
                <div style={{marginBottom: 10}}>
                    <label htmlFor="ds-derive-idf-table" className="sv-design-storm-label" style={{fontSize: '0.85rem', marginBottom: 3}}>
                        <Message msgId="hydrata.hydrology.idfTable" />
                    </label>
                    <select
                        id="ds-derive-idf-table"
                        className="sv-hydrology-text-input"
                        style={{width: '100%'}}
                        value={selectedIdfTableId ?? ''}
                        onChange={e => onChange({selectedIdfTableId: e.target.value ? Number(e.target.value) : null})}
                    >
                        <option value="">-- select an IDF table --</option>
                        {(idfTables || []).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {/* Temporal-pattern picker — TASK-2007 (W2a): strictly the
                    project's own Temporal Pattern items. Empty project -> nudge. */}
                <div style={{marginBottom: 10}}>
                    <label htmlFor="ds-derive-pattern" className="sv-design-storm-label" style={{fontSize: '0.85rem', marginBottom: 3}}>
                        <Message msgId="hydrata.hydrology.temporalPattern" />
                    </label>
                    {patternOptions.length === 0 ? (
                        <div id="ds-derive-no-patterns">
                            <EmptyState heading={<Message msgId="hydrata.hydrology.deriveNoTemporalPatterns" />} />
                        </div>
                    ) : (
                        <select
                            id="ds-derive-pattern"
                            className="sv-hydrology-text-input"
                            style={{width: '100%'}}
                            value={(selectedPattern !== null && selectedPattern !== undefined) ? String(selectedPattern) : ''}
                            onChange={e => onChange({selectedPattern: e.target.value || null})}
                        >
                            <option value="">-- select a Temporal Pattern --</option>
                            {patternOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Preview area */}
                <div id="design-storm-derive-preview" style={{marginTop: 12}}>
                    {noSelection ? (
                        <EmptyState heading={<Message msgId="hydrata.hydrology.deriveNoPreviews" />} />
                    ) : previewInFlight ? (
                        <p className="sv-design-storm-muted" style={{margin: 0, fontSize: '0.85rem', padding: '14px', textAlign: 'center'}}>
                            <span className="glyphicon glyphicon-refresh" style={{marginRight: 6}} />
                        Loading previews…
                        </p>
                    ) : patternPreviews.length === 0 ? (
                        <EmptyState heading={<Message msgId="hydrata.hydrology.deriveNoPreviews" />} />
                    ) : (
                        <div>
                            <p className="sv-design-storm-hint" style={{marginBottom: 6, fontSize: '0.82rem'}}>
                                <Message msgId="hydrata.hydrology.deriveTickToSave" />
                            </p>
                            {/* TASK-2008 (W2b): RP x duration tick/cross matrix. */}
                            <MatrixGrid
                                tableId="ds-derive-matrix"
                                className="sv-ds-derive-matrix"
                                cornerLabel={<Message msgId="hydrata.hydrology.duration" />}
                                rows={matrixRows}
                                cols={matrixCols}
                                renderCell={(row, col) => {
                                    const preview = previewByCell.get(`${col.ari}|${row.duration}`);
                                    if (!preview) {
                                        // Non-derivable (e.g. sparse-IDF gap): disabled cross.
                                        return (
                                            <span
                                                className="sv-ds-derive-cell sv-ds-derive-cell--disabled"
                                                title={`No IDF data for ${col.ari}yr / ${row.label} — cannot derive`}
                                                aria-label="not derivable"
                                            >✕</span>
                                        );
                                    }
                                    const key = previewKey(preview);
                                    const checked = ticked.has(key);
                                    const depth = (preview.total_depth_mm !== null && preview.total_depth_mm !== undefined)
                                        ? `${preview.total_depth_mm.toFixed(1)} mm`
                                        : '';
                                    return (
                                        <button
                                            type="button"
                                            id={`ds-derive-tick-${key}`}
                                            className={`sv-ds-derive-cell sv-ds-derive-tick${checked ? ' sv-ds-derive-cell--ticked' : ''}`}
                                            aria-pressed={checked}
                                            aria-label={`${checked ? 'Deselect' : 'Select'} ${col.ari}yr ${row.label}`}
                                            title={`${col.ari}yr / ${row.label}${depth ? ' — ' + depth : ''}`}
                                            onClick={() => toggleTick(key)}
                                        >{checked ? '✓' : ''}</button>
                                    );
                                }}
                            />
                            {/* Save these N button */}
                            <div style={{marginTop: 10, display: 'flex', alignItems: 'center', gap: 10}}>
                                <button
                                    id="sv-ds-derive-save-btn"
                                    type="button"
                                    className={ticked.size > 0 && !saveInFlight ? 'sv-hydrology-button sv-ds-derive-save-btn' : 'sv-hydrology-button-disabled sv-ds-derive-save-btn'}
                                    disabled={ticked.size === 0 || saveInFlight}
                                    onClick={handleSave}
                                    style={{
                                        // TASK-1758 W3 conform — tokenised active/save green.
                                        backgroundColor: ticked.size > 0 && !saveInFlight ? 'var(--sv-accent-green)' : 'rgba(39,202,59,0.4)',
                                        minWidth: 120
                                    }}
                                >
                                    {saveInFlight
                                        ? 'Saving…'
                                        // TASK-2009 (W2d): label is now 'Derive' (new i18n key);
                                        // the dispatch (handleSave -> onSave -> mode='save') is unchanged.
                                        : <Message msgId="hydrata.hydrology.deriveActionButton" />
                                    }
                                </button>
                                {lastSavedCount !== null && (
                                    <span className="sv-ds-derive-saved-toast" style={{fontSize: '0.82rem', color: 'var(--sv-accent-lime)'}}>
                                        <Message msgId="hydrata.hydrology.deriveSavedToast" msgParams={{n: lastSavedCount.created}} />
                                        {lastSavedCount.replaced > 0 ? ` (replaced ${lastSavedCount.replaced})` : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

DesignStormDerive.propTypes = {
    idfTables: PropTypes.array,
    temporalPatterns: PropTypes.array,
    selectedIdfTableId: PropTypes.number,
    selectedPattern: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    previews: PropTypes.array,
    previewInFlight: PropTypes.bool,
    saveInFlight: PropTypes.bool,
    lastSavedCount: PropTypes.object,
    onPreview: PropTypes.func,
    onSave: PropTypes.func
};

// ---------------------------------------------------------------------------
// TASK-1558 (W2) — two-tab CREATE panel (Input | Derive).
//
// Opened by the container's "New Item" on the time-series page (container owns
// the create-mode + active-tab state, passed in as props). The Input tab is the
// extracted advanced manual table (ManualPasteGrid) bound to the unsaved
// activeHydrologyItem; the Derive tab is the picker SHELL (DesignStormDerive).
// A "Back to list" affordance lets the container exit create mode + discard the
// orphaned unsaved instance.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-shadow -- props named after action creators (mapDispatchToProps shorthand)
const DesignStormCreatePanel = ({
    activeHydrologyItem,
    idfTables,
    temporalPatterns,
    activeTab,
    onTabChange,
    // TASK-2024 (W5.2): when true (Hydrographs page), hide the Derive button + body.
    // Derive = IDF->design-storm rainfall derivation, meaningless for flow hydrographs.
    // Design Storms pass hideDerive=false (default) — their Derive flow is unaffected.
    hideDerive,
    // TASK-1561 (W3b) — projection/save props threaded from connect
    previews,
    previewInFlight,
    saveInFlight,
    lastSavedCount,
    previewDesignStorms: dispatchPreview,
    saveDesignStorms: dispatchSave,
    updateTimeSeriesRowData: dispatchUpdateRowData,
    replaceTimeSeriesRowData: dispatchReplaceRowData
}) => {
    // Derive-tab selections are LOCAL — kept here so clearing IDF/pattern
    // cancels any in-flight preview at source.
    // TASK-2007 (W2a): selectedPattern now holds a project TemporalPattern id
    // (string), not a hardcoded pattern constant — start unselected so the
    // strict dropdown begins on its '-- select a Temporal Pattern --' placeholder.
    const [deriveSpec, setDeriveSpec] = useState({selectedIdfTableId: null, selectedPattern: null});
    // When hideDerive, force tab to 'input' regardless of caller state — a stale
    // tsCreateTab='derive' must not leak DesignStormDerive into the Hydrographs panel.
    const tab = (hideDerive || !activeTab) ? 'input' : activeTab;

    return (
        <div id="design-storm-create-panel">
            {/* Input | Derive create-mode control.
                TASK-2003 (epic-2001 W1b): converted from a segmented pair of
                <button>s to a semantic RADIO group (role=radiogroup with two
                role=radio options) — picking one of two mutually-exclusive create
                modes is a radio choice, not an action. Keeps the
                #ds-create-tab-input / #ds-create-tab-derive ids and the
                sv-hydrology-idf-subtoggle / sv-hydrology-idf-segment classes so
                the existing styling + tests still resolve. Uses its own
                createModeInput / createModeDerive i18n keys (no longer reuses the
                IDF idfModeManual / idfModeDerive).
                TASK-2024: hidden on the Hydrographs page (hideDerive=true). */}
            {!hideDerive && (
                <div
                    className="sv-hydrology-idf-subtoggle"
                    role="radiogroup"
                    aria-label="Create mode"
                >
                    {[
                        {value: 'input', id: 'ds-create-tab-input', msgId: 'hydrata.hydrology.createModeInput'},
                        {value: 'derive', id: 'ds-create-tab-derive', msgId: 'hydrata.hydrology.createModeDerive'}
                    ].map((opt) => {
                        const checked = tab === opt.value;
                        return (
                            <div
                                key={opt.value}
                                id={opt.id}
                                role="radio"
                                aria-checked={checked}
                                tabIndex={checked ? 0 : -1}
                                className={'sv-hydrology-idf-segment' + (checked ? ' is-active' : '')}
                                onClick={() => onTabChange(opt.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onTabChange(opt.value);
                                    }
                                }}
                            >
                                <Message msgId={opt.msgId} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Active tab body */}
            <div style={{marginTop: 10}}>
                {/* TASK-2024: hideDerive short-circuits Derive body; Hydrographs always shows ManualPasteGrid. */}
                {!hideDerive && tab === 'derive' ? (
                    <DesignStormDerive
                        idfTables={idfTables}
                        temporalPatterns={temporalPatterns}
                        selectedIdfTableId={deriveSpec.selectedIdfTableId}
                        selectedPattern={deriveSpec.selectedPattern}
                        onChange={(patch) => setDeriveSpec(prev => ({...prev, ...patch}))}
                        previews={previews}
                        previewInFlight={previewInFlight}
                        saveInFlight={saveInFlight}
                        lastSavedCount={lastSavedCount}
                        onPreview={dispatchPreview}
                        onSave={dispatchSave}
                    />
                ) : (
                    <ManualPasteGrid
                        activeHydrologyItem={activeHydrologyItem}
                        dispatchUpdateRowData={dispatchUpdateRowData}
                        dispatchReplaceRowData={dispatchReplaceRowData}
                    />
                )}
            </div>
        </div>
    );
};

DesignStormCreatePanel.propTypes = {
    activeHydrologyItem: PropTypes.object,
    idfTables: PropTypes.array,
    temporalPatterns: PropTypes.array,
    activeTab: PropTypes.string,
    onTabChange: PropTypes.func.isRequired,
    // TASK-2024 (W5.2): true on the Hydrographs page — hides the Derive button + body.
    hideDerive: PropTypes.bool,
    previews: PropTypes.array,
    previewInFlight: PropTypes.bool,
    saveInFlight: PropTypes.bool,
    lastSavedCount: PropTypes.object,
    previewDesignStorms: PropTypes.func,
    saveDesignStorms: PropTypes.func,
    updateTimeSeriesRowData: PropTypes.func.isRequired,
    replaceTimeSeriesRowData: PropTypes.func.isRequired
};

const createPanelStateToProps = (state) => ({
    activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
    idfTables: state?.hydrology?.idfTables || [],
    temporalPatterns: state?.hydrology?.temporalPatterns || [],
    // TASK-1561 (W3b) — projection slice for the Derive tab
    previews: state?.hydrology?.projection?.previews || [],
    previewInFlight: state?.hydrology?.projection?.inFlight || false,
    saveInFlight: state?.hydrology?.projection?.saveInFlight || false,
    lastSavedCount: state?.hydrology?.projection?.lastSavedCount || null
});

const createPanelDispatchToProps = (dispatch) => ({
    updateTimeSeriesRowData: (timeSeriesId, rowIndex, columnId, value) =>
        dispatch(updateTimeSeriesRowData(timeSeriesId, rowIndex, columnId, value)),
    replaceTimeSeriesRowData: (timeSeriesId, newRowData) =>
        dispatch(replaceTimeSeriesRowData(timeSeriesId, newRowData)),
    // TASK-1561 (W3b)
    previewDesignStorms: (cells, idfTableId, timestepMin) =>
        dispatch(previewDesignStormsRequest(cells, idfTableId, timestepMin)),
    saveDesignStorms: (cells, idfTableId) =>
        dispatch(saveDesignStormsRequest(cells, idfTableId))
});

const ConnectedDesignStormCreatePanel =
    connect(createPanelStateToProps, createPanelDispatchToProps)(DesignStormCreatePanel);

export {DesignStormCreatePanel, DesignStormDerive};
export {ConnectedDesignStormCreatePanel as HydrologyTimeSeriesCreatePanel};
export {HyetographChart};
