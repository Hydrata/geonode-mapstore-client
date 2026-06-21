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
import {canEditAnugaMap, canViewAnugaMap, canCreateScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {AnugaInputMenu} from './anugaInputMenu';
// BUG (UAT, TASK-1648 regression): the GLO-30 bbox panel must be mounted at the
// CONTAINER level, NOT inside AnugaInputMenu. 'Define import area' dispatches
// setAnugaInputMenu(false) to clear the map for drawing, which unmounts
// AnugaInputMenu (anugaContainer:206 gates it on showAnugaInputMenu). When the
// bbox panel was a child of AnugaInputMenu it unmounted too, leaving the map
// stuck in BBOX draw mode with no panel to return to (the "freeze"). Mounting it
// here keeps it alive across the menu close; it self-gates on terrainBboxPanelVisible.
import {TerrainBboxPanel} from './terrainBboxPanel';
// TASK-1800 (W1.9 UAT): the Analysis-Surface recipe builder is now the
// stand-alone "Merge terrains" side panel. Like TerrainBboxPanel it is mounted
// at the CONTAINER level (NOT inside AnugaInputMenu) and self-gates on
// terrainWorkbench.visible, so closing the Inputs menu can't unmount it
// mid-edit (TASK-1648 lesson).
import {MergeTerrainsPanel} from '../../TerrainWorkbench/components/MergeTerrainsPanel';
import {AnugaScenarioMenu} from './anugaScenarioMenu';
import {PublicationPanel} from './publicationPanel';
import {NetworkMenu} from "./networkMenu";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {setHydrologyMainMenu} from "../../Hydrology/actionsHydrology";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {MembershipPanel} from "./membershipPanel";
import RunPollingPausedBanner from "./runPollingPausedBanner";
// TASK-1857 (W3.3) — 2D cursor-elevation readout in the MapFooter.
import ElevationReadout from './ElevationReadout';
import {trackEvent} from "@js/utils/analytics";

// Exported (in addition to the connected default) so the UAT regression test can
// render the bare container and assert the GLO-30 bbox panel mounts INDEPENDENTLY
// of showAnugaInputMenu (TASK-1648 mount-gating freeze fix).
export class AnugaContainer extends React.Component {
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
        startAnugaScenarioPolling: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        updateCustomEditorsOptions: PropTypes.func,
        gnResourceLoaded: PropTypes.string,
        canEditAnugaMap: PropTypes.bool,
        canViewAnugaMap: PropTypes.bool,
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
        // TASK-1637 — map id (number) of an in-flight init, or false.
        initInFlight: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
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
        // TASK-1637 — only kick an init if one isn't already resolving for
        // THIS map. isAnugaProject stays falsy for the whole from-map →
        // getProjectV2 → setAnugaProjectData window, so without the
        // initInFlight guard every re-render in that window re-dispatched
        // INIT_ANUGA, and the epic's switchMap cancelled + restarted the
        // in-flight chain (a wasted full round-trip before the menus mount).
        // The guard is keyed on map id in the epic, so a map switch (new
        // gnResourceLoaded id) is never blocked by the prior map's guard.
        const initRunningForThisMap = this.props.initInFlight === this.props.gnResourceLoaded;
        if (this.props.gnResourceLoaded && !this.props.isAnugaProject && !initRunningForThisMap) {
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
                {/* TASK-1657: the standalone TerrainWorkbench toolbar button was
                    removed — the recipe builder lives inline in Inputs → Terrain
                    (TASK-1645). The reducer/epics/api remain, used by that pane. */}
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
                {/* ISSUE 16 item 3: Publish button hidden (feature not ready). */}
                {this.props.canEditAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-publication-button"
                        className={`simple-view-menu-button disabled ${this.props.showPublicationPanel ? 'active' : ''}`}
                        style={{display: 'none'}}
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
                {/* The "Permissions" (membership) button moved to the RHS toolbar
                    padlock in SimpleView — see simpleViewContainer.js. The padlock
                    toggles setMembershipPanel directly, so no left-rail button here. */}
            </React.Fragment>
        );
    }

    render() {
        const toolbarTarget = typeof document !== 'undefined'
            ? document.querySelector('.simple-view-left-toolbar')
            : null;
        // TASK-1857 (W3.3) — portal the elevation readout into the MapFooter so
        // it sits inline with ScaleBar/MousePosition without requiring a new plugin
        // slot or localConfig change.  The target element is created by the
        // MapFooter plugin which is always present on map pages.
        const mapFooterTarget = typeof document !== 'undefined'
            ? document.getElementById('mapstore-map-footer')
            : null;
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    {toolbarTarget ? ReactDOM.createPortal(this.renderToolbarButtons(), toolbarTarget) : null}
                    {mapFooterTarget ? ReactDOM.createPortal(<ElevationReadout />, mapFooterTarget) : null}
                    {this.props.showAnugaInputMenu ? <AnugaInputMenu/> : null}
                    {this.props.canViewAnugaMap && this.props.hasEPSGset && this.props.showAnugaScenarioMenu ?
                        <AnugaScenarioMenu/> : null
                    }
                    {this.props.canEditAnugaMap && this.props.hasEPSGset && this.props.showPublicationPanel ?
                        <PublicationPanel/> : null
                    }
                    {this.props.showNetworkMenu ? <NetworkMenu/> : null}
                    {this.props.showMembershipPanel ? <MembershipPanel/> : null}
                    {/* BUG (UAT, TASK-1648 regression): bbox panel mounted at the
                        container level so closing the Inputs menu (which 'Define
                        import area' does) does NOT unmount it mid-draw. It self-gates
                        on terrainBboxPanelVisible, so it renders null until opened. */}
                    <TerrainBboxPanel/>
                    {/* TASK-1800 (W1.9 UAT): stand-alone "Merge terrains" recipe
                        panel, mounted at container level alongside TerrainBboxPanel
                        so closing the Inputs menu does NOT unmount it mid-edit. It
                        self-gates on terrainWorkbench.visible (null until opened). */}
                    <MergeTerrainsPanel/>
                    {/* W7 (TASK-1045) — paused-polling banner. Always
                        mounted under isAnugaProject so the connected
                        component can react to pollingTimeoutFor without
                        re-mount churn. Returns null when the slice is
                        falsy, so DOM cost is one stub div until it fires. */}
                    <RunPollingPausedBanner/>
                </div>
            ) :
            null;
    }
}

