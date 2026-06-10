/**
 * TASK-1599 (W1) — TerrainWorkbench panel component (shell).
 * TASK-1600 (W1) — Recipe builder UI: surface list, recipe form, derive.
 *
 * Three sections:
 *   terrain     — live (AnalysisSurface recipe builder)
 *   delineation — stubbed (arrives in Epic B)
 *   catchments  — stubbed (arrives in Epic C)
 *
 * Permission-gated: only renders for project members (isAnugaProject guard,
 * same as Anuga / Hydrology containers).
 *
 * Recipe form inputs (S1 defaults):
 *   title, regional_terrain, use_culverts, feather_width_m (50),
 *   target_resolution_m (5), breach_max_cost (20), breach_search_dist (100)
 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';

import { setTerrainWorkbenchSection, setTerrainWorkbenchVisible } from '../actionsTerrainWorkbench';
import {
    twLoadData,
    twSelectSurface,
    twCreateSurface,
    twUpdateSurface,
    twDeleteSurface,
    twSetDesignInputs,
    twDerive,
} from '../actionsTerrainWorkbench';
import { getProjectId } from '@js/plugins/hydrata/Anuga/selectorsAnuga';
import '../terrainWorkbench.css';
import '../../SimpleView/simpleView.css';

const SECTIONS = [
    { key: 'terrain', label: 'Terrain', live: true },
    { key: 'delineation', label: 'Delineation', live: false, epicNote: 'Epic B' },
    { key: 'catchments', label: 'Catchments', live: false, epicNote: 'Epic C' },
];

// S1 param defaults (spec §9 D5).
const PARAM_DEFAULTS = {
    feather_width_m: 50,
    target_resolution_m: 5,
    breach_max_cost: 20,
    breach_search_dist: 100,
};

/**
 * Stub section shown for features not yet built.
 */
function StubSection({ label, epicNote }) {
    return (
        <div className="terrain-workbench-stub">
            <div className="terrain-workbench-stub-title">{label}</div>
            <p>
                {label} tools arrive in <strong>{epicNote}</strong>. <br />
                They will appear here automatically when the workbench is extended.
            </p>
        </div>
    );
}

StubSection.propTypes = {
    label: PropTypes.string.isRequired,
    epicNote: PropTypes.string.isRequired,
};

/**
 * Staleness badge shown when is_stale=true (param or design-input changed
 * since last derive).
 */
function StaleBadge({ isStale }) {
    if (!isStale) return null;
    return (
        <span
            className="terrain-workbench-stale-badge"
            title="Recipe inputs have changed since last derive — re-derive to update"
        >
            stale
        </span>
    );
}

StaleBadge.propTypes = { isStale: PropTypes.bool };
StaleBadge.defaultProps = { isStale: false };

/**
 * Design-DEM picker — ordered list with priority reorder.
 */
function DesignInputPicker({ terrains, designInputs, onChange, disabled }) {
    const addTerrain = (terrainId) => {
        const id = parseInt(terrainId, 10);
        if (!id || designInputs.find(d => d.terrain_id === id)) return;
        onChange([...designInputs, { terrain_id: id, priority: designInputs.length }]);
    };
    const remove = (idx) => {
        const next = designInputs.filter((_, i) => i !== idx)
            .map((d, i) => ({ ...d, priority: i }));
        onChange(next);
    };
    const moveUp = (idx) => {
        if (idx === 0) return;
        const next = [...designInputs];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange(next.map((d, i) => ({ ...d, priority: i })));
    };

    const availableTerrain = terrains.filter(
        t => !designInputs.find(d => d.terrain_id === t.id)
    );

    return (
        <div className="tw-design-inputs">
            <label className="tw-label">
                Design DEMs <span className="tw-label-sub">(ordered by priority)</span>
            </label>
            {designInputs.map((di, idx) => {
                const t = terrains.find(x => x.id === di.terrain_id);
                return (
                    <div key={di.terrain_id} className="tw-design-input-row">
                        <span className="tw-priority-badge">{idx + 1}</span>
                        <span className="tw-input-title">{t ? (t.title || t.name) : `Terrain #${di.terrain_id}`}</span>
                        <button
                            type="button"
                            className="tw-icon-btn"
                            onClick={() => moveUp(idx)}
                            disabled={disabled || idx === 0}
                            title="Move up (higher priority)"
                        >↑</button>
                        <button
                            type="button"
                            className="tw-icon-btn tw-icon-btn-danger"
                            onClick={() => remove(idx)}
                            disabled={disabled}
                            title="Remove"
                        >×</button>
                    </div>
                );
            })}
            {availableTerrain.length > 0 && (
                <select
                    className="tw-select"
                    value=""
                    onChange={(e) => addTerrain(e.target.value)}
                    disabled={disabled}
                >
                    <option value="">+ Add design DEM…</option>
                    {availableTerrain.map(t => (
                        <option key={t.id} value={t.id}>{t.title || t.name}</option>
                    ))}
                </select>
            )}
            {designInputs.length === 0 && (
                <div className="tw-validation-hint">At least one design DEM is required.</div>
            )}
        </div>
    );
}

