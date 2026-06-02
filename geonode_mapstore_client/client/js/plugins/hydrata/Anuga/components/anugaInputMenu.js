import React from "react";
import {connect} from "react-redux";
import {createSelector} from 'reselect';
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
    addAnugaRainfall,
    addAnugaStructure,
    addAnugaMeshRegion,
    addNetwork,
    addCatchment,
    addNodes,
    addLinks,
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaRainfall,
    createAnugaStructure,
    createAnugaMeshRegion,
    createNetwork,
    setCreatingAnugaLayer,
    startAnugaModelCreationPolling,
    stopAnugaModelCreationPolling,
    setNetworkMenu,
    setAnugaInputMenu,
    setVisibleTerrainBboxPanel
} from "../actionsAnuga";

import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";
import {TerrainBboxPanel} from "./terrainBboxPanel";
import AnugaInputStarterCard from "./anugaInputStarterCard";

import {canEditAnugaMap, getProjectId, getSelectedScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
// W5.1 (TASK-1273): MeshWorkflow consolidates preview + cost estimate + import/export slots.
import {MeshWorkflow} from "./MeshWorkflow";
import {addLayer} from "../../../../../MapStore2/web/client/actions/layers";
// W6 (TASK-1422): zoom to mesh extent after successful preview.
import {zoomToExtent} from "../../../../../MapStore2/web/client/actions/map";
// W6 (TASK-1423): read user token for authenticated mesh tile requests.
import {getToken} from "../../../../../MapStore2/web/client/utils/SecurityUtils";
import {buildGwcMvtTileUrls, GWC_WMTS_ENDPOINT} from "../gwcTileRouting";

const ACTIVE_TM_STATES = new Set(['pending', 'running']);
const PENDING_MODEL_CLASSES = ['Boundary', 'Inflow', 'Rainfall', 'Friction', 'Structure', 'MeshRegion'];
const EMPTY_BY_ID = {};
const EMPTY_IDS = [];

const stripModelPrefix = (name) => {
    if (!name || typeof name !== 'string') return name;
    const idx = name.indexOf(': ');
    return idx >= 0 ? name.slice(idx + 2) : name;
};

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

// Rail-item config. `compositeLayersKeys` aggregates several layer slices
// into one rail item (Networks bundles Catchments/Nodes/Links for tri-state +
// zoom + count). Order matches the C v2 mockup, with no Advanced divider.
const CATEGORIES = [
    {id: 'terrain', titleMsgId: 'hydrata.anuga.terrain', layersKey: 'terrainLayers'},
    {id: 'boundaries', titleMsgId: 'hydrata.anuga.boundaries', layersKey: 'boundaryLayers'},
    {id: 'inflows', titleMsgId: 'hydrata.anuga.inflows', layersKey: 'inflowLayers'},
    {id: 'rainfalls', titleMsgId: 'hydrata.anuga.rainfalls', layersKey: 'rainfallLayers'},
    // W3.1 (TASK-1266): 'Full Mesh' rail entry removed; 'Mesh Regions' renamed
    // to 'Mesh' (now the single Mesh pane with mesh regions list + preview).
    {id: 'meshRegions', titleMsgId: 'hydrata.anuga.mesh', layersKey: 'meshRegionLayers'},
    {id: 'friction', titleMsgId: 'hydrata.anuga.friction', layersKey: 'frictionLayers'},
    {id: 'frictionRasters', titleMsgId: 'hydrata.anuga.frictionRasters', layersKey: 'frictionRasterLayers'},
    {id: 'structures', titleMsgId: 'hydrata.anuga.structures', layersKey: 'structureLayers'},
    {id: 'networks', titleMsgId: 'hydrata.anuga.networks', compositeLayersKeys: ['catchmentLayers', 'nodesLayers', 'linksLayers']}
];

const CATEGORY_BY_ID = CATEGORIES.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

// Static category glyphs for the rail. Replaces the previous tri-state
// visibility chip — per-layer visibility lives on each MenuRow.
const svgIcon = (children) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
    </svg>
);
const CATEGORY_ICONS = {
    terrain: svgIcon(<g><path d="M3 20l5-9 4 6 3-4 6 7z"/><circle cx="17" cy="5" r="1.5"/></g>),
    boundaries: svgIcon(<polygon points="4 6 20 4 21 18 6 20" strokeDasharray="3 2"/>),
    inflows: svgIcon(<g><path d="M3 12h13"/><polyline points="13 7 18 12 13 17"/></g>),
    rainfalls: svgIcon(<g><path d="M6 10a5 5 0 1110 0"/><line x1="8" y1="15" x2="7" y2="20"/><line x1="12" y1="15" x2="11" y2="20"/><line x1="16" y1="15" x2="15" y2="20"/></g>),
    // W3.1: fullMesh icon removed from rail; meshRegions uses mesh icon (same as old fullMesh)
    meshRegions: svgIcon(<g><polygon points="12 3 21 8 21 16 12 21 3 16 3 8"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="8" x2="21" y2="16"/><line x1="21" y1="8" x2="3" y2="16"/></g>),
    friction: svgIcon(<g><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="16" x2="20" y2="16"/></g>),
    frictionRasters: svgIcon(<g><path d="M3 20l4-9 4 5 3-3 7 7z"/><rect x="3" y="3" width="5" height="3"/></g>),
    structures: svgIcon(<g><rect x="4" y="9" width="16" height="11"/><polyline points="4 9 12 4 20 9"/></g>),
    networks: svgIcon(<g><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="6" x2="12" y2="18"/><line x1="18" y1="6" x2="12" y2="18"/></g>)
};

