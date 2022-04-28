import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');

import {MenuRow} from "./simpleViewMenuRow";
import '../simpleView.css';

class MenuRowsClass extends React.Component {
    static propTypes = {
        menuGroups: PropTypes.array,
        flatLayers: PropTypes.array,
        layerList: PropTypes.array,
        layerSubheadings: PropTypes.array,
        menuDatasets: PropTypes.array,
        openMenuGroupId: PropTypes.string,
        baseMapLayers: PropTypes.array
    };

    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.openMenuGroupId === 'basemaps') {
            return (
                <div className={'menu-rows-container'}>
                    {this.props.baseMapLayers.map((layer) => (
                        <MenuRow layer={layer}/>
                    ))}
                </div>
            );
        }
        if (this.props.layerList?.length === 0) {
            return (
                <div className={'menu-rows-container'}>
                    <MenuRow layer={null}/>
                </div>
            );
        }
        return (
            <div className={'menu-rows-container'}>
                {this.props.layerSubheadings.map(subHeading => (
                    <React.Fragment>
                        <h5>{subHeading}</h5>
                        {this.props.layerList?.filter(layer => layer.group.split('.')[1] === subHeading).map(layer => (
                            <MenuRow layer={layer}/>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // console.log('state simpleView:', state);
    // debugger;
    return {
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        menuGroups: state?.layers?.groups,
        flatLayers: state?.layers?.flat,
        layerList: state?.layers?.flat?.filter((layer) => layer?.group?.split('.')[0] === state?.simpleView?.openMenuGroupId),
        layerSubheadings: [...new Set(state?.layers?.flat?.filter((layer) => layer?.group?.split('.')[0] === state?.simpleView?.openMenuGroupId).map(layer => layer.group.split('.')[1]))],
        baseMapLayers: state?.layers?.flat.filter((layer) => layer?.group === 'background')
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

const MenuRows = connect(mapStateToProps, mapDispatchToProps)(MenuRowsClass);


export {
    MenuRows
};