DesignInputPicker.propTypes = {
    terrains: PropTypes.array.isRequired,
    designInputs: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};
DesignInputPicker.defaultProps = { disabled: false };

/**
 * Seam-QA metrics panel (from enforcement_log after derive).
 */
function SeamQAPanel({ enforcementLog }) {
    if (!enforcementLog) return null;
    const maxSeam = typeof enforcementLog.max_seam_step_m === 'number'
        ? enforcementLog.max_seam_step_m.toFixed(3)
        : null;
    const offset = typeof enforcementLog.applied_bias_m === 'number'
        ? enforcementLog.applied_bias_m.toFixed(3)
        : null;
    if (!maxSeam && !offset) return null;
    return (
        <div className="tw-seam-qa" data-testid="seam-qa-panel">
            <div className="tw-label">Seam QA</div>
            {maxSeam !== null && (
                <div className="tw-seam-qa-row">
                    <span>Max seam step:</span>
                    <strong>{maxSeam} m</strong>
                </div>
            )}
            {offset !== null && (
                <div className="tw-seam-qa-row">
                    <span>Vertical offset applied:</span>
                    <strong>{offset} m</strong>
                </div>
            )}
        </div>
    );
}

SeamQAPanel.propTypes = { enforcementLog: PropTypes.object };
SeamQAPanel.defaultProps = { enforcementLog: null };

/**
 * Recipe builder form for a single AnalysisSurface.
 */
class RecipeBuilder extends React.Component {
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

    static defaultProps = {
        deriving: false,
        deriveError: null,
        saving: false,
        saveError: null,
    };

    constructor(props) {
        super(props);
        const s = props.surface;
        this.state = {
            title: s.title || '',
            regional_terrain: s.regional_terrain || '',
            use_culverts: !!s.use_culverts,
            feather_width_m: s.feather_width_m ?? PARAM_DEFAULTS.feather_width_m,
            target_resolution_m: s.target_resolution_m ?? PARAM_DEFAULTS.target_resolution_m,
            breach_max_cost: s.breach_max_cost ?? PARAM_DEFAULTS.breach_max_cost,
            breach_search_dist: s.breach_search_dist ?? PARAM_DEFAULTS.breach_search_dist,
            // Local design-inputs state (mirrors surface.design_inputs_ordered)
            designInputs: (s.design_inputs_ordered || []).map(d => ({
                terrain_id: d.terrain,
                priority: d.priority,
            })),
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.surface.id !== this.props.surface.id) {
            const s = this.props.surface;
            this.setState({
                title: s.title || '',
                regional_terrain: s.regional_terrain || '',
                use_culverts: !!s.use_culverts,
                feather_width_m: s.feather_width_m ?? PARAM_DEFAULTS.feather_width_m,
                target_resolution_m: s.target_resolution_m ?? PARAM_DEFAULTS.target_resolution_m,
                breach_max_cost: s.breach_max_cost ?? PARAM_DEFAULTS.breach_max_cost,
                breach_search_dist: s.breach_search_dist ?? PARAM_DEFAULTS.breach_search_dist,
                designInputs: (s.design_inputs_ordered || []).map(d => ({
                    terrain_id: d.terrain,
                    priority: d.priority,
                })),
            });
        }
        // Sync design inputs only when the server-side list changes (after
        // save or derive), not on every surface prop change (would discard
        // unsaved local reordering).
        if (prevProps.surface.design_inputs_ordered !== this.props.surface.design_inputs_ordered) {
            const s = this.props.surface;
            this.setState({
                designInputs: (s.design_inputs_ordered || []).map(d => ({
                    terrain_id: d.terrain,
                    priority: d.priority,
                })),
            });
        }
    }

