import React from 'react';
import { connect } from 'react-redux';
import { createPlugin } from '../../MapStore2/web/client/utils/PluginsUtils';
import { changeZoomLevel } from '../../MapStore2/web/client/actions/map';
import { projectionSelector } from '../../MapStore2/web/client/selectors/map';

const style = {
    position: "absolute",
    background: "blue",
    opacity: 50,
    zIndex: 1000000,
    top: 10,
    left: 10,
    minWidth: "115px",
    backgroundColor: "rgba(0,60,136,0.5)",
    borderColor: "#97b3cd",
    padding: "5px 10px",
    fontSize: "12px",
    lineHeight: "1.5",
    borderRadius: "3px",
    color: "white",
    textAlign: "center"
};

const MenuButton = (props) => {
    // const {isOpen, label} = props;
    return (
        <div style={style}>MenuTime {props.isOpen} {props.label}</div>
    );
};

// const mapStateToProps = state => {
//     return {
//         projection: projectionSelector(state)
//     };
// };

const ConnectedComponent = connect(
    state => {
        return {
            isOpen: state?.projectManager?.isOpen,
            label: state?.projectManager?.label
        };
    }
)(MenuButton);

export default createPlugin(
    'ProjectManager',
    {
        component: ConnectedComponent
    }
);
