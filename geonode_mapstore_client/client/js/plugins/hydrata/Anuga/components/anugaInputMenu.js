import React from "react";
import {connect} from "react-redux";
import {createSelector} from 'reselect';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
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
    setVisibleTerrainBboxPanel,
    // TASK-1880 (epic 1884 W2): open the in-app terrain-upload CRS picker.
    setTerrainUploadCrsPanel,
    // TASK-1720 (W3): sync the terrain Redux row after a styling-mode PATCH (merge 5.x→epic).
    updateTerrainRow
} from "../actionsAnuga";
// TASK-1645 (W1.5) / TASK-1671 (W1.6) — recipe builder actions.
// TASK-1800 (W1.9 UAT) — setTerrainWorkbenchVisible opens the stand-alone
// "Merge terrains" side panel from the Terrain pane header button.
import {
    setTerrainWorkbenchVisible,
    twLoadData,
    twSelectSurface,
    twSelectSurfaceForTerrain,
    twCreateSurface,
    twUpdateSurface,
    twDeleteSurface,
    twDerive
} from '../../TerrainWorkbench/actionsTerrainWorkbench';
// TASK-2580 (W2-reaim change 3a) — close the Inputs menu when the "Combined
// surface" button opens the stand-alone panel (mirrors TASK-1648's 'Define
// import area' precedent: terrainBboxPanel.js dispatches this same action on
// its own draw-start button, and MergeTerrainsPanel is ALSO mounted at the
// anugaContainer level — see the TASK-1648 note above — so closing the Inputs
// menu here can never unmount it).
import { setAnugaInputMenu } from '../actions/uiActions';
// TASK-1440 (W9): Networks action creators removed from this file — the Networks
// pane is now a self-contained shared component (shared/NetworksPane.js) that
// carries its own connect() and is rendered in the Hydrology panel.

import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
// TASK-1800 (W1.9 UAT 2026-06-18): the parent terrain row reuses the same
// transparency slider primitive as the child rows, driven as a MASTER control.
import {OpacitySlider} from "../../SimpleView/components/primitives";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";
// TASK-1800 (W1.9 UAT): the recipe-builder components that consumed the shared
// ErrorStrip / EmptyState / StatusBadge primitives moved to
// TerrainWorkbench/components/recipeBuilderComponents.js, so those primitive
// imports are no longer needed in this file.
// BUG (UAT, TASK-1648 regression): TerrainBboxPanel is now mounted in
// anugaContainer.js (container level), NOT here. 'Define import area' dispatches
// setAnugaInputMenu(false), which unmounts THIS component; when the bbox panel
// lived here it unmounted mid-draw and the map froze in BBOX draw mode with no
// panel to return to. The globe button (setVisibleTerrainBboxPanel(true)) stays.
import AnugaInputStarterCard from "./anugaInputStarterCard";
// TASK-1800 (W1.9 UAT) — custom layered-mountain + cog icon for the "Merge
// terrains" header button that opens the stand-alone recipe-builder panel.
import {MergeTerrainsIcon} from "../../TerrainWorkbench/components/MergeTerrainsPanel";

