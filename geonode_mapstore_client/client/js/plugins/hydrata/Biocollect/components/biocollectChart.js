import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Col, Grid, Row, ButtonGroup} from "react-bootstrap";
import {formatMoney} from "../../Utils/utils";
import {setVisibleBiocollectChart} from "../actionsBiocollect";
const {Cell, BarChart, Bar, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import '../biocollect.css';

class BiocollectChartClass extends React.Component {
    static propTypes = {
        setVisibleBiocollectChart: PropTypes.func,
        visibleBiocollectChart: PropTypes.bool,
        currentBiocollectSurveySiteId: PropTypes.string,
        swampsSurveyData: PropTypes.array
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
                        <h4 style={{padding: "0", margin: "0"}} id={'test'}>Survey Sites</h4>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Grid>
                        <Col sm={2}>
                            <Row className={'well'} style={{paddingTop: "0"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Survey Sites</h4>
                                <ButtonGroup>
                                    {this.props.swampsSurveyData?.map((site) => {
                                        return (
                                            <Button
                                                bsStyle="info"
                                                bsSize="xsmall"
                                                block
                                                style={{width: "200px", marginTop: "4px", fontSize: "x-small"}}>
                                                {site.properties.name}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </Row>
                            <Row className={'well'} style={{paddingTop: "20px"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Sort Data By:</h4>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 1
                                    </Button>
                                </div>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 2
                                    </Button>
                                </div>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 3
                                    </Button>
                                </div>
                            </Row>
                        </Col>
                        <Col sm={9}>
                            {this.props.swampsSurveyData?.map((site) => {
                                return (
                                    <div>
                                        <h4>{site?.properties?.name}</h4>
                                        {JSON.parse(site?.properties?.activities).map((activity) => {
                                            return (
                                                <React.Fragment>
                                                    <pre>{activity?.outputs?.[0]?.data?.dataList?.map((kv) => {
                                                        return (
                                                            <p>{kv.key}: {JSON.stringify(kv.value)}</p>
                                                        );
                                                    })}</pre>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                );
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
        visibleBiocollectChart: state?.biocollect?.visibleBiocollectChart,
        swampsSurveyData: state?.biocollect?.swampsSurveyData
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleBiocollectChart: (visible) => dispatch(setVisibleBiocollectChart(visible))
    };
};

const BiocollectChart = connect(mapStateToProps, mapDispatchToProps)(BiocollectChartClass);


export default BiocollectChart;
