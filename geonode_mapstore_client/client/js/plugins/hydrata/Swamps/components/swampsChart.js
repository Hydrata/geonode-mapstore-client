import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Col, Grid, Row, ButtonGroup} from "react-bootstrap";
import moment from 'moment';
import {formatMoney} from "../../Utils/utils";
import {setVisibleSwampsChart,
    setCurrentSwampsSurveySiteId,
    setSelectedXKey,
    setSelectedYKey
} from "../actionsSwamps";
const {ScatterChart, Scatter, LineChart, Line, CartesianGrid, Label, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import '../swamps.css';

class SwampsChartClass extends React.Component {
    static propTypes = {
        setVisibleSwampsChart: PropTypes.func,
        setCurrentSwampsSurveySiteId: PropTypes.func,
        visibleSwampsChart: PropTypes.bool,
        currentSwampsSurveySiteId: PropTypes.string,
        currentSwampsSurveySite: PropTypes.object,
        swampsSurveyData: PropTypes.array,
        lineChartData: PropTypes.array,
        setSelectedXKey: PropTypes.func,
        setSelectedYKey: PropTypes.func,
        availableXKeys: PropTypes.array,
        availableYKeys: PropTypes.array,
        selectedXKey: PropTypes.string,
        selectedYKey: PropTypes.string
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <div id={'swamps-chart'}>
                <h1>Swamps</h1>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        currentSwampsSurveySiteId: state?.swamps?.currentSwampsSurveySiteId,
        currentSwampsSurveySite: state?.swamps?.swampsSurveyData?.filter((site) => site.properties.site_id === state?.swamps?.currentSwampsSurveySiteId)[0],
        visibleSwampsChart: state?.swamps?.visibleSwampsChart,
        swampsSurveyData: state?.swamps?.swampsSurveyData,
        selectedXKey: state?.swamps?.selectedXKey || 'time',
        selectedYKey: state?.swamps?.selectedYKey || '',
        availableXKeys: state?.swamps?.processedSwampsSurveyData?.[state?.swamps?.currentSwampsSurveySiteId]?.availableXKeys || ['time'],
        availableYKeys: state?.swamps?.processedSwampsSurveyData?.[state?.swamps?.currentSwampsSurveySiteId]?.availableYKeys || [],
        lineChartData: state?.swamps?.processedSwampsSurveyData?.[state?.swamps?.currentSwampsSurveySiteId]?.data || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleSwampsChart: (visible) => dispatch(setVisibleSwampsChart(visible)),
        setCurrentSwampsSurveySiteId: (siteId) => dispatch(setCurrentSwampsSurveySiteId(siteId)),
        setSelectedXKey: (xKey) => dispatch(setSelectedXKey(xKey)),
        setSelectedYKey: (yKey) => dispatch(setSelectedYKey(yKey))
    };
};

const SwampsChart = connect(mapStateToProps, mapDispatchToProps)(SwampsChartClass);


export default SwampsChart;
