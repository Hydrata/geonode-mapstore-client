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
// TASK-1760 (epic-1758 W1): chassis primitives — the panel shell + header now
// compose from PanelShell/PanelHeader so the dark-glass chrome is shared and
// the close chip is the cascade-safe sv-panel-header-close (NOT the
// position:absolute .sv-legend-close that overlapped the title — red-team item 4).
import {PanelShell, PanelHeader} from '../../SimpleView/components/primitives';

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
        // Default matches reducer initialState (sv-idf-table = Input-first; UAT 2026-06-23).
        activeHydrologyPage: "sv-idf-table"
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
            // TASK-1760 — PanelShell carries the dark-glass chrome (componentized
            // form of .simple-view-panel). The .simple-view-panel(--miller) classes
            // are kept via extraClassName because the panel BODY relies on them as
            // cascade anchors (.simple-view-panel input theming, the --miller
            // scrollbar rules). The miller-specific box overrides (fixed position,
            // min(1280px,96vw) × 85% size, top:70, padding:0) ride the style prop.
            <PanelShell
                extraClassName={'simple-view-panel simple-view-panel--miller'}
                style={{
                    position: 'fixed',
                    top: 70,
                    left: 20,
                    width: 'min(1280px, 96vw)',
                    minWidth: 'min(1280px, 96vw)',
                    height: '85%',
                    maxHeight: '85%',
                    padding: 0,
                    textAlign: 'left'
                }}
            >
                {/* Header — PanelHeader renders a cascade-SAFE close chip
                    (sv-panel-header-close, position:static), closing the
                    .sv-legend-close{position:absolute} trap the old miller header hit. */}
                <PanelHeader
                    title={<Message msgId="hydrata.hydrology.hydrology" />}
                    onClose={() => {
                        this.props.setHydrologyMainMenu(false);
                        this.props.setActiveHydrologyPage(null);
                        trackEvent('button', 'click', 'hydrology-panel-close');
                    }}
                />
                {/* Body: LHS rail + RHS detail */}
                <div className={"sv-hydrology-miller-body"}>
                    <HydrologyCategoryRail
                        activeHydrologyPage={this.props.activeHydrologyPage}
                        onSelectCategory={this.handleSelectCategory}
                    />
                    <div className={"sv-hydrology-detail-pane"}>
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
            </PanelShell>
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