    handleParam = (key, val) => this.setState({ [key]: val });

    handleSaveParams = () => {
        const { surface, onUpdate } = this.props;
        const { title, regional_terrain, use_culverts,
            feather_width_m, target_resolution_m,
            breach_max_cost, breach_search_dist } = this.state;
        onUpdate(surface.id, {
            title,
            regional_terrain: regional_terrain || null,
            use_culverts,
            feather_width_m: parseFloat(feather_width_m),
            target_resolution_m: parseFloat(target_resolution_m),
            breach_max_cost: parseFloat(breach_max_cost),
            breach_search_dist: parseFloat(breach_search_dist),
        });
    };

    handleSaveDesignInputs = () => {
        const { surface, onSetDesignInputs } = this.props;
        onSetDesignInputs(surface.id, this.state.designInputs);
    };

    handleDerive = () => {
        const { surface, onDerive } = this.props;
        const { designInputs, regional_terrain } = this.state;
        if (!designInputs.length || !regional_terrain) return;
        onDerive(surface.id);
    };

    render() {
        const { surface, terrains, deriving, deriveError, saving, saveError, onDelete } = this.props;
        const { title, regional_terrain, use_culverts,
            feather_width_m, target_resolution_m,
            breach_max_cost, breach_search_dist,
            designInputs } = this.state;

        const canDerive = designInputs.length > 0 && !!regional_terrain && !deriving && !saving;
        const regionalChoices = terrains.filter(t =>
            !designInputs.find(d => d.terrain_id === t.id)
        );

        return (
            <div className="tw-recipe-builder" data-testid="recipe-builder">
                <div className="tw-recipe-header">
                    <input
                        className="tw-title-input"
                        value={title}
                        onChange={(e) => this.handleParam('title', e.target.value)}
                        placeholder="Recipe title"
                        disabled={saving || deriving}
                        data-testid="recipe-title-input"
                    />
                    <StaleBadge isStale={surface.is_stale} />
                    <button
                        type="button"
                        className="tw-icon-btn tw-icon-btn-danger"
                        onClick={() => onDelete(surface.id)}
                        disabled={saving || deriving}
                        title="Delete recipe"
                        data-testid="recipe-delete-btn"
                    >×</button>
                </div>

                {/* Design DEM picker */}
                <DesignInputPicker
                    terrains={terrains}
                    designInputs={designInputs}
                    onChange={(inputs) => this.setState({ designInputs: inputs })}
                    disabled={saving || deriving}
                />
                <button
                    type="button"
                    className="tw-save-btn"
                    onClick={this.handleSaveDesignInputs}
                    disabled={saving || deriving}
                    data-testid="save-design-inputs-btn"
                >
                    {saving ? 'Saving…' : 'Save design inputs'}
                </button>

                {/* Regional terrain */}
                <div className="tw-field">
                    <label className="tw-label">Regional terrain</label>
                    <select
                        className="tw-select"
                        value={regional_terrain || ''}
                        onChange={(e) => this.handleParam('regional_terrain', e.target.value ? parseInt(e.target.value, 10) : '')}
                        disabled={saving || deriving}
                        data-testid="regional-terrain-select"
                    >
                        <option value="">— select regional terrain —</option>
                        {terrains.map(t => (
                            <option key={t.id} value={t.id}>{t.title || t.name}</option>
                        ))}
                    </select>
                    {!regional_terrain && (
                        <div className="tw-validation-hint">Regional terrain is required.</div>
                    )}
                </div>

                {/* Parameters */}
                <div className="tw-params-section">
                    <div className="tw-label">Parameters</div>
                    <div className="tw-param-grid">
                        <label>Use culverts</label>
                        <input
                            type="checkbox"
                            checked={!!use_culverts}
                            onChange={(e) => this.handleParam('use_culverts', e.target.checked)}
                            disabled={saving || deriving}
                            data-testid="use-culverts-check"
                        />
                        <label>Feather width (m)</label>
                        <input
                            type="number"
                            className="tw-number-input"
                            value={feather_width_m}
                            min="1"
                            onChange={(e) => this.handleParam('feather_width_m', e.target.value)}
                            disabled={saving || deriving}
                            data-testid="feather-width-input"
                        />
                        <label>Target resolution (m)</label>
                        <input
                            type="number"
                            className="tw-number-input"
                            value={target_resolution_m}
                            min="0.1"
                            step="0.1"
                            onChange={(e) => this.handleParam('target_resolution_m', e.target.value)}
                            disabled={saving || deriving}
                            data-testid="target-res-input"
                        />
                        <label>Breach max cost</label>
                        <input
                            type="number"
                            className="tw-number-input"
                            value={breach_max_cost}
                            min="0"
                            onChange={(e) => this.handleParam('breach_max_cost', e.target.value)}
                            disabled={saving || deriving}
                            data-testid="breach-max-cost-input"
                        />
                        <label>Breach search dist</label>
                        <input
                            type="number"
                            className="tw-number-input"
                            value={breach_search_dist}
                            min="1"
                            onChange={(e) => this.handleParam('breach_search_dist', e.target.value)}
                            disabled={saving || deriving}
                            data-testid="breach-search-dist-input"
                        />
                    </div>
                    <button
                        type="button"
                        className="tw-save-btn"
                        onClick={this.handleSaveParams}
                        disabled={saving || deriving}
                        data-testid="save-params-btn"
                    >
                        {saving ? 'Saving…' : 'Save parameters'}
                    </button>
                </div>

                {/* Save error */}
                {saveError && (
                    <div className="tw-error" data-testid="save-error">{saveError}</div>
                )}

                {/* Derive button + status */}
                <div className="tw-derive-section">
                    <Button
                        bsStyle="primary"
                        bsSize="small"
                        className="tw-derive-btn"
                        onClick={this.handleDerive}
                        disabled={!canDerive}
                        data-testid="derive-btn"
                    >
                        {deriving ? 'Deriving…' : 'Derive terrain'}
                    </Button>
                    {deriving && (
                        <div className="tw-derive-progress" data-testid="derive-progress">
                            Processing — watch the Task Monitor for progress.
                        </div>
                    )}
                    {deriveError && (
                        <div className="tw-error" data-testid="derive-error">{deriveError}</div>
                    )}
                </div>

                {/* Seam QA metrics */}
                <SeamQAPanel enforcementLog={surface.enforcement_log} />
            </div>
        );
    }
}

