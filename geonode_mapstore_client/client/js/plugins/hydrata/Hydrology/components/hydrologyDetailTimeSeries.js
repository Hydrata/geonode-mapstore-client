/**
 * TASK-1451 (W4) — Timeseries rail item: design-storm COMBINE surface.
 *
 * Layout:
 *   ① Design-storm combine panel:
 *      - IDF table picker (from project's idf-tables list)
 *      - Temporal pattern picker (preset families)
 *      - AEP / return-period input
 *      - Duration (min)
 *      - Timestep (min)          [alternating-block shows peak-position too]
 *      - Optional name
 *      - "Derive" button → POST derive-design-storm → bar-chart preview
 *   ② Bar-chart hyetograph preview (result from derive)
 *   ③ Manual paste-grid fallback (below, collapsible)
 *
 * Carry-over C (W3 deferred): the derive payload maps FE `patternKey` to the
 * BE field name `pattern` inside deriveDesignStormEpic — never sends a
 * `selectedPreset` string to the BE so provenance persists/restores correctly.
 */
import React, {useState, useEffect, useRef} from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTimeSeriesRowData,
    replaceTimeSeriesRowData,
    deriveDesignStormRequest,
    setDesignStormForm
} from '../actionsHydrology';
import {PRESET_FAMILIES, ALTERNATING_BLOCK} from '../temporalPatternPresets';

import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import moment from 'moment';
import Message from '@mapstore/framework/components/I18N/Message';

// ---------------------------------------------------------------------------
// Manual-edit table cell
// ---------------------------------------------------------------------------

const TableCell = ({getValue, row, column, table}) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, value);
    };
    let inputType = column.columnDef.meta?.type || 'text';
    let displayValue = value;

    if (inputType === 'datetime') {
        displayValue = moment(value).format('YYYY-MM-DD HH:mm:ss');
    }

    return (
        <input
            value={displayValue}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            type={inputType}
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
    columnHelper.accessor('timestamp', {
        cell: TableCell,
        header: () => <span><Message msgId="hydrata.hydrology.timestamp" /></span>,
        meta: {
            type: 'datetime-local'
        }
    }),
    columnHelper.accessor('value', {
        cell: TableCell,
        header: () => <span>Flow (m3/s) or<br/>Rainfall (mm/hr)</span>,
        meta: {
            type: 'number'
        }
    })
];

// ---------------------------------------------------------------------------
// Hyetograph bar chart (incremental depth per timestep)
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

const HyetographChart = ({rowData, timestepMin}) => {
    const chartData = rowDataToHyetograph(rowData);
    if (!chartData.length) return null;
    // Convert mm/hr intensity × (timestep/60) = mm depth per interval for total
    const ts = timestepMin || 6;
    const totalDepth = chartData.reduce((s, d) => s + d.intensity * (ts / 60), 0).toFixed(1);
    return (
        <div style={{marginTop: 8}} id="design-storm-hyetograph">
            <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 4}}>
                Estimated total depth: <strong>{totalDepth} mm</strong>
                <span style={{marginLeft: 8, color: '#888', fontSize: '0.8rem'}}>
                    (Y-axis: mm/hr intensity)
                </span>
            </p>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart
                    data={chartData}
                    margin={{top: 10, right: 20, left: 50, bottom: 60}}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="label"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{fontSize: 10}}
                    />
                    <YAxis
                        label={{
                            value: 'Intensity (mm/hr)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 10,
                            fontSize: 11
                        }}
                    />
                    <Tooltip formatter={(v) => [`${v.toFixed(2)} mm/hr`, 'Intensity']} />
                    <Bar dataKey="intensity" fill="#5178af" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

HyetographChart.propTypes = {
    rowData: PropTypes.array,
    timestepMin: PropTypes.number
};

// ---------------------------------------------------------------------------
// Design-storm combine form
// ---------------------------------------------------------------------------

