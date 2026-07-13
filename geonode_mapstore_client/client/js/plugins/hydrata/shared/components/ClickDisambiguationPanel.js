/*
 * TASK-1993 (W2.1) — ClickDisambiguationPanel.
 *
 * Generalised from Swamm/components/bmpForm/BmpChooserModal.js: a small modal
 * chooser that lists the openable candidates produced by the map-click
 * classifier (clickDisambiguationEpic, W1.2) and, on row-click, OPENS the
 * chosen one. It mirrors BmpChooserModal's structure (overlay + simple-view
 * panel + PanelHeader + one row per candidate) and reuses the same SimpleView
 * primitives so it sits visually with the rest of the ANUGA panels.
 *
 * D6 SERIALIZATION INVARIANT (shared/clickTargetRegistry.js): the candidate
 * objects in Redux state carry ONLY plain data — {kind, featureId, layerName,
 * label:{title,subtitle,icon}}. No opener FUNCTION is ever stored in state or
 * props-from-state. On row-click the opener is resolved AT CLICK TIME from the
 * module-side registry via getClickTarget(kind).buildOpenActions(...) inside
 * mapDispatchToProps, and only the RESULTING plain actions are dispatched.
 *
 * STATE PATH: the clickDisambiguation slice is mounted under the ANUGA plugin's
 * combineReducers (reducersAnuga.js), so it lives at
 * state.anuga.clickDisambiguation — mirroring Swamm's
 * state.swamm.bmpChooserCandidates precedent. (The W1 reducer's `candidates`
 * shape is unchanged; only its mount point is decided here.)
 *
 * W2 GATE: the connected container is state-gated to render only when there are
 * >= 2 candidates (mapStateToProps surfaces [] below that threshold). The
 * single-candidate skip-list and the empty-list fallthrough to the default
 * Identify popup are W3.3 (TASK-1998); the classifier epic already only
 * dispatches showClickDisambiguation for >= 2, so the gate is belt-and-braces.
 */
import React from 'react';
import { connect } from 'react-redux';
import { getClickTarget } from '../clickTargetRegistry';
import { hideClickDisambiguation } from '../../Anuga/actions/clickDisambiguationActions';
// TASK-2235 — the chooser rides the MovablePanel primitive (drag + resize +
// per-panelId persistence on the anuga ui slice, the FloatingDemLegendPanel
// pattern) instead of a bespoke PanelHeader shell. The dim backdrop stays;
// only a click on the backdrop ITSELF closes (a click inside the panel — or a
// drag that ends over the backdrop — must not).
import { MovablePanel } from './MovablePanel';
import { setMovablePanelState } from '../../Anuga/actions/uiActions';
import './clickDisambiguation.css';

/**
 * Resolve the plain open-actions for a candidate AT CLICK TIME (D6).
 *
 * The candidate carries only plain data; the opener FUNCTION lives module-side
 * in the registry. We rebuild the minimal feature shape the opener needs from
 * the candidate's featureId (the full GML id == GFI feature.id) — the ANUGA
 * EDIT opener reads only feature.id (it re-derives the layer name + WFS
 * featureID from it). Returns [] for an unknown kind or a throwing opener so a
 * stray click can never crash the panel.
 *
 * @param {{kind:string, featureId:string}} candidate
 * @param {Function} [getState] redux getState, passed through to buildOpenActions
 * @returns {Array<object>} plain Redux actions
 */
