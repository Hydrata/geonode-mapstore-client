/**
 * TASK-1558 (W2) — ManualPasteGrid extracted into its own file.
 *
 * The advanced manual-entry table (TanStack editable grid bound to
 * activeHydrologyItem.rowData + a bar chart). Previously inline in
 * hydrologyDetailTimeSeries.js; extracted so the new two-tab Create panel's
 * "Input" tab and any remaining caller share a single copy. The props
 * contract is unchanged:
 *   - activeHydrologyItem: the TimeSeries instance being edited
 *   - dispatchUpdateRowData(id, rowIndex, columnId, value)
 *   - dispatchReplaceRowData(id, newRowData)
 *
 * TableCell + columns travel with it (the cell renderer references columns,
 * the table is built from columns; both are private to this grid).
 */
import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import moment from 'moment';
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {HyetographChart, estimateTimestepMin} from './hydrologyDetailTimeSeries';
// TASK-2120 — visible parse-failure feedback for the Paste Data field
// (previously a silent no-op on garbage input; see ManualPasteGrid below).
import {ErrorStrip} from '../../SimpleView/components/primitives';

// ---------------------------------------------------------------------------
// Manual-edit table cell (unchanged from W4)
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

// TASK-2026 (W5.4): The value-column header is page/series-aware.
// Build the columns array inside the component so it can read activeHydrologyItem.
// This factory is called inside ManualPasteGrid on every render — TanStack Table
// memoises the row model, so a new columns reference is harmless here (the grid
// is a pure editor, not a large virtualised list). The timestamp column is stable.
const buildColumns = (isHydrograph) => [
    columnHelper.accessor('timestamp', {
        cell: TableCell,
        header: () => <span><Message msgId="hydrata.hydrology.timestamp" /></span>,
        meta: {
            type: 'datetime-local'
        }
    }),
    columnHelper.accessor('value', {
        cell: TableCell,
        // Hydrograph: Flow (m3/s) only — rainfall option removed (TASK-2026).
        // Design Storm: Rainfall (mm/hr) only — TASK-2001 W1d (TASK-2005) makes
        // the Design Storms create panel rainfall-only now that TASK-1970 split
        // hydrographs (flow) out into their own page. Only the else branch
        // changed; the isHydrograph branch keeps 'Flow (m3/s)' (no 1970 W5.4 regression).
        header: () => isHydrograph
            ? <span>Flow (m3/s)</span>
            : <span>Rainfall (mm/hr)</span>,
        meta: {
            type: 'number'
        }
    })
];

// ---------------------------------------------------------------------------
// Manual paste-grid (unchanged from W4 — now the Create panel's "Input" tab)
// ---------------------------------------------------------------------------

