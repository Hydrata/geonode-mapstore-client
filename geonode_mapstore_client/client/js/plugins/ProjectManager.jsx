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
    borderRadius: "3px"
};

const Component = (props) => (<div style={style}>MenuTime {props.projection}</div>);

// const mapStateToProps = state => {
//     return {
//         projection: projectionSelector(state)
//     };
// };
//
// const ConnectedComponent = connect(mapStateToProps, {
//     changeZoomLevel: changeZoomLevel
// })(Component);

export default createPlugin('ProjectManager', {
    component: Component
});