/**
 * Surface list — shows all recipes for the project with staleness badges.
 */
function SurfaceList({ surfaces, selectedId, onSelect, onNew, saving }) {
    return (
        <div className="tw-surface-list">
            <div className="tw-surface-list-header">
                <span className="tw-label">Analysis Surfaces</span>
                <button
                    type="button"
                    className="tw-new-btn"
                    onClick={onNew}
                    disabled={saving}
                    data-testid="new-surface-btn"
                >
                    + New
                </button>
            </div>
            {surfaces.length === 0 && (
                <div className="tw-empty-hint">
                    No analysis surfaces yet. Create one with <strong>+ New</strong>.
                </div>
            )}
            {surfaces.map(s => (
                <div
                    key={s.id}
                    className={`tw-surface-item${selectedId === s.id ? ' selected' : ''}`}
                    onClick={() => onSelect(s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && onSelect(s.id)}
                    data-testid={`surface-item-${s.id}`}
                >
                    <span className="tw-surface-title">{s.title || `Surface #${s.id}`}</span>
                    <StaleBadge isStale={s.is_stale} />
                </div>
            ))}
        </div>
    );
}

SurfaceList.propTypes = {
    surfaces: PropTypes.array.isRequired,
    selectedId: PropTypes.number,
    onSelect: PropTypes.func.isRequired,
    onNew: PropTypes.func.isRequired,
    saving: PropTypes.bool,
};
SurfaceList.defaultProps = { selectedId: null, saving: false };

/**
 * Live Terrain section — recipe builder.
 */
class TerrainSection extends React.Component {
    static propTypes = {
        projectId: PropTypes.number,
        terrains: PropTypes.array,
        surfaces: PropTypes.array,
        selectedSurfaceId: PropTypes.number,
        loading: PropTypes.bool,
        error: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        onLoadData: PropTypes.func.isRequired,
        onSelectSurface: PropTypes.func.isRequired,
        onCreateSurface: PropTypes.func.isRequired,
        onUpdateSurface: PropTypes.func.isRequired,
        onDeleteSurface: PropTypes.func.isRequired,
        onSetDesignInputs: PropTypes.func.isRequired,
        onDerive: PropTypes.func.isRequired,
    };

    static defaultProps = {
        terrains: [],
        surfaces: [],
        selectedSurfaceId: null,
        loading: false,
        error: null,
        saving: false,
        saveError: null,
        deriving: false,
        deriveError: null,
    };

    componentDidMount() {
        if (this.props.projectId) {
            this.props.onLoadData();
        }
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.projectId && this.props.projectId) {
            this.props.onLoadData();
        }
    }

    handleNewSurface = () => {
        this.props.onCreateSurface({
            title: `New Analysis Surface ${this.props.surfaces.length + 1}`,
            regional_terrain: null,
            use_culverts: false,
            ...PARAM_DEFAULTS,
        });
    };

    render() {
        const {
            terrains, surfaces, selectedSurfaceId,
            loading, error, saving, saveError, deriving, deriveError,
            onSelectSurface, onUpdateSurface, onDeleteSurface,
            onSetDesignInputs, onDerive,
        } = this.props;

        if (loading) {
            return (
                <div className="terrain-workbench-body" data-testid="terrain-section">
                    <div className="tw-loading">Loading…</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="terrain-workbench-body" data-testid="terrain-section">
                    <div className="tw-error" data-testid="load-error">{error}</div>
                </div>
            );
        }

        const selectedSurface = surfaces.find(s => s.id === selectedSurfaceId) || null;

        return (
            <div className="terrain-workbench-body" data-testid="terrain-section">
                <SurfaceList
                    surfaces={surfaces}
                    selectedId={selectedSurfaceId}
                    onSelect={onSelectSurface}
                    onNew={this.handleNewSurface}
                    saving={saving}
                />
                {selectedSurface && (
                    <RecipeBuilder
                        surface={selectedSurface}
                        terrains={terrains}
                        deriving={deriving}
                        deriveError={deriveError}
                        saving={saving}
                        saveError={saveError}
                        onUpdate={onUpdateSurface}
                        onSetDesignInputs={onSetDesignInputs}
                        onDerive={onDerive}
                        onDelete={onDeleteSurface}
                    />
                )}
            </div>
        );
    }
}

