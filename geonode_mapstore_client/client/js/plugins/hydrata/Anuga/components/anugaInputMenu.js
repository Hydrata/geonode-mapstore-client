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
    addAnugaFullMesh,
    addAnugaMeshRegion,
    addNetwork,
    addCatchment,
    addNodes,
    addLinks,
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaStructure,
    createAnugaMeshRegion,
    createNetwork,
    createCatchment,
    createNodes,
    createLinks,
    setCreatingAnugaLayer,
    startAnugaElevationPolling,
    stopAnugaElevationPolling,
    startAnugaModelCreationPolling,
    stopAnugaModelCreationPolling,
    setNetworkMenu,
    setAnugaInputMenu
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
        createNetwork: PropTypes.func,
        createCatchment: PropTypes.func,
        createNodes: PropTypes.func,
        createLinks: PropTypes.func,
        frictionLayers: PropTypes.array,
        inflowLayers: PropTypes.array,
        structureLayers: PropTypes.array,
        fullMeshLayers: PropTypes.array,
        meshRegionLayers: PropTypes.array,
        catchmentLayers: PropTypes.array,
        nodesLayers: PropTypes.array,
        linksLayers: PropTypes.array,
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
        addAnugaFullMesh: PropTypes.func,
        addAnugaMeshRegion: PropTypes.func,
        addCatchment: PropTypes.func,
        addNodes: PropTypes.func,
        addLinks: PropTypes.func,
        networks: PropTypes.array,
        setNetworkMenu: PropTypes.func,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        structureModels: PropTypes.array,
        fullMeshModels: PropTypes.array,
        meshRegionModels: PropTypes.array,
        catchmentModels: PropTypes.array,
        nodesModels: PropTypes.array,
        linksModels: PropTypes.array,
        setAnugaInputMenu: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            showAdvanced: false,
            boundaryTitle: '',
            frictionTitle: '',
            inflowTitle: '',
            structureTitle: '',
            meshRegionTitle: '',
            networkTitle: '',
            catchmentTitle: '',
            nodesTitle: '',
            linksTitle: ''
        };
    }

    componentDidMount() {
        this.props.startAnugaModelCreationPolling();
        this.props.startAnugaElevationPolling();
    }

    componentWillUnmount() {
        this.props.stopAnugaModelCreationPolling();
        this.props.stopAnugaElevationPolling();
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
                                    "border": "1px solid rgba(255, 255, 255)",
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
                                            None
                                        </div>
                                        : null
                                }
                            </div>
                            <div
                                className={'menu-rows-container'}
                                style={{
                                    "border": "1px solid rgba(255, 255, 255)",
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
                                            None
                                        </div>
                                        : null
                                }
                            </div>
                            <div
                                className={'menu-rows-container'}
                                style={{
                                    "border": "1px solid rgba(255, 255, 255)",
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
                                    <span className="pull-left menu-row-text">Advanced</span>
                                    <span
                                        className={`btn glyphicon menu-row-glyph ${this.state.showAdvanced ? "glyphicon-chevron-down" : "glyphicon-chevron-right"}`}
                                        style={{
                                            "color": "#325f93",
                                            "fontSize": "smaller",
                                            "textAlign": "right",
                                            "marginRight": "8px",
                                            "float": "right"
                                        }}
                                        onClick={() => {
                                            this.setState(prevState => ({showAdvanced: !prevState.showAdvanced}));
                                        }}
                                    />
                                </div>
                            </div>
                            {this.state.showAdvanced ?
                                <div id={'advancedInputs'}>
                                    <div
                                        className={'menu-rows-container'}
                                        style={{
                                            "border": "1px solid rgba(255, 255, 255)",
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
                                            <span className="pull-left menu-row-text">Full Mesh</span>
                                        </div>
                                        {
                                            this.props.fullMeshLayers?.map(fullMesh => (
                                                <MenuRow layer={fullMesh}/>
                                            ))
                                        }
                                        {
                                            this.props.fullMeshLayers?.length === 0 ?
                                                <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                                    Mesh will appear here when a Scenario is built.
                                                </div>
                                                : null
                                        }
                                    </div>
                                    <div
                                        className={'menu-rows-container'}
                                        style={{
                                            "border": "1px solid rgba(255, 255, 255)",
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
                                                    None
                                                </div>
                                                : null
                                        }
                                    </div>
                                    <div
                                        className={'menu-rows-container'}
                                        style={{
                                            "border": "1px solid rgba(255, 255, 255)",
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
                                                    None
                                                </div>
                                                : null
                                        }
                                    </div>
                                    <div
                                        className={'menu-rows-container'}
                                        style={{
                                            "border": "1px solid rgba(255, 255, 255)",
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
                                                    None
                                                </div>
                                                : null
                                        }
                                    </div>
                                    <div
                                        className={'menu-rows-container'}
                                        style={{
                                            "border": "1px solid rgba(255, 255, 255)",
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
                                            <span className="pull-left menu-row-text" style={{"marginTop": "4px"}}>Networks</span>
                                            <span
                                                className={`btn glyphicon menu-row-glyph glyphicon-cog`}
                                                style={{
                                                    "color": "#325f93",
                                                    "fontSize": "smaller",
                                                    "textAlign": "right",
                                                    "marginLeft": "8px",
                                                    "float": "left"
                                                }}
                                                onClick={() => {
                                                    this.props.setNetworkMenu(true);
                                                    this.props.setAnugaInputMenu(false);
                                                }}
                                            />
                                            {this.props.canEditAnugaMap ?
                                                <React.Fragment>
                                                    <span
                                                        className={`btn glyphicon menu-row-glyph glyphicon-plus${this.state.networkTitle ? "" : " disabled"}`}
                                                        style={{
                                                            "color": "limegreen",
                                                            "fontSize": "smaller",
                                                            "textAlign": "right",
                                                            "marginRight": "8px",
                                                            "float": "right"
                                                        }}
                                                        onClick={() => {
                                                            this.props.setCreatingAnugaLayer(true);
                                                            this.props.createNetwork(this.state.networkTitle);
                                                            this.setState({networkTitle: ''});
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
                                                                id={'network-input'}
                                                                key={'network-input'}
                                                                className={'data-title-input'}
                                                                style={{marginTop: "3px", marginRight: "5px"}}
                                                                type={'text'}
                                                                value={this.state.networkTitle}
                                                                onChange={(e) => this.setState({networkTitle: e.target.value})}
                                                            />
                                                    }
                                                </React.Fragment> : null
                                            }
                                        </div>
                                        <div>
                                            <div className={'menu-row-mini-container'}>
                                                <p className={'menu-row-mini-heading'}>Catchments</p>
                                                {
                                                    this.props.catchmentLayers?.map(catchment => (
                                                        <MenuRow layer={catchment}/>
                                                    ))
                                                }
                                            </div>
                                            <div className={'menu-row-mini-container'}>
                                                <p className={'menu-row-mini-heading'}>Nodes</p>
                                                {
                                                    this.props.nodesLayers?.map(nodes => (
                                                        <MenuRow layer={nodes}/>
                                                    ))
                                                }
                                            </div>
                                            <div className={'menu-row-mini-container'}>
                                                <p className={'menu-row-mini-heading'}>Links</p>
                                                {
                                                    this.props.linksLayers?.map(links => (
                                                        <MenuRow layer={links}/>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div> :
                                null
                            }
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
        inflowLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Inflows'),
        frictionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction Maps'),
        structureLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Structures'),
        fullMeshLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Full Mesh'),
        meshRegionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Mesh Regions'),
        networkLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Networks'),
        catchmentLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Catchments'),
        nodesLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Nodes'),
        linksLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Links'),
        elevationModels: state?.anuga?.elevations,
        boundaryModels: state?.anuga?.boundaries,
        inflowModels: state?.anuga?.inflows,
        frictionModels: state?.anuga?.frictions,
        structureModels: state?.anuga?.structures,
        fullMeshModels: state?.anuga?.fullMeshes,
        meshRegionModels: state?.anuga?.meshRegions,
        catchmentModels: state?.anuga?.catchments,
        nodesModels: state?.anuga?.nodes,
        linksModels: state?.anuga?.links,
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
        addAnugaFullMesh: () => dispatch(addAnugaFullMesh()),
        addAnugaMeshRegion: () => dispatch(addAnugaMeshRegion()),
        addCatchment: () => dispatch(addCatchment()),
        setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        addNetwork: () => dispatch(addNetwork()),
        addNodes: () => dispatch(addNodes()),
        addLinks: () => dispatch(addLinks()),
        startAnugaElevationPolling: () => dispatch(startAnugaElevationPolling()),
        stopAnugaElevationPolling: () => dispatch(stopAnugaElevationPolling()),
        startAnugaModelCreationPolling: () => dispatch(startAnugaModelCreationPolling()),
        stopAnugaModelCreationPolling: () => dispatch(stopAnugaModelCreationPolling()),
        setVisibleUploaderPanel: (visible) => dispatch(setVisibleUploaderPanel(visible)),
        setCreatingAnugaLayer: (isCreatingAnugaLayer) => dispatch(setCreatingAnugaLayer(isCreatingAnugaLayer)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaMeshRegion: (meshRegionTitle) => dispatch(createAnugaMeshRegion(meshRegionTitle)),
        createNetwork: (networkTitle) => dispatch(createNetwork(networkTitle))
        // createCatchment: (catchmentTitle) => dispatch(createCatchment(catchmentTitle)),
        // createNodes: (nodesTitle) => dispatch(createNodes(nodesTitle)),
        // createLinks: (linksTitle) => dispatch(createLinks(linksTitle))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu};
