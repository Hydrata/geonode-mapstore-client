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

// ── TASK-2970 (W3.7): DEM resolution display + the coarser-above-finer rule ──
//
// Origin: prod map 6629. `addTerrain` appended every new DEM at the BOTTOM, so a
// modeller who picked the regional GLO-30 first and their 0.5 m lidar second ended
// up with the COARSE DEM on TOP. The merge core pastes higher-priority tiles over
// the base wherever they are valid, and GLO-30 was valid on 100 % of the grid — so
// the survey contributed ZERO pixels to a nominally 1 m output. Nothing on screen
// said which DEM was coarse.

// Format a native resolution for a picker row: one decimal with a trailing ".0"
// dropped (30.7039 -> "30.7 m", 0.5 -> "0.5 m", 1 -> "1 m"), "?" when the terrain
// carries no native_resolution_m. Same 1-decimal shape as the server's
// `format_resolution_m` (gn_anuga/services_terrain_merge.py) so the 400's `detail`
// sentence and these rows read alike.
function formatResolutionM(resolutionM) {
    if (typeof resolutionM !== 'number' || !isFinite(resolutionM)) return '?';
    const oneDp = resolutionM.toFixed(1);
    return `${oneDp.endsWith('.0') ? oneDp.slice(0, -2) : oneDp} m`;
}

function describeTerrainResolution(terrain, resolutionM) {
    return {
        terrain_id: terrain.id,
        title: terrain.title || terrain.name,
        native_resolution_m: resolutionM
    };
}

