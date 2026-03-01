import React from "react";
import {connect} from "react-redux";
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setVisibleUploaderPanel,
    setVisibleIntroduction
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
import InputSection from "./InputSection";

import {canEditAnugaMap} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";

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
        elevationModels: PropTypes.array,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        structureModels: PropTypes.array,
        fullMeshModels: PropTypes.array,
        meshRegionModels: PropTypes.array,
        catchmentModels: PropTypes.array,
        nodesModels: PropTypes.array,
        linksModels: PropTypes.array,
        setAnugaInputMenu: PropTypes.func,
        visibleIntroduction: PropTypes.bool,
        setVisibleIntroduction: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            visibleIntroduction: true,
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
        this.props.startAnugaElevationPolling();
    }

    componentWillUnmount() {
        this.props.stopAnugaElevationPolling();
    }

    createAndReset = (createFn, titleKey) => {
        this.props.setCreatingAnugaLayer(true);
        createFn(this.state[titleKey]);
        this.setState({[titleKey]: ''});
    }

    render() {
        return (
            <div id={'anuga-input-menu'} className={'simple-view-panel'} style={{top: "70px", width: "560px"}}>
                {/* Elevation section — unique (upload button instead of create+input) */}
                <div
                    className={'menu-rows-container'}
                    style={{ border: "1px solid rgba(255, 255, 255, 1)", borderRadius: "3px", margin: "3px 0" }}
                >
                    <div className={"row menu-row menu-row-header"} style={{ width: "540px", textAlign: "left", border: "none" }}>
                        <span className="menu-row-text"><Message msgId="hydrata.anuga.elevations" /></span>
                        <OverlayTrigger placement="right" overlay={<Tooltip><Message msgId="hydrata.anuga.uploadElevationTooltip" /></Tooltip>}>
                            <span
                                className={"btn pull-right glyphicon menu-row-glyph glyphicon-upload"}
                                style={{color: "limegreen", fontSize: "smaller", textAlign: "right", marginRight: "8px"}}
                                onClick={() => {
                                    this.props.setVisibleUploaderPanel(true, "elevation", null);
                                    this.props.startAnugaElevationPolling();
                                    trackEvent('button', 'click', 'anuga-input-menu-show-elevation-uploader');
                                }}
                            />
                        </OverlayTrigger>
                    </div>
                    {this.props.elevationLayers?.map(elevation => <MenuRow layer={elevation}/>)}
                    {this.props.elevationLayers?.length === 0 ?
                        <div className={"row menu-row menu-row"} style={{width: "540px", textAlign: "left", border: "none"}}>
                            <Message msgId="hydrata.anuga.noElevationsAvailable" />
                        </div> : null
                    }
                </div>
                {this.props.projectData?.projection ?
                    <React.Fragment>
                        <InputSection
                            titleMsgId="hydrata.anuga.boundaries"
                            layers={this.props.boundaryLayers}
                            titleValue={this.state.boundaryTitle}
                            onTitleChange={(v) => this.setState({boundaryTitle: v})}
                            onCreate={() => this.createAndReset(this.props.createAnugaBoundary, 'boundaryTitle')}
                            isCreating={this.props.isCreatingAnugaLayer}
                            canEdit={this.props.canEditAnugaMap}
                            inputId="boundary-input"
                            trackEventName="anuga-input-menu-create-new-boundary"
                        />
                        <InputSection
                            titleMsgId="hydrata.anuga.inflows"
                            layers={this.props.inflowLayers}
                            titleValue={this.state.inflowTitle}
                            onTitleChange={(v) => this.setState({inflowTitle: v})}
                            onCreate={() => this.createAndReset(this.props.createAnugaInflow, 'inflowTitle')}
                            isCreating={this.props.isCreatingAnugaLayer}
                            canEdit={this.props.canEditAnugaMap}
                            inputId="inflow-input"
                            trackEventName="anuga-input-menu-create-new-inflow"
                        />
                        {/* Advanced accordion */}
                        <div className={'menu-rows-container'} style={{ border: "1px solid rgba(255, 255, 255)", borderRadius: "3px", margin: "3px 0" }}>
                            <div className={"row menu-row menu-row-header"} style={{ width: "540px", textAlign: "left", border: "none" }}>
                                <span className="pull-left menu-row-text"><Message msgId="hydrata.anuga.advanced" /></span>
                                <span
                                    className={`btn glyphicon menu-row-glyph ${this.state.showAdvanced ? "glyphicon-chevron-down" : "glyphicon-chevron-right"}`}
                                    style={{ color: "#325f93", fontSize: "smaller", textAlign: "right", marginRight: "8px", float: "right" }}
                                    onClick={() => {
                                        this.setState(prevState => ({showAdvanced: !prevState.showAdvanced}));
                                        trackEvent('button', 'click', 'anuga-input-menu-show-advanced');
                                    }}
                                />
                            </div>
                        </div>
                        {this.state.showAdvanced ?
                            <div id={'advancedInputs'}>
                                {/* Introduction toggle */}
                                <div className={'menu-rows-container'} style={{ border: "1px solid rgba(255, 255, 255)", borderRadius: "3px", margin: "3px 0" }}>
                                    <div className={"row menu-row menu-row-header"} style={{ width: "540px", textAlign: "left", border: "none" }}>
                                        <span
                                            className={"btn glyphicon menu-row-glyph " + (this.props.visibleIntroduction ? "glyphicon-ok" : "glyphicon-remove")}
                                            style={{color: this.props.visibleIntroduction ? "limegreen" : "red"}}
                                            onClick={() => {
                                                this.props.setVisibleIntroduction(!this.props.visibleIntroduction);
                                                trackEvent('button', 'click', 'anuga-input-menu-show-introduction');
                                            }}
                                        />
                                        <span className="menu-row-text"><Message msgId="hydrata.anuga.introduction" /></span>
                                    </div>
                                </div>
                                {/* Full Mesh — read-only, no create button */}
                                <div className={'menu-rows-container'} style={{ border: "1px solid rgba(255, 255, 255)", borderRadius: "3px", margin: "3px 0" }}>
                                    <div className={"row menu-row menu-row-header"} style={{ width: "540px", textAlign: "left", border: "none" }}>
                                        <span className="pull-left menu-row-text"><Message msgId="hydrata.anuga.fullMesh" /></span>
                                    </div>
                                    {this.props.fullMeshLayers?.map(fullMesh => <MenuRow layer={fullMesh}/>)}
                                    {this.props.fullMeshLayers?.length === 0 ?
                                        <div className={"row menu-row menu-row"} style={{width: "540px", textAlign: "left", border: "none"}}>
                                            <Message msgId="hydrata.anuga.meshWillAppear" />
                                        </div> : null
                                    }
                                </div>
                                <InputSection
                                    titleMsgId="hydrata.anuga.meshRegions"
                                    layers={this.props.meshRegionLayers}
                                    titleValue={this.state.meshRegionTitle}
                                    onTitleChange={(v) => this.setState({meshRegionTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaMeshRegion, 'meshRegionTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="mesh-region-input"
                                    trackEventName="anuga-input-menu-create-mesh-region"
                                />
                                <InputSection
                                    titleMsgId="hydrata.anuga.frictionMaps"
                                    layers={this.props.frictionLayers}
                                    titleValue={this.state.frictionTitle}
                                    onTitleChange={(v) => this.setState({frictionTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaFriction, 'frictionTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="friction-input"
                                    trackEventName="anuga-input-menu-create-friction"
                                />
                                <InputSection
                                    titleMsgId="hydrata.anuga.structures"
                                    layers={this.props.structureLayers}
                                    titleValue={this.state.structureTitle}
                                    onTitleChange={(v) => this.setState({structureTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaStructure, 'structureTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="structure-input"
                                    trackEventName="anuga-input-menu-create-structure"
                                />
                                {/* Networks section — has extra cog button + sub-sections */}
                                <InputSection
                                    titleMsgId="hydrata.anuga.networks"
                                    layers={[]}
                                    titleValue={this.state.networkTitle}
                                    onTitleChange={(v) => this.setState({networkTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createNetwork, 'networkTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="network-input"
                                    trackEventName="anuga-input-menu-create-network"
                                    extraHeaderContent={
                                        <span
                                            className={`btn glyphicon menu-row-glyph glyphicon-cog`}
                                            style={{ color: "#325f93", fontSize: "smaller", textAlign: "right", marginLeft: "8px", float: "left" }}
                                            onClick={() => {
                                                this.props.setNetworkMenu(true);
                                                this.props.setAnugaInputMenu(false);
                                                trackEvent('button', 'click', 'anuga-input-menu-show-network');
                                            }}
                                        />
                                    }
                                >
                                </InputSection>
                                {/* Network sub-sections: catchments, nodes, links */}
                                <div className={'menu-rows-container'} style={{ border: "1px solid rgba(255, 255, 255)", borderRadius: "3px", margin: "3px 0" }}>
                                    <div>
                                        <div className={'menu-row-mini-container'}>
                                            <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.catchments" /></p>
                                            {this.props.catchmentLayers?.map(catchment => <MenuRow layer={catchment}/>)}
                                        </div>
                                        <div className={'menu-row-mini-container'}>
                                            <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.nodes" /></p>
                                            {this.props.nodesLayers?.map(nodes => <MenuRow layer={nodes}/>)}
                                        </div>
                                        <div className={'menu-row-mini-container'}>
                                            <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.links" /></p>
                                            {this.props.linksLayers?.map(links => <MenuRow layer={links}/>)}
                                        </div>
                                    </div>
                                </div>
                            </div> : null
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
        canEditAnugaMap: canEditAnugaMap(state),
        visibleIntroduction: state?.simpleView?.visibleIntroduction
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
        setVisibleUploaderPanel: (visible, importerConfigKey, layerId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, layerId)),
        setCreatingAnugaLayer: (isCreatingAnugaLayer) => dispatch(setCreatingAnugaLayer(isCreatingAnugaLayer)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaMeshRegion: (meshRegionTitle) => dispatch(createAnugaMeshRegion(meshRegionTitle)),
        createNetwork: (networkTitle) => dispatch(createNetwork(networkTitle)),
        setVisibleIntroduction: (visible) => dispatch(setVisibleIntroduction(visible))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu};
