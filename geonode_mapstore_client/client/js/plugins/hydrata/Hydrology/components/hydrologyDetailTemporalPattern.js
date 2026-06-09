/**
 * TASK-1450 (W3) — Temporal Patterns preset-picker + curve preview +
 * geography suggestion + manual edit (advanced affordance).
 *
 * TASK-1498 (W1):
 *   - Issue 8: Each option now has a visible card border always; stronger
 *     text contrast (#333 title, #555 description).
 *   - Issue 9 + TASK-1459 fold-in: CurvePreview adds an intensity/depth
 *     toggle so the preview shows either the cumulative-depth curve
 *     or the incremental-intensity approximation.
 *   - Issue 10: "recommended" badge removed from Alternating Block render.
 *
 * TASK-1502 (W5):
 *   - Issue 12: Custom temporal pattern widget (table + paste + drag-on-chart).
 *   - Adds 'custom' option to PRESET_FAMILIES.
 *   - CustomPatternEditor: (time-fraction, cumulative-%) editable table +
 *     live preview chart (reused issue-9 LineChart) + paste-from-clipboard +
 *     drag-on-chart.
 *   - Validation: monotonic non-decreasing, starts 0, ends 100%.
 *   - Saves as project-scoped TemporalPattern with pattern_type='custom'.
 *
 * Layout:
 *   ① Geography suggestion banner (if project lat/lon available)
 *   ② Preset picker (radio list of pattern families, carded)
 *   ③ Curve preview (S-curve with labelled axes + intensity/depth toggle)
 *      OR Custom editor (when custom selected)
 *   ④ "Advanced: manual edit" toggle → reveals the existing percentage grid
 *      (only for non-custom patterns)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
// react-bootstrap Tooltip aliased to avoid the recharts `Tooltip` name clash above.
import { OverlayTrigger, Tooltip as BootstrapTooltip } from 'react-bootstrap';
import {
    setActiveHydrologyItem,
    updateTemporalPatternRowData,
    setTemporalPatternPreset,
    replaceTemporalPatternRowData
} from '../actionsHydrology';
import {
    PRESET_FAMILIES,
    ALTERNATING_BLOCK,
    CUSTOM,
    getPreviewCurve,
    suggestPatternFromLatLon,
    getSuggestionLabel
} from '../temporalPatternPresets';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';

// ---------------------------------------------------------------------------
// Manual-edit table (kept as the "advanced" affordance for preset patterns)
// ---------------------------------------------------------------------------

const TableCell = ({getValue, row, column, table}) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    useEffect(() => { setValue(initialValue); }, [initialValue]);
    const onBlur = () => { table.options.meta?.updateData(row.index, column.id, value); };
    return (
        <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            type={column.columnDef.meta?.type || 'text'}
        />
    );
};

TableCell.propTypes = {
    getValue: PropTypes.func.isRequired,
    row: PropTypes.object.isRequired,
    column: PropTypes.object.isRequired,
    table: PropTypes.object.isRequired
};

const columnHelper = createColumnHelper();
const columns = [
    columnHelper.accessor('percentage', {
        cell: TableCell,
        header: () => <span>%</span>,
        meta: { type: 'number' }
    })
];

// ---------------------------------------------------------------------------
// Curve preview component (for preset patterns)
// ---------------------------------------------------------------------------

/**
 * Build approximate incremental-intensity data from the cumulative curve.
 * Uses finite differences on the sampled curve to produce an intensity proxy.
 * @param {{t: number, cum: number}[]} curve
 * @returns {{t: number, intensity: number}[]}
 */
function toIntensityData(curve) {
    if (!curve || curve.length < 2) return [];
    return curve.slice(1).map((pt, i) => {
        const dt = pt.t - curve[i].t;
        return { t: pt.t, intensity: dt > 0 ? (pt.cum - curve[i].cum) / dt : 0 };
    });
}

/** Format a 0-1 fraction as a percentage string, e.g. 0.42 → "42%". */
const pctFmt = (v) => `${Math.round(v * 100)}%`;

