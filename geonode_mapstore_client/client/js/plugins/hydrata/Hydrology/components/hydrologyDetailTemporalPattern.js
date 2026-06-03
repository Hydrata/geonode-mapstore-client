/**
 * TASK-1450 (W3) — Temporal Patterns preset-picker + curve preview +
 * geography suggestion + manual edit (advanced affordance).
 *
 * Replaces the raw single-column percentage-grid editor with a guided
 * PRESET PICKER over the W2 design-storm pattern library.
 *
 * Layout:
 *   ① Geography suggestion banner (if project lat/lon available)
 *   ② Preset picker (radio list of pattern families)
 *   ③ Curve preview (S-curve for presets; "computed from IDF" note for
 *      alternating-block which has no fixed dimensionless curve)
 *   ④ "Advanced: manual edit" toggle → reveals the existing percentage grid
 */
import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTemporalPatternRowData,
    setTemporalPatternPreset
} from '../actionsHydrology';
import {
    PRESET_FAMILIES,
    ALTERNATING_BLOCK,
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
// Manual-edit table (kept as the "advanced" affordance)
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
// Curve preview component
// ---------------------------------------------------------------------------

/**
 * Renders a cumulative S-curve for a named preset, or a note for
 * alternating-block (which has no fixed dimensionless curve).
 */
const CurvePreview = ({ patternKey }) => {
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

    return (
        <div style={{ width: '100%', height: 220 }} id="temporal-pattern-curve-preview">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={curve}
                    margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="t"
                        type="number"
                        domain={[0, 1]}
                        tickFormatter={v => `${Math.round(v * 100)}%`}
                        label={{
                            value: 'Fraction of duration',
                            position: 'insideBottom',
                            offset: -12,
                            fontSize: 11
                        }}
                    />
                    <YAxis
                        domain={[0, 1]}
                        tickFormatter={v => `${Math.round(v * 100)}%`}
                        label={{
                            value: 'Cum. depth fraction',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 10,
                            fontSize: 11
                        }}
                    />
                    <Tooltip
                        formatter={(v) => [`${(v * 100).toFixed(1)}%`]}
                        labelFormatter={(t) => `t = ${(t * 100).toFixed(0)}% of duration`}
                    />
                    <Line
                        type="monotone"
                        dataKey="cum"
                        stroke="#5178af"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

CurvePreview.propTypes = {
    patternKey: PropTypes.string
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

const PresetPicker = ({ selectedKey, onChange }) => (
    <div id="temporal-pattern-preset-picker" style={{ marginBottom: 16 }}>
        {PRESET_FAMILIES.map(family => (
            <label
                key={family.id}
                id={`preset-option-${family.id}`}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 10px',
                    marginBottom: 4,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: selectedKey === family.id ? '#edf4fd' : 'transparent',
                    border: selectedKey === family.id ? '1px solid #b8d0ef' : '1px solid transparent',
                    transition: 'background 0.15s'
                }}
            >
                <input
                    type="radio"
                    name="temporal-pattern-preset"
                    value={family.id}
                    checked={selectedKey === family.id}
                    onChange={() => onChange(family.id)}
                    style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {family.label}
                        {family.isMethod && (
                            <span
                                style={{
                                    marginLeft: 8,
                                    padding: '1px 6px',
                                    background: '#5178af',
                                    color: '#fff',
                                    borderRadius: 3,
                                    fontSize: '0.75rem',
                                    fontWeight: 'normal'
                                }}
                            >
                                recommended
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
                        {family.description}
                    </div>
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

    useEffect(() => {
        setRowData(activeHydrologyItem?.rowData || []);
        if (activeHydrologyItem?.selectedPreset) {
            setSelectedKey(activeHydrologyItem.selectedPreset);
        }
    }, [activeHydrologyItem]);

    const handlePresetChange = (key) => {
        setSelectedKey(key);
        if (dispatchSetPreset && activeHydrologyItem) {
            dispatchSetPreset(activeHydrologyItem.id, key);
        }
    };

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

                {/* ③ Curve preview */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: '0.95rem', fontWeight: 700 }}>
                        Cumulative distribution preview
                    </h4>
                    <CurvePreview patternKey={selectedKey} />
                </div>
            </div>

            {/* ④ Advanced: manual edit toggle */}
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
        </div>
    );
};

HydrologyTemporalPattern.propTypes = {
    activeHydrologyItem: PropTypes.object,
    updateTemporalPatternRowData: PropTypes.func,
    setTemporalPatternPreset: PropTypes.func,
    projectLat: PropTypes.number,
    projectLon: PropTypes.number
};

const mapStateToProps = (state) => ({
    activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
    activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
    // Project lat/lon from the anuga project record (set by GeoNode centroid)
    projectLat: state?.anuga?.projects?.data?.latitude ?? null,
    projectLon: state?.anuga?.projects?.data?.longitude ?? null
});

const mapDispatchToProps = (dispatch) => ({
    setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
    updateTemporalPatternRowData: (id, rowIndex, columnId, value) =>
        dispatch(updateTemporalPatternRowData(id, rowIndex, columnId, value)),
    setTemporalPatternPreset: (id, key) =>
        dispatch(setTemporalPatternPreset(id, key))
});

export { HydrologyTemporalPattern as HydrologyTemporalPatternClass };
export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTemporalPattern);
