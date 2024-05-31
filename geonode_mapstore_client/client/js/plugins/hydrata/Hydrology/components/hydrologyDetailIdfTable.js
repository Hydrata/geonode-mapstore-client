import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-grid.css';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-theme-blue.css';
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {
    setActiveHydrologyItem,
    updateIdfRowData
} from "../actionsHydrology";

import { CustomEvent } from "@piwikpro/react-piwik-pro";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';


const HydrologyDetailIdfTable = ({ activeHydrologyItem, updateIdfRowData }) => {
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());
    const [gridOptions, setGridOptions] = useState({
        headerAutoHeight: true,
        headerHeight: 50
    });
    useEffect(() => {
        setColumnDefs(activeHydrologyItem?.columnDefs);
        setRowData(activeHydrologyItem?.rowData);
        setChartData(activeHydrologyItem?.getChartData());
        console.log('columnDefs:', columnDefs);
        console.log('rowData:', rowData);
        console.log('chartData:', chartData);
    }, [activeHydrologyItem]);

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
    const flexDirection = windowWidth < 2000 ? 'column' : 'row';
    const trackEvent = (page) => {
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    };
    const colors = [
        '#ff0000', // Red
        '#0000ff', // Blue
        '#ffff00', // Yellow
        '#008000', // Green
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#800000', // Maroon
        '#808000', // Olive
        '#800080', // Purple
        '#008080'  // Teal
    ];
    console.log("*** columnDefs", columnDefs);
    console.log("*** rowData", rowData);
    return (
        <div style={{
            display: 'flex',
            flexDirection: flexDirection,
            boxSizing: 'border-box'
        }}>
            <div style={{
                padding: '10px',
                height: '600px',
                minWidth: '600px',
                maxWidth: '800px'
            }}>
                <h3 style={{marginTop: 0}}>Intensity (mm/hr)</h3>
                <div
                    className="ag-theme-blue"
                >
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        onCellValueChanged={event => {updateIdfRowData(activeHydrologyItem.id, event.data);}}
                        gridOptions={gridOptions}
                    />
                </div>
            </div>
            <div style={{
                minWidth: '600px',
                maxWidth: '800px',
                marginTop: '60px',
                padding: '10px'
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'white',
                    borderRadius: '3px'
                }}>
                    <ResponsiveContainer
                        width="100%"
                        height={600}
                    >
                        <ScatterChart
                            margin={{
                                top: 20,
                                right: 20,
                                bottom: 20,
                                left: 20
                            }}
                        >
                            <CartesianGrid />
                            <XAxis
                                type="number"
                                dataKey="duration"
                                name="Duration"
                                unit="min"
                                scale="log"
                                domain={['auto', 'auto']}
                                label={{
                                    value: "Duration in min",
                                    position: "insideBottomRight",
                                    offset: 0
                                }}
                            />
                            <YAxis
                                type="number"
                                dataKey="intensity"
                                name="Intensity"
                                unit="mm/hr"
                                scale="log"
                                domain={['auto', 'auto']}
                                label={{
                                    value: "Intensity in mm/hr",
                                    angle: -90,
                                    position: "insideLeft"
                                }}
                            />
                            <ZAxis type="number" range={[100]} />
                            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                            <Legend />
                            {Object.keys(chartData).map((frequency, index) => {
                                return (
                                    <Scatter
                                        name={frequency}
                                        data={chartData[frequency]}
                                        fill={colors[index]}
                                        line
                                    />
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
        updateIdfRowData: (idfTableId, rowData) => dispatch(updateIdfRowData(idfTableId, rowData))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfTable);
