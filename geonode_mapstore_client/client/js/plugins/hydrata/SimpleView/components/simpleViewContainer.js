import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

import {setOpenMenuGroupId, setVisibleIntroduction} from "../actionsSimpleView";
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
        menuSpaces: PropTypes.number
    };

    static defaultProps = {
        visibleIntroduction: false
    };

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"simple-view-container"}>
                <ul className="menu-groups">
                    <button
                        key={'basemaps'}
                        className={'simple-view-menu-button'}
                        style={{left: 20}}
                        onClick={() => {this.props.setOpenMenuGroupId(this.props.baseMapMenuGroup?.id);}}>
                        <Message msgId="hydrata.simpleView.baseMaps" />
                    </button>
                    {this.props.menuGroups && this.props.menuGroups.length ?
                        this.props.menuGroups.map(
                            (menu, index) => {
                                return (
                                    <button
                                        id={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        key={`simpleViewContainer-mapped-button-${menu?.name}-${menu?.title}`}
                                        className={'simple-view-menu-button'}
                                        style={{left: (index + this.props.menuSpaces + 1) * 100 + 20}}
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
                </ul>
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
        customMenus: ownProps?.customMenus || [],
        menuSpaces: ownProps?.menuSpaces || 0
    };
    const projectConfig = state?.simpleView?.config || {};
    // Project overrides site defaults
    let customMenus = projectConfig.customMenus || siteDefaults.customMenus;
    let menuSpaces = projectConfig.menuSpaces || siteDefaults.menuSpaces;
    // ANUGA hardcoded override (existing behavior, preserved)
    if (state?.anuga?.projectData?.id) {
        customMenus = ['Input Data', 'Results'];
        menuSpaces = 4;
    }
    const menuGroups = state?.layers?.groups?.filter(group => !(customMenus.includes(group.name) || customMenus.includes(group.title)));
    // console.log('groupBlacklist:', groupBlacklist);
    // console.log('numberOfCustomMenuSpaces:', numberOfCustomMenuSpaces);
    // console.log('customMenus:', customMenus);
    // console.log('menuGroups:', menuGroups);
    // console.log('state?.layers?.groups:', state?.layers?.groups);
    return {
        menuSpaces: menuSpaces,
        menuGroups: menuGroups,
        baseMapMenuGroup: {id: 'basemaps', title: 'Base Maps', name: 'basemaps'},
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        visibleIntroduction: state?.simpleView?.visibleIntroduction,
        visibleSimpleViewAttributeForm: state?.simpleView?.visibleSimpleViewAttributeForm,
        visibleSimpleViewAttributeResult: state?.simpleView?.visibleSimpleViewAttributeResult
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId)),
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
