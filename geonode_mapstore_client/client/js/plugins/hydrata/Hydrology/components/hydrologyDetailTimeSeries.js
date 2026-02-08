import React, {useState, useEffect, useRef, useCallback} from 'react';
import { connect } from 'react-redux';
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
    setActiveHydrologyItem,
    updateTimeSeriesRowData,
    replaceTimeSeriesRowData
} from "../actionsHydrology";

import { CustomEvent } from "@piwikpro/react-piwik-pro";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import moment from "moment";

const TableCell = ({getValue, row, column, table}) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, value);
    };
    let inputType = column.columnDef.meta?.type || "text";
    let displayValue = value;

    if (inputType === "datetime") {
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

const columnHelper = createColumnHelper();

const columns = [
    columnHelper.accessor('timestamp', {
        cell: TableCell,
        header: () => <span>TimeStamp</span>,
        meta: {
            type: "datetime-local"
        }
    }),
    columnHelper.accessor('value', {
        cell: TableCell,
        header: () => <span>Flow (m3/s) or<br/>Rainfall (mm/hr)</span>,
        meta: {
            type: "number"
        }
    })
];
console.log('columns:', columns);


const HydrologyTimeSeries = ({ activeHydrologyItem, replaceTimeSeriesRowData, updateTimeSeriesRowData }) => {
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());

    const trackEvent = (page) => {
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    };

    const parsePastedData = (pastedData) => {
        console.log('parsePastedData', pastedData);
        return pastedData.split('\n')
            .filter(row => row.trim() !== '')
            .map((row) => {
                const [timestampStr, valueStr] = row.split('\t');
                const isoTimestampStr = moment(timestampStr, "YYYY-MM-DD HH:mm").toISOString().slice(0, -1);
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
                console.log('send replaceTimeSeriesRowData', activeHydrologyItem.id, newRowData);
                replaceTimeSeriesRowData(activeHydrologyItem.id, newRowData);
                setChartData(activeHydrologyItem?.getChartData());
                setRowData(newRowData);
            }
        };

        const pasteDiv = pasteDivRef.current;
        if (pasteDiv) {
            console.log('*** added');
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
        data: rowData,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                updateTimeSeriesRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                setChartData(activeHydrologyItem?.getChartData());
            }
        }
    });

    return (
        <React.Fragment>
            <div style={{
                display: "flex",
                alignItems: "baseline",
                boxSizing: 'border-box',
                paddingTop: "5px"
            }}>
                <p style={{marginRight: '5px', width: "100px"}}>Paste Data:</p>
                <input
                    ref={pasteDivRef}
                    id={'name'}
                    key={`name-paste`}
                    type={"text"}
                    className={'hydrology-text-input'}
                    style={{textAlign: "left"}}
                    value={''}
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
                    <div className="">
                        <h3 style={{marginTop: 0}}>Time Series</h3>
                        <table className={'time-series-table'}>
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
                        <h3 style={{marginTop: 0}}>Time Series</h3>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: 'white',
                            borderRadius: '3px'
                        }}>
                            <ResponsiveContainer
                                width="100%"
                                height={400}
                            >
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
                                            const endDate = new Date(Math.max(...chartData.map(d => d.timestamp)));
                                            const startDate = new Date(Math.min(...chartData.map(d => d.timestamp)));
                                            const deltaDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                            const dateObj = new Date(unixTime);
                                            if (deltaDays < 7) {
                                                return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;
                                            }
                                            return dateObj.toLocaleDateString();
                                        }}
                                    >
                                    </XAxis>
                                    <YAxis
                                        name="Rate"
                                        label={{
                                            value: "Flow (m3/s) or Rainfall (mm/hr)",
                                            angle: -90,
                                            position: "insideLeft",
                                            offset: 20,
                                            dy: 100
                                        }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        fill="#8884d8"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};

HydrologyTimeSeries.propTypes = {
    activeHydrologyItem: PropTypes.object,
    setActiveHydrologyItem: PropTypes.func,
    activeHydrologyPage: PropTypes.string
};

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        updateTimeSeriesRowData: (timeSeriesId, rowIndex, columnId, value) => dispatch(updateTimeSeriesRowData(timeSeriesId, rowIndex, columnId, value)),
        replaceTimeSeriesRowData: (timeSeriesId, newRowData) => dispatch(replaceTimeSeriesRowData(timeSeriesId, newRowData))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTimeSeries);
