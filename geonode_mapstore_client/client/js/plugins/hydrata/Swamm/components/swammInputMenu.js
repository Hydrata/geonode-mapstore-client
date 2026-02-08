import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import '../swamm.css';
import '../../SimpleView/simpleView.css';
import {
    setVisibleUploaderPanel
} from "../../SimpleView/actionsSimpleView";
import {
    setSwammInputMenu
} from "../actionsSwamm";
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";

import {canEditSwammMap} from "@js/plugins/hydrata/Swamm/selectorsSwamm";

class SwammInputMenuClass extends React.Component {
    static propTypes = {
        projectData: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        swammEngines: PropTypes.array,
        nitrogenLayers: PropTypes.array,
        phosphorusLayers: PropTypes.array,
        sedimentLayers: PropTypes.array,
        erosionLayers: PropTypes.array,
        setSwammInputMenu: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            showAdvanced: false,
        };
    }

    componentDidMount() {
    }

    componentWillUnmount() {
    }

    render() {
        return (
            <div id={'swamm-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "530px"}}>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}
                >
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">Erosion</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "erosion", null);
                            }}
                        />
                    </div>
                    {
                        this.props.erosionLayers?.map(erosion => (
                            <MenuRow layer={erosion}/>
                        ))
                    }
                    {
                        this.props.erosionLayers?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "510px", textAlign: "left", border: "none"}}>
                                No erosion layer available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}
                >
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">SWAMM Models</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "swamm-engine", null);
                            }}
                        />
                    </div>
                    {
                        this.props.swammEngines?.map(swammEngine => (
                            <MenuRow layer={swammEngine}/>
                        ))
                    }
                    {
                        this.props.swammEngines?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "510px", textAlign: "left", border: "none"}}>
                                No SWAMM models available
                            </div>
                            : null
                    }
                </div>
                <div
                    className={'menu-rows-container'}
                    style={{
                        "border": "1px solid rgba(255, 255, 255, 1)",
                        "borderRadius": "3px",
                        "margin": "3px 0"
                    }}
                >
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">BMPs</span>
                    </div>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">Outlets</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-outlet", null);
                            }}
                        />
                    </div>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">Footprints</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-footprint", null);
                            }}
                        />
                    </div>
                    <div
                        className={"row menu-row menu-row-header"}
                        style={{
                            width: "510px",
                            textAlign: "left",
                            border: "none"
                        }}
                    >
                        <span className="menu-row-text">Watersheds</span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-watershed", null);
                            }}
                        />
                    </div>
            </div>
                <UploaderPanel />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        projectData: state?.swamm?.projectData,
        erosionLayers: state?.layers?.flat
            ?.filter(layer => layer?.name.indexOf('erosion_') > -1)
            ?.map(layer => {
                layer.importerTargetObjectId = state?.swamm?.erosions?.filter(erosion => erosion?.gn_layer === parseInt(layer?.extendedParams?.pk, 10))[0]?.id;
                return layer;
            }),
        nitrogenLayers: state?.layers?.flat
            ?.filter(layer => layer?.name.indexOf('_n_surface_loading') > -1)
            ?.map(layer => {
                layer.importerTargetObjectId = state?.swamm?.nitrogen?.filter(nitrogen => nitrogen?.gn_layer === parseInt(layer?.extendedParams?.pk, 10))[0]?.id;
                return layer;
            }),
        phosphorusLayers: state?.layers?.flat
            ?.filter(layer => layer?.name.indexOf('_p_surface_loading') > -1)
            ?.map(layer => {
                layer.importerTargetObjectId = state?.swamm?.phosphorus?.filter(phosphorus => phosphorus?.gn_layer === parseInt(layer?.extendedParams?.pk, 10))[0]?.id;
                return layer;
            }),
        sedimentLayers: state?.layers?.flat
            ?.filter(layer => layer?.name.indexOf('_s_surface_loading') > -1)
            ?.map(layer => {
                layer.importerTargetObjectId = state?.swamm?.sediment?.filter(sediment => sediment?.gn_layer === parseInt(layer?.extendedParams?.pk, 10))[0]?.id;
                return layer;
            }),
        erosionModels: state?.swamm?.erosions,
        swammEngines: state?.swamm?.swammEngines,
        canEditSwammMap: canEditSwammMap(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setSwammInputMenu: (visible) => dispatch(setSwammInputMenu(visible)),
        setVisibleUploaderPanel: (visible, importerConfigKey, layerId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, layerId))
    };
};

const SwammInputMenu = connect(mapStateToProps, mapDispatchToProps)(SwammInputMenuClass);

export {SwammInputMenu};