// Client mirror of the BE's `find_coarser_above_finer` (services_terrain_merge.py):
// every (above, below) pair where a COARSER DEM sits above a FINER one. `inputs` is
// the FE recipe shape [{terrain_id, priority}] (priority 0 = TOP); `terrains` is the
// project terrain list. An entry whose terrain is unknown, or which carries no
// numeric native_resolution_m, never participates — the rule can only speak about
// resolutions it actually knows. Returns [] when the stack is fine.
//
// The SERVER is the enforcement; this is convenience, and it is deliberately blind
// when the terrain list is stale — which is exactly why the 400 carries its own
// `pairs` (see twDeriveEpic / coarserPairsFromServer).
function findCoarserAboveFiner(inputs, terrains) {
    const list = terrains || [];
    const resolved = (inputs || [])
        .map(inp => {
            const terrain = list.find(t => t.id === inp.terrain_id);
            const resolutionM = terrain ? terrain.native_resolution_m : null;
            if (!terrain || typeof resolutionM !== 'number' || !isFinite(resolutionM)) return null;
            const priority = parseInt(inp.priority, 10);
            return { priority: isNaN(priority) ? 0 : priority, terrain, resolutionM };
        })
        .filter(Boolean)
        .sort((a, b) => a.priority - b.priority);

    const pairs = [];
    for (let i = 0; i < resolved.length; i++) {
        for (let j = i + 1; j < resolved.length; j++) {
            if (resolved[i].resolutionM > resolved[j].resolutionM) {
                pairs.push({
                    above: describeTerrainResolution(resolved[i].terrain, resolved[i].resolutionM),
                    below: describeTerrainResolution(resolved[j].terrain, resolved[j].resolutionM)
                });
            }
        }
    }
    return pairs;
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

    // TASK-2970 (W3.7): where a newly-added DEM belongs in the stack.
    // Finest-on-top: the new entry goes ABOVE the first existing entry it should
    // outrank — one that is either coarser (strictly greater native_resolution_m)
    // or of UNKNOWN resolution (known resolutions sort before unknown ones). A new
    // entry whose OWN resolution is unknown appends at the bottom, exactly as
    // before. Only the new entry is placed: existing entries are never re-sorted,
    // so a deliberate inversion the modeller built with the ↑ button (the
    // design-over-survey case) survives the next add.
    const insertIndexFor = (terrainId) => {
        const added = terrains.find(t => t.id === terrainId);
        const addedRes = added ? added.native_resolution_m : null;
        if (typeof addedRes !== 'number' || !isFinite(addedRes)) return inputs.length;
        const idx = inputs.findIndex(d => {
            const t = terrains.find(x => x.id === d.terrain_id);
            const res = t ? t.native_resolution_m : null;
            if (typeof res !== 'number' || !isFinite(res)) return true;
            return res > addedRes;
        });
        return idx === -1 ? inputs.length : idx;
    };

    const addTerrain = (terrainId) => {
        const id = parseInt(terrainId, 10);
        if (!id || inputs.find(d => d.terrain_id === id)) return;
        // New entry inserted by resolution (TASK-2970; it used to always append at
        // the bottom) — always unmodified:false. Existing entries keep their flags;
        // only re-index priority.
        // Default-seamless (top=unmodified, rest=false) applies ONLY when the
        // stack was empty before this add (i.e. this is the first entry).
        const wasEmpty = inputs.length === 0;
        const at = insertIndexFor(id);
        const newEntry = { terrain_id: id, priority: at, unmodified: false };
        const combined = [...inputs.slice(0, at), newEntry, ...inputs.slice(at)];
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
                        {/* TASK-2970 (W3.7): the native resolution, so "which of these
                            is the coarse one" is answerable without leaving the panel. */}
                        <span className="sv-tw-input-res" title="Native resolution">
                            {formatResolutionM(t ? t.native_resolution_m : null)}
                        </span>
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
// TASK-2970 (W3.7): coarserPairs = [{above, below}] — every coarser-above-finer
// inversion in the stack, from the client mirror OR (when the client's terrain
// list was stale) from the server's own 400. When present the dialog names each
// pair with both resolutions, names design-over-survey as the legitimate case, and
// the confirm button becomes "Derive anyway" — a deliberate acknowledgement, never
// a hard block.
function TWDeriveConfirmDialog({ sizeEstimate, coarserPairs, onConfirm, onCancel }) {
    const tooLarge = sizeEstimate && sizeEstimate.tooLarge;
    const pairs = coarserPairs || [];
    const hasCoarserPairs = pairs.length > 0;
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
                        {hasCoarserPairs && (
                            <div className="sv-tw-derive-confirm-warning" data-testid="derive-confirm-coarser-warning">
                                <div className="sv-tw-derive-confirm-warning-title">
                                    <Message msgId="hydrata.anuga.terrainMergeCoarserWarningTitle" />
                                </div>
                                <ul className="sv-tw-derive-confirm-warning-pairs">
                                    {pairs.map((pair, i) => (
                                        <li key={`${pair.above.terrain_id}-${pair.below.terrain_id}-${i}`} data-testid={`coarser-pair-${i}`}>
                                            <strong>{pair.above.title}</strong>
                                            {` (${formatResolutionM(pair.above.native_resolution_m)}) `}
                                            <Message msgId="hydrata.anuga.terrainMergeCoarserPairSitsAbove" />
                                            {' '}
                                            <strong>{pair.below.title}</strong>
                                            {` (${formatResolutionM(pair.below.native_resolution_m)})`}
                                        </li>
                                    ))}
                                </ul>
                                <div className="sv-tw-derive-confirm-warning-body">
                                    <Message msgId="hydrata.anuga.terrainMergeCoarserWarningBody" />
                                </div>
                            </div>
                        )}
                        <div className="sv-tw-derive-confirm-actions">
                            <Button bsStyle="primary" bsSize="small" className="sv-tw-derive-btn" onClick={onConfirm} data-testid="derive-confirm-ok">
                                {hasCoarserPairs
                                    ? <Message msgId="hydrata.anuga.terrainMergeDeriveAnywayButton" />
                                    : 'Derive'}
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
    // TASK-2970 (W3.7) — [{above:{terrain_id,title,native_resolution_m}, below:{…}}]
    coarserPairs: PropTypes.array,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};
TWDeriveConfirmDialog.defaultProps = { sizeEstimate: null, coarserPairs: [] };

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
        onClearMergeExtent: PropTypes.func,
        // TASK-2580 (W2-reaim change 2): notified whenever the derive-confirm
        // dialog opens/closes, so the hosting MergeTerrainsPanel can toggle a
        // growth modifier class on the MovablePanel (CSS-only — see
        // terrainWorkbench.css's --confirm-open rule).
        onConfirmOpenChange: PropTypes.func,
        // TASK-2970 (W3.7): the SERVER's coarser-above-finer pairs from a refused
        // derive (state.terrainWorkbench.deriveCoarserPairs). Arriving non-empty
        // RE-OPENS the confirm dialog seeded with them, so the user can
        // acknowledge an inversion the (stale-terrains) client mirror missed.
        coarserPairsFromServer: PropTypes.array
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
        onClearMergeExtent: () => {},
        onConfirmOpenChange: () => {},
        coarserPairsFromServer: null
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
            // TASK-2580 (W2-reaim change 1): Combined surface NAME. Initial value
            // = the surface's current title (PLACEHOLDER_SURFACE.title for a
            // not-yet-created surface — MergeTerrainsPanel.js).
            title: s.title ?? '',
            feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
            target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
            // TASK-1671: single ordered DEM stack (replaces designInputs + regional_terrain)
            inputs: TWRecipeBuilder._inputsFromSurface(s),
            // Confirm dialog state
            confirmOpen: false,
            sizeEstimate: null, // { estimatedGB, tooLarge } | null
            // TASK-2970 (W3.7): the pairs THIS dialog was opened with — client
            // mirror at Create-click, or the server's own on a refused derive.
            // handleConfirmDerive reads THIS, never a fresh recompute: on the
            // server path the client is blind (stale terrains), so recomputing
            // would drop the flag, earn another 400, and re-open forever.
            coarserPairs: []
        };
    }

    componentDidUpdate(prevProps, prevState) {
        // Re-sync when switching surface or when the server updates inputs_ordered.
        if (prevProps.surface.id !== this.props.surface.id) {
            const s = this.props.surface;
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({
                title: s.title ?? '',
                feather_width_m: s.feather_width_m ?? TW_PARAM_DEFAULTS.feather_width_m,
                target_resolution_m: s.target_resolution_m ?? TW_PARAM_DEFAULTS.target_resolution_m,
                inputs: TWRecipeBuilder._inputsFromSurface(s),
                confirmOpen: false,
                sizeEstimate: null,
                coarserPairs: []
            });
        } else if (prevProps.surface.inputs_ordered !== this.props.surface.inputs_ordered) {
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({ inputs: TWRecipeBuilder._inputsFromSurface(this.props.surface) });
        } else if (prevProps.surface.title !== this.props.surface.title) {
            // The BE re-fetch after a successful PATCH/derive can bring back a
            // title the user didn't just type locally (e.g. a stale response
            // racing a second edit) — resync so the field never shows a value
            // the server has already superseded.
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({ title: this.props.surface.title ?? '' });
        }
        // TASK-2970 (W3.7): the server refused the derive because a coarser DEM
        // sits above a finer one and the body carried no acknowledgement. Re-open
        // the confirm dialog seeded with the SERVER's pairs (the client mirror saw
        // nothing — its terrain list was stale) so "Derive anyway" re-sends with
        // the flag. Guarded on a non-empty arrival, so the reducer clearing the
        // field back to null on the next TW_DERIVE never re-triggers.
        const seededPairs = this.props.coarserPairsFromServer;
        if (prevProps.coarserPairsFromServer !== seededPairs
            && Array.isArray(seededPairs) && seededPairs.length) {
            // eslint-disable-next-line react/no-did-update-set-state -- guarded prop-sync
            this.setState({
                confirmOpen: true,
                coarserPairs: seededPairs,
                sizeEstimate: estimateOutputSize(
                    this.state.inputs, this.props.terrains,
                    this._targetResolutionM(), this.props.mergeExtent
                )
            });
        }
        // TASK-2580 (W2-reaim change 2): confirm-dialog open/close transition —
        // tell the parent panel (className toggle -> CSS growth) and, as the
        // too-small-viewport / previously-pinned-height fallback, scroll the
        // dialog into view. The CSS class handles the common case; this is a
        // harmless no-op when the dialog is already fully on-screen.
        if (prevState.confirmOpen !== this.state.confirmOpen) {
            if (this.props.onConfirmOpenChange) this.props.onConfirmOpenChange(this.state.confirmOpen);
            if (this.state.confirmOpen && this._confirmBoxEl && typeof this._confirmBoxEl.scrollIntoView === 'function') {
                this._confirmBoxEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    handleParam = (key, val) => this.setState({ [key]: val });

    // TASK-2580 (W2-reaim change 1): Combined surface NAME — free-typing local
    // state, PATCHed on blur via the EXISTING twUpdateSurfaceEpic path (the
    // same PATCH the BE sibling's dispatch-race fix already covers), NOT
    // folded into the derive body (a body-only param would hit that race).
    handleTitleChange = (value) => this.setState({ title: value });

    handleTitleBlur = () => {
        const { surface, onUpdate } = this.props;
        // A not-yet-created placeholder surface (surface.id null — see
        // MergeTerrainsPanel.PLACEHOLDER_SURFACE) has nothing to PATCH yet;
        // the typed name simply becomes the field's local starting value,
        // exactly like feather_width_m/target_resolution_m are ALSO
        // local-only until the surface is first created/derived.
        if (surface.id === null || surface.id === undefined) return;
        const title = (this.state.title || '').trim();
        // No-op when unchanged so tabbing through the field without editing
        // never fires a spurious PATCH.
        if (title === (surface.title || '')) return;
        onUpdate(surface.id, { title });
    };

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
        // TASK-2970 (W3.7): the client mirror of the BE guard. Pairs here turn the
        // confirm dialog into the design-over-survey acknowledgement.
        this.setState({
            confirmOpen: true,
            sizeEstimate,
            coarserPairs: findCoarserAboveFiner(inputs, terrains)
        });
    };

    handleConfirmDerive = () => {
        const { surface, onDerive, mergeExtent } = this.props;
        const { inputs, feather_width_m, target_resolution_m, coarserPairs } = this.state;
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
        // TASK-2970 (W3.7): the acknowledgement rides ONLY when this dialog was
        // opened over an inversion — a sane stack must not send the key at all
        // (an always-true flag would silently disarm the server guard). Read from
        // state, NOT a recompute: on the server-seeded path the client is blind.
        if ((coarserPairs || []).length) {
            body.acknowledge_coarser_above_finer = true;
        }
        onDerive(surface.id, body);
    };

    handleCancelDerive = () => {
        this.setState({ confirmOpen: false, sizeEstimate: null, coarserPairs: [] });
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
        const { title, feather_width_m, target_resolution_m, inputs, confirmOpen, sizeEstimate, coarserPairs } = this.state;
        const canDerive = this._canDerive();
        const allUnmodified = inputs.length > 0 && inputs.every(d => d.unmodified);
        return (
            <div className="sv-tw-recipe-builder" data-testid="recipe-builder">
                {/* TASK-2580 (W2-reaim change 1): Combined surface NAME — ABOVE the
                    'Merge terrains' layering UI (operator UAT). Wired to
                    AnalysisSurface.title via the EXISTING twUpdateSurfaceEpic PATCH
                    path (onUpdate), fired on blur — NOT the derive body (see
                    handleTitleBlur). The derived terrain's title
                    (`f'{surface.title} (derived)'`, tasks.py) and the derive
                    Process label both read this field, so a rename here flows
                    everywhere with zero BE change. */}
                <div className="sv-tw-field sv-tw-combined-surface-name-field" data-testid="combined-surface-name-row">
                    <label htmlFor="combined-surface-name-input" className="sv-tw-label sv-tw-label-normalcase">
                        <Message msgId="hydrata.anuga.combinedSurfaceNameLabel" />
                    </label>
                    <input
                        id="combined-surface-name-input"
                        type="text"
                        className="sv-tw-title-input"
                        value={title}
                        onChange={(e) => this.handleTitleChange(e.target.value)}
                        onBlur={this.handleTitleBlur}
                        disabled={saving || deriving}
                        data-testid="combined-surface-name-input"
                    />
                </div>
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
                {/* TASK-1671: Size-confirm dialog.
                    TASK-2580 (W2-reaim change 2): the wrapping ref is the
                    too-small-viewport / previously-pinned-height scrollIntoView
                    fallback (componentDidUpdate above) — the CSS growth
                    (--confirm-open) handles the common case. */}
                {confirmOpen && (
                    <div ref={(el) => { this._confirmBoxEl = el; }}>
                        <TWDeriveConfirmDialog
                            sizeEstimate={sizeEstimate}
                            coarserPairs={coarserPairs}
                            onConfirm={this.handleConfirmDerive}
                            onCancel={this.handleCancelDerive}
                        />
                    </div>
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
    // TASK-2970 (W3.7): DEM resolution display + the coarser-above-finer mirror.
    formatResolutionM,
    findCoarserAboveFiner,
    // TASK-2582 (W2a): Merge extent — live output estimate + summary formatting.
    formatEstimateSize,
    mergeExtentDimsKm,
    TWStaleBadge,
    TWSeamQAPanel,
    TWDemStackPicker,
    TWDeriveConfirmDialog,
    TWRecipeBuilder
};
