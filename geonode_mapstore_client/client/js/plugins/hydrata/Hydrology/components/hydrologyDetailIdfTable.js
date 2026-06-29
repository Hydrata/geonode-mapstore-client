import React, {useState, useEffect, useRef} from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {
    updateIdfRowData
} from "../actionsHydrology";

import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {formatDuration} from './hydrologyDetailIdfDerive';

// ---------------------------------------------------------------------------
// TASK-1497 (UAT note-1) — the manual Input IDF table now mirrors the Derive
// step-2 matrix: durations as ROW headers, return periods as COLUMN headers,
// using the shared .sv-idf-matrix-* styling. The difference from the Derive
// matrix is the cell content: instead of a green-tick / red-cross toggle,
// each ENABLED cell is a plain keyboard float entry (max 2 decimals, no
// up/down spinner). DISABLED cells are greyed + inert and excluded from the
// IDF curve.
//
// TASK-1525 (UAT round-2) — strict two-axis AND-gating. A cell is editable
// IFF BOTH its duration row AND its return-period column are selected; a
// single-axis (or single-cell) toggle no longer flips anything editable.
// Selection is tracked as two Sets:
//  • selectedRows — row indices whose duration header is selected
//  • selectedCols — ARI column keys whose header is selected
// and isEnabled(r,c) = selectedRows.has(r) && selectedCols.has(c).
//
// Enable/disable tooling:
//  • click a duration row header  → toggle that row in selectedRows
//  • click an ARI column header   → toggle that column in selectedCols
//  • clear an enabled cell + blur → zero its value (cell stays editable
//    in-session while both axes remain selected; reload re-seeds from data)
// The direct single-cell-click affordance is DROPPED for strict AND
// (TASK-1525 self-default tradeoff): a disabled cell at an unselected axis
// can no longer be enabled by clicking the cell itself.
//
// A cell's enabled state persists as its value: any non-zero number is
// "enabled" (has data); 0 / empty is "disabled" (already excluded by
// getChartData's `!== 0` filter, so NO backend change is needed). On item
// load both Sets are re-seeded from the non-zero cells (a row is selected if
// it holds any non-zero cell; a column likewise), so a saved table reopens
// with its data cells editable. The 0-reverts-on-reload quirk stays by-design.
// ---------------------------------------------------------------------------

// 9 canonical ARI columns — keys match the BE FE-data adapter (_FE_ARI_COLUMNS)
// and the IdfTable columnDefs in classesHydrology.js.
const ARI_COLUMNS = [
    {key: '0-5yrARI', label: '0.5yr'},
    {key: '1yrARI', label: '1yr'},
    {key: '2yrARI', label: '2yr'},
    {key: '5yrARI', label: '5yr'},
    {key: '10yrARI', label: '10yr'},
    {key: '20yrARI', label: '20yr'},
    {key: '50yrARI', label: '50yr'},
    {key: '100yrARI', label: '100yr'},
    {key: '500yrARI', label: '500yr'}
];

// Human-readable recurrence-interval label per ARI column key, for the IDF
// curve legend (e.g. '10yrARI' -> '10 yr ARI'). The legend names each plotted
// line by its Average Recurrence Interval.
const ARI_LEGEND_LABEL = ARI_COLUMNS.reduce((acc, c) => {
    acc[c.key] = `${c.label.replace('yr', ' yr')} ARI`;
    return acc;
}, {});

// Explicit log-scale reference ticks. recharts does NOT auto-generate ticks for
// a numeric log axis with an 'auto' domain bound (the ticks render blank), so
// we supply a fixed log-spaced set; out-of-domain ticks are dropped by recharts.
export const DURATION_TICKS = [5, 10, 15, 30, 60, 120, 240, 360, 720, 1440, 2880, 4320];

