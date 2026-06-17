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
import {HyetographChart, estimateTimestepMin} from './hydrologyDetailTimeSeries';

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
// Manual paste-grid (unchanged from W4 — now the Create panel's "Input" tab)
// ---------------------------------------------------------------------------

const ManualPasteGrid = ({activeHydrologyItem, dispatchUpdateRowData, dispatchReplaceRowData}) => {
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);

    const pasteDivRef = useRef();

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

    useEffect(() => {
        const handlePaste = (event) => {
            let paste = event.clipboardData || window.clipboardData;
            if (paste) {
                let pastedData = paste.getData('text');
                let newRowData = parsePastedData(pastedData);
                dispatchReplaceRowData(activeHydrologyItem.id, newRowData);
                setRowData(newRowData);
            }
        };
        const pasteDiv = pasteDivRef.current;
        if (pasteDiv) pasteDiv.addEventListener('paste', handlePaste);
        return () => {
            if (pasteDiv) pasteDiv.removeEventListener('paste', handlePaste);
        };
    }, [activeHydrologyItem]);

    useEffect(() => {
        setColumnDefs(activeHydrologyItem?.columnDefs);
        setRowData(activeHydrologyItem?.rowData);
    }, [activeHydrologyItem, rowData, columnDefs]);

    const table = useReactTable({
        columns: columns,
        data: rowData || [],
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                dispatchUpdateRowData(activeHydrologyItem.id, rowIndex, columnId, value);
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
                />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>
                <div style={{
                    padding: '10px',
                    minWidth: '400px',
                    marginBottom: '16px'
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
                <div style={{padding: '10px'}}>
                    <HyetographChart
                        rowData={rowData || []}
                        timestepMin={estimateTimestepMin(rowData || [])}
                        title={activeHydrologyItem?.name || 'Preview'}
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

export default ManualPasteGrid;
export {ManualPasteGrid, TableCell, columns};
