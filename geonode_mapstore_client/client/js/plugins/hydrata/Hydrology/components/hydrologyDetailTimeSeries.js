import React, {useState, useEffect, useRef, useCallback} from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-grid.css';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-theme-blue.css';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Rectangle,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter
} from 'recharts';
import {
    setActiveHydrologyItem,
    updateTimeSeriesRowData
} from "../actionsHydrology";

import { CustomEvent } from "@piwikpro/react-piwik-pro";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import moment from "moment";


const HydrologyTimeSeries = ({ activeHydrologyItem, updateTimeSeriesRowData }) => {
    const [columnDefs, setColumnDefs] = useState(activeHydrologyItem?.columnDefs);
    const [rowData, setRowData] = useState(activeHydrologyItem?.rowData);
    const [chartData, setChartData] = useState(activeHydrologyItem?.getChartData());
    const [gridApi, setGridApi] = useState(null);
    const [gridOptions, setGridOptions] = useState({
        headerAutoHeight: true,
        headerHeight: 50,
        enableRangeSelection: true
    });
    useEffect(() => {
        setColumnDefs(activeHydrologyItem?.columnDefs);
        setRowData(activeHydrologyItem?.rowData);
        setChartData(activeHydrologyItem?.getChartData());
    }, [activeHydrologyItem, rowData, columnDefs]);

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

    const parsePastedData = (pastedData) => {
        return pastedData.split('\n')
            .filter(row => row.trim() !== '')
            .map((row) => {
                const [timestampStr, valueStr] = row.split('\t');
                const isoTimestampStr = moment(timestampStr, "YYYY-MM-DD HH:mm").toISOString();
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
                let parsedData = parsePastedData(pastedData);
                // setRowData(parsedData);
                updateTimeSeriesRowData(activeHydrologyItem.id, parsedData);
            }
        };

        const pasteDiv = pasteDivRef.current;
        if (pasteDiv) {
            console.log('*** added');
            pasteDiv.addEventListener('paste', handlePaste);
        }

        // Always return a cleanup function
        return () => {
            if (pasteDiv) {
                pasteDiv.removeEventListener('paste', handlePaste);
            }
        };
    }, [activeHydrologyItem]);

    console.log("*** columnDefs", columnDefs);
    console.log("*** rowData", rowData);
    console.log("*** chartData", chartData);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="label">{`Date : ${new Date(label).toLocaleDateString()}`}</p>
                    <p className="intro">{`Value : ${payload[0].value}`}</p>
                </div>
            );
        }

        return null;
    };

    return (
        <React.Fragment>
            <h3 style={{marginTop: 0}}>TimeSeries</h3>
            <div
                id={'pasteDiv'}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                }}
                ref={pasteDivRef}
            >
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
                            onGridReady={ params => {setGridApi(params.api);}}
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
                            <ScatterChart
                                width={500}
                                height={300}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey={'timestamp'}
                                    name={'timestamp'}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                                    type="number"
                                    label={{ value: 'Timestamp', position: 'insideBottom' }} // Added label here
                                />
                                <YAxis dataKey={'value'} name={'value'}/>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Scatter name={'Values'} data={chartData} fill={'#8884d8'}/>
                            </ScatterChart>
                        </ResponsiveContainer>
                        <ResponsiveContainer
                            width="100%"
                            height={400}
                        >
                            <BarChart
                                width={500}
                                height={300}
                                data={chartData}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="timestamp"
                                    type="number"
                                    domain={['auto', 'auto']}
                                    tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                                    label={{ value: 'Timestamp', position: 'insideBottom' }}
                                >
                                </XAxis>
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
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
        updateTimeSeriesRowData: (timeSeriesId, rowData) => dispatch(updateTimeSeriesRowData(timeSeriesId, rowData))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyTimeSeries);
