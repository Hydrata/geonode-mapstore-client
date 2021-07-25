import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Col, Grid, Row, ButtonGroup} from "react-bootstrap";
import moment from 'moment';
import {formatMoney} from "../../Utils/utils";
import {setVisibleBiocollectChart,
    setCurrentBiocollectSurveySiteId,
    setSelectedXKey,
    setSelectedYKey
} from "../actionsBiocollect";
const {ScatterChart, Scatter, LineChart, Line, CartesianGrid, Label, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import '../biocollect.css';

class BiocollectChartClass extends React.Component {
    static propTypes = {
        setVisibleBiocollectChart: PropTypes.func,
        setCurrentBiocollectSurveySiteId: PropTypes.func,
        visibleBiocollectChart: PropTypes.bool,
        currentBiocollectSurveySiteId: PropTypes.string,
        currentBiocollectSurveySite: PropTypes.object,
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
            <Modal
                show
                dialogClassName={'biocollect-modal'}
                style={{top: "60px", width: "100%", minHeight: "500px"}}
            >
                <Modal.Header>
                    <Modal.Title style={{textAlign: "center"}}>
                        <h4 style={{padding: "0", margin: "0"}}>{this.props.currentBiocollectSurveySite?.properties?.name || "Select a Site"}</h4>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Grid>
                        <Col sm={2} style={{maxHeight: "800px", overflowY: 'scroll'}}>
                            <Row className={'well'} style={{paddingTop: "0"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Select Site</h4>
                                <ButtonGroup>
                                    {this.props.swampsSurveyData?.map((site) => {
                                        return (
                                            <Button
                                                bsStyle="info"
                                                bsSize="xsmall"
                                                block
                                                onClick={() => this.props.setCurrentBiocollectSurveySiteId(site?.properties?.site_id)}
                                                style={{
                                                    width: "150px",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px",
                                                    overflow: "hidden"
                                                }}>
                                                {site.properties.name}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </Row>
                            <Row className={'well'} style={{paddingTop: "20px"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Select Y data:</h4>
                                <ButtonGroup>
                                    {this.props.availableYKeys?.map((yKey) => {
                                        return (
                                            <Button
                                                bsStyle="success"
                                                bsSize="xsmall"
                                                block
                                                onClick={() => this.props.setSelectedYKey(yKey)}
                                                style={{
                                                    width: "150px",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                {yKey}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </Row>
                            <Row className={'well'} style={{paddingTop: "20px"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Select X data:</h4>
                                <ButtonGroup>
                                    {this.props.availableXKeys?.map((xKey) => {
                                        return (
                                            <Button
                                                bsStyle="success"
                                                bsSize="xsmall"
                                                block
                                                onClick={() => this.props.setSelectedXKey(xKey)}
                                                style={{
                                                    width: "150px",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                {xKey}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </Row>
                        </Col>
                        <Col sm={9}>
                            <ResponsiveContainer width="95%" height={500} >
                                <ScatterChart>
                                    <XAxis
                                        dataKey={this.props.selectedXKey}
                                        domain={['auto', 'auto']}
                                        name={this.props.selectedXKey}
                                        tickFormatter={(unixTime) => moment(unixTime).format('HH:mm Do MMM YYYY')}
                                        type="number"
                                        label={{ value: 'Pages', position: 'insideBottomRight', offset: 0 }}
                                    />
                                    <YAxis
                                        dataKey={this.props.selectedYKey}
                                        name={this.props.selectedYKey}
                                        label={{ value: 'Index', angle: -90, position: 'insideLeft' }}
                                    />
                                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                                    <Scatter
                                        data={this.props.lineChartData}
                                        line={{ stroke: '#8884d8' }}
                                        shape="circle"
                                        fill="#82ca9d"
                                        lineType="joint"
                                        name={this.props.selectedYKey}
                                    />
                                    <Tooltip
                                        formatter={(value, name, props) => {
                                            return moment(value).format('DD MMM YYYY');
                                        }}
                                    />
                                    <Legend />
                                </ScatterChart>
                            </ResponsiveContainer>
                            {this.props.swampsSurveyData?.map((site) => {
                                if (site.properties.site_id === this.props.currentBiocollectSurveySiteId) {
                                    return (
                                        <div>
                                            {JSON.parse(site?.properties?.activities).map((activity) => {
                                                return (
                                                    <React.Fragment>
                                                        <pre>
                                                            {activity?.outputs?.[0]?.name} {activity?.outputs?.[0]?.activityId}
                                                            {activity?.outputs?.[0]?.data?.dataList?.map((kv) => {
                                                                if (kv.key === (this.props.selectedYKey || 'time')) {
                                                                    return (
                                                                        <p>{kv.key}: {JSON.stringify(kv.value)}</p>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </pre>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </Col>
                    </Grid>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        bsStyle="danger"
                        bsSize="small"
                        style={{opacity: "0.7"}}
                        onClick={() => this.props.setVisibleBiocollectChart(false)}
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        currentBiocollectSurveySiteId: state?.biocollect?.currentBiocollectSurveySiteId,
        currentBiocollectSurveySite: state?.biocollect?.swampsSurveyData?.filter((site) => site.properties.site_id === state?.biocollect?.currentBiocollectSurveySiteId)[0],
        visibleBiocollectChart: state?.biocollect?.visibleBiocollectChart,
        swampsSurveyData: state?.biocollect?.swampsSurveyData,
        selectedXKey: state?.biocollect?.selectedXKey || 'time',
        selectedYKey: state?.biocollect?.selectedYKey || '',
        availableXKeys: state?.biocollect?.processedSwampsSurveyData?.[state?.biocollect?.currentBiocollectSurveySiteId]?.availableXKeys || ['time'],
        availableYKeys: state?.biocollect?.processedSwampsSurveyData?.[state?.biocollect?.currentBiocollectSurveySiteId]?.availableYKeys || [],
        lineChartData: state?.biocollect?.processedSwampsSurveyData?.[state?.biocollect?.currentBiocollectSurveySiteId]?.data || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleBiocollectChart: (visible) => dispatch(setVisibleBiocollectChart(visible)),
        setCurrentBiocollectSurveySiteId: (siteId) => dispatch(setCurrentBiocollectSurveySiteId(siteId)),
        setSelectedXKey: (xKey) => dispatch(setSelectedXKey(xKey)),
        setSelectedYKey: (yKey) => dispatch(setSelectedYKey(yKey))
    };
};

const BiocollectChart = connect(mapStateToProps, mapDispatchToProps)(BiocollectChartClass);


export default BiocollectChart;
