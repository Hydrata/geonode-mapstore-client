import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setOpenMenuGroupId, setVisibleIntroduction} from "../actionsSimpleView";
import "../simpleView.css";
import LegendPanel from "./simpleViewLegend";
import {MenuRows} from "./simpleViewMenuRows";
import Introduction from "../components/simpleViewIntroduction";
import {SimpleViewAttributeForm} from "../components/simpleViewAttributeForm";

class SimpleViewContainer extends React.Component {
    static propTypes = {
        setOpenMenuGroupId: PropTypes.func,
        menuGroups: PropTypes.array,
        baseMapMenuGroup: PropTypes.object,
        openMenuGroupId: PropTypes.string,
        visibleIntroduction: PropTypes.bool,
        visibleSimpleViewAttributeForm: PropTypes.bool,
        setVisibleIntroduction: PropTypes.func,
        menuSpaces: PropTypes.number
    };

    static defaultProps = {
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
                        BaseMaps
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
                                        onClick={() => {this.props.setOpenMenuGroupId(menu.id);}}>
                                        {menu?.title === 'Default' ? menu.name : menu.title}
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
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    let customMenus = state?.simpleView?.config?.customMenus || [];
    let menuSpaces = state?.simpleView?.config?.menuSpaces || 0;
    if (state?.anuga?.projectData?.id) {
        customMenus = ['Input Data', 'Results'];
        menuSpaces = 4;
    }
    const menuGroups = state?.layers?.groups?.filter(group => !customMenus.includes(group.name));
    // console.log('groupBlacklist:', groupBlacklist);
    // console.log('numberOfCustomMenuSpaces:', numberOfCustomMenuSpaces);
    // console.log('menuGroups:', menuGroups);
    // console.log('state?.layers?.groups:', state?.layers?.groups);
    return {
        menuSpaces: menuSpaces,
        menuGroups: menuGroups,
        baseMapMenuGroup: {id: 'basemaps', title: 'Base Maps', name: 'basemaps'},
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        visibleIntroduction: state?.simpleView?.visibleIntroduction,
        visibleSimpleViewAttributeForm: state?.simpleView?.visibleSimpleViewAttributeForm
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId)),
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
