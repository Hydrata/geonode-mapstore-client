import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Col, Grid, Row, Table} from "react-bootstrap";
import {formatMoney} from "../../Utils/utils";
import {setVisibleBiocollectChart} from "../actionsBiocollect";
const {Cell, BarChart, Bar, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import {closeIdentify} from "../../../../../MapStore2/web/client/actions/mapInfo";
import {selectNode} from "../../../../../MapStore2/web/client/actions/layers";
import {setLayer} from "../../../../../MapStore2/web/client/actions/featuregrid";
import {
    QUERY_RESULT,
    query,
    createQuery,
    FEATURE_TYPE_LOADED,
    FEATURE_TYPE_SELECTED,
    resetQuery,
    featureTypeSelected
} from "../../../../../MapStore2/web/client/actions/wfsquery";
import '../biocollect.css';
import LegendPanel from "../../SimpleView/components/simpleViewLegend";

class BiocollectChartClass extends React.Component {
    static propTypes = {
        closeIdentify: PropTypes.func,
        setLayer: PropTypes.func,
        msIdForSurveyLayer: PropTypes.string,
        query: PropTypes.func,
        createQuery: PropTypes.func,
        selectNode: PropTypes.func,
        setVisibleBiocollectChart: PropTypes.func,
        featureTypeSelected: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        // console.log('1mounted this.props:', this.props);
        // // this.props.closeIdentify();
        // this.props.setLayer(this.props.msIdForSurveyLayer);
        // this.props.featureTypeSelected('http://localhost:8080/geoserver/wfs', "geonode:swamps_surveysite");
        // // this.props.selectNode(this.props.msIdForSurveyLayer, "layer", false);
        // const url = "http://localhost:8000/gs/ows";
        // const filterObj = {
        //     "featureTypeName": "geonode:swamps_surveysite",
        //     "filterType": "OGC",
        //     "ogcVersion": "1.1.0",
        //     "pagination": {
        //         "startIndex": 0,
        //         "maxFeatures": 2000
        //     }
        // };
        // this.props.createQuery(url, filterObj);
        // this.props.query(
        //     url,
        //     filterObj,
        //     {},
        //     'swamps: get swamps_surveysite data'
        // );
        // console.log('2mounted this.props:', this.props);
    }


    render() {
        return (
            <Modal
                show
                onHide={() => console.log('onHide')}
            >
                <Modal.Header>
                    <Modal.Title style={{textAlign: "center"}}>
                        <h4 style={{padding: "0", margin: "0"}} id={'test'}>Modal Title</h4>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className={'biocollect-modal'}>
                    <Grid>
                        <Col sm={2}>
                            <Row className={'well'} style={{paddingTop: "0"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Sidebar</h4>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="info"
                                        bsSize="xsmall"
                                        block
                                        style={{marginTop: "4px", fontSize: "x-small"}}>
                                        New Target
                                    </Button>
                                </div>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="info"
                                        bsSize="xsmall"
                                        block
                                        style={{marginTop: "4px", fontSize: "x-small"}}>
                                        Edit Target
                                    </Button>
                                </div>
                            </Row>
                            <Row className={'well'} style={{paddingTop: "20px"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Sort Data By:</h4>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        BMP Type
                                    </Button>
                                </div>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Status
                                    </Button>
                                </div>
                                <div className={'row-no-gutters'}>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Organization
                                    </Button>
                                </div>
                            </Row>
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
        mapId: state?.swamm?.data?.base_map,
        msIdForSurveyLayer: state?.layers?.flat.filter((layer) => layer?.extraParams?.msId.includes('swamps_surveysite'))?.[0]?.extraParams?.msId || 'default'
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleBiocollectChart: (visible) => dispatch(setVisibleBiocollectChart(visible)),
        closeIdentify: () => dispatch(closeIdentify()),
        setLayer: (layerId) => dispatch(setLayer(layerId)),
        featureTypeSelected: (url, typeName) => dispatch(featureTypeSelected(url, typeName)),
        createQuery: (searchUrl, filterObj) => dispatch(createQuery(searchUrl, filterObj)),
        query: (searchUrl, filterObj, queryOptions, reason) => dispatch(query(searchUrl, filterObj, queryOptions, reason)),
        selectNode: (id, nodeType, ctrlKey) => dispatch(selectNode(id, nodeType, ctrlKey))
    };
};

const BiocollectChart = connect(mapStateToProps, mapDispatchToProps)(BiocollectChartClass);


export default BiocollectChart;
