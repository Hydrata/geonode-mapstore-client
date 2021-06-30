import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');

import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import '../simpleView.css';


class MenuRowClass extends React.Component {
    static propTypes = {
        layer: PropTypes.object,
        toggleLayer: PropTypes.func,
        setOpacity: PropTypes.func,
    };

    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        if (!this.props.layer) {
            return (
                <div className={"row menu-row"}>
                    <div className={"btn-group inline pull-left .enu-row-button"}>
                        <div className="h5 menu-row-text">No datasets here yet...</div>
                    </div>
                </div>
            );
        }
        return (
            <div className={"row menu-row"}>
                <div className={"btn-group inline pull-left .enu-row-button"}>
                    <div
                        className={"btn glyphicon menu-row-glyph " + (this.props.layer?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                        style={{"color": this.props.layer?.visibility ? "limegreen" : "red"}}
                        onClick={() => {this.props.toggleLayer(this.props.layer?.id, this.props.layer?.visibility);}}
                    />
                    <div className="h5 menu-row-text">{this.props.layer.title}</div>
                </div>
                {
                    (this.props.layer.opacity === 0 || this.props.layer.opacity) ?
                        <div className="mapstore-slider dataset-transparency with-tooltip" onClick={(e) => { e.stopPropagation(); }}>
                            <Slider
                                step={1}
                                start={this.props.layer?.opacity * 100}
                                range={{
                                    min: 0,
                                    max: 100
                                }}
                                onChange={(values) => {
                                    this.props.setOpacity(this.props.layer?.id, values);
                                }}
                            />
                        </div> :
                        null
                }
            </div>
        );
    }
}

const mapDispatchToProps = ( dispatch ) => {
    return {
        toggleLayer: (layer, isVisible) => dispatch(changeLayerProperties(layer, {visibility: !isVisible})),
        setOpacity: (layer, value) => dispatch(changeLayerProperties(layer, {opacity: parseFloat(value) * 0.01}))
    };
};

const MenuRow = connect(null, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow
};