// Exported for unit testing (TASK-1491): mapStateToProps must be safe to call
// for an anonymous viewer whose ANUGA/SimpleView slices were never populated
// (initAnugaEpic is auth-gated, so state.simpleView can be undefined).
export const mapStateToProps = (state) => {
    const mapViewerPlugins = state?.localConfig?.plugins?.map_viewer || [];
    return {
        gnResourceLoaded: state?.gnresource?.id,
        isAnugaProject: state?.anuga?.projects?.data?.id,
        // TASK-1637 — map id of an init currently in flight (or false). Lets
        // componentDidUpdate skip a redundant INIT_ANUGA re-dispatch.
        initInFlight: state?.anuga?.projects?.initInFlight,
        hasEPSGset: !!state?.anuga?.projects?.data?.projection,
        showAnugaInputMenu: state?.anuga?.ui?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.ui?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.ui?.showAnugaResultMenu,
        showPublicationPanel: state?.anuga?.ui?.showPublicationPanel,
        isAnugaMenuOpen: state?.anuga?.ui?.showAnugaInputMenu || state?.anuga?.ui?.showAnugaScenarioMenu || state?.anuga?.ui?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaTerrainData: state?.anuga?.ui?.showAddAnugaTerrainData,
        // TASK-1491 — optional-chain through .hasOwnProperty: state.simpleView
        // is undefined for an anon viewer (initAnugaEpic auth-gated), and the
        // raw .hasOwnProperty() call crashed the whole ViewerRoute. Semantics
        // preserved: explicit visibleIntroduction wins; absent/undefined → true.
        visibleIntroduction: state?.simpleView?.hasOwnProperty('visibleIntroduction') ? state?.simpleView?.visibleIntroduction : true,
        showNetworkMenu: state?.anuga?.ui?.showNetworkMenu,
        visibleNetworkMenu: state?.anuga?.ui?.visibleNetworkMenu,
        canEditAnugaMap: canEditAnugaMap(state),
        canViewAnugaMap: canViewAnugaMap(state),
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
