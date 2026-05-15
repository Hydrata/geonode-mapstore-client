import React from "react";
import {connect} from "react-redux";
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
const PropTypes = require('prop-types');
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    setVisibleUploaderPanel
} from "../../SimpleView/actionsSimpleView";
import {
    addAnugaBoundary,
    addAnugaFriction,
    addAnugaInflow,
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    addAnugaRainfall,
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
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
    createAnugaRainfall,
    createAnugaStructure,
    createAnugaMeshRegion,
    createNetwork,
    setCreatingAnugaLayer,
    startAnugaModelCreationPolling,
    stopAnugaModelCreationPolling,
    setNetworkMenu,
    setAnugaInputMenu
} from "../actionsAnuga";
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";
import InputSection from "./InputSection";
import AnugaInputStarterCard from "./anugaInputStarterCard";

import {canEditAnugaMap, getProjectId} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {createSelector} from 'reselect';
const Spinner = require('react-spinkit');

const ACTIVE_TM_STATES = new Set(['pending', 'running']);
// TASK-955 (W2.2 FE) — 'Rainfall' added. Process metadata.model_class is the
// Python class name; the selector below groups in-flight layer_create work for
// each type so InputSection can render a per-section pending placeholder.
const PENDING_MODEL_CLASSES = ['Boundary', 'Inflow', 'Rainfall', 'Friction', 'Structure', 'MeshRegion'];
const EMPTY_BY_ID = {};
const EMPTY_IDS = [];

const stripModelPrefix = (name) => {
    if (!name || typeof name !== 'string') return name;
    const idx = name.indexOf(': ');
    return idx >= 0 ? name.slice(idx + 2) : name;
};

