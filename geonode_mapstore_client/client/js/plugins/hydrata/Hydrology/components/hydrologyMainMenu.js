import React from "react";
import {connect} from "react-redux";
import {Button} from "react-bootstrap";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyItem
} from "../actionsHydrology";
import {HydrologyListDetailContainer} from "./hydrologyListDetailContainer";
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {trackEvent} from "@js/utils/analytics";
import PropTypes from "prop-types";
import Message from '@mapstore/framework/components/I18N/Message';
// TASK-1440 (W9): Networks tab in the Hydrology panel.
import {NetworksPane} from '../../shared/NetworksPane';

class HydrologyMainMenuClass extends React.Component {
    static propTypes = {
        activeHydrologyPage: PropTypes.string,
        setHydrologyMainMenu: PropTypes.func,
        setActiveHydrologyItem: PropTypes.func,
        setActiveHydrologyPage: PropTypes.func,

        setOpenMenuGroupId: PropTypes.func
    }

    static defaultProps = {
        activeHydrologyPage: "idf-table"
    }

    constructor(props) {
        super(props);
    }
    renderButton = (pageName, label) => (
        <Button
            bsSize={'medium'}
            style={this.buttonStyle(pageName)}
            onClick={() => {
                this.props.setActiveHydrologyPage(pageName);
                this.props.setActiveHydrologyItem(null);
                this.props.setOpenMenuGroupId(null);
                trackEvent('button', `click`, `hydrology-active-menu-set-${pageName}`);
            }}
        >
            {label}
        </Button>
    )

    render() {
        const isNetworksTab = this.props.activeHydrologyPage === 'networks';
        return (
            <div id={'hydrology-main-menu'} className={'simple-view-panel'} style={{
                top: "70px",
                position: "fixed",
                width: "95%",
                height: "85%",
                backgroundColor: "rgba(0, 60, 136, 0.99)"
            }}>
                <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                    <span style={{top: "8px", position: "relative"}}><Message msgId="hydrata.hydrology.hydrology" /></span>
                    <span id={"hydrology-page-button-group"}>
                        {this.renderButton('idf-table', <Message msgId="hydrata.hydrology.idfTables" />)}
                        {this.renderButton('idf-derive', <Message msgId="hydrata.hydrology.idfDerive" />)}
                        {this.renderButton('temporal-pattern', <Message msgId="hydrata.hydrology.temporalPatterns" />)}
                        {this.renderButton('time-series', <Message msgId="hydrata.hydrology.timeseries" />)}
                        {this.renderButton('inflow', <Message msgId="hydrata.hydrology.inflows" />)}
                        {/* TASK-1440 (W9): Networks tab — rendered by the shared NetworksPane component */}
                        {this.renderButton('networks', <Message msgId="hydrata.anuga.networks" />)}
                    </span>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={
                            () => {
                                this.props.setHydrologyMainMenu(false);
                                this.props.setActiveHydrologyPage(null);
                                trackEvent('button', `click`, `anuga-scenario-menu-close`);
                            }
                        }
                    />
                </div>
                {/* TASK-1440: Networks tab bypasses HydrologyListDetailContainer (different UX pattern) */}
                {isNetworksTab
                    ? <div id={"hydrology-networks-tab-body"} style={{padding: '10px', overflowY: 'auto', height: 'calc(100% - 40px)'}}>
                        <NetworksPane/>
                    </div>
                    : <HydrologyListDetailContainer/>
                }
            </div>
        );
    }

    buttonStyle = (page) => ({
        width: "145px",
        margin: "2px 0 -17px 20px",
        borderRadius: "6px 6px 0 0",
        borderBottom: 0,
        color: this.props.activeHydrologyPage === page ? "#3363a0" : 'white',
        backgroundColor: this.props.activeHydrologyPage === page ? "white" : '#6085b5'
    })

    trackEvent = (page) => {
        trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    }
}

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setActiveHydrologyPage: (pageName) => dispatch(setActiveHydrologyPage(pageName)),
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId)),
        setHydrologyMainMenu: (visible) => dispatch(setHydrologyMainMenu(visible))
    };
};

const HydrologyMainMenu = connect(mapStateToProps, mapDispatchToProps)(HydrologyMainMenuClass);


export {
    HydrologyMainMenu,
    // TASK-1440: exported for unit tests that need the unconnected class.
    HydrologyMainMenuClass
};
