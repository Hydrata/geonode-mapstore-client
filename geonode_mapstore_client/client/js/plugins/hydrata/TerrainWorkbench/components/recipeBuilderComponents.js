/**
 * Analysis-Surface recipe-builder presentational components — the DEM-stack
 * "Merge terrains" recipe builder, surface list, derive confirm dialog, seam-QA
 * panel and stale badge.
 *
 * TASK-1800 (W1.9 UAT): EXTRACTED VERBATIM from anugaInputMenu.js so the new
 * stand-alone "Merge terrains" side panel (MergeTerrainsPanel.js) and the legacy
 * Inputs->Terrain consumers can both import them. Component bodies, data-testids
 * and markup are BYTE-IDENTICAL to the originals (the karma tests pin them);
 * only the module home changed. anugaInputMenu.js re-imports + re-exports these
 * so its existing test imports keep resolving.
 *
 * Provenance comments below (TASK-1645 / TASK-1671 / TASK-1674) are kept as-is.
 */
import React from "react";
import { OverlayTrigger, Tooltip, Button } from 'react-bootstrap';
const PropTypes = require('prop-types');

import Message from '@mapstore/framework/components/I18N/Message';
import {ErrorStrip, StatusBadge} from "../../SimpleView/components/primitives";

// ── TASK-1645 (W1.5) / TASK-1671 (W1.6): AnalysisSurface recipe builder ────

