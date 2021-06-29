import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
const { mapIdSelector } = require('../../../selectors/map');
import {setMenuGroup } from "../../ProjectManager/actionsProjectManager";
import {fetchScenariosConfig, toggleScenarioManager, showScenarioOverview, hideScenarioManager} from "../actionsScenarios";
import {ScenarioOverview} from "./scenarioOverview";

// eslint-disable-next-line camelcase
const menuGroupsSelector = (state) => state?.projectManager?.data?.map_store_menu_groups || [];

const panelStyle = {
    position: "absolute",
    zIndex: 1021,
    top: "85px",
    left: "20px",
    minWidth: "400px",
    backgroundColor: "rgba(0,60,136,0.6)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    padding: "5px 10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "4px",
    color: "white",
    textAlign: "center"
};

const buttonStyle = {
    position: "absolute",
    zIndex: 1021,
    top: 11,
    width: "85px",
    height: "60px",
    backgroundColor: "rgba(0,60,136,0.5)",
    borderColor: "rgb(255 255 255 / 70%)",
    borderWidth: "2px",
    padding: "3px 5px",
    fontSize: "12px",
    lineHeight: "1.3",
    borderRadius: "4px",
    color: "white",
    textAlign: "center"
};

const glyphStyle = {
    background: "#ffffff",
    borderRadius: "3px",
    margin: "5px",
    marginRight: "20px",
    color: "#092336",
    fontSize: "10px"
};

const rowStyle = {
    borderBottom: "1px solid #ffffffad",
    paddingLeft: "5px",
    margin: 0
};

const btnGroupStyle = {
    display: "inline-block",
    verticalAlign: "middle"
};

const textStyle = {
    textAlign: "left",
    whiteSpace: "nowrap",
    paddingLeft: "3px"
};


class ScenariosContainer extends React.Component {
    static propTypes = {
        fetchScenariosConfig: PropTypes.func,
        fetchScenariosDetailConfig: PropTypes.func,
        toggleScenarioManager: PropTypes.func,
        hideScenarioManager: PropTypes.func,
        showScenarioOverview: PropTypes.func,
        visibleScenarioManager: PropTypes.bool,
        visibleScenarioOverview: PropTypes.bool,
        mapId: PropTypes.number,
        setMenuGroup: PropTypes.func,
        hasScenarioConfig: PropTypes.bool,
        config: PropTypes.array,
        numberOfMenus: PropTypes.number,
        userRole: PropTypes.string
    };

    static defaultProps = {
        fetchScenariosConfig: () => {}
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        if (!this.props.mapId && !this.isFetching) {
            this.isFetching = false;
        }
        if (this.props.mapId && !this.props.hasScenarioConfig && !this.isFetching) {
            this.props.fetchScenariosConfig(this.props.mapId);
            this.isFetching = true;
        }
        if (this.props.mapId && this.props.hasScenarioConfig) {
            this.isFetching = false;
        }
    }

    componentDidUpdate() {
        if (!this.props.mapId && !this.isFetching) {
            this.isFetching = false;
        }
        if (this.props.mapId && !this.props.hasScenarioConfig && !this.isFetching) {
            this.props.fetchScenariosConfig(this.props.mapId);
            this.isFetching = true;
        }
        if (this.props.mapId && this.props.hasScenarioConfig) {
            this.isFetching = false;
        }
    }

    render() {
        if (this.props.userRole !== 'ADMIN') {
            return null;
        }
        return (
            <div id={"scenarios-container"}>
                <div>
                    <ul className="menu-groups">
                        <button
                            key={'scenarios'}
                            style={{...buttonStyle, left: (this.props.numberOfMenus + 4) * 100 + 20}}
                            onClick={() => {
                                this.props.toggleScenarioManager();
                                this.props.setMenuGroup('app_scenario');
                            }}>
                            { this.isFetching ? 'Scenarios' : 'Scenarios'}
                        </button>
                    </ul>
                </div>
                {
                    this.props.visibleScenarioManager ?
                        <div style={{...panelStyle}}>
                            { this.props.config?.map(
                                (scen) =>
                                    <div className={"row"} style={{...rowStyle}} key={scen.slug}>
                                        <div className={"btn-group inline pull-left"} style={{...btnGroupStyle}}>
                                            <div
                                                className={"btn glyphicon glyphicon-pencil"}
                                                style={{...glyphStyle}}
                                                onClick={() => {
                                                    this.props.showScenarioOverview(scen);
                                                    this.props.hideScenarioManager();
                                                }}
                                            />
                                            <div className="h5" style={textStyle}>{scen?.title}</div>
                                        </div>
                                    </div>
                            )}
                        </div> :
                        null
                }
                {this.props.visibleScenarioOverview ?
                    <div>
                        <ScenarioOverview/>
                    </div>
                    : null
                }
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        mapId: mapIdSelector(state),
        visibleScenarioManager: state?.scenarios?.visibleScenarioManager && (state.projectManager?.openMenuGroup === 'app_scenario' || !state.projectManager?.openMenuGroup),
        visibleScenarioOverview: state?.scenarios?.visibleScenarioOverview,
        hasScenarioConfig: state?.scenarios?.hasScenarioConfig,
        openMenuGroup: state?.projectManager?.openMenuGroup,
        config: state?.scenarios?.config,
        numberOfMenus: state?.projectManager?.data?.map_store_menu_groups?.length,
        userRole: state?.security?.user?.role
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        fetchScenariosConfig: fetchScenariosConfig(dispatch),
        toggleScenarioManager: () => dispatch(toggleScenarioManager()),
        hideScenarioManager: () => dispatch(hideScenarioManager()),
        showScenarioOverview: (scen) => dispatch(showScenarioOverview(scen)),
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ScenariosContainer);
