import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Grid, Col, Row, Button} from "react-bootstrap";
import moment from 'moment';
const {ScatterChart, LineChart, Line, Scatter, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip, Brush} = require('recharts');
import {setVisibleSwampsChart,
    setSelectedSwampId,
    clearSelectedSwamp,
    toggleSelectionOfSiteId,
    toggleSelectionOfSurveyTypeKey,
    setSelectedXKey,
    setSelectedYKey
} from "../actionsSwamps";
import '../swamps.css';

class SwampsChartClass extends React.Component {
    static propTypes = {
        setVisibleSwampsChart: PropTypes.func,
        visibleSwampsChart: PropTypes.bool,
        setSelectedSwampId: PropTypes.func,
        clearSelectedSwamp: PropTypes.func,
        selectedSwampId: PropTypes.string,
        selectedSwampData: PropTypes.object,
        toggleSelectionOfSiteId: PropTypes.func,
        toggleSelectionOfSurveyTypeKey: PropTypes.func,
        availableSites: PropTypes.array,
        availableSurveyTypeKeys: PropTypes.array,
        selectedSurveyTypeKeys: PropTypes.array,
        selectedSiteIds: PropTypes.array,
        selectedActivities: PropTypes.object,
        availableActivityFields: PropTypes.array,
        selectedActivityFields: PropTypes.array,
        selectedActivites: PropTypes.array,
        setSelectedXKey: PropTypes.func,
        setSelectedYKey: PropTypes.func,
        availableXKeys: PropTypes.array,
        availableYKeys: PropTypes.array,
        selectedXKey: PropTypes.string,
        selectedYKey: PropTypes.string,
        data1: PropTypes.array,
        data2: PropTypes.array,
        data3: PropTypes.array
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div id={'swamps-chart'}>
                <div className="chart-header">
                    <h2 style={{display: "inline"}}>
                        Swamp ID: {this.props.selectedSwampId?.split('.')[1]} {this.props.selectedSwampData?.name}
                    </h2>
                    <span
                        className={"pull-right btn glyphicon glyphicon-remove"}
                        style={{color: "red", right: "-10px", top: "-10px"}}
                        onClick={() => {
                            this.props.clearSelectedSwamp();
                            this.props.setVisibleSwampsChart(false);
                        }}
                    />
                </div>
                <div className="chart-mainbody">
                    <Grid style={{width: "100%"}}>
                        <Col sm={2} className={'chart-sidebar'} style={{maxWidth: "250px"}}>
                            <Row>
                                <h4 style={{marginTop: '20px'}}>Select Survey Sites:</h4>
                                {
                                    this.props.availableSites.map((site) => {
                                        return (
                                            <Button
                                                bsStyle="success"
                                                bsSize="xsmall"
                                                block
                                                style={{
                                                    backgroundColor: this.props.selectedSiteIds?.includes(site.site_id) ? "#175582ff" : "#175582aa",
                                                    borderColor: "#175582ff",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px"
                                                }}
                                                onClick={() => this.props.toggleSelectionOfSiteId(site?.site_id)}>
                                                {site?.name}
                                            </Button>
                                        );
                                    })
                                }
                                <h4 style={{marginTop: '20px'}}>Select Survey Types:</h4>
                                {
                                    this.props.availableSurveyTypeKeys.map((surveyTypeKey) => {
                                        return (
                                            <Button
                                                bsStyle="success"
                                                bsSize="xsmall"
                                                block
                                                style={{
                                                    backgroundColor: this.props.selectedSurveyTypeKeys?.includes(surveyTypeKey) ? "#175582ff" : "#175582aa",
                                                    borderColor: "#175582ff",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px"
                                                }}
                                                onClick={() => this.props.toggleSelectionOfSurveyTypeKey(surveyTypeKey)}>
                                                {surveyTypeKey}
                                            </Button>
                                        );
                                    })
                                }
                                <h4 style={{marginTop: '20px'}}>Select Survey Attribute:</h4>
                                {
                                    this.props.availableActivityFields.map((field) => {
                                        return (
                                            <Button
                                                bsStyle="success"
                                                bsSize="xsmall"
                                                block
                                                style={{
                                                    backgroundColor: this.props.selectedYKey === field ? "#175582ff" : "#175582aa",
                                                    borderColor: "#175582ff",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px"
                                                }}
                                                onClick={() => this.props.setSelectedYKey(field)}>
                                                {field}
                                            </Button>
                                        );
                                    })
                                }
                            </Row>
                        </Col>
                        <Col sm={10}>
                            <ResponsiveContainer width="95%" height={400} >
                                <LineChart
                                    width={500}
                                    height={400}
                                    syncId="swampCharts"
                                    data={this.props.selectedActivities}
                                >
                                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                                    <XAxis
                                        dataKey={this.props.selectedXKey}
                                        domain={['auto', 'auto']}
                                        name={this.props.selectedXKey}
                                        tickFormatter={(unixTime) => moment(unixTime).format('Do MMM YYYY')}
                                        type="number"
                                        unit="time"
                                        label="XAxisLabel"
                                    />
                                    <YAxis
                                        yAxisId={'left'}
                                        type="number"
                                        dataKey={this.props.selectedYKey}
                                        name={this.props.selectedYKey}
                                        orientation="left"
                                        stroke="#175582"
                                        label="YAxisLabel"
                                    />
                                    <Line
                                        yAxisId={'left'}
                                        dataKey={this.props.selectedYKey}
                                        line={{ stroke: '#175582' }}
                                        shape="circle"
                                        fill="#175582"
                                        lineType="joint"
                                        name={this.props.selectedYKey}
                                    />
                                    <Tooltip />
                                    <Brush/>
                                </LineChart>
                            </ResponsiveContainer>
                        </Col>
                    </Grid>
                </div>
                <div className="chart-footer">
                    Footer
                </div>
            </div>
        );
    }
}

