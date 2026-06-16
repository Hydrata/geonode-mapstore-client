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
    setVisibleTerrainBboxPanel,
    // TASK-1720 (W3): sync the terrain Redux row after a styling-mode PATCH (merge 5.x→epic).
    updateTerrainRow
} from "../actionsAnuga";
// TASK-1645 (W1.5) / TASK-1671 (W1.6) — recipe builder actions.
import {
    twLoadData,
    twSelectSurface,
    twCreateSurface,
    twUpdateSurface,
    twDeleteSurface,
    twDerive,
} from '../../TerrainWorkbench/actionsTerrainWorkbench';
// TASK-1440 (W9): Networks action creators removed from this file — the Networks
// pane is now a self-contained shared component (shared/NetworksPane.js) that
// carries its own connect() and is rendered in the Hydrology panel.

import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import {UploaderPanel} from "../../SimpleView/components/simpleViewUploader";
// TASK-1674 (1673 rollout, Phase C): conform the Terrain recipe builder onto the
// SimpleView shared primitives — the error blocks (tw-error), the empty hint
// (tw-empty-hint) and the stale pill (terrain-workbench-stale-badge) are now the
// token-backed ErrorStrip / EmptyState / StatusBadge, so the panel stops
// hand-rolling dark-glass chrome. Markup was already reworked (BUG-4 UAT); this
// is a styling conform only.
import {ErrorStrip, EmptyState, StatusBadge} from "../../SimpleView/components/primitives";
// BUG (UAT, TASK-1648 regression): TerrainBboxPanel is now mounted in
// anugaContainer.js (container level), NOT here. 'Define import area' dispatches
// setAnugaInputMenu(false), which unmounts THIS component; when the bbox panel
// lived here it unmounted mid-draw and the map froze in BBOX draw mode with no
// panel to return to. The globe button (setVisibleTerrainBboxPanel(true)) stays.
import AnugaInputStarterCard from "./anugaInputStarterCard";

import {canEditAnugaMap, getProjectId, getSelectedScenario} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
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
import {patchTerrainStylingMode, uploadTerrainDirect} from "../api/anugaApi";
// TASK-1728 (W1.7): the direct-to-S3 terrain upload no longer owns a blocking
// modal or an inline progress strip — its progress lives on the W1.5 Tasks Panel.
// The presign-time Process (created by the BE, TASK-1727) surfaces via polling;
// we inject an OPTIMISTIC row keyed on that same process_id so it appears instantly
// and reflects byte-level progress while the modeller keeps working, then the
// polled BE Process takes over the Uploading -> UTM -> Hillshade -> Style lifecycle.
import {updateProcess, toggleTaskMonitorPanel} from "../../TaskMonitor/actionsTaskMonitor";
// W6 (TASK-1423): shared helper builds the authenticated mesh layer config.
// TASK-1721 (W4): buildContourLayer builds the GWC-cached ras:Contour overlay config.
import {buildMeshTriangleLayer, buildContourLayer, DEM_CONTOUR_STYLE_NAME} from "../gwcTileRouting";
import {getToken} from "../../../../../MapStore2/web/client/utils/SecurityUtils";
// W6 (TASK-1422): MapStore2 utility for computing extent from a GeoJSON object.
import CoordinatesUtils from "../../../../../MapStore2/web/client/utils/CoordinatesUtils";

// ── TASK-1645 (W1.5) / TASK-1671 (W1.6): AnalysisSurface recipe builder ────

// S1 param defaults.
const TW_PARAM_DEFAULTS = {
    feather_width_m: 50,
    target_resolution_m: 5,
    breach_max_cost: 20,
    breach_search_dist: 100,
};

// ── TASK-1671: Client-side output-size estimator ───────────────────────────
//
// Uses the terrain's `bbox_wgs84` [west, south, east, north] (EPSG:4326) and
// `native_resolution_m` (metres) to compute a conservative upper-bound on the
// output pixel count, then converts to bytes (float32 = 4 bytes/pixel).
//
// Union bbox = min/max of all selected terrain bboxes.
// Resolution = target_resolution_m if the user provided it, else finest
//              native_resolution_m among the selected terrains.
//
// lat_m  ≈ 111 320 m/°  (standard constant)
// lon_m  ≈ 111 320 · cos(mean_lat) m/°
//
// Returns { estimatedGB, tooLarge } where tooLarge = estimatedGB > 10.
// Returns null if not enough metadata is available to estimate.
const MAX_OUTPUT_GB = 10;

function estimateOutputSize(selectedInputs, terrains, targetResolutionM) {
    if (!selectedInputs || selectedInputs.length === 0) return null;
    // Collect bbox + resolution for each selected terrain.
    let unionWest = null;
    let unionSouth = null;
    let unionEast = null;
    let unionNorth = null;
    let finestResM = null;

    for (const inp of selectedInputs) {
        const t = terrains.find(x => x.id === inp.terrain_id);
        if (!t) continue;
        const bbox = t.bbox_wgs84;
        const resM = t.native_resolution_m;
        if (bbox && Array.isArray(bbox) && bbox.length === 4) {
            const [w, s, e, n] = bbox;
            if (unionWest === null || w < unionWest) unionWest = w;
            if (unionSouth === null || s < unionSouth) unionSouth = s;
            if (unionEast === null || e > unionEast) unionEast = e;
            if (unionNorth === null || n > unionNorth) unionNorth = n;
        }
        if (typeof resM === 'number' && resM > 0) {
            if (finestResM === null || resM < finestResM) finestResM = resM;
        }
    }

    if (unionWest === null || finestResM === null) return null;

    const effectiveResM = (typeof targetResolutionM === 'number' && targetResolutionM > 0)
        ? targetResolutionM
        : finestResM;

    const meanLat = (unionSouth + unionNorth) / 2;
    const latMPerDeg = 111320;
    const lonMPerDeg = 111320 * Math.cos(meanLat * Math.PI / 180);

    const widthM = Math.abs(unionEast - unionWest) * lonMPerDeg;
    const heightM = Math.abs(unionNorth - unionSouth) * latMPerDeg;
    const areaM2 = widthM * heightM;

    const pixels = areaM2 / (effectiveResM * effectiveResM);
    const bytes = pixels * 4; // float32
    const estimatedGB = bytes / (1024 ** 3);

    return { estimatedGB, tooLarge: estimatedGB > MAX_OUTPUT_GB };
}

