import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {
    setExpandedFilter,
    toggleBmpTypeVisibility,
    toggleBmpGroupProfileVisibility,
    toggleBmpStatusVisibility,
    setAllBmpTypesVisibility,
    setExpandedBmpTypeGroupName,
    toggleBmpTypeGroup,
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
        statuses: PropTypes.object,
        groupProfiles: PropTypes.object,
        bmpTypeGroups: PropTypes.array,
        expandedBmpTypeGroupName: PropTypes.string,
        toggleBmpTypeGroup: PropTypes.func,
        setExpandedBmpTypeGroupName: PropTypes.func,
        setGroupBmpTypesVisibility: PropTypes.func
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
                        <div className={"row menu-row menu-row-bmp-filter pull-left"}>
                            <span
                                className={"inline btn glyphicon bmp-filter-group-glyph " + (this.props.expandedFilter === "bmpType" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                onClick={() => {this.props.setExpandedFilter('bmpType');}}
                            />
                            <span className="menu-row-text"><div>Filter by BMP type</div></span>
                        </div>
                        { this.props.expandedFilter === "bmpType" ?
                            <div className="bmp-filter-group-expanded-panel">
                                {this.props.bmpTypeGroups?.map((group) => {
                                    return (
                                        <div
                                            key={`group-${group}`}
                                            className={"bmp-filter-group-heading"}
                                        >
                                            <div className={"bmp-filter-type-row"}>
                                                <span
                                                    style={{marginLeft: "15px"}}
                                                    className={"btn glyphicon bmp-type-group-glyph" + (this.props.expandedBmpTypeGroupName === group[0] ? " glyphicon-chevron-down bmp-type-group-bottom-margin" : " glyphicon-chevron-right")}
                                                    onClick={
                                                        this.props.expandedBmpTypeGroupName === group[0] ?
                                                            () => this.props.setExpandedBmpTypeGroupName(null) :
                                                            () => this.props.setExpandedBmpTypeGroupName(group[0])
                                                    }
                                                />
                                                <span className="bmp-type-group-name">
                                                    {group[1]}
                                                </span>
                                                <span
                                                    className={"btn glyphicon menu-row-glyph bmp-filter-type-heading-last-item" + (group?.[2] ? " glyphicon-ok" : " glyphicon-remove")}
                                                    style={{"color": group?.[2] ? "limegreen" : "red"}}
                                                    onClick={() => {
                                                        this.props.toggleBmpTypeGroup(group);
                                                    }}
                                                />
                                            </div>
                                            {
                                                this.props.expandedBmpTypeGroupName === group[0] ?
                                                    this.props.bmpTypes
                                                        .filter(bmpType => bmpType.group_name === group[0])
                                                        .map(bmpType => {
                                                            return (
                                                                <div
                                                                    key={`bmpType-${bmpType?.name}`}
                                                                    className={"bmp-filter-group-selector-row"}
                                                                >
                                                                    <span
                                                                        id={`bmp-type-toggle-box-${bmpType?.name}`}
                                                                        className={"btn glyphicon menu-row-glyph " + (bmpType?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                                        style={{"color": bmpType?.visibility ? "limegreen" : "red"}}
                                                                        onClick={() => {
                                                                            this.props.toggleBmpTypeVisibility(bmpType);
                                                                        }}
                                                                    />
                                                                    <label
                                                                        htmlFor={`bmp-type-selector-box-${bmpType?.name}`}
                                                                        style={{marginLeft: "6px", verticalAlign: "middle"}}
                                                                    >
                                                                        {bmpType?.name}
                                                                    </label>
                                                                </div>
                                                            );
                                                        })
                                                    : null
                                            }
                                        </div>
                                    );
                                })}
                            </div>
                            : null
                        }
                        <div className={"row menu-row menu-row-bmp-filter pull-left"}>
                            <span
                                className={"inline btn glyphicon bmp-filter-group-glyph " + (this.props.expandedFilter === "priority" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                onClick={() => {this.props.setExpandedFilter('priority');}}
                            />
                            <span className="menu-row-text"><div>Filter by BMP priority</div></span>
                        </div>
                        { this.props.expandedFilter === "priority" ?
                            <div className="bmp-filter-group-expanded-panel">
                                {this.props.priorities?.map((priority, index) => {
                                    return (
                                        <div
                                            key={`priority-${priority}`}
                                            className={"bmp-filter-group-selector-row filter-row " + (index % 2 ? "filter-row-odd" : '')}
                                        >
                                            <span
                                                id={`bmp-type-toggle-box-${priority}`}
                                                className={"btn glyphicon menu-row-glyph " + (priority?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                style={{"color": priority?.visibility ? "limegreen" : "red"}}
                                                onClick={() => {
                                                    this.props.toggleBmpPriorityVisibility(priority);
                                                }}
                                            />
                                            <label
                                                htmlFor={`bmp-type-selector-box-${priority}`}
                                                style={{marginLeft: "6px", verticalAlign: "middle"}}
                                            >
                                                {priority.label}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            : null
                        }
                        <div className={"row menu-row menu-row-bmp-filter pull-left"}>
                            <span
                                className={"inline btn glyphicon bmp-filter-group-glyph " + (this.props.expandedFilter === "status" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                onClick={() => {this.props.setExpandedFilter('status');}}
                            />
                            <span className="menu-row-text"><div>Filter by BMP status</div></span>
                        </div>
                        {
                            this.props.expandedFilter === "status" ?
                                <div className="bmp-filter-group-expanded-panel">
                                    {
                                        this.props.statuses.map((status, index) => {
                                            return (
                                                <div
                                                    key={`status-${status}`}
                                                    className={"bmp-filter-group-selector-row filter-row " + (index % 2 ? "filter-row-odd" : '')}
                                                >
                                                    <span
                                                        id={`bmp-type-toggle-box-${status}`}
                                                        className={"btn glyphicon menu-row-glyph " + (status?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                        style={{"color": status?.visibility ? "limegreen" : "red"}}
                                                        onClick={() => {
                                                            this.props.toggleBmpStatusVisibility(status);
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`bmp-type-selector-box-${status}`}
                                                        style={{marginLeft: "6px", verticalAlign: "middle"}}
                                                    >
                                                        {status?.name}
                                                    </label>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                                : null
                        }
                        <div className={"row menu-row menu-row-bmp-filter pull-left"}>
                            <span
                                className={"inline btn glyphicon bmp-filter-group-glyph " + (this.props.expandedFilter === "groupProfile" ? "glyphicon-chevron-down" : "glyphicon-chevron-right")}
                                onClick={() => {this.props.setExpandedFilter('groupProfile');}}
                            />
                            <span className="menu-row-text"><div>Filter by Organization</div></span>
                        </div>
                        {
                            this.props.expandedFilter === "groupProfile" ?
                                <div className="bmp-filter-group-expanded-panel">
                                    {
                                        this.props.groupProfiles.map((groupProfile, index) => {
                                            return (
                                                <div
                                                    key={`groupProfile-${groupProfile}`}
                                                    className={"bmp-filter-group-selector-row filter-row " + (index < ((this.props.groupProfiles?.length / 2) + 1) ? "filter-row-odd" : '')}>
                                                >
                                                    <span
                                                        id={`bmp-type-toggle-box-${groupProfile}`}
                                                        className={"btn glyphicon menu-row-glyph " + (groupProfile?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                                                        style={{"color": groupProfile?.visibility ? "limegreen" : "red"}}
                                                        onClick={() => {
                                                            this.props.toggleBmpGroupProfileVisibility(groupProfile);
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`bmp-type-selector-box-${groupProfile}`}
                                                        style={{marginLeft: "6px", verticalAlign: "middle"}}
                                                    >
                                                        {groupProfile?.title}
                                                    </label>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                                : null
                        }
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
        statuses: state?.swamm?.statuses,
        groupProfiles: viewableGroupProfiles,
        layers: state?.layers,
        query: state?.query,
        expandedFilter: state?.swamm?.expandedFilter,
        bmpFilter: state?.swamm?.bmpFilter,
        bmpOutletLayer: bmpOutletLayerSelector(state),
        bmpFootprintLayer: bmpFootprintLayerSelector(state),
        bmpWatershedLayer: bmpWatershedLayerSelector(state),
        priorities: state?.swamm?.priorities,
        bmpTypes: state?.swamm?.bmpTypes,
        bmpTypeGroups: state?.swamm?.bmpTypeGroups || [],
        expandedBmpTypeGroupName: state?.swamm?.expandedBmpTypeGroupName
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
        toggleBmpPriorityVisibility: (priority) => dispatch(toggleBmpPriorityVisibility(priority)),
        setExpandedBmpTypeGroupName: (expandedBmpTypeGroupName) => dispatch(setExpandedBmpTypeGroupName(expandedBmpTypeGroupName)),
        toggleBmpTypeGroup: (bmpTypeGroup) => dispatch(toggleBmpTypeGroup(bmpTypeGroup))
    };
};

const SwammBmpFilters = connect(mapStateToProps, mapDispatchToProps)(SwammBmpFiltersClass);


export {
    SwammBmpFilters
};
