import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {BarChart, Bar, XAxis, YAxis, Rectangle, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTemporalPatternRowData
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

const TableCell = ({getValue, row, column, table}) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);
    const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, value);
    };
    return (
        <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            type={column.columnDef.meta?.type || "text"}
        />
    );
};

const columnHelper = createColumnHelper();

const columns = [
    columnHelper.accessor('percentage', {
        cell: TableCell,
        header: () => <span>Percentage</span>,
        meta: {
            type: "number"
        }
    })
];
console.log('columns:', columns);

const HydrologyTemporalPattern = ({ activeHydrologyItem, updateTemporalPatternRowData }) => {
    const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
    const handleWindowResize = () => {
        setWindowWidth(window.innerWidth);
    };
    useEffect(() => {
        window.addEventListener('resize', handleWindowResize);
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);
    const trackEvent = (page) => {
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    };

    // Table
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());
    useEffect(() => {
        setColumnDefs(activeHydrologyItem?.columnDefs);
        setRowData(activeHydrologyItem?.rowData);
        setChartData(activeHydrologyItem?.getChartData());
    }, [activeHydrologyItem]);

    const table = useReactTable({
        columns: columns,
        data: rowData,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex, columnId, value) => {
                updateTemporalPatternRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                setChartData(activeHydrologyItem?.getChartData());
            }
        }
    });

    return (
        <div style={{display: 'flex', flexDirection: 'row', boxSizing: 'border-box'}}>
            <div style={{
                padding: '10px',
                height: '600px',
                width: '200px',
                marginBottom: '60px',
                marginRight: '50px'
            }}>
                <h3 style={{marginTop: 0}}>Intensity (mm/hr)</h3>
                <div className="">
                    <table className={'temporal-pattern-table'}>
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
            <div style={{
                width: '100%',
                padding: '10px'
            }}>
                <h3 style={{marginTop: 0}}>Temporal Pattern</h3>
                <div style={{
                    width: '100%',
                    height: '600px',
                    background: 'white',
                    borderRadius: '3px'
                }}>
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <BarChart
                            data={chartData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="name"/>
                            <YAxis
                                domain={[0, 50]}
                                ticks={[0, 10, 20, 30, 40, 50]}
                            />
                            <Tooltip/>
                            <Legend/>
                            <Bar
                                dataKey="percentage"
                                fill="#5178af"
                                isAnimationActive={false}
                                activeBar={<Rectangle fill="#5178af" stroke="#3585b0"/>}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

HydrologyTemporalPattern.propTypes = {
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
        updateTemporalPatternRowData: (temporalPatternId, rowIndex, columnId, value) => dispatch(updateTemporalPatternRowData(temporalPatternId, rowIndex, columnId, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTemporalPattern);
