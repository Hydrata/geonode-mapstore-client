import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setOpenMenuGroupId, setVisibleIntroduction} from "../actionsSimpleView";
import "../simpleView.css";
import LegendPanel from "./simpleViewLegend";
import {MenuRows} from "./simpleViewMenuRows";
import Introduction from "../components/simpleViewIntroduction";

class SimpleViewContainer extends React.Component {
    static propTypes = {
        setOpenMenuGroupId: PropTypes.func,
        menuGroups: PropTypes.array,
        baseMapMenuGroup: PropTypes.object,
        openMenuGroupId: PropTypes.string,
        visibleIntroduction: PropTypes.bool,
        setVisibleIntroduction: PropTypes.func,
        numberOfCustomMenuSpaces: PropTypes.number
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
                    {this.props.menuGroups && this.props.menuGroups.length && this.props.menuGroups.map(
                        (menu, index) => {
                            return (
                                <button
                                    key={menu?.title}
                                    className={'simple-view-menu-button'}
                                    style={{left: (index + this.props.numberOfCustomMenuSpaces + 1) * 100 + 20}}
                                    onClick={() => {this.props.setOpenMenuGroupId(menu.id);}}>
                                    {menu?.title === 'Default' ? menu.name : menu.title}
                                </button>
                            );
                        })
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
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const groupBlacklist = ['Input Data'];  // TODO: move these to config
    const numberOfCustomMenuSpaces = state?.anuga?.projectData?.id ? 2 : 0;
    return {
        numberOfCustomMenuSpaces: numberOfCustomMenuSpaces,
        menuGroups: state?.layers?.groups?.filter(group => !groupBlacklist.includes(group.name)),
        baseMapMenuGroup: {id: 'basemaps', title: 'Base Maps', name: 'basemaps'},
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        visibleIntroduction: state?.simpleView?.visibleIntroduction
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId)),
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
