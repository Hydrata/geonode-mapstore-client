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
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";

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
                CustomEvent.trackEvent('button', `click`, `hydrology-active-menu-set-${pageName}`);
            }}
        >
            {label}
        </Button>
    )

    render() {
        return (
            <div id={'hydrology-main-menu'} className={'simple-view-panel'} style={{
                top: "70px",
                position: "fixed",
                width: "95%",
                height: "85%",
                backgroundColor: "rgba(0, 60, 136, 0.99)"
            }}>
                <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                    <span style={{top: "8px", position: "relative"}}>Hydrology</span>
                    <span id={"hydrology-page-button-group"}>
                        {this.renderButton('idf-table', 'IDF Tables')}
                        {this.renderButton('temporal-pattern', 'Temporal Patterns')}
                        {this.renderButton('time-series', 'Timeseries')}
                        {/*{this.renderButton('inflows', 'Inflows')}*/}
                    </span>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={
                            () => {
                                this.props.setHydrologyMainMenu(false);
                                this.props.setActiveHydrologyPage(null);
                                console.log(`tracking anuga-scenario-menu-close`);
                                CustomEvent.trackEvent('button', `click`, `anuga-scenario-menu-close`);
                            }
                        }
                    />
                </div>
                <HydrologyListDetailContainer/>
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
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
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
    HydrologyMainMenu
};
