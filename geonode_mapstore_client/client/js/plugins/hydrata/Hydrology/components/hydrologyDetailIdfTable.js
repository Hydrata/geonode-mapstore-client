import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from 'recharts';
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
// using the shared .idf-matrix-* styling. The difference from the Derive
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

// Display string for an enabled cell — blank for 0 so a freshly-enabled cell
// is ready to type into rather than showing a literal "0".
const displayValue = (value) => (hasCellValue(value) ? String(value) : '');

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
    useEffect(() => {
        setText(displayValue(value));
    }, [value]);
    return (
        <input
            className="idf-matrix-input"
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(sanitizeFloat(e.target.value))}
            onBlur={() => onCommit(text)}
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

const IdfCurveChart = ({chartData}) => (
    <ResponsiveContainer
        width="100%"
        height="100%"
    >
        <ScatterChart
            margin={{
                top: 20,
                right: 80,
                bottom: 50,
                left: 40
            }}
        >
            <CartesianGrid/>
            <XAxis
                type="number"
                dataKey="duration"
                name="Duration"
                unit="min"
                scale="log"
                domain={[5, 'auto']}
                label={{
                    value: "Duration",
                    position: "bottom"
                }}
            />
            <YAxis
                type="number"
                dataKey="intensity"
                name="Intensity"
                unit="mm/hr"
                scale="log"
                domain={[1, 'auto']}
                label={{
                    value: "Intensity",
                    angle: -90,
                    position: "insideLeft",
                    offset: -30
                }}
            />
            <Tooltip
                cursor={{strokeDasharray: "3 3"}}
            />
            {Object.keys(chartData).map((frequency, index) => {
                return (
                    <Scatter
                        key={frequency}
                        name={frequency}
                        data={chartData[frequency]}
                        fill={CURVE_COLOURS[index % CURVE_COLOURS.length]}
                        line
                        shape={({ cx, cy, fill }) => <circle cx={cx} cy={cy} r={3} fill={fill} />}
                    />
                );
            })}
        </ScatterChart>
    </ResponsiveContainer>
);

IdfCurveChart.propTypes = {
    chartData: PropTypes.object
};

// ---------------------------------------------------------------------------
// IdfCurveModal — an on-demand overlay-div modal (TASK-1526). Portals to
// document.body (anuga/swamm container idiom) so it escapes the SimpleView
// stacking context and floats over the map. Backdrop click + × both close;
// a click on the inner panel is stopped from bubbling so it does NOT close.
// The panel gives the chart an explicit pixel height (ResponsiveContainer
// measures 0 inside an auto-height flex parent → blank chart otherwise).
// ---------------------------------------------------------------------------
const IdfCurveModal = ({chartData, onClose, closeLabel}) => {
    if (typeof document === 'undefined') return null;
    return ReactDOM.createPortal(
        <div
            className="idf-curve-modal-overlay"
            onClick={onClose}
        >
            <div
                className="simple-view-panel idf-curve-modal-panel"
                onClick={e => e.stopPropagation()}
            >
                <div className="simple-view-panel-header idf-curve-modal-header">
                    <span><Message msgId="hydrata.hydrology.idfCurveModalTitle" /></span>
                    <button
                        type="button"
                        className="legend-close"
                        style={{position: 'static'}}
                        onClick={onClose}
                        title={closeLabel}
                        aria-label={closeLabel}
                    >&times;</button>
                </div>
                <div className="idf-curve-modal-body">
                    <IdfCurveChart chartData={chartData} />
                </div>
            </div>
        </div>,
        document.body
    );
};

IdfCurveModal.propTypes = {
    chartData: PropTypes.object,
    onClose: PropTypes.func,
    closeLabel: PropTypes.string
};

// eslint-disable-next-line no-shadow -- prop intentionally named after the action creator (mapDispatchToProps shorthand)
const HydrologyDetailIdfTable = ({ activeHydrologyItem, updateIdfRowData }, context) => {
    // Resolve a msgId to a plain string for title/aria-label attributes (the
    // <Message> component only renders JSX children). Mirrors the canonical
    // idiom in Anuga/scenarioActionToolbar: getMessageById returns the msgId
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
                lower duration rows with no scrollbar); the .idf-matrix-wrapper--input
                modifier below now owns a (max-height + overflow-y:auto) scroll
                region so EVERY duration row stays reachable. */}
            <div style={{padding: '10px', minWidth: '600px', maxWidth: '800px', marginBottom: '60px'}}>
                <h3 style={{marginTop: 0}}><Message msgId="hydrata.hydrology.intensityMmHr" /></h3>

                {/* Hours/minutes read-aid — stored durations stay in minutes. */}
                <div className="idf-matrix-unit-toggle-row">
                    <input
                        id="idf-input-show-hours"
                        type="checkbox"
                        checked={showHours}
                        onChange={() => setShowHours(h => !h)}
                    />
                    {' '}
                    <label htmlFor="idf-input-show-hours" className="idf-matrix-unit-label">
                        Display in hours
                    </label>
                </div>

                <div className="idf-matrix-wrapper idf-matrix-wrapper--input">
                    <table className="idf-matrix-table">
                        <thead>
                            <tr>
                                <th className="idf-matrix-corner" />
                                {ARI_COLUMNS.map(col => {
                                    const colSelected = selectedCols.has(col.key);
                                    return (
                                        <th
                                            key={col.key}
                                            className={`idf-matrix-col-header${colSelected ? ' idf-matrix-header--selected' : ''}`}
                                            onClick={() => toggleCol(col.key)}
                                            title={`Select the ${col.label} ARI column (a cell is editable only when its row is also selected)`}
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
                                            className={`idf-matrix-row-header${rowSelected ? ' idf-matrix-header--selected' : ''}`}
                                            onClick={() => toggleRow(rowIndex)}
                                            title={`Select all return periods for ${formatDuration(row.duration, false)} (a cell is editable only when its column is also selected)`}
                                        >
                                            {formatDuration(row.duration, showHours)}
                                        </td>
                                        {ARI_COLUMNS.map(col => {
                                            const enabled = isEnabled(rowIndex, col.key);
                                            if (!enabled) {
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className="idf-matrix-cell idf-matrix-cell--empty"
                                                        title={`${formatDuration(row.duration, false)} / ${col.label}: select both this duration row and ARI column to enter an intensity (mm/hr)`}
                                                    />
                                                );
                                            }
                                            return (
                                                <td key={col.key} className="idf-matrix-cell idf-matrix-cell--input">
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
                <h3 style={{marginTop: 0}}><Message msgId="hydrata.hydrology.idfCurve" /></h3>
                {/* TASK-1526 — the curve is on-demand: a trigger button gated
                    by hasValidData opens the portal modal over the map. With no
                    valid data the chart is GONE and the button is disabled. */}
                <button
                    type="button"
                    className="btn btn-primary idf-curve-open-btn"
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
// Anuga/scenarioActionToolbar).
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