const ManualPasteGrid = ({activeHydrologyItem, dispatchUpdateRowData, dispatchReplaceRowData}, context) => {
    // Pull intl messages off React legacy context so the format-hint /
    // placeholder / parse-error copy below can resolve translated text
    // at render time — mirrors the `tr()` idiom in hydrologyDetailIdfTable.js
    // / Anuga/scenarioHeaderActions.js / VectorDraw's TimeSeriesSelect.
    const tr = (msgId, fallback) => {
        const messages = (context && context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };
    // TASK-2026 (W5.4): derive isHydrograph from the item's series_type so the
    // value-column header shows 'Flow (m3/s)' only for hydrographs.
    const isHydrograph = activeHydrologyItem?.series_type === 'hydrograph';
    const columns = buildColumns(isHydrograph);

    const pasteDivRef = useRef();

    // TASK-2081 (epic-2077): table + chart read activeHydrologyItem.rowData
    // DIRECTLY below (no local rowData/columnDefs mirror — the old mirror was
    // only "synced" by an effect that also listed rowData in its own deps,
    // making it a no-op after the first render; columnDefs was never even read
    // outside that effect). updateRowValues/setRowData (classesHydrology.js
    // :549-557/:563-565) already replace .rowData with a NEW array immutably
    // on a committed edit or paste.
    //
    // BUT: the reducer deliberately keeps the SAME activeHydrologyItem object
    // reference on a data-only mutation (reducersHydrology.js UPDATE_TIME_SERIES_
    // ROW_DATA / REPLACE_TIME_SERIES_ROW_DATA mutate the instance in place — a
    // stable ref so the ag-grid editor isn't torn down mid-typing, epic-2077 D4).
    // That means react-redux's connect() (pinned react-redux 6.0.0) sees an
    // UNCHANGED mapStateToProps output and bails out of re-rendering the
    // HydrologyTimeSeries tree entirely — reading activeHydrologyItem.rowData
    // "directly" is not by itself reactive to an in-place mutation. The sibling
    // editable grid (hydrologyDetailIdfTable.js commitCell/refreshChart) hits
    // the exact same gap and solves it the same way: a local re-render trigger
    // fired right alongside the commit dispatch. renderTick carries no data of
    // its own (it is not a rowData mirror) — it exists only to force this
    // component to re-evaluate its props, at which point activeHydrologyItem.
    // rowData is read fresh.
    const [, setRenderTick] = useState(0);
    // TASK-2120 — visible feedback when the pasted text doesn't parse. `null`
    // hides the ErrorStrip (self-hiding on no message); set to a string on a
    // parse failure, cleared on the next successful paste.
    const [pasteError, setPasteError] = useState(null);

    // TASK-2120 — each row now carries a `valid` flag instead of trusting the
    // parse blindly. Before this fix, an unparseable timestamp produced an
    // INVALID moment whose `.toISOString()` returns `null` (moment >=2.29,
    // pinned here at 2.29.4) — `.slice(0, -1)` on that null then THREW inside
    // the native `paste` event listener (an uncaught exception, not caught by
    // any React error boundary), which is why garbage input silently "did
    // nothing" from the user's perspective. LENIENT parsing (no strict 3rd
    // arg) is kept deliberately — Phase 1.7 self-review caught that strict
    // mode rejects a single-digit hour ("2025-01-01 0:00") or trailing
    // seconds ("...00:00:00"), both of which a real spreadsheet paste can
    // plausibly contain and which the ORIGINAL (pre-2120) lenient parsing
    // silently accepted; `.isValid()` alone already catches genuine garbage
    // (verified: `moment('not a date', fmt).isValid()` is false) without
    // narrowing the accepted format versus prior behaviour.
    const parsePastedData = (pastedData) => {
        return pastedData.split('\n')
            .filter(row => row.trim() !== '')
            .map((row) => {
                const [timestampStr, valueStr] = row.split('\t');
                const parsedMoment = moment(timestampStr, 'YYYY-MM-DD HH:mm');
                const value = parseFloat(valueStr);
                const valid = parsedMoment.isValid() && Number.isFinite(value);
                return {
                    timestamp: valid ? parsedMoment.toISOString().slice(0, -1) : null,
                    value,
                    valid
                };
            });
    };

    useEffect(() => {
        const handlePaste = (event) => {
            let paste = event.clipboardData || window.clipboardData;
            if (paste) {
                let pastedData = paste.getData('text');
                let parsedRows = parsePastedData(pastedData);
                if (parsedRows.length === 0 || parsedRows.some(r => !r.valid)) {
                    setPasteError(tr(
                        'hydrata.hydrology.pasteDataParseError',
                        'Could not read the pasted data — expected two tab-separated columns (Timestamp, Value), one row per line. No changes were made.'
                    ));
                    return;
                }
                setPasteError(null);
                const newRowData = parsedRows.map(({timestamp, value}) => ({timestamp, value}));
                dispatchReplaceRowData(activeHydrologyItem.id, newRowData);
                setRenderTick(t => t + 1);
            }
        };
        const pasteDiv = pasteDivRef.current;
        if (pasteDiv) pasteDiv.addEventListener('paste', handlePaste);
        return () => {
            if (pasteDiv) pasteDiv.removeEventListener('paste', handlePaste);
        };
    }, [activeHydrologyItem]);

    const table = useReactTable({
        columns: columns,
        data: activeHydrologyItem?.rowData || [],
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                dispatchUpdateRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                setRenderTick(t => t + 1);
            }
        }
    });

    return (
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
                    className="sv-hydrology-text-input"
                    style={{textAlign: 'left'}}
                    value={''}
                    readOnly
                    // TASK-2120 — the field itself has no visible format hint
                    // (previously). Real placeholder attribute mirrors the
                    // resolveMsg-with-English-fallback idiom already used for
                    // the IDF Source/Description placeholders (TASK-2119).
                    placeholder={tr('hydrata.hydrology.pasteDataPlaceholder', 'Click here, then paste (Ctrl/Cmd+V)…')}
                />
            </div>
            {/* TASK-2120 — persistent (not hover-only) format hint, always
                visible below the paste target, so the accepted format is
                discoverable without a failed attempt first. */}
            <div className="sv-hydrology-paste-format-hint" style={{fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0 105px'}}>
                <Message msgId="hydrata.hydrology.pasteDataFormatHint" />
            </div>
            <ErrorStrip message={pasteError} style={{margin: '6px 0 0 105px'}} />
            <div style={{display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>
                <div style={{
                    padding: '10px',
                    minWidth: '400px',
                    marginBottom: '16px'
                }}>
                    <div>
                        {/* TASK-2084 (epic-2077) — page-aware editor heading: 'Hydrograph'
                            for a flow series (reuses the same isHydrograph signal that
                            already drives the value-column header above), 'Design Storm'
                            (the existing hydrata.hydrology.timeSeries copy) for rainfall. */}
                        <h3 style={{marginTop: 0}}>
                            <Message msgId={isHydrograph ? 'hydrata.hydrology.hydrograph' : 'hydrata.hydrology.timeSeries'} />
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
                <div style={{padding: '10px'}}>
                    {/* TASK-2027/2028/2030 (W5.5/W5.6/W5.8): pass page discriminator so
                        the preview chart renders as line+m3/s for hydrographs vs bar+mm/hr
                        for design storms. Derived from series_type on the item (data-truthful,
                        avoids adding a separate prop chain from the create panel). */}
                    <HyetographChart
                        rowData={activeHydrologyItem?.rowData || []}
                        timestepMin={estimateTimestepMin(activeHydrologyItem?.rowData || [])}
                        title={activeHydrologyItem?.name || 'Preview'}
                        activeHydrologyPage={activeHydrologyItem?.series_type === 'hydrograph' ? 'hydrographs' : 'time-series'}
                    />
                </div>
            </div>
        </div>
    );
};

ManualPasteGrid.propTypes = {
    activeHydrologyItem: PropTypes.object,
    dispatchUpdateRowData: PropTypes.func.isRequired,
    dispatchReplaceRowData: PropTypes.func.isRequired
};

// TASK-2120 — legacy context declaration required for the `tr()` helper's
// `context.messages` read above (mirrors TimeSeriesSelect.contextTypes in
// VectorDraw/components/FormField.js).
ManualPasteGrid.contextTypes = {
    messages: PropTypes.object
};

export default ManualPasteGrid;
// TASK-2026: columns is now built inside the component (buildColumns factory);
// export buildColumns for testing. TableCell exported for render isolation tests.
export {ManualPasteGrid, TableCell, buildColumns};
