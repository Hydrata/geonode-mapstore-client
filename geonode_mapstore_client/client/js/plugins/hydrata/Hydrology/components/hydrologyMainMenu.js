import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyItem
} from "../actionsHydrology";
import {HydrologyListDetailContainer} from "./hydrologyListDetailContainer";
import {HydrologyCategoryRail} from "./hydrologyCategoryRail";
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {trackEvent} from "@js/utils/analytics";
import PropTypes from "prop-types";
import Message from '@mapstore/framework/components/I18N/Message';
// TASK-1440 (W9): Networks tab in the Hydrology panel.
import {NetworksPane} from '../../shared/NetworksPane';

/**
 * TASK-1448 (W1) — Hydrology panel shell redesigned to a LHS vertical
 * category rail (4 items) + right detail pane (miller layout).
 *
 * The old horizontal tab-button row is replaced by HydrologyCategoryRail.
 * Panel width: min(1280px, 96vw). The --sv-* theme vars and Bootstrap
 * glyphicons are reused from the Anuga scenarioCategoryRail idiom.
 */

class HydrologyMainMenuClass extends React.Component {
    static propTypes = {
        activeHydrologyPage: PropTypes.string,
        setHydrologyMainMenu: PropTypes.func,
        setActiveHydrologyItem: PropTypes.func,
        setActiveHydrologyPage: PropTypes.func,
        setOpenMenuGroupId: PropTypes.func
    }

    static defaultProps = {
        // TASK-1452 (W5): default matches reducer initialState (idf-derive = Derive-first).
        activeHydrologyPage: "idf-derive"
    }

    constructor(props) {
        super(props);
    }

    handleSelectCategory = (pageName) => {
        this.props.setActiveHydrologyPage(pageName);
        this.props.setActiveHydrologyItem(null);
        this.props.setOpenMenuGroupId(null);
    }

    render() {
        const isNetworksTab = this.props.activeHydrologyPage === 'networks';
        return (
            <div
                id={'hydrology-main-menu'}
                className={'simple-view-panel simple-view-panel--miller hydrology-miller-panel'}
            >
                {/* Header */}
                <div className={"hydrology-miller-header"}>
                    <span className={"hydrology-miller-title"}>
                        <Message msgId="hydrata.hydrology.hydrology" />
                    </span>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close hydrology-miller-close"}
                        onClick={() => {
                            this.props.setHydrologyMainMenu(false);
                            this.props.setActiveHydrologyPage(null);
                            trackEvent('button', 'click', 'hydrology-panel-close');
                        }}
                    />
                </div>
                {/* Body: LHS rail + RHS detail */}
                <div className={"hydrology-miller-body"}>
                    <HydrologyCategoryRail
                        activeHydrologyPage={this.props.activeHydrologyPage}
                        onSelectCategory={this.handleSelectCategory}
                    />
                    <div className={"hydrology-detail-pane"}>
                        {isNetworksTab
                            ? (
                                <div id={"hydrology-networks-tab-body"} style={{padding: '10px', overflowY: 'auto', height: '100%'}}>
                                    <NetworksPane/>
                                </div>
                            )
                            : <HydrologyListDetailContainer/>
                        }
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage
    };
};

const mapDispatchToProps = (dispatch) => {
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
