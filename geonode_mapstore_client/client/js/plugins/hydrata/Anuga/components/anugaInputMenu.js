import React from "react";
import {connect} from "react-redux";
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setVisibleUploaderPanel
} from "../../SimpleView/actionsSimpleView";
import {
    addAnugaBoundary,
    addAnugaFriction,
    addAnugaInflow,
    addAnugaStructure,
    addAnugaMeshRegion,
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaStructure,
    createAnugaMeshRegion,
    setCreatingAnugaLayer,
    startAnugaElevationPolling,
    startAnugaModelCreationPolling,
    stopAnugaModelCreationPolling
} from "../actionsAnuga";
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";

import {canEditAnugaMap} from "@js/plugins/hydrata/Anuga/selectorsAnuga";

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        projectData: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        anugaGroupLength: PropTypes.number,
        elevationLayers: PropTypes.array,
        boundaryLayers: PropTypes.array,
        createAnugaBoundary: PropTypes.func,
        createAnugaFriction: PropTypes.func,
        createAnugaInflow: PropTypes.func,
        createAnugaStructure: PropTypes.func,
        createAnugaMeshRegion: PropTypes.func,
        frictionLayers: PropTypes.array,
        inflowLayers: PropTypes.array,
        structureLayers: PropTypes.array,
        meshRegionLayers: PropTypes.array,
        startAnugaElevationPolling: PropTypes.func,
        stopAnugaElevationPolling: PropTypes.func,
        startAnugaModelCreationPolling: PropTypes.func,
        stopAnugaModelCreationPolling: PropTypes.func,
        isCreatingAnugaLayer: PropTypes.bool,
        setCreatingAnugaLayer: PropTypes.func,
        canEditAnugaMap: PropTypes.func,
        addAnugaBoundary: PropTypes.func,
        addAnugaFriction: PropTypes.func,
        addAnugaInflow: PropTypes.func,
        addAnugaStructure: PropTypes.func,
        addAnugaMeshRegion: PropTypes.func,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        structureModels: PropTypes.array,
        meshRegionModels: PropTypes.array
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            boundaryTitle: '',
            frictionTitle: '',
            inflowTitle: '',
            structureTitle: '',
            meshRegionTitle: ''
        };
    }

    componentDidMount() {
        this.props.startAnugaModelCreationPolling();
    }

    componentWillUnmount() {
        this.props.stopAnugaModelCreationPolling();
    }

    render() {
        return (
            <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "480px"}}>
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
                        <span className="menu-row-text">Elevations</span>
                        <OverlayTrigger placement="right" overlay={<Tooltip>Upload a new *.tiff elevation</Tooltip>}>
                            <span
                                className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                                style={{"color": "limegreen", "fontSize": "smaller", "textAlign": "right", "marginRight": "8px"}}
                                onClick={() => {
                                    this.props.setVisibleUploaderPanel(true);
                                    this.props.startAnugaElevationPolling();
                                }}
                            />
                        </OverlayTrigger>
                    </div>
                    {
                        this.props.elevationLayers?.map(elevation => (
                            <MenuRow layer={elevation}/>
                        ))
                    }
                    {
                        this.props.elevationLayers?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No elevations available
                            </div>
                            : null
                    }
                </div>
                {
                    this.props.projectData?.projection ?
                        <React.Fragment>
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
                                    <span className="pull-left menu-row-text">Boundaries</span>
                                    {this.props.canEditAnugaMap ?
                                        <React.Fragment>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.boundaryTitle ? "" : " disabled"}`}
                                                style={{
                                                    "color": "limegreen",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginRight": "8px",
                                                    "float": "right"
                                                }}
                                                onClick={() => {
                                                    this.props.setCreatingAnugaLayer(true);
                                                    this.props.createAnugaBoundary(this.state.boundaryTitle);
                                                    this.setState({boundaryTitle: ''});
                                                }}
                                            />
                                            {
                                                this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" style={{display: "inline-block", position: "absolute", right: "45px"}} spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    <input
                                                        id={'boundary-input'}
                                                        key={'boundary-input'}
                                                        className={'data-title-input'}
                                                        style={{marginTop: "3px", marginRight: "5px"}}
                                                        type={'text'}
                                                        value={this.state.boundaryTitle}
                                                        onChange={(e) => this.setState({boundaryTitle: e.target.value})}
                                                    />
                                            }
                                        </React.Fragment> : null
                                    }
                                </div>
                                {
                                    this.props.boundaryLayers?.map(boundary => (
                                        <MenuRow layer={boundary}/>
                                    ))
                                }
                                {
                                    this.props.boundaryLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            ...Creating default Boundary
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
                                        width: "480px",
                                        textAlign: "left",
                                        border: "none"
                                    }}
                                >
                                    <span className="pull-left menu-row-text">Friction Maps</span>
                                    {this.props.canEditAnugaMap ?
                                        <React.Fragment>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.frictionTitle ? "" : " disabled"}`}
                                                style={{
                                                    "color": "limegreen",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginRight": "8px",
                                                    "float": "right"
                                                }}
                                                onClick={() => {
                                                    this.props.setCreatingAnugaLayer(true);
                                                    this.props.createAnugaFriction(this.state.frictionTitle);
                                                    this.setState({frictionTitle: ''});
                                                }}
                                            />
                                            {
                                                this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" style={{
                                                            display: "inline-block",
                                                            position: "absolute",
                                                            right: "45px"
                                                        }} spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    <input
                                                        id={'friction-input'}
                                                        key={'friction-input'}
                                                        className={'data-title-input'}
                                                        style={{marginTop: "3px", marginRight: "5px"}}
                                                        type={'text'}
                                                        value={this.state.frictionTitle}
                                                        onChange={(e) => this.setState({frictionTitle: e.target.value})}
                                                    />
                                            }
                                        </React.Fragment> : null
                                    }
                                </div>
                                {
                                    this.props.frictionLayers?.map(friction => (
                                        <MenuRow layer={friction}/>
                                    ))
                                }
                                {
                                    this.props.frictionLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            ...Creating default Friction Map
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
                                        width: "480px",
                                        textAlign: "left",
                                        border: "none"
                                    }}
                                >
                                    <span className="pull-left menu-row-text">Inflows</span>
                                    {this.props.canEditAnugaMap ?
                                        <React.Fragment>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.inflowTitle ? "" : " disabled"}`}
                                                style={{
                                                    "color": "limegreen",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginRight": "8px",
                                                    "float": "right"
                                                }}
                                                onClick={() => {
                                                    this.props.setCreatingAnugaLayer(true);
                                                    this.props.createAnugaInflow(this.state.inflowTitle);
                                                    this.setState({inflowTitle: ''});
                                                }}
                                            />
                                            {
                                                this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" style={{
                                                            display: "inline-block",
                                                            position: "absolute",
                                                            right: "45px"
                                                        }} spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    <input
                                                        id={'inflow-input'}
                                                        key={'inflow-input'}
                                                        className={'data-title-input'}
                                                        style={{marginTop: "3px", marginRight: "5px"}}
                                                        type={'text'}
                                                        value={this.state.inflowTitle}
                                                        onChange={(e) => this.setState({inflowTitle: e.target.value})}
                                                    />
                                            }
                                        </React.Fragment> : null
                                    }
                                </div>
                                {
                                    this.props.inflowLayers?.map(inflow => (
                                        <MenuRow layer={inflow}/>
                                    ))
                                }
                                {
                                    this.props.inflowLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            ...Creating default Inflows
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
                                        width: "480px",
                                        textAlign: "left",
                                        border: "none"
                                    }}
                                >
                                    <span className="pull-left menu-row-text">Structures</span>
                                    {this.props.canEditAnugaMap ?
                                        <React.Fragment>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.structureTitle ? "" : " disabled"}`}
                                                style={{
                                                    "color": "limegreen",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginRight": "8px",
                                                    "float": "right"
                                                }}
                                                onClick={() => {
                                                    this.props.setCreatingAnugaLayer(true);
                                                    this.props.createAnugaStructure(this.state.structureTitle);
                                                    this.setState({structureTitle: ''});
                                                }}
                                            />
                                            {
                                                this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" style={{
                                                            display: "inline-block",
                                                            position: "absolute",
                                                            right: "45px"
                                                        }} spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    <input
                                                        id={'structure-input'}
                                                        key={'structure-input'}
                                                        className={'data-title-input'}
                                                        style={{marginTop: "3px", marginRight: "5px"}}
                                                        type={'text'}
                                                        value={this.state.structureTitle}
                                                        onChange={(e) => this.setState({structureTitle: e.target.value})}
                                                    />
                                            }
                                        </React.Fragment> : null
                                    }
                                </div>
                                {
                                    this.props.structureLayers?.map(structure => (
                                        <MenuRow layer={structure}/>
                                    ))
                                }
                                {
                                    this.props.structureLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            ...Creating default Structures
                                        </div>
                                        : null
                                }
                            </div>
                            <div
                                className={'menu-rows-container'}
                                style={{
                                    "border": "1px solid rgba(255, 255, 255, 0.5)",
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
                                    <span className="pull-left menu-row-text">Mesh Regions</span>
                                    {this.props.canEditAnugaMap ?
                                        <React.Fragment>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.meshRegionTitle ? "" : " disabled"}`}
                                                style={{
                                                    "color": "limegreen",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginRight": "8px",
                                                    "float": "right"
                                                }}
                                                onClick={() => {
                                                    this.props.setCreatingAnugaLayer(true);
                                                    this.props.createAnugaMeshRegion(this.state.meshRegionTitle);
                                                    this.setState({meshRegionTitle: ''});
                                                }}
                                            />
                                            {
                                                this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" style={{
                                                            display: "inline-block",
                                                            position: "absolute",
                                                            right: "45px"
                                                        }} spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    <input
                                                        id={'mesh-region-input'}
                                                        key={'mesh-region-input'}
                                                        className={'data-title-input'}
                                                        style={{marginTop: "3px", marginRight: "5px"}}
                                                        type={'text'}
                                                        value={this.state.meshRegionTitle}
                                                        onChange={(e) => this.setState({meshRegionTitle: e.target.value})}
                                                    />
                                            }
                                        </React.Fragment> : null
                                    }
                                </div>
                                {
                                    this.props.meshRegionLayers?.map(meshRegion => (
                                        <MenuRow layer={meshRegion}/>
                                    ))
                                }
                                {
                                    this.props.meshRegionLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            ...Creating default Mesh Region
                                        </div>
                                        : null
                                }
                            </div>
                        </React.Fragment> : null
                }
                <UploaderPanel fileType={'elevation'}/>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        projectData: state?.anuga?.projectData,
        elevationLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Elevations'),
        boundaryLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Boundaries'),
        frictionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction Maps'),
        inflowLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Inflows'),
        structureLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Structures'),
        meshRegionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Mesh Regions'),
        elevationModels: state?.anuga?.elevations,
        boundaryModels: state?.anuga?.boundaries,
        frictionModels: state?.anuga?.frictions,
        inflowModels: state?.anuga?.inflows,
        structureModels: state?.anuga?.structures,
        meshRegionModels: state?.anuga?.meshRegions,
        isCreatingAnugaLayer: state?.anuga?.isCreatingAnugaLayer,
        canEditAnugaMap: canEditAnugaMap(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        addAnugaBoundary: () => dispatch(addAnugaBoundary()),
        addAnugaFriction: () => dispatch(addAnugaFriction()),
        addAnugaInflow: () => dispatch(addAnugaInflow()),
        addAnugaStructure: () => dispatch(addAnugaStructure()),
        addAnugaMeshRegion: () => dispatch(addAnugaMeshRegion()),
        startAnugaElevationPolling: () => dispatch(startAnugaElevationPolling()),
        startAnugaModelCreationPolling: () => dispatch(startAnugaModelCreationPolling()),
        stopAnugaModelCreationPolling: () => dispatch(stopAnugaModelCreationPolling()),
        setVisibleUploaderPanel: (visible) => dispatch(setVisibleUploaderPanel(visible)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle)),
        createAnugaMeshRegion: (meshRegionTitle) => dispatch(createAnugaMeshRegion(meshRegionTitle)),
        setCreatingAnugaLayer: (isCreatingAnugaLayer) => dispatch(setCreatingAnugaLayer(isCreatingAnugaLayer))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu};
