import React from "react";
import {connect} from "react-redux";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import "../projectManager.css";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');


class MenuDatasetRowClass extends React.Component {
    static propTypes = {
        thisLayer: PropTypes.array,
        dataset: PropTypes.object,
        toggleLayer: PropTypes.func,
        setOpacity: PropTypes.func,
        layer: PropTypes.object
    };

    constructor(props) {
        super(props);
        this.state = {
            isVisible: true
        };
    }

    render() {
        if (!this.props.thisLayer) {
            return (
                <div className={"row"} style={{...rowStyle}}>
                    <div className={"btn-group inline pull-left"} style={{...btnGroupStyle}}>
                        <div className="h5" style={textStyle}>No datasets here yet...</div>
                    </div>
                </div>
            );
        }
        return (
            <div className={"row"} style={{...rowStyle}}>
                <div className={"btn-group inline pull-left"} style={{...btnGroupStyle}}>
                    <div
                        className={"btn glyphicon " + (this.props.thisLayer?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                        style={{...glyphStyle, "color": this.props.thisLayer?.visibility ? "limegreen" : "red"}}
                        onClick={() => {this.props.toggleLayer(this.props.thisLayer?.id, this.props.thisLayer?.visibility);}}
                    />
                    <div className="h5" style={textStyle}>{this.props.thisLayer.title}</div>
                </div>
                {
                    (this.props.thisLayer.opacity === 0 || this.props.thisLayer.opacity) ?
                        <div className="mapstore-slider dataset-transparency with-tooltip" onClick={(e) => { e.stopPropagation(); }}>
                            <Slider
                                step={1}
                                start={this.props.thisLayer?.opacity * 100}
                                range={{
                                    min: 0,
                                    max: 100
                                }}
                                onChange={(values) => {
                                    this.props.setOpacity(this.props.thisLayer?.id, values);
                                }}
                            />
                        </div> :
                        null
                }
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    return {
        thisLayer: ownProps.layer ? ownProps.layer : state?.layers?.flat.filter((layer) => {
            return layer?.id === ownProps.dataset?.layer;
        })[0]
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        toggleLayer: (layer, isVisible) => dispatch(changeLayerProperties(layer, {visibility: !isVisible})),
        setOpacity: (layer, value) => dispatch(changeLayerProperties(layer, {opacity: parseFloat(value) * 0.01}))
    };
};

const MenuDatasetRow = connect(mapStateToProps, mapDispatchToProps)(MenuDatasetRowClass);


export {
    MenuDatasetRow
};