// S1 merge param defaults. Terrain conditioning (breach/fill, flow direction,
// accumulation) is deferred to the terrain-delineation epic (epic B), so the
// breach_* params were removed from the recipe.
const TW_PARAM_DEFAULTS = {
    feather_width_m: 50,
    target_resolution_m: 5
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
// TASK-2582 (W2a): an optional 4th argument, extentWgs84 [minLon, minLat,
// maxLon, maxLat], constrains the union bbox to its intersection with the
// Merge extent the user drew. Decision (CLOSED): null = full union; an extent
// BEYOND the union is clipped BACK to the union (the modeller cannot inflate
// the output by drawing outside the DEM stack) — a plain bbox intersection
// gives exactly that: when extentWgs84 fully contains the union the
// intersection collapses to the union unchanged, and when it is smaller the
// intersection collapses to the extent.
//
// lat_m  ≈ 111 320 m/°  (standard constant)
// lon_m  ≈ 111 320 · cos(mean_lat) m/°
//
// Returns { estimatedGB, tooLarge } where tooLarge = estimatedGB > 10.
// Returns null if not enough metadata is available to estimate.
const MAX_OUTPUT_GB = 10;

function estimateOutputSize(selectedInputs, terrains, targetResolutionM, extentWgs84 = null) {
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

    // TASK-2582: intersect the union bbox with the Merge extent (if any).
    let west = unionWest;
    let south = unionSouth;
    let east = unionEast;
    let north = unionNorth;
    if (Array.isArray(extentWgs84) && extentWgs84.length === 4) {
        const [exWest, exSouth, exEast, exNorth] = extentWgs84;
        west = Math.max(unionWest, exWest);
        south = Math.max(unionSouth, exSouth);
        east = Math.min(unionEast, exEast);
        north = Math.min(unionNorth, exNorth);
        if (west >= east || south >= north) {
            // No overlap between the drawn extent and the DEM-stack union.
            return { estimatedGB: 0, tooLarge: false };
        }
    }

    const meanLat = (south + north) / 2;
    const latMPerDeg = 111320;
    const lonMPerDeg = 111320 * Math.cos(meanLat * Math.PI / 180);

    const widthM = Math.abs(east - west) * lonMPerDeg;
    const heightM = Math.abs(north - south) * latMPerDeg;
    const areaM2 = widthM * heightM;

    const pixels = areaM2 / (effectiveResM * effectiveResM);
    const bytes = pixels * 4; // float32
    const estimatedGB = bytes / (1024 ** 3);

    return { estimatedGB, tooLarge: estimatedGB > MAX_OUTPUT_GB };
}

// TASK-2582: format an estimateOutputSize() result as a short display string
// ("~340 MB" / "~1.2 GB"). Shared by the derive-confirm dialog (authoritative,
// Create-click) and the live estimate row in the recipe builder (same
// function, so the two numbers can never disagree per-se — see module doc).
function formatEstimateSize(sizeEstimate) {
    if (!sizeEstimate) return null;
    return sizeEstimate.estimatedGB < 1
        ? `~${(sizeEstimate.estimatedGB * 1024).toFixed(0)} MB`
        : `~${sizeEstimate.estimatedGB.toFixed(1)} GB`;
}

// TASK-2582: rough WGS84 extent dimensions in km, for the "~W x H km" Merge
// extent summary row. Same lat/lon-to-metres constants as estimateOutputSize
// above (not exported — a small display-only helper local to this module).
function mergeExtentDimsKm(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const meanLat = (minLat + maxLat) / 2;
    const latMPerDeg = 111320;
    const lonMPerDeg = 111320 * Math.cos(meanLat * Math.PI / 180);
    const widthKm = Math.abs(maxLon - minLon) * lonMPerDeg / 1000;
    const heightKm = Math.abs(maxLat - minLat) * latMPerDeg / 1000;
    return { widthKm: widthKm.toFixed(1), heightKm: heightKm.toFixed(1) };
}

function TWStaleBadge({ isStale }) {
    if (!isStale) return null;
    // TASK-1674: the bespoke (and CSS-orphaned) sv-terrain-workbench-stale-badge span is
    // now the shared amber StatusBadge — "stale" reads as a pending/needs-attention
    // pill, exactly the .is-warn palette the old .tw-stale-badge rule chased.
    return (
        <span
            className="sv-terrain-workbench-stale-badge"
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
        <div className="sv-tw-seam-qa" data-testid="seam-qa-panel">
            <div className="sv-tw-label tw-label">Seam QA</div>
            {maxSeam !== null && <div className="sv-tw-seam-qa-row"><span>Max seam step:</span><strong>{maxSeam} m</strong></div>}
            {offset !== null && <div className="sv-tw-seam-qa-row"><span>Vertical offset applied:</span><strong>{offset} m</strong></div>}
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
        <div className="sv-tw-design-inputs tw-design-inputs">
            {/* #15 (re-UAT): user-facing label is the normal-case "Merge terrains".
                The internal/domain term stays "DEM priority stack". */}
            <label className="sv-tw-label tw-label sv-tw-label-normalcase tw-label-normalcase">
                Merge terrains <span className="sv-tw-label-sub">(top = highest priority, bottom = base)</span>
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
                    <div key={inp.terrain_id} className="sv-tw-design-input-row" data-testid={`dem-stack-row-${inp.terrain_id}`}>
                        <span className="sv-tw-priority-badge tw-priority-badge" title={isTop ? 'Highest priority' : isBase ? 'Base' : `Priority ${idx + 1}`}>
                            {badgeLabel}
                        </span>
                        <span className="sv-tw-input-title">{t ? (t.title || t.name) : `Terrain #${inp.terrain_id}`}</span>
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
                                className={`sv-tw-icon-btn sv-tw-pencil-toggle tw-pencil-toggle${isModifiable ? ' sv-tw-modifiable-on tw-modifiable-on' : ''}`}
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
                        <button type="button" className="sv-tw-icon-btn" onClick={() => moveUp(idx)} disabled={disabled || idx === 0} title="Move up">↑</button>
                        <button type="button" className="sv-tw-icon-btn sv-tw-icon-btn-danger" onClick={() => remove(idx)} disabled={disabled} title="Remove">×</button>
                    </div>
                );
            })}
            {available.length > 0 && (
                <select className="sv-tw-select" value="" onChange={(e) => addTerrain(e.target.value)} disabled={disabled} data-testid="dem-stack-add-select">
                    <option value="">+ Add DEM to stack…</option>
                    {available.map(t => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
                </select>
            )}
            {inputs.length === 0 && <div className="sv-tw-validation-hint">At least one DEM is required.</div>}
            {inputs.length > 0 && inputs.every(d => d.unmodified) && (
                <div className="sv-tw-validation-hint">At least one DEM must be modifiable (not unmodified).</div>
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
    // TASK-2582: shared with the live estimate row (formatEstimateSize) so the
    // confirm-dialog number and the live number are computed identically.
    const gbStr = formatEstimateSize(sizeEstimate);
    return (
        <div className="sv-tw-derive-confirm-overlay" data-testid="derive-confirm-dialog" role="dialog" aria-modal="true" aria-label="Confirm derive">
            <div className="sv-tw-derive-confirm-box">
                {tooLarge ? (
                    <React.Fragment>
                        <div className="sv-tw-derive-confirm-title sv-tw-derive-confirm-title--error">
                            Cannot derive — estimated output too large
                        </div>
                        <div className="sv-tw-derive-confirm-body">
                            Estimated output size {gbStr} exceeds the 10 GB limit.
                            Reduce the DEM stack extent or increase Target resolution (m).
                        </div>
                        <div className="sv-tw-derive-confirm-actions">
                            <button type="button" className="sv-tw-save-btn" onClick={onCancel} data-testid="derive-confirm-cancel">Close</button>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <div className="sv-tw-derive-confirm-title">Confirm derive</div>
                        <div className="sv-tw-derive-confirm-body">
                            {gbStr
                                ? <React.Fragment>Estimated output size: <strong>{gbStr}</strong>. Proceed?</React.Fragment>
                                : 'Proceed with derive?'}
                        </div>
                        <div className="sv-tw-derive-confirm-actions">
                            <Button bsStyle="primary" bsSize="small" className="sv-tw-derive-btn" onClick={onConfirm} data-testid="derive-confirm-ok">
                                Derive
                            </Button>
                            <button type="button" className="sv-tw-save-btn" onClick={onCancel} data-testid="derive-confirm-cancel">Cancel</button>
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
    onCancel: PropTypes.func.isRequired
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
        // TASK-2582 (W2a): Merge extent — client-side draw state (owned by the
        // terrainWorkbench slice) + its lifecycle callbacks. mergeExtent is
        // WGS84 [minLon, minLat, maxLon, maxLat] | null (null = full union).
        mergeExtent: PropTypes.array,
        mergeExtentDrawing: PropTypes.bool,
        onStartMergeExtentDraw: PropTypes.func,
        onCancelMergeExtentDraw: PropTypes.func,
        onClearMergeExtent: PropTypes.func
    };
    static defaultProps = {
        deriving: false,
        deriveError: null,
        saving: false,
        saveError: null,
        mergeExtent: null,
        mergeExtentDrawing: false,
        onStartMergeExtentDraw: () => {},
        onCancelMergeExtentDraw: () => {},
        onClearMergeExtent: () => {}
    };

    // Build default-seamless inputs from the new BE shape `inputs_ordered`.
    // inputs_ordered = [{id, terrain, priority, unmodified}]
    // FE internal shape: [{terrain_id, priority, unmodified}]
    static _inputsFromSurface(surface) {
        const ordered = surface.inputs_ordered || [];
        return ordered.map(d => ({
            terrain_id: d.terrain,
            priority: d.priority,
            unmodified: !!d.unmodified
        }));
    }

    constructor(props) {
        super(props);
        const s = props.surface;
        this.state = {
            feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
            target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
            // TASK-1671: single ordered DEM stack (replaces designInputs + regional_terrain)
            inputs: TWRecipeBuilder._inputsFromSurface(s),
            // Confirm dialog state
            confirmOpen: false,
            sizeEstimate: null // { estimatedGB, tooLarge } | null
        };
    }

    componentDidUpdate(prevProps) {
        // Re-sync when switching surface or when the server updates inputs_ordered.
        if (prevProps.surface.id !== this.props.surface.id) {
            const s = this.props.surface;
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({
                feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
                target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
                inputs: TWRecipeBuilder._inputsFromSurface(s),
                confirmOpen: false,
                sizeEstimate: null
            });
        } else if (prevProps.surface.inputs_ordered !== this.props.surface.inputs_ordered) {
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({ inputs: TWRecipeBuilder._inputsFromSurface(this.props.surface) });
        }
    }

    handleParam = (key, val) => this.setState({ [key]: val });

    // TASK-2582 (simplify-pass): the parsed target_resolution_m is needed both
    // at Create-click (handleDeriveClick) and on every render (the live
    // estimate row) — one parse helper instead of two copies of the same
    // `parseFloat(...) || null` line.
    _targetResolutionM() {
        return parseFloat(this.state.target_resolution_m) || null;
    }

    // AC#3 + AC#4: Derive → compute size estimate → show confirm dialog.
    // The actual derive is dispatched only after user confirms.
    handleDeriveClick = () => {
        const { inputs } = this.state;
        const { terrains, mergeExtent } = this.props;
        // TASK-2582: the confirm-dialog estimate is authoritative at Create-click —
        // same function + same mergeExtent as the live row, so they can't disagree.
        const sizeEstimate = estimateOutputSize(inputs, terrains, this._targetResolutionM(), mergeExtent);
        this.setState({ confirmOpen: true, sizeEstimate });
    };

    handleConfirmDerive = () => {
        const { surface, onDerive, mergeExtent } = this.props;
        const { inputs, feather_width_m, target_resolution_m } = this.state;
        this.setState({ confirmOpen: false });
        // TASK-1671: dispatch atomic derive — body carries inputs + merge params.
        // TASK-2582: merge_extent_wgs84 rides the same body as a sibling key,
        // null when no extent has been drawn (full union).
        const body = {
            inputs: inputs.map(inp => ({
                terrain_id: inp.terrain_id,
                priority: inp.priority,
                unmodified: !!inp.unmodified
            })),
            feather_width_m: parseFloat(feather_width_m),
            target_resolution_m: parseFloat(target_resolution_m),
            merge_extent_wgs84: mergeExtent || null
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

    // TASK-2582 (W2a): 'Set extent' draw + summary/Clear + live output estimate.
    // The button flips to Cancel while drawing (mergeExtentDrawing, owned by the
    // terrainWorkbench slice via a NEW owner-isolated draw — 'merge-extent',
    // mirroring terrainBboxEpic.js's terrain-bbox pattern). The live estimate is
    // recomputed on EVERY render — extent/resolution/DEM-stack changes all flow
    // through render() — using the exact same estimateOutputSize() the confirm
    // dialog uses at Create-click, so the two numbers can never disagree.
    renderMergeExtentSection() {
        const {
            mergeExtent, mergeExtentDrawing,
            onStartMergeExtentDraw, onCancelMergeExtentDraw, onClearMergeExtent,
            terrains, saving, deriving
        } = this.props;
        const { inputs } = this.state;
        const liveEstimate = estimateOutputSize(inputs, terrains, this._targetResolutionM(), mergeExtent);
        const dims = mergeExtentDimsKm(mergeExtent);
        return (
            <div className="sv-tw-merge-extent-section" data-testid="merge-extent-section">
                <div className="sv-tw-merge-extent-row">
                    <Button
                        bsSize="small"
                        bsStyle={mergeExtentDrawing ? 'info' : 'default'}
                        className="sv-tw-save-btn"
                        onClick={mergeExtentDrawing ? onCancelMergeExtentDraw : onStartMergeExtentDraw}
                        disabled={saving || deriving}
                        data-testid="merge-extent-set-btn"
                    >
                        {mergeExtentDrawing
                            ? <Message msgId="hydrata.anuga.mergeExtentCancelButton" />
                            : <Message msgId="hydrata.anuga.mergeExtentSetButton" />}
                    </Button>
                    {dims && (
                        <span className="sv-tw-merge-extent-summary" data-testid="merge-extent-summary">
                            <Message msgId="hydrata.anuga.mergeExtentSummary" msgParams={{widthKm: dims.widthKm, heightKm: dims.heightKm}} />
                            <button
                                type="button"
                                className="sv-tw-icon-btn"
                                onClick={onClearMergeExtent}
                                disabled={saving || deriving}
                                data-testid="merge-extent-clear-btn"
                            >
                                <Message msgId="hydrata.anuga.mergeExtentClearButton" />
                            </button>
                        </span>
                    )}
                </div>
                {liveEstimate && (
                    <div
                        className={`sv-tw-merge-extent-estimate${liveEstimate.tooLarge ? ' sv-tw-merge-extent-estimate--toolarge' : ''}`}
                        data-testid="merge-extent-live-estimate"
                    >
                        <Message msgId="hydrata.anuga.mergeExtentEstimateLabel" msgParams={{size: formatEstimateSize(liveEstimate)}} />
                    </div>
                )}
            </div>
        );
    }

    render() {
        const { surface, terrains, deriving, deriveError, saving, saveError } = this.props;
        const { feather_width_m, target_resolution_m, inputs, confirmOpen, sizeEstimate } = this.state;
        const canDerive = this._canDerive();
        const allUnmodified = inputs.length > 0 && inputs.every(d => d.unmodified);
        return (
            <div className="sv-tw-recipe-builder" data-testid="recipe-builder">
                {/* TASK-1671: single DEM stack (replaces TWDesignInputPicker + regional terrain picker) */}
                <TWDemStackPicker
                    terrains={terrains}
                    inputs={inputs}
                    onChange={(next) => this.setState({ inputs: next })}
                    disabled={saving || deriving}
                />
                {allUnmodified && (
                    <div className="sv-tw-validation-hint" data-testid="all-unmodified-hint">
                        At least one DEM must be modifiable (not set to unmodified).
                    </div>
                )}
                {/* TASK-1671: Parameters section — NO Save parameters button.
                    #10 (re-UAT): the "PARAMETERS" sub-heading was redundant with the
                    collapsible panel title and is removed. */}
                {/* Terrain conditioning (breach/fill, flow direction, accumulation)
                    is deferred to the terrain-delineation epic (epic B). The merge
                    dialog now exposes ONLY the two merge params (feather width +
                    target resolution); the Terrain-breaches / Breach-max-cost /
                    Breach-search-dist inputs were removed. */}
                <div className="sv-tw-params-section tw-params-section">
                    <div className="sv-tw-param-grid">
                        <label>Feather width (m)</label>
                        <input type="number" className="sv-tw-number-input" value={feather_width_m} min="1" onChange={(e) => this.handleParam('feather_width_m', e.target.value)} disabled={saving || deriving} data-testid="feather-width-input"/>
                        <label>Target resolution (m)</label>
                        <input type="number" className="sv-tw-number-input" value={target_resolution_m} min="0.1" step="0.1" onChange={(e) => this.handleParam('target_resolution_m', e.target.value)} disabled={saving || deriving} data-testid="target-res-input"/>
                    </div>
                    {/* TASK-1671: Save parameters button REMOVED — params saved atomically on derive */}
                    {/* TASK-2582 (W2a): 'Set extent' lives directly under Target resolution (m). */}
                    {this.renderMergeExtentSection()}
                </div>
                {/* TASK-1674: tw-error -> shared ErrorStrip. The {saveError && …} guard is
                    kept (rather than leaning on ErrorStrip's self-hide) so the data-testid
                    wrapper still appears/disappears exactly as before — ErrorStrip does not
                    forward arbitrary DOM props, hence the wrapper carries the testid. */}
                {saveError && (
                    <div data-testid="save-error">
                        <ErrorStrip message={saveError} extraClassName="sv-tw-error tw-error"/>
                    </div>
                )}
                {/* TASK-1671: Derive section — single button triggers confirm dialog */}
                <div className="sv-tw-derive-section">
                    <Button
                        bsStyle="primary"
                        bsSize="small"
                        className="sv-tw-derive-btn"
                        onClick={this.handleDeriveClick}
                        disabled={!canDerive}
                        data-testid="derive-btn"
                    >
                        {/* #9 (re-UAT): "Derive terrain" renamed to "Create". */}
                        {deriving ? 'Creating…' : 'Create'}
                    </Button>
                    {deriving && <div className="sv-tw-derive-progress" data-testid="derive-progress">Processing — watch the Task Monitor for progress.</div>}
                    {/* TASK-1674: tw-error -> shared ErrorStrip (testid kept on the wrapper). */}
                    {deriveError && (
                        <div data-testid="derive-error">
                            <ErrorStrip message={deriveError} extraClassName="sv-tw-error tw-error"/>
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

// TASK-1800 (W1.9 UAT r2): the surface LIST (TWSurfaceList / TWSurfaceListItem),
// the "+ New analysis surface" button, the per-row delete and the inline rename
// were REMOVED. A project owns a SINGLE combined surface — the panel edits exactly
// one (MergeTerrainsPanel.pickCombinedSurface), so there is no list to render and
// no name to edit. The AnalysisSurface model / API / 'terrainWorkbench' slice are
// unchanged; only the panel UI dropped the multi-surface chrome.

// ── end TASK-1645 recipe builder components ──────────────────────────────────

export {
    TW_PARAM_DEFAULTS,
    estimateOutputSize,
    // TASK-2582 (W2a): Merge extent — live output estimate + summary formatting.
    formatEstimateSize,
    mergeExtentDimsKm,
    TWStaleBadge,
    TWSeamQAPanel,
    TWDemStackPicker,
    TWDeriveConfirmDialog,
    TWRecipeBuilder
};