/**
 * TerrainWorkbenchPanel — main workbench panel.
 */
export class TerrainWorkbenchPanel extends React.Component {
    static propTypes = {
        isAnugaProject: PropTypes.bool,
        projectId: PropTypes.number,
        activeSection: PropTypes.string,
        onSetSection: PropTypes.func,
        // Recipe state
        terrains: PropTypes.array,
        surfaces: PropTypes.array,
        selectedSurfaceId: PropTypes.number,
        loading: PropTypes.bool,
        error: PropTypes.string,
        saving: PropTypes.bool,
        saveError: PropTypes.string,
        deriving: PropTypes.bool,
        deriveError: PropTypes.string,
        // Recipe actions
        onLoadData: PropTypes.func,
        onSelectSurface: PropTypes.func,
        onCreateSurface: PropTypes.func,
        onUpdateSurface: PropTypes.func,
        onDeleteSurface: PropTypes.func,
        onSetDesignInputs: PropTypes.func,
        onDerive: PropTypes.func,
    };

    static defaultProps = {
        isAnugaProject: false,
        activeSection: 'terrain',
        onSetSection: () => {},
        terrains: [],
        surfaces: [],
        selectedSurfaceId: null,
        loading: false,
        error: null,
        saving: false,
        saveError: null,
        deriving: false,
        deriveError: null,
        onLoadData: () => {},
        onSelectSurface: () => {},
        onCreateSurface: () => {},
        onUpdateSurface: () => {},
        onDeleteSurface: () => {},
        onSetDesignInputs: () => {},
        onDerive: () => {},
    };