export const resolveCandidateOpenActions = (candidate, getState) => {
    const target = getClickTarget(candidate && candidate.kind);
    if (!target) { return []; }
    try {
        return target.buildOpenActions({ id: candidate.featureId }, getState) || [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('ClickDisambiguationPanel: buildOpenActions failed', e);
        return [];
    }
};

export const CLICK_DISAMBIGUATION_PANEL_ID = 'clickDisambiguation';

// The MovablePanel is position:fixed, so the backdrop no longer centres it —
// first open lands centred-ish below the top nav; MovablePanel clamps any
// persisted position back on-screen.
function defaultChooserPosition() {
    if (typeof window === 'undefined') { return { x: 0, y: 0 }; }
    return {
        x: Math.max(8, Math.round((window.innerWidth - 360) / 2)),
        y: Math.max(56, Math.round(window.innerHeight * 0.18))
    };
}

const overlayStyle = {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1030
};

const rowStyle = {
    cursor: 'pointer',
    padding: '8px',
    marginBottom: 4,
    borderRadius: 'var(--sv-card-radius, 4px)',
    backgroundColor: 'var(--sv-row-hover-bg, rgba(255,255,255,0.10))'
};

/**
 * Presentational chooser. Renders one row per candidate from its RESOLVED
 * plain label ({title, subtitle, icon}); renders null when there is nothing to
 * choose. Row-click invokes onSelect(candidate); the overlay / close chip
 * invokes onClose.
 */
export const ClickDisambiguationPanel = ({ candidates, onSelect, onClose, panelState, onPanelStateChange }) => {
    if (!candidates || candidates.length === 0) { return null; }
    const persist = onPanelStateChange || (() => {});

    return (
        <div
            className="click-disambiguation-overlay"
            style={overlayStyle}
            onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
        >
            <MovablePanel
                panelId={CLICK_DISAMBIGUATION_PANEL_ID}
                className="click-disambiguation-panel"
                title={<span>Select a feature</span>}
                onClose={onClose}
                position={panelState?.position}
                size={panelState?.size}
                defaultPosition={defaultChooserPosition()}
                onMove={(position) => persist(CLICK_DISAMBIGUATION_PANEL_ID, { position })}
                onResize={(size) => persist(CLICK_DISAMBIGUATION_PANEL_ID, { size })}
            >
                {candidates.map((candidate) => {
                    const label = candidate.label || {};
                    return (
                        <div
                            key={candidate.featureId}
                            className="simple-view-panel-item-row click-disambiguation-row"
                            style={rowStyle}
                            onClick={() => onSelect(candidate)}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sv-input-bg, rgba(255,255,255,0.22))'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--sv-row-hover-bg, rgba(255,255,255,0.10))'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {label.icon ? (
                                    <span
                                        className={`glyphicon glyphicon-${label.icon} click-disambiguation-row-icon`}
                                        style={{ marginRight: 8, opacity: 0.85 }}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <strong>{candidate.layerTitle || label.title || candidate.kind}</strong>
                            </div>
                            {label.subtitle ? (
                                <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: 2 }}>
                                    {label.subtitle}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </MovablePanel>
        </div>
    );
};

// Strip an optional leading workspace namespace so a BARE candidate layerName
// matches the workspace-qualified state.layers.flat name ("geonode:<layer>").
const bareLayerName = (name) => String(name || '').replace(/^[^:./]+:/, '');

/**
 * Resolve a layer's human-readable title from state.layers.flat by candidate
 * layerName (namespace-insensitive). This is what disambiguates same-TYPE rows
 * in the chooser — e.g. several "Terrain elevation" rasters become "Copernicus
 * GLO-30 DEM" vs "Combined surface (derived)". Returns null when the layer is
 * absent (or untitled) so the row falls back to the generic type label.
 */
export const resolveLayerTitle = (layerName, state) => {
    const flat = state?.layers?.flat || [];
    const bare = bareLayerName(layerName);
    const layer = flat.find((l) => l && bareLayerName(l.name) === bare);
    return (layer && layer.title) || null;
};

// W2 gate: only surface candidates when there are >= 2 to disambiguate. Below
// that, the presentational component renders null (single-candidate skip-list +
// empty-list fallthrough are W3.3). Each surfaced candidate is enriched
// (presentation-only, NOT stored in Redux / dispatched — D6 unaffected) with the
// live layer title so the row shows the actual object layer, not just its type.
export const mapStateToProps = (state) => {
    const candidates = state?.anuga?.clickDisambiguation?.candidates || [];
    if (candidates.length < 2) {
        return { candidates: [] };
    }
    return {
        candidates: candidates.map((c) => ({
            ...c,
            layerTitle: resolveLayerTitle(c.layerName, state)
        })),
        // TASK-2235 — persisted MovablePanel position/size for this panelId.
        panelState: state?.anuga?.ui?.movablePanels?.[CLICK_DISAMBIGUATION_PANEL_ID]
    };
};

const mapDispatchToProps = (dispatch) => ({
    // Resolve the opener AT CLICK TIME (D6). A thunk gives buildOpenActions the
    // live getState; only the resulting plain actions are dispatched, then the
    // chooser is dismissed.
    onSelect: (candidate) => dispatch((thunkDispatch, getState) => {
        resolveCandidateOpenActions(candidate, getState).forEach((action) => thunkDispatch(action));
        thunkDispatch(hideClickDisambiguation());
    }),
    onClose: () => dispatch(hideClickDisambiguation()),
    onPanelStateChange: (panelId, patch) => dispatch(setMovablePanelState(panelId, patch))
});

export default connect(mapStateToProps, mapDispatchToProps)(ClickDisambiguationPanel);