const DesignStormForm = ({
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

    return (
        <div
            id="design-storm-form"
            style={{
                padding: '12px 16px',
                background: '#f7f9fb',
                border: '1px solid #d0d8e4',
                borderRadius: 4,
                maxWidth: 700,
                marginBottom: 16
            }}
        >
            <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '0.95rem', fontWeight: 700}}>
                Design Storm
            </h4>

            {/* IDF Table picker */}
            <div style={{marginBottom: 10}}>
                <label
                    htmlFor="ds-idf-table"
                    style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                >
                    IDF Table
                </label>
                <select
                    id="ds-idf-table"
                    className="hydrology-text-input"
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
                    style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                >
                    Temporal Pattern
                </label>
                <select
                    id="ds-pattern"
                    className="hydrology-text-input"
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
                        style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                    >
                        AEP (%)
                        <span style={{fontWeight: 'normal', marginLeft: 4, color: '#777', fontSize: '0.8rem'}}>
                            e.g. 1 = 1-in-100
                        </span>
                    </label>
                    <input
                        id="ds-aep"
                        type="number"
                        className="hydrology-text-input"
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
                        style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                    >
                        ARI (years)
                        <span style={{fontWeight: 'normal', marginLeft: 4, color: '#777', fontSize: '0.8rem'}}>
                            e.g. 100
                        </span>
                    </label>
                    <input
                        id="ds-ari"
                        type="number"
                        className="hydrology-text-input"
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
                        style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                    >
                        Duration (min)
                    </label>
                    <input
                        id="ds-duration"
                        type="number"
                        className="hydrology-text-input"
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
                        style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                    >
                        Timestep (min)
                    </label>
                    <input
                        id="ds-timestep"
                        type="number"
                        className="hydrology-text-input"
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
                        style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                    >
                        Peak position (0–1)
                        <span style={{fontWeight: 'normal', marginLeft: 4, color: '#777', fontSize: '0.8rem'}}>
                            0.5 = centre, 0.33 = early peak
                        </span>
                    </label>
                    <input
                        id="ds-peak-position"
                        type="number"
                        className="hydrology-text-input"
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
                    style={{display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 3}}
                >
                    Name <span style={{fontWeight: 'normal', color: '#777'}}>(optional — auto-generated if blank)</span>
                </label>
                <input
                    id="ds-name"
                    type="text"
                    className="hydrology-text-input"
                    style={{width: '100%'}}
                    value={name}
                    onChange={e => onFieldChange('name', e.target.value)}
                />
            </div>

            {/* Error */}
            {error && (
                <div
                    id="design-storm-error"
                    style={{
                        marginBottom: 10,
                        padding: '6px 10px',
                        background: '#fdf0f0',
                        border: '1px solid #f5c6cb',
                        borderRadius: 3,
                        color: '#c0392b',
                        fontSize: '0.85rem'
                    }}
                >
                    {error}
                </div>
            )}

            {/* Derive button */}
            <button
                id="design-storm-derive-btn"
                className="btn btn-primary"
                style={{width: '100%'}}
                disabled={!canDerive}
                onClick={onDerive}
            >
                {inFlight
                    ? <span><span className="glyphicon glyphicon-refresh" style={{marginRight: 6}} />Deriving…</span>
                    : 'Derive Design Storm'}
            </button>
        </div>
    );
};

DesignStormForm.propTypes = {
    idfTables: PropTypes.array,
    designStorm: PropTypes.object,
    onFieldChange: PropTypes.func.isRequired,
    onDerive: PropTypes.func.isRequired
};