/**
 * Renders a cumulative S-curve (or incremental intensity) for a named preset,
 * or a note for alternating-block (which has no fixed dimensionless curve).
 *
 * TASK-1498 (W1 / issue 9 + TASK-1459 fold-in):
 *   - X-axis: "Time (% of duration)"; Y-axis: "Cumulative depth (%)" or
 *     "Intensity (relative)" depending on toggle.
 *   - Intensity/depth toggle present at top of chart area.
 *   - Improved gridline and line contrast consistent with the hyetograph chart.
 */
const CurvePreview = ({ patternKey }) => {
    const [showIntensity, setShowIntensity] = useState(false);
    const curve = getPreviewCurve(patternKey);

    if (patternKey === ALTERNATING_BLOCK || !curve) {
        return (
            <div
                id="temporal-pattern-preview-note"
                style={{
                    padding: '14px 16px',
                    background: '#f7f9fb',
                    border: '1px solid #d0d8e4',
                    borderRadius: '4px',
                    color: '#555',
                    fontSize: '0.875rem',
                    lineHeight: '1.5'
                }}
            >
                <span className="glyphicon glyphicon-info-sign" style={{marginRight: 8, color: '#5178af'}}/>
                <strong>Alternating-Block (IDF-derived)</strong><br/>
                This method does not have a fixed dimensionless curve — it reads
                your site&apos;s IDF at every sub-duration and arranges the intensity
                blocks around the peak. The hyetograph shape is computed at derive
                time from the IDF table you select.
            </div>
        );
    }

    const intensityData = toIntensityData(curve);
    const chartData = showIntensity ? intensityData : curve;
    const dataKey = showIntensity ? 'intensity' : 'cum';
    const yLabel = showIntensity ? 'Intensity (relative)' : 'Cumulative depth (%)';
    const yFormatter = showIntensity ? (v) => v.toFixed(2) : pctFmt;
    const tooltipFormatter = showIntensity
        ? (v) => [`${v.toFixed(3)}`, 'Rel. intensity']
        : (v) => [`${(v * 100).toFixed(1)}%`, 'Cum. depth'];

    return (
        <div id="temporal-pattern-curve-preview">
            {/* Intensity / depth toggle — issue 9 + TASK-1459 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button
                    className={`btn btn-xs ${!showIntensity ? 'btn-primary' : 'btn-default'}`}
                    onClick={() => setShowIntensity(false)}
                    id="preview-toggle-depth"
                    title="Show cumulative depth fraction"
                >
                    Depth
                </button>
                <button
                    className={`btn btn-xs ${showIntensity ? 'btn-primary' : 'btn-default'}`}
                    onClick={() => setShowIntensity(true)}
                    id="preview-toggle-intensity"
                    title="Show approximate incremental intensity"
                >
                    Intensity
                </button>
            </div>
            {/* HTML axis titles — recharts 0.22.4 ignores the axis label prop;
                mirrors the .idf-curve-* / .hyetograph-* pattern. */}
            <div className="temporal-pattern-chart-layout">
                <div className="temporal-pattern-yaxis-title">{yLabel}</div>
                <div className="temporal-pattern-plot-area">
                    <div className="temporal-pattern-plot" style={{ height: 210 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                margin={{ top: 4, right: 16, left: 10, bottom: 4 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#c8d4e0" />
                                <XAxis
                                    dataKey="t"
                                    type="number"
                                    domain={[0, 1]}
                                    tickFormatter={pctFmt}
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    domain={showIntensity ? [0, 'auto'] : [0, 1]}
                                    tickFormatter={yFormatter}
                                    tick={{ fontSize: 11 }}
                                    width={52}
                                />
                                <Tooltip
                                    formatter={tooltipFormatter}
                                    labelFormatter={(t) => `t = ${(t * 100).toFixed(0)}% of duration`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={dataKey}
                                    stroke="#3a6aa8"
                                    dot={false}
                                    strokeWidth={2.5}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="temporal-pattern-xaxis-title">Time (% of duration)</div>
                </div>
            </div>
        </div>
    );
};

CurvePreview.propTypes = {
    patternKey: PropTypes.string
};

// ---------------------------------------------------------------------------
// TASK-1502 (W5) — Custom pattern validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a custom cumulative curve (array of {t, cum} rows).
 * Returns null if valid, or an error message string if invalid.
 * @param {{t: number|string, cum: number|string}[]} rows
 * @returns {string|null}
 */
function validateCustomCurve(rows) {
    if (!rows || rows.length < 2) {
        return 'At least 2 data points are required.';
    }
    const cums = rows.map(r => parseFloat(r.cum));
    const ts = rows.map(r => parseFloat(r.t));
    if (cums.some(isNaN) || ts.some(isNaN)) {
        return 'All values must be valid numbers.';
    }
    if (cums[0] !== 0) {
        return 'Cumulative value at t=0 must be 0.';
    }
    if (cums[cums.length - 1] !== 100) {
        return 'Cumulative value at t=1 must be 100.';
    }
    for (let i = 1; i < cums.length; i++) {
        if (cums[i] < cums[i - 1]) {
            return `Row ${i + 1}: cumulative value (${cums[i]}) is less than previous (${cums[i - 1]}). Curve must be monotonically non-decreasing.`;
        }
    }
    return null;
}

/** Default 11-point empty custom curve (uniform spacing, operator fills in cum values). */
const DEFAULT_CUSTOM_ROWS = [
    {t: 0.0,  cum: 0.0},
    {t: 0.1,  cum: ''},
    {t: 0.2,  cum: ''},
    {t: 0.3,  cum: ''},
    {t: 0.4,  cum: ''},
    {t: 0.5,  cum: ''},
    {t: 0.6,  cum: ''},
    {t: 0.7,  cum: ''},
    {t: 0.8,  cum: ''},
    {t: 0.9,  cum: ''},
    {t: 1.0,  cum: 100.0}
];

// ---------------------------------------------------------------------------
// TASK-1502 (W5) — Custom pattern editor component
// ---------------------------------------------------------------------------

/**
 * Editable (time-fraction, cumulative-%) table with live LineChart preview,
 * paste-from-clipboard, and drag-on-chart interaction.
 *
 * @param {object} props
 * @param {{t:number, cum:number|string}[]} props.rows - current table rows
 * @param {function} props.onChange - called with updated rows array
 */
const CustomPatternEditor = ({ rows, onChange }) => {
    const [dragIdx, setDragIdx] = useState(null);
    const chartRef = useRef(null);
    const [pasteError, setPasteError] = useState(null);

    const validationError = validateCustomCurve(rows);

    // Build chart data from current rows (filter out empty cum values for display)
    const chartData = rows
        .filter(r => r.cum !== '' && !isNaN(parseFloat(r.cum)))
        .map(r => ({t: parseFloat(r.t), cum: parseFloat(r.cum) / 100.0}));

    const handleCellChange = (rowIdx, field, value) => {
        const updated = rows.map((r, i) => i === rowIdx ? {...r, [field]: value} : r);
        onChange(updated);
    };

    const handleAddRow = () => {
        const lastT = rows.length > 0 ? parseFloat(rows[rows.length - 1].t) : 1.0;
        // Insert before the last row (t=1) with a midpoint t
        const secondLastT = rows.length > 1 ? parseFloat(rows[rows.length - 2].t) : 0.9;
        const newT = parseFloat(((secondLastT + lastT) / 2).toFixed(3));
        const newRow = {t: newT, cum: ''};
        const updated = [...rows.slice(0, rows.length - 1), newRow, rows[rows.length - 1]];
        onChange(updated);
    };

    const handleRemoveRow = (rowIdx) => {
        // Never remove first or last row (t=0 and t=1 anchors)
        if (rowIdx === 0 || rowIdx === rows.length - 1) return;
        onChange(rows.filter((_, i) => i !== rowIdx));
    };

    const handleReset = () => {
        onChange(DEFAULT_CUSTOM_ROWS.map(r => ({...r})));
    };

    const handlePaste = async() => {
        setPasteError(null);
        try {
            const text = await navigator.clipboard.readText();
            const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
            const parsed = lines.map(line => {
                const parts = line.split(/[\t,\s]+/).filter(p => p.trim());
                if (parts.length < 2) return null;
                const t = parseFloat(parts[0]);
                const cum = parseFloat(parts[1]);
                if (isNaN(t) || isNaN(cum)) return null;
                return {t: parseFloat(t.toFixed(4)), cum: parseFloat(cum.toFixed(4))};
            }).filter(Boolean);
            if (parsed.length < 2) {
                setPasteError('Could not parse clipboard data. Expected two columns: time-fraction and cumulative-%. Separate with tab, comma, or space.');
                return;
            }
            onChange(parsed);
        } catch {
            setPasteError('Clipboard access denied. Please allow clipboard permissions or type values directly.');
        }
    };

    // Drag-on-chart: track mouse position relative to the chart to find the
    // closest data point and update its cum value.
    const handleChartMouseDown = useCallback((e) => {
        if (!e || !e.activePayload || !e.activePayload.length) return;
        const activeT = e.activeLabel;
        // Find the closest row index by t value
        let closestIdx = 0;
        let closestDist = Infinity;
        rows.forEach((r, i) => {
            const dist = Math.abs(parseFloat(r.t) - activeT);
            if (dist < closestDist) { closestDist = dist; closestIdx = i; }
        });
        setDragIdx(closestIdx);
    }, [rows]);

    const handleChartMouseMove = useCallback((e) => {
        if (dragIdx === null || !e || e.activeCoordinate === undefined) return;
        if (!e.yAxisMap) return;
        // Get the y-axis domain to map chart coordinate → cum value
        const yAxis = Object.values(e.yAxisMap)[0];
        if (!yAxis || !yAxis.height || !yAxis.domain) return;
        const chartY = e.activeCoordinate.y;
        // Invert: chart top = domain[1] (1.0), chart bottom = domain[0] (0.0)
        const fraction = (yAxis.y + yAxis.height - chartY) / yAxis.height;
        const newCum = Math.max(0, Math.min(100, parseFloat((fraction * 100).toFixed(1))));
        const updated = rows.map((r, i) => i === dragIdx ? {...r, cum: newCum} : r);
        onChange(updated);
    }, [dragIdx, rows, onChange]);

    const handleChartMouseUp = useCallback(() => {
        setDragIdx(null);
    }, []);

    return (
        <div id="custom-pattern-editor" style={{ marginTop: 8 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                    Custom Cumulative Curve
                </span>
                <span style={{ fontSize: '0.78rem', color: '#888' }}>
                    (time-fraction 0→1, cumulative-% 0→100)
                </span>
            </div>

            {/* Validation error */}
            {validationError && (
                <div
                    id="custom-pattern-validation-error"
                    style={{
                        padding: '6px 10px',
                        background: '#fff0f0',
                        border: '1px solid #e8b4b4',
                        borderRadius: 4,
                        color: '#a33',
                        fontSize: '0.8rem',
                        marginBottom: 8
                    }}
                >
                    <span className="glyphicon glyphicon-warning-sign" style={{marginRight: 6}}/>
                    {validationError}
                </div>
            )}
            {pasteError && (
                <div style={{ padding: '6px 10px', background: '#fff8e0', border: '1px solid #e8d084', borderRadius: 4, color: '#856', fontSize: '0.8rem', marginBottom: 8 }}>
                    {pasteError}
                </div>
            )}

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Left: editable table */}
                <div style={{ flex: '0 0 220px' }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                        <button
                            id="custom-pattern-paste"
                            className="btn btn-xs btn-default"
                            onClick={handlePaste}
                            title="Paste two-column (t, cum%) data from clipboard"
                        >
                            <span className="glyphicon glyphicon-paste" style={{marginRight: 4}}/>
                            Paste CSV
                        </button>
                        <button
                            id="custom-pattern-reset"
                            className="btn btn-xs btn-default"
                            onClick={handleReset}
                            title="Reset to blank 11-point template"
                        >
                            Reset
                        </button>
                    </div>
                    <table
                        id="custom-pattern-table"
                        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}
                    >
                        <thead>
                            <tr style={{ background: '#f0f4f8' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left', borderBottom: '1px solid #d0d8e4' }}>t (0–1)</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left', borderBottom: '1px solid #d0d8e4' }}>cum (%)</th>
                                <th style={{ padding: '3px 6px', borderBottom: '1px solid #d0d8e4' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '2px 4px' }}>
                                        <input
                                            type="number"
                                            min="0" max="1" step="0.01"
                                            value={row.t}
                                            readOnly={i === 0 || i === rows.length - 1}
                                            onChange={e => handleCellChange(i, 't', e.target.value)}
                                            style={{ width: 64, fontSize: '0.8rem', padding: '1px 4px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '2px 4px' }}>
                                        <input
                                            type="number"
                                            min="0" max="100" step="0.1"
                                            value={row.cum}
                                            readOnly={i === 0 || i === rows.length - 1}
                                            onChange={e => handleCellChange(i, 'cum', e.target.value)}
                                            style={{ width: 64, fontSize: '0.8rem', padding: '1px 4px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                        {i !== 0 && i !== rows.length - 1 && (
                                            <button
                                                className="btn btn-xs btn-default"
                                                onClick={() => handleRemoveRow(i)}
                                                title="Remove row"
                                                style={{ padding: '0 4px', lineHeight: '1.4' }}
                                            >
                                                <span className="glyphicon glyphicon-minus" style={{ fontSize: '0.7rem' }}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        id="custom-pattern-add-row"
                        className="btn btn-xs btn-default"
                        style={{ marginTop: 4 }}
                        onClick={handleAddRow}
                    >
                        <span className="glyphicon glyphicon-plus" style={{ marginRight: 4, fontSize: '0.7rem' }}/>
                        Add row
                    </button>
                </div>

                {/* Right: live preview chart */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4 }}>
                        Live preview — drag a point to adjust
                    </div>
                    <div
                        id="temporal-pattern-curve-preview"
                        ref={chartRef}
                    >
                        {/* HTML axis titles — recharts 0.22.4 ignores the axis label prop;
                            mirrors the .idf-curve-* / .hyetograph-* pattern. */}
                        <div className="temporal-pattern-chart-layout">
                            <div className="temporal-pattern-yaxis-title">Cumulative depth (%)</div>
                            <div className="temporal-pattern-plot-area">
                                <div className="temporal-pattern-plot" style={{ height: 220 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={chartData}
                                            margin={{ top: 4, right: 16, left: 10, bottom: 4 }}
                                            onMouseDown={handleChartMouseDown}
                                            onMouseMove={dragIdx !== null ? handleChartMouseMove : undefined}
                                            onMouseUp={handleChartMouseUp}
                                            onMouseLeave={handleChartMouseUp}
                                            style={{ cursor: dragIdx !== null ? 'ns-resize' : 'crosshair' }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#c8d4e0" />
                                            <XAxis
                                                dataKey="t"
                                                type="number"
                                                domain={[0, 1]}
                                                tickFormatter={pctFmt}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis
                                                domain={[0, 1]}
                                                tickFormatter={pctFmt}
                                                tick={{ fontSize: 11 }}
                                                width={52}
                                            />
                                            <Tooltip
                                                formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Cum. depth']}
                                                labelFormatter={(t) => `t = ${(t * 100).toFixed(0)}% of duration`}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cum"
                                                stroke="#3a6aa8"
                                                strokeWidth={2.5}
                                                dot={{ r: 5, fill: '#3a6aa8', strokeWidth: 0, cursor: 'ns-resize' }}
                                                isAnimationActive={false}
                                                activeDot={{ r: 7, fill: '#1a4a88' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="temporal-pattern-xaxis-title">Time (% of duration)</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 2, textAlign: 'right' }}>
                        {validationError ? (
                            <span style={{ color: '#c44' }}>Fix errors above before saving.</span>
                        ) : (
                            <span style={{ color: '#4a8' }}>
                                <span className="glyphicon glyphicon-ok" style={{ marginRight: 4 }}/>
                                Valid curve — ready to save.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

CustomPatternEditor.propTypes = {
    rows: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired
};

// ---------------------------------------------------------------------------
// Geography suggestion banner
// ---------------------------------------------------------------------------

const SuggestionBanner = ({ suggestedKey, selectedKey, onAccept }) => {
    if (!suggestedKey) return null;
    const label = getSuggestionLabel(suggestedKey);
    const alreadySelected = selectedKey === suggestedKey;
    return (
        <div
            id="temporal-pattern-suggestion"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: '#edf4fd',
                border: '1px solid #b8d0ef',
                borderRadius: '4px',
                marginBottom: 12,
                fontSize: '0.875rem'
            }}
        >
            <span className="glyphicon glyphicon-map-marker" style={{ color: '#5178af' }}/>
            <span>
                Based on your project location: <strong>{label}</strong> is recommended.
            </span>
            {!alreadySelected && (
                <button
                    id="temporal-pattern-accept-suggestion"
                    className="btn btn-xs btn-primary"
                    style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                    onClick={() => onAccept(suggestedKey)}
                >
                    Use this
                </button>
            )}
            {alreadySelected && (
                <span style={{ marginLeft: 'auto', color: '#5178af', fontSize: '0.8rem' }}>
                    ✓ selected
                </span>
            )}
        </div>
    );
};

SuggestionBanner.propTypes = {
    suggestedKey: PropTypes.string,
    selectedKey: PropTypes.string,
    onAccept: PropTypes.func
};

// ---------------------------------------------------------------------------
// Preset picker radio list
// ---------------------------------------------------------------------------

// TASK-1498 (W1):
//   Issue 8: Each option always has a visible card border (#d0d8e4); selected
//   state uses blue border + light-blue background. Text uses #333 title /
//   #555 description for readable contrast (was #666 — too low contrast).
//   Issue 10: "recommended" badge removed entirely (isMethod flag no longer
//   renders a badge — "(Default)" in the label text is sufficient).
const PresetPicker = ({ selectedKey, onChange }) => (
    <div id="temporal-pattern-preset-picker" style={{ marginBottom: 16 }}>
        {PRESET_FAMILIES.map(family => (
            <label
                key={family.id}
                id={`preset-option-${family.id}`}
                className={`hydrology-preset-card${selectedKey === family.id ? ' is-selected' : ''}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    marginBottom: 6,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: selectedKey === family.id ? '#edf4fd' : '#fafcfe',
                    border: selectedKey === family.id
                        ? '1.5px solid #5178af'
                        : '1px solid #c8d4e0',
                    transition: 'background 0.12s, border-color 0.12s'
                }}
            >
                <input
                    type="radio"
                    name="temporal-pattern-preset"
                    value={family.id}
                    checked={selectedKey === family.id}
                    onChange={() => onChange(family.id)}
                    style={{ flexShrink: 0 }}
                />
                {/* TASK-1529: description demoted from an inline div to a hover
                    tooltip on a small info icon, leaving a clean one-line label.
                    OverlayTrigger gives the discoverable hover tooltip; the
                    native `title` is the fallback (and the deterministic test
                    hook). The icon lives inside the <label>, so clicking it
                    still selects the radio — it never swallows the radio click. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                        {family.label}
                    </span>
                    <OverlayTrigger
                        placement="right"
                        trigger={['hover', 'focus']}
                        overlay={
                            <BootstrapTooltip id={`preset-tooltip-${family.id}`}>
                                {family.description}
                            </BootstrapTooltip>
                        }
                    >
                        {/* TASK-1555 — the description was hover-only on a non-
                            focusable <span>, so it never surfaced for keyboard
                            users (and was easy to miss). Make the info icon
                            focusable (tabIndex + aria-label) and trigger the
                            tooltip on hover AND focus. */}
                        <span
                            className="hydrology-preset-info glyphicon glyphicon-info-sign"
                            title={family.description}
                            tabIndex={0}
                            role="img"
                            aria-label={family.description}
                            style={{ color: '#5178af', fontSize: '0.85rem', cursor: 'help', flexShrink: 0 }}
                        />
                    </OverlayTrigger>
                </div>
            </label>
        ))}
    </div>
);

PresetPicker.propTypes = {
    selectedKey: PropTypes.string,
    onChange: PropTypes.func.isRequired
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-shadow -- prop intentionally named after the action creator
const HydrologyTemporalPattern = ({
    activeHydrologyItem,
    updateTemporalPatternRowData: dispatchUpdateRowData,
    setTemporalPatternPreset: dispatchSetPreset,
    replaceTemporalPatternRowData: dispatchReplaceRowData,
    projectLat,
    projectLon
}) => {
    // Derive the suggested pattern from the project location (null = everywhere → alternating-block default)
    const locationSuggestion = suggestPatternFromLatLon(projectLat, projectLon);
    const suggestedKey = locationSuggestion !== ALTERNATING_BLOCK ? locationSuggestion : null;

    // Selected preset key — start from item.selectedPreset or alternating-block default.
    const [selectedKey, setSelectedKey] = useState(
        activeHydrologyItem?.selectedPreset || ALTERNATING_BLOCK
    );
    const [showManualEdit, setShowManualEdit] = useState(false);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData || []);

    // TASK-1502 (W5): custom curve rows — separate from the preset rowData.
    // Initialised from activeHydrologyItem.rowData if pattern_type='custom',
    // otherwise from a blank template.
    const initCustomRows = useCallback(() => {
        if (activeHydrologyItem?.pattern_type === 'custom' && activeHydrologyItem?.rowData?.length) {
            return activeHydrologyItem.rowData;
        }
        return DEFAULT_CUSTOM_ROWS.map(r => ({...r}));
    }, [activeHydrologyItem]);

    const [customRows, setCustomRows] = useState(initCustomRows);

    useEffect(() => {
        setRowData(activeHydrologyItem?.rowData || []);
        // TASK-1451 carry-over B: always reset selectedKey on item switch.
        // Without the else branch, switching to an item without selectedPreset
        // showed the previous item's key (stale state bug).
        if (activeHydrologyItem?.selectedPreset) {
            setSelectedKey(activeHydrologyItem.selectedPreset);
        } else if (activeHydrologyItem?.pattern_type === 'custom') {
            // TASK-1502: a saved custom pattern — restore the custom key.
            setSelectedKey(CUSTOM);
        } else {
            setSelectedKey(ALTERNATING_BLOCK);
        }
        // Re-init custom rows from the item if it is a custom pattern.
        if (activeHydrologyItem?.pattern_type === 'custom' && activeHydrologyItem?.rowData?.length) {
            setCustomRows(activeHydrologyItem.rowData);
        } else {
            setCustomRows(DEFAULT_CUSTOM_ROWS.map(r => ({...r})));
        }
    }, [activeHydrologyItem]);

    const handlePresetChange = (key) => {
        setSelectedKey(key);
        if (dispatchSetPreset && activeHydrologyItem) {
            dispatchSetPreset(activeHydrologyItem.id, key);
        }
    };

    // TASK-1502 (W5): when the custom curve changes, update the item's data
    // directly (bypass the legacy percentage-grid action).
    const handleCustomRowsChange = useCallback((newRows) => {
        setCustomRows(newRows);
        // TASK-1508 (W5 follow-up): commit the custom rows through Redux — the
        // reducer sets rowData + pattern_type='custom' + unsaved on the pattern
        // item — instead of mutating activeHydrologyItem directly. The existing
        // saveHydrologyItem epic then reads reducer-managed state (the store's
        // activeHydrologyItem) when building the PATCH payload.
        if (activeHydrologyItem && dispatchReplaceRowData) {
            dispatchReplaceRowData(activeHydrologyItem.id, newRows);
        }
    }, [activeHydrologyItem, dispatchReplaceRowData]);

    const table = useReactTable({
        columns,
        data: rowData,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                if (activeHydrologyItem) {
                    dispatchUpdateRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                }
            }
        }
    });

    const isCustom = selectedKey === CUSTOM;
    const customValidationError = isCustom ? validateCustomCurve(customRows) : null;

    return (
        <div
            id="temporal-pattern-detail"
            style={{ padding: '12px 16px', boxSizing: 'border-box', maxWidth: 700 }}
        >
            {/* ① Geography suggestion */}
            <SuggestionBanner
                suggestedKey={suggestedKey}
                selectedKey={selectedKey}
                onAccept={handlePresetChange}
            />

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* ② Preset picker */}
                <div style={{ flex: '0 0 340px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: '0.95rem', fontWeight: 700 }}>
                        Temporal Pattern
                    </h4>
                    <PresetPicker selectedKey={selectedKey} onChange={handlePresetChange} />
                </div>

                {/* ③ Curve preview OR Custom editor */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: '0.95rem', fontWeight: 700 }}>
                        {isCustom ? 'Custom Curve Editor' : 'Cumulative distribution preview'}
                    </h4>
                    {isCustom ? (
                        <CustomPatternEditor
                            rows={customRows}
                            onChange={handleCustomRowsChange}
                        />
                    ) : (
                        <CurvePreview patternKey={selectedKey} />
                    )}
                </div>
            </div>

            {/* TASK-1502: custom pattern save note */}
            {isCustom && (
                <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#666', borderTop: '1px solid #e0e6ed', paddingTop: 8 }}>
                    <span className="glyphicon glyphicon-info-sign" style={{ marginRight: 6, color: '#5178af' }}/>
                    This pattern will be saved as a project-scoped custom temporal pattern
                    {customValidationError ? (
                        <strong style={{ color: '#a33' }}> — fix validation errors to enable save.</strong>
                    ) : (
                        <strong style={{ color: '#4a8' }}> — curve is valid.</strong>
                    )}
                </div>
            )}

            {/* ④ Advanced: manual edit toggle (only for non-custom patterns) */}
            {!isCustom && (
                <div style={{ marginTop: 12, borderTop: '1px solid #e0e6ed', paddingTop: 10 }}>
                    <button
                        id="temporal-pattern-advanced-toggle"
                        className="btn btn-xs btn-default"
                        onClick={() => setShowManualEdit(!showManualEdit)}
                        style={{ fontSize: '0.8rem' }}
                    >
                        <span
                            className={`glyphicon ${showManualEdit ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`}
                            style={{ marginRight: 6 }}
                        />
                        {showManualEdit ? 'Hide manual edit' : 'Advanced: edit percentage grid'}
                    </button>

                    {showManualEdit && (
                        <div
                            id="temporal-pattern-manual-edit"
                            style={{ marginTop: 10, overflowY: 'auto', maxHeight: 320 }}
                        >
                            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>
                                Manual overrides apply only to project-owned patterns. Global presets
                                are read-only.
                            </p>
                            <table className="temporal-pattern-table">
                                <thead>
                                    {table.getHeaderGroups().map(hg => (
                                        <tr key={hg.id}>
                                            {hg.headers.map(h => (
                                                <th key={h.id}>
                                                    {h.isPlaceholder ? null : flexRender(
                                                        h.column.columnDef.header, h.getContext()
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {table.getRowModel().rows.map(row => (
                                        <tr key={row.id}>
                                            {row.getVisibleCells().map(cell => (
                                                <td key={cell.id}>
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

HydrologyTemporalPattern.propTypes = {
    activeHydrologyItem: PropTypes.object,
    updateTemporalPatternRowData: PropTypes.func,
    setTemporalPatternPreset: PropTypes.func,
    replaceTemporalPatternRowData: PropTypes.func,
    projectLat: PropTypes.number,
    projectLon: PropTypes.number
};

const mapStateToProps = (state) => ({
    activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
    activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
    // TASK-1451 carry-over A: the anuga project API exposes 'projection' but
    // NOT lat/lon, so state.anuga.projects.data.latitude is always undefined.
    // Use the IDF-derive pin location (set when the user picks a point for IDF
    // derivation) as the geography source — this is the best available proxy
    // for the project location in the combine flow.
    projectLat: state?.hydrology?.idfDerive?.lat ?? null,
    projectLon: state?.hydrology?.idfDerive?.lon ?? null
});

const mapDispatchToProps = (dispatch) => ({
    setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
    updateTemporalPatternRowData: (id, rowIndex, columnId, value) =>
        dispatch(updateTemporalPatternRowData(id, rowIndex, columnId, value)),
    setTemporalPatternPreset: (id, key) =>
        dispatch(setTemporalPatternPreset(id, key)),
    replaceTemporalPatternRowData: (id, newRowData) =>
        dispatch(replaceTemporalPatternRowData(id, newRowData))
});

// validateCustomCurve is exported (TASK-1509) so the list/detail container can
// reuse the SAME validation to disable its Save button when a custom curve is
// invalid — single source of truth for "is this custom curve saveable".
export { HydrologyTemporalPattern as HydrologyTemporalPatternClass, validateCustomCurve };
export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTemporalPattern);
