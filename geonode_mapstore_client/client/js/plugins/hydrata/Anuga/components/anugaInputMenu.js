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
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaStructure,
    createAnugaMeshRegion,
    setCreatingAnugaLayer,
    startAnugaElevationPolling
} from "../actionsAnuga";
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        project: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        anugaGroupLength: PropTypes.number,
        elevations: PropTypes.array,
        boundaries: PropTypes.array,
        createAnugaBoundary: PropTypes.func,
        createAnugaFriction: PropTypes.func,
        createAnugaInflow: PropTypes.func,
        createAnugaStructure: PropTypes.func,
        createAnugaMeshRegion: PropTypes.func,
        frictions: PropTypes.array,
        inflows: PropTypes.array,
        structures: PropTypes.array,
        meshRegions: PropTypes.array,
        startAnugaElevationPolling: PropTypes.func,
        isCreatingAnugaLayer: PropTypes.bool,
        setCreatingAnugaLayer: PropTypes.func
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
                        this.props.elevations?.map(elevation => (
                            <MenuRow layer={elevation}/>
                        ))
                    }
                    {
                        this.props.elevations?.length === 0 ?
                            <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                No elevations available
                            </div>
                            : null
                    }
                </div>
                {
                    this.props.project?.projection ?
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
                                    <span
                                        className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.boundaryTitle ? "" : " disabled"}`}
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
                                                type={'text'}
                                                value={this.state.boundaryTitle}
                                                onChange={(e) => this.setState({boundaryTitle: e.target.value})}
                                            />
                                    }
                                </div>
                                {
                                    this.props.boundaries?.map(boundary => (
                                        <MenuRow layer={boundary}/>
                                    ))
                                }
                                {
                                    this.props.boundaries?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            No boundaries available
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
                                    <span
                                        className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.frictionTitle ? "" : " disabled"}`}
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
                                                type={'text'}
                                                value={this.state.frictionTitle}
                                                onChange={(e) => this.setState({frictionTitle: e.target.value})}
                                            />
                                    }
                                </div>
                                {
                                    this.props.frictions?.map(friction => (
                                        <MenuRow layer={friction}/>
                                    ))
                                }
                                {
                                    this.props.frictions?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            No friction maps available
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
                                    <span
                                        className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.inflowTitle ? "" : " disabled"}`}
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
                                                type={'text'}
                                                value={this.state.inflowTitle}
                                                onChange={(e) => this.setState({inflowTitle: e.target.value})}
                                            />
                                    }
                                </div>
                                {
                                    this.props.inflows?.map(inflow => (
                                        <MenuRow layer={inflow}/>
                                    ))
                                }
                                {
                                    this.props.inflows?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            No inflows available
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
                                    <span
                                        className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.structureTitle ? "" : " disabled"}`}
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
                                                type={'text'}
                                                value={this.state.structureTitle}
                                                onChange={(e) => this.setState({structureTitle: e.target.value})}
                                            />
                                    }
                                </div>
                                {
                                    this.props.structures?.map(structure => (
                                        <MenuRow layer={structure}/>
                                    ))
                                }
                                {
                                    this.props.structures?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            No structures available
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
                                    <span className="pull-left menu-row-text">Mesh Regions</span>
                                    <span
                                        className={`btn glyphicon menu-row-glyph glyphicon-edit${this.state.meshRegionTitle ? "" : " disabled"}`}
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
                                                type={'text'}
                                                value={this.state.meshRegionTitle}
                                                onChange={(e) => this.setState({meshRegionTitle: e.target.value})}
                                            />
                                    }
                                </div>
                                {
                                    this.props.meshRegions?.map(meshRegion => (
                                        <MenuRow layer={meshRegion}/>
                                    ))
                                }
                                {
                                    this.props.meshRegions?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "480px", textAlign: "left", border: "none"}}>
                                            No Mesh Regions available
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
        project: state?.anuga?.project,
        elevations: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Elevations'),
        boundaries: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Boundaries'),
        frictions: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction Maps'),
        inflows: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Inflows'),
        structures: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Structures'),
        meshRegions: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Mesh Regions'),
        isCreatingAnugaLayer: state?.anuga?.isCreatingAnugaLayer
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        startAnugaElevationPolling: () => dispatch(startAnugaElevationPolling()),
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
