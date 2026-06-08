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
    replaceTimeSeriesRowData
} from '../actionsHydrology';
import {PRESET_FAMILIES, ALTERNATING_BLOCK} from '../temporalPatternPresets';
import ManualPasteGrid from './ManualPasteGrid';

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

const HyetographChart = ({rowData, timestepMin, title}) => {
    const chartData = rowDataToHyetograph(rowData);
    if (!chartData.length) return null;
    // Convert mm/hr intensity × (timestep/60) = mm depth per interval for total
    const ts = timestepMin || 6;
    const totalDepth = chartData.reduce((s, d) => s + d.intensity * (ts / 60), 0).toFixed(1);
    return (
        <div style={{marginTop: 8}} id="design-storm-hyetograph">
            {title && (
                <p style={{fontSize: '0.9rem', fontWeight: 700, marginBottom: 4, color: '#333'}}>
                    {title}
                </p>
            )}
            <p style={{fontSize: '0.85rem', color: '#555', marginBottom: 4}}>
                Estimated total depth: <strong>{totalDepth} mm</strong>
                <span style={{marginLeft: 8, color: '#666', fontSize: '0.8rem'}}>
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
    timestepMin: PropTypes.number,
    title: PropTypes.string
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

const PreviewCard = ({preview, isFocused, onFocus, onAttach, attachInFlight, rainfallPk}) => {
    const key = previewKey(preview);
    const durationHr = preview.duration_min >= 60
        ? `${(preview.duration_min / 60).toFixed(1)} hr`
        : `${preview.duration_min} min`;
    const ariLabel = preview.ari ? `ARI ${preview.ari} yr` : (preview.aep ? `AEP ${preview.aep}%` : '');

    return (
        <div
            id={`preview-card-${key}`}
            className={`design-storm-preview-card${isFocused ? ' focused' : ''}`}
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
                <span className="design-storm-preview-title" style={{fontSize: '0.88rem', marginRight: 6}}>
                    {preview.pattern}
                </span>
                <span className="design-storm-preview-meta" style={{fontSize: '0.82rem', marginRight: 6}}>
                    {ariLabel}
                </span>
                <span className="design-storm-preview-meta" style={{fontSize: '0.82rem'}}>
                    {durationHr}
                </span>
                {preview.total_depth_mm !== undefined && (
                    <span style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        background: '#e8f0fe',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: '0.8rem',
                        color: '#3c5a9a'
                    }}>
                        {Number(preview.total_depth_mm).toFixed(1)} mm
                    </span>
                )}
                {preview.persisted === false && (
                    <span style={{
                        display: 'inline-block',
                        marginLeft: 6,
                        background: '#f0f5e8',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: '0.78rem',
                        color: '#4a7c28'
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
            {/* FILTERS row */}
            <div
                id="design-storms-filters"
                className="design-storm-card"
                style={{
                    padding: '10px 14px',
                    marginBottom: 12
                }}
            >
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start'}}>
                    {/* IDF Variant picker */}
                    <div style={{flex: '1 1 180px'}}>
                        <label className="design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            IDF Table
                        </label>
                        <select
                            id="ds-browser-idf-table"
                            className="hydrology-text-input"
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
                        <label className="design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            RP filter (yr)
                        </label>
                        <select
                            id="ds-browser-ari-filter"
                            className="hydrology-text-input"
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
                        <label className="design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            Duration filter
                        </label>
                        <select
                            id="ds-browser-duration-filter"
                            className="hydrology-text-input"
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
                        <label className="design-storm-label" style={{fontSize: '0.82rem', marginBottom: 3}}>
                            Timestep (min)
                        </label>
                        <input
                            id="ds-browser-timestep"
                            type="number"
                            className="hydrology-text-input"
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
                    <label className="design-storm-label" style={{fontSize: '0.82rem', marginBottom: 4}}>
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

            {/* Status / stale banner */}
            {stale && !inFlight && (
                <div style={{
                    padding: '6px 10px', marginBottom: 8, background: '#fff8e1',
                    border: '1px solid #ffe082', borderRadius: 3, fontSize: '0.82rem', color: '#7a6000'
                }}>
                    IDF or pattern changed — previews will refresh.
                    <button className="btn btn-xs btn-default" style={{marginLeft: 8}} onClick={handleRefresh}>
                        Refresh now
                    </button>
                </div>
            )}

            {inFlight && (
                <div className="design-storm-muted" style={{padding: '8px 0', fontSize: '0.85rem'}}>
                    <span className="glyphicon glyphicon-refresh" style={{marginRight: 6}} />
                    Computing previews…
                </div>
            )}

            {error && (
                <div id="design-storm-preview-error" style={{
                    padding: '6px 10px', marginBottom: 8, background: '#fdf0f0',
                    border: '1px solid #f5c6cb', borderRadius: 3, color: '#c0392b', fontSize: '0.85rem'
                }}>
                    {error}
                </div>
            )}

            {!selectedIdfTableId && (
                <div className="design-storm-muted" style={{padding: '8px 0', fontSize: '0.85rem'}}>
                    Select an IDF table to browse design storms.
                </div>
            )}

            {/* Focused hyetograph chart — defaults to first preview (AC3).
                KEEP this card WHITE so the recharts axes/grid read (TASK-1534). */}
            {focusedPreview && (
                <div
                    id="design-storm-focused-chart"
                    className="design-storm-chart-card"
                    style={{
                        padding: '12px 16px',
                        marginBottom: 14
                    }}
                >
                    <HyetographChart
                        rowData={focusedPreview.rowData}
                        timestepMin={focusedPreview.timestep_min || timestepMin}
                        title={focusedPreview.name || focusedPreview.source || 'Design Storm'}
                    />
                    {focusedPreview.source && (
                        <p style={{fontSize: '0.78rem', color: '#666', marginTop: 4, marginBottom: 0}}>
                            Source: {focusedPreview.source}
                        </p>
                    )}
                </div>
            )}

            {/* Gallery of preview cards */}
            {filteredPreviews.length > 0 && (
                <div id="design-storm-gallery" style={{marginBottom: 12}}>
                    <p className="design-storm-muted" style={{fontSize: '0.82rem', marginBottom: 6}}>
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
            <div
                className="design-storm-card"
                style={{
                    padding: '12px 16px',
                    maxWidth: 700,
                    marginBottom: 16
                }}
            >
                <h4 style={{marginTop: 0, marginBottom: 12, fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.95)'}}>
                    Manual Design Storm Derive
                </h4>

                {/* IDF Table picker */}
                <div style={{marginBottom: 10}}>
                    <label
                        htmlFor="ds-idf-table"
                        className="design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
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
                        className="design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
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
                            className="design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            AEP (%)
                            <span className="design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
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
                            className="design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            ARI (years)
                            <span className="design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
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
                            className="design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
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
                            className="design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
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
                            className="design-storm-label"
                            style={{fontSize: '0.85rem', marginBottom: 3}}
                        >
                            Peak position (0–1)
                            <span className="design-storm-hint" style={{marginLeft: 4, fontSize: '0.8rem'}}>
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
                        className="design-storm-label"
                        style={{fontSize: '0.85rem', marginBottom: 3}}
                    >
                        Name <span className="design-storm-hint">(optional — auto-generated if blank)</span>
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
            </div>

            {/* Hyetograph preview — shown after a successful derive */}
            {derivedRowData && derivedRowData.length > 0 && (
                <div
                    id="design-storm-preview"
                    className="design-storm-chart-card"
                    style={{
                        maxWidth: 700,
                        padding: '12px 16px',
                        marginBottom: 16
                    }}
                >
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

const HydrologyTimeSeries = ({activeHydrologyItem}) => {
    // TASK-1556 (AC2) — feed the SAVED record's rowData to the existing
    // exported HyetographChart (the only gap was that activeHydrologyItem.rowData
    // was never wired in). .rowData is the saved Array<{timestamp,value}>
    // (reducer's createTimeSeriesFromJson sets it via instance.data = json.data).
    const rowData = activeHydrologyItem?.rowData || [];
    const hasData = Array.isArray(rowData) && rowData.length > 0;

    return (
        <div id="timeseries-detail-hyetograph" style={{maxWidth: 720}}>
            {hasData ? (
                <HyetographChart
                    rowData={rowData}
                    timestepMin={estimateTimestepMin(rowData)}
                    title={activeHydrologyItem?.name || 'Design Storm'}
                />
            ) : (
                <p className="design-storm-muted" style={{fontSize: '0.85rem', padding: '8px 0'}}>
                    <Message msgId="hydrata.hydrology.noTimeSeriesData" />
                </p>
            )}
        </div>
    );
};

HydrologyTimeSeries.propTypes = {
    activeHydrologyItem: PropTypes.object
};

// TASK-1556 (W2) — the slim detail only needs the active item. The
// design-storm/projection/idf state + dispatch wiring moved to the Create
// panel (TASK-1558), which owns its own connect.
const mapStateToProps = (state) => {
    return {
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem
    };
};

export {HydrologyTimeSeries as HydrologyTimeSeriesClass};
export default connect(mapStateToProps)(HydrologyTimeSeries);

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

const DesignStormDerive = ({idfTables, temporalPatterns, selectedIdfTableId, selectedPattern, onChange}) => {
    const presetIds = new Set(PRESET_FAMILIES.map(f => f.id));
    const customPatterns = (temporalPatterns || [])
        .filter(tp => tp.pattern_type === 'custom' || !presetIds.has(tp.id));
    const patternOptions = [
        ...PRESET_FAMILIES.map(f => ({id: f.id, label: f.label})),
        ...customPatterns.map(tp => ({id: tp.id || tp.name, label: tp.name}))
    ];

    return (
        <div id="design-storm-derive-shell" className="design-storm-card" style={{padding: '12px 16px', maxWidth: 700}}>
            {/* IDF table picker */}
            <div style={{marginBottom: 10}}>
                <label htmlFor="ds-derive-idf-table" className="design-storm-label" style={{fontSize: '0.85rem', marginBottom: 3}}>
                    <Message msgId="hydrata.hydrology.idfTable" />
                </label>
                <select
                    id="ds-derive-idf-table"
                    className="hydrology-text-input"
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

            {/* Temporal-pattern picker */}
            <div style={{marginBottom: 10}}>
                <label htmlFor="ds-derive-pattern" className="design-storm-label" style={{fontSize: '0.85rem', marginBottom: 3}}>
                    <Message msgId="hydrata.hydrology.temporalPattern" />
                </label>
                <select
                    id="ds-derive-pattern"
                    className="hydrology-text-input"
                    style={{width: '100%'}}
                    value={selectedPattern ?? ALTERNATING_BLOCK}
                    onChange={e => onChange({selectedPattern: e.target.value})}
                >
                    {patternOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Empty preview area — wired for W3 (preview X storms + Save these N). */}
            <div
                id="design-storm-derive-preview"
                className="design-storm-derive-preview-placeholder"
                style={{
                    marginTop: 12,
                    padding: '18px 14px',
                    border: '1px dashed rgba(255,255,255,0.3)',
                    borderRadius: 4,
                    textAlign: 'center'
                }}
            >
                <p className="design-storm-muted" style={{margin: 0, fontSize: '0.85rem'}}>
                    <Message msgId="hydrata.hydrology.derivePreviewComingSoon" />
                </p>
            </div>
        </div>
    );
};

DesignStormDerive.propTypes = {
    idfTables: PropTypes.array,
    temporalPatterns: PropTypes.array,
    selectedIdfTableId: PropTypes.number,
    selectedPattern: PropTypes.string,
    onChange: PropTypes.func.isRequired
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
    onBack,
    updateTimeSeriesRowData: dispatchUpdateRowData,
    replaceTimeSeriesRowData: dispatchReplaceRowData
}) => {
    // Derive-tab shell selections are LOCAL — no compute/persist until W3.
    const [deriveSpec, setDeriveSpec] = useState({selectedIdfTableId: null, selectedPattern: ALTERNATING_BLOCK});
    const tab = activeTab || 'input';

    return (
        <div id="design-storm-create-panel">
            {/* Back-to-list affordance (container clears create mode + unsaved item) */}
            <div style={{marginBottom: 8}}>
                <button
                    id="ds-create-back"
                    type="button"
                    className="btn btn-default btn-xs"
                    onClick={onBack}
                    style={{fontSize: '0.8rem'}}
                >
                    <span className="glyphicon glyphicon-chevron-left" style={{marginRight: 5}} />
                    <Message msgId="hydrata.hydrology.backToList" />
                </button>
            </div>

            {/* Segmented Input | Derive toggle — mirrors the IDF sub-toggle markup. */}
            <div className="hydrology-idf-subtoggle" role="group" aria-label="Create mode">
                <button
                    id="ds-create-tab-input"
                    type="button"
                    className={'hydrology-idf-segment' + (tab === 'input' ? ' is-active' : '')}
                    onClick={() => onTabChange('input')}
                >
                    <Message msgId="hydrata.hydrology.idfModeManual" />
                </button>
                <button
                    id="ds-create-tab-derive"
                    type="button"
                    className={'hydrology-idf-segment' + (tab === 'derive' ? ' is-active' : '')}
                    onClick={() => onTabChange('derive')}
                >
                    <Message msgId="hydrata.hydrology.idfModeDerive" />
                </button>
            </div>

            {/* Active tab body */}
            <div style={{marginTop: 10}}>
                {tab === 'derive' ? (
                    <DesignStormDerive
                        idfTables={idfTables}
                        temporalPatterns={temporalPatterns}
                        selectedIdfTableId={deriveSpec.selectedIdfTableId}
                        selectedPattern={deriveSpec.selectedPattern}
                        onChange={(patch) => setDeriveSpec(prev => ({...prev, ...patch}))}
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
    onBack: PropTypes.func.isRequired,
    updateTimeSeriesRowData: PropTypes.func.isRequired,
    replaceTimeSeriesRowData: PropTypes.func.isRequired
};

const createPanelStateToProps = (state) => ({
    activeHydrologyItem: state?.hydrology?.activeHydrologyItem,
    idfTables: state?.hydrology?.idfTables || [],
    temporalPatterns: state?.hydrology?.temporalPatterns || []
});

const createPanelDispatchToProps = (dispatch) => ({
    updateTimeSeriesRowData: (timeSeriesId, rowIndex, columnId, value) =>
        dispatch(updateTimeSeriesRowData(timeSeriesId, rowIndex, columnId, value)),
    replaceTimeSeriesRowData: (timeSeriesId, newRowData) =>
        dispatch(replaceTimeSeriesRowData(timeSeriesId, newRowData))
});

const ConnectedDesignStormCreatePanel =
    connect(createPanelStateToProps, createPanelDispatchToProps)(DesignStormCreatePanel);

export {DesignStormCreatePanel, DesignStormDerive};
export {ConnectedDesignStormCreatePanel as HydrologyTimeSeriesCreatePanel};
