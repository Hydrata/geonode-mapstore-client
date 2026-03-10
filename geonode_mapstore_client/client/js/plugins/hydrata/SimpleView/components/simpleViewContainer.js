import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import {Glyphicon} from 'react-bootstrap';
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';
import {setControlProperty} from '@mapstore/framework/actions/controls';
import {saveDirectContent} from '@js/actions/gnsave';
import {canEditResource} from '@js/selectors/resource';
import {isLoggedIn} from '@mapstore/framework/selectors/security';
const {setStep: setHGevalStep, reset: resetHGeval} = require('../../HGeval/actionsHGeval');

import {setOpenMenuGroupId, setVisibleIntroduction, setVisibleLegendPanel} from "../actionsSimpleView";
import "../simpleView.css";
import LegendPanel from "./simpleViewLegend";
import {MenuRows} from "./simpleViewMenuRows";
import Introduction from "../components/simpleViewIntroduction";
import {SimpleViewAttributeForm} from "../components/simpleViewAttributeForm";
import {SimpleViewAttributeResult} from "../components/simpleViewAttributeResult";

class SimpleViewContainer extends React.Component {
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
        drawerEnabled: PropTypes.bool,
        toggleDrawer: PropTypes.func,
        onSave: PropTypes.func,
        hgevalPluginPresent: PropTypes.bool,
        hgevalActive: PropTypes.bool,
        onSetHGevalStep: PropTypes.func,
        onResetHGeval: PropTypes.func
    };

    static defaultProps = {
        visibleIntroduction: false
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // Task 1: Offset search bar to avoid overlapping right toolbar
        const searchBar = document.getElementById('search-bar-container');
        if (searchBar) searchBar.style.right = '65px';
    }

    componentDidUpdate(prevProps) {
        // Task 2: Toggle drawer menu visibility for admin users
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
        if (searchBar) searchBar.style.right = '';
        // Reset drawer display
        const drawer = document.getElementById('mapstore-drawermenu');
        if (drawer) drawer.style.display = '';
    }

    render() {
        return (
            <div id="simple-view-container">
                <div className="simple-view-left-toolbar">
                    <button
                        key={'basemaps'}
                        className={'simple-view-menu-button'}
                        onClick={() => {this.props.setOpenMenuGroupId(this.props.baseMapMenuGroup?.id);}}>
                        <Message msgId="hydrata.simpleView.baseMaps" />
                    </button>
                    {this.props.menuGroups && this.props.menuGroups.length ?
                        this.props.menuGroups.map(
                            (menu) => {
                                return (
                                    <button
                                        id={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        key={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        className={'simple-view-menu-button'}
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
                            <button
                                className={`simple-view-right-button ${this.props.drawerEnabled ? 'active' : ''}`}
                                onClick={() => this.props.toggleDrawer(!this.props.drawerEnabled)}
                                title="Layer Menu">
                                <Glyphicon glyph="menu-hamburger" />
                            </button>
                            <button
                                className="simple-view-right-button"
                                onClick={() => this.props.onSave()}
                                title="Save">
                                <Glyphicon glyph="floppy-disk" />
                            </button>
                        </>
                    ) : null}
                </div>
                {(() => {
                    switch (this.props?.openMenuGroupId) {
                    case null: return null;
                    case undefined: return null;
                    default: return (
                        <div className={'simple-view-panel'}>
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
    const menuGroups = state?.layers?.groups?.filter(group => !(customMenus.includes(group.name) || customMenus.includes(group.title)));
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
        canEdit: canEditResource(state),
        loggedIn: !!isLoggedIn(state),
        drawerEnabled: state?.controls?.drawer?.enabled || false,
        hgevalPluginPresent: !!mapViewerPlugins.find(x => x.name === "HGeval"),
        hgevalActive: !!(state?.hgeval?.step && state?.hgeval?.step !== 'idle')
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
        onResetHGeval: () => dispatch(resetHGeval())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