import {canEditAnugaMap, getProjectId, getSelectedScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import {deleteTerrain} from "@js/plugins/hydrata/Anuga/actions/dataActions";
// TASK-2327 (epic 2323): non-blocking vertical-datum badge on the terrain row.
import TerrainDatumBadge from "@js/plugins/hydrata/Anuga/components/terrainDatumBadge";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
// W5.1 (TASK-1273): MeshWorkflow consolidates preview + cost estimate + import/export slots.
import {MeshWorkflow} from "./MeshWorkflow";
// Merge note (5.x→epic 2026-06-15): union of TASK-1652 reorder imports and
// TASK-1720/1721 styling-mode/contour imports.
import {addLayer, moveNode, sortNode, changeLayerProperties, removeLayer} from "../../../../../MapStore2/web/client/actions/layers";
import {getNode, sortLayers} from "../../../../../MapStore2/web/client/utils/LayersUtils";
// W6 (TASK-1422): zoom to mesh extent after successful preview.
// TASK-1751 (W1.8): changeMapView is re-emitted after a Dynamic toggle so
// demRescaleEpic stamps env= immediately (it keys ONLY on CHANGE_MAP_VIEW,
// which is otherwise fired solely by an OpenLayers pan/zoom moveend).
import {zoomToExtent, changeMapView} from "../../../../../MapStore2/web/client/actions/map";
import {mapSelector} from "../../../../../MapStore2/web/client/selectors/map";
// TASK-1652 (W1.5): blob persist after terrain reorder. TASK-1720 (W3): styling-mode toggle persist.
import {saveDirectContent} from "@js/actions/gnsave";
// TASK-1720 (W3): DEM styling-mode toggle — update terrain via the API.
// (updateTerrainRow is folded into the ../actionsAnuga import block above.)
// TASK-1880 (epic 1884 W2): uploadTerrainDirect moved to TerrainUploadCrsPanel
// (the CRS picker now owns the presign→PUT→finalize chain on Confirm).
import {patchTerrainStylingMode} from "../api/anugaApi";
// TASK-1728 (W1.7): the direct-to-S3 terrain upload no longer owns a blocking
// modal or an inline progress strip — its progress lives on the W1.5 Tasks Panel.
// The presign-time Process (created by the BE, TASK-1727) surfaces via polling;
// we inject an OPTIMISTIC row keyed on that same process_id so it appears instantly
// and reflects byte-level progress while the modeller keeps working, then the
// polled BE Process takes over the Uploading -> UTM -> Hillshade -> Style lifecycle.
import {updateProcess, toggleTaskMonitorPanel} from "../../TaskMonitor/actionsTaskMonitor";
// W6 (TASK-1423): shared helper builds the authenticated mesh layer config.
// TASK-1721 (W4): buildContourLayer builds the ras:Contour overlay config.
// TASK-1829 (W2): now DIRECT WMS + niceContourInterval (FE-static adaptive interval).
import {buildMeshTriangleLayer, buildContourLayer, niceContourInterval, DEM_CONTOUR_STYLE_NAME} from "../gwcTileRouting";
import {getToken} from "../../../../../MapStore2/web/client/utils/SecurityUtils";
// W6 (TASK-1422): MapStore2 utility for computing extent from a GeoJSON object.
import CoordinatesUtils from "../../../../../MapStore2/web/client/utils/CoordinatesUtils";

// ── TASK-1645 (W1.5) / TASK-1671 (W1.6): AnalysisSurface recipe builder ────
//
// TASK-1800 (W1.9 UAT): the recipe-builder components (TW*) + estimator were
// EXTRACTED VERBATIM to TerrainWorkbench/components/recipeBuilderComponents.js so
// the stand-alone "Combined surface" side panel and this legacy pane share one
// definition. Re-exported below (export {TWStaleBadge, TWRecipeBuilder}) so
// existing test imports from this module keep resolving.
// TASK-1800 (r2): the surface LIST (TWSurfaceList) was removed — a project owns a
// SINGLE combined surface, so there is no list to render or re-export.
import {
    TWStaleBadge,
    TWRecipeBuilder
} from '../../TerrainWorkbench/components/recipeBuilderComponents';

const ACTIVE_TM_STATES = new Set(['pending', 'running']);
const PENDING_MODEL_CLASSES = ['Boundary', 'Inflow', 'Rainfall', 'Friction', 'Structure', 'MeshRegion'];
const EMPTY_BY_ID = {};
const EMPTY_IDS = [];

// Ad-hoc design fix 2026-07-13: react-bootstrap OverlayTrigger tooltips portal to
// <body> where geonode.css gives `.msgapi .tooltip` z-index:10000 — but the GeoNode
// page wrapper (`.gn-page-wrapper`) is z-index:99999, so a body-level tooltip paints
// BEHIND the whole app and is never visible (the "clearer tooltips" from 61f29d9b7
// were invisible for exactly this reason). Lift these pane-header tooltips above the
// wrapper via an inline z-index (inline beats the stylesheet rule) so they show on
// hover. Applied to every OverlayTrigger overlay in this file's pane headers.
const PANE_TOOLTIP_STYLE = { zIndex: 100000 };

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

// ── TASK-1652 (W1.5): Terrain hierarchy ──────────────────────────────────────
//
// TerrainHierarchyRow renders ONE terrain model as a collapsible parent:
//   ▸ parent row  = the DEM map layer (MenuRow)
//   └ child rows  = hillshade + future derivatives (slope, flow-accumulation)
//
// TerrainListWithDragDrop wraps the ordered list of TerrainHierarchyRow entries
// with HTML5 drag-and-drop so parent terrains can be stacked differently.
// On drag-end it calls onReorder(fromIndex, toIndex) which the parent dispatches
// as moveNode + saveDirectContent.

// TASK-1587 W1.9 UAT: a terrain that FAILED (status='error') or is stuck
// processing has no published layer, so it renders as a bare "pending" row. It
// used to show only a STATIC hourglass and NO way to remove it — a failed
// upload/derive sat on the list forever. These two helpers give that row a
// status-aware indicator (animated hourglass while processing, a red error glyph
// when failed) + a delete affordance. Delete dispatches deleteTerrain with no
// layer ids (a failed terrain has no gn_layer; deleteTerrain tolerates []).
function TerrainPendingStatus({status}) {
    if (status === 'error') {
        return (
            <span
                className="glyphicon glyphicon-exclamation-sign sv-terrain-failed-glyph"
                style={{marginLeft: 6, fontSize: 11, color: 'rgba(240, 120, 110, 0.95)'}}
                title="Terrain processing failed"
                aria-label="Terrain processing failed"
            />
        );
    }
    return (
        <span
            className="glyphicon glyphicon-hourglass sv-terrain-computing-glyph"
            style={{marginLeft: 6, fontSize: 10}}
            title="Terrain is processing…"
            aria-label="Terrain is processing"
        />
    );
}
TerrainPendingStatus.propTypes = {status: PropTypes.string};

// TASK-1587 W1.9 UAT (2026-06-19): the trash affordance opens the application's
// OWN dark-glass confirm — the SAME inline-overlay pattern MenuRowClass uses for
// layer deletes (a .sv-menu-row-delete-confirm overlay with a .sv-save-confirm-btn
// danger confirm + a cancel button). It replaces the native window.confirm so the
// pending-terrain delete matches the rest of SimpleView (themed, non-blocking) and
// reuses the existing i18n keys — no new dialog, no new message id. Stateful:
// local `confirmVisible` flips the overlay on the trash click; Confirm dispatches
// deleteTerrain(projectId, id, []) (a failed terrain has no gn_layer); Cancel just
// closes the overlay.
class TerrainPendingDeleteButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = {confirmVisible: false};
    }
    openConfirm = () => {
        if (this.props.projectId) this.setState({confirmVisible: true});
    };
    cancelConfirm = () => {
        this.setState({confirmVisible: false});
    };
    performDelete = () => {
        const {projectId, terrainId, doDelete} = this.props;
        this.setState({confirmVisible: false});
        if (projectId && terrainId) doDelete(projectId, terrainId);
    };
    render() {
        const {terrainId} = this.props;
        if (!terrainId) return null;   // synthetic orphan rows have no real terrain to delete
        const {confirmVisible} = this.state;
        return (
            <React.Fragment>
                <span
                    className={'btn glyphicon glyphicon-trash sv-terrain-pending-delete' + (confirmVisible ? ' sv-glyph-hidden' : '')}
                    role="button"
                    tabIndex={0}
                    data-testid={`terrain-delete-pending-${terrainId}`}
                    style={{marginLeft: 8, fontSize: 11, color: 'rgba(255, 255, 255, 0.55)', cursor: 'pointer', flexShrink: 0}}
                    title="Delete this terrain"
                    aria-label="Delete this terrain"
                    onClick={(e) => { e.stopPropagation(); this.openConfirm(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openConfirm(); } }}
                />
                <span
                    className={'sv-menu-row-delete-confirm' + (confirmVisible ? ' is-open' : '')}
                    role="alertdialog"
                    aria-label="Confirm delete"
                    aria-hidden={confirmVisible ? undefined : true}
                    data-testid={`terrain-delete-pending-confirm-${terrainId}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="btn glyphicon glyphicon-trash" style={{fontSize: 14}} aria-hidden="true"/>
                    <span className="sv-menu-row-delete-confirm-text">
                        <Message msgId="hydrata.simpleView.confirmDelete"/>
                    </span>
                    <button
                        type="button"
                        className="sv-save-confirm-btn danger"
                        data-testid={`terrain-delete-pending-confirm-btn-${terrainId}`}
                        onClick={(e) => { e.stopPropagation(); this.performDelete(); }}
                    >
                        <Message msgId="hydrata.simpleView.delete"/>
                    </button>
                    <button
                        type="button"
                        className="sv-save-confirm-btn cancel"
                        data-testid={`terrain-delete-pending-cancel-btn-${terrainId}`}
                        onClick={(e) => { e.stopPropagation(); this.cancelConfirm(); }}
                    >
                        <Message msgId="hydrata.simpleView.cancel"/>
                    </button>
                </span>
            </React.Fragment>
        );
    }
}
TerrainPendingDeleteButton.propTypes = {
    projectId: PropTypes.number,
    terrainId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    doDelete: PropTypes.func
};
const TerrainPendingDelete = connect(
    (state) => ({projectId: getProjectId(state)}),
    (dispatch) => ({doDelete: (projectId, terrainId) => dispatch(deleteTerrain(projectId, terrainId, []))})
)(TerrainPendingDeleteButton);

class TerrainHierarchyRow extends React.Component {
    static propTypes = {
        terrain: PropTypes.object.isRequired,
        demLayer: PropTypes.object,
        hillshadeLayer: PropTypes.object,
        expanded: PropTypes.bool,
        onToggleExpand: PropTypes.func,
        // Drag-and-drop props (passed by TerrainListWithDragDrop)
        dragging: PropTypes.bool,
        dragOver: PropTypes.bool,
        onDragStart: PropTypes.func,
        onDragOver: PropTypes.func,
        onDragEnd: PropTypes.func,
        onDrop: PropTypes.func,
        // TASK-1720/1721 rendering-mode + contour toggles (merged 5.x→epic 2026-06-15)
        terrainModel: PropTypes.object,        // the real Terrain model row (null for orphan rows)
        canEdit: PropTypes.bool,
        contoursEnabled: PropTypes.bool,
        onStylingModeChange: PropTypes.func,   // (terrainModel, demLayer, newMode)
        onContoursToggle: PropTypes.func,      // (demLayerName, currentlyEnabled)
        // TASK-1800 (W1.9 UAT live-fix 2026-06-18): master visibility + opacity for
        // the parent row — toggles / sets ALL child layers via changeLayerProperties.
        onChangeTerrainLayerProperties: PropTypes.func // (layerId, {visibility?|opacity?})
    };

    render() {
        const {
            terrain, demLayer, hillshadeLayer, expanded, onToggleExpand,
            dragging, dragOver, onDragStart, onDragOver, onDragEnd, onDrop,
            // Merge (5.x→epic 2026-06-15): TASK-1720/1721 per-DEM rendering-mode + contour toggles.
            terrainModel, canEdit, contoursEnabled, onStylingModeChange, onContoursToggle,
            onChangeTerrainLayerProperties
        } = this.props;
        // TASK-1800 (W1.9 UAT live-fix 2026-06-18): expanding / collapsing a terrain
        // group is PURE DISCLOSURE — it only shows / hides the DEM + Hillshade child
        // rows. It must NOT open the stand-alone "Combined surface" panel: that panel
        // is opened solely by its own header button (anuga-terrain-merge-panel-button).
        // The former select-on-expand side effect (TASK-1753) auto-opened that panel +
        // ran a background load + surface-select on every expand, which the UAT flagged
        // as intrusive — removed now that the recipe builder is a stand-alone panel.
        const handleRowSelect = () => {
            if (onToggleExpand) onToggleExpand(terrain.id);
        };

        // TASK-1800 (W1.9 UAT 2026-06-18): parent-row MASTER controls. The parent row
        // carries a "toggle all" visibility tick + a master transparency slider that
        // drive EVERY child layer at once (the DEM + its Hillshade). Aggregate state is
        // read from the live child layer objects (state.layers.flat); actions fan out
        // via onChangeTerrainLayerProperties (changeLayerProperties per child).
        const childLayers = [demLayer, hillshadeLayer].filter(Boolean);
        const childVisibleCount = childLayers.filter(l => l.visibility).length;
        const allChildrenVisible = childLayers.length > 0 && childVisibleCount === childLayers.length;
        const noChildrenVisible = childVisibleCount === 0;
        // green tick = all on · red cross = all off · orange "adjust" = mixed
        const masterVisGlyph = allChildrenVisible
            ? 'glyphicon-ok sv-glyph-active'
            : noChildrenVisible ? 'glyphicon-remove sv-glyph-inactive' : 'glyphicon-adjust sv-glyph-partial';
        const masterOpacity = childLayers.length
            ? childLayers.reduce((s, l) => s + (l.opacity ?? 1), 0) / childLayers.length
            : 1;
        const toggleAllChildren = () => {
            const next = !allChildrenVisible; // all visible -> hide all; otherwise -> show all
            childLayers.forEach(l => onChangeTerrainLayerProperties && onChangeTerrainLayerProperties(l.id, { visibility: next }));
        };
        const setAllChildrenOpacity = (values) => {
            const v = parseFloat(Array.isArray(values) ? values[0] : values);
            if (!isNaN(v)) childLayers.forEach(l => onChangeTerrainLayerProperties && onChangeTerrainLayerProperties(l.id, { opacity: v * 0.01 }));
        };

        // TASK-1587 (grill 2026-06-15): the expanded zone now ALWAYS holds the
        // Rendering-mode + Contours rows for a real terrain, so a row is expandable
        // whenever there is a real terrain model OR a hillshade derivative — not only
        // when a hillshade exists. Orphan / analysis-surface rows (no model) stay flat.
        const hasDerivatives = !!hillshadeLayer || !!terrainModel?.id;
        // TASK-1720 (W3): styling mode for this terrain (default 'traditional' = the W1 BE default).
        const mode = terrainModel?.styling_mode || 'traditional';
        const isDynamic = mode === 'dynamic';

        // UAT 2026-06-17: Mode (⚙) + Contours (◷) render as an EXTRA toolbar slot on
        // the DEM MenuRow — to the RIGHT of the per-layer controls (tick / glass /
        // delete), before the title. Built as {key, render} entries the MenuRow drops
        // into its .sv-menu-row-toolbar-extra block. The Hillshade row reserves the SAME
        // fixed-width (empty) column so the controls + titles line up across both rows.
        const demExtraActions = [];
        if (canEdit && terrainModel?.id) {
            demExtraActions.push({
                key: 'terrain-mode',
                render: () => (
                    <span className="sv-anuga-terrain-mode-toggle" data-testid="terrain-mode-toggle">
                        <button
                            className={`btn btn-xs sv-anuga-terrain-mode-btn sv-anuga-terrain-icon-btn ${isDynamic ? 'btn-primary' : 'btn-default'}`}
                            title={isDynamic
                                ? 'Mode: Dynamic — switch to Traditional (static colour relief, GWC tiled)'
                                : 'Mode: Traditional — switch to Dynamic (live ramp rescale on pan/zoom)'}
                            aria-label={isDynamic ? 'Switch to Traditional rendering' : 'Switch to Dynamic rendering'}
                            aria-pressed={isDynamic}
                            data-testid={`terrain-mode-toggle-btn-${terrainModel.id}`}
                            onClick={() => onStylingModeChange && onStylingModeChange(
                                terrainModel, demLayer, isDynamic ? 'traditional' : 'dynamic'
                            )}
                        >
                            {/* TASK-1829 re-aim (UAT): a lightning bolt reads as "dynamic / live
                                rescale" far better than the old cog (settings). */}
                            <span className="glyphicon glyphicon-flash" aria-hidden="true" />
                        </button>
                    </span>
                )
            });
        }
        if (terrainModel?.id) {
            demExtraActions.push({
                key: 'terrain-contours',
                render: () => (
                    <span className="sv-anuga-terrain-contour-toggle" data-testid="terrain-contour-toggle">
                        <button
                            className={`btn btn-xs sv-anuga-terrain-mode-btn sv-anuga-terrain-icon-btn ${contoursEnabled ? 'btn-primary' : 'btn-default'}`}
                            title={contoursEnabled
                                ? 'Contours: On — hide contour overlay (live ras:Contour, adaptive interval)'
                                : 'Contours: Off — show contour overlay (live ras:Contour, adaptive interval)'}
                            aria-label={contoursEnabled ? 'Hide Contours' : 'Show Contours'}
                            aria-pressed={contoursEnabled}
                            data-testid={`terrain-contour-toggle-btn-${terrainModel.id}`}
                            onClick={() => onContoursToggle && onContoursToggle(demLayer?.name, contoursEnabled, terrainModel)}
                        >
                            {/* TASK-1829 re-aim (UAT): icon shows contours as THREE hills (nested
                                topographic rings) filling the box, so it reads as a contour map. */}
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="0.9" style={{verticalAlign: 'middle'}}>
                                <ellipse cx="4.6" cy="10.6" rx="4.4" ry="3.6" />
                                <ellipse cx="4.6" cy="10.2" rx="1.9" ry="1.4" />
                                <ellipse cx="11.4" cy="5" rx="4.2" ry="3.2" />
                                <ellipse cx="11.4" cy="4.6" rx="1.6" ry="1.1" />
                                <ellipse cx="12.9" cy="12.2" rx="2.8" ry="2.2" />
                                <ellipse cx="12.9" cy="11.9" rx="1" ry="0.7" />
                            </svg>
                        </button>
                    </span>
                )
            });
        }
        // Reserve the matching (empty) column on the Hillshade row only when the DEM
        // actually has toggles — render() returns null, the fixed-width CSS reserves it.
        const hillshadeExtraActions = demExtraActions.length > 0
            ? [{ key: 'toggle-spacer', render: () => null }]
            : [];

        return (
            <div
                className={`sv-terrain-hierarchy-item ${dragging ? 'sv-terrain-dragging' : ''} ${dragOver ? 'sv-terrain-drag-over' : ''}`}
                draggable
                onDragStart={onDragStart}
                onDragOver={(e) => { e.preventDefault(); onDragOver && onDragOver(e); }}
                onDragEnd={onDragEnd}
                onDrop={(e) => { e.preventDefault(); onDrop && onDrop(e); }}
            >
                {/* Parent row (BUG-4, UAT): DEM IDENTITY ONLY — the expand chevron and a
                    lightweight DEM title label so the modeller can tell which DEM this is
                    while collapsed. UAT 2026-06-17: the glyphicon-move "pan" drag handle was
                    removed (the whole .sv-terrain-hierarchy-item stays draggable for reorder).
                    The DEM MenuRow itself (visibility / zoom / per-layer controls) is NOT
                    here — per the finding it lives INSIDE the collapsible derivatives section
                    below, alongside Hillshade, so the top level stays a clean identity-only
                    header. Clicking the title toggles expansion too (the whole header acts as
                    the disclosure control). */}
                <div className="sv-terrain-parent-row">
                    {hasDerivatives ? (
                        <span
                            className={`sv-terrain-expand-btn glyphicon ${expanded ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse derivatives' : 'Expand derivatives'}
                            onClick={handleRowSelect}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowSelect(); } }}
                            style={{cursor: 'pointer', marginRight: 4, fontSize: 10, color: 'rgba(255,255,255,0.6)'}}
                        />
                    ) : (
                        <span style={{display: 'inline-block', width: 14, marginRight: 4}} />
                    )}
                    {/* Expandable (real terrain) rows show a lightweight identity title; the
                        full DEM MenuRow is folded into the collapsible zone (BUG-4). NON-expandable
                        orphan / analysis-surface rows (no model, no hillshade) have no collapsible
                        zone, so they keep the full DEM MenuRow inline here — otherwise their
                        visibility/zoom controls would have nowhere to live. */}
                    {hasDerivatives ? (
                        childLayers.length > 0 ? (
                            /* TASK-1800 (W1.9 UAT 2026-06-18): the parent row now MATCHES the
                               child row style — a master visibility tick (toggles ALL children)
                               + the identity title + a master transparency slider (sets ALL
                               children's opacity) — with the extra expand chevron above. The
                               .sv-menu-row-* primitive classes make it line up with the child
                               rows automatically. */
                            <React.Fragment>
                                <div className="sv-menu-row-left">
                                    <div className="sv-menu-row-toolbar">
                                        <span
                                            className={`btn glyphicon sv-menu-row-glyph ${masterVisGlyph}`}
                                            role="button"
                                            tabIndex={0}
                                            data-testid="terrain-parent-toggle-all"
                                            aria-label={allChildrenVisible ? 'Hide all terrain layers' : 'Show all terrain layers'}
                                            title={allChildrenVisible ? 'Hide all terrain layers' : 'Show all terrain layers'}
                                            onClick={(e) => { e.stopPropagation(); toggleAllChildren(); }}
                                        />
                                    </div>
                                    <div className="sv-menu-row-title">
                                        <span
                                            className="sv-menu-row-text sv-tw-terrain-parent-title sv-terrain-parent-title"
                                            data-testid="terrain-parent-title"
                                            style={{cursor: 'pointer'}}
                                            onClick={handleRowSelect}
                                            title={demLayer ? (demLayer.title || demLayer.name) : (terrain.title || terrain.name || 'Terrain')}
                                        >
                                            {demLayer ? (demLayer.title || demLayer.name) : (terrain.title || terrain.name || 'Terrain')}
                                        </span>
                                    </div>
                                </div>
                                <OpacitySlider opacity={masterOpacity} onChange={setAllChildrenOpacity} />
                            </React.Fragment>
                        ) : (
                            /* Pending/failed: no child layers yet — identity title + a
                               status-aware indicator (animated hourglass while processing, red
                               error glyph when failed) + a delete affordance so a failed/stuck
                               terrain can be cleaned up (TASK-1587 W1.9 UAT). */
                            <React.Fragment>
                                <span
                                    className="sv-tw-terrain-parent-title sv-terrain-parent-title"
                                    data-testid="terrain-parent-title"
                                    style={{flex: 1, minWidth: 0, color: terrain.status === 'error' ? 'rgba(240,150,140,0.85)' : 'rgba(255,255,255,0.85)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                                    onClick={handleRowSelect}
                                    title={terrain.title || terrain.name || 'Terrain'}
                                >
                                    {terrain.title || terrain.name || 'Terrain'}
                                    <TerrainPendingStatus status={terrain.status} />
                                </span>
                                <TerrainPendingDelete terrainId={terrain.id} />
                            </React.Fragment>
                        )
                    ) : demLayer ? (
                        <div style={{flex: 1, minWidth: 0}}>
                            <MenuRow layer={demLayer} />
                        </div>
                    ) : (
                        <React.Fragment>
                            <span className="sv-tw-terrain-pending-name sv-terrain-pending-name" style={{flex: 1, color: terrain.status === 'error' ? 'rgba(240,150,140,0.7)' : 'rgba(255,255,255,0.6)'}}>
                                {terrain.title || terrain.name || 'Terrain'}
                                <TerrainPendingStatus status={terrain.status} />
                            </span>
                            <TerrainPendingDelete terrainId={terrain.id} />
                        </React.Fragment>
                    )}
                </div>
                {/* TASK-2327 (epic 2323): non-blocking vertical-datum advisory for the
                    real terrain model — loud only for an ellipsoid / low-confidence
                    guess, a quiet confirmed tick for high-confidence EGM2008, silent
                    otherwise. Offers Convert-to-EGM2008 (TASK-2326) / Keep / Correct. */}
                {terrainModel ? <TerrainDatumBadge terrain={terrainModel} /> : null}
                {/* Expanded zone (TASK-1587 grill 2026-06-15 + BUG-4 UAT 2026-06-16 +
                    decision 2026-06-16-q-4 REVISING ADR#9): the parent row above is DEM
                    IDENTITY ONLY. Inside the collapsible section the DEM now OWNS its two
                    sub-options — Rendering mode and Contours both DERIVE from DEM elevation
                    so they are NESTED under the DEM (sv-terrain-dem-group). Hillshade is a
                    SEPARATE sibling row with NO sub-options (it is just a display
                    derivative). Mode + Contours are icon-only, left-justified buttons.
                    data-testids are preserved from the 5.x→epic merge (TASK-1720/1721) so
                    the existing tests/selectors keep working. */}
                {expanded ? (
                    <div className="sv-terrain-derivatives">
                        {/* ⛰ DEM group: the DEM MenuRow carries the Mode + Contours toggles in
                            its extra-toolbar slot — to the RIGHT of the per-layer controls (UAT
                            2026-06-17). */}
                        {demLayer ? (
                            <div className="sv-terrain-dem-group">
                                {/* DEM layer row (BUG-4): the full DEM MenuRow, folded into the
                                    collapsible section. UAT 2026-06-17: per-layer controls (tick /
                                    glass / delete) on the LEFT, the Mode (⚙) + Contours (◷) toggles
                                    to their RIGHT via the MenuRow extra-toolbar slot (between the
                                    controls and the title). Decorative photo glyph removed earlier. */}
                                <div className="sv-terrain-derivative-row sv-tw-terrain-dem-row sv-terrain-dem-row" data-testid="terrain-dem-row">
                                    {/* TASK-1800 (W1.9 UAT live-fix 2026-06-18): the 28px
                                        .sv-terrain-derivative-indent spacer was removed so the row's
                                        buttons + text shift LEFT to sit just under the parent title
                                        (the deep indent left a dead column the UAT flagged). */}
                                    <div style={{flex: 1, minWidth: 0}}>
                                        <MenuRow layer={demLayer} extraToolbarActions={demExtraActions} />
                                    </div>
                                </div>
                                {/* TASK-2233: the dynamic-DEM colour-ramp legend (TASK-1850) no
                                    longer renders inline here — it floats as a stand-alone
                                    MovablePanel mounted at the anugaContainer level
                                    (FloatingDemLegendPanel in DemRampLegend.js), so it survives
                                    closing the Inputs menu and stops burning menu height. */}
                            </div>
                        ) : null}
                        {/* ◔ Hillshade: SEPARATE sibling derivative with NO toggles. It passes an
                            empty extra-toolbar slot (same fixed width) so its controls + title line
                            up in columns with the DEM row above. */}
                        {hillshadeLayer ? (
                            <div className="sv-terrain-derivative-row sv-tw-terrain-hillshade-row">
                                {/* TASK-1800 (W1.9 UAT live-fix 2026-06-18): 28px indent spacer
                                    removed (matches the DEM row above) — content shifts left. */}
                                <div style={{flex: 1, minWidth: 0}}>
                                    <MenuRow layer={hillshadeLayer} extraToolbarActions={hillshadeExtraActions} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
}

class TerrainListWithDragDrop extends React.Component {
    static propTypes = {
        terrainGroups: PropTypes.array.isRequired,  // [{terrain, demLayer, hillshadeLayer}]
        expandedIds: PropTypes.instanceOf(Set),
        onToggleExpand: PropTypes.func,
        onReorder: PropTypes.func,  // (fromIndex, toIndex)
        // TASK-1720/1721 rendering-mode + contour toggles (merged 5.x→epic 2026-06-15)
        canEdit: PropTypes.bool,
        flatLayers: PropTypes.array,            // map flat layers — authoritative for contour-in-map
        localContoursEnabled: PropTypes.object, // {demLayerName: bool} local optimistic toggle state
        onStylingModeChange: PropTypes.func,
        onContoursToggle: PropTypes.func,
        onChangeTerrainLayerProperties: PropTypes.func // master vis/opacity → each child layer
    };

    constructor(props) {
        super(props);
        this.state = { dragFromIndex: null, dragOverIndex: null };
    }

    handleDragStart(index) {
        this.setState({ dragFromIndex: index, dragOverIndex: null });
    }

    handleDragOver(index) {
        if (this.state.dragFromIndex !== null && this.state.dragOverIndex !== index) {
            this.setState({ dragOverIndex: index });
        }
    }

    handleDrop(toIndex) {
        const { dragFromIndex } = this.state;
        if (dragFromIndex !== null && dragFromIndex !== toIndex) {
            // Pass terrainGroups so the handler can compute the full new ordering.
            this.props.onReorder && this.props.onReorder(this.props.terrainGroups, dragFromIndex, toIndex);
        }
        this.setState({ dragFromIndex: null, dragOverIndex: null });
    }

    handleDragEnd() {
        this.setState({ dragFromIndex: null, dragOverIndex: null });
    }

    render() {
        const {
            terrainGroups, expandedIds, onToggleExpand,
            canEdit, flatLayers, localContoursEnabled,
            onStylingModeChange, onContoursToggle, onChangeTerrainLayerProperties
        } = this.props;
        const { dragFromIndex, dragOverIndex } = this.state;
        const localContours = localContoursEnabled || {};

        return (
            <div className="sv-terrain-hierarchy-list">
                {terrainGroups.map((group, idx) => {
                    const demLayer = group.demLayer;
                    // TASK-1721 (W4): derive contour-overlay enabled state — local optimistic
                    // toggle OR the contour layer already present in the map (restored from blob).
                    const contourLayerId = `${demLayer?.name}__contours`;
                    const contoursInMap = (flatLayers || []).some(
                        l => l?.id === contourLayerId || (l?.name === demLayer?.name && l?.style === DEM_CONTOUR_STYLE_NAME)
                    );
                    const contoursEnabled = !!(localContours[demLayer?.name] || contoursInMap);
                    return (
                        <TerrainHierarchyRow
                            key={group.terrain ? group.terrain.id : group.demLayer?.name || idx}
                            terrain={group.terrain || {id: group.demLayer?.name, title: group.demLayer?.title}}
                            terrainModel={group.terrain || null}
                            demLayer={group.demLayer}
                            hillshadeLayer={group.hillshadeLayer}
                            expanded={!!(expandedIds && expandedIds.has(group.terrain?.id))}
                            onToggleExpand={onToggleExpand}
                            canEdit={canEdit}
                            contoursEnabled={contoursEnabled}
                            onStylingModeChange={onStylingModeChange}
                            onContoursToggle={onContoursToggle}
                            onChangeTerrainLayerProperties={onChangeTerrainLayerProperties}
                            dragging={dragFromIndex === idx}
                            dragOver={dragOverIndex === idx && dragFromIndex !== idx}
                            onDragStart={() => this.handleDragStart(idx)}
                            onDragOver={() => this.handleDragOver(idx)}
                            onDrop={() => this.handleDrop(idx)}
                            onDragEnd={() => this.handleDragEnd()}
                        />
                    );
                })}
            </div>
        );
    }
}

// ── end TASK-1652 terrain hierarchy ──────────────────────────────────────────

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
        // TASK-1880 (epic 1884 W2): open the in-app terrain-upload CRS picker.
        setTerrainUploadCrsPanel: PropTypes.func,
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
        // TASK-1652 (W1.5): drag-drop reorder callback.
        onReorderTerrainLayers: PropTypes.func,
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
        onZoomToExtent: PropTypes.func,
        // TASK-1720 (W3): Dynamic/Traditional terrain styling mode toggle
        onChangeTerrainLayerProperties: PropTypes.func,
        // TASK-1751 (#20): re-emit current map view to trigger demRescaleEpic on toggle.
        onNudgeMapView: PropTypes.func,
        // TASK-1721 (W4): Contours overlay toggle
        onAddContourLayer: PropTypes.func,
        onRemoveLayer: PropTypes.func,
        // TASK-1728 (W1.7): surface terrain-upload progress on the W1.5 Tasks Panel.
        onUpdateProcess: PropTypes.func,    // inject/update an optimistic process row
        onOpenTaskMonitor: PropTypes.func,  // open the Tasks Panel so the row is visible
        // TASK-1753 (W1.8) / TASK-1720 (W3): recipe-builder + terrain-row dispatch
        // callbacks wired in mapDispatchToProps and used at runtime.
        onTwLoadData: PropTypes.func,
        onTwSelectSurfaceForTerrain: PropTypes.func,
        // TASK-1800 (W1.9 UAT): open the stand-alone "Merge terrains" panel.
        onOpenMergeTerrainsPanel: PropTypes.func,
        // TASK-2580 (W2-reaim change 3a): close the Inputs menu on the same
        // click — optional (guarded at the call site) so an unconnected/test
        // mount that omits it is safe (mirrors terrainBboxPanel.js's own
        // setAnugaInputMenu propType, which carries no defaultProps entry).
        setAnugaInputMenu: PropTypes.func,
        onUpdateTerrainRow: PropTypes.func
    };

    static defaultProps = {
        // TASK-1800: the "Combined surface" header button calls these
        // unconditionally; default to no-ops so an unconnected/test mount is safe.
        onOpenMergeTerrainsPanel: () => {},
        onTwLoadData: () => {}
    };

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
            // TASK-1652 (W1.5) — terrain hierarchy: Set of terrain model IDs
            // whose derivative rows (hillshade, etc.) are expanded.
            expandedTerrainIds: new Set(),
            // TASK-1721 (W4) — per-terrain contour overlay enabled state.
            // Keyed by DEM layer name (bare, without 'geonode:' prefix).
            contoursEnabled: {}
            // TASK-1728 (W1.7) originally held terrainUpload latch state here.
            // TASK-1892 (epic 1884 W3): removed — the upload latch moved verbatim
            // into TerrainUploadCrsPanel.state (TASK-1880) and this dead object
            // was never read after TASK-1880 landed.
        };
        this._meshPreviewPollTimer = null;
        this._meshPreviewPollCount = 0;
        // TASK-1729: hidden <input type="file"> the upload glyph triggers.
        this._terrainFileInputRef = React.createRef();
    }

    // TASK-1728 (W1.7) — direct-to-S3 presigned-PUT terrain upload.
    // Open the OS file picker; the actual upload runs in _onTerrainFileSelected.
    _openTerrainFilePicker = () => {
        const input = this._terrainFileInputRef.current;
        if (input) {
            input.value = '';   // allow re-selecting the same file after a previous run
            input.click();
        }
    };

    // TASK-1728: inject/update the OPTIMISTIC Tasks-Panel row for this upload.
    // Keyed on the REAL BE process_id once presign returns (so the polled BE
    // Process merges onto it with no duplicate); a synthetic id is used only for
    // the pre-presign error case (no real Process exists yet). process_type is
    // 'terrain_create' to match the BE Process (ProcessRow's terrain icon).
    _emitTerrainUploadProcess = (id, fields) => {
        if (!this.props.onUpdateProcess) return;
        const now = new Date().toISOString();
        this.props.onUpdateProcess({
            id,
            process_type: 'terrain_create',
            created: now,
            updated: now,
            subtasks: [],
            log: '',
            ...fields
        });
    };

    // TASK-1880 (epic 1884 W2 — THE HEADLINE): the upload glyph / starter CTA no
    // longer run the byte transfer directly. A file is chosen → OPEN the in-app CRS
    // picker (TerrainUploadCrsPanel, mounted at the anugaContainer level) carrying
    // the File + an auto-title. The picker detects the DEM's CRS (cheap header
    // read), requires a SOURCE CRS only when the raster lacks one, and runs the
    // presign → PUT → finalize chain itself on Confirm (forwarding the picked CRS as
    // `crs_override`). This replaces the MissingCRSError QGIS dead-end with in-app
    // recovery. The earlier TASK-1728 inline upload orchestration moved verbatim
    // into the panel; the no-project guard stays here so a bad invocation still
    // surfaces a synthetic Tasks-Panel error row.
    _onTerrainFileSelected = (event) => {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return;
        const projectId = this.props.projectId;
        if (!projectId) {
            // No real BE Process — surface a synthetic error row on the Tasks Panel.
            const name = `Terrain upload: ${file.name}`;
            if (this.props.onOpenTaskMonitor) this.props.onOpenTaskMonitor(true);
            this._emitTerrainUploadProcess(`terrain-upload-${Date.now()}`, {
                name, status: 'error', status_detail: null, error_message: 'No project selected.'
            });
            return;
        }
        // Auto-title = filename minus extension (the panel pre-fills the editable
        // title field with it). Open the CRS picker; the upload runs on Confirm.
        const title = (file.name || '').replace(/\.[^.]+$/, '') || file.name;
        if (this.props.setTerrainUploadCrsPanel) this.props.setTerrainUploadCrsPanel(true, file, title);
        trackEvent('button', 'click', 'anuga-terrain-crs-picker-open');
    };

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
                className="row sv-menu-row sv-anuga-section-empty-row"
                aria-busy={isInitializing ? "true" : undefined}
                aria-live={isInitializing ? "polite" : undefined}
            >
                {isInitializing ? (
                    <React.Fragment>
                        <Spinner color="#888" className="sv-anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                        <span className={"sv-anuga-pending-status"}>
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
            <div className="row sv-menu-row sv-anuga-section-empty-row sv-anuga-terrain-empty-help">
                <Message msgId="hydrata.anuga.noTerrainHelp" />
            </div>
        );
    }

    renderPendingRow(item, idx) {
        return (
            <div
                key={`pending-${item?.id || idx}`}
                className={"row sv-menu-row sv-anuga-pending-row"}
                aria-busy="true"
                aria-live="polite"
            >
                <Spinner color="#888" className="sv-anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                <span className={"sv-anuga-pending-title"}>{item?.title}</span>
                <span className={"sv-anuga-pending-status"}>
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
                    className={`btn glyphicon sv-menu-row-glyph sv-glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                    onClick={() => this.handleCreateClick(catId, titleKey, createFn, trackEventName)}
                    aria-label={inputVisible ? "Save" : "Add new"}
                />
                {this.props.isCreatingAnugaLayer ? (
                    <Spinner color="white" className="sv-anuga-spinner" spinnerName="circle" noFadeIn/>
                ) : inputVisible ? (
                    <input
                        id={inputId}
                        key={inputId}
                        className={'sv-data-title-input'}
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
            <div className="sv-anuga-pane-toolbar">
                <h3 className="sv-anuga-pane-head-title">
                    <Message msgId={cat.titleMsgId} />
                </h3>
                {actions ? (
                    <span className="sv-anuga-pane-head-actions">{actions}</span>
                ) : null}
            </div>
        );
    }

    // TASK-1652 (W1.5): build the ordered terrain groups for hierarchy rendering.
    // Each entry: { terrain: model|null, demLayer, hillshadeLayer: layer|null }
    // Analysis surface outputs (layers in Terrain group with no terrainModel match) = parent rows.
    _buildTerrainGroups() {
        const terrainLayers = this.props.terrainLayers || [];
        // epic 2323 / TASK-2327: hide a terrain SUPERSEDED by a datum-shift conversion —
        // the converted EGM2008 terrain replaces it, so the list shows ONE set (not the
        // ellipsoid original + its conversion). Also keep the superseded model's now-orphan
        // layers out of the stand-alone-row pickup further down.
        const allTerrainModels = this.props.terrainModels || [];
        const supersededLayerNames = new Set();
        allTerrainModels.forEach(m => {
            if (m && m.metadata && m.metadata.superseded_by) {
                [m.gn_layer_name, m.gn_layer_hillshade_name].filter(Boolean).forEach(n => {
                    supersededLayerNames.add(n);
                    supersededLayerNames.add(`geonode:${n}`);
                });
            }
        });
        const terrainModels = allTerrainModels.filter(m => !(m && m.metadata && m.metadata.superseded_by));

        // BUG-5 (UAT) — name-matching parity with demRescaleEpic.js:153-154. The
        // serializer's gn_layer_name is the BARE GeoNode dataset name (e.g.
        // 'ele_7_grand_canyon'), but a map layer's `name` can carry the workspace
        // prefix ('geonode:ele_7_grand_canyon'). The old strict `l.name === gn_layer_name`
        // match therefore resolved demLayer=null for namespaced layers, so the parent
        // row showed the pending placeholder AND the Mode toggle (gated only on
        // terrainModel.id) silently no-opped on click — _handleTerrainStylingModeChange
        // early-returns when mapLayer.id is missing → the dead "Switch to Dynamic" button.
        // Match either form, mirroring the epic's predicate.
        const layerNameMatches = (layer, gnName) =>
            !!layer && !!gnName && (layer.name === gnName || layer.name === `geonode:${gnName}`);

        // Collect all layer names that are known hillshades (to exclude from parent rows).
        const hillshadeNames = terrainModels.map(m => m.gn_layer_hillshade_name).filter(Boolean);
        const isKnownHillshade = (layer) => hillshadeNames.some(hn => layerNameMatches(layer, hn));

        // Build groups in terrain model order (preserves current layer z-order).
        const groups = [];
        const consumedNames = new Set();

        terrainModels.forEach(model => {
            const demLayer = terrainLayers.find(l => layerNameMatches(l, model.gn_layer_name)) || null;
            const hillshadeLayer = model.gn_layer_hillshade_name
                ? terrainLayers.find(l => layerNameMatches(l, model.gn_layer_hillshade_name)) || null
                : null;
            if (demLayer) consumedNames.add(demLayer.name);
            if (hillshadeLayer) consumedNames.add(hillshadeLayer.name);
            // Only include group if there's a visible DEM layer (or the model exists, pending publish).
            groups.push({ terrain: model, demLayer, hillshadeLayer });
        });

        // Remaining terrain layers not matched to a model (analysis surface outputs,
        // or model rows not yet fetched) become stand-alone parent rows.
        terrainLayers
            .filter(l => !consumedNames.has(l.name) && !isKnownHillshade(l) && !supersededLayerNames.has(l.name))
            .forEach(l => {
                groups.push({ terrain: null, demLayer: l, hillshadeLayer: null });
            });

        return groups;
    }

    // TASK-1800 (W1.9 UAT live-fix 2026-06-18): the former _handleSelectTerrainRow
    // (open the Merge-terrains panel + load + select-source-surface on terrain-row
    // expand, TASK-1753) was REMOVED. Expanding a terrain group is now pure
    // disclosure (see TerrainHierarchyRow.handleRowSelect); the "Combined surface"
    // panel is opened only by its header button (renderTerrainPane, below), which
    // dispatches onOpenMergeTerrainsPanel() + onTwLoadData() itself.

    // TASK-1720 (W3): Toggle Dynamic/Traditional styling mode for a single terrain.
    // 1. AWAIT the BE PATCH so we know whether to proceed.
    // 2. On SUCCESS: update state.anuga.resources.terrain (so findDynamicDemPairs
    //    reads the new mode on the very next CHANGE_MAP_VIEW without re-fetching),
    //    then apply the map-layer change and persist the blob.
    // 3. On FAILURE: leave UI unchanged and surface a warning — no partial update.
    _handleTerrainStylingModeChange = (terrainModel, mapLayer, newMode) => {
        const projectId = this.props.projectId;
        if (!projectId || !terrainModel?.id || !mapLayer?.id) return;
        patchTerrainStylingMode(projectId, terrainModel.id, newMode)
            .then(() => {
                // Sync the Redux terrain row immediately so findDynamicDemPairs
                // reads the correct styling_mode on the next CHANGE_MAP_VIEW.
                this.props.onUpdateTerrainRow(terrainModel.id, { styling_mode: newMode });
                if (newMode === 'traditional') {
                    // Traditional: drop env= from params, set singleTile:false so GWC
                    // WMTS tiled path activates on the next map render. The
                    // gwcCatalogRouting / routeLayerTileSource will route tiles to GWC
                    // because there is no params.env on the layer.
                    const updatedParams = Object.assign({}, mapLayer.params || {});
                    delete updatedParams.env;
                    delete updatedParams._v_;
                    this.props.onChangeTerrainLayerProperties(mapLayer.id, {
                        singleTile: false,
                        params: updatedParams
                    });
                } else {
                    // Dynamic: mark singleTile:true so the rescale GetMap is a single
                    // fresh ImageWMS request (not a GWC tile grid).
                    this.props.onChangeTerrainLayerProperties(mapLayer.id, { singleTile: true });
                    // TASK-1751 (#20) — demRescaleEpic keys ONLY on CHANGE_MAP_VIEW,
                    // which OpenLayers fires solely on a pan/zoom moveend. Stamping
                    // singleTile:true does NOT emit CHANGE_MAP_VIEW, so before this fix
                    // switching to Dynamic produced NO visible restyle until the
                    // modeller happened to pan the map. Re-emit the CURRENT map view so
                    // the epic runs immediately and stamps env= for the new dynamic DEM.
                    // (Mirrors MapStore2 identify.js:316 restore-position re-emit.)
                    this.props.onNudgeMapView();
                }
                // BUG (#8) — styling_mode is the ONLY thing that must persist, and it
                // persists via the patchTerrainStylingMode() BE call above (the source
                // of truth that findDynamicDemPairs/demRescaleEpic reconstruct from on
                // every map load), NOT via a map-blob save. The old
                // this.props.onSaveMap() here dispatched saveDirectContent() → a full
                // PATCH /api/v2/maps/<id>/?include[]=data on every Mode toggle (a silent
                // map save the modeller never asked for), and it persisted the transient
                // singleTile/env= params into the blob. Those params are reconstructed
                // from styling_mode on load by demRescaleEpic (which stamps
                // singleTile:true + env= for every dynamic terrain on the initial
                // CHANGE_MAP_VIEW), so saving them is both unnecessary and a source of
                // stale-param drift. Mirrors _handleContoursToggle, which dropped its
                // onSaveMap() for the same reason. Do NOT save the map resource here.
            })
            .catch((err) => {
                // BE PATCH failed — do NOT apply the FE layer change. The UI
                // re-renders from Redux state (which is unchanged) so the
                // toggle shows the correct prior mode automatically.
                // eslint-disable-next-line no-console
                console.warn('[anugaInputMenu] patchTerrainStylingMode failed; leaving mode unchanged:', err && (err.message || err));
            });
    };

    // TASK-1721 (W4) / TASK-1829 (W2): Toggle the live ras:Contour overlay for a terrain DEM.
    //
    // On ENABLE:
    //   1. Build the contour layer config via buildContourLayer (DIRECT WMS /geoserver/ows,
    //      STYLES=dem_contours, env=contourInterval/contourMajor, singleTile, type=wms) —
    //      intentionally NON-shareable (the env= dynamic render is not GWC-cacheable).
    //   2. Dispatch addLayer to add it ABOVE the colormap in the map (MapStore2 adds to top).
    //   3. Persist the map blob via saveDirectContent.
    //
    // On DISABLE:
    //   1. Dispatch removeLayer with the contour layer's id (<demLayerName>__contours).
    //   2. Persist the map blob.
    //
    // State is local (this.state.contoursEnabled keyed by layer name) for immediate UI
    // feedback.  The flatLayers prop is authoritative for whether the contour layer is
    // actually in the map — state is reset if the layer is absent (e.g. after map reload).
    //
    // TASK-1721 (W4 review FIX D): accept the DERIVED enabled state as a parameter
    // (computed in renderTerrainPane from flatLayers) instead of reading
    // this.state.contoursEnabled directly.  After a page reload the local state is
    // reset to {} while the contour layer IS still in flatLayers (restored from the saved
    // map blob), so reading this.state would always take the "enable" branch and add a
    // duplicate layer.  Passing the derived value mirrors the W3 mode-toggle pattern.
    _handleContoursToggle = (demLayerName, currentlyEnabled, terrainModel) => {
        if (!demLayerName) return;
        if (!currentlyEnabled) {
            // Enable: add the contour overlay layer.
            const token = getToken ? getToken() : null;
            // TASK-1829 (W2): compute a FE-static "nice" interval from the DEM's
            // stored elevation range (TerrainSerializerV2 surfaces dem_elev_min/max),
            // so a low-relief flood DEM draws sensible lines instead of zero at the
            // legacy fixed 100 m literal. If the range is not reachable, fall back to
            // 100 (niceContourInterval's own default for unknown/0 relief).
            // TASK-1829 follow-up: server-adaptive interval (deferred).
            const elevMin = terrainModel?.dem_elev_min;
            const elevMax = terrainModel?.dem_elev_max;
            const relief = (typeof elevMin === 'number' && typeof elevMax === 'number')
                ? (elevMax - elevMin)
                : NaN;
            // TASK-1829 re-aim (operator UAT 2026-06-20): divide the nice base interval
            // (niceContourInterval snaps UP to a round number, which biases sparse) by a
            // density factor for much denser lines. No labels, so the non-round interval
            // is fine. Factor 10 = ~10x more lines than the nice base.
            const CONTOUR_DENSITY_FACTOR = 10;
            const base = niceContourInterval(relief);
            const interval = Math.round((base / CONTOUR_DENSITY_FACTOR) * 10) / 10;
            const contourLayer = buildContourLayer(demLayerName, token, interval);
            this.props.onAddContourLayer(contourLayer);
            this.setState(prev => ({
                contoursEnabled: {...prev.contoursEnabled, [demLayerName]: true}
            }));
        } else {
            // Disable: remove the contour overlay layer by its id.
            const contourLayerId = `${demLayerName}__contours`;
            this.props.onRemoveLayer(contourLayerId);
            this.setState(prev => ({
                contoursEnabled: {...prev.contoursEnabled, [demLayerName]: false}
            }));
        }
        // BUG-6 (UAT) — the contour overlay is a PURELY VISUAL view-state toggle, so
        // it must NOT persist the map. The old `this.props.onSaveMap()` here dispatched
        // saveDirectContent() → a full `PATCH /api/v2/maps/<id>/?include[]=data` on every
        // Show/Hide Contours click (a silent map save the modeller never asked for).
        // addLayer/removeLayer already mutate the live map in Redux for immediate
        // feedback; visibility is ephemeral and is re-derived from flatLayers on the
        // next mount. Do NOT save the map resource here.
    };

    // TASK-1728 (W1.7): the direct-to-S3 terrain upload no longer renders an inline
    // progress strip here. Progress + success + failure all surface on the W1.5
    // Tasks Panel (see _onTerrainFileSelected → _emitTerrainUploadProcess), so the
    // upload is non-blocking and the modeller keeps working. The legacy
    // _renderTerrainUploadProgress / _dismissTerrainUpload helpers are removed.

    renderTerrainPane() {
        const layers = this.props.terrainLayers || [];
        const canEdit = this.props.canEditAnugaMap;
        const actions = (
            <React.Fragment>
                {/* Ad-hoc design fix 2026-07-13: the three terrain-source header icons
                    run local → global → combine, left to right, matching the workflow
                    (upload your own DEM, else pull a global one, then combine). All
                    three are icon-only with hover tooltips.
                    1) Upload local DEM (TASK-1729 W1.7 direct-to-S3 presigned PUT). */}
                <OverlayTrigger placement="bottom" overlay={<Tooltip id="anuga-terrain-upload-tooltip" style={PANE_TOOLTIP_STYLE}><Message msgId="hydrata.anuga.uploadTerrainTooltip" /></Tooltip>}>
                    <span
                        className={"btn glyphicon sv-menu-row-glyph sv-glyph-active glyphicon-upload"}
                        data-testid="anuga-terrain-upload-button"
                        onClick={() => {
                            // TASK-1729 (W1.7): direct-to-S3 presigned-PUT upload —
                            // open the file picker instead of the legacy synchronous
                            // multipart uploader panel (which died at harakiri=120).
                            this._openTerrainFilePicker();
                            trackEvent('button', 'click', 'anuga-input-menu-show-terrain-uploader');
                        }}
                    />
                </OverlayTrigger>
                {/* 2) Download global DEM — draw a bbox, pull Copernicus GLO-30. */}
                <OverlayTrigger placement="bottom" overlay={<Tooltip id="anuga-terrain-global-dem-tooltip" style={PANE_TOOLTIP_STYLE}><Message msgId="hydrata.anuga.globalDemTooltip" /></Tooltip>}>
                    <span
                        className={"btn glyphicon sv-menu-row-glyph sv-glyph-active glyphicon-globe"}
                        data-testid="anuga-terrain-global-dem-button"
                        onClick={() => {
                            this.props.setVisibleTerrainBboxPanel(true);
                            trackEvent('button', 'click', 'anuga-input-menu-show-terrain-bbox-picker');
                        }}
                    />
                </OverlayTrigger>
                {/* 3) Combine surface — opens the stand-alone recipe-builder side
                    panel. Custom layered-mountain + cog SVG (no glyphicon class);
                    sv-glyph-active colours it limegreen via currentColor and
                    sv-menu-row-glyph centres the svg. NOT gated by canEdit, matching
                    the globe/upload icons. Icon-only with a hover tooltip (ad-hoc
                    design fix 2026-07-13 dropped the visible text label TASK-2205 had
                    added; the tooltip now carries the affordance). */}
                <OverlayTrigger placement="bottom" overlay={<Tooltip id="anuga-terrain-combined-surface-tooltip" style={PANE_TOOLTIP_STYLE}><Message msgId="hydrata.anuga.combinedSurfaceTooltip" /></Tooltip>}>
                    <span
                        className={"btn sv-menu-row-glyph sv-glyph-active"}
                        data-testid="anuga-terrain-merge-panel-button"
                        onClick={() => {
                            this.props.onOpenMergeTerrainsPanel();
                            this.props.onTwLoadData();
                            // TASK-2580 (W2-reaim change 3a): close/unhighlight the
                            // parent Inputs menu — the panel is mounted at the
                            // anugaContainer level so this can't unmount it.
                            if (this.props.setAnugaInputMenu) this.props.setAnugaInputMenu(false);
                            trackEvent('button', 'click', 'anuga-input-menu-open-merge-terrains');
                        }}
                    >
                        <MergeTerrainsIcon/>
                    </span>
                </OverlayTrigger>
                {/* TASK-1729: hidden file input driven by the upload glyph. */}
                <input
                    ref={this._terrainFileInputRef}
                    type="file"
                    accept=".tif,.tiff,image/tiff"
                    data-testid="anuga-terrain-file-input"
                    style={{display: 'none'}}
                    onChange={this._onTerrainFileSelected}
                />
            </React.Fragment>
        );
        // TASK-1800 (W1.9 UAT): the recipe-builder state/dispatch props are no
        // longer read here — the recipe builder is the stand-alone "Merge terrains"
        // side panel (MergeTerrainsPanel, mounted at the anugaContainer level). The
        // Terrain pane now only opens it (the "Combined surface" header button).

        // TASK-1652 (W1.5): build terrain groups for hierarchical rendering.
        const terrainGroups = this._buildTerrainGroups();
        const { expandedTerrainIds } = this.state;

        return (
            <div className="sv-menu-rows-pane sv-anuga-pane">
                {this.renderPaneHead('terrain', actions)}
                {/* TASK-1728 (W1.7): the terrain upload is non-blocking — its progress,
                    success, and failure surface on the W1.5 Tasks Panel, not here. */}
                <div className="sv-anuga-pane-rows">
                    {terrainGroups.length > 0 ? (
                        <TerrainListWithDragDrop
                            terrainGroups={terrainGroups}
                            expandedIds={expandedTerrainIds}
                            onToggleExpand={(terrainId) => {
                                const next = new Set(expandedTerrainIds);
                                if (next.has(terrainId)) { next.delete(terrainId); } else { next.add(terrainId); }
                                this.setState({ expandedTerrainIds: next });
                            }}
                            onReorder={this.props.onReorderTerrainLayers}
                            /* Merge (5.x→epic 2026-06-15): TASK-1720/1721 per-DEM Mode +
                               Contours toggles, folded into the hierarchy rows — they used
                               to live on the flat layers.map list that TASK-1652 replaced. */
                            canEdit={canEdit}
                            flatLayers={this.props.flatLayers}
                            localContoursEnabled={this.state.contoursEnabled}
                            onStylingModeChange={this._handleTerrainStylingModeChange}
                            onContoursToggle={this._handleContoursToggle}
                            onChangeTerrainLayerProperties={this.props.onChangeTerrainLayerProperties}
                        />
                    ) : null}
                    {layers.length === 0 ? this.renderTerrainEmpty() : null}
                </div>
                {/* TASK-1800 (W1.9 UAT): the inline "Analysis Surfaces" expandable
                    recipe section was REMOVED. The recipe builder is now the
                    stand-alone "Merge terrains" side panel (MergeTerrainsPanel),
                    opened by the header button (or by selecting a derived terrain
                    row) and mounted at the anugaContainer level. */}
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
            <div className="sv-menu-rows-pane sv-anuga-pane">
                {this.renderPaneHead(catId, actions)}
                <div className="sv-anuga-pane-rows">
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
            <div className="sv-menu-rows-pane sv-anuga-pane">
                {this.renderPaneHead('meshRegions', createActions)}
                <div className="sv-anuga-pane-rows">
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
            <OverlayTrigger placement="bottom" overlay={<Tooltip id="anuga-friction-raster-upload-tooltip" style={PANE_TOOLTIP_STYLE}><Message msgId="hydrata.anuga.uploadFrictionRasterTooltip" /></Tooltip>}>
                <span
                    className={"btn glyphicon sv-menu-row-glyph sv-glyph-active glyphicon-upload"}
                    onClick={() => {
                        this.props.setVisibleUploaderPanel(true, "friction_raster", null);
                        trackEvent('button', 'click', 'anuga-input-menu-show-friction-raster-uploader');
                    }}
                />
            </OverlayTrigger>
        );
        return (
            <div className="sv-menu-rows-pane sv-anuga-pane">
                {this.renderPaneHead('frictionRasters', actions)}
                <div className="sv-anuga-pane-rows">
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

    // TASK-1755 (W1.8): Culvert pane — there is NO dedicated culvert PANEL
    // component yet, so this is a clean BLANK placeholder (standard Inputs-pane
    // chrome + the translated heading + a short empty-state hint). Culverts are
    // still DRAWN on the map via the VectorDraw WFST path (culvertTranslate.js),
    // which is wired independently of this pane — so the placeholder does not
    // regress draw. Before this arm existed, selecting Culvert fell through to
    // `default:` and showed the Terrain pane.
    renderCulvertPane() {
        return (
            <div className="sv-menu-rows-pane sv-anuga-pane">
                {this.renderPaneHead('culverts', null)}
                <div className="sv-anuga-pane-rows">
                    <div className="row sv-menu-row sv-anuga-section-empty-row">
                        <Message msgId="hydrata.anuga.culvertPlaceholder" />
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
        // TASK-1755 (W1.8): 'culverts' renders a blank placeholder pane (no
        // dedicated panel exists yet); previously fell through to the Terrain pane.
        case 'culverts':        return this.renderCulvertPane();
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
            <div id={'anuga-input-menu'} className={'simple-view-panel sv-anuga-panel simple-view-panel--miller'}>
                {this.props.starterPhase &&
                    <AnugaInputStarterCard
                        phase={this.props.starterPhase}
                        // TASK-1728 (W1.7): the starter "Upload terrain" CTA opens the
                        // direct-to-S3 file picker (non-blocking, surfaces on the Tasks
                        // Panel) — NOT the legacy blocking 'Upload Terrain File' modal.
                        // The hidden file input is mounted by renderTerrainPane(), which
                        // runs in the starter (no-projection) phase.
                        onUploadTerrain={() => this._openTerrainFilePicker()}
                        onImportFromWeb={() => {
                            // TASK-1646: open GLO-30 import panel directly.
                            this.props.setVisibleTerrainBboxPanel(true);
                            trackEvent('button', 'click', 'anuga-starter-import-from-web-click');
                        }}
                    />
                }
                <div className={'sv-menu-rows-container'}>
                    {hasProjection ? (
                        <div className={'sv-rail-pane-shell'}>
                            {this.renderRail()}
                            {this.renderPane()}
                        </div>
                    ) : (
                        this.renderTerrainPane()
                    )}
                </div>
                {/* TASK-1728 (W1.7): this shared UploaderPanel is now reached ONLY by the
                    friction_raster pane (setVisibleUploaderPanel(true, "friction_raster")) —
                    the live config is driven by state.simpleView.importerConfigKey, not the
                    fileType prop. The TERRAIN upload no longer opens this modal; it uses the
                    direct-to-S3 file picker that surfaces on the Tasks Panel. The fileType
                    default is harmless (overridden by importerConfigKey on open). */}
                <UploaderPanel fileType={'terrain'}/>
                {/* BUG (UAT, TASK-1648 regression): <TerrainBboxPanel/> moved to
                    anugaContainer.js so closing the Inputs menu (which 'Define
                    import area' does) no longer unmounts it mid-draw. */}
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
        twDeriveError: state?.terrainWorkbench?.deriveError || null
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
        // TASK-1880 (epic 1884 W2): open the in-app terrain-upload CRS picker with
        // the picked File + auto-title (the picker runs the upload on Confirm).
        setTerrainUploadCrsPanel: (visible, file, title) => dispatch(setTerrainUploadCrsPanel(visible, file, title)),
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
        // TASK-1652 (W1.5): terrain hierarchy drag-drop reorder.
        // terrainGroups is the ordered list [{terrain, demLayer, hillshadeLayer}].
        // fromIndex/toIndex are the drag-source and drop-target positions.
        // Uses a thunk to read state.layers.groups at dispatch time so the
        // sortNode index mapping is computed against the CURRENT node order.
        onReorderTerrainLayers: (terrainGroups, fromIndex, toIndex) => {
            if (fromIndex === toIndex || terrainGroups.length < 2) return;
            dispatch((dispatchThunk, getState) => {
                // Compute the desired terrain group ordering.
                const reordered = terrainGroups.slice();
                const [moved] = reordered.splice(fromIndex, 1);
                reordered.splice(toIndex, 0, moved);

                // Get current group nodes from Redux state — both to build the sortNode
                // index array AND to detect which contour overlays are currently in the map.
                const state = getState();
                const terrainGroupNode = getNode(state?.layers?.groups || [], 'Input Data.Terrain');
                const currentNodes = terrainGroupNode?.nodes || [];
                const currentNodeIds = new Set(currentNodes.map(n => n.id || n));

                // Build the desired flat order of layer IDs: DEM, then hillshade, then the
                // contour overlay per group. The contour overlay is a Terrain derivative
                // (glossary) that lives in the Terrain group as `<demName>__contours` when
                // the modeller has enabled it — include it adjacent to its parent so the
                // derivative rides along on reorder (otherwise it would be left behind and
                // force the partial moveNode fallback). Resolve the contour by the SAME
                // dual predicate the row uses (conventional id OR style match) so one
                // restored-from-blob with a non-conventional id still rides along; guarded
                // on the resolved node actually being in the Terrain group.
                const flat = state?.layers?.flat || [];
                const desiredIds = [];
                reordered.forEach(group => {
                    if (group.demLayer) desiredIds.push(group.demLayer.id);
                    if (group.hillshadeLayer) desiredIds.push(group.hillshadeLayer.id);
                    const demName = group.demLayer?.name;
                    if (demName) {
                        const contour = flat.find(
                            l => l?.id === `${demName}__contours` || (l?.name === demName && l?.style === DEM_CONTOUR_STYLE_NAME)
                        );
                        if (contour && currentNodeIds.has(contour.id)) desiredIds.push(contour.id);
                    }
                });

                // Build the sortNode `order` array: order[i] = index of the node that
                // should be at position i in the new ordering.
                // sortNode.reducer: reorderedNodes = order.map(idx => nodes[idx])
                // so order[i] must be the CURRENT index of the desired i-th node.
                const order = desiredIds
                    .map(id => currentNodes.findIndex(n => (n.id || n) === id))
                    .filter(idx => idx !== -1);

                if (order.length === currentNodes.length) {
                    // All nodes accounted for: emit a single sortNode action.
                    // TASK-1752 (W1.8) REGRESSION FIX: the SORT_NODE reducer invokes the
                    // sortLayers callback as sortLayers(newGroups, state.flat) where
                    // newGroups is the WHOLE reordered state.groups TREE (deepChange returns
                    // the full top-level groups array, not just the terrain group's nodes).
                    // The old hand-rolled callback assumed its first arg was the reordered
                    // terrain-node array, so `new Set(newGroupNodes.map(n => n.id || n))`
                    // collected the TOP-LEVEL GROUP ids ('Input Data', 'Results') instead of
                    // terrain LAYER ids → nonTerrain kept every layer, newTerrain was empty →
                    // state.flat was returned UNCHANGED. state.groups reordered (so the tree
                    // re-rendered) but flat — which drives map z-order AND is what
                    // saveDirectContent persists — never moved, so the reorder "didn't land".
                    // Use the canonical LayersUtils.sortLayers, which rebuilds flat from the
                    // full groups tree (the exact callback MapStore2's own TOC DnD passes via
                    // sortUsing(sortLayers, sortNode)). Because flat is rebuilt purely from the
                    // reordered terrain group node order, a DEM moves TOGETHER with its nested
                    // hillshade + contour derivatives as a group.
                    dispatchThunk(sortNode('Input Data.Terrain', order, sortLayers));
                } else {
                    // Partial match (some layers pending): fall back to sequential moveNode.
                    // This is safe for a small number of nodes.
                    desiredIds.forEach((id, idx) => {
                        dispatchThunk(moveNode(id, 'Input Data.Terrain', idx));
                    });
                }
                dispatchThunk(saveDirectContent());
            });
        },
        // TASK-1800 (W1.9 UAT): open the stand-alone "Merge terrains" side panel.
        onOpenMergeTerrainsPanel: () => dispatch(setTerrainWorkbenchVisible(true)),
        // TASK-2580 (W2-reaim change 3a): close the Inputs menu on the same click.
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        // TASK-1645 (W1.5) / TASK-1671 (W1.6) — recipe builder actions.
        onTwLoadData: () => dispatch(twLoadData()),
        onTwSelectSurface: (id) => dispatch(twSelectSurface(id)),
        // TASK-1753 (W1.8): select a derived terrain's source recipe by terrain id.
        onTwSelectSurfaceForTerrain: (terrainId) => dispatch(twSelectSurfaceForTerrain(terrainId)),
        onTwCreateSurface: (payload) => dispatch(twCreateSurface(payload)),
        onTwUpdateSurface: (id, payload) => dispatch(twUpdateSurface(id, payload)),
        onTwDeleteSurface: (id) => dispatch(twDeleteSurface(id)),
        // TASK-1671: twDerive now carries the atomic body {inputs, params}.
        onTwDerive: (id, body) => dispatch(twDerive(id, body)),
        // TASK-1720 (W3): Dynamic/Traditional terrain styling mode toggle
        onChangeTerrainLayerProperties: (layerId, props) => dispatch(changeLayerProperties(layerId, props)),
        // TASK-1720 (W3) fix: sync terrain Redux row after successful PATCH so
        // findDynamicDemPairs reads the new styling_mode without a full initAnuga.
        onUpdateTerrainRow: (id, fields) => dispatch(updateTerrainRow(id, fields)),
        // TASK-1751 (#20): re-emit the CURRENT map view so demRescaleEpic (which keys
        // ONLY on CHANGE_MAP_VIEW) fires immediately after a Dynamic toggle instead of
        // waiting for the next manual pan/zoom. Reads the live map state via the thunk's
        // getState so we forward the real center/zoom/bbox (mirrors MapStore2
        // identify.js:316). No-op if the map view is not yet populated.
        onNudgeMapView: () => dispatch((dispatchThunk, getState) => {
            const map = mapSelector(getState());
            if (!map || !map.center || map.zoom === undefined || map.zoom === null) return;
            dispatchThunk(changeMapView(
                map.center, map.zoom, map.bbox, map.size, map.mapStateSource, map.projection
            ));
        }),
        // TASK-1721 (W4): Contours overlay add/remove
        onAddContourLayer: (layer) => dispatch(addLayer(layer)),
        onRemoveLayer: (layerId) => dispatch(removeLayer(layerId)),
        // TASK-1728 (W1.7): surface terrain-upload progress on the W1.5 Tasks Panel.
        // updateProcess injects/merges an optimistic process row (keyed on the BE
        // process_id); toggleTaskMonitorPanel(true) opens the panel so it's visible.
        onUpdateProcess: (process) => dispatch(updateProcess(process)),
        onOpenTaskMonitor: (open) => dispatch(toggleTaskMonitorPanel(open))
    };
};

const AnugaInputMenu = connect(mapStateToProps, mapDispatchToProps)(AnugaInputMenuClass);

export {AnugaInputMenu, AnugaInputMenuClass};
// TASK-1674: export the presentational TW pieces so the SimpleView-primitive
// conform (ErrorStrip / EmptyState / StatusBadge substitution) can be unit-tested
// in isolation without standing up the connected menu + a mock store.
export {TWStaleBadge, TWRecipeBuilder};
// TASK-1587 (W1.8 P1.7, B2): export the terrain hierarchy row so the
// select-on-expand-only behaviour (collapsing must NOT re-dispatch selection)
// can be unit-tested directly.
export {TerrainHierarchyRow};
// TASK-1752 (W1.8): export the dispatch map so the terrain-reorder thunk
// (onReorderTerrainLayers) can be exercised end-to-end through the REAL layers
// reducer in a unit test — guarding the sortLayers-callback regression that a
// hand-rolled equivalent would miss.
export {mapDispatchToProps};
