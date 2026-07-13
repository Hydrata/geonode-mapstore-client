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
    setMembershipPanel,
    // TASK-1861 (W4.4) — depth/result line-profile tool toggle.
    setProfilePanelVisible
} from '../actionsAnuga';
import {canEditAnugaMap, canViewAnugaMap, canCreateScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {LAUNCH_GATES} from '../../shared/launchGates';
import ComingSoonBadge from '../../shared/ComingSoonBadge';
import {AnugaInputMenu} from './anugaInputMenu';
// BUG (UAT, TASK-1648 regression): the GLO-30 bbox panel must be mounted at the
// CONTAINER level, NOT inside AnugaInputMenu. 'Define import area' dispatches
// setAnugaInputMenu(false) to clear the map for drawing, which unmounts
// AnugaInputMenu (anugaContainer:206 gates it on showAnugaInputMenu). When the
// bbox panel was a child of AnugaInputMenu it unmounted too, leaving the map
// stuck in BBOX draw mode with no panel to return to (the "freeze"). Mounting it
// here keeps it alive across the menu close; it self-gates on terrainBboxPanelVisible.
import {TerrainBboxPanel} from './terrainBboxPanel';
// TASK-1880 (epic 1884 W2 — THE HEADLINE): in-app terrain-upload CRS picker.
// Mounted at the container level like TerrainBboxPanel so closing the Inputs menu
// can't unmount it mid-upload (TASK-1648 lesson); self-gates on the redux
// terrainUploadCrsPanelVisible flag (renders null until the upload glyph opens it).
import {TerrainUploadCrsPanel} from './terrainUploadCrsPanel';
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
// TASK-1993 (epic 1969 W2.1) — map-click disambiguation chooser. Mounted at the
// container level like the other ANUGA panels; self-gates on
// state.anuga.clickDisambiguation.candidates (renders null below 2 candidates).
import ClickDisambiguationPanel from '../../shared/components/ClickDisambiguationPanel';
// TASK-1861 (W4.4) — depth/result line-profile tool panel. Mounted at the
// container level (like TerrainBboxPanel) so closing a menu can't unmount it
// mid-draw; self-gates on profilePanelVisible.
import {TerrainProfilePanel} from './TerrainProfilePanel';
// TASK-2233 — stand-alone floating dynamic-DEM legend (a MovablePanel).
// Mounted at the container level so closing the Inputs menu can't unmount it
// (the whole point of floating it); self-gates on a dynamic-mode terrain pair
// being present + the user-closed flag.
import {FloatingDemLegendPanel} from './DemRampLegend';
// TASK-1869 (W5.4) — vertical-exaggeration slider for the 3D Cesium terrain.
// GATED (TASK-1870/epic-1871): the slider is visually inert in prod — it sets
// scene.verticalExaggeration but the GeoServerBILTerrainProvider mesh never
// exaggerates. Import + mount are commented out so prod users don't see a dead
// control; the component + its karma tests stay in-tree for 1871 to revive
// (un-comment this import and the <VerticalExaggerationSlider/> mount below).
// import {VerticalExaggerationSlider} from './VerticalExaggerationSlider';
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
        setHydrologyMainMenu: PropTypes.func,
        // TASK-1861 (W4.4) — depth/result line-profile tool toggle.
        showProfilePanel: PropTypes.bool,
        setProfilePanelVisible: PropTypes.func
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // this.props.updateCustomEditorsOptions(this.editorOptions);
    }

    componentDidUpdate(prevProps) {
        // W4 UAT — when the Results tab opens, the sibling simpleViewContainer
        // mounts the .simple-view-panel--miller node on the SAME redux tick. On
        // the render where openMenuGroupId first becomes 'Results' the node may
        // not exist yet, so the profile-button portal target is null. Force one
        // re-render after that paint so the portal resolves into the now-mounted
        // panel (no-op when the target was already found).
        if (prevProps && prevProps.openMenuGroupId !== this.props.openMenuGroupId
            && this.props.openMenuGroupId === 'Results') {
            this.forceUpdate();
        }
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
                {/* W4 UAT: the depth/elevation profile is no longer a standalone
                    toolbar tab — it now opens from a button INSIDE the Results tab
                    (renderResultsProfileButton), so it sits with the result layers
                    it profiles. The panel itself is unchanged (mounts via portal). */}
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

    // W4 UAT — the depth/elevation profile entry is now a BUTTON inside the
    // Results tab rather than a standalone toolbar tab. It dispatches the SAME
    // action the old tab used (setProfilePanelVisible), so both 'profile' and
    // 'cross-section' modes stay reachable (the mode toggle lives in the panel).
    // Gated on canViewAnugaMap + hasEPSGset (same as the result layers it
    // profiles) and only mounted when the Results tab is the open group.
    renderResultsProfileButton() {
        // TASK-2126 — "Depth / elevation profile" gated ("Coming soon") for the
        // bundled launch: the button is disabled and cannot open the panel.
        const gated = !LAUNCH_GATES.resultsProfile;
        return (
            <div className="sv-results-profile-action" data-testid="anuga-results-profile-action">
                <button
                    key="anuga-results-profile-button"
                    data-testid="anuga-profile-button"
                    className={`btn sv-glass-button ${this.props.showProfilePanel ? 'active' : ''}`}
                    disabled={gated}
                    onClick={gated ? undefined : () => {
                        this.props.setProfilePanelVisible(!this.props.showProfilePanel);
                        this.closeHydrologyIfOpen();
                        trackEvent('button', 'click', 'anuga-results-profile-toggle');
                    }}
                >
                    <Message msgId="hydrata.anuga.profilePanelTitle" />
                    {gated ? <ComingSoonBadge /> : null}
                </button>
            </div>
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
        // W4 UAT — the Results-tab profile button is portaled into the open
        // Results miller panel (rendered by simpleViewContainer). Only when the
        // Results group is the open menu group (not basemaps / other groups) and
        // the viewer can see results. The panel mounts on the same redux tick as
        // this container reacts to openMenuGroupId, so the target resolves on the
        // re-render after the tab opens (same portal-by-query pattern as the
        // toolbar/footer targets above).
        const resultsPanelTarget = (typeof document !== 'undefined'
            && this.props.openMenuGroupId === 'Results'
            && this.props.canViewAnugaMap && this.props.hasEPSGset)
            ? document.querySelector('.simple-view-panel--miller')
            : null;
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    {toolbarTarget ? ReactDOM.createPortal(this.renderToolbarButtons(), toolbarTarget) : null}
                    {mapFooterTarget ? ReactDOM.createPortal(<ElevationReadout />, mapFooterTarget) : null}
                    {resultsPanelTarget ? ReactDOM.createPortal(this.renderResultsProfileButton(), resultsPanelTarget) : null}
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
                    {/* TASK-1880 (epic 1884 W2 — THE HEADLINE): in-app terrain-upload
                        CRS picker. Mounted here (not inside AnugaInputMenu) so closing
                        the Inputs menu does NOT unmount it mid-upload. Self-gates on
                        terrainUploadCrsPanelVisible (null until the upload glyph /
                        starter CTA opens it via setTerrainUploadCrsPanel). */}
                    <TerrainUploadCrsPanel/>
                    {/* TASK-1861 (W4.4): depth/result line-profile tool panel,
                        mounted at container level (self-gates on
                        profilePanelVisible) like TerrainBboxPanel so closing a
                        menu can't unmount it mid-draw. */}
                    <TerrainProfilePanel/>
                    {/* TASK-2233: floating dynamic-DEM legend (MovablePanel).
                        Self-gates on a dynamic-mode terrain + DEM layer being
                        present and on the user-closed flag, so it survives
                        closing the Inputs menu. */}
                    <FloatingDemLegendPanel/>
                    {/* TASK-1869 (W5.4): vertical-exaggeration slider for the 3D
                        Cesium terrain. GATED until TASK-1870 (epic 1871) makes it
                        actually move the mesh — it is visually inert today, so the
                        mount is disabled to avoid shipping a dead control to prod.
                        Un-comment (and the import above) when 1870 lands. */}
                    {/* <VerticalExaggerationSlider/> */}
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
                    {/* TASK-1993 (epic 1969 W2.1): map-click disambiguation
                        chooser. Self-gates on state.anuga.clickDisambiguation
                        (renders null below 2 candidates) like the other panels. */}
                    <ClickDisambiguationPanel/>
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
        showHydrologyMainMenu: !!state?.hydrology?.showHydrologyMainMenu,
        // TASK-1861 (W4.4) — depth/result line-profile tool visibility.
        showProfilePanel: !!state?.anuga?.ui?.profilePanelVisible
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
        setHydrologyMainMenu: (visible) => dispatch(setHydrologyMainMenu(visible)),
        // TASK-1861 (W4.4) — depth/result line-profile tool toggle.
        setProfilePanelVisible: (visible) => dispatch(setProfilePanelVisible(visible))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
