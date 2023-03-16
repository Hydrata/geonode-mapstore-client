import React from "react";
import {connect} from "react-redux";
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
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
            <div id={'swamm-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
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
                            width: "480px",
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
                            <MenuRow layer={erosion} importerTargetObjectId={123456789}/>
                        ))
                    }
                    {
                        this.props.erosionLayers?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No erosion layer available
                            </div>
                            : null
                    }
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
            ?.map(layer => {
                layer.importerTargetObjectId = state?.swamm?.erosions?.filter(erosion => erosion?.gn_layer === parseInt(layer?.extendedParams?.pk, 10))[0]?.id;
                return layer;
            })
            ?.filter(layer => layer?.name.indexOf('erosion_') > -1),
        erosionModels: state?.swamm?.erosions,
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