// Per-input config table for renderCreatePane(). Keyed by category id.
const CREATE_PANE_CONFIG = {
    boundaries: {
        titleKey: 'boundaryTitle', createProp: 'createAnugaBoundary',
        layersKey: 'boundaryLayers', pendingKey: 'pendingBoundaries',
        inputId: 'boundary-input', trackEventName: 'anuga-input-menu-create-new-boundary'
    },
    inflows: {
        titleKey: 'inflowTitle', createProp: 'createAnugaInflow',
        layersKey: 'inflowLayers', pendingKey: 'pendingInflows',
        inputId: 'inflow-input', trackEventName: 'anuga-input-menu-create-new-inflow'
    },
    rainfalls: {
        titleKey: 'rainfallTitle', createProp: 'createAnugaRainfall',
        layersKey: 'rainfallLayers', pendingKey: 'pendingRainfalls',
        inputId: 'rainfall-input', trackEventName: 'anuga-input-menu-create-new-rainfall'
    },
    meshRegions: {
        titleKey: 'meshRegionTitle', createProp: 'createAnugaMeshRegion',
        layersKey: 'meshRegionLayers', pendingKey: 'pendingMeshRegions',
        inputId: 'mesh-region-input', trackEventName: 'anuga-input-menu-create-mesh-region'
    },
    friction: {
        titleKey: 'frictionTitle', createProp: 'createAnugaFriction',
        layersKey: 'frictionLayers', pendingKey: 'pendingFrictions',
        inputId: 'friction-input', trackEventName: 'anuga-input-menu-create-friction'
    },
    structures: {
        titleKey: 'structureTitle', createProp: 'createAnugaStructure',
        layersKey: 'structureLayers', pendingKey: 'pendingStructures',
        inputId: 'structure-input', trackEventName: 'anuga-input-menu-create-structure'
    }
};

