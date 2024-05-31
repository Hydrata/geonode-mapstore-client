import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-grid.css';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-theme-blue.css';
import {BarChart, Bar, XAxis, YAxis, Rectangle, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTimeSeriesRowData
} from "../actionsHydrology";

import { CustomEvent } from "@piwikpro/react-piwik-pro";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import moment from "moment";


const HydrologyDetailInflow = ({ activeHydrologyItem, updateTimeSeriesRowData }) => {
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
            <h3 style={{marginTop: 0}}>HydrologyInflow</h3>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    padding: '10px',
                    height: '300px',
                    width: '600px',
                    borderRadius: '3px'
                }}>
                    <div
                        className="ag-theme-blue"
                    >
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            onCellValueChanged={event => {
                                updateTimeSeriesRowData(activeHydrologyItem.id, event.data);
                            }}
                            gridOptions={gridOptions}
                        />
                    </div>
                </div>
                <div style={{
                    minWidth: '600px',
                    marginTop: '20px',
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
                            height={400}
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
                                <XAxis
                                    dataKey="timestamp"
                                    scale={'time'}
                                    domain={['auto', 'auto']}
                                />
                                <YAxis
                                    domain={[0, 'auto']}
                                />
                                <Tooltip/>
                                <Legend/>
                                <Bar
                                    dataKey="value"
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

HydrologyDetailInflow.propTypes = {
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
        updateTimeSeriesRowData: (timeSeriesId, rowData) => dispatch(updateTimeSeriesRowData(timeSeriesId, rowData))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailInflow);
