import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import {Glyphicon} from 'react-bootstrap';
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';
import {setControlProperty} from '@mapstore/framework/actions/controls';
import {saveDirectContent} from '@js/actions/gnsave';
// The RHS padlock opens our custom ANUGA permissions panel (MembershipPanel),
// toggled via setMembershipPanel and gated by canManageMembers (owner/manager on
// the ANUGA project — the same audience as the old left-rail "Permissions" button).
// The MembershipPanel is mounted by anugaContainer on ANUGA maps, so the padlock
// only appears where that panel exists.
import { setMembershipPanel } from '../../Anuga/actionsAnuga';
import { canManageMembers } from '@js/plugins/hydrata/Anuga/selectorsAnuga';
import {canEditResource} from '@js/selectors/resource';
import {isLoggedIn, userSelector} from '@mapstore/framework/selectors/security';
import {canEditSwammMap} from '../../Swamm/selectorsSwamm';
const {setStep: setHGevalStep, reset: resetHGeval} = require('../../HGeval/actionsHGeval');

import {setOpenMenuGroupId, setVisibleIntroduction, setVisibleLegendPanel} from "../actionsSimpleView";
import "../simpleView.css";
import LegendPanel from "./simpleViewLegend";
import {MenuRows} from "./simpleViewMenuRows";
import Introduction from "../components/simpleViewIntroduction";
import {SimpleViewAttributeForm} from "../components/simpleViewAttributeForm";
import {SimpleViewAttributeResult} from "../components/simpleViewAttributeResult";

// Vertical gap between the RHS toolbar buttons (matches `.simple-view-right-toolbar`
// flex `gap` in simpleView.css). The TaskMonitor button lives in a SEPARATE plugin
// (it also runs in dataset_viewer, where SimpleView is absent), so it can't be a flex
// child of this column. Instead we publish the toolbar's bottom edge as `--sv-tm-top`
// and the TaskMonitor container consumes it, so the Tasks icon sits exactly one gap
// below the last toolbar button — equally spaced — however many buttons are showing.
export const SV_TOOLBAR_GAP = 4;

// Pure helper (unit-tested): the `top` the TaskMonitor button should use to continue
// the toolbar column by one gap below its last button.
export function computeTaskMonitorTop(toolbarTop, toolbarHeight, gap = SV_TOOLBAR_GAP) {
    return toolbarTop + toolbarHeight + gap;
}

export class SimpleViewContainer extends React.Component {
    static propTypes = {
        setOpenMenuGroupId: PropTypes.func,
        menuGroups: PropTypes.array,
        baseMapMenuGroup: PropTypes.object,
        openMenuGroupId: PropTypes.string,
        visibleIntroduction: PropTypes.bool,
        visibleSimpleViewAttributeForm: PropTypes.bool,
        visibleSimpleViewAttributeResult: PropTypes.bool,
        setVisibleIntroduction: PropTypes.func,
        visibleLegendPanel: PropTypes.bool,
        setVisibleLegendPanel: PropTypes.func,
        searchEnabled: PropTypes.bool,
        searchPluginPresent: PropTypes.bool,
        toggleSearch: PropTypes.func,
        measureEnabled: PropTypes.bool,
        measurePluginPresent: PropTypes.bool,
        toggleMeasure: PropTypes.func,
        canEdit: PropTypes.bool,
        loggedIn: PropTypes.bool,
        isSuperuser: PropTypes.bool,
        drawerEnabled: PropTypes.bool,
        toggleDrawer: PropTypes.func,
        onSave: PropTypes.func,
        hgevalPluginPresent: PropTypes.bool,
        hgevalActive: PropTypes.bool,
        onSetHGevalStep: PropTypes.func,
        onResetHGeval: PropTypes.func,
        // RHS padlock opens the custom ANUGA permissions panel (MembershipPanel).
        canManageMembers: PropTypes.bool,
        permissionsEnabled: PropTypes.bool,
        togglePermissions: PropTypes.func
    };

    static defaultProps = {
        visibleIntroduction: false
    };

    constructor(props) {
        super(props);
        this.state = { saveConfirmVisible: false };
    }

    componentDidMount() {
        this.updateWidgetPositions();
    }

    componentDidUpdate(prevProps) {
        this.updateWidgetPositions();
        // Toggle drawer menu visibility for admin users
        if (prevProps.drawerEnabled !== this.props.drawerEnabled) {
            const drawer = document.getElementById('mapstore-drawermenu');
            if (drawer) {
                drawer.style.display = this.props.drawerEnabled ? 'block' : '';
            }
        }
    }

    componentWillUnmount() {
        // Reset search bar position
        const searchBar = document.getElementById('search-bar-container');
        if (searchBar) {
            searchBar.style.position = '';
            searchBar.style.top = '';
            searchBar.style.right = '';
            searchBar.style.left = '';
        }
        // Reset drawer display
        const drawer = document.getElementById('mapstore-drawermenu');
        if (drawer) drawer.style.display = '';
        // Reset CSS variables — let the TaskMonitor container fall back to its
        // standalone default (used in dataset_viewer, where SimpleView is absent).
        document.documentElement.style.removeProperty('--sv-widget-right');
        document.documentElement.style.removeProperty('--sv-tm-top');
    }