    _renderSection(key) {
        const {
            projectId, terrains, surfaces, selectedSurfaceId,
            loading, error, saving, saveError, deriving, deriveError,
            onLoadData, onSelectSurface, onCreateSurface,
            onUpdateSurface, onDeleteSurface, onSetDesignInputs, onDerive,
        } = this.props;

        switch (key) {
        case 'terrain':
            return (
                <TerrainSection
                    key="terrain"
                    projectId={projectId}
                    terrains={terrains}
                    surfaces={surfaces}
                    selectedSurfaceId={selectedSurfaceId}
                    loading={loading}
                    error={error}
                    saving={saving}
                    saveError={saveError}
                    deriving={deriving}
                    deriveError={deriveError}
                    onLoadData={onLoadData}
                    onSelectSurface={onSelectSurface}
                    onCreateSurface={onCreateSurface}
                    onUpdateSurface={onUpdateSurface}
                    onDeleteSurface={onDeleteSurface}
                    onSetDesignInputs={onSetDesignInputs}
                    onDerive={onDerive}
                />
            );
        case 'delineation':
            return <StubSection key="delineation" label="Delineation" epicNote="Epic B" />;
        case 'catchments':
            return <StubSection key="catchments" label="Catchments" epicNote="Epic C" />;
        default:
            return null;
        }
    }

    render() {
        const { isAnugaProject, activeSection, onSetSection } = this.props;
        if (!isAnugaProject) {
            return null;
        }
        return (
            <div className="terrain-workbench-panel" data-testid="terrain-workbench-panel">
                <nav className="terrain-workbench-nav" role="navigation" aria-label="Terrain Workbench sections">
                    {SECTIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`terrain-workbench-nav-btn${activeSection === key ? ' active' : ''}`}
                            onClick={() => onSetSection(key)}
                            aria-pressed={activeSection === key}
                            data-testid={`section-btn-${key}`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
                {this._renderSection(activeSection)}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    isAnugaProject: !!getProjectId(state),
    projectId: getProjectId(state),
    activeSection: state?.terrainWorkbench?.activeSection || 'terrain',
    terrains: state?.terrainWorkbench?.terrains || [],
    surfaces: state?.terrainWorkbench?.surfaces || [],
    selectedSurfaceId: state?.terrainWorkbench?.selectedSurfaceId || null,
    loading: state?.terrainWorkbench?.loading || false,
    error: state?.terrainWorkbench?.error || null,
    saving: state?.terrainWorkbench?.saving || false,
    saveError: state?.terrainWorkbench?.saveError || null,
    deriving: state?.terrainWorkbench?.deriving || false,
    deriveError: state?.terrainWorkbench?.deriveError || null,
});

const mapDispatchToProps = (dispatch) => ({
    onSetSection: (section) => dispatch(setTerrainWorkbenchSection(section)),
    onSetVisible: (visible) => dispatch(setTerrainWorkbenchVisible(visible)),
    onLoadData: () => dispatch(twLoadData()),
    onSelectSurface: (id) => dispatch(twSelectSurface(id)),
    onCreateSurface: (payload) => dispatch(twCreateSurface(payload)),
    onUpdateSurface: (id, payload) => dispatch(twUpdateSurface(id, payload)),
    onDeleteSurface: (id) => dispatch(twDeleteSurface(id)),
    onSetDesignInputs: (id, inputs) => dispatch(twSetDesignInputs(id, inputs)),
    onDerive: (id) => dispatch(twDerive(id)),
});

export default connect(mapStateToProps, mapDispatchToProps)(TerrainWorkbenchPanel);