// Single pass over TaskMonitor processes, grouping in-flight layer_create work
// by model class. Memoized so mapStateToProps doesn't re-walk on every action —
// inputs stay reference-stable between TaskMonitor polls.
const selectPendingByModel = createSelector(
    [
        (state) => state?.taskMonitor?.processes?.byId || EMPTY_BY_ID,
        (state) => state?.taskMonitor?.processes?.allIds || EMPTY_IDS,
        getProjectId
    ],
    (byId, ids, projectId) => {
        const out = {};
        for (const mc of PENDING_MODEL_CLASSES) out[mc] = [];
        if (!projectId) return out;
        const pid = String(projectId);
        for (const id of ids) {
            const p = byId[id];
            if (!p || p.process_type !== 'layer_create') continue;
            if (!ACTIVE_TM_STATES.has(p.status)) continue;
            if (String(p.metadata?.project_id) !== pid) continue;
            const mc = p.metadata?.model_class;
            if (out[mc]) out[mc].push({id: p.id, title: stripModelPrefix(p.name)});
        }
        return out;
    }
);

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        projectData: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        anugaGroupLength: PropTypes.number,
        terrainLayers: PropTypes.array,
        boundaryLayers: PropTypes.array,
        createAnugaBoundary: PropTypes.func,
        createAnugaFriction: PropTypes.func,
        createAnugaInflow: PropTypes.func,
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        createAnugaRainfall: PropTypes.func,
        createAnugaStructure: PropTypes.func,
        createAnugaMeshRegion: PropTypes.func,
        createNetwork: PropTypes.func,
        createCatchment: PropTypes.func,
        createNodes: PropTypes.func,
        createLinks: PropTypes.func,
        frictionLayers: PropTypes.array,
        // TASK-829 (W4.2b) — FrictionRaster layers (raster sibling to polygon Friction)
        frictionRasterLayers: PropTypes.array,
        inflowLayers: PropTypes.array,
        // TASK-955 (W2.2 FE) — Rainfall layer slice (rai_ prefix on BE → layer.group
        // 'Input Data.Rainfall' once the BE INPUT_DATA_GROUP_MAP entry ships).
        rainfallLayers: PropTypes.array,
        structureLayers: PropTypes.array,
        fullMeshLayers: PropTypes.array,
        meshRegionLayers: PropTypes.array,
        catchmentLayers: PropTypes.array,
        nodesLayers: PropTypes.array,
        linksLayers: PropTypes.array,
        startAnugaModelCreationPolling: PropTypes.func,
        stopAnugaModelCreationPolling: PropTypes.func,
        isCreatingAnugaLayer: PropTypes.bool,
        setCreatingAnugaLayer: PropTypes.func,
        canEditAnugaMap: PropTypes.func,
        pendingBoundaries: PropTypes.array,
        pendingInflows: PropTypes.array,
        // TASK-955 (W2.2 FE) — Rainfall pending list (in-flight layer_create
        // Processes whose metadata.model_class === 'Rainfall').
        pendingRainfalls: PropTypes.array,
        pendingFrictions: PropTypes.array,
        pendingStructures: PropTypes.array,
        pendingMeshRegions: PropTypes.array,
        starterPhase: PropTypes.oneOf(['terrain', 'defaults']),
        addAnugaBoundary: PropTypes.func,
        addAnugaFriction: PropTypes.func,
        addAnugaInflow: PropTypes.func,
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        addAnugaRainfall: PropTypes.func,
        addAnugaStructure: PropTypes.func,
        addAnugaFullMesh: PropTypes.func,
        addAnugaMeshRegion: PropTypes.func,
        addCatchment: PropTypes.func,
        addNodes: PropTypes.func,
        addLinks: PropTypes.func,
        terrainModels: PropTypes.array,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        rainfallModels: PropTypes.array,
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
            terrainCollapsed: false,
            boundariesCollapsed: false,
            inflowsCollapsed: false,
            // TASK-955 (W2.2 FE) — Rainfall section is collapse-state-tracked
            // identically to Inflows; default expanded so empty-state placeholder
            // shows during the `defaults` starter phase.
            rainfallsCollapsed: false,
            fullMeshCollapsed: false,
            meshRegionsCollapsed: false,
            frictionCollapsed: false,
            // TASK-829 (W4.2b) — Friction Rasters section defaults collapsed
            // (keeps the menu compact; raster usage is an advanced workflow).
            frictionRastersCollapsed: true,
            structuresCollapsed: false,
            networksCollapsed: false,
            networkInputVisible: false,
            boundaryTitle: '',
            frictionTitle: '',
            inflowTitle: '',
            // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
            rainfallTitle: '',
            structureTitle: '',
            meshRegionTitle: '',
            networkTitle: '',
            catchmentTitle: '',
            nodesTitle: '',
            linksTitle: ''
        };
    }

    componentDidUpdate(prevProps) {
        // `isCreatingAnugaLayer` is shared across sections; only collapse the
        // networks input if *this* section initiated the create (didNetworkSubmit
        // is set in handleNetworkPlusClick before createAndReset).
        if (
            prevProps.isCreatingAnugaLayer &&
            !this.props.isCreatingAnugaLayer &&
            this.state.networkInputVisible &&
            this.didNetworkSubmit
        ) {
            // eslint-disable-next-line react/no-did-update-set-state -- gated transition: only fires when `isCreatingAnugaLayer` flips false AFTER a local submit; bounded by didNetworkSubmit guard
            this.setState({networkInputVisible: false});
            this.didNetworkSubmit = false;
        }
    }

    createAndReset = (createFn, titleKey) => {
        this.props.setCreatingAnugaLayer(true);
        createFn(this.state[titleKey]);
        this.setState({[titleKey]: ''});
    }

    toggleSection = (sectionId) => {
        const key = `${sectionId}Collapsed`;
        this.setState((prev) => {
            const next = !prev[key];
            trackEvent('button', 'click', `anuga-input-menu-toggle-${sectionId}-${next ? 'collapsed' : 'expanded'}`);
            return {[key]: next};
        });
    }

    handleNetworkPlusClick = () => {
        if (!this.state.networkInputVisible) {
            this.setState({networkInputVisible: true});
        } else if (this.state.networkTitle) {
            this.didNetworkSubmit = true;
            this.createAndReset(this.props.createNetwork, 'networkTitle');
            trackEvent('button', 'click', 'anuga-input-menu-create-network');
        } else {
            this.setState({networkInputVisible: false});
        }
    }

    render() {
        return (
            <div id={'anuga-input-menu'} className={'simple-view-panel anuga-panel'}>
                {/* Terrain section — unique (upload button instead of create+input) */}
                <div
                    className={'menu-rows-container anuga-section'}
                >
                    <div className={"row menu-row menu-row-header anuga-section-header"}>
                        <span
                            className="menu-row-text anuga-section-header-clickable"
                            onClick={() => this.toggleSection('terrain')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    this.toggleSection('terrain');
                                }
                            }}
                            aria-expanded={!this.state.terrainCollapsed}
                        ><Message msgId="hydrata.anuga.terrain" /></span>
                        <OverlayTrigger placement="right" overlay={<Tooltip><Message msgId="hydrata.anuga.uploadTerrainTooltip" /></Tooltip>}>
                            <span
                                className={"btn pull-right glyphicon menu-row-glyph glyph-active glyphicon-upload"}
                                style={{fontSize: "smaller", textAlign: "right", marginRight: "8px"}}
                                onClick={() => {
                                    this.props.setVisibleUploaderPanel(true, "terrain", null);
                                    trackEvent('button', 'click', 'anuga-input-menu-show-terrain-uploader');
                                }}
                            />
                        </OverlayTrigger>
                        <span
                            className={`btn glyphicon menu-row-glyph glyph-collapse ${this.state.terrainCollapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}`}
                            style={{ fontSize: "smaller", marginLeft: "auto", marginRight: "8px" }}
                            onClick={() => this.toggleSection('terrain')}
                            aria-label={this.state.terrainCollapsed ? "Expand section" : "Collapse section"}
                        />
                    </div>
                    {!this.state.terrainCollapsed && this.props.terrainLayers?.map(terrain => <MenuRow layer={terrain}/>)}
                    {!this.state.terrainCollapsed && this.props.terrainLayers?.length === 0 ?
                        <div className={"row menu-row anuga-section-empty-row"}>
                            <Message msgId="hydrata.anuga.noTerrainAvailable" />
                        </div> : null
                    }
                </div>
                {this.props.starterPhase &&
                    <AnugaInputStarterCard
                        phase={this.props.starterPhase}
                        onUploadTerrain={() => this.props.setVisibleUploaderPanel(true, "terrain", null)}
                    />
                }
                {this.props.projectData?.projection ?
                    <React.Fragment>
                        <InputSection
                            titleMsgId="hydrata.anuga.boundaries"
                            layers={this.props.boundaryLayers}
                            pendingItems={this.props.pendingBoundaries}
                            titleValue={this.state.boundaryTitle}
                            onTitleChange={(v) => this.setState({boundaryTitle: v})}
                            onCreate={() => this.createAndReset(this.props.createAnugaBoundary, 'boundaryTitle')}
                            isCreating={this.props.isCreatingAnugaLayer}
                            isInitializing={this.props.starterPhase === 'defaults'}
                            canEdit={this.props.canEditAnugaMap}
                            inputId="boundary-input"
                            trackEventName="anuga-input-menu-create-new-boundary"
                            collapsed={this.state.boundariesCollapsed}
                            onToggleCollapse={() => this.toggleSection('boundaries')}
                        />
                        <InputSection
                            titleMsgId="hydrata.anuga.inflows"
                            layers={this.props.inflowLayers}
                            pendingItems={this.props.pendingInflows}
                            titleValue={this.state.inflowTitle}
                            onTitleChange={(v) => this.setState({inflowTitle: v})}
                            onCreate={() => this.createAndReset(this.props.createAnugaInflow, 'inflowTitle')}
                            isCreating={this.props.isCreatingAnugaLayer}
                            isInitializing={this.props.starterPhase === 'defaults'}
                            canEdit={this.props.canEditAnugaMap}
                            inputId="inflow-input"
                            trackEventName="anuga-input-menu-create-new-inflow"
                            collapsed={this.state.inflowsCollapsed}
                            onToggleCollapse={() => this.toggleSection('inflows')}
                        />
                        {/* TASK-955 (W2.2 FE) — Rainfall InputSection. Mirrors Inflows
                            structurally (polygon `rai_` BE geometry on the same compound
                            data picker pattern). Sits directly under Inflows so users
                            see the input-type split at a glance. `isInitializing` keys
                            off the same `defaults` starter phase so the empty-state
                            placeholder spins during the default-create burst. */}
                        <InputSection
                            titleMsgId="hydrata.anuga.rainfalls"
                            layers={this.props.rainfallLayers}
                            pendingItems={this.props.pendingRainfalls}
                            titleValue={this.state.rainfallTitle}
                            onTitleChange={(v) => this.setState({rainfallTitle: v})}
                            onCreate={() => this.createAndReset(this.props.createAnugaRainfall, 'rainfallTitle')}
                            isCreating={this.props.isCreatingAnugaLayer}
                            isInitializing={this.props.starterPhase === 'defaults'}
                            canEdit={this.props.canEditAnugaMap}
                            inputId="rainfall-input"
                            trackEventName="anuga-input-menu-create-new-rainfall"
                            collapsed={this.state.rainfallsCollapsed}
                            onToggleCollapse={() => this.toggleSection('rainfalls')}
                        />
                        {/* Advanced accordion */}
                        <div className={'menu-rows-container anuga-section'}>
                            <div className={"row menu-row menu-row-header anuga-section-header"}>
                                <span className="pull-left menu-row-text"><Message msgId="hydrata.anuga.advanced" /></span>
                                <span
                                    className={`btn glyphicon menu-row-glyph glyph-settings ${this.state.showAdvanced ? "glyphicon-chevron-down" : "glyphicon-chevron-right"}`}
                                    style={{ fontSize: "smaller", textAlign: "right", marginRight: "8px", "float": "right" }}
                                    onClick={() => {
                                        this.setState(prevState => ({showAdvanced: !prevState.showAdvanced}));
                                        trackEvent('button', 'click', 'anuga-input-menu-show-advanced');
                                    }}
                                />
                            </div>
                        </div>
                        {this.state.showAdvanced ?
                            <div id={'advancedInputs'}>
                                {/* Full Mesh — read-only, no create button */}
                                <div className={'menu-rows-container anuga-section'}>
                                    <div className={"row menu-row menu-row-header anuga-section-header"}>
                                        <span
                                            className="menu-row-text anuga-section-header-clickable"
                                            onClick={() => this.toggleSection('fullMesh')}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    this.toggleSection('fullMesh');
                                                }
                                            }}
                                            aria-expanded={!this.state.fullMeshCollapsed}
                                        ><Message msgId="hydrata.anuga.fullMesh" /></span>
                                        <span
                                            className={`btn glyphicon menu-row-glyph glyph-collapse ${this.state.fullMeshCollapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}`}
                                            style={{ fontSize: "smaller", marginLeft: "auto", marginRight: "8px" }}
                                            onClick={() => this.toggleSection('fullMesh')}
                                            aria-label={this.state.fullMeshCollapsed ? "Expand section" : "Collapse section"}
                                        />
                                    </div>
                                    {!this.state.fullMeshCollapsed && this.props.fullMeshLayers?.map(fullMesh => <MenuRow layer={fullMesh}/>)}
                                    {!this.state.fullMeshCollapsed && this.props.fullMeshLayers?.length === 0 ?
                                        <div className={"row menu-row anuga-section-empty-row"}>
                                            <Message msgId="hydrata.anuga.meshWillAppear" />
                                        </div> : null
                                    }
                                </div>
                                <InputSection
                                    titleMsgId="hydrata.anuga.meshRegions"
                                    layers={this.props.meshRegionLayers}
                                    pendingItems={this.props.pendingMeshRegions}
                                    titleValue={this.state.meshRegionTitle}
                                    onTitleChange={(v) => this.setState({meshRegionTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaMeshRegion, 'meshRegionTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="mesh-region-input"
                                    trackEventName="anuga-input-menu-create-mesh-region"
                                    collapsed={this.state.meshRegionsCollapsed}
                                    onToggleCollapse={() => this.toggleSection('meshRegions')}
                                />
                                <InputSection
                                    titleMsgId="hydrata.anuga.friction"
                                    layers={this.props.frictionLayers}
                                    pendingItems={this.props.pendingFrictions}
                                    titleValue={this.state.frictionTitle}
                                    onTitleChange={(v) => this.setState({frictionTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaFriction, 'frictionTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="friction-input"
                                    trackEventName="anuga-input-menu-create-friction"
                                    collapsed={this.state.frictionCollapsed}
                                    onToggleCollapse={() => this.toggleSection('friction')}
                                />
                                {/* TASK-829 (W4.2b) — Friction Rasters section. Raster sibling to
                                    polygon Friction; both can coexist in one project. Upload-only UX
                                    (no create-from-title) since rasters originate from TIF upload, not
                                    geometric drawing. Upload button is currently INERT — opens the
                                    SimpleView uploader, but the Begin action is disabled by the
                                    existing TASK-599 guard until the BE follow-up ships:
                                      1. `importer_config.friction_raster` entry in Project.save()
                                      2. FrictionRasterViewSetV2.importer_create action
                                      3. create_friction_raster_gn_layer celery task
                                      4. INPUT_DATA_GROUP_MAP entry mapping raster prefix to 'Friction Rasters'
                                    See decision-request 2026-05-13-q-1 for the operator-confirmed
                                    scope split. */}
                                <div className={'menu-rows-container anuga-section'}>
                                    <div className={"row menu-row menu-row-header anuga-section-header"}>
                                        <span
                                            className="menu-row-text anuga-section-header-clickable"
                                            onClick={() => this.toggleSection('frictionRasters')}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    this.toggleSection('frictionRasters');
                                                }
                                            }}
                                            aria-expanded={!this.state.frictionRastersCollapsed}
                                        ><Message msgId="hydrata.anuga.frictionRasters" /></span>
                                        <OverlayTrigger placement="right" overlay={<Tooltip><Message msgId="hydrata.anuga.uploadFrictionRasterTooltip" /></Tooltip>}>
                                            <span
                                                className={"btn pull-right glyphicon menu-row-glyph glyph-active glyphicon-upload"}
                                                style={{fontSize: "smaller", textAlign: "right", marginRight: "8px"}}
                                                onClick={() => {
                                                    this.props.setVisibleUploaderPanel(true, "friction_raster", null);
                                                    trackEvent('button', 'click', 'anuga-input-menu-show-friction-raster-uploader');
                                                }}
                                            />
                                        </OverlayTrigger>
                                        <span
                                            className={`btn glyphicon menu-row-glyph glyph-collapse ${this.state.frictionRastersCollapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}`}
                                            style={{ fontSize: "smaller", marginLeft: "auto", marginRight: "8px" }}
                                            onClick={() => this.toggleSection('frictionRasters')}
                                            aria-label={this.state.frictionRastersCollapsed ? "Expand section" : "Collapse section"}
                                        />
                                    </div>
                                    {!this.state.frictionRastersCollapsed && this.props.frictionRasterLayers?.map(frictionRaster => <MenuRow layer={frictionRaster}/>)}
                                    {!this.state.frictionRastersCollapsed && this.props.frictionRasterLayers?.length === 0 ?
                                        <div className={"row menu-row anuga-section-empty-row"}>
                                            <Message msgId="hydrata.anuga.noFrictionRastersAvailable" />
                                        </div> : null
                                    }
                                </div>
                                <InputSection
                                    titleMsgId="hydrata.anuga.structures"
                                    layers={this.props.structureLayers}
                                    pendingItems={this.props.pendingStructures}
                                    titleValue={this.state.structureTitle}
                                    onTitleChange={(v) => this.setState({structureTitle: v})}
                                    onCreate={() => this.createAndReset(this.props.createAnugaStructure, 'structureTitle')}
                                    isCreating={this.props.isCreatingAnugaLayer}
                                    canEdit={this.props.canEditAnugaMap}
                                    inputId="structure-input"
                                    trackEventName="anuga-input-menu-create-structure"
                                    collapsed={this.state.structuresCollapsed}
                                    onToggleCollapse={() => this.toggleSection('structures')}
                                />
                                {/* Networks section — header + sub-sections in one container */}
                                <div
                                    className={'menu-rows-container anuga-section'}
                                >
                                    <div
                                        className={"row menu-row menu-row-header anuga-section-header"}
                                    >
                                        <span
                                            className="menu-row-text anuga-section-header-clickable"
                                            onClick={() => this.toggleSection('networks')}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    this.toggleSection('networks');
                                                }
                                            }}
                                            aria-expanded={!this.state.networksCollapsed}
                                        ><Message msgId="hydrata.anuga.networks" /></span>
                                        <span
                                            className={'btn glyphicon menu-row-glyph glyph-settings glyphicon-cog'}
                                            style={{ fontSize: "smaller", textAlign: "right" }}
                                            onClick={() => {
                                                this.props.setNetworkMenu(true);
                                                this.props.setAnugaInputMenu(false);
                                                trackEvent('button', 'click', 'anuga-input-menu-show-network');
                                            }}
                                        />
                                        {this.props.canEditAnugaMap ?
                                            <React.Fragment>
                                                <span
                                                    className={`btn glyphicon menu-row-glyph glyph-active ${this.state.networkInputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                                                    style={{ fontSize: "smaller", textAlign: "right", marginRight: "8px" }}
                                                    onClick={this.handleNetworkPlusClick}
                                                    aria-label={this.state.networkInputVisible ? "Save" : "Add new"}
                                                />
                                                {this.props.isCreatingAnugaLayer ?
                                                    <span>
                                                        <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                                                    </span> :
                                                    this.state.networkInputVisible ?
                                                        <input
                                                            id="network-input"
                                                            key="network-input"
                                                            className={'data-title-input'}
                                                            style={{marginTop: "3px", marginRight: "5px"}}
                                                            type={'text'}
                                                            value={this.state.networkTitle}
                                                            onChange={(e) => this.setState({networkTitle: e.target.value})}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && this.state.networkTitle) {
                                                                    e.preventDefault();
                                                                    this.handleNetworkPlusClick();
                                                                } else if (e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    this.setState({networkTitle: '', networkInputVisible: false});
                                                                }
                                                            }}
                                                            autoFocus
                                                        /> : null
                                                }
                                            </React.Fragment> : null
                                        }
                                        <span
                                            className={`btn glyphicon menu-row-glyph glyph-collapse ${this.state.networksCollapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}`}
                                            style={{ fontSize: "smaller", marginLeft: "auto", marginRight: "8px" }}
                                            onClick={() => this.toggleSection('networks')}
                                            aria-label={this.state.networksCollapsed ? "Expand section" : "Collapse section"}
                                        />
                                    </div>
                                    {!this.state.networksCollapsed ?
                                        <React.Fragment>
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
                                        </React.Fragment> : null
                                    }
                                </div>
                            </div> : null
                        }
                    </React.Fragment> : null
                }
                <UploaderPanel fileType={'terrain'}/>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const projection = state?.anuga?.projects?.data?.projection;
    const boundaryLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Boundaries');
    const inflowLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Inflows');
    // TASK-955 (W2.2 FE) — Rainfall layer slice (polygon sibling to Inflow).
    const rainfallLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Rainfall');
    const pendingByModel = selectPendingByModel(state);
    // TASK-955 — gate the `defaults` starter phase on Boundaries AND
    // (Inflows OR Rainfall). Either polygon-or-line water input clears
    // the placeholder so the user isn't blocked on a single sub-type.
    // create_supporting_models stamps Boundary 01 + Inflow 01 + Rainfall 01
    // simultaneously, so in practice all three groups fill together; the
    // OR is defensive against a single sub-type failing or being deleted.
    const starterPhase = !projection ? 'terrain'
        : (boundaryLayers?.length === 0
            && inflowLayers?.length === 0
            && rainfallLayers?.length === 0
            ? 'defaults' : null);
    return {
        projectData: state?.anuga?.projects?.data,
        terrainLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Terrain'),
        boundaryLayers,
        inflowLayers,
        // TASK-955 — Rainfall layers exposed to the rendered InputSection.
        rainfallLayers,
        frictionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction'),
        // TASK-829 (W4.2b) — FrictionRaster layers (raster sibling to polygon Friction)
        frictionRasterLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction Rasters'),
        structureLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Structures'),
        fullMeshLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Full Mesh'),
        meshRegionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Mesh Regions'),
        networkLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Networks'),
        catchmentLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Catchments'),
        nodesLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Nodes'),
        linksLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Links'),
        terrainModels: state?.anuga?.resources?.terrain,
        boundaryModels: state?.anuga?.resources?.boundaries,
        inflowModels: state?.anuga?.resources?.inflows,
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        rainfallModels: state?.anuga?.resources?.rainfalls,
        frictionModels: state?.anuga?.resources?.frictions,
        structureModels: state?.anuga?.resources?.structures,
        fullMeshModels: state?.anuga?.resources?.fullMeshes,
        meshRegionModels: state?.anuga?.resources?.meshRegions,
        catchmentModels: state?.anuga?.resources?.catchments,
        nodesModels: state?.anuga?.resources?.nodes,
        linksModels: state?.anuga?.resources?.links,
        pendingBoundaries: pendingByModel.Boundary,
        pendingInflows: pendingByModel.Inflow,
        // TASK-955 (W2.2 FE) — Rainfall in-flight layer_create Processes.
        pendingRainfalls: pendingByModel.Rainfall,
        pendingFrictions: pendingByModel.Friction,
        pendingStructures: pendingByModel.Structure,
        pendingMeshRegions: pendingByModel.MeshRegion,
        starterPhase,
        isCreatingAnugaLayer: state?.anuga?.ui?.isCreatingAnugaLayer,
        canEditAnugaMap: canEditAnugaMap(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        addAnugaBoundary: () => dispatch(addAnugaBoundary()),
        addAnugaFriction: () => dispatch(addAnugaFriction()),
        addAnugaInflow: () => dispatch(addAnugaInflow()),
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        addAnugaRainfall: () => dispatch(addAnugaRainfall()),
        addAnugaStructure: () => dispatch(addAnugaStructure()),
        addAnugaFullMesh: () => dispatch(addAnugaFullMesh()),
        addAnugaMeshRegion: () => dispatch(addAnugaMeshRegion()),
        addCatchment: () => dispatch(addCatchment()),
        setNetworkMenu: (visible) => dispatch(setNetworkMenu(visible)),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        addNetwork: () => dispatch(addNetwork()),
        addNodes: () => dispatch(addNodes()),
        addLinks: () => dispatch(addLinks()),
        startAnugaModelCreationPolling: () => dispatch(startAnugaModelCreationPolling()),
        stopAnugaModelCreationPolling: () => dispatch(stopAnugaModelCreationPolling()),
        setVisibleUploaderPanel: (visible, importerConfigKey, layerId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, layerId)),
        setCreatingAnugaLayer: (isCreatingAnugaLayer) => dispatch(setCreatingAnugaLayer(isCreatingAnugaLayer)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow).
        createAnugaRainfall: (rainfallTitle) => dispatch(createAnugaRainfall(rainfallTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaMeshRegion: (meshRegionTitle) => dispatch(createAnugaMeshRegion(meshRegionTitle)),
        createNetwork: (networkTitle) => dispatch(createNetwork(networkTitle))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu};