// Nice log-spaced Y-axis ticks spanning BOTH the intensity (~1–50 mm/hr) and the
// depth (~1–500+ mm) display ranges. Used to PIN the Y-axis domain to its tick
// extremes — the same fix the duration X-axis got (TASK-1754): an explicit
// [lo, hi] domain + explicit in-range ticks stops recharts from floating an
// 'auto' upper bound that mislabels the top tick (the "1000 where 10 belongs"
// log-tick artifact — recharts placed an out-of-scale INTENSITY tick at the top
// gridline). A pinned domain with allowDataOverflow keeps labels on their lines.
const LOG_AXIS_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

// TASK-1754 — fixed log-scale duration domain. Pinning to [first, last] tick
// (5..4320 min) with allowDataOverflow keeps every DURATION_TICKS entry evenly
// spaced regardless of the plotted data's max; a floating `'auto'` upper bound
// crowded the right-edge ticks (720/1440/2880/4320) whenever the data max sat
// below 4320. Exported so the log-axis contract is unit-assertable without
// depending on recharts rendering a measurable chart in jsdom.
export const DURATION_X_DOMAIN = [DURATION_TICKS[0], DURATION_TICKS[DURATION_TICKS.length - 1]];

// Build the IDF-curve scatter data from rowData, keyed per ARI column, dropping
// every 0/empty cell (same zero-drop rule as classesHydrology.js getChartData,
// `parseFloat !== 0`). NOTE: we build from ARI_COLUMNS here rather than calling
// item.getChartData() because the IdfTable's default columnDefs carry no `ari`
// flag and the BE serializer (serializers_v2.py _build_fe_data) intentionally
// does NOT emit columnDefs — so getChartData()'s `columnDefs.filter(c=>c.ari)`
// always yields {} (TASK-1526 finding). Driving the curve off rowData (the
// source of truth the matrix edits) keeps it in sync with the table.
const buildChartData = (rowData) => {
    const lines = {};
    ARI_COLUMNS.forEach(col => {
        const filtered = (rowData || []).filter(row => parseFloat(row[col.key]) !== 0 && Number.isFinite(parseFloat(row[col.key])));
        lines[col.key] = filtered.map((row, index) => ({
            duration: row.duration,
            intensity: parseFloat(row[col.key]),
            label: index === filtered.length - 1 ? col.key : ''
        }));
    });
    return lines;
};

// A cell holds "data" (is enabled) when its value parses to a finite non-zero
// number. 0 / empty / non-numeric all read as disabled.
const hasCellValue = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) && n !== 0;
};

// Round a numeric value to AT MOST 2 decimal places for DISPLAY only, stripping
// trailing zeros: 121.4837 -> "121.48", 121.5 -> "121.5", 121 -> "121"
// (TASK-1554). Stored precision is never mutated by this — IdfInputCell's
// dirty-guard ensures a clamped display value isn't committed on an untouched
// blur. Non-numeric input returns '' so a blank/0 cell stays blank.
const round2 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? String(Number(n.toFixed(2))) : '';
};

// Display string for an enabled cell — blank for 0 so a freshly-enabled cell
// is ready to type into rather than showing a literal "0". Loaded/derived
// intensities are clamped to <=2dp for display (TASK-1554); rowData keeps the
// raw value.
const displayValue = (value) => (hasCellValue(value) ? round2(value) : '');

// Round to AT MOST 1 decimal place for DISPLAY only (depth values are ~1–2
// orders larger than intensity, so 1dp reads cleanly). Strips trailing zeros:
// 121.48 -> "121.5", 8.0 -> "8". Non-numeric input returns ''.
const round1 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? String(Number(n.toFixed(1))) : '';
};

// Per-row unit conversion (display-only). The canonical stored unit is intensity
// (mm/hr); depth_mm = intensity_mm_per_hr × (duration_min / 60). The factor is
// PER-ROW — each duration row uses its OWN duration — so it is applied at the
// render boundary only. rowData is NEVER mutated: switching back to Intensity
// restores the exact stored value, and (with the Depth view kept read-only) a
// converted number can never round-trip back into the canonical matrix.
const intensityToDepth = (intensity, durationMin) => {
    const i = Number(intensity);
    const d = Number(durationMin);
    if (!Number.isFinite(i) || !Number.isFinite(d)) return NaN;
    return i * (d / 60);
};