    updateWidgetPositions() {
        const rightToolbar = document.querySelector('.simple-view-right-toolbar');
        if (!rightToolbar) return;
        // Panels appear to the left of the button column with a gap
        // Button column: right: 15px, width: 40px → left edge at right: 55px, plus 10px gap = 65px
        const widgetRight = 15 + 40 + 10; // 65px
        document.documentElement.style.setProperty('--sv-widget-right', widgetRight + 'px');

        // Align the TaskMonitor button (separate plugin, own container) directly below
        // this toolbar column with the same gap, so it reads as an equally-spaced member
        // of the column regardless of how many buttons show (search/measure/edit-cluster
        // are all conditional). Measured from the live toolbar so it tracks button count
        // and the responsive button sizes.
        const tmTop = computeTaskMonitorTop(rightToolbar.offsetTop, rightToolbar.offsetHeight);
        document.documentElement.style.setProperty('--sv-tm-top', tmTop + 'px');

        // Position search bar to the left of the right toolbar, top-aligned
        const searchBar = document.getElementById('search-bar-container');
        if (searchBar) {
            searchBar.style.position = 'absolute';
            searchBar.style.top = '11px';
            searchBar.style.right = widgetRight + 'px';
            searchBar.style.left = 'auto';
        }
    }

    render() {
        return (
            <div id="simple-view-container">
                <div className="simple-view-left-toolbar">
                    {/* ISSUE 16 item 1: BaseMaps button removed — basemaps live in the
                        bottom-left BaseMaps widget; the button here is redundant. */}
                    {this.props.menuGroups && this.props.menuGroups.length ?
                        this.props.menuGroups.map(
                            (menu) => {
                                return (
                                    <button
                                        id={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        key={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        className={`simple-view-menu-button ${this.props.openMenuGroupId === menu?.id ? 'active' : ''}`}
                                        onClick={() => {
                                            this.props.setOpenMenuGroupId(menu?.id);
                                            trackEvent('component_setOpenMenuGroupId', `action_${menu?.title}`, `name_${menu?.title}`);
                                        }}>
                                        {menu?.title === 'Default' ? menu?.name : menu?.title}
                                    </button>
                                );
                            }) :
                        null
                    }
                    {this.props.hgevalPluginPresent ?
                        <button
                            className={`simple-view-hgeval-button ${this.props.hgevalActive ? 'active' : ''}`}
                            onClick={() => this.props.hgevalActive ? this.props.onResetHGeval() : this.props.onSetHGevalStep('selecting')}
                            title="Generate Report">
                            <Glyphicon glyph="tint" />
                            <span className="simple-view-hgeval-label">
                                <Message msgId="hydrata.hgeval.generateReport" />
                            </span>
                        </button>
                        : null
                    }
                </div>
                <div className="simple-view-right-toolbar">
                    {this.props.searchPluginPresent ?
                        <button
                            className={`simple-view-right-button ${this.props.searchEnabled ? 'active' : ''}`}
                            onClick={() => this.props.toggleSearch(!this.props.searchEnabled)}
                            title="Search">
                            <Glyphicon glyph="search" />
                        </button>
                        : null
                    }
                    {this.props.measurePluginPresent ?
                        <button
                            className={`simple-view-right-button ${this.props.measureEnabled ? 'active' : ''}`}
                            onClick={() => this.props.toggleMeasure(!this.props.measureEnabled)}
                            title="Measure">
                            <Glyphicon glyph="1-ruler" />
                        </button>
                        : null
                    }
                    <button
                        className={`simple-view-right-button ${this.props.visibleLegendPanel ? 'active' : ''}`}
                        onClick={() => this.props.setVisibleLegendPanel(!this.props.visibleLegendPanel)}
                        title="Legend">
                        <Glyphicon glyph="list" />
                    </button>
                    {this.props.canEdit && this.props.loggedIn ? (
                        <>
                            {this.props.isSuperuser ? (
                                <button
                                    className={`simple-view-right-button ${this.props.drawerEnabled ? 'active' : ''}`}
                                    onClick={() => this.props.toggleDrawer(!this.props.drawerEnabled)}
                                    title="Layer Menu">
                                    <Glyphicon glyph="1-layer" />
                                </button>
                            ) : null}
                            <button
                                className={`simple-view-right-button ${this.state.saveConfirmVisible ? 'active' : ''}`}
                                onClick={() => this.setState({ saveConfirmVisible: !this.state.saveConfirmVisible })}
                                title="Save">
                                <Glyphicon glyph="floppy-disk" />
                            </button>
                        </>
                    ) : null}
                    {/* Permissions padlock — opens the custom MembershipPanel (replaces
                        the old left-rail "Permissions" button). Gated on canManageMembers
                        so it only shows where the panel mounts (ANUGA owner/manager). */}
                    {this.props.canManageMembers ?
                        <button
                            className={`simple-view-right-button ${this.props.permissionsEnabled ? 'active' : ''}`}
                            onClick={() => this.props.togglePermissions(!this.props.permissionsEnabled)}
                            title="Permissions">
                            <Glyphicon glyph="lock" />
                        </button>
                        : null
                    }
                </div>
                {this.state.saveConfirmVisible ?
                    <div className="save-confirm-overlay">
                        <Glyphicon glyph="floppy-disk" style={{fontSize: 14}} />
                        <span><Message msgId="hydrata.simpleView.saveConfirm" /></span>
                        <button
                            className="save-confirm-btn confirm"
                            onClick={() => {
                                this.props.onSave();
                                this.setState({ saveConfirmVisible: false });
                            }}>
                            <Message msgId="hydrata.simpleView.save" />
                        </button>
                        <button
                            className="save-confirm-btn cancel"
                            onClick={() => this.setState({ saveConfirmVisible: false })}>
                            <Message msgId="hydrata.simpleView.cancel" />
                        </button>
                    </div>
                    : null
                }
                {(() => {
                    switch (this.props?.openMenuGroupId) {
                    case null: return null;
                    case undefined: return null;
                    default: return (
                        <div className={'simple-view-panel simple-view-panel--miller'}>
                            <MenuRows/>
                        </div>
                    );
                    }
                })()}
                <LegendPanel/>
                {this.props.visibleIntroduction ?
                    <Introduction/>
                    : null
                }
                {this.props.visibleSimpleViewAttributeForm ?
                    <SimpleViewAttributeForm/>
                    : null
                }
                {this.props.visibleSimpleViewAttributeResult ?
                    <SimpleViewAttributeResult/>
                    : null
                }
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    // ownProps contains site-level cfg from admin (via MapStore pluginCfg)
    // state.simpleView.config contains project-level config (via ANUGA/SWAMM)
    const siteDefaults = {
        customMenus: ownProps?.customMenus || []
    };
    const projectConfig = state?.simpleView?.config || {};
    // Project overrides site defaults
    const customMenus = projectConfig.customMenus || siteDefaults.customMenus;
    // Filter out groups that are handled by custom menu buttons (e.g. "Swamm Model")
    // and groups with no layers (empty nodes).
    const menuGroups = state?.layers?.groups?.filter(group =>
        !(customMenus.includes(group.name) || customMenus.includes(group.title))
        && group.nodes?.length > 0
    ) || [];
    const mapViewerPlugins = state?.localConfig?.plugins?.map_viewer || [];
    return {
        menuGroups: menuGroups,
        baseMapMenuGroup: {id: 'basemaps', title: 'Base Maps', name: 'basemaps'},
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        visibleIntroduction: state?.simpleView?.visibleIntroduction,
        visibleSimpleViewAttributeForm: state?.simpleView?.visibleSimpleViewAttributeForm,
        visibleSimpleViewAttributeResult: state?.simpleView?.visibleSimpleViewAttributeResult,
        visibleLegendPanel: state?.simpleView?.visibleLegendPanel || false,
        searchEnabled: state?.controls?.search?.enabled || false,
        searchPluginPresent: !!mapViewerPlugins.find(x => x.name === "Search"),
        measureEnabled: state?.controls?.measure?.enabled || false,
        measurePluginPresent: !!mapViewerPlugins.find(x => x.name === "Measure"),
        canEdit: !!state?.swamm?.projectData?.id ? canEditSwammMap(state) : canEditResource(state),
        loggedIn: !!isLoggedIn(state),
        // Layer Menu (drawer/TOC) is superuser-only — mirrors the DrawerMenu/TOC
        // `disablePluginIf` gate in the per-site localConfig (state('user').is_superuser).
        isSuperuser: !!userSelector(state)?.is_superuser,
        drawerEnabled: state?.controls?.drawer?.enabled || false,
        hgevalPluginPresent: !!mapViewerPlugins.find(x => x.name === "HGeval"),
        hgevalActive: !!(state?.hgeval?.step && state?.hgeval?.step !== 'idle'),
        // RHS padlock active-state tracks the custom MembershipPanel visibility.
        permissionsEnabled: !!state?.anuga?.ui?.showMembershipPanel,
        canManageMembers: canManageMembers(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId)),
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible)),
        setVisibleLegendPanel: (visible) => dispatch(setVisibleLegendPanel(visible)),
        toggleSearch: (enabled) => dispatch(setControlProperty('search', 'enabled', enabled)),
        toggleMeasure: (enabled) => dispatch(setControlProperty('measure', 'enabled', enabled)),
        toggleDrawer: (enabled) => dispatch(setControlProperty('drawer', 'enabled', enabled)),
        onSave: () => dispatch(saveDirectContent()),
        onSetHGevalStep: (step) => dispatch(setHGevalStep(step)),
        onResetHGeval: () => dispatch(resetHGeval()),
        // Padlock toggles the custom MembershipPanel (our permissions UI), replacing
        // the old left-rail "Permissions" button. The panel is rendered by
        // anugaContainer when state.anuga.ui.showMembershipPanel is set.
        togglePermissions: (enabled) => dispatch(setMembershipPanel(enabled))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
