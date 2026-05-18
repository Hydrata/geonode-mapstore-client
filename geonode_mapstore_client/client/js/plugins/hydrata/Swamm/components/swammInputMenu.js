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
import Message from '@mapstore/framework/components/I18N/Message';
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
// TASK-1007 (W3) — SectionHeader primitive replaces the 6 inline header
// wrappers in this file. Per Phase 0.5 spec verification, Swamm headers
// use the BASELINE class set (row/menu-row/menu-row-header) WITHOUT the
// `anuga-section-header` class — that class rule lives in Anuga/anuga.css
// and swammInputMenu does not import it. The 540px-wide-with-no-border
// rendering instead comes from an inline `style` prop pass-through.
import {SectionHeader} from "../../SimpleView/components/primitives";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";

import {canEditSwammMap} from "@js/plugins/hydrata/Swamm/selectorsSwamm";

// TASK-1007 (W3) — Swamm section-header inline style. Defined once at
// module scope to keep all 6 SectionHeader invocations byte-identical
// and to make the per-site contract explicit (vs the per-call inline
// duplication in the pre-W3 file).
const SWAMM_SECTION_HEADER_STYLE = {
    width: "510px",
    textAlign: "left",
    border: "none"
};

class SwammInputMenuClass extends React.Component {
    static propTypes = {
        projectData: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        swammEngines: PropTypes.array,
        erosionLayers: PropTypes.array,
        setSwammInputMenu: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            showAdvanced: false
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
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.erosion" /></span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "erosion", null);
                            }}
                        />
                    </SectionHeader>
                    {
                        this.props.erosionLayers?.map(erosion => (
                            <MenuRow layer={erosion}/>
                        ))
                    }
                    {
                        this.props.erosionLayers?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "510px", textAlign: "left", border: "none"}}>
                                <Message msgId="hydrata.swamm.noErosionLayerAvailable" />
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
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.swammModels" /></span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "swamm-engine", null);
                            }}
                        />
                    </SectionHeader>
                    {
                        this.props.swammEngines?.map(swammEngine => (
                            <MenuRow layer={swammEngine}/>
                        ))
                    }
                    {
                        this.props.swammEngines?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "510px", textAlign: "left", border: "none"}}>
                                <Message msgId="hydrata.swamm.noSwammModelsAvailable" />
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
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.bmps" /></span>
                    </SectionHeader>
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.outlets" /></span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-outlet", null);
                            }}
                        />
                    </SectionHeader>
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.footprints" /></span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-footprint", null);
                            }}
                        />
                    </SectionHeader>
                    <SectionHeader style={SWAMM_SECTION_HEADER_STYLE}>
                        <span className="menu-row-text"><Message msgId="hydrata.swamm.watersheds" /></span>
                        <span
                            className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                            style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                            onClick={() => {
                                this.props.setVisibleUploaderPanel(true, "bmp-watershed", null);
                            }}
                        />
                    </SectionHeader>
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