// Given the plotted Y values (already in the DISPLAY unit), return a log domain
// pinned to tick boundaries plus the ticks inside it. This is the duration-axis
// fix generalised to a data-driven range: lo = largest tick <= dataMin, hi =
// smallest tick >= dataMax, ticks = LOG_AXIS_TICKS within [lo, hi]. Pinning the
// domain to exact tick values (with allowDataOverflow on the axis) keeps every
// tick LABEL on its gridline regardless of unit. Empty input falls back to a
// sane [1, 10] decade. Exported so the axis contract is unit-assertable without
// rendering a measurable chart in jsdom (mirrors DURATION_X_DOMAIN).
export const computeLogYAxis = (values) => {
    const finite = (values || []).filter(v => Number.isFinite(v) && v > 0);
    if (!finite.length) return {domain: [1, 10], ticks: [1, 2, 5, 10]};
    const dataMin = Math.min(...finite);
    const dataMax = Math.max(...finite);
    let lo = LOG_AXIS_TICKS.filter(t => t <= dataMin).pop();
    if (lo === undefined) lo = LOG_AXIS_TICKS[0];
    let hi = LOG_AXIS_TICKS.find(t => t >= dataMax);
    if (hi === undefined) hi = LOG_AXIS_TICKS[LOG_AXIS_TICKS.length - 1];
    if (hi <= lo) hi = lo * 10;
    const ticks = LOG_AXIS_TICKS.filter(t => t >= lo && t <= hi);
    return {domain: [lo, hi], ticks};
};

// Sanitise raw input to a float string: digits + a single dot + max 2 decimals.
// type=text (not number) means no spinner widget; this keeps entry numeric.
const sanitizeFloat = (raw) => {
    let s = String(raw === null || raw === undefined ? '' : raw).replace(/[^0-9.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
        // Keep only the first dot, then clamp to 2 decimal places.
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
        const [intPart, decPart] = s.split('.');
        s = `${intPart}.${(decPart || '').slice(0, 2)}`;
    }
    return s;
};

// Seed the selected-row set from the rowData: a row is selected when it holds
// any non-zero cell (so a saved table reopens with its data rows editable).
const seedSelectedRows = (rowData) => {
    const set = new Set();
    (rowData || []).forEach((row, rowIndex) => {
        if (ARI_COLUMNS.some(col => hasCellValue(row[col.key]))) set.add(rowIndex);
    });
    return set;
};

// Seed the selected-column set from the rowData: a column is selected when any
// row holds a non-zero value for it.
const seedSelectedCols = (rowData) => {
    const set = new Set();
    ARI_COLUMNS.forEach(col => {
        if ((rowData || []).some(row => hasCellValue(row[col.key]))) set.add(col.key);
    });
    return set;
};

// ---------------------------------------------------------------------------
// IdfInputCell — a single float-entry cell (local state, commit on blur).
// ---------------------------------------------------------------------------
const IdfInputCell = ({value, onCommit}) => {
    const [text, setText] = useState(displayValue(value));
    // Track whether the user actually edited this cell. displayValue clamps the
    // loaded/derived value to <=2dp (TASK-1554); committing that rounded text on
    // an *untouched* blur would lossily overwrite the stored full-precision value
    // in rowData, so only commit when the cell was genuinely edited.
    const dirty = useRef(false);
    useEffect(() => {
        setText(displayValue(value));
        dirty.current = false;
    }, [value]);
    return (
        <input
            className="sv-idf-matrix-input"
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => { dirty.current = true; setText(sanitizeFloat(e.target.value)); }}
            onBlur={() => { if (dirty.current) onCommit(text); }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
            }}
        />
    );
};

IdfInputCell.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onCommit: PropTypes.func
};