class AnugaInputMenuClass extends React.Component {
    static propTypes = {
        projectData: PropTypes.object,
        setVisibleUploaderPanel: PropTypes.func,
        setVisibleTerrainBboxPanel: PropTypes.func,
        anugaGroupLength: PropTypes.number,
        terrainLayers: PropTypes.array,
        boundaryLayers: PropTypes.array,
        createAnugaBoundary: PropTypes.func,
        createAnugaFriction: PropTypes.func,
        createAnugaInflow: PropTypes.func,
        createAnugaRainfall: PropTypes.func,
        createAnugaStructure: PropTypes.func,
        createAnugaMeshRegion: PropTypes.func,
        createNetwork: PropTypes.func,
        createCatchment: PropTypes.func,
        createNodes: PropTypes.func,
        createLinks: PropTypes.func,
        frictionLayers: PropTypes.array,
        frictionRasterLayers: PropTypes.array,
        inflowLayers: PropTypes.array,
        rainfallLayers: PropTypes.array,
        structureLayers: PropTypes.array,
        meshRegionLayers: PropTypes.array,
        catchmentLayers: PropTypes.array,
        nodesLayers: PropTypes.array,
        linksLayers: PropTypes.array,
        startAnugaModelCreationPolling: PropTypes.func,
        stopAnugaModelCreationPolling: PropTypes.func,
        isCreatingAnugaLayer: PropTypes.bool,
        setCreatingAnugaLayer: PropTypes.func,
        canEditAnugaMap: PropTypes.bool,
        pendingBoundaries: PropTypes.array,
        pendingInflows: PropTypes.array,
        pendingRainfalls: PropTypes.array,
        pendingFrictions: PropTypes.array,
        pendingStructures: PropTypes.array,
        pendingMeshRegions: PropTypes.array,
        starterPhase: PropTypes.oneOf(['terrain', 'defaults']),
        addAnugaBoundary: PropTypes.func,
        addAnugaFriction: PropTypes.func,
        addAnugaInflow: PropTypes.func,
        addAnugaRainfall: PropTypes.func,
        addAnugaStructure: PropTypes.func,
        addAnugaMeshRegion: PropTypes.func,
        addCatchment: PropTypes.func,
        addNodes: PropTypes.func,
        addLinks: PropTypes.func,
        terrainModels: PropTypes.array,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        rainfallModels: PropTypes.array,
        structureModels: PropTypes.array,
        meshRegionModels: PropTypes.array,
        catchmentModels: PropTypes.array,
        nodesModels: PropTypes.array,
        linksModels: PropTypes.array,
        setAnugaInputMenu: PropTypes.func,
        setNetworkMenu: PropTypes.func,
        // W3.1 (TASK-1266)
        projectId: PropTypes.number,
        selectedScenarioId: PropTypes.number,
        // W5.1 (TASK-1273)
        selectedScenario: PropTypes.object,
        // W5.3 (TASK-1275)
        flatLayers: PropTypes.array,
        onAddMeshLayer: PropTypes.func,
        // W6 (TASK-1422)
        onZoomToExtent: PropTypes.func
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            // Rail selection — local only, defaults to terrain. Sibling
            // `state.simpleView.selectedCategory` exists for hydration safety
            // in the generic SimpleView path but is not read here.
            selectedCategory: 'terrain',
            // Per-category create-input visibility. Only one slot is true at
            // a time, but keying by category id means navigating away (with
            // a half-typed title) doesn't reset the visibility for that
            // category when you return.
            inputVisible: {},
            boundaryTitle: '',
            frictionTitle: '',
            inflowTitle: '',
            rainfallTitle: '',
            structureTitle: '',
            meshRegionTitle: '',
            networkTitle: '',
            catchmentTitle: '',
            nodesTitle: '',
            linksTitle: '',
            // W3.1 (TASK-1266) — Mesh preview local state
            meshPreviewStatus: null,   // null | 'pending' | 'polling' | 'done' | 'error'
            meshPreviewProcessId: null,
            meshPreviewResult: null,   // {triangle_count, above_render_threshold, mesh_qa, geometry}
            meshPreviewError: null,
            // W6 (TASK-1421) — progress bar during polling: {pct, detail}
            meshPreviewProgress: null,
            // W5.1 (TASK-1273) — MeshWorkflow panel open/closed
            meshWorkflowOpen: false,
            // W6 (TASK-1424) — built mesh roster: array of MeshRun API objects, null = not loaded
            builtMeshes: null
        };
        this._meshPreviewPollTimer = null;
        this._meshPreviewPollCount = 0;
    }

    _toggleMeshWorkflow = () => {
        this.setState(prev => ({meshWorkflowOpen: !prev.meshWorkflowOpen}));
    };

    componentDidUpdate(prevProps) {
        // After a create finishes (isCreatingAnugaLayer falls back to false),
        // close the input that initiated it. `lastSubmittedCategory` is set
        // in handleCreateClick at submit time; cleared here. This is the
        // generalisation of the old per-section `didSubmit` ref.
        if (
            prevProps.isCreatingAnugaLayer &&
            !this.props.isCreatingAnugaLayer &&
            this.lastSubmittedCategory
        ) {
            const cat = this.lastSubmittedCategory;
            // eslint-disable-next-line react/no-did-update-set-state -- gated transition: only fires when `isCreatingAnugaLayer` flips false AFTER a local submit; bounded by lastSubmittedCategory guard
            this.setState((prev) => ({inputVisible: {...prev.inputVisible, [cat]: false}}));
            this.lastSubmittedCategory = null;
        }

        // W6 (TASK-1424): re-fetch built meshes when the selected scenario changes.
        if (prevProps.selectedScenarioId !== this.props.selectedScenarioId) {
            this._fetchBuiltMeshes();
        }
    }

    // W6 (TASK-1424): fetch MeshRun records for the current scenario from the BE.
    // Calls GET /api/v2/anuga/projects/{pid}/scenarios/{sid}/built-meshes/
    // Falls back to empty array on any error so the roster renders 'No built meshes yet'.
    _fetchBuiltMeshes = () => {
        const projectId = this.props.projectId;
        const scenarioId = this.props.selectedScenarioId;
        if (!projectId || !scenarioId) {
            this.setState({builtMeshes: []});
            return;
        }
        fetch(`/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/built-meshes/`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                this.setState({builtMeshes: Array.isArray(data) ? data : (data.results || [])});
            })
            .catch(() => {
                this.setState({builtMeshes: []});
            });
    };

    componentWillUnmount() {
        if (this._meshPreviewPollTimer) {
            clearTimeout(this._meshPreviewPollTimer);
            this._meshPreviewPollTimer = null;
        }
    }

    // W3.1 (TASK-1266) — Mesh preview helpers
    // MAX_PREVIEW_POLLS = 60 ticks × 3s = 3 minutes cap (orphan-proof).
    _startMeshPreview = () => {
        const projectId = this.props.projectId;
        const scenarioId = this.props.selectedScenarioId;
        if (!projectId || !scenarioId) return;

        if (this._meshPreviewPollTimer) {
            clearTimeout(this._meshPreviewPollTimer);
            this._meshPreviewPollTimer = null;
        }
        this._meshPreviewPollCount = 0;

        this.setState({
            meshPreviewStatus: 'pending',
            meshPreviewProcessId: null,
            meshPreviewResult: null,
            meshPreviewError: null,
            meshPreviewProgress: null
        });

        fetch(
            `/api/v2/anuga/projects/${projectId}/scenarios/${scenarioId}/preview-mesh/`,
            {method: 'POST', headers: {'X-CSRFToken': this._getCsrfToken(), 'Content-Type': 'application/json'}}
        )
            .then(r => r.json())
            .then(data => {
                if (data.process_id) {
                    this.setState({meshPreviewStatus: 'polling', meshPreviewProcessId: data.process_id});
                    this._pollMeshPreview(data.process_id, projectId);
                } else {
                    this.setState({meshPreviewStatus: 'error', meshPreviewError: 'No process_id in response'});
                }
            })
            .catch(err => {
                this.setState({meshPreviewStatus: 'error', meshPreviewError: String(err)});
            });
    };

    _pollMeshPreview = (processId, projectId) => {
        const MAX_POLLS = 60;
        if (this._meshPreviewPollCount >= MAX_POLLS) {
            this.setState({meshPreviewStatus: 'error', meshPreviewError: 'Preview timed out'});
            return;
        }
        this._meshPreviewPollCount += 1;
        this._meshPreviewPollTimer = setTimeout(() => {
            fetch(`/api/v2/tasks/processes/${processId}/`)
                .then(r => r.json())
                .then(proc => {
                    if (proc.status === 'complete') {
                        const result = proc.metadata || {};
                        this.setState(
                            {meshPreviewStatus: 'done', meshPreviewResult: result, meshPreviewProgress: null},
                            () => {
                                // W6 (TASK-1422): auto-add mesh layer + zoom to bbox on successful preview
                                // when the mesh is below the render threshold.
                                if (!result.above_render_threshold) {
                                    this._autoAddMeshLayerAndZoom(result);
                                }
                            }
                        );
                    } else if (proc.status === 'error') {
                        this.setState({
                            meshPreviewStatus: 'error',
                            meshPreviewError: proc.error_message || 'Preview failed',
                            meshPreviewProgress: null
                        });
                    } else {
                        // W6 (TASK-1421): capture progress_pct + status_detail while polling.
                        const pct = proc.progress_pct != null ? proc.progress_pct : null;
                        const detail = proc.status_detail || null;
                        this.setState({
                            meshPreviewProgress: (pct != null || detail) ? {pct, detail} : null
                        });
                        // still running — keep polling
                        this._pollMeshPreview(processId, projectId);
                    }
                })
                .catch(err => {
                    this.setState({meshPreviewStatus: 'error', meshPreviewError: String(err), meshPreviewProgress: null});
                });
        }, 3000);
    };

    // W6 (TASK-1422): dispatch addLayer (authed) + zoomToExtent from preview GeoJSON geometry.
    // Called in the _pollMeshPreview setState callback when preview completes below threshold.
    _autoAddMeshLayerAndZoom = (result) => {
        const MESH_RENDER_LAYER = 'geonode:mesh_triangle_render';
        const isMeshLayerAdded = (this.props.flatLayers || []).some(l => l?.name === MESH_RENDER_LAYER);
        if (!isMeshLayerAdded) {
            // Build the authenticated mesh layer — mirrors MeshTriangleLayerSection (W6 TASK-1423).
            const token = getToken();
            const params = {
                LAYERS: MESH_RENDER_LAYER,
                FORMAT: 'image/png',
                TRANSPARENT: true,
                VERSION: '1.1.1',
                TILED: true,
                ...(token ? {access_token: token} : {})
            };
            const baseTileUrls = buildGwcMvtTileUrls(MESH_RENDER_LAYER);
            const tileUrls = token
                ? baseTileUrls.map(u => u + '&access_token=' + encodeURIComponent(token))
                : baseTileUrls;
            const meshLayer = {
                type: 'wms',
                url: GWC_WMTS_ENDPOINT,
                name: MESH_RENDER_LAYER,
                title: 'Mesh triangles',
                visibility: true,
                group: 'Input Data.Mesh',
                params,
                tileUrls
            };
            this.props.onAddMeshLayer && this.props.onAddMeshLayer(meshLayer);
        }

        // W6 (TASK-1422): zoom to mesh bbox from preview GeoJSON FeatureCollection.
        // geometry is WGS84 (EPSG:4326) — preview_mesh_async reprojects to WGS84.
        const geometry = result.geometry;
        if (!geometry || !geometry.features || geometry.features.length === 0) return;

        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        geometry.features.forEach(f => {
            if (f.geometry && f.geometry.coordinates) {
                f.geometry.coordinates.forEach(ring => {
                    ring.forEach(([lng, lat]) => {
                        if (lng < minLng) minLng = lng;
                        if (lat < minLat) minLat = lat;
                        if (lng > maxLng) maxLng = lng;
                        if (lat > maxLat) maxLat = lat;
                    });
                });
            }
        });
        if (isFinite(minLng)) {
            this.props.onZoomToExtent && this.props.onZoomToExtent(
                [minLng, minLat, maxLng, maxLat],
                'EPSG:4326',
                18
            );
        }
    };

    _getCsrfToken = () => {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : '';
    };

    selectCategory = (catId) => {
        this.setState({selectedCategory: catId});
        trackEvent('button', 'click', `anuga-rail-select-${catId}`);
    };

    getCategoryLayers(cat) {
        if (cat.compositeLayersKeys) {
            return cat.compositeLayersKeys.flatMap(k => this.props[k] || []);
        }
        return this.props[cat.layersKey] || [];
    }

    handleCreateClick = (catId, titleKey, createFn, trackEventName) => {
        const inputVisible = !!this.state.inputVisible[catId];
        if (!inputVisible) {
            this.setState((prev) => ({inputVisible: {...prev.inputVisible, [catId]: true}}));
        } else if (this.state[titleKey]) {
            this.props.setCreatingAnugaLayer(true);
            createFn(this.state[titleKey]);
            this.setState({[titleKey]: ''});
            this.lastSubmittedCategory = catId;
            trackEvent('button', 'click', trackEventName);
        } else {
            this.setState((prev) => ({inputVisible: {...prev.inputVisible, [catId]: false}}));
        }
    };

    handleEscapeInput = (catId, titleKey) => {
        this.setState((prev) => ({
            [titleKey]: '',
            inputVisible: {...prev.inputVisible, [catId]: false}
        }));
    };

    renderRailItem(cat) {
        const isActive = this.state.selectedCategory === cat.id;
        return (
            <div
                key={cat.id}
                className={"sv-category-rail-item" + (isActive ? " is-active" : "")}
                data-anuga-category={cat.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => this.selectCategory(cat.id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.selectCategory(cat.id);
                    }
                }}
            >
                <span className="sv-category-rail-item-icon" aria-hidden="true">
                    {CATEGORY_ICONS[cat.id]}
                </span>
                <h5 className="sv-category-rail-item-label">
                    <Message msgId={cat.titleMsgId} />
                </h5>
            </div>
        );
    }

    renderRail() {
        return (
            <div className="sv-category-rail" role="tablist">
                {CATEGORIES.map(cat => this.renderRailItem(cat))}
            </div>
        );
    }

    renderPaneEmpty(emptyMsgId, isInitializing) {
        return (
            <div
                className="row menu-row anuga-section-empty-row"
                aria-busy={isInitializing ? "true" : undefined}
                aria-live={isInitializing ? "polite" : undefined}
            >
                {isInitializing ? (
                    <React.Fragment>
                        <Spinner color="#888" className="anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                        <span className={"anuga-pending-status"}>
                            <Message msgId="hydrata.anuga.pendingLayerLabel" />
                        </span>
                    </React.Fragment>
                ) : (
                    <Message msgId={emptyMsgId} />
                )}
            </div>
        );
    }

    // Richer terrain-pane empty state: makes it obvious there are TWO ways to
    // get terrain (upload a GeoTIFF, or download free global GLO-30 for any
    // area on Earth), pointing at the two header icons. Other panes keep the
    // bare renderPaneEmpty single-line state.
    renderTerrainEmpty() {
        return (
            <div className="row menu-row anuga-section-empty-row anuga-terrain-empty-help">
                <Message msgId="hydrata.anuga.noTerrainHelp" />
            </div>
        );
    }

    renderPendingRow(item, idx) {
        return (
            <div
                key={`pending-${item?.id || idx}`}
                className={"row menu-row anuga-pending-row"}
                aria-busy="true"
                aria-live="polite"
            >
                <Spinner color="#888" className="anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                <span className={"anuga-pending-title"}>{item?.title}</span>
                <span className={"anuga-pending-status"}>
                    <Message msgId="hydrata.anuga.pendingLayerLabel" />
                </span>
            </div>
        );
    }

    renderCreateControls(catId, titleKey, createProp, inputId, trackEventName) {
        const inputVisible = !!this.state.inputVisible[catId];
        const createFn = this.props[createProp];
        return (
            <React.Fragment>
                <span
                    className={`btn glyphicon menu-row-glyph glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                    onClick={() => this.handleCreateClick(catId, titleKey, createFn, trackEventName)}
                    aria-label={inputVisible ? "Save" : "Add new"}
                />
                {this.props.isCreatingAnugaLayer ? (
                    <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                ) : inputVisible ? (
                    <input
                        id={inputId}
                        key={inputId}
                        className={'data-title-input'}
                        type={'text'}
                        value={this.state[titleKey]}
                        onChange={(e) => this.setState({[titleKey]: e.target.value})}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && this.state[titleKey]) {
                                e.preventDefault();
                                this.handleCreateClick(catId, titleKey, createFn, trackEventName);
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                this.handleEscapeInput(catId, titleKey);
                            }
                        }}
                        autoFocus
                    />
                ) : null}
            </React.Fragment>
        );
    }

    renderPaneHead(catId, actions) {
        const cat = CATEGORY_BY_ID[catId];
        return (
            <div className="anuga-pane-toolbar">
                <h3 className="anuga-pane-head-title">
                    <Message msgId={cat.titleMsgId} />
                </h3>
                {actions ? (
                    <span className="anuga-pane-head-actions">{actions}</span>
                ) : null}
            </div>
        );
    }

    renderTerrainPane() {
        const layers = this.props.terrainLayers || [];
        const actions = (
            <React.Fragment>
                <OverlayTrigger placement="bottom" overlay={<Tooltip><Message msgId="hydrata.anuga.globalDemTooltip" /></Tooltip>}>
                    <span
                        className={"btn glyphicon menu-row-glyph glyph-active glyphicon-globe"}
                        data-testid="anuga-terrain-global-dem-button"
                        onClick={() => {
                            this.props.setVisibleTerrainBboxPanel(true);
                            trackEvent('button', 'click', 'anuga-input-menu-show-terrain-bbox-picker');
                        }}
                    />
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={<Tooltip><Message msgId="hydrata.anuga.uploadTerrainTooltip" /></Tooltip>}>
                    <span
                        className={"btn glyphicon menu-row-glyph glyph-active glyphicon-upload"}
                        onClick={() => {
                            this.props.setVisibleUploaderPanel(true, "terrain", null);
                            trackEvent('button', 'click', 'anuga-input-menu-show-terrain-uploader');
                        }}
                    />
                </OverlayTrigger>
            </React.Fragment>
        );
        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('terrain', actions)}
                <div className="anuga-pane-rows">
                    {layers.map(t => <MenuRow key={t?.name || t?.id} layer={t}/>)}
                    {layers.length === 0 ? this.renderTerrainEmpty() : null}
                </div>
            </div>
        );
    }

    renderCreatePane(catId) {
        const conf = CREATE_PANE_CONFIG[catId];
        const layers = this.props[conf.layersKey] || [];
        const pending = this.props[conf.pendingKey] || [];
        const isInitializing = this.props.starterPhase === 'defaults';
        const canEdit = this.props.canEditAnugaMap;
        const actions = canEdit
            ? this.renderCreateControls(catId, conf.titleKey, conf.createProp, conf.inputId, conf.trackEventName)
            : null;
        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead(catId, actions)}
                <div className="anuga-pane-rows">
                    {layers.map(l => <MenuRow key={l?.name || l?.id} layer={l}/>)}
                    {pending.map((item, idx) => this.renderPendingRow(item, idx))}
                    {(layers.length === 0 && pending.length === 0)
                        ? this.renderPaneEmpty('hydrata.anuga.none', isInitializing)
                        : null}
                </div>
            </div>
        );
    }

    // W3.1 (TASK-1266): renderFullMeshPane removed; replaced by renderMeshPane below.
    // W5.1 (TASK-1273): renderMeshPane now delegates preview + cost estimate + import/export
    //   slots to MeshWorkflow, keeping the mesh region list in place.
    renderMeshPane() {
        // Mesh Regions list (create controls)
        const conf = CREATE_PANE_CONFIG.meshRegions;
        const layers = this.props[conf.layersKey] || [];
        const pending = this.props[conf.pendingKey] || [];
        const isInitializing = this.props.starterPhase === 'defaults';
        const canEdit = this.props.canEditAnugaMap;
        const createActions = canEdit
            ? this.renderCreateControls('meshRegions', conf.titleKey, conf.createProp, conf.inputId, conf.trackEventName)
            : null;

        // W5.1: MeshWorkflow state
        const {meshPreviewStatus, meshPreviewResult, meshPreviewError, meshWorkflowOpen, meshPreviewProgress} = this.state;
        const hasScenario = !!this.props.selectedScenarioId;
        const scenario = this.props.selectedScenario || null;
        // W5.3: check if the mesh triangle render layer is already in the flat layer list
        const MESH_RENDER_LAYER = 'geonode:mesh_triangle_render';
        const isMeshLayerAdded = (this.props.flatLayers || []).some(l => l?.name === MESH_RENDER_LAYER);
        // W6 (TASK-1424): built meshes for the selected scenario (component local state)
        const builtMeshes = this.state.builtMeshes;

        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('meshRegions', createActions)}
                <div className="anuga-pane-rows">
                    {layers.map(l => <MenuRow key={l?.name || l?.id} layer={l}/>)}
                    {pending.map((item, idx) => this.renderPendingRow(item, idx))}
                    {(layers.length === 0 && pending.length === 0)
                        ? this.renderPaneEmpty('hydrata.anuga.none', isInitializing)
                        : null}
                </div>
                {/* W5.1 (TASK-1273) / W5.3 (TASK-1275) / W6 (TASK-1421,1422,1423,1424) — MeshWorkflow panel */}
                <MeshWorkflow
                    isOpen={meshWorkflowOpen}
                    onToggle={this._toggleMeshWorkflow}
                    previewState={{
                        status: meshPreviewStatus,
                        result: meshPreviewResult,
                        error: meshPreviewError,
                        progress: meshPreviewProgress
                    }}
                    onStartPreview={this._startMeshPreview}
                    hasScenario={hasScenario}
                    scenario={scenario}
                    onAddMeshLayer={this.props.onAddMeshLayer}
                    isMeshLayerAdded={isMeshLayerAdded}
                    builtMeshes={builtMeshes}
                />
            </div>
        );
    }

    renderFrictionRastersPane() {
        const layers = this.props.frictionRasterLayers || [];
        const actions = (
            <OverlayTrigger placement="bottom" overlay={<Tooltip><Message msgId="hydrata.anuga.uploadFrictionRasterTooltip" /></Tooltip>}>
                <span
                    className={"btn glyphicon menu-row-glyph glyph-active glyphicon-upload"}
                    onClick={() => {
                        this.props.setVisibleUploaderPanel(true, "friction_raster", null);
                        trackEvent('button', 'click', 'anuga-input-menu-show-friction-raster-uploader');
                    }}
                />
            </OverlayTrigger>
        );
        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('frictionRasters', actions)}
                <div className="anuga-pane-rows">
                    {layers.map(fr => <MenuRow key={fr?.name || fr?.id} layer={fr}/>)}
                    {layers.length === 0 ? this.renderPaneEmpty('hydrata.anuga.noFrictionRastersAvailable', false) : null}
                </div>
            </div>
        );
    }

    renderNetworksPane() {
        const inputVisible = !!this.state.inputVisible.networks;
        const canEdit = this.props.canEditAnugaMap;
        const actions = (
            <React.Fragment>
                <span
                    className={'btn glyphicon menu-row-glyph glyph-settings glyphicon-cog'}
                    title="Network settings"
                    onClick={() => {
                        this.props.setNetworkMenu(true);
                        this.props.setAnugaInputMenu(false);
                        trackEvent('button', 'click', 'anuga-input-menu-show-network');
                    }}
                />
                {canEdit ? (
                    <React.Fragment>
                        <span
                            className={`btn glyphicon menu-row-glyph glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                            onClick={() => this.handleCreateClick('networks', 'networkTitle', this.props.createNetwork, 'anuga-input-menu-create-network')}
                            aria-label={inputVisible ? "Save" : "Add new"}
                        />
                        {this.props.isCreatingAnugaLayer ? (
                            <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                        ) : inputVisible ? (
                            <input
                                id="network-input"
                                key="network-input"
                                className={'data-title-input'}
                                type={'text'}
                                value={this.state.networkTitle}
                                onChange={(e) => this.setState({networkTitle: e.target.value})}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && this.state.networkTitle) {
                                        e.preventDefault();
                                        this.handleCreateClick('networks', 'networkTitle', this.props.createNetwork, 'anuga-input-menu-create-network');
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        this.handleEscapeInput('networks', 'networkTitle');
                                    }
                                }}
                                autoFocus
                            />
                        ) : null}
                    </React.Fragment>
                ) : null}
            </React.Fragment>
        );
        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('networks', actions)}
                <div className="anuga-pane-rows">
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.catchments" /></p>
                        {(this.props.catchmentLayers || []).map(c => <MenuRow key={c?.name || c?.id} layer={c}/>)}
                    </div>
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.nodes" /></p>
                        {(this.props.nodesLayers || []).map(n => <MenuRow key={n?.name || n?.id} layer={n}/>)}
                    </div>
                    <div className={'menu-row-mini-container'}>
                        <p className={'menu-row-mini-heading'}><Message msgId="hydrata.anuga.links" /></p>
                        {(this.props.linksLayers || []).map(l => <MenuRow key={l?.name || l?.id} layer={l}/>)}
                    </div>
                </div>
            </div>
        );
    }

    renderPane() {
        switch (this.state.selectedCategory) {
        case 'terrain':         return this.renderTerrainPane();
        case 'boundaries':      return this.renderCreatePane('boundaries');
        case 'inflows':         return this.renderCreatePane('inflows');
        case 'rainfalls':       return this.renderCreatePane('rainfalls');
        // W3.1: 'fullMesh' case removed; 'meshRegions' now renders the unified Mesh pane.
        case 'meshRegions':     return this.renderMeshPane();
        case 'friction':        return this.renderCreatePane('friction');
        case 'frictionRasters': return this.renderFrictionRastersPane();
        case 'structures':      return this.renderCreatePane('structures');
        case 'networks':        return this.renderNetworksPane();
        default:                return this.renderTerrainPane();
        }
    }

    render() {
        // Pre-projection (`starterPhase==='terrain'`) the only meaningful
        // action is upload-a-terrain, so we collapse to a single terrain pane
        // and skip the rail entirely. Once projection is set, the full
        // rail+pane Miller layout takes over.
        const hasProjection = !!this.props.projectData?.projection;
        return (
            <div id={'anuga-input-menu'} className={'simple-view-panel anuga-panel simple-view-panel--miller'}>
                {this.props.starterPhase &&
                    <AnugaInputStarterCard
                        phase={this.props.starterPhase}
                        onUploadTerrain={() => this.props.setVisibleUploaderPanel(true, "terrain", null)}
                    />
                }
                <div className={'menu-rows-container'}>
                    {hasProjection ? (
                        <div className={'sv-rail-pane-shell'}>
                            {this.renderRail()}
                            {this.renderPane()}
                        </div>
                    ) : (
                        this.renderTerrainPane()
                    )}
                </div>
                <UploaderPanel fileType={'terrain'}/>
                <TerrainBboxPanel/>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const projection = state?.anuga?.projects?.data?.projection;
    const boundaryLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Boundaries');
    const inflowLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Inflows');
    const rainfallLayers = state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Rainfalls');
    const pendingByModel = selectPendingByModel(state);
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
        rainfallLayers,
        frictionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction'),
        frictionRasterLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Friction Rasters'),
        structureLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Structures'),
        meshRegionLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Mesh Regions'),
        networkLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Networks'),
        catchmentLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Catchments'),
        nodesLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Nodes'),
        linksLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Links'),
        terrainModels: state?.anuga?.resources?.terrain,
        boundaryModels: state?.anuga?.resources?.boundaries,
        inflowModels: state?.anuga?.resources?.inflows,
        rainfallModels: state?.anuga?.resources?.rainfalls,
        frictionModels: state?.anuga?.resources?.frictions,
        structureModels: state?.anuga?.resources?.structures,
        meshRegionModels: state?.anuga?.resources?.meshRegions,
        catchmentModels: state?.anuga?.resources?.catchments,
        nodesModels: state?.anuga?.resources?.nodes,
        linksModels: state?.anuga?.resources?.links,
        pendingBoundaries: pendingByModel.Boundary,
        pendingInflows: pendingByModel.Inflow,
        pendingRainfalls: pendingByModel.Rainfall,
        pendingFrictions: pendingByModel.Friction,
        pendingStructures: pendingByModel.Structure,
        pendingMeshRegions: pendingByModel.MeshRegion,
        starterPhase,
        isCreatingAnugaLayer: state?.anuga?.ui?.isCreatingAnugaLayer,
        canEditAnugaMap: canEditAnugaMap(state),
        // W3.1 (TASK-1266) — For preview mesh: project id + selected scenario id
        projectId: getProjectId(state),
        selectedScenarioId: state?.anuga?.scenarios?.selectedId || null,
        // W5.1 (TASK-1273) — Full scenario object for cost estimate in MeshWorkflow
        selectedScenario: getSelectedScenario(state),
        // W5.3 (TASK-1275) — Layer list to detect if mesh_triangle_render is already added
        flatLayers: state?.layers?.flat || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        addAnugaBoundary: () => dispatch(addAnugaBoundary()),
        addAnugaFriction: () => dispatch(addAnugaFriction()),
        addAnugaInflow: () => dispatch(addAnugaInflow()),
        addAnugaRainfall: () => dispatch(addAnugaRainfall()),
        addAnugaStructure: () => dispatch(addAnugaStructure()),
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
        setVisibleTerrainBboxPanel: (visible) => dispatch(setVisibleTerrainBboxPanel(visible)),
        setCreatingAnugaLayer: (isCreatingAnugaLayer) => dispatch(setCreatingAnugaLayer(isCreatingAnugaLayer)),
        createAnugaBoundary: (boundaryTitle) => dispatch(createAnugaBoundary(boundaryTitle)),
        createAnugaInflow: (inflowTitle) => dispatch(createAnugaInflow(inflowTitle)),
        createAnugaRainfall: (rainfallTitle) => dispatch(createAnugaRainfall(rainfallTitle)),
        createAnugaStructure: (structureTitle) => dispatch(createAnugaStructure(structureTitle)),
        createAnugaFriction: (frictionTitle) => dispatch(createAnugaFriction(frictionTitle)),
        createAnugaMeshRegion: (meshRegionTitle) => dispatch(createAnugaMeshRegion(meshRegionTitle)),
        createNetwork: (networkTitle) => dispatch(createNetwork(networkTitle)),
        // W5.3 (TASK-1275) — Add mesh triangle render layer to map
        onAddMeshLayer: (layer) => dispatch(addLayer(layer)),
        // W6 (TASK-1422) — Zoom map to mesh extent after successful preview
        onZoomToExtent: (extent, crs, maxZoom) => dispatch(zoomToExtent(extent, crs, maxZoom))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu, AnugaInputMenuClass};
