import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');

import {setOpenMenuGroupId} from "../actionsSimpleView";
import "../simpleView.css";
import LegendPanel from "./simpleViewLegend";
import {UploaderPanel} from "./simpleViewUploader";
import {MenuRows} from "./simpleViewMenuRows";
import {SimpleViewEditor} from "./simpleViewEditor";

class SimpleViewContainer extends React.Component {
    static propTypes = {
        setOpenMenuGroupId: PropTypes.func,
        menuGroups: PropTypes.array,
        baseMapMenuGroup: PropTypes.object,
        openMenuGroupId: PropTypes.string,
        selectedLayer: PropTypes.object
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
                                    key={menu.title}
                                    className={'simple-view-menu-button'}
                                    style={{left: (index + 1) * 100 + 20}}
                                    onClick={() => {this.props.setOpenMenuGroupId(menu.id);}}>
                                    {menu.title}
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
                <UploaderPanel/>
                {
                    this.props.selectedLayer ?
                        <SimpleViewEditor/>
                        : null
                }
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        menuGroups: state?.layers?.groups,
        baseMapMenuGroup: {id: 'basemaps', title: 'Base Maps', name: 'basemaps'},
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        selectedLayer: state?.simpleView?.selectedLayer
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroupId) => dispatch(setOpenMenuGroupId(menuGroupId))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