// ---------------------------------------------------------------------------
// IdfCurveChart — the recharts ScatterChart, extracted as a standalone
// subcomponent (TASK-1526). getChartData() already drops every 0-value cell
// (classesHydrology.js getChartData() filters `parseFloat !== 0`), so only
// non-zero ARI lines are plotted. ResponsiveContainer fills its parent, which
// MUST give it an explicit pixel height (the modal panel does).
// ---------------------------------------------------------------------------
const CURVE_COLOURS = ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6dcd59", "#b8de29", "#fde725"];

// Axis titles are rendered as plain HTML around the chart rather than via the
// recharts XAxis/YAxis `label` prop: the pinned recharts (0.22.4) does not
// honour the `label={{value, position}}` object form, so the axes shipped
// unlabelled. HTML titles render the units reliably and are version-proof.
const IdfCurveChart = ({chartData, unitMode}) => {
    const depth = unitMode === 'depth';
    // Convert each ARI series to the DISPLAY unit at the render boundary. The
    // manual curve carries only the point estimate (no CI band), so a single
    // per-point factor (duration/60) suffices; chartData/rowData stay mm/hr.
    const plotData = {};
    const plotValues = [];
    Object.keys(chartData).forEach((key) => {
        plotData[key] = chartData[key].map((pt) => {
            const value = depth ? intensityToDepth(pt.intensity, pt.duration) : pt.intensity;
            if (Number.isFinite(value)) plotValues.push(value);
            return {...pt, value};
        });
    });
    // TASK-2 fix — pin the log Y-axis domain to nice tick boundaries derived from
    // the plotted (display-unit) values, so the top tick label sits on its line
    // and the axis follows the unit toggle (depth ranges ~10–100× higher).
    const {domain: yDomain, ticks: yTicks} = computeLogYAxis(plotValues);
    const yUnit = depth ? 'mm' : 'mm/hr';
    const yFmt = depth ? round1 : round2;
    return (
        <div className="sv-idf-curve-chart-layout">
            <div className="sv-idf-curve-yaxis-title">{depth ? 'Depth (mm)' : 'Intensity (mm/hr)'}</div>
            <div className="sv-idf-curve-plot-area">
                <div className="sv-idf-curve-plot">
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <ScatterChart
                            margin={{
                                top: 20,
                                right: 140,
                                bottom: 30,
                                left: 45
                            }}
                        >
                            <CartesianGrid/>
                            {/* TASK-1754 — the duration axis is LOGARITHMIC across a
                            fixed 5..4320 min domain. The earlier `domain={[5,'auto']}`
                            let recharts float the upper bound from the data, so the
                            right-hand ticks (720/1440/2880/4320) bunched and overlapped
                            whenever the plotted max sat below 4320; pinning the domain to
                            [5, 4320] with allowDataOverflow spaces all DURATION_TICKS
                            evenly across the log scale and stops the right-edge crowding.
                            The series accessor stays dataKey="duration" (minutes), which
                            maps unchanged under the log scale. */}
                            <XAxis
                                type="number"
                                dataKey="duration"
                                name="Duration"
                                unit="min"
                                scale="log"
                                domain={DURATION_X_DOMAIN}
                                allowDataOverflow
                                ticks={DURATION_TICKS}
                                allowDecimals={false}
                                tickFormatter={(value) => value}
                            />
                            {/* TASK-2 — the Y-axis is LOGARITHMIC with a PINNED [lo, hi]
                            domain sitting on nice tick boundaries (computeLogYAxis),
                            mirroring the duration X-axis fix. The earlier
                            `domain={[1, 'auto']}` let recharts float the upper bound,
                            which placed an out-of-scale INTENSITY tick (e.g. 1000) at
                            the top gridline where 10 belonged (~100× label error). The
                            domain + ticks follow the unit toggle: dataKey="value" is the
                            display-unit value (intensity, or per-row depth). */}
                            <YAxis
                                type="number"
                                dataKey="value"
                                name={depth ? 'Depth' : 'Intensity'}
                                unit={yUnit}
                                scale="log"
                                domain={yDomain}
                                allowDataOverflow
                                ticks={yTicks}
                                tickFormatter={(value) => value}
                            />
                            {/* TASK-1554 — clamp tooltip values for display (round2 for
                            intensity, round1 for the larger depth values; non-numbers
                            pass through). */}
                            <Tooltip
                                cursor={{strokeDasharray: "3 3"}}
                                formatter={(value) => (Number.isFinite(Number(value)) ? yFmt(value) : value)}
                            />
                            {/* Legend identifies each line by its recurrence interval (ARI).
                            Vertical list on the right (one entry per PLOTTED line). */}
                            <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                            />
                            {/* Only draw lines that actually hold data — buildChartData keys all
                            nine ARIs but leaves all-zero columns empty; plotting them would
                            add blank legend entries. Colour is keyed to the ARI's canonical
                            index so each recurrence interval keeps a stable colour. */}
                            {Object.keys(plotData)
                                .filter((frequency) => plotData[frequency].length > 0)
                                .map((frequency) => {
                                    const colourIndex = ARI_COLUMNS.findIndex((c) => c.key === frequency);
                                    return (
                                        <Scatter
                                            key={frequency}
                                            name={ARI_LEGEND_LABEL[frequency] || frequency}
                                            data={plotData[frequency]}
                                            fill={CURVE_COLOURS[colourIndex % CURVE_COLOURS.length]}
                                            line
                                            shape={({ cx, cy, fill }) => <circle cx={cx} cy={cy} r={3} fill={fill} />}
                                        />
                                    );
                                })}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <div className="sv-idf-curve-xaxis-title">Duration (min)</div>
            </div>
        </div>
    );
};

