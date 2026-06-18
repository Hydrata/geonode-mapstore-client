/**
 * TASK-1800 (W1.9 UAT) — stand-alone "Merge terrains" side panel.
 *
 * The Analysis-Surface recipe builder used to live in an inline expandable
 * section inside the Inputs->Terrain pane. It is now a stand-alone dark-glass
 * side panel (PanelShell + PanelHeader), opened by the custom-icon "Merge
 * terrains" button in the Terrain pane header (anugaInputMenu.js).
 *
 * Mounted at the anugaContainer level (next to TerrainBboxPanel) — NOT inside
 * AnugaInputMenu — so closing the Inputs menu can't unmount it mid-edit
 * (TASK-1648 lesson). Self-gates on terrainWorkbench.visible: returns null when
 * not visible.
 *
 * The recipe-builder pieces (TWSurfaceList / TWRecipeBuilder / TW_PARAM_DEFAULTS)
 * are imported from the shared recipeBuilderComponents module (also extracted by
 * TASK-1800) so this panel and the legacy pane share one definition.
 */
import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import Message from '@mapstore/framework/components/I18N/Message';
import { PanelShell, PanelHeader, ErrorStrip, EmptyState } from '../../SimpleView/components/primitives';
import {
    setTerrainWorkbenchVisible,
    twLoadData,
    twSelectSurface,
    twCreateSurface,
    twUpdateSurface,
    twDeleteSurface,
    twDerive
} from '../actionsTerrainWorkbench';
import { TWSurfaceList, TWRecipeBuilder, TW_PARAM_DEFAULTS } from './recipeBuilderComponents';
import '../terrainWorkbench.css';

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
        surfaces: PropTypes.array,
        selectedSurfaceId: PropTypes.number,
        loading: PropTypes.bool,
        error: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        onClose: PropTypes.func,
        onSelectSurface: PropTypes.func,
        onCreateSurface: PropTypes.func,
        onUpdateSurface: PropTypes.func,
        onDeleteSurface: PropTypes.func,
        onDerive: PropTypes.func
    };

    static defaultProps = {
        visible: false,
        terrains: [],
        surfaces: [],
        selectedSurfaceId: null,
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
            terrains, surfaces, selectedSurfaceId,
            loading, error, saving, saveError, deriving, deriveError,
            onClose, onSelectSurface, onCreateSurface, onUpdateSurface, onDeleteSurface, onDerive
        } = this.props;
        const selectedSurface = (surfaces || []).find(s => s.id === selectedSurfaceId) || null;
        const hasTerrains = (terrains || []).length >= 1;

        return (
            <PanelShell extraClassName="sv-merge-terrains-panel">
                <PanelHeader
                    title={<Message msgId="hydrata.anuga.mergeTerrainsPanelTitle" />}
                    onClose={onClose}
                />
                <div className="sv-merge-terrains-body" data-testid="merge-terrains-panel">
                    {/* Empty state: with ZERO terrains there is nothing to merge. */}
                    {!hasTerrains ? (
                        <div data-testid="merge-terrains-empty">
                            <EmptyState extraClassName="sv-tw-empty-hint tw-empty-hint">
                                Add a terrain first — there is nothing to merge yet.
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
                                <React.Fragment>
                                    <TWSurfaceList
                                        surfaces={surfaces || []}
                                        selectedId={selectedSurfaceId}
                                        onSelect={onSelectSurface}
                                        onRename={(id, title) => onUpdateSurface(id, { title })}
                                        onDelete={onDeleteSurface}
                                        onNew={() => onCreateSurface({
                                            title: `New Analysis Surface ${(surfaces || []).length + 1}`,
                                            use_culverts: false,
                                            ...TW_PARAM_DEFAULTS,
                                        })}
                                        saving={saving}
                                        createError={!selectedSurface ? saveError : null}
                                    />
                                    {selectedSurface && (
                                        <TWRecipeBuilder
                                            surface={selectedSurface}
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
                        </React.Fragment>
                    )}
                </div>
            </PanelShell>
        );
    }
}

const mapStateToProps = (state) => ({
    visible: !!state?.terrainWorkbench?.visible,
    terrains: state?.terrainWorkbench?.terrains || [],
    surfaces: state?.terrainWorkbench?.surfaces || [],
    selectedSurfaceId: state?.terrainWorkbench?.selectedSurfaceId || null,
    loading: state?.terrainWorkbench?.loading || false,
    error: state?.terrainWorkbench?.error || null,
    saving: state?.terrainWorkbench?.saving || false,
    saveError: state?.terrainWorkbench?.saveError || null,
    deriving: state?.terrainWorkbench?.deriving || false,
    deriveError: state?.terrainWorkbench?.deriveError || null
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(setTerrainWorkbenchVisible(false)),
    onLoadData: () => dispatch(twLoadData()),
    onSelectSurface: (id) => dispatch(twSelectSurface(id)),
    onCreateSurface: (payload) => dispatch(twCreateSurface(payload)),
    onUpdateSurface: (id, payload) => dispatch(twUpdateSurface(id, payload)),
    onDeleteSurface: (id) => dispatch(twDeleteSurface(id)),
    onDerive: (id, body) => dispatch(twDerive(id, body))
});

export const MergeTerrainsPanel = connect(mapStateToProps, mapDispatchToProps)(MergeTerrainsPanelClass);
