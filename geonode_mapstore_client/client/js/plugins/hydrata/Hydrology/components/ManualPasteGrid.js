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
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer
} from 'recharts';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import moment from 'moment';
import Message from '@mapstore/framework/components/I18N/Message';

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
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());

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
                setChartData(activeHydrologyItem?.getChartData());
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
    );
};

ManualPasteGrid.propTypes = {
    activeHydrologyItem: PropTypes.object,
    dispatchUpdateRowData: PropTypes.func.isRequired,
    dispatchReplaceRowData: PropTypes.func.isRequired
};

export default ManualPasteGrid;
export {ManualPasteGrid, TableCell, columns};
