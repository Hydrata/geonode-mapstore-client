import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import {fetchProjectManagerConfig, setMenuGroup} from "../actionsProjectManager";
import {MenuDatasetRows} from './projectManagerMenuDatasetRows';
import LegendPanel from "./legendPanel";

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

class ProjectManagerContainer extends React.Component {
    static propTypes = {
        fetchProjectManagerConfig: PropTypes.func,
        menuGroups: PropTypes.array,
        baseMapMenuGroup: PropTypes.object,
        mapId: PropTypes.number,
        layers: PropTypes.array,
        projectTitle: PropTypes.string,
        isFetching: PropTypes.bool,
        hasPmData: PropTypes.object,
        openMenuGroup: PropTypes.string,
        setMenuGroup: PropTypes.func,
        menu: PropTypes.object
    };

    static defaultProps = {
        fetchProjectManagerConfig: () => {}
    };

    constructor(props) {
        super(props);
    }

    componentDidUpdate() {
        if (!this.props.mapId && !this.fetching) {
            this.fetching = false;
        }
        if (this.props.mapId && !this.props.hasPmData && !this.fetching) {
            this.props.fetchProjectManagerConfig(this.props.mapId);
            this.fetching = true;
        }
        if (this.props.mapId && this.props.hasPmData) {
            this.fetching = false;
        }
    }

    render() {
        return (
            <div id={"project-manager-container"}>
                <div>
                    <ul className="menu-groups">
                        <button
                            key={'basemaps'}
                            style={{...buttonStyle, left: 20}}
                            onClick={() => {this.props.setMenuGroup(this.props.baseMapMenuGroup);}}>
                            BaseMaps
                        </button>
                        {this.props.menuGroups && this.props.menuGroups.length && this.props.menuGroups.map(
                            (menu, index) => {
                                return (
                                    <button
                                        key={menu.title}
                                        style={{...buttonStyle, left: (index + 1) * 100 + 20}}
                                        onClick={() => {this.props.setMenuGroup(menu);}}>
                                        {menu.title}
                                    </button>
                                );
                            })
                        }
                    </ul>
                </div>
                {(() => {
                    switch (this.props?.openMenuGroup) {
                    case null: return null;
                    case undefined: return null;
                    case "app_scenario": return <div id={"app-scenario-empty-div"}/>;
                    // case "app_networks": return <NetworksContainer/>;
                    default: return (
                        <div style={{...panelStyle}}>
                            <MenuDatasetRows/>
                        </div>
                    );
                    }
                })()}
                <LegendPanel/>
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    // console.log('state for mapId:', state);
    return {
        mapId: state?.map?.present?.info?.id,
        layers: state?.layers?.flat.map(layer => layer.name),
        // eslint-disable-next-line camelcase
        menuGroups: menuGroupsSelector(state),
        baseMapMenuGroup: {id: 0, id_label: 'basemaps', title: 'Base Maps'},
        projectTitle: state?.projectManager?.data?.title,
        isFetching: state?.projectManager?.fetching,
        hasPmData: state?.projectManager?.data,
        openMenuGroup: state?.projectManager?.openMenuGroup?.id_label
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        fetchProjectManagerConfig: fetchProjectManagerConfig(dispatch),
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ProjectManagerContainer);