function TWStaleBadge({ isStale }) {
    if (!isStale) return null;
    // TASK-1674: the bespoke (and CSS-orphaned) terrain-workbench-stale-badge span is
    // now the shared amber StatusBadge — "stale" reads as a pending/needs-attention
    // pill, exactly the .is-warn palette the old .tw-stale-badge rule chased.
    return (
        <span
            className="terrain-workbench-stale-badge"
            title="Recipe inputs have changed since last derive — re-derive to update"
        >
            <StatusBadge status="pending" label="stale" compact />
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

// TASK-1671: Single ordered DEM stack (replaces design DEMs + regional terrain).
// Stack order: index 0 = top = highest priority (priority value 0).
// Base = last item (highest priority number) — its unmodified toggle is LOCKED false.
// Default-seamless init: only the TOP entry is unmodified=true, all others false.
function TWDemStackPicker({ terrains, inputs, onChange, disabled }) {
    // Enforce the base-always-modifiable invariant: the bottom entry (highest
    // priority number) must always have unmodified=false.
    const enforceBaseInvariant = (stack) => {
        if (stack.length === 0) return stack;
        const lastIdx = stack.length - 1;
        if (stack[lastIdx].unmodified === false) return stack;
        return stack.map((d, i) => i === lastIdx ? { ...d, unmodified: false } : d);
    };

    const addTerrain = (terrainId) => {
        const id = parseInt(terrainId, 10);
        if (!id || inputs.find(d => d.terrain_id === id)) return;
        // New entry appended at the bottom (new base) — always unmodified:false.
        // Existing entries keep their flags; only re-index priority.
        // Default-seamless (top=unmodified, rest=false) applies ONLY when the
        // stack was empty before this add (i.e. this is the first entry).
        const wasEmpty = inputs.length === 0;
        const newEntry = { terrain_id: id, priority: inputs.length, unmodified: false };
        const combined = [...inputs, newEntry];
        const reindexed = combined.map((d, i) => {
            if (wasEmpty) {
                // Single-entry stack: only entry is the base → always modifiable.
                return { ...d, priority: i, unmodified: false };
            }
            // Preserve existing flags; new entry is already unmodified:false.
            return { ...d, priority: i };
        });
        onChange(enforceBaseInvariant(reindexed));
    };
    const remove = (idx) => {
        const next = inputs.filter((_, i) => i !== idx).map((d, i) => ({ ...d, priority: i }));
        onChange(enforceBaseInvariant(next));
    };
    const moveUp = (idx) => {
        if (idx === 0) return;
        const next = [...inputs];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange(enforceBaseInvariant(next.map((d, i) => ({ ...d, priority: i }))));
    };
    const toggleUnmodified = (idx) => {
        // Base row (last) is locked modifiable — cannot be toggled.
        if (idx === inputs.length - 1) return;
        const next = inputs.map((d, i) =>
            i === idx ? { ...d, unmodified: !d.unmodified } : d
        );
        onChange(next);
    };
    const available = terrains.filter(t => !inputs.find(d => d.terrain_id === t.id));
    const baseIdx = inputs.length - 1;
    return (
        <div className="tw-design-inputs">
            {/* #15 (re-UAT): user-facing label is the normal-case "Merge terrains".
                The internal/domain term stays "DEM priority stack". */}
            <label className="tw-label tw-label-normalcase">
                Merge terrains <span className="tw-label-sub">(top = highest priority, bottom = base)</span>
            </label>
            {inputs.map((inp, idx) => {
                const t = terrains.find(x => x.id === inp.terrain_id);
                const isBase = idx === baseIdx;
                const isTop = idx === 0;
                // #14 (re-UAT): bottom entry = BASE, top entry = TOP, any layers in
                // between numbered 1,2,3… with 1 = closest to the TOP.
                const badgeLabel = isBase ? 'BASE' : isTop ? 'TOP' : idx;
                // #16 (re-UAT): the per-entry toggle is a PENCIL/edit affordance.
                // Greyed pencil = "unmodified" (default datum anchor); GREEN pencil =
                // "modifiable" (feather-merge may reconcile it). The base entry carries
                // the SAME pencil for visual consistency but is locked-on (modifiable)
                // because the base can never be unmodified per the domain model.
                // For the base row the effective "modifiable" state is always true.
                const isModifiable = isBase ? true : !inp.unmodified;
                return (
                    <div key={inp.terrain_id} className="tw-design-input-row" data-testid={`dem-stack-row-${inp.terrain_id}`}>
                        <span className="tw-priority-badge" title={isTop ? 'Highest priority' : isBase ? 'Base' : `Priority ${idx + 1}`}>
                            {badgeLabel}
                        </span>
                        <span className="tw-input-title">{t ? (t.title || t.name) : `Terrain #${inp.terrain_id}`}</span>
                        <OverlayTrigger
                            placement="top"
                            overlay={
                                <Tooltip>
                                    {isBase
                                        ? 'modifiable (base always reconciles datum)'
                                        : inp.unmodified ? 'unmodified' : 'modifiable'}
                                </Tooltip>
                            }
                        >
                            <button
                                type="button"
                                className={`tw-icon-btn tw-unmodified-toggle tw-pencil-toggle${isModifiable ? ' tw-modifiable-on' : ''}${inp.unmodified ? ' tw-unmodified-on' : ''}`}
                                onClick={() => toggleUnmodified(idx)}
                                disabled={disabled || isBase}
                                title={isBase ? 'modifiable (locked)' : inp.unmodified ? 'unmodified' : 'modifiable'}
                                aria-label={isBase ? 'modifiable (locked)' : `modifiable: ${isModifiable ? 'on' : 'off'}`}
                                aria-pressed={isModifiable}
                                data-testid={`unmodified-toggle-${inp.terrain_id}`}
                            >
                                <span className="glyphicon glyphicon-pencil" aria-hidden="true" />
                            </button>
                        </OverlayTrigger>
                        <button type="button" className="tw-icon-btn" onClick={() => moveUp(idx)} disabled={disabled || idx === 0} title="Move up">↑</button>
                        <button type="button" className="tw-icon-btn tw-icon-btn-danger" onClick={() => remove(idx)} disabled={disabled} title="Remove">×</button>
                    </div>
                );
            })}
            {available.length > 0 && (
                <select className="tw-select" value="" onChange={(e) => addTerrain(e.target.value)} disabled={disabled} data-testid="dem-stack-add-select">
                    <option value="">+ Add DEM to stack…</option>
                    {available.map(t => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
                </select>
            )}
            {inputs.length === 0 && <div className="tw-validation-hint">At least one DEM is required.</div>}
            {inputs.length > 0 && inputs.every(d => d.unmodified) && (
                <div className="tw-validation-hint">At least one DEM must be modifiable (not unmodified).</div>
            )}
        </div>
    );
}
TWDemStackPicker.propTypes = { terrains: PropTypes.array.isRequired, inputs: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool };
TWDemStackPicker.defaultProps = { disabled: false };

// TASK-1671: Size-confirm dialog shown before derive.
// sizeEstimate = { estimatedGB, tooLarge } | null
function TWDeriveConfirmDialog({ sizeEstimate, onConfirm, onCancel }) {
    const tooLarge = sizeEstimate && sizeEstimate.tooLarge;
    const gbStr = sizeEstimate
        ? sizeEstimate.estimatedGB < 1
            ? `~${(sizeEstimate.estimatedGB * 1024).toFixed(0)} MB`
            : `~${sizeEstimate.estimatedGB.toFixed(1)} GB`
        : null;
    return (
        <div className="tw-derive-confirm-overlay" data-testid="derive-confirm-dialog" role="dialog" aria-modal="true" aria-label="Confirm derive">
            <div className="tw-derive-confirm-box">
                {tooLarge ? (
                    <React.Fragment>
                        <div className="tw-derive-confirm-title tw-derive-confirm-title--error">
                            Cannot derive — estimated output too large
                        </div>
                        <div className="tw-derive-confirm-body">
                            Estimated output size {gbStr} exceeds the 10 GB limit.
                            Reduce the DEM stack extent or increase Target resolution (m).
                        </div>
                        <div className="tw-derive-confirm-actions">
                            <button type="button" className="tw-save-btn" onClick={onCancel} data-testid="derive-confirm-cancel">Close</button>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <div className="tw-derive-confirm-title">Confirm derive</div>
                        <div className="tw-derive-confirm-body">
                            {gbStr
                                ? <React.Fragment>Estimated output size: <strong>{gbStr}</strong>. Proceed?</React.Fragment>
                                : 'Proceed with derive?'}
                        </div>
                        <div className="tw-derive-confirm-actions">
                            <Button bsStyle="primary" bsSize="small" className="tw-derive-btn" onClick={onConfirm} data-testid="derive-confirm-ok">
                                Derive
                            </Button>
                            <button type="button" className="tw-save-btn" onClick={onCancel} data-testid="derive-confirm-cancel">Cancel</button>
                        </div>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
}
TWDeriveConfirmDialog.propTypes = {
    sizeEstimate: PropTypes.shape({ estimatedGB: PropTypes.number, tooLarge: PropTypes.bool }),
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};
TWDeriveConfirmDialog.defaultProps = { sizeEstimate: null };

// TASK-1671: Recipe builder — single DEM stack, no Save buttons, atomic derive,
// size-confirm dialog. Save buttons REMOVED per AC#2.
class TWRecipeBuilder extends React.Component {
    static propTypes = {
        surface: PropTypes.object.isRequired,
        terrains: PropTypes.array.isRequired,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        onUpdate: PropTypes.func.isRequired,
        onDerive: PropTypes.func.isRequired,
    };
    static defaultProps = { deriving: false, deriveError: null, saving: false, saveError: null };

    // Build default-seamless inputs from the new BE shape `inputs_ordered`.
    // inputs_ordered = [{id, terrain, priority, unmodified}]
    // FE internal shape: [{terrain_id, priority, unmodified}]
    static _inputsFromSurface(surface) {
        const ordered = surface.inputs_ordered || [];
        return ordered.map(d => ({
            terrain_id: d.terrain,
            priority: d.priority,
            unmodified: !!d.unmodified,
        }));
    }

    constructor(props) {
        super(props);
        const s = props.surface;
        this.state = {
            use_culverts: !!s.use_culverts,
            feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
            target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
            breach_max_cost: s.breach_max_cost ?? TW_PARAM_DEFAULTS.breach_max_cost,
            breach_search_dist: s.breach_search_dist ?? TW_PARAM_DEFAULTS.breach_search_dist,
            // TASK-1671: single ordered DEM stack (replaces designInputs + regional_terrain)
            inputs: TWRecipeBuilder._inputsFromSurface(s),
            // Confirm dialog state
            confirmOpen: false,
            sizeEstimate: null, // { estimatedGB, tooLarge } | null
        };
    }

    componentDidUpdate(prevProps) {
        // Re-sync when switching surface or when the server updates inputs_ordered.
        if (prevProps.surface.id !== this.props.surface.id) {
            const s = this.props.surface;
            this.setState({
                use_culverts: !!s.use_culverts,
                feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
                target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
                breach_max_cost: s.breach_max_cost ?? TW_PARAM_DEFAULTS.breach_max_cost,
                breach_search_dist: s.breach_search_dist ?? TW_PARAM_DEFAULTS.breach_search_dist,
                inputs: TWRecipeBuilder._inputsFromSurface(s),
                confirmOpen: false,
                sizeEstimate: null,
            });
        } else if (prevProps.surface.inputs_ordered !== this.props.surface.inputs_ordered) {
            this.setState({ inputs: TWRecipeBuilder._inputsFromSurface(this.props.surface) });
        }
    }

    handleParam = (key, val) => this.setState({ [key]: val });

    // AC#3 + AC#4: Derive → compute size estimate → show confirm dialog.
    // The actual derive is dispatched only after user confirms.
    handleDeriveClick = () => {
        const { inputs, target_resolution_m } = this.state;
        const { terrains } = this.props;
        const targetResM = parseFloat(target_resolution_m) || null;
        const sizeEstimate = estimateOutputSize(inputs, terrains, targetResM);
        this.setState({ confirmOpen: true, sizeEstimate });
    };

    handleConfirmDerive = () => {
        const { surface, onDerive } = this.props;
        const { inputs, use_culverts, feather_width_m, target_resolution_m, breach_max_cost, breach_search_dist } = this.state;
        this.setState({ confirmOpen: false });
        // TASK-1671: dispatch atomic derive — body carries inputs + params.
        const body = {
            inputs: inputs.map(inp => ({
                terrain_id: inp.terrain_id,
                priority: inp.priority,
                unmodified: !!inp.unmodified,
            })),
            use_culverts: !!use_culverts,
            feather_width_m: parseFloat(feather_width_m),
            target_resolution_m: parseFloat(target_resolution_m),
            breach_max_cost: parseFloat(breach_max_cost),
            breach_search_dist: parseFloat(breach_search_dist),
        };
        onDerive(surface.id, body);
    };

    handleCancelDerive = () => {
        this.setState({ confirmOpen: false, sizeEstimate: null });
    };

    _canDerive() {
        const { inputs } = this.state;
        const { deriving, saving } = this.props;
        if (deriving || saving) return false;
        if (inputs.length === 0) return false;
        // Must not be all-unmodified (mirrors BE V5).
        if (inputs.every(d => d.unmodified)) return false;
        return true;
    }

    render() {
        const { surface, terrains, deriving, deriveError, saving, saveError } = this.props;
        const { use_culverts, feather_width_m, target_resolution_m, breach_max_cost, breach_search_dist, inputs, confirmOpen, sizeEstimate } = this.state;
        const canDerive = this._canDerive();
        const allUnmodified = inputs.length > 0 && inputs.every(d => d.unmodified);
        return (
            <div className="tw-recipe-builder" data-testid="recipe-builder">
                {/* TASK-1671: single DEM stack (replaces TWDesignInputPicker + regional terrain picker) */}
                <TWDemStackPicker
                    terrains={terrains}
                    inputs={inputs}
                    onChange={(next) => this.setState({ inputs: next })}
                    disabled={saving || deriving}
                />
                {allUnmodified && (
                    <div className="tw-validation-hint" data-testid="all-unmodified-hint">
                        At least one DEM must be modifiable (not set to unmodified).
                    </div>
                )}
                {/* TASK-1671: Parameters section — NO Save parameters button.
                    #10 (re-UAT): the "PARAMETERS" sub-heading was redundant with the
                    collapsible panel title and is removed. */}
                <div className="tw-params-section">
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
                    {/* TASK-1671: Save parameters button REMOVED — params saved atomically on derive */}
                </div>
                {/* TASK-1674: tw-error -> shared ErrorStrip. The {saveError && …} guard is
                    kept (rather than leaning on ErrorStrip's self-hide) so the data-testid
                    wrapper still appears/disappears exactly as before — ErrorStrip does not
                    forward arbitrary DOM props, hence the wrapper carries the testid. */}
                {saveError && (
                    <div data-testid="save-error">
                        <ErrorStrip message={saveError} extraClassName="tw-error"/>
                    </div>
                )}
                {/* TASK-1671: Derive section — single button triggers confirm dialog */}
                <div className="tw-derive-section">
                    <Button
                        bsStyle="primary"
                        bsSize="small"
                        className="tw-derive-btn"
                        onClick={this.handleDeriveClick}
                        disabled={!canDerive}
                        data-testid="derive-btn"
                    >
                        {/* #9 (re-UAT): "Derive terrain" renamed to "Create". */}
                        {deriving ? 'Creating…' : 'Create'}
                    </Button>
                    {deriving && <div className="tw-derive-progress" data-testid="derive-progress">Processing — watch the Task Monitor for progress.</div>}
                    {/* TASK-1674: tw-error -> shared ErrorStrip (testid kept on the wrapper). */}
                    {deriveError && (
                        <div data-testid="derive-error">
                            <ErrorStrip message={deriveError} extraClassName="tw-error"/>
                        </div>
                    )}
                </div>
                {/* TASK-1671: Size-confirm dialog */}
                {confirmOpen && (
                    <TWDeriveConfirmDialog
                        sizeEstimate={sizeEstimate}
                        onConfirm={this.handleConfirmDerive}
                        onCancel={this.handleCancelDerive}
                    />
                )}
                <TWSeamQAPanel enforcementLog={surface.enforcement_log}/>
            </div>
        );
    }
}

// One surface row — the name is edited INLINE here (click and type) rather than
// in a separate field; commits on blur / Enter via onRename (a title-only
// PATCH), Esc reverts. The row also owns selection and delete.
class TWSurfaceListItem extends React.Component {
    static propTypes = {
        surface: PropTypes.object.isRequired,
        selected: PropTypes.bool,
        saving: PropTypes.bool,
        onSelect: PropTypes.func.isRequired,
        onRename: PropTypes.func.isRequired,
        onDelete: PropTypes.func.isRequired,
    };
    static defaultProps = { selected: false, saving: false };

    constructor(props) {
        super(props);
        this.state = { draft: props.surface.title || '' };
    }

    componentDidUpdate(prevProps) {
        // Resync the editable draft when the row switches surface or the server
        // title changes elsewhere (e.g. another save).
        if (prevProps.surface.id !== this.props.surface.id ||
            prevProps.surface.title !== this.props.surface.title) {
            this.setState({ draft: this.props.surface.title || '' });
        }
    }

    commit = () => {
        const title = (this.state.draft || '').trim();
        if (!title) { this.setState({ draft: this.props.surface.title || '' }); return; }
        if (title !== this.props.surface.title) this.props.onRename(this.props.surface.id, title);
    };

    render() {
        const { surface, selected, saving, onSelect, onDelete } = this.props;
        return (
            <div
                className={`tw-surface-item${selected ? ' selected' : ''}`}
                onClick={() => onSelect(surface.id)}
                data-testid={`surface-item-${surface.id}`}
            >
                <input
                    className="tw-surface-title-input"
                    value={this.state.draft}
                    placeholder={`Surface #${surface.id}`}
                    title="Click to rename this analysis surface"
                    aria-label="Analysis surface name"
                    disabled={saving}
                    onChange={(e) => this.setState({ draft: e.target.value })}
                    onClick={(e) => { e.stopPropagation(); onSelect(surface.id); }}
                    onBlur={this.commit}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                        else if (e.key === 'Escape') { this.setState({ draft: surface.title || '' }, () => this.input && this.input.blur()); }
                    }}
                    ref={(el) => { this.input = el; }}
                    data-testid={`surface-title-${surface.id}`}
                />
                {/* #11 (re-UAT): never show "stale" on a surface that has never been
                    derived. is_stale is True both when no output exists yet AND when a
                    derived output's inputs have since changed — only the latter is a real
                    "stale" state. Gate on output_terrain existing (a derived output). */}
                <TWStaleBadge isStale={!!surface.is_stale && !!surface.output_terrain}/>
                <button
                    type="button"
                    className="tw-icon-btn tw-icon-btn-danger tw-surface-delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(surface.id); }}
                    disabled={saving}
                    title="Delete this analysis surface"
                    aria-label="Delete analysis surface"
                    data-testid={`surface-delete-${surface.id}`}
                >×</button>
            </div>
        );
    }
}

function TWSurfaceList({ surfaces, selectedId, onSelect, onRename, onDelete, onNew, saving, createError }) {
    return (
        <div className="tw-surface-list">
            {/* #10 (re-UAT): the "ANALYSIS SURFACES" sub-heading was redundant with the
                collapsible panel title above; only the "+ New" action remains in the header. */}
            <div className="tw-surface-list-header tw-surface-list-header--no-label">
                <button type="button" className="tw-new-btn" onClick={onNew} disabled={saving} data-testid="new-surface-btn">+ New analysis surface</button>
            </div>
            {/* TASK-1658: a failed create has no selectedSurface, so the recipe-form
                error would be invisible — surface it here at the list level. */}
            {/* TASK-1674: tw-error -> shared ErrorStrip; tw-empty-hint -> shared EmptyState. */}
            {createError && (
                <div data-testid="create-error">
                    <ErrorStrip message={createError} extraClassName="tw-error"/>
                </div>
            )}
            {surfaces.length === 0 && (
                <EmptyState extraClassName="tw-empty-hint">
                    No analysis surfaces yet. Create one with <strong>+ New analysis surface</strong>.
                </EmptyState>
            )}
            {surfaces.map(s => (
                <TWSurfaceListItem
                    key={s.id}
                    surface={s}
                    selected={selectedId === s.id}
                    saving={saving}
                    onSelect={onSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}
TWSurfaceList.propTypes = { surfaces: PropTypes.array.isRequired, selectedId: PropTypes.number, onSelect: PropTypes.func.isRequired, onRename: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onNew: PropTypes.func.isRequired, saving: PropTypes.bool, createError: PropTypes.string };
TWSurfaceList.defaultProps = { selectedId: null, saving: false, createError: null };

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
    };

    render() {
        const {
            terrain, demLayer, hillshadeLayer, expanded, onToggleExpand,
            dragging, dragOver, onDragStart, onDragOver, onDragEnd, onDrop,
            // Merge (5.x→epic 2026-06-15): TASK-1720/1721 per-DEM rendering-mode + contour toggles.
            terrainModel, canEdit, contoursEnabled, onStylingModeChange, onContoursToggle
        } = this.props;

        // TASK-1587 (grill 2026-06-15): the expanded zone now ALWAYS holds the
        // Rendering-mode + Contours rows for a real terrain, so a row is expandable
        // whenever there is a real terrain model OR a hillshade derivative — not only
        // when a hillshade exists. Orphan / analysis-surface rows (no model) stay flat.
        const hasDerivatives = !!hillshadeLayer || !!terrainModel?.id;
        // TASK-1720 (W3): styling mode for this terrain (default 'traditional' = the W1 BE default).
        const mode = terrainModel?.styling_mode || 'traditional';
        const isDynamic = mode === 'dynamic';

        return (
            <div
                className={`terrain-hierarchy-item ${dragging ? 'terrain-dragging' : ''} ${dragOver ? 'terrain-drag-over' : ''}`}
                draggable
                onDragStart={onDragStart}
                onDragOver={(e) => { e.preventDefault(); onDragOver && onDragOver(e); }}
                onDragEnd={onDragEnd}
                onDrop={(e) => { e.preventDefault(); onDrop && onDrop(e); }}
            >
                {/* Parent row (BUG-4, UAT): DEM IDENTITY ONLY — the expand chevron, the
                    drag handle, and a lightweight DEM title label so the modeller can tell
                    which DEM this is while collapsed. The DEM MenuRow itself (visibility /
                    zoom / per-layer controls) is NOT here — per the finding it lives INSIDE
                    the collapsible derivatives section below, alongside Hillshade, so the
                    top level stays a clean identity-only header. Clicking the title toggles
                    expansion too (the whole header acts as the disclosure control). */}
                <div className="terrain-parent-row">
                    {hasDerivatives ? (
                        <span
                            className={`terrain-expand-btn glyphicon ${expanded ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse derivatives' : 'Expand derivatives'}
                            onClick={() => onToggleExpand && onToggleExpand(terrain.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand && onToggleExpand(terrain.id); } }}
                            style={{cursor: 'pointer', marginRight: 4, fontSize: 10, color: 'rgba(255,255,255,0.6)'}}
                        />
                    ) : (
                        <span style={{display: 'inline-block', width: 14, marginRight: 4}} />
                    )}
                    <span className="glyphicon glyphicon-move terrain-drag-handle" style={{color: 'rgba(255,255,255,0.35)', cursor: 'grab', marginRight: 4, fontSize: 10}} aria-hidden="true" />
                    {/* Expandable (real terrain) rows show a lightweight identity title; the
                        full DEM MenuRow is folded into the collapsible zone (BUG-4). NON-expandable
                        orphan / analysis-surface rows (no model, no hillshade) have no collapsible
                        zone, so they keep the full DEM MenuRow inline here — otherwise their
                        visibility/zoom controls would have nowhere to live. */}
                    {hasDerivatives ? (
                        <span
                            className="terrain-parent-title"
                            data-testid="terrain-parent-title"
                            style={{flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                            onClick={() => onToggleExpand && onToggleExpand(terrain.id)}
                            title={demLayer ? (demLayer.title || demLayer.name) : (terrain.title || terrain.name || 'Terrain')}
                        >
                            {demLayer ? (demLayer.title || demLayer.name) : (terrain.title || terrain.name || 'Terrain')}
                            {!demLayer && (
                                <span className="glyphicon glyphicon-hourglass" style={{marginLeft: 6, fontSize: 10}} />
                            )}
                        </span>
                    ) : demLayer ? (
                        <div style={{flex: 1, minWidth: 0}}>
                            <MenuRow layer={demLayer} />
                        </div>
                    ) : (
                        <span className="terrain-pending-name" style={{flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12}}>
                            {terrain.title || terrain.name || 'Terrain'}
                            <span className="glyphicon glyphicon-hourglass" style={{marginLeft: 6, fontSize: 10}} />
                        </span>
                    )}
                </div>
                {/* Expanded zone (TASK-1587 grill 2026-06-15 + BUG-4 UAT 2026-06-16 +
                    decision 2026-06-16-q-4 REVISING ADR#9): the parent row above is DEM
                    IDENTITY ONLY. Inside the collapsible section the DEM now OWNS its two
                    sub-options — Rendering mode and Contours both DERIVE from DEM elevation
                    so they are NESTED under the DEM (terrain-dem-group). Hillshade is a
                    SEPARATE sibling row with NO sub-options (it is just a display
                    derivative). Mode + Contours are icon-only, left-justified buttons.
                    data-testids are preserved from the 5.x→epic merge (TASK-1720/1721) so
                    the existing tests/selectors keep working. */}
                {expanded ? (
                    <div className="terrain-derivatives">
                        {/* ⛰ DEM group: the DEM MenuRow with Mode + Contours nested beneath it. */}
                        {demLayer ? (
                            <div className="terrain-dem-group">
                                {/* DEM layer row (BUG-4): the full DEM MenuRow, folded into
                                    the collapsible section. The visibility/zoom/download/trash
                                    glyph cluster is hidden for terrain rows via CSS (#6). */}
                                <div className="terrain-derivative-row terrain-dem-row" data-testid="terrain-dem-row">
                                    <span className="terrain-derivative-indent" style={{display: 'inline-block', width: 28}} />
                                    <span className="glyphicon glyphicon-picture" style={{color: 'rgba(255,255,255,0.4)', marginRight: 4, fontSize: 10}} aria-hidden="true" />
                                    <div style={{flex: 1, minWidth: 0}}>
                                        <MenuRow layer={demLayer} />
                                    </div>
                                </div>
                                {/* DEM sub-options (#4): Mode + Contours both derive from DEM
                                    elevation, so they nest UNDER the DEM, indented one level. */}
                                <div className="terrain-dem-suboptions">
                                    {/* ⚙ Rendering mode (styling_mode): Dynamic ↔ Traditional.
                                        Icon-only, left-justified (#5). */}
                                    {canEdit && terrainModel?.id ? (
                                        <div className="terrain-derivative-row terrain-dem-suboption anuga-terrain-mode-toggle" data-testid="terrain-mode-toggle">
                                            <button
                                                className={`btn btn-xs anuga-terrain-mode-btn anuga-terrain-icon-btn ${isDynamic ? 'btn-primary' : 'btn-default'}`}
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
                                                <span className="glyphicon glyphicon-cog" aria-hidden="true" />
                                            </button>
                                        </div>
                                    ) : null}
                                    {/* ◷ Contour overlay: toggled derivative. Icon-only,
                                        left-justified (#5). */}
                                    {terrainModel?.id ? (
                                        <div className="terrain-derivative-row terrain-dem-suboption anuga-terrain-contour-toggle" data-testid="terrain-contour-toggle">
                                            <button
                                                className={`btn btn-xs anuga-terrain-mode-btn anuga-terrain-icon-btn ${contoursEnabled ? 'btn-primary' : 'btn-default'}`}
                                                title={contoursEnabled
                                                    ? 'Contours: On — hide contour overlay (GWC-cached ras:Contour, 100 m interval)'
                                                    : 'Contours: Off — show contour overlay (GWC-cached ras:Contour, 100 m interval)'}
                                                aria-label={contoursEnabled ? 'Hide Contours' : 'Show Contours'}
                                                aria-pressed={contoursEnabled}
                                                data-testid={`terrain-contour-toggle-btn-${terrainModel.id}`}
                                                onClick={() => onContoursToggle && onContoursToggle(demLayer?.name, contoursEnabled)}
                                            >
                                                <span className="glyphicon glyphicon-menu-hamburger" aria-hidden="true" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                        {/* ◔ Hillshade: SEPARATE sibling derivative with NO sub-options (#4).
                            Just a display derivative. */}
                        {hillshadeLayer ? (
                            <div className="terrain-derivative-row terrain-hillshade-row">
                                <span className="terrain-derivative-indent" style={{display: 'inline-block', width: 28}} />
                                <span className="glyphicon glyphicon-picture" style={{color: 'rgba(255,255,255,0.4)', marginRight: 4, fontSize: 10}} />
                                <div style={{flex: 1, minWidth: 0}}>
                                    <MenuRow layer={hillshadeLayer} />
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
            onStylingModeChange, onContoursToggle
        } = this.props;
        const { dragFromIndex, dragOverIndex } = this.state;
        const localContours = localContoursEnabled || {};

        return (
            <div className="terrain-hierarchy-list">
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
        onSaveMap: PropTypes.func,
        // TASK-1721 (W4): Contours overlay toggle
        onAddContourLayer: PropTypes.func,
        onRemoveLayer: PropTypes.func,
        // TASK-1728 (W1.7): surface terrain-upload progress on the W1.5 Tasks Panel.
        onUpdateProcess: PropTypes.func,    // inject/update an optimistic process row
        onOpenTaskMonitor: PropTypes.func   // open the Tasks Panel so the row is visible
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
            twSurfaceSectionOpen: false,
            // TASK-1652 (W1.5) — terrain hierarchy: Set of terrain model IDs
            // whose derivative rows (hillshade, etc.) are expanded.
            expandedTerrainIds: new Set(),
            // TASK-1721 (W4) — per-terrain contour overlay enabled state.
            // Keyed by DEM layer name (bare, without 'geonode:' prefix).
            contoursEnabled: {},
            // TASK-1728 (W1.7) — direct-to-S3 terrain upload tracking. Progress is
            // surfaced ON THE TASKS PANEL (not an inline strip / blocking modal),
            // so this state is just an in-flight latch keyed on the BE process_id:
            //   uploading: true while a byte transfer is in flight (prevents a
            //              second concurrent picker submit)
            //   processId: the REAL presign process_id the optimistic Tasks-Panel
            //              row is keyed on (null until presign returns)
            //   filename:  the file being uploaded (for the row name)
            terrainUpload: { uploading: false, processId: null, filename: null }
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

    // TASK-1728: file chosen → run presign → XHR PUT → finalize, with progress
    // surfaced ON THE TASKS PANEL (non-blocking) — NOT a modal or an inline strip.
    // The presign-time Process (BE, TASK-1727) already appears in the panel via
    // polling; we open the panel and inject an optimistic row keyed on the SAME
    // process_id so progress shows from the first byte while the modeller keeps
    // working. Upload progress is FE-local (browser xhr.upload.onprogress); we do
    // NOT chatty-PATCH the BE Process per chunk — the optimistic row's progress_pct
    // is purely local and the polled Process takes over the lifecycle on finalize.
    // Replaces the legacy synchronous multipart POST that streamed the whole GeoTIFF
    // through uwsgi and died at harakiri=120. On PUT failure the BE reconcile sweep
    // + S3 lifecycle clean up the orphan — the FE just reflects the error on the row.
    _onTerrainFileSelected = (event) => {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return;
        const projectId = this.props.projectId;
        const name = `Terrain upload: ${file.name}`;
        if (!projectId) {
            // No real BE Process — surface a synthetic error row on the Tasks Panel.
            if (this.props.onOpenTaskMonitor) this.props.onOpenTaskMonitor(true);
            this._emitTerrainUploadProcess(`terrain-upload-${Date.now()}`, {
                name, status: 'error', status_detail: null, error_message: 'No project selected.'
            });
            this.setState({ terrainUpload: { uploading: false, processId: null, filename: file.name } });
            return;
        }
        const title = (file.name || '').replace(/\.[^.]+$/, '') || file.name;
        // Latch in-flight + open the Tasks Panel so the upload is immediately visible.
        this.setState({ terrainUpload: { uploading: true, processId: null, filename: file.name } });
        if (this.props.onOpenTaskMonitor) this.props.onOpenTaskMonitor(true);
        trackEvent('process', 'start', 'anuga-terrain-direct-upload');

        // The optimistic row id is the REAL process_id once presign returns; until
        // then track a synthetic id so a PUT-progress tick before presign resolves
        // (it never does, but be defensive) still has a row to update.
        let rowId = `terrain-upload-${Date.now()}`;

        uploadTerrainDirect(projectId, file, {
            title,
            onPresign: (data) => {
                // Re-key the optimistic row on the BE process_id so the polled BE
                // Process merges onto it (no duplicate row).
                if (data && data.process_id) rowId = data.process_id;
                this.setState(prev => ({ terrainUpload: { ...prev.terrainUpload, processId: rowId } }));
                this._emitTerrainUploadProcess(rowId, {
                    name, status: 'running', progress_pct: 0, status_detail: 'Uploading'
                });
            },
            onProgress: (pct) => {
                // Byte-level progress on the Tasks-Panel row. At 100% the bytes are
                // on S3 and finalize is about to run → show the import handoff.
                this._emitTerrainUploadProcess(rowId, pct >= 100
                    ? { name, status: 'running', progress_pct: 100, status_detail: 'Importing' }
                    : { name, status: 'running', progress_pct: pct, status_detail: 'Uploading' });
            }
        })
            .then(() => {
                this.setState({ terrainUpload: { uploading: false, processId: rowId, filename: file.name } });
                // Finalize succeeded: the BE Process is now mid-import. Hand the row
                // back to polling (which carries the real Uploading -> UTM -> Hillshade
                // -> Style lifecycle); a 'pending' running row keeps the panel live
                // until the next poll merges authoritative server state.
                this._emitTerrainUploadProcess(rowId, {
                    name, status: 'running', progress_pct: 100, status_detail: 'Importing'
                });
                // Kick the existing layer-creation poll so the new Terrain row surfaces
                // when the async import chain finishes (no new poll — contract §Notes).
                if (this.props.startAnugaModelCreationPolling) this.props.startAnugaModelCreationPolling();
                trackEvent('process', 'complete', 'anuga-terrain-direct-upload');
            })
            .catch((err) => {
                const detail = err?.response?.data?.detail || err?.message || 'Upload failed.';
                this.setState({ terrainUpload: { uploading: false, processId: rowId, filename: file.name } });
                // Reflect the failure on the SAME row. On a presign failure rowId is
                // still synthetic (no BE Process was created); on a PUT failure the BE
                // reconcile sweep errors the real Process — either way the panel shows it.
                this._emitTerrainUploadProcess(rowId, {
                    name, status: 'error', status_detail: null, error_message: String(detail)
                });
                trackEvent('process', 'error', 'anuga-terrain-direct-upload');
            });
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

    // TASK-1652 (W1.5): build the ordered terrain groups for hierarchy rendering.
    // Each entry: { terrain: model|null, demLayer, hillshadeLayer: layer|null }
    // Analysis surface outputs (layers in Terrain group with no terrainModel match) = parent rows.
    _buildTerrainGroups() {
        const terrainLayers = this.props.terrainLayers || [];
        const terrainModels = this.props.terrainModels || [];

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
            .filter(l => !consumedNames.has(l.name) && !isKnownHillshade(l))
            .forEach(l => {
                groups.push({ terrain: null, demLayer: l, hillshadeLayer: null });
            });

        return groups;
    }

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

    // TASK-1721 (W4): Toggle the GWC-cached ras:Contour overlay for a terrain DEM layer.
    //
    // On ENABLE:
    //   1. Build the contour layer config via buildContourLayer (GWC WMTS, STYLES=dem_contours,
    //      no env=, type=wms) — passes isShareableTileLayer.
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
    _handleContoursToggle = (demLayerName, currentlyEnabled) => {
        if (!demLayerName) return;
        if (!currentlyEnabled) {
            // Enable: add the contour overlay layer.
            const token = getToken ? getToken() : null;
            const contourLayer = buildContourLayer(demLayerName, token);
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
        // TASK-1645 (W1.5) / TASK-1671 (W1.6): recipe builder state from props.
        const {
            twTerrains, twSurfaces, twSelectedSurfaceId,
            twLoading, twError, twSaving, twSaveError, twDeriving, twDeriveError,
            onTwLoadData, onTwSelectSurface, onTwCreateSurface,
            onTwUpdateSurface, onTwDeleteSurface, onTwDerive,
            projectId
        } = this.props;
        const { twSurfaceSectionOpen } = this.state;
        const selectedSurface = (twSurfaces || []).find(s => s.id === twSelectedSurfaceId) || null;

        // TASK-1652 (W1.5): build terrain groups for hierarchical rendering.
        const terrainGroups = this._buildTerrainGroups();
        const { expandedTerrainIds } = this.state;

        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('terrain', actions)}
                {/* TASK-1728 (W1.7): the terrain upload is non-blocking — its progress,
                    success, and failure surface on the W1.5 Tasks Panel, not here. */}
                <div className="anuga-pane-rows">
                    {terrainGroups.length > 0 ? (
                        <TerrainListWithDragDrop
                            terrainGroups={terrainGroups}
                            expandedIds={expandedTerrainIds}
                            onToggleExpand={(terrainId) => {
                                const next = new Set(expandedTerrainIds);
                                if (next.has(terrainId)) { next.delete(terrainId); } else { next.add(terrainId); }
                                this.setState({ expandedTerrainIds: next });
                            }}
                            onReorder={this.props.onReorderTerrainLayers || null}
                            /* Merge (5.x→epic 2026-06-15): TASK-1720/1721 per-DEM Mode +
                               Contours toggles, folded into the hierarchy rows — they used
                               to live on the flat layers.map list that TASK-1652 replaced. */
                            canEdit={canEdit}
                            flatLayers={this.props.flatLayers}
                            localContoursEnabled={this.state.contoursEnabled}
                            onStylingModeChange={this._handleTerrainStylingModeChange}
                            onContoursToggle={this._handleContoursToggle}
                        />
                    ) : null}
                    {layers.length === 0 ? this.renderTerrainEmpty() : null}
                </div>
                {/* TASK-1645 (W1.5): Analysis Surface recipe builder, re-homed from TerrainWorkbench.
                    #1 (re-UAT): with ZERO terrains there is nothing to merge into an analysis
                    surface, so the whole section is hidden until at least one terrain exists. */}
                {projectId && (twTerrains || []).length >= 1 ? (
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
                                {/* TASK-1674: tw-error -> shared ErrorStrip (testid kept on the wrapper). */}
                                {twError && (
                                    <div data-testid="tw-load-error">
                                        <ErrorStrip message={twError} extraClassName="tw-error"/>
                                    </div>
                                )}
                                {!twLoading && !twError && (
                                    <React.Fragment>
                                        <TWSurfaceList
                                            surfaces={twSurfaces || []}
                                            selectedId={twSelectedSurfaceId}
                                            onSelect={onTwSelectSurface}
                                            onRename={(id, title) => onTwUpdateSurface(id, { title })}
                                            onDelete={onTwDeleteSurface}
                                            onNew={() => onTwCreateSurface({
                                                title: `New Analysis Surface ${(twSurfaces || []).length + 1}`,
                                                use_culverts: false,
                                                ...TW_PARAM_DEFAULTS,
                                            })}
                                            saving={twSaving}
                                            createError={!selectedSurface ? twSaveError : null}
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
                                                onDerive={onTwDerive}
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

    // TASK-1755 (W1.8): Culvert pane — there is NO dedicated culvert PANEL
    // component yet, so this is a clean BLANK placeholder (standard Inputs-pane
    // chrome + the translated heading + a short empty-state hint). Culverts are
    // still DRAWN on the map via the VectorDraw WFST path (culvertTranslate.js),
    // which is wired independently of this pane — so the placeholder does not
    // regress draw. Before this arm existed, selecting Culvert fell through to
    // `default:` and showed the Terrain pane.
    renderCulvertPane() {
        return (
            <div className="menu-rows-pane anuga-pane">
                {this.renderPaneHead('culverts', null)}
                <div className="anuga-pane-rows">
                    <div className="row menu-row anuga-section-empty-row">
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
            <div id={'anuga-input-menu'} className={'simple-view-panel anuga-panel simple-view-panel--miller'}>
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
        // TASK-1645 (W1.5) / TASK-1671 (W1.6) — recipe builder actions.
        onTwLoadData: () => dispatch(twLoadData()),
        onTwSelectSurface: (id) => dispatch(twSelectSurface(id)),
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
        onSaveMap: () => dispatch(saveDirectContent()),
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
export {TWStaleBadge, TWSurfaceList, TWRecipeBuilder};
// TASK-1752 (W1.8): export the dispatch map so the terrain-reorder thunk
// (onReorderTerrainLayers) can be exercised end-to-end through the REAL layers
// reducer in a unit test — guarding the sortLayers-callback regression that a
// hand-rolled equivalent would miss.
export {mapDispatchToProps};