IdfCurveChart.propTypes = {
    chartData: PropTypes.object,
    unitMode: PropTypes.string
};

// ---------------------------------------------------------------------------
// IdfCurveModal — an on-demand overlay-div modal (TASK-1526). Portals to
// document.body (anuga/swamm container idiom) so it escapes the SimpleView
// stacking context and floats over the map. Backdrop click + × both close;
// a click on the inner panel is stopped from bubbling so it does NOT close.
// The panel gives the chart an explicit pixel height (ResponsiveContainer
// measures 0 inside an auto-height flex parent → blank chart otherwise).
// ---------------------------------------------------------------------------
const IdfCurveModal = ({chartData, unitMode, onClose, closeLabel}) => {
    if (typeof document === 'undefined') return null;
    return ReactDOM.createPortal(
        <div
            className="sv-idf-curve-modal-overlay"
            onClick={onClose}
        >
            <div
                className="simple-view-panel sv-idf-curve-modal-panel"
                onClick={e => e.stopPropagation()}
            >
                <div className="simple-view-panel-header sv-idf-curve-modal-header">
                    <span><Message msgId="hydrata.hydrology.idfCurveModalTitle" /></span>
                    <button
                        type="button"
                        className="sv-legend-close"
                        style={{position: 'static'}}
                        onClick={onClose}
                        title={closeLabel}
                        aria-label={closeLabel}
                    >&times;</button>
                </div>
                <div className="sv-idf-curve-modal-body">
                    <IdfCurveChart chartData={chartData} unitMode={unitMode} />
                </div>
            </div>
        </div>,
        document.body
    );
};

IdfCurveModal.propTypes = {
    chartData: PropTypes.object,
    unitMode: PropTypes.string,
    onClose: PropTypes.func,
    closeLabel: PropTypes.string
};

