/**
 * TASK-1800 (W1.9 UAT) — stand-alone "Combined surface" side panel.
 *
 * The Analysis-Surface recipe builder used to live in an inline expandable
 * section inside the Inputs->Terrain pane. It is now a stand-alone dark-glass
 * side panel (PanelShell + PanelHeader), opened by the custom-icon "Combined
 * surface" button in the Terrain pane header (anugaInputMenu.js).
 *
 * Mounted at the anugaContainer level (next to TerrainBboxPanel) — NOT inside
 * AnugaInputMenu — so closing the Inputs menu can't unmount it mid-edit
 * (TASK-1648 lesson). Self-gates on terrainWorkbench.visible: returns null when
 * not visible.
 *
 * TASK-1800 (W1.9 UAT r2): a project owns a SINGLE combined surface. The panel no
 * longer renders the surface LIST / "+ New" button / "New Analysis Surface N"
 * auto-names — it edits exactly ONE combined surface. The on-screen term is
 * "Combined surface" (the backend AnalysisSurface model / API / 'terrainWorkbench'
 * slice are UNCHANGED — user-facing label only). The single surface is chosen by
 * pickCombinedSurface(): prefer the most-recent (highest id) DERIVED surface (one
 * with an output_terrain), else the most-recent surface of any kind. When the
 * project has ZERO surfaces the builder edits a synthetic placeholder surface
 * (id absent) and twDerive lazily materialises a single row at derive time
 * (twDeriveEpic create-then-derive) — no list, no name, no data litter on open.
 *
 * The recipe-builder pieces (TWRecipeBuilder / TW_PARAM_DEFAULTS) are imported
 * from the shared recipeBuilderComponents module (also extracted by TASK-1800).
 */
import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import Message from '@mapstore/framework/components/I18N/Message';
import { PanelShell, PanelHeader, ErrorStrip, EmptyState } from '../../SimpleView/components/primitives';
import {
    setTerrainWorkbenchVisible,
    twLoadData,
    twUpdateSurface,
    twDerive
} from '../actionsTerrainWorkbench';
import { TWRecipeBuilder, TW_PARAM_DEFAULTS } from './recipeBuilderComponents';
import '../terrainWorkbench.css';

/**
 * pickCombinedSurface — deterministic single-surface selection rule.
 *
 * A project owns ONE combined surface, but legacy projects may carry several
 * AnalysisSurface rows. Pick exactly one, never showing the others:
 *   1. the most-recent (highest id) surface that has a DERIVED output
 *      (output_terrain set) — the "live" combined surface; else
 *   2. the most-recent (highest id) surface of any kind.
 * Returns null when there are no surfaces.
 */
export function pickCombinedSurface(surfaces) {
    const list = surfaces || [];
    if (list.length === 0) return null;
    const byIdDesc = (a, b) => (b.id || 0) - (a.id || 0);
    const derived = list.filter(s => s.output_terrain).sort(byIdDesc);
    if (derived.length) return derived[0];
    return [...list].sort(byIdDesc)[0];
}

// Synthetic placeholder surface the builder edits when the project has ZERO
// rows. id is null — twDerive(null, body) triggers the lazy create-then-derive.
const PLACEHOLDER_SURFACE = {
    id: null,
    title: 'Combined surface',
    inputs_ordered: [],
    use_culverts: false,
    ...TW_PARAM_DEFAULTS
};

/**
 * MergeTerrainsIcon — custom presentational SVG for the header button.
 * Layered mountain (triangle split into three horizontal layers) with a small
 * cog badge in the upper-right corner. Uses currentColor so the surrounding
 * `.sv-glyph-active` rule colours it limegreen, and 1em sizing so the
 * `.sv-menu-row-glyph` icon box centres it.
 */
export function MergeTerrainsIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            {/* layered mountain — triangle split into three horizontal layers */}
            <path d="M11 6 L19.5 19.5 H2.5 Z" />
            <line x1="7.2" y1="13" x2="14.8" y2="13" />
            <line x1="5" y1="16.4" x2="17" y2="16.4" />
            {/* cog badge, upper-right corner (clear of the mountain's right slope) */}
            <circle cx="18.7" cy="6.2" r="1.9" strokeWidth={1.3} />
            <g strokeWidth={1.3}>
                <line x1="18.7" y1="3.1" x2="18.7" y2="4.2" /><line x1="18.7" y1="8.2" x2="18.7" y2="9.3" />
                <line x1="15.6" y1="6.2" x2="16.7" y2="6.2" /><line x1="20.7" y1="6.2" x2="21.8" y2="6.2" />
                <line x1="16.5" y1="4" x2="17.3" y2="4.8" /><line x1="20.1" y1="7.6" x2="20.9" y2="8.4" />
                <line x1="20.9" y1="4" x2="20.1" y2="4.8" /><line x1="17.3" y1="7.6" x2="16.5" y2="8.4" />
            </g>
        </svg>
    );
}