// ---------------------------------------------------------------------------
// Main HydrologyTimeSeries component
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-shadow -- props intentionally named after action creators (mapDispatchToProps shorthand)
const HydrologyTimeSeries = ({
    activeHydrologyItem,
    idfTables,
    designStorm,
    replaceTimeSeriesRowData: dispatchReplaceRowData,
    updateTimeSeriesRowData: dispatchUpdateRowData,
    deriveDesignStormRequest: dispatchDerive,
    setDesignStormForm: dispatchSetForm
}) => {
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());
    const [showManualGrid, setShowManualGrid] = useState(false);

    const parsePastedData = (pastedData) => {
        return pastedData.split('\n')
            .filter(row => row.trim() !== '')
            .map((row) => {
                const [timestampStr, valueStr] = row.split('\t');
                const isoTimestampStr = moment(timestampStr, 'YYYY-MM-DD HH:mm').toISOString().slice(0, -1);
                const value = parseFloat(valueStr);
                return { timestamp: isoTimestampStr, value: value };
            });
    };

    const pasteDivRef = useRef();

    useEffect(() => {
        const handlePaste = (event) => {
            let paste = event.clipboardData || window.clipboardData;
            if (paste) {
                let pastedData = paste.getData('text');
                let newRowData = parsePastedData(pastedData);
                dispatchReplaceRowData(activeHydrologyItem.id, newRowData);
                setChartData(activeHydrologyItem?.getChartData());
                setRowData(newRowData);
            }
        };

        const pasteDiv = pasteDivRef.current;
        if (pasteDiv) {
            pasteDiv.addEventListener('paste', handlePaste);
        }

        return () => {
            if (pasteDiv) {
                pasteDiv.removeEventListener('paste', handlePaste);
            }
        };
    }, [activeHydrologyItem]);

    useEffect(() => {
        setColumnDefs(activeHydrologyItem?.columnDefs);
        setRowData(activeHydrologyItem?.rowData);
        setChartData(activeHydrologyItem?.getChartData());
    }, [activeHydrologyItem, rowData, columnDefs]);

    const table = useReactTable({
        columns: columns,
        data: rowData || [],
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                dispatchUpdateRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                setChartData(activeHydrologyItem?.getChartData());
            }
        }
    });

    const handleFieldChange = (field, value) => {
        dispatchSetForm({[field]: value});
    };

    const handleDerive = () => {
        dispatchDerive(designStorm);
    };

    // The derived result's rowData for the hyetograph preview.
    const derivedRowData = designStorm?.result?.data?.rowData || null;

    return (
        <React.Fragment>
            {/* ① Design-storm combine panel */}
            <DesignStormForm
                idfTables={idfTables}
                designStorm={designStorm}
                onFieldChange={handleFieldChange}
                onDerive={handleDerive}
            />

            {/* ② Hyetograph preview — shown after a successful derive */}
            {derivedRowData && derivedRowData.length > 0 && (
                <div
                    id="design-storm-preview"
                    style={{
                        maxWidth: 700,
                        padding: '12px 16px',
                        background: '#fff',
                        border: '1px solid #d0d8e4',
                        borderRadius: 4,
                        marginBottom: 16
                    }}
                >
                    <h4 style={{marginTop: 0, marginBottom: 4, fontSize: '0.95rem', fontWeight: 700}}>
                        Hyetograph Preview
                    </h4>
                    {designStorm.result.name && (
                        <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 0}}>
                            Saved as: <strong>{designStorm.result.name}</strong>
                            {designStorm.result.source && (
                                <span style={{marginLeft: 8, color: '#888', fontSize: '0.8rem'}}>
                                    ({designStorm.result.source})
                                </span>
                            )}
                        </p>
                    )}
                    <HyetographChart rowData={derivedRowData} timestepMin={designStorm?.timestepMin} />
                </div>
            )}

            {/* ③ Manual paste-grid fallback (collapsible) */}
            <div style={{maxWidth: 700, marginBottom: 16}}>
                <button
                    id="timeseries-manual-toggle"
                    className="btn btn-xs btn-default"
                    onClick={() => setShowManualGrid(!showManualGrid)}
                    style={{fontSize: '0.8rem', marginBottom: 8}}
                >
                    <span
                        className={`glyphicon ${showManualGrid ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`}
                        style={{marginRight: 6}}
                    />
                    {showManualGrid ? 'Hide manual edit' : 'Advanced: manual paste / edit'}
                </button>

                {showManualGrid && (
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            boxSizing: 'border-box',
                            paddingTop: '5px'
                        }}>
                            <p style={{marginRight: '5px', width: '100px'}}>
                                <Message msgId="hydrata.hydrology.pasteData" />
                            </p>
                            <input
                                ref={pasteDivRef}
                                id="name"
                                key="name-paste"
                                type="text"
                                className="hydrology-text-input"
                                style={{textAlign: 'left'}}
                                value={''}
                                readOnly
                            />
                        </div>
                        <div style={{display: 'flex', flexDirection: 'row', boxSizing: 'border-box'}}>
                            <div style={{
                                padding: '10px',
                                height: '600px',
                                width: '600px',
                                minWidth: '400px',
                                marginBottom: '60px',
                                marginRight: '50px'
                            }}>
                                <div>
                                    <h3 style={{marginTop: 0}}>
                                        <Message msgId="hydrata.hydrology.timeSeries" />
                                    </h3>
                                    <table className="time-series-table">
                                        <thead>
                                            {table.getHeaderGroups().map(headerGroup => (
                                                <tr key={headerGroup.id}>
                                                    {headerGroup.headers.map(header => (
                                                        <th key={header.id}>
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(
                                                                    header.column.columnDef.header,
                                                                    header.getContext()
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
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div style={{
                                    minWidth: '600px',
                                    marginTop: '20px',
                                    padding: '10px'
                                }}>
                                    <h3 style={{marginTop: 0}}>
                                        <Message msgId="hydrata.hydrology.timeSeries" />
                                    </h3>
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        background: 'white',
                                        borderRadius: '3px'
                                    }}>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <BarChart
                                                width={500}
                                                height={300}
                                                data={chartData}
                                                margin={{
                                                    top: 30,
                                                    right: 30,
                                                    left: 50,
                                                    bottom: 120
                                                }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis
                                                    dataKey="timestamp"
                                                    type="number"
                                                    domain={['auto', 'auto']}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={60}
                                                    tickFormatter={(unixTime) => {
                                                        if (!chartData || chartData.length === 0) return '';
                                                        const endDate = new Date(Math.max(...chartData.map(d => d.timestamp)));
                                                        const startDate = new Date(Math.min(...chartData.map(d => d.timestamp)));
                                                        const deltaDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                                        const dateObj = new Date(unixTime);
                                                        if (deltaDays < 7) {
                                                            return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;
                                                        }
                                                        return dateObj.toLocaleDateString();
                                                    }}
                                                />
                                                <YAxis
                                                    name="Rate"
                                                    label={{
                                                        value: 'Flow (m3/s) or Rainfall (mm/hr)',
                                                        angle: -90,
                                                        position: 'insideLeft',
                                                        offset: 20,
                                                        dy: 100
                                                    }}
                                                />
                                                <Bar dataKey="value" fill="#8884d8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

HydrologyTimeSeries.propTypes = {
    activeHydrologyItem: PropTypes.object,
    idfTables: PropTypes.array,
    designStorm: PropTypes.object,
    setActiveHydrologyItem: PropTypes.func,
    activeHydrologyPage: PropTypes.string,
    updateTimeSeriesRowData: PropTypes.func,
    replaceTimeSeriesRowData: PropTypes.func,
    deriveDesignStormRequest: PropTypes.func,
    setDesignStormForm: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
        idfTables: state?.hydrology?.idfTables || [],
        designStorm: state?.hydrology?.designStorm
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        updateTimeSeriesRowData: (timeSeriesId, rowIndex, columnId, value) =>
            dispatch(updateTimeSeriesRowData(timeSeriesId, rowIndex, columnId, value)),
        replaceTimeSeriesRowData: (timeSeriesId, newRowData) =>
            dispatch(replaceTimeSeriesRowData(timeSeriesId, newRowData)),
        deriveDesignStormRequest: (formValues) => dispatch(deriveDesignStormRequest(formValues)),
        setDesignStormForm: (patch) => dispatch(setDesignStormForm(patch))
    };
};

export {HydrologyTimeSeries as HydrologyTimeSeriesClass};
export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTimeSeries);
