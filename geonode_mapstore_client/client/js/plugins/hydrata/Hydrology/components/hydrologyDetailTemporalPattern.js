import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-grid.css';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-theme-blue.css';
import {BarChart, Bar, XAxis, YAxis, Rectangle, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTemporalPatternRowData
} from "../actionsHydrology";

import { CustomEvent } from "@piwikpro/react-piwik-pro";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';


const HydrologyTemporalPattern = ({ activeHydrologyItem, updateTemporalPatternRowData }) => {
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
    const trackEvent = (page) => {
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    };

    console.log("*** columnDefs", columnDefs);
    console.log("*** rowData", rowData);
    return (
        <React.Fragment>
            <h3 style={{marginTop: 0}}>Temporal Patterns</h3>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    padding: '10px',
                    height: '520px',
                    width: '200px',
                    borderRadius: '3px'
                }}>
                    <div
                        className="ag-theme-blue"
                    >
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            onCellValueChanged={event => {
                                updateTemporalPatternRowData(activeHydrologyItem.id, event.data);
                            }}
                            gridOptions={gridOptions}
                        />
                    </div>
                </div>
                <div style={{
                    minWidth: '600px',
                    maxWidth: '800px',
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
                            height={500}
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
        </React.Fragment>
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
        updateTemporalPatternRowData: (temporalPatternId, rowData) => dispatch(updateTemporalPatternRowData(temporalPatternId, rowData))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTemporalPattern);
