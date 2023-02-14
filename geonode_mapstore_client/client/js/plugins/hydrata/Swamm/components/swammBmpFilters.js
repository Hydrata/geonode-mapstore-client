import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Col, Row} from "react-bootstrap";
import {
    setExpandedFilter,
    toggleBmpTypeVisibility,
    toggleBmpGroupProfileVisibility,
    toggleBmpStatusVisibility,
    setAllBmpTypesVisibility,
    toggleBmpPriorityVisibility
} from "../actionsSwamm";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import {
    bmpFootprintLayerSelector,
    bmpOutletLayerSelector,
    bmpWatershedLayerSelector
} from "@js/plugins/hydrata/Swamm/selectorsSwamm";

class SwammBmpFiltersClass extends React.Component {
    static propTypes = {
        bmpTypes: PropTypes.array,
        expandedFilter: PropTypes.string,
        setExpandedFilter: PropTypes.func,
        bmpFilter: PropTypes.object,
        changeLayerProperties: PropTypes.func,
        toggleBmpTypeVisibility: PropTypes.func,
        toggleBmpGroupProfileVisibility: PropTypes.func,
        toggleBmpStatusVisibility: PropTypes.func,
        setAllBmpTypesVisibility: PropTypes.func,
        toggleBmpPriorityVisibility: PropTypes.func,
        bmpWatershedLayer: PropTypes.object,
        bmpFootprintLayer: PropTypes.object,
        bmpOutletLayer: PropTypes.object,
        priorities: PropTypes.object,
        groupProfiles: PropTypes.object,
        statuses: PropTypes.object
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
                                                        <span className="menu-row-text">{bmpType?.name}</span>
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
                        <div className={"row menu-row pull-left"} style={{width: "480px", textAlign: "left"}}>
                            <span
                                className={"inline btn glyphicon menu-row-glyph " + (this.props.expandedFilter === "status" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                style={{color: "white", background: "none"}}
                                onClick={() => {this.props.setExpandedFilter('status');}}
                            />
                            <span className="inline h5 menu-row-text"><strong>Filter by BMP status</strong></span>
                            {
                                this.props.expandedFilter === "status" ?
                                    <React.Fragment>
                                        <hr style={{margin: "0"}}/>
                                        <Row>
                                            {
                                                this.props.statuses.map((status, index) => (
                                                    <Col sm={6} className={"row menu-row filter-row " + (index % 2 ? "filter-row-odd" : '')}>
                                                        <span
                                                            className={"btn glyphicon menu-row-glyph " + (status?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                            style={{"color": status?.visibility ? "limegreen" : "red"}}
                                                            onClick={() => this.props.toggleBmpStatusVisibility(status)}
                                                        />
                                                        <span className="menu-row-text">{status?.name}</span>
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
                                className={"inline btn glyphicon menu-row-glyph " + (this.props.expandedFilter === "groupProfile" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                style={{color: "white", background: "none"}}
                                onClick={() => {this.props.setExpandedFilter('groupProfile');}}
                            />
                            <span className="inline h5 menu-row-text"><strong>Filter by Organization</strong></span>
                            {
                                this.props.expandedFilter === "groupProfile" ?
                                    <React.Fragment>
                                        <Row>
                                            {
                                                this.props.groupProfiles.map((groupProfile, index) => (
                                                    <Col sm={6} className={"row menu-row filter-row " + (index < ((this.props.groupProfiles?.length / 2) + 1) ? "filter-row-odd" : '')}>
                                                        <span
                                                            className={"btn glyphicon menu-row-glyph " + (groupProfile?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                            style={{"color": groupProfile?.visibility ? "limegreen" : "red"}}
                                                            onClick={() => this.props.toggleBmpGroupProfileVisibility(groupProfile)}
                                                        />
                                                        <span className="menu-row-text">{groupProfile.title}</span>
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
    const validGroupProfiles = state?.swamm?.groupProfiles.filter(item => !["anonymous", "registered-members", "admin", "swamm-users", "illinois-pork-producers"].includes(item.slug));
    // console.log('validGroupProfiles:', validGroupProfiles);
    const viewableGroupProfiles = validGroupProfiles.filter(item => state?.swamm?.projectData?.permitted_groups.map(permittedGroup => permittedGroup.pk)?.includes(item.pk));
    // console.log('viewableGroupProfiles:', viewableGroupProfiles);
    viewableGroupProfiles.sort((a, b) => a.title.localeCompare(b.title));
    // console.log('viewableGroupProfiles:', viewableGroupProfiles);
    // console.log('allowedGroupProfiles', allowedGroupProfiles);
    return {
        mapId: state?.swamm?.data?.base_map,
        projectData: state?.swamm?.data,
        bmpTypes: state?.swamm?.bmpTypes,
        statuses: state?.swamm?.statuses,
        groupProfiles: viewableGroupProfiles,
        layers: state?.layers,
        query: state?.query,
        expandedFilter: state?.swamm?.expandedFilter,
        bmpFilter: state?.swamm?.bmpFilter,
        bmpOutletLayer: bmpOutletLayerSelector(state),
        bmpFootprintLayer: bmpFootprintLayerSelector(state),
        bmpWatershedLayer: bmpWatershedLayerSelector(state),
        priorities: state?.swamm?.priorities
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setExpandedFilter: (filterName) => dispatch(setExpandedFilter(filterName)),
        changeLayerProperties: (layerId, filterObj) => dispatch(changeLayerProperties(layerId, filterObj)),
        toggleBmpTypeVisibility: (bmpType) => dispatch(toggleBmpTypeVisibility(bmpType)),
        toggleBmpGroupProfileVisibility: (groupProfile) => dispatch(toggleBmpGroupProfileVisibility(groupProfile)),
        toggleBmpStatusVisibility: (status) => dispatch(toggleBmpStatusVisibility(status)),
        setAllBmpTypesVisibility: (boolValue) => dispatch(setAllBmpTypesVisibility(boolValue)),
        toggleBmpPriorityVisibility: (priority) => dispatch(toggleBmpPriorityVisibility(priority))
    };
};

const SwammBmpFilters = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFiltersClass);


export {
    SwammBmpFilters
};