const data1 = [
    { date: new Date(2019, 4, 30).getTime(), value1: 5000, value2: 6000 },
    { date: new Date(2019, 5, 30).getTime(), value1: 4000, value2: 3000 },
    { date: new Date(2019, 6, 21).getTime(), value1: 6000, value2: 8000 },
    { date: new Date(2019, 6, 28).getTime(), value1: 2000, value2: 3000 }
];
const data2 = [
    { date: new Date(2019, 4, 30).getTime(), value1: 6000 },
    { date: new Date(2019, 5, 15).getTime(), value1: 5000 },
    { date: new Date(2019, 6, 21).getTime(), value1: 7000 },
    { date: new Date(2019, 6, 28).getTime(), value1: 3000 }
];

const mapStateToProps = (state) => {
    return {
        selectedSwampId: state?.swamps?.selectedSwampId,
        selectedSwampData: state?.swamps?.selectedSwampData,
        visibleSwampsChart: state?.swamps?.visibleSwampsChart,
        selectedXKey: state?.swamps?.selectedXKey || 'unix_survey_date_time',
        selectedYKey: state?.swamps?.selectedYKey || 'value1',
        availableXKeys: state?.swamps?.processedSwampsSurveyData?.[state?.swamps?.currentSwampsSurveySiteId]?.availableXKeys || ['time'],
        availableYKeys: state?.swamps?.processedSwampsSurveyData?.[state?.swamps?.currentSwampsSurveySiteId]?.availableYKeys || [],
        availableSites: state?.swamps?.selectedSwampData?.sites || [],
        selectedSiteIds: state?.swamps?.selectedSiteIds || [],
        availableSurveyTypeKeys: state?.swamps?.availableSurveyTypeKeys || [],
        selectedSurveyTypeKeys: state?.swamps?.selectedSurveyTypeKeys || [],
        selectedActivities: state?.swamps?.selectedActivities || {},
        availableActivityFields: state?.swamps?.availableActivityFields || [],
        selectedActivityFields: state?.swamps?.selectedActivityFields || [],
        selectedActivites: state?.swamps?.selectedActivites || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleSwampsChart: (visible) => dispatch(setVisibleSwampsChart(visible)),
        setSelectedSwampId: (siteId) => dispatch(setSelectedSwampId(siteId)),
        clearSelectedSwamp: () => dispatch(clearSelectedSwamp()),
        setSelectedXKey: (xKey) => dispatch(setSelectedXKey(xKey)),
        setSelectedYKey: (yKey) => dispatch(setSelectedYKey(yKey)),
        toggleSelectionOfSiteId: (siteId) => dispatch(toggleSelectionOfSiteId(siteId)),
        toggleSelectionOfSurveyTypeKey: (surveyKey) => dispatch(toggleSelectionOfSurveyTypeKey(surveyKey))
    };
};

const SwampsChart = connect(mapStateToProps, mapDispatchToProps)(SwampsChartClass);


export default SwampsChart;
