import React, {useState, useEffect, useRef} from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, LabelList, Tooltip, ResponsiveContainer} from 'recharts';
import {
    setActiveHydrologyItem,
    updateIdfRowData
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
    columnHelper.accessor('duration', {
        cell: TableCell,
        header: () => <span>Duration (min)</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('0-5yrARI', {
        cell: TableCell,
        header: () => <span>0.5yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('1yrARI', {
        cell: TableCell,
        header: () => <span>1yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('2yrARI', {
        cell: TableCell,
        header: () => <span>2yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('5yrARI', {
        cell: TableCell,
        header: () => <span>5yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('10yrARI', {
        cell: TableCell,
        header: () => <span>10yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('20yrARI', {
        cell: TableCell,
        header: () => <span>20yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('50yrARI', {
        cell: TableCell,
        header: () => <span>50yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('100yrARI', {
        cell: TableCell,
        header: () => <span>100yr</span>,
        meta: {
            type: "number"
        }
    }),
    columnHelper.accessor('500yrARI', {
        cell: TableCell,
        header: () => <span>500yr</span>,
        meta: {
            type: "number"
        }
    })
];
console.log('columns:', columns);

const HydrologyDetailIdfTable = ({ activeHydrologyItem, updateIdfRowData }) => {
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
    const flexDirection = windowWidth < 1800 ? 'column' : 'row';
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
                updateIdfRowData(activeHydrologyItem.id, rowIndex, columnId, value);
                setChartData(activeHydrologyItem?.getChartData());
            }
        }
    });

    // console.log("*** columnDefs", columnDefs);
    // console.log("*** rowData", rowData);
    // console.log("*** table", table);
    // console.log("*** table.getCoreRowModel()", table.getCoreRowModel());
    const colours = ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6dcd59", "#b8de29", "#fde725"];
    return (
        <div style={{display: 'flex', flexDirection: flexDirection, boxSizing: 'border-box'}}>
            <div style={{padding: '10px', height: '600px', minWidth: '600px', maxWidth: '800px', marginBottom: '60px'}}>
                <h3 style={{marginTop: 0}}>Intensity (mm/hr)</h3>
                <div className="">
                    <table className={'idf-table'}>
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
                <h3 style={{marginTop: 0}}>IDF Curve</h3>
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
                                        name={frequency}
                                        data={chartData[frequency]}
                                        fill={colours[index % colours.length]}
                                        line
                                        shape={({ cx, cy, fill }) => <circle cx={cx} cy={cy} r={3} fill={fill} />}
                                    >
                                        <LabelList
                                            dataKey="label"
                                            content={ (props) => {
                                                const {x, y, value} = props;
                                                return <text x={x + 10} y={y + 10} fill={"#000"}>{value}</text>;
                                            }}
                                        />
                                    </Scatter>
                                );
                            })}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

HydrologyDetailIdfTable.propTypes = {
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
        updateIdfRowData: (idfTableId, rowIndex, columnId, value) => dispatch(updateIdfRowData(idfTableId, rowIndex, columnId, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfTable);