// eslint-disable-next-line no-shadow -- prop intentionally named after the action creator (mapDispatchToProps shorthand)
const HydrologyDetailIdfTable = ({ activeHydrologyItem, updateIdfRowData }, context) => {
    // Resolve a msgId to a plain string for title/aria-label attributes (the
    // <Message> component only renders JSX children). Mirrors the canonical
    // idiom in Anuga/scenarioHeaderActions: getMessageById returns the msgId
    // itself when the key is missing, so compare to detect the unresolved case
    // and fall back to English before i18n has loaded.
    const tr = (msgId, fallback) => {
        const messages = (context && context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleWindowResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);
    const flexDirection = windowWidth < 1800 ? 'column' : 'row';

    // TASK-1497 (UAT note-4 parity) — duration row-headers default to hours.
    const [showHours, setShowHours] = useState(true);

    // Depth↔intensity DISPLAY unit (FE-only). 'intensity' (canonical mm/hr) is
    // the default and the only EDITABLE mode; 'depth' (mm) is a render-only,
    // READ-ONLY view (depth_mm = intensity × duration/60, per-row) so a converted
    // value can never round-trip back into the stored mm/hr matrix.
    const [unitMode, setUnitMode] = useState('intensity');
    const depthMode = unitMode === 'depth';

    const rowData = activeHydrologyItem?.rowData || [];

    // Two-axis selection (TASK-1525). A cell is editable IFF its row AND its
    // column are both selected. Re-seeded whenever the active item changes
    // (switch table / save success rebuilds the instance) — NOT on every edit
    // (edits mutate the same instance in place, ref unchanged).
    const [selectedRows, setSelectedRows] = useState(() => seedSelectedRows(rowData));
    const [selectedCols, setSelectedCols] = useState(() => seedSelectedCols(rowData));
    const [chartData, setChartData] = useState(buildChartData(activeHydrologyItem?.rowData));
    // TASK-1526 — the IDF curve is on-demand via a portal modal, not inline.
    const [curveOpen, setCurveOpen] = useState(false);
    useEffect(() => {
        setSelectedRows(seedSelectedRows(activeHydrologyItem?.rowData || []));
        setSelectedCols(seedSelectedCols(activeHydrologyItem?.rowData || []));
        setChartData(buildChartData(activeHydrologyItem?.rowData));
        // Switching the active table closes any open curve modal.
        setCurveOpen(false);
    }, [activeHydrologyItem]);

    // The curve has something to plot only when ≥1 ARI line holds a non-zero
    // cell. buildChartData keys every ARI but leaves all-zero columns as an
    // empty array, so .some(l => l.length) is the valid-data gate.
    const hasValidData = Object.values(chartData).some(line => line.length);
    // If the data goes all-zero while the modal is open (e.g. last cell
    // cleared), close it so the modal never lingers over an empty chart.
    useEffect(() => {
        if (!hasValidData && curveOpen) setCurveOpen(false);
    }, [hasValidData, curveOpen]);

    const isEnabled = (rowIndex, columnId) => selectedRows.has(rowIndex) && selectedCols.has(columnId);

    const refreshChart = () => setChartData(buildChartData(activeHydrologyItem?.rowData));

    // Commit an edited cell. Empty / 0 → zero the stored value so it is
    // excluded from the curve (the cell stays editable in-session while both
    // axes remain selected; a reload re-seeds from non-zero data). Any other
    // number → keep the sanitised value.
    const commitCell = (rowIndex, columnId, raw) => {
        if (!activeHydrologyItem) return;
        const num = parseFloat(raw);
        if (!Number.isFinite(num) || num === 0) {
            updateIdfRowData(activeHydrologyItem.id, rowIndex, columnId, 0);
        } else {
            // Store a Number (not the sanitised string) so rowData holds a
            // consistent numeric type for getChartData + the BE round-trip.
            updateIdfRowData(activeHydrologyItem.id, rowIndex, columnId, Number(sanitizeFloat(raw)));
        }
        refreshChart();
    };

    // Toggle a duration row's selection. Deselecting zeros the cells at this
    // row's intersection with the currently-selected columns (the cells that
    // were editable), so the deselect persists across a reload.
    const toggleRow = (rowIndex) => {
        if (!activeHydrologyItem) return;
        const isOn = selectedRows.has(rowIndex);
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (isOn) {
                next.delete(rowIndex);
            } else {
                next.add(rowIndex);
            }
            return next;
        });
        if (isOn) {
            ARI_COLUMNS.forEach(col => {
                if (selectedCols.has(col.key)) {
                    updateIdfRowData(activeHydrologyItem.id, rowIndex, col.key, 0);
                }
            });
            refreshChart();
        }
    };

    // Toggle an ARI column's selection. Deselecting zeros the cells at this
    // column's intersection with the currently-selected rows.
    const toggleCol = (columnId) => {
        if (!activeHydrologyItem) return;
        const isOn = selectedCols.has(columnId);
        setSelectedCols(prev => {
            const next = new Set(prev);
            if (isOn) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            return next;
        });
        if (isOn) {
            rowData.forEach((_, rowIndex) => {
                if (selectedRows.has(rowIndex)) {
                    updateIdfRowData(activeHydrologyItem.id, rowIndex, columnId, 0);
                }
            });
            refreshChart();
        }
    };

    return (
        <div style={{display: 'flex', flexDirection: flexDirection, boxSizing: 'border-box'}}>
            {/* TASK-1524 — drop the fixed inner height:'600px' (it clipped the
                lower duration rows with no scrollbar); the .sv-idf-matrix-wrapper--input
                modifier below now owns a (max-height + overflow-y:auto) scroll
                region so EVERY duration row stays reachable. */}
            <div style={{padding: '10px', minWidth: '600px', maxWidth: '800px', marginBottom: '60px'}}>
                <h3 style={{marginTop: 0}}>
                    {depthMode
                        ? 'Depth (mm)'
                        : <Message msgId="hydrata.hydrology.intensityMmHr" />}
                </h3>

                {/* Depth↔intensity display toggle (FE-only, no re-derive). Intensity
                    is the canonical EDITABLE mode; Depth is a read-only converted view
                    (depth_mm = intensity × duration/60, per-row). */}
                <div className="sv-idf-matrix-unit-toggle-row" role="group" aria-label="Display unit">
                    <label className="sv-idf-matrix-unit-label" style={{marginRight: 12}}>
                        <input
                            id="idf-input-unit-intensity"
                            type="radio"
                            name="idf-input-unit"
                            checked={!depthMode}
                            onChange={() => setUnitMode('intensity')}
                        />
                        {' '}
                        Intensity (mm/hr)
                    </label>
                    <label className="sv-idf-matrix-unit-label">
                        <input
                            id="idf-input-unit-depth"
                            type="radio"
                            name="idf-input-unit"
                            checked={depthMode}
                            onChange={() => setUnitMode('depth')}
                        />
                        {' '}
                        Depth (mm)
                    </label>
                </div>

                {/* Hours/minutes read-aid — stored durations stay in minutes. */}
                <div className="sv-idf-matrix-unit-toggle-row">
                    <input
                        id="idf-input-show-hours"
                        type="checkbox"
                        checked={showHours}
                        onChange={() => setShowHours(h => !h)}
                    />
                    {' '}
                    <label htmlFor="idf-input-show-hours" className="sv-idf-matrix-unit-label">
                        Display in hours
                    </label>
                </div>

                <div className="sv-idf-matrix-wrapper sv-idf-matrix-wrapper--input">
                    <table className="sv-idf-matrix-table">
                        <thead>
                            <tr>
                                <th className="sv-idf-matrix-corner" />
                                {ARI_COLUMNS.map(col => {
                                    const colSelected = selectedCols.has(col.key);
                                    return (
                                        <th
                                            key={col.key}
                                            className={`sv-idf-matrix-col-header${colSelected ? ' sv-idf-matrix-header--selected' : ''}`}
                                            onClick={depthMode ? undefined : () => toggleCol(col.key)}
                                            style={depthMode ? {cursor: 'default'} : undefined}
                                            title={depthMode
                                                ? `${col.label} ARI (read-only in Depth view — switch to Intensity to edit)`
                                                : `Select the ${col.label} ARI column (a cell is editable only when its row is also selected)`}
                                        >
                                            {col.label}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rowData.map((row, rowIndex) => {
                                const rowSelected = selectedRows.has(rowIndex);
                                return (
                                    <tr key={rowIndex}>
                                        <td
                                            className={`sv-idf-matrix-row-header${rowSelected ? ' sv-idf-matrix-header--selected' : ''}`}
                                            onClick={depthMode ? undefined : () => toggleRow(rowIndex)}
                                            style={depthMode ? {cursor: 'default'} : undefined}
                                            title={depthMode
                                                ? `${formatDuration(row.duration, false)} (read-only in Depth view — switch to Intensity to edit)`
                                                : `Select all return periods for ${formatDuration(row.duration, false)} (a cell is editable only when its column is also selected)`}
                                        >
                                            {formatDuration(row.duration, showHours)}
                                        </td>
                                        {ARI_COLUMNS.map(col => {
                                            const enabled = isEnabled(rowIndex, col.key);
                                            if (!enabled) {
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className="sv-idf-matrix-cell sv-idf-matrix-cell--empty"
                                                        title={`${formatDuration(row.duration, false)} / ${col.label}: select both this duration row and ARI column to enter an intensity (mm/hr)`}
                                                    />
                                                );
                                            }
                                            // Depth view is READ-ONLY: render the per-row converted
                                            // value (intensity × duration/60) as static text, not an
                                            // input, so the rounded depth can never overwrite the
                                            // canonical mm/hr value stored in rowData.
                                            if (depthMode) {
                                                const depthVal = round1(intensityToDepth(row[col.key], row.duration));
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className="sv-idf-matrix-cell sv-idf-matrix-cell--readonly"
                                                        title={`${formatDuration(row.duration, false)} / ${col.label}: ${depthVal} mm (read-only — switch to Intensity to edit)`}
                                                    >
                                                        {depthVal}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={col.key} className="sv-idf-matrix-cell sv-idf-matrix-cell--input">
                                                    <IdfInputCell
                                                        value={row[col.key]}
                                                        onCommit={(raw) => commitCell(rowIndex, col.key, raw)}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div style={{
                width: '100%',
                padding: '10px'
            }}>
                {/* TASK-1553 — the redundant "IDF Curve" <h3> above the self-
                    describing "View IDF curve" button was removed (the button
                    label already names the action). The button responsiveness is
                    unchanged: it is correctly gated by hasValidData (TASK-1526),
                    so it is inert only for an empty/zero table — not a regression. */}
                {/* TASK-1526 — the curve is on-demand: a trigger button gated
                    by hasValidData opens the portal modal over the map. With no
                    valid data the chart is GONE and the button is disabled. */}
                <button
                    type="button"
                    className="btn btn-primary sv-idf-curve-open-btn"
                    disabled={!hasValidData}
                    title={hasValidData
                        ? 'View the IDF curve in a pop-up over the map'
                        : tr('hydrata.hydrology.idfCurveOpenDisabled',
                            'Enter at least one non-zero intensity to view the IDF curve')}
                    onClick={() => setCurveOpen(true)}
                >
                    <Message msgId="hydrata.hydrology.idfCurveOpen" />
                </button>
                {hasValidData && curveOpen ?
                    <IdfCurveModal
                        chartData={chartData}
                        unitMode={unitMode}
                        onClose={() => setCurveOpen(false)}
                        closeLabel={tr('hydrata.hydrology.idfCurveClose', 'Close')}
                    /> :
                    null}
            </div>
        </div>
    );
};

HydrologyDetailIdfTable.propTypes = {
    activeHydrologyItem: PropTypes.object,
    updateIdfRowData: PropTypes.func
};

// Pull intl messages off React legacy context so getMessageById can resolve
// the disabled-curve-button + modal-close labels at render time (mirrors
// Anuga/scenarioHeaderActions).
HydrologyDetailIdfTable.contextTypes = {
    messages: PropTypes.object
};

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateIdfRowData: (idfTableId, rowIndex, columnId, value) => dispatch(updateIdfRowData(idfTableId, rowIndex, columnId, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfTable);
