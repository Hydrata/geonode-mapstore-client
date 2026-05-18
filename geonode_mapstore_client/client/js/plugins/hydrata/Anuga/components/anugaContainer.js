import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    setPublicationPanel,
    startAnugaScenarioPolling,
    stopAnugaScenarioPolling,
    setMembershipPanel
} from '../actionsAnuga';
import {canEditAnugaMap, canViewAnugaMap, canManageMembers, canCreateScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {AnugaInputMenu} from './anugaInputMenu';
import {AnugaScenarioMenu} from './anugaScenarioMenu';
import {PublicationPanel} from './publicationPanel';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {NetworkMenu} from "./networkMenu";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {setHydrologyMainMenu} from "../../Hydrology/actionsHydrology";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {AnugaRunMenu} from "@js/plugins/hydrata/Anuga/components/anugaRunMenu";
import {MembershipPanel} from "./membershipPanel";
import {trackEvent} from "@js/utils/analytics";

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        showAnugaInputMenu: PropTypes.bool,
        setAnugaInputMenu: PropTypes.func,
        showAnugaScenarioMenu: PropTypes.bool,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaResultMenu: PropTypes.bool,
        setAnugaResultMenu: PropTypes.func,
        showNetworkMenu: PropTypes.bool,
        setPublicationPanel: PropTypes.func,
        showPublicationPanel: PropTypes.bool,
        isAnugaMenuOpen: PropTypes.bool,
        openMenuGroupId: PropTypes.string,
        numberOfMenus: PropTypes.number,
        setOpenMenuGroupId: PropTypes.func,
        showAddAnugaTerrainData: PropTypes.bool,
        setAddAnugaTerrainData: PropTypes.func,
        // Wave 3B (B5) — reducer initial state is `false`, selector
        // returns the scenario id (number) once the log opens. Widen the
        // type so the boolean-on-init case doesn't trip a PropType warning.
        visibleAnugaScenarioLogId: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
        startAnugaScenarioPolling: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        updateCustomEditorsOptions: PropTypes.func,
        logText: PropTypes.string,
        gnResourceLoaded: PropTypes.string,
        visibleAnugaRunMenu: PropTypes.bool,
        canEditAnugaMap: PropTypes.bool,
        canViewAnugaMap: PropTypes.bool,
        canManageMembers: PropTypes.bool,
        canCreateScenario: PropTypes.bool,
        showMembershipPanel: PropTypes.bool,
        setMembershipPanel: PropTypes.func,
        hasEPSGset: PropTypes.bool,
        resultsGroup: PropTypes.object,
        // Wave 3B (B5) — mapStateToProps returns
        // `state?.anuga?.projects?.data?.id` (a number) rather than a
        // boolean coercion. Widen the type so the number doesn't trip a
        // PropType warning.
        isAnugaProject: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        hydrologyPluginPresent: PropTypes.bool,
        showHydrologyMainMenu: PropTypes.bool,
        setHydrologyMainMenu: PropTypes.func
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // this.props.updateCustomEditorsOptions(this.editorOptions);
    }

    componentDidUpdate() {
        if (this.props.gnResourceLoaded && !this.props.isAnugaProject) {
            this.props.initAnuga();
        }
    }

    closeHydrologyIfOpen = () => {
        if (this.props.showHydrologyMainMenu) this.props.setHydrologyMainMenu(false);
    }

    renderToolbarButtons() {
        return (
            <React.Fragment>
                <button
                    key="anuga-input-button"
                    className={`simple-view-menu-button ${this.props.showAnugaInputMenu ? 'active' : ''}`}
                    onClick={() => {
                        this.props.setAnugaInputMenu(!this.props.showAnugaInputMenu);
                        this.props.setOpenMenuGroupId(null);
                        this.closeHydrologyIfOpen();
                        trackEvent('button', `click`, `anuga-input-menu-toggle`);
                    }}
                >
                    <Message msgId="hydrata.anuga.inputs" />
                </button>
                {this.props.hydrologyPluginPresent ?
                    <button
                        id="hydrology-main-menu-button"
                        key="hydrology-main-menu-button"
                        className={`simple-view-menu-button ${this.props.showHydrologyMainMenu ? 'active' : ''}`}
                        onClick={() => {
                            const opening = !this.props.showHydrologyMainMenu;
                            this.props.setHydrologyMainMenu(opening);
                            if (opening) {
                                if (this.props.showAnugaInputMenu) this.props.setAnugaInputMenu(false);
                                if (this.props.showAnugaScenarioMenu) {
                                    this.props.setAnugaScenarioMenu(false);
                                    this.props.stopAnugaScenarioPolling();
                                }
                                if (this.props.showPublicationPanel) this.props.setPublicationPanel(false);
                                if (this.props.showMembershipPanel) this.props.setMembershipPanel(false);
                                this.props.setOpenMenuGroupId(null);
                            }
                            trackEvent('button', 'click', 'hydrology-main-menu-toggle');
                        }}
                    >
                        <Message msgId="hydrata.hydrology.hydrology" />
                    </button>
                    : null
                }
                {this.props.canViewAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-scenario-button"
                        className={`simple-view-menu-button ${this.props.showAnugaScenarioMenu ? 'active' : ''}`}
                        onClick={() => {
                            this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
                            this.props.showAnugaScenarioMenu ? this.props.stopAnugaScenarioPolling() : this.props.startAnugaScenarioPolling();
                            this.props.setOpenMenuGroupId(null);
                            this.closeHydrologyIfOpen();
                            trackEvent('button', `click`, `anuga-scenario-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.scenarios" />
                    </button>
                    : null
                }
                {this.props.canViewAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-results-button"
                        className={`simple-view-menu-button ${this.props.openMenuGroupId === 'Results' ? 'active' : ''}`}
                        onClick={() => {
                            this.props.setOpenMenuGroupId('Results');
                            this.closeHydrologyIfOpen();
                            trackEvent('button', `click`, `anuga-results-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.results" />
                    </button>
                    : null
                }
                {this.props.canEditAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-publication-button"
                        className={`simple-view-menu-button disabled ${this.props.showPublicationPanel ? 'active' : ''}`}
                        onClick={() => {
                            this.props.setPublicationPanel(!this.props.showPublicationPanel);
                            this.props.setOpenMenuGroupId(null);
                            this.closeHydrologyIfOpen();
                            trackEvent('button', `click`, `anuga-publication-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.publish" />
                    </button>
                    : null
                }
                {this.props.canManageMembers && this.props.hasEPSGset ?
                    <button
                        key="anuga-members-button"
                        className={`simple-view-menu-button ${this.props.showMembershipPanel ? 'active' : ''}`}
                        onClick={() => {
                            this.props.setMembershipPanel(!this.props.showMembershipPanel);
                            this.props.setOpenMenuGroupId(null);
                            this.closeHydrologyIfOpen();
                            trackEvent('button', `click`, `anuga-membership-panel-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.members" />
                    </button>
                    : null
                }
            </React.Fragment>
        );
    }

    render() {
        const toolbarTarget = typeof document !== 'undefined'
            ? document.querySelector('.simple-view-left-toolbar')
            : null;
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    {toolbarTarget ? ReactDOM.createPortal(this.renderToolbarButtons(), toolbarTarget) : null}
                    {this.props.showAnugaInputMenu ? <AnugaInputMenu/> : null}
                    {this.props.canViewAnugaMap && this.props.hasEPSGset && this.props.showAnugaScenarioMenu ?
                        <AnugaScenarioMenu/> : null
                    }
                    {this.props.canEditAnugaMap && this.props.hasEPSGset && this.props.showPublicationPanel ?
                        <PublicationPanel/> : null
                    }
                    {this.props.visibleAnugaScenarioLogId ?
                        <AnugaScenarioLogViewer logText={this.props.logText}/> : null
                    }
                    {this.props.visibleAnugaRunMenu ? <AnugaRunMenu/> : null}
                    {this.props.showNetworkMenu ? <NetworkMenu/> : null}
                    {this.props.showMembershipPanel ? <MembershipPanel/> : null}
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    const selectedScenario = selectedId ? state?.anuga?.scenarios?.byId?.[selectedId] : null;
    const latestRunIsValid = selectedScenario?.latest_run_is_valid;
    const logText = latestRunIsValid ?
        selectedScenario?.latest_run?.log || '-' :
        selectedScenario?.log || '-';
    const mapViewerPlugins = state?.localConfig?.plugins?.map_viewer || [];
    return {
        logText: logText,
        gnResourceLoaded: state?.gnresource?.id,
        isAnugaProject: state?.anuga?.projects?.data?.id,
        hasEPSGset: !!state?.anuga?.projects?.data?.projection,
        showAnugaInputMenu: state?.anuga?.ui?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.ui?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.ui?.showAnugaResultMenu,
        showPublicationPanel: state?.anuga?.ui?.showPublicationPanel,
        isAnugaMenuOpen: state?.anuga?.ui?.showAnugaInputMenu || state?.anuga?.ui?.showAnugaScenarioMenu || state?.anuga?.ui?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaTerrainData: state?.anuga?.ui?.showAddAnugaTerrainData,
        visibleAnugaScenarioLogId: state?.anuga?.ui?.visibleAnugaScenarioLogId,
        visibleIntroduction: state?.simpleView.hasOwnProperty('visibleIntroduction') ? state?.simpleView?.visibleIntroduction : true,
        showNetworkMenu: state?.anuga?.ui?.showNetworkMenu,
        visibleNetworkMenu: state?.anuga?.ui?.visibleNetworkMenu,
        visibleAnugaRunMenu: state?.anuga?.ui?.visibleAnugaRunMenu,
        canEditAnugaMap: canEditAnugaMap(state),
        canViewAnugaMap: canViewAnugaMap(state),
        canManageMembers: canManageMembers(state),
        canCreateScenario: canCreateScenario(state),
        showMembershipPanel: state?.anuga?.ui?.showMembershipPanel,
        hydrologyPluginPresent: !!mapViewerPlugins.find(x => x.name === "Hydrology"),
        showHydrologyMainMenu: !!state?.hydrology?.showHydrologyMainMenu
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setPublicationPanel: (visible) => dispatch(setPublicationPanel(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        startAnugaScenarioPolling: () => dispatch(startAnugaScenarioPolling()),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling()),
        setMembershipPanel: (visible) => dispatch(setMembershipPanel(visible)),
        setHydrologyMainMenu: (visible) => dispatch(setHydrologyMainMenu(visible))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
