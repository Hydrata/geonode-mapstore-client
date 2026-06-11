import React from "react";
import {connect} from "react-redux";
import {createSelector} from 'reselect';
import { OverlayTrigger, Tooltip, Button } from 'react-bootstrap';
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');

import '../anuga.css';
import '../../SimpleView/simpleView.css';
import '../../TerrainWorkbench/terrainWorkbench.css';

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
    createAnugaBoundary,
    createAnugaFriction,
    createAnugaInflow,
    createAnugaRainfall,
    createAnugaStructure,
    createAnugaMeshRegion,
    // TASK-1594 (W1) — Culvert: terrain-workbench drainage structure.
    createAnugaCulvert,
    addAnugaCulvert,
    setCreatingAnugaLayer,
    startAnugaModelCreationPolling,
    stopAnugaModelCreationPolling,
    setVisibleTerrainBboxPanel
} from "../actionsAnuga";
// TASK-1645 (W1.5) — recipe builder actions re-homed from TerrainWorkbench plugin.
import {
    twLoadData,
    twSelectSurface,
    twCreateSurface,
    twUpdateSurface,
    twDeleteSurface,
    twSetDesignInputs,
    twDerive,
} from '../../TerrainWorkbench/actionsTerrainWorkbench';
// TASK-1440 (W9): Networks action creators removed from this file — the Networks
// pane is now a self-contained shared component (shared/NetworksPane.js) that
// carries its own connect() and is rendered in the Hydrology panel.

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
// W6 (TASK-1423): shared helper builds the authenticated mesh layer config.
import {buildMeshTriangleLayer} from "../gwcTileRouting";
import {getToken} from "../../../../../MapStore2/web/client/utils/SecurityUtils";
// W6 (TASK-1422): MapStore2 utility for computing extent from a GeoJSON object.
import CoordinatesUtils from "../../../../../MapStore2/web/client/utils/CoordinatesUtils";

// ── TASK-1645 (W1.5): AnalysisSurface recipe builder — re-homed from TerrainWorkbench ──

// S1 param defaults.
const TW_PARAM_DEFAULTS = {
    feather_width_m: 50,
    target_resolution_m: 5,
    breach_max_cost: 20,
    breach_search_dist: 100,
};

function TWStaleBadge({ isStale }) {
    if (!isStale) return null;
    return (
        <span className="terrain-workbench-stale-badge" title="Recipe inputs have changed since last derive — re-derive to update">
            stale
        </span>
    );
}
TWStaleBadge.propTypes = { isStale: PropTypes.bool };
TWStaleBadge.defaultProps = { isStale: false };

function TWSeamQAPanel({ enforcementLog }) {
    if (!enforcementLog) return null;
    const maxSeam = typeof enforcementLog.max_seam_step_m === 'number' ? enforcementLog.max_seam_step_m.toFixed(3) : null;
    const offset = typeof enforcementLog.applied_bias_m === 'number' ? enforcementLog.applied_bias_m.toFixed(3) : null;
    if (!maxSeam && !offset) return null;
    return (
        <div className="tw-seam-qa" data-testid="seam-qa-panel">
            <div className="tw-label">Seam QA</div>
            {maxSeam !== null && <div className="tw-seam-qa-row"><span>Max seam step:</span><strong>{maxSeam} m</strong></div>}
            {offset !== null && <div className="tw-seam-qa-row"><span>Vertical offset applied:</span><strong>{offset} m</strong></div>}
        </div>
    );
}
TWSeamQAPanel.propTypes = { enforcementLog: PropTypes.object };
TWSeamQAPanel.defaultProps = { enforcementLog: null };

