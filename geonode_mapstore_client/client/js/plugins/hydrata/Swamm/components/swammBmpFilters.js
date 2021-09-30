import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Col, Row} from "react-bootstrap";
import {
    setExpandedFilter,
    toggleBmpTypeVisibility,
    setAllBmpTypesVisibility,
    toggleBmpPriorityVisibility
} from "../actionsSwamm";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";

class SwammBmpFiltersClass extends React.Component {
    static propTypes = {
        bmpTypes: PropTypes.array,
        expandedFilter: PropTypes.string,
        setExpandedFilter: PropTypes.func,
        bmpFilter: PropTypes.object,
        changeLayerProperties: PropTypes.func,
        toggleBmpTypeVisibility: PropTypes.func,
        setAllBmpTypesVisibility: PropTypes.func,
        toggleBmpPriorityVisibility: PropTypes.func,
        bmpWatershedLayer: PropTypes.object,
        bmpFootprintLayer: PropTypes.object,
        bmpOutletLayer: PropTypes.object,
        priorities: PropTypes.object
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <React.Fragment>
                <div id={'swamm-bmp-filters'} className={'simple-view-panel'} style={{top: "175px", width: "480px"}}>
                    <div className={'menu-rows-container'}>
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"inline btn glyphicon menu-row-glyph " + (this.props.expandedFilter === "bmpType" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                style={{color: "white", background: "none"}}
                                onClick={() => {this.props.setExpandedFilter('bmpType');}}
                            />
                            <span className="inline h5 menu-row-text"><strong>Filter by BMP type</strong></span>
                            {
                                this.props.expandedFilter === "bmpType" ?
                                    <React.Fragment>
                                        <span
                                            className={"inline btn glyphicon menu-row-glyph glyphicon-check"}
                                            style={{"color": "limegreen", marginLeft: "30px"}}
                                            onClick={() => {
                                                this.props.setAllBmpTypesVisibility(true);
                                            }}
                                        />
                                        <span className="inline h5 menu-row-text">Select All</span>
                                        <span
                                            className={"inline btn glyphicon menu-row-glyph glyphicon-unchecked"}
                                            style={{"color": "red", marginLeft: "30px"}}
                                            onClick={() => {
                                                this.props.setAllBmpTypesVisibility(false);
                                            }}
                                        />
                                        <span className="inline h5 menu-row-text">Select None</span>
                                        <hr style={{margin: "0"}}/>
                                        <Row>
                                            {
                                                this.props.bmpTypes.map((bmpType, index) => (
                                                    <Col sm={6} className={"row menu-row filter-row " + (index % 2 ? "filter-row-odd" : '')}>
                                                        <span
                                                            className={"btn glyphicon menu-row-glyph " + (bmpType?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                            style={{"color": bmpType?.visibility ? "limegreen" : "red"}}
                                                            onClick={() => this.props.toggleBmpTypeVisibility(bmpType)}
                                                        />
                                                        <span className="menu-row-text">{bmpType.name}</span>
                                                    </Col>
                                                ))
                                            }
                                        </Row>
                                    </React.Fragment>
                                    : null
                            }
                        </div>
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"inline btn glyphicon menu-row-glyph " + (this.props.expandedFilter === "priority" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                style={{color: "white", background: "none"}}
                                onClick={() => {this.props.setExpandedFilter('priority');}}
                            />
                            <span className="inline h5 menu-row-text"><strong>Filter by BMP priority</strong></span>
                            {
                                this.props.expandedFilter === "priority" ?
                                    <React.Fragment>
                                        <hr style={{margin: "0"}}/>
                                        <Row>
                                            {
                                                this.props.priorities.map((priority, index) => (
                                                    <Col sm={6} className={"row menu-row filter-row " + (index % 2 ? "filter-row-odd" : '')}>
                                                        <span
                                                            className={"btn glyphicon menu-row-glyph " + (priority?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                            style={{"color": priority?.visibility ? "limegreen" : "red"}}
                                                            onClick={() => this.props.toggleBmpPriorityVisibility(priority)}
                                                        />
                                                        <span className="menu-row-text">{priority.label}</span>
                                                    </Col>
                                                ))
                                            }
                                        </Row>
                                    </React.Fragment>
                                    : null
                            }
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }

    handleChange(event) {
        console.log(event);
    }
}

const mapStateToProps = (state) => {
    return {
        mapId: state?.swamm?.data?.base_map,
        projectData: state?.swamm?.data,
        bmpTypes: state?.swamm?.bmpTypes,
        layers: state?.layers,
        query: state?.query,
        expandedFilter: state?.swamm?.expandedFilter,
        bmpFilter: state?.swamm?.bmpFilter,
        bmpOutletLayer: state?.swamm?.bmpOutletLayer,
        bmpFootprintLayer: state?.swamm?.bmpFootprintLayer,
        bmpWatershedLayer: state?.swamm?.bmpWatershedLayer,
        priorities: state?.swamm?.priorities
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setExpandedFilter: (filterName) => dispatch(setExpandedFilter(filterName)),
        changeLayerProperties: (layerId, filterObj) => dispatch(changeLayerProperties(layerId, filterObj)),
        toggleBmpTypeVisibility: (bmpType) => dispatch(toggleBmpTypeVisibility(bmpType)),
        setAllBmpTypesVisibility: (boolValue) => dispatch(setAllBmpTypesVisibility(boolValue)),
        toggleBmpPriorityVisibility: (priority) => dispatch(toggleBmpPriorityVisibility(priority))
    };
};

const SwammBmpFilters = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFiltersClass);


export {
    SwammBmpFilters
};