export class MergeTerrainsPanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        terrains: PropTypes.array,
        // The single combined surface to edit (null → edit a synthetic placeholder).
        surface: PropTypes.object,
        loading: PropTypes.bool,
        error: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        onClose: PropTypes.func,
        onUpdateSurface: PropTypes.func,
        onDerive: PropTypes.func
    };

    static defaultProps = {
        visible: false,
        terrains: [],
        surface: null,
        loading: false,
        error: null,
        saving: false,
        saveError: null,
        deriving: false,
        deriveError: null
    };

    render() {
        if (!this.props.visible) return null;
        const {
            terrains, surface,
            loading, error, saving, saveError, deriving, deriveError,
            onClose, onUpdateSurface, onDerive
        } = this.props;
        const hasTerrains = (terrains || []).length >= 1;
        // TASK-1800 (r2): a project owns ONE combined surface. Edit the selected
        // surface, or a synthetic placeholder (id null) when none exists yet — the
        // user can still build + derive; twDerive lazily creates the row.
        const editSurface = surface || PLACEHOLDER_SURFACE;

        return (
            <PanelShell extraClassName="sv-merge-terrains-panel">
                <PanelHeader
                    title={<Message msgId="hydrata.anuga.combinedSurfacePanelTitle" />}
                    onClose={onClose}
                />
                <div className="sv-merge-terrains-body" data-testid="merge-terrains-panel">
                    {/* Empty state: with ZERO terrains there is nothing to combine. */}
                    {!hasTerrains ? (
                        <div data-testid="merge-terrains-empty">
                            <EmptyState extraClassName="sv-tw-empty-hint tw-empty-hint">
                                Add a terrain first — there is nothing to combine yet.
                            </EmptyState>
                        </div>
                    ) : (
                        <React.Fragment>
                            {loading && <div className="sv-tw-loading">Loading…</div>}
                            {/* TASK-1674: tw-error -> shared ErrorStrip (testid kept on the wrapper). */}
                            {error && (
                                <div data-testid="tw-load-error">
                                    <ErrorStrip message={error} extraClassName="sv-tw-error tw-error"/>
                                </div>
                            )}
                            {!loading && !error && (
                                <TWRecipeBuilder
                                    // Re-mount the builder when switching between the
                                    // synthetic placeholder and a real row so its
                                    // local param/input state re-seeds from the surface.
                                    key={(editSurface.id === null || editSurface.id === undefined) ? 'tw-placeholder' : `tw-${editSurface.id}`}
                                    surface={editSurface}
                                    terrains={terrains || []}
                                    deriving={deriving}
                                    deriveError={deriveError}
                                    saving={saving}
                                    saveError={saveError}
                                    onUpdate={onUpdateSurface}
                                    onDerive={onDerive}
                                />
                            )}
                        </React.Fragment>
                    )}
                </div>
            </PanelShell>
        );
    }
}

const mapStateToProps = (state) => {
    const surfaces = state?.terrainWorkbench?.surfaces || [];
    const selectedSurfaceId = state?.terrainWorkbench?.selectedSurfaceId || null;
    // Prefer an explicitly-selected surface (e.g. twSelectSurfaceForTerrain from a
    // derived terrain row); otherwise apply the deterministic single-surface rule.
    // selectedSurfaceId is already coalesced to null above (|| null).
    const selected = selectedSurfaceId
        ? surfaces.find(s => s.id === selectedSurfaceId)
        : null;
    return {
        visible: !!state?.terrainWorkbench?.visible,
        terrains: state?.terrainWorkbench?.terrains || [],
        surface: selected || pickCombinedSurface(surfaces),
        loading: state?.terrainWorkbench?.loading || false,
        error: state?.terrainWorkbench?.error || null,
        saving: state?.terrainWorkbench?.saving || false,
        saveError: state?.terrainWorkbench?.saveError || null,
        deriving: state?.terrainWorkbench?.deriving || false,
        deriveError: state?.terrainWorkbench?.deriveError || null
    };
};

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(setTerrainWorkbenchVisible(false)),
    onLoadData: () => dispatch(twLoadData()),
    onUpdateSurface: (id, payload) => dispatch(twUpdateSurface(id, payload)),
    onDerive: (id, body) => dispatch(twDerive(id, body))
});

export const MergeTerrainsPanel = connect(mapStateToProps, mapDispatchToProps)(MergeTerrainsPanelClass);