function TWDesignInputPicker({ terrains, designInputs, onChange, disabled }) {
    const addTerrain = (terrainId) => {
        const id = parseInt(terrainId, 10);
        if (!id || designInputs.find(d => d.terrain_id === id)) return;
        onChange([...designInputs, { terrain_id: id, priority: designInputs.length }]);
    };
    const remove = (idx) => {
        onChange(designInputs.filter((_, i) => i !== idx).map((d, i) => ({ ...d, priority: i })));
    };
    const moveUp = (idx) => {
        if (idx === 0) return;
        const next = [...designInputs];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange(next.map((d, i) => ({ ...d, priority: i })));
    };
    const available = terrains.filter(t => !designInputs.find(d => d.terrain_id === t.id));
    return (
        <div className="tw-design-inputs">
            <label className="tw-label">Design DEMs <span className="tw-label-sub">(ordered by priority)</span></label>
            {designInputs.map((di, idx) => {
                const t = terrains.find(x => x.id === di.terrain_id);
                return (
                    <div key={di.terrain_id} className="tw-design-input-row">
                        <span className="tw-priority-badge">{idx + 1}</span>
                        <span className="tw-input-title">{t ? (t.title || t.name) : `Terrain #${di.terrain_id}`}</span>
                        <button type="button" className="tw-icon-btn" onClick={() => moveUp(idx)} disabled={disabled || idx === 0} title="Move up">↑</button>
                        <button type="button" className="tw-icon-btn tw-icon-btn-danger" onClick={() => remove(idx)} disabled={disabled} title="Remove">×</button>
                    </div>
                );
            })}
            {available.length > 0 && (
                <select className="tw-select" value="" onChange={(e) => addTerrain(e.target.value)} disabled={disabled}>
                    <option value="">+ Add design DEM…</option>
                    {available.map(t => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
                </select>
            )}
            {designInputs.length === 0 && <div className="tw-validation-hint">At least one design DEM is required.</div>}
        </div>
    );
}
TWDesignInputPicker.propTypes = { terrains: PropTypes.array.isRequired, designInputs: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool };
TWDesignInputPicker.defaultProps = { disabled: false };

class TWRecipeBuilder extends React.Component {
    static propTypes = {
        surface: PropTypes.object.isRequired,
        terrains: PropTypes.array.isRequired,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        onUpdate: PropTypes.func.isRequired,
        onSetDesignInputs: PropTypes.func.isRequired,
        onDerive: PropTypes.func.isRequired,
        onDelete: PropTypes.func.isRequired,
    };
    static defaultProps = { deriving: false, deriveError: null, saving: false, saveError: null };

    constructor(props) {
        super(props);
        const s = props.surface;
        this.state = {
            title: s.title || '',
            regional_terrain: s.regional_terrain || '',
            use_culverts: !!s.use_culverts,
            feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
            target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
            breach_max_cost: s.breach_max_cost ?? TW_PARAM_DEFAULTS.breach_max_cost,
            breach_search_dist: s.breach_search_dist ?? TW_PARAM_DEFAULTS.breach_search_dist,
            designInputs: (s.design_inputs_ordered || []).map(d => ({ terrain_id: d.terrain, priority: d.priority })),
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.surface.id !== this.props.surface.id) {
            const s = this.props.surface;
            this.setState({
                title: s.title || '', regional_terrain: s.regional_terrain || '', use_culverts: !!s.use_culverts,
                feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
                target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
                breach_max_cost: s.breach_max_cost ?? TW_PARAM_DEFAULTS.breach_max_cost,
                breach_search_dist: s.breach_search_dist ?? TW_PARAM_DEFAULTS.breach_search_dist,
                designInputs: (s.design_inputs_ordered || []).map(d => ({ terrain_id: d.terrain, priority: d.priority })),
            });
        }
        if (prevProps.surface.design_inputs_ordered !== this.props.surface.design_inputs_ordered) {
            this.setState({ designInputs: (this.props.surface.design_inputs_ordered || []).map(d => ({ terrain_id: d.terrain, priority: d.priority })) });
        }
    }

    handleParam = (key, val) => this.setState({ [key]: val });

    handleSaveParams = () => {
        const { title, regional_terrain, use_culverts, feather_width_m, target_resolution_m, breach_max_cost, breach_search_dist } = this.state;
        this.props.onUpdate(this.props.surface.id, {
            title, regional_terrain: regional_terrain || null, use_culverts,
            feather_width_m: parseFloat(feather_width_m), target_resolution_m: parseFloat(target_resolution_m),
            breach_max_cost: parseFloat(breach_max_cost), breach_search_dist: parseFloat(breach_search_dist),
        });
    };

    handleSaveDesignInputs = () => {
        this.props.onSetDesignInputs(this.props.surface.id, this.state.designInputs);
    };

    handleDerive = () => {
        if (!this.state.designInputs.length || !this.state.regional_terrain) return;
        this.props.onDerive(this.props.surface.id);
    };

    render() {
        const { surface, terrains, deriving, deriveError, saving, saveError, onDelete } = this.props;
        const { title, regional_terrain, use_culverts, feather_width_m, target_resolution_m, breach_max_cost, breach_search_dist, designInputs } = this.state;
        const canDerive = designInputs.length > 0 && !!regional_terrain && !deriving && !saving;
        const regionalChoices = terrains.filter(t => !designInputs.find(d => d.terrain_id === t.id));
        return (
            <div className="tw-recipe-builder" data-testid="recipe-builder">
                <div className="tw-recipe-header">
                    <input className="tw-title-input" value={title} onChange={(e) => this.handleParam('title', e.target.value)} placeholder="Recipe title" disabled={saving || deriving} data-testid="recipe-title-input"/>
                    <TWStaleBadge isStale={surface.is_stale}/>
                    <button type="button" className="tw-icon-btn tw-icon-btn-danger" onClick={() => onDelete(surface.id)} disabled={saving || deriving} title="Delete recipe" data-testid="recipe-delete-btn">×</button>
                </div>
                <TWDesignInputPicker terrains={terrains} designInputs={designInputs} onChange={(inputs) => this.setState({ designInputs: inputs })} disabled={saving || deriving}/>
                <button type="button" className="tw-save-btn" onClick={this.handleSaveDesignInputs} disabled={saving || deriving} data-testid="save-design-inputs-btn">{saving ? 'Saving…' : 'Save design inputs'}</button>
                <div className="tw-field">
                    <label className="tw-label">Regional terrain</label>
                    <select className="tw-select" value={regional_terrain || ''} onChange={(e) => this.handleParam('regional_terrain', e.target.value ? parseInt(e.target.value, 10) : '')} disabled={saving || deriving} data-testid="regional-terrain-select">
                        <option value="">— select regional terrain —</option>
                        {terrains.map(t => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
                    </select>
                    {!regional_terrain && <div className="tw-validation-hint">Regional terrain is required.</div>}
                </div>
                <div className="tw-params-section">
                    <div className="tw-label">Parameters</div>
                    <div className="tw-param-grid">
                        <label>Use culverts</label>
                        <input type="checkbox" checked={!!use_culverts} onChange={(e) => this.handleParam('use_culverts', e.target.checked)} disabled={saving || deriving} data-testid="use-culverts-check"/>
                        <label>Feather width (m)</label>
                        <input type="number" className="tw-number-input" value={feather_width_m} min="1" onChange={(e) => this.handleParam('feather_width_m', e.target.value)} disabled={saving || deriving} data-testid="feather-width-input"/>
                        <label>Target resolution (m)</label>
                        <input type="number" className="tw-number-input" value={target_resolution_m} min="0.1" step="0.1" onChange={(e) => this.handleParam('target_resolution_m', e.target.value)} disabled={saving || deriving} data-testid="target-res-input"/>
                        <label>Breach max cost</label>
                        <input type="number" className="tw-number-input" value={breach_max_cost} min="0" onChange={(e) => this.handleParam('breach_max_cost', e.target.value)} disabled={saving || deriving} data-testid="breach-max-cost-input"/>
                        <label>Breach search dist</label>
                        <input type="number" className="tw-number-input" value={breach_search_dist} min="1" onChange={(e) => this.handleParam('breach_search_dist', e.target.value)} disabled={saving || deriving} data-testid="breach-search-dist-input"/>
                    </div>
                    <button type="button" className="tw-save-btn" onClick={this.handleSaveParams} disabled={saving || deriving} data-testid="save-params-btn">{saving ? 'Saving…' : 'Save parameters'}</button>
                </div>
                {saveError && <div className="tw-error" data-testid="save-error">{saveError}</div>}
                <div className="tw-derive-section">
                    <Button bsStyle="primary" bsSize="small" className="tw-derive-btn" onClick={this.handleDerive} disabled={!canDerive} data-testid="derive-btn">
                        {deriving ? 'Deriving…' : 'Derive terrain'}
                    </Button>
                    {deriving && <div className="tw-derive-progress" data-testid="derive-progress">Processing — watch the Task Monitor for progress.</div>}
                    {deriveError && <div className="tw-error" data-testid="derive-error">{deriveError}</div>}
                </div>
                <TWSeamQAPanel enforcementLog={surface.enforcement_log}/>
            </div>
        );
    }
}

function TWSurfaceList({ surfaces, selectedId, onSelect, onNew, saving }) {
    return (
        <div className="tw-surface-list">
            <div className="tw-surface-list-header">
                <span className="tw-label">Analysis Surfaces</span>
                <button type="button" className="tw-new-btn" onClick={onNew} disabled={saving} data-testid="new-surface-btn">+ New analysis surface</button>
            </div>
            {surfaces.length === 0 && <div className="tw-empty-hint">No analysis surfaces yet. Create one with <strong>+ New analysis surface</strong>.</div>}
            {surfaces.map(s => (
                <div key={s.id} className={`tw-surface-item${selectedId === s.id ? ' selected' : ''}`} onClick={() => onSelect(s.id)} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && onSelect(s.id)} data-testid={`surface-item-${s.id}`}>
                    <span className="tw-surface-title">{s.title || `Surface #${s.id}`}</span>
                    <TWStaleBadge isStale={s.is_stale}/>
                </div>
            ))}
        </div>
    );
}
TWSurfaceList.propTypes = { surfaces: PropTypes.array.isRequired, selectedId: PropTypes.number, onSelect: PropTypes.func.isRequired, onNew: PropTypes.func.isRequired, saving: PropTypes.bool };
TWSurfaceList.defaultProps = { selectedId: null, saving: false };

// ── end TASK-1645 recipe builder components ──────────────────────────────────

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
    // TASK-1594 (W1): Culverts for terrain hydro-enforcement.
    {id: 'culverts', titleMsgId: 'hydrata.anuga.culverts', layersKey: 'culvertLayers'}
    // ISSUE 16 item 2: 'networks' removed from Inputs rail; to be added as a
    // tab in the Hydrology panel (hydrologyMainMenu.js) in a follow-on subtask.
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
    networks: svgIcon(<g><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="6" x2="12" y2="18"/><line x1="18" y1="6" x2="12" y2="18"/></g>),
    // TASK-1594 (W1) — culvert icon: pipe cross-section with flow arrow
    culverts: svgIcon(<g><rect x="4" y="9" width="16" height="6" rx="3"/><line x1="4" y1="12" x2="20" y2="12"/><polyline points="17 9 20 12 17 15"/></g>)
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
    },
    // TASK-1594 (W1) — Culvert entry.
    culverts: {
        titleKey: 'culvertTitle', createProp: 'createAnugaCulvert',
        layersKey: 'culvertLayers', pendingKey: 'pendingCulverts',
        inputId: 'culvert-input', trackEventName: 'anuga-input-menu-create-culvert'
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
        frictionLayers: PropTypes.array,
        frictionRasterLayers: PropTypes.array,
        inflowLayers: PropTypes.array,
        rainfallLayers: PropTypes.array,
        structureLayers: PropTypes.array,
        meshRegionLayers: PropTypes.array,
        startAnugaModelCreationPolling: PropTypes.func,
        stopAnugaModelCreationPolling: PropTypes.func,
        isCreatingAnugaLayer: PropTypes.bool,
        setCreatingAnugaLayer: PropTypes.func,
        canEditAnugaMap: PropTypes.bool,
        // (networks props removed — now in shared/NetworksPane.js, TASK-1440)
        pendingBoundaries: PropTypes.array,
        pendingInflows: PropTypes.array,
        pendingRainfalls: PropTypes.array,
        pendingFrictions: PropTypes.array,
        pendingStructures: PropTypes.array,
        pendingMeshRegions: PropTypes.array,
        // TASK-1594 (W1) — Culvert props.
        culvertLayers: PropTypes.array,
        pendingCulverts: PropTypes.array,
        createAnugaCulvert: PropTypes.func,
        addAnugaCulvert: PropTypes.func,
        starterPhase: PropTypes.oneOf(['terrain', 'defaults']),
        addAnugaBoundary: PropTypes.func,
        addAnugaFriction: PropTypes.func,
        addAnugaInflow: PropTypes.func,
        addAnugaRainfall: PropTypes.func,
        addAnugaStructure: PropTypes.func,
        addAnugaMeshRegion: PropTypes.func,
        terrainModels: PropTypes.array,
        boundaryModels: PropTypes.array,
        frictionModels: PropTypes.array,
        inflowModels: PropTypes.array,
        rainfallModels: PropTypes.array,
        structureModels: PropTypes.array,
        meshRegionModels: PropTypes.array,
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
            // TASK-1594 (W1) — Culvert.
            culvertTitle: '',
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
            builtMeshes: null,
            // TASK-1645 (W1.5) — analysis surface section expanded/collapsed
            twSurfaceSectionOpen: false
        };
        this._meshPreviewPollTimer = null;
        this._meshPreviewPollCount = 0;
    }

    _toggleMeshWorkflow = () => {
        this.setState(prev => ({meshWorkflowOpen: !prev.meshWorkflowOpen}));
    };

    componentDidMount() {
        // W6 (TASK-1424): fetch built meshes on initial mount in case a scenario is
        // already selected (AnugaInputMenu is unmounted/remounted each time the panel
        // is opened, so the scenario is often pre-selected on first render).
        if (this.props.selectedScenarioId) {
            this._fetchBuiltMeshes();
        }
    }

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
                        const pct = proc.progress_pct ?? null;
                        const detail = proc.status_detail || null;
                        this.setState({
                            meshPreviewProgress: (pct !== null || detail) ? {pct, detail} : null
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
            // buildMeshTriangleLayer (gwcTileRouting) is the single source of truth
            // for the authenticated GWC MVT layer config (shared with MeshTriangleLayerSection).
            this.props.onAddMeshLayer && this.props.onAddMeshLayer(buildMeshTriangleLayer(getToken()));
        }

        // W6 (TASK-1422): zoom to mesh bbox from preview GeoJSON FeatureCollection.
        // geometry is WGS84 (EPSG:4326) — preview_mesh_async reprojects to WGS84.
        // CoordinatesUtils.getGeoJSONExtent handles FeatureCollection → [minX, minY, maxX, maxY].
        const geometry = result.geometry;
        if (!geometry || !geometry.features || geometry.features.length === 0) return;
        const extent = CoordinatesUtils.getGeoJSONExtent(geometry);
        if (extent && isFinite(extent[0])) {
            this.props.onZoomToExtent && this.props.onZoomToExtent(extent, 'EPSG:4326', 18);
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
        // TASK-1645 (W1.5): recipe builder state from props (terrainWorkbench slice).
        const {
            twTerrains, twSurfaces, twSelectedSurfaceId,
            twLoading, twError, twSaving, twSaveError, twDeriving, twDeriveError,
            onTwLoadData, onTwSelectSurface, onTwCreateSurface,
            onTwUpdateSurface, onTwDeleteSurface, onTwSetDesignInputs, onTwDerive,
            projectId
        } = this.props;
        const { twSurfaceSectionOpen } = this.state;
        const selectedSurface = (twSurfaces || []).find(s => s.id === twSelectedSurfaceId) || null;

        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('terrain', actions)}
                <div className="anuga-pane-rows">
                    {layers.map(t => <MenuRow key={t?.name || t?.id} layer={t}/>)}
                    {layers.length === 0 ? this.renderTerrainEmpty() : null}
                </div>
                {/* TASK-1645 (W1.5): Analysis Surface recipe builder, re-homed from TerrainWorkbench */}
                {projectId ? (
                    <div className="anuga-terrain-recipe-section">
                        <div
                            className="anuga-terrain-recipe-toggle"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                const opening = !twSurfaceSectionOpen;
                                this.setState({ twSurfaceSectionOpen: opening });
                                if (opening && onTwLoadData) onTwLoadData();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    const opening = !twSurfaceSectionOpen;
                                    this.setState({ twSurfaceSectionOpen: opening });
                                    if (opening && onTwLoadData) onTwLoadData();
                                }
                            }}
                            aria-expanded={twSurfaceSectionOpen}
                        >
                            <span className={`glyphicon ${twSurfaceSectionOpen ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} aria-hidden="true" style={{marginRight: 6}}/>
                            Analysis Surfaces
                        </div>
                        {twSurfaceSectionOpen && (
                            <div className="anuga-terrain-recipe-body">
                                {twLoading && <div className="tw-loading">Loading…</div>}
                                {twError && <div className="tw-error" data-testid="tw-load-error">{twError}</div>}
                                {!twLoading && !twError && (
                                    <React.Fragment>
                                        <TWSurfaceList
                                            surfaces={twSurfaces || []}
                                            selectedId={twSelectedSurfaceId}
                                            onSelect={onTwSelectSurface}
                                            onNew={() => onTwCreateSurface({
                                                title: `New Analysis Surface ${(twSurfaces || []).length + 1}`,
                                                regional_terrain: null,
                                                use_culverts: false,
                                                ...TW_PARAM_DEFAULTS,
                                            })}
                                            saving={twSaving}
                                        />
                                        {selectedSurface && (
                                            <TWRecipeBuilder
                                                surface={selectedSurface}
                                                terrains={twTerrains || []}
                                                deriving={twDeriving}
                                                deriveError={twDeriveError}
                                                saving={twSaving}
                                                saveError={twSaveError}
                                                onUpdate={onTwUpdateSurface}
                                                onSetDesignInputs={onTwSetDesignInputs}
                                                onDerive={onTwDerive}
                                                onDelete={onTwDeleteSurface}
                                            />
                                        )}
                                    </React.Fragment>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
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
        const {meshPreviewStatus, meshPreviewResult, meshPreviewError, meshWorkflowOpen, meshPreviewProgress, builtMeshes} = this.state;
        const hasScenario = !!this.props.selectedScenarioId;
        const scenario = this.props.selectedScenario || null;
        // W5.3: check if the mesh triangle render layer is already in the flat layer list
        const MESH_RENDER_LAYER = 'geonode:mesh_triangle_render';
        const isMeshLayerAdded = (this.props.flatLayers || []).some(l => l?.name === MESH_RENDER_LAYER);

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
                        progress: meshPreviewProgress  // null when not polling
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

    // TASK-1440 (W9): renderNetworksPane() REMOVED. The Networks pane is now
    // shared/NetworksPane.js (self-contained connected component) rendered as a
    // tab in the Hydrology panel (hydrologyMainMenu.js). The `case 'networks':`
    // switch arm below is correspondingly removed.

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
        // TASK-1440 (W9): 'networks' case removed — rendered in Hydrology panel.
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
        // TASK-1594 (W1) — Culvert layers (terrain-workbench drainage structures).
        culvertLayers: state?.layers?.flat?.filter(layer => layer?.group === 'Input Data.Culverts'),
        // TASK-1440 (W9): networkLayers / catchmentLayers / nodesLayers / linksLayers
        // removed — now in shared/NetworksPane.js mapStateToProps.
        terrainModels: state?.anuga?.resources?.terrain,
        boundaryModels: state?.anuga?.resources?.boundaries,
        inflowModels: state?.anuga?.resources?.inflows,
        rainfallModels: state?.anuga?.resources?.rainfalls,
        frictionModels: state?.anuga?.resources?.frictions,
        structureModels: state?.anuga?.resources?.structures,
        meshRegionModels: state?.anuga?.resources?.meshRegions,
        // TASK-1440 (W9): catchmentModels / nodesModels / linksModels removed.
        pendingBoundaries: pendingByModel.Boundary,
        pendingInflows: pendingByModel.Inflow,
        pendingRainfalls: pendingByModel.Rainfall,
        pendingFrictions: pendingByModel.Friction,
        pendingStructures: pendingByModel.Structure,
        pendingMeshRegions: pendingByModel.MeshRegion,
        // TASK-1594 (W1) — Culvert pending tasks.
        pendingCulverts: pendingByModel.Culvert || [],
        starterPhase,
        isCreatingAnugaLayer: state?.anuga?.ui?.isCreatingAnugaLayer,
        canEditAnugaMap: canEditAnugaMap(state),
        // W3.1 (TASK-1266) — For preview mesh: project id + selected scenario id
        projectId: getProjectId(state),
        selectedScenarioId: state?.anuga?.scenarios?.selectedId || null,
        // W5.1 (TASK-1273) — Full scenario object for cost estimate in MeshWorkflow
        selectedScenario: getSelectedScenario(state),
        // W5.3 (TASK-1275) — Layer list to detect if mesh_triangle_render is already added
        flatLayers: state?.layers?.flat || [],
        // TASK-1645 (W1.5) — recipe builder state from terrainWorkbench slice.
        twTerrains: state?.terrainWorkbench?.terrains || [],
        twSurfaces: state?.terrainWorkbench?.surfaces || [],
        twSelectedSurfaceId: state?.terrainWorkbench?.selectedSurfaceId || null,
        twLoading: state?.terrainWorkbench?.loading || false,
        twError: state?.terrainWorkbench?.error || null,
        twSaving: state?.terrainWorkbench?.saving || false,
        twSaveError: state?.terrainWorkbench?.saveError || null,
        twDeriving: state?.terrainWorkbench?.deriving || false,
        twDeriveError: state?.terrainWorkbench?.deriveError || null,
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
        // TASK-1440 (W9): setNetworkMenu / setAnugaInputMenu / addNetwork /
        // addCatchment / addNodes / addLinks / createNetwork removed — now in
        // shared/NetworksPane.js mapDispatchToProps.
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
        // TASK-1594 (W1) — Culvert: terrain-workbench drainage structure.
        createAnugaCulvert: (culvertTitle) => dispatch(createAnugaCulvert(culvertTitle)),
        addAnugaCulvert: () => dispatch(addAnugaCulvert()),
        // W5.3 (TASK-1275) — Add mesh triangle render layer to map
        onAddMeshLayer: (layer) => dispatch(addLayer(layer)),
        // W6 (TASK-1422) — Zoom map to mesh extent after successful preview
        onZoomToExtent: (extent, crs, maxZoom) => dispatch(zoomToExtent(extent, crs, maxZoom)),
        // TASK-1645 (W1.5) — recipe builder actions.
        onTwLoadData: () => dispatch(twLoadData()),
        onTwSelectSurface: (id) => dispatch(twSelectSurface(id)),
        onTwCreateSurface: (payload) => dispatch(twCreateSurface(payload)),
        onTwUpdateSurface: (id, payload) => dispatch(twUpdateSurface(id, payload)),
        onTwDeleteSurface: (id) => dispatch(twDeleteSurface(id)),
        onTwSetDesignInputs: (id, inputs) => dispatch(twSetDesignInputs(id, inputs)),
        onTwDerive: (id) => dispatch(twDerive(id)),
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu, AnugaInputMenuClass};
