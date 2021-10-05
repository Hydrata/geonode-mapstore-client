import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Grid, Col, Row, Button} from "react-bootstrap";
import {setVisibleSwampsChart,
    setCurrentSwampId,
    clearCurrentSwamp,
    setSelectedXKey,
    setSelectedYKey
} from "../actionsSwamps";
import '../swamps.css';

class SwampsChartClass extends React.Component {
    static propTypes = {
        setVisibleSwampsChart: PropTypes.func,
        setCurrentSwampId: PropTypes.func,
        clearCurrentSwamp: PropTypes.func,
        visibleSwampsChart: PropTypes.bool,
        currentSwampId: PropTypes.string,
        currentSwampData: PropTypes.object,
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
                <div className="chart-header">
                    <h2 style={{display: "inline"}}>
                        id: {this.props.currentSwampId?.split('.')[1]}
                    </h2>
                    <span
                        className={"pull-right btn glyphicon glyphicon-remove"}
                        style={{color: "red", right: "-10px", top: "-10px"}}
                        onClick={() => {
                            this.props.clearCurrentSwamp();
                            this.props.setVisibleSwampsChart(false);
                        }}
                    />
                </div>
                <div className="chart-mainbody">
                    <Grid>
                        <Col sm={2}>
                            {
                                this.props.currentSwampData?.properties ?
                                    (Object.entries(this.props.currentSwampData?.properties).map(([key, value]) => {
                                        return (
                                            <div style={{textAlign: "left"}}>
                                                {key}: {value}
                                            </div>
                                        );
                                    })) :
                                    null
                            }
                            {
                                this.props.currentSwampData?.sites ?
                                    (Object.entries(this.props.currentSwampData?.sites).map(([key, value]) => {
                                        return (
                                            <div style={{textAlign: "left"}}>
                                                {key}: <pre>{JSON.stringify(value)}</pre>
                                            </div>
                                        );
                                    })) :
                                    null
                            }
                        </Col>
                        <Col sm={10}>
                            data
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

const mapStateToProps = (state) => {
    return {
        currentSwampId: state?.swamps?.currentSwampId,
        currentSwampData: state?.swamps?.currentSwampData,
        visibleSwampsChart: state?.swamps?.visibleSwampsChart,
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
        setCurrentSwampId: (siteId) => dispatch(setCurrentSwampId(siteId)),
        clearCurrentSwamp: () => dispatch(clearCurrentSwamp()),
        setSelectedXKey: (xKey) => dispatch(setSelectedXKey(xKey)),
        setSelectedYKey: (yKey) => dispatch(setSelectedYKey(yKey))
    };
};

const SwampsChart = connect(mapStateToProps, mapDispatchToProps)(SwampsChartClass);


export default SwampsChart;
