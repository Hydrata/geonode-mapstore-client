/**
 * MeshWorkflow — W5.1 (TASK-1273)
 *
 * A collapsible panel opened from the Mesh pane head that consolidates all
 * mesh-related workflow controls into one place:
 *
 *   • Preview button + result (delegates to the existing _startMeshPreview /
 *     meshPreviewStatus state in AnugaInputMenuClass).
 *   • Cost estimate row (pulled from the selected scenario's
 *     mesh_triangle_count_estimate + compute_cost_estimate fields, W3.2).
 *   • Resolution note: clarifies that the per-region resolution field is a
 *     target edge length (max_area = resolution² / 2).
 *   • Import / Export placeholder slots — disabled buttons; the real services
 *     are TASK-1274's responsibility.
 *
 * The component is STATELESS — all state lives in the parent
 * AnugaInputMenuClass.  The parent passes:
 *   - isOpen         {bool}     — whether the workflow panel is expanded
 *   - onToggle       {fn}       — toggles isOpen in the parent
 *   - previewState   {object}   — { status, result, error }
 *   - onStartPreview {fn}       — calls _startMeshPreview
 *   - hasScenario    {bool}     — true when a scenario is selected
 *   - scenario       {object}   — the full scenario object (may be null)
 *
 * The breaklines + per-line near spacing live in the SimpleView layer list
 * (brk_ prefix layers rendered by simpleViewMenuRow).  They appear in the
 * Anuga "Mesh" pane below the MeshWorkflow toggle as regular layer rows and
 * are not duplicated here.
 *
 * Design: the panel opens BELOW the pane head as a collapsible section, so
 * the existing mesh region rows remain visible.
 */

import React from 'react';
const PropTypes = require('prop-types');
import { buildMeshTriangleLayer } from '../gwcTileRouting';
import { getToken } from '../../../../../MapStore2/web/client/utils/SecurityUtils';
// TASK-1764 (epic-1758 W1) — chassis Table frames the built-mesh roster.
// The .sv-anuga-built-mesh-roster-table class rides extraClassName; the
// data-testid="built-mesh-roster-table" anchor (queried by meshWorkflow-test)
// is preserved on a wrapper so it only exists in the meshes-present branch.
import { Table } from '../../SimpleView/components/primitives';

// Inline Spinner from React-Spinner (already a MapStore2 dep via anugaInputMenu).
// We lazily require it so this file does not add a new npm dep.
let Spinner = null;
try {
    // eslint-disable-next-line global-require
    Spinner = require('react-spinkit').default;
} catch (e) {
    // Spinner unavailable — the component still works, just without the loading glyph.
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * PreviewSection — renders the Preview button + result label.
 *
 * W6 (TASK-1421) upgrades:
 *   - Shows a progress bar (0-100%) + status_detail label during 'polling'.
 *   - Shows a clear "mesh too large" banner when above_render_threshold=true,
 *     including the triangle count and the threshold so users know to reduce
 *     mesh region resolution.
 *   - The progress prop carries {pct, detail} from the process poll response.
 */
export function PreviewSection({status, result, error, hasScenario, onStart, progress}) {
    const isRunning = status === 'pending' || status === 'polling';

    // W6 (TASK-1421): progress bar during polling.
    let progressBar = null;
    if (isRunning) {
        const pct = (progress && progress.pct !== null) ? Math.min(100, Math.max(0, progress.pct)) : null;
        const detail = (progress && progress.detail) ? progress.detail : null;
        progressBar = (
            <div className="sv-anuga-mesh-preview-progress">
                {pct !== null ? (
                    <React.Fragment>
                        <div className="sv-anuga-mesh-preview-progress-bar-track">
                            <div
                                className="sv-anuga-mesh-preview-progress-bar-fill"
                                style={{width: pct + '%'}}
                            />
                        </div>
                        <span className="sv-anuga-mesh-preview-progress-pct">{pct + '%'}</span>
                    </React.Fragment>
                ) : (
                    Spinner && <Spinner color="#888" className="sv-anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                )}
                {detail && <span className="sv-anuga-mesh-preview-progress-detail">{detail}</span>}
            </div>
        );
    }

    let resultLabel = null;
    if (status === 'done' && result) {
        const tc = result.triangle_count;
        const aboveThreshold = result.above_render_threshold;
        const threshold = result.render_threshold || 150000;
        if (aboveThreshold) {
            // W6 (TASK-1421): explicit "too large" banner with actionable guidance.
            resultLabel = (
                <div className="sv-anuga-mesh-preview-metrics sv-anuga-mesh-preview-too-large">
                    <span className="sv-anuga-mesh-preview-warn-icon">{'⚠ '}</span>
                    <strong>{'Mesh too large to preview on map'}</strong>
                    <span className="sv-anuga-mesh-preview-count">
                        {' (' + (tc ? tc.toLocaleString() : '?') + ' triangles — exceeds '
                         + threshold.toLocaleString() + ' limit)'}
                    </span>
                    <span className="sv-anuga-mesh-preview-note">
                        {'Reduce mesh region resolution to preview.'}
                    </span>
                </div>
            );
        } else {
            const qa = result.mesh_qa || {};
            resultLabel = (
                <div className="sv-anuga-mesh-preview-metrics">
                    <span className="sv-anuga-mesh-preview-count">{(tc || 0).toLocaleString()} triangles</span>
                    {qa.min_angle_deg !== null && qa.min_angle_deg !== undefined && (
                        <span className="sv-anuga-mesh-preview-qa">{'min angle: ' + qa.min_angle_deg + '°'}</span>
                    )}
                    {qa.sliver_count > 0 && (
                        <span className="sv-anuga-mesh-preview-qa sv-anuga-mesh-preview-warn">
                            {qa.sliver_count + ' sliver(s)'}
                        </span>
                    )}
                </div>
            );
        }
    } else if (status === 'error') {
        resultLabel = (
            <div className="sv-anuga-mesh-preview-error">{error || 'Preview failed'}</div>
        );
    }

    return (
        <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-workflow-preview">
            <button
                className={'btn btn-default sv-anuga-mesh-preview-btn' + (isRunning ? ' disabled' : '')}
                disabled={isRunning || !hasScenario}
                title={!hasScenario ? 'Select a scenario to preview mesh' : 'Preview mesh triangulation'}
                onClick={onStart}
            >
                {isRunning ? (
                    <React.Fragment>
                        {(!progress || progress.pct === null) && Spinner && (
                            <Spinner color="#888" className="sv-anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                        )}
                        {' Previewing...'}
                    </React.Fragment>
                ) : 'Preview mesh'}
            </button>
            {progressBar}
            {resultLabel}
        </div>
    );
}

PreviewSection.propTypes = {
    status: PropTypes.string,
    result: PropTypes.object,
    error: PropTypes.string,
    hasScenario: PropTypes.bool,
    onStart: PropTypes.func.isRequired,
    // W6 (TASK-1421): {pct: number|null, detail: string|null} from process poll
    progress: PropTypes.shape({pct: PropTypes.number, detail: PropTypes.string})
};

PreviewSection.defaultProps = {
    status: null,
    result: null,
    error: null,
    hasScenario: false,
    progress: null
};

/**
 * CostEstimateSection — renders the W3.2 pre-dispatch triangle/cost estimate.
 * Only renders when at least one of the two fields is non-null on the scenario.
 */
export function CostEstimateSection({scenario}) {
    if (!scenario) return null;
    const hasTriangles = scenario.mesh_triangle_count_estimate !== null && scenario.mesh_triangle_count_estimate !== undefined;
    const hasCost = scenario.compute_cost_estimate !== null && scenario.compute_cost_estimate !== undefined;
    if (!hasTriangles && !hasCost) return null;

    return (
        <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-workflow-estimate">
            <span className="sv-anuga-scenario-estimate-label">
                {'Estimate: '}
                {hasTriangles
                    ? `~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`
                    : ''}
                {hasCost
                    ? ` — ~$${Number(scenario.compute_cost_estimate).toFixed(2)}`
                    : ''}
            </span>
        </div>
    );
}

CostEstimateSection.propTypes = {
    scenario: PropTypes.object
};
CostEstimateSection.defaultProps = {scenario: null};

/**
 * ImportExportSection — W5.1 / W5.2 placeholder slots.
 * The buttons are DISABLED ("Coming soon").  Real services are TASK-1274.
 */
export function ImportExportSection() {
    return (
        <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-workflow-importexport">
            <button
                className="btn btn-default sv-anuga-mesh-import-btn"
                disabled
                title="Import mesh (.2dm / UGRID) — coming soon"
            >
                {'Import mesh'}
            </button>
            <button
                className="btn btn-default sv-anuga-mesh-export-btn"
                disabled
                title="Export mesh (.2dm / UGRID) — coming soon"
            >
                {'Export mesh'}
            </button>
        </div>
    );
}

/**
 * MeshTriangleLayerSection — W5.3 (TASK-1275) / W6 (TASK-1423)
 *
 * Shown when the last preview result is below the render threshold and
 * the MeshElement geometry has been published to GeoServer as the
 * `geonode:mesh_triangle_render` layer (via populate_mesh_triangle_geom /
 * publish_mesh_triangle_layer_geoserver on the backend).
 *
 * Renders an "Add mesh layer to map" button that dispatches `addLayer`
 * with a WMS config pointing to `geonode:mesh_triangle_render` via GWC
 * (which serves MVT when the gs-vectortiles plugin is installed — W5.0).
 *
 * When the vectortiles plugin is NOT installed (sandbox tinyproxy blocks
 * the download — see docs/reports/w5-task-1304-live-install-fallback.txt),
 * the layer falls back to WMS PNG tiles, which still works.
 *
 * W6 (TASK-1423) — Authenticated GWC tiles:
 *   A mesh is user-owned geometry. GeoFence denies anonymous GWC access to
 *   mesh_triangle_render (ISSUE 34). MapStore's authenticationRules cover
 *   absolute GeoServer URLs (e.g. https://hydrata.com/geoserver/.*), but
 *   GWC_WMTS_ENDPOINT is a RELATIVE path (/geoserver/gwc/service/wmts) which
 *   does NOT match the absolute-URL pattern — so access_token is NOT injected
 *   automatically by addAuthenticationParameter for this relative URL.
 *   Fix: explicitly inject access_token from SecurityUtils.getToken() into
 *   layer.params and into each tileUrl at build time, so the authenticated
 *   user's token travels with every tile request.
 *   The end-to-end render (GeoFence accepts the authed user, geo_reference
 *   correct) is deferred to prod canary (requires deployed authkey filter +
 *   GeoFence rule — see epic 1321 TASK-1372).
 */
export function MeshTriangleLayerSection({onAddLayer, isLayerAdded}) {
    // W6 (TASK-1423): build the authenticated mesh layer via the shared helper in
    // gwcTileRouting.js (buildMeshTriangleLayer).  getToken() is called here so
    // the token is fresh at button-render time; the helper is the single source of
    // truth for params + tileUrl construction.
    const meshLayer = buildMeshTriangleLayer(getToken());

    if (isLayerAdded) {
        return (
            <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-triangle-layer">
                <span className="sv-anuga-mesh-triangle-layer-added">
                    {'Mesh layer added to map'}
                </span>
            </div>
        );
    }

    return (
        <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-triangle-layer">
            <button
                className="btn btn-default sv-anuga-mesh-add-layer-btn"
                onClick={() => onAddLayer && onAddLayer(meshLayer)}
                title="Add the derived mesh triangle layer (GeoServer MVT / WMS) to the map"
                data-testid="anuga-mesh-add-layer-btn"
            >
                {'Add mesh layer to map'}
            </button>
        </div>
    );
}

MeshTriangleLayerSection.propTypes = {
    onAddLayer: PropTypes.func,
    isLayerAdded: PropTypes.bool
};
MeshTriangleLayerSection.defaultProps = {
    onAddLayer: null,
    isLayerAdded: false
};

/**
 * BuiltMeshRoster — W6 (TASK-1424); W6.1 (TASK-2630) adds the per-row
 * "Preview on map" button for a mesh ABOVE the render threshold.
 *
 * Read-only list of built meshes (MeshRun records) for the selected scenario.
 * Each row shows: Run date, triangle count (element_count), node count.
 *
 * mesh_qa quality metrics (min_angle, sliver_count, aspect_ratio) are NOT
 * persisted on MeshRun — they are computed at preview/build time and stored
 * only in process metadata or logs. The roster therefore shows structural
 * counts only. A future BE persistence subtask could add a mesh_qa JSONField
 * to MeshRun (see novel_questions in W6 wave report).
 *
 * W6.1 (TASK-2630): below `renderThreshold`, the EXISTING GeoServer MVT
 * `mesh_triangle_render` layer (MeshTriangleLayerSection above) already
 * covers a geometry preview — no button needed here. ABOVE the threshold,
 * that MVT path is unavailable (mesh_store.populate_mesh_triangle_geom
 * skips it server-side) and the mesh previously had NO visual preview at
 * all; each such row gets a "Preview on map (any size)" button that fetches
 * `.../runs/{run_id}/built-mesh-binary/` and adds the SAME custom WebGL2
 * playback layer in wireframe-only mode (D2, review #11 — new export +
 * endpoint, not a settings bump).
 *
 * Props:
 *   builtMeshes: array of MeshRun API objects (now carrying `run_id` —
 *     W6.1), or null/empty when none built.
 *   renderThreshold: mirrors PreviewSection's `result.render_threshold`
 *     convention (settings.MESH_RENDER_MAX_TRIANGLES, default 150000).
 *   onPreviewBuiltMesh: (meshRun) => void — fetches + adds the WebGL layer;
 *     absent/null hides the button entirely (no dead affordance).
 *   previewingRunId: run_id currently loading, for the button's own busy
 *     state (no shared spinner state needed elsewhere).
 */
export function BuiltMeshRoster({builtMeshes, renderThreshold, onPreviewBuiltMesh, previewingRunId}) {
    return (
        <div className="sv-anuga-mesh-workflow-section sv-anuga-built-mesh-roster">
            <div className="sv-anuga-built-mesh-roster-header">
                <strong>{'Built meshes'}</strong>
            </div>
            {(!builtMeshes || builtMeshes.length === 0) ? (
                <div className="sv-anuga-built-mesh-roster-empty">
                    {'No built meshes yet'}
                </div>
            ) : (
                <div data-testid="built-mesh-roster-table">
                    <Table surface="dark" extraClassName="sv-anuga-built-mesh-roster-table">
                        <thead>
                            <tr>
                                <th>{'Date'}</th>
                                <th>{'Triangles'}</th>
                                <th>{'Nodes'}</th>
                                <th>{'Preview'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {builtMeshes.map(mr => {
                                const aboveThreshold = (mr.element_count || 0) > renderThreshold;
                                const isPreviewing = previewingRunId === mr.run_id;
                                return (
                                    <tr key={mr.id} data-testid={'built-mesh-row-' + mr.id}>
                                        <td>{mr.created_at ? new Date(mr.created_at).toLocaleDateString() : '—'}</td>
                                        <td>{(mr.element_count || 0).toLocaleString()}</td>
                                        <td>{(mr.node_count || 0).toLocaleString()}</td>
                                        <td>
                                            {aboveThreshold && onPreviewBuiltMesh ? (
                                                <button
                                                    className="btn btn-xs btn-default sv-anuga-built-mesh-preview-btn"
                                                    disabled={isPreviewing}
                                                    onClick={() => onPreviewBuiltMesh(mr)}
                                                    title="Above the render threshold — preview via the WebGL2 mesh renderer (wireframe, any size)"
                                                    data-testid={'built-mesh-preview-btn-' + mr.id}
                                                >
                                                    {isPreviewing ? 'Loading…' : 'Preview (any size)'}
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
}

BuiltMeshRoster.propTypes = {
    builtMeshes: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.number,
        run_id: PropTypes.number,
        node_count: PropTypes.number,
        element_count: PropTypes.number,
        materialized: PropTypes.bool,
        created_at: PropTypes.string
    })),
    renderThreshold: PropTypes.number,
    onPreviewBuiltMesh: PropTypes.func,
    previewingRunId: PropTypes.number
};
BuiltMeshRoster.defaultProps = {
    builtMeshes: null,
    renderThreshold: 150000,
    onPreviewBuiltMesh: null,
    previewingRunId: null
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * MeshWorkflow — the collapsible workflow panel attached to the Mesh pane.
 *
 * W5.3 additions: onAddMeshLayer / isMeshLayerAdded props wire up the
 * MeshTriangleLayerSection for adding the GeoServer MVT render layer to the map.
 * These are only shown when the last preview result is below the render threshold
 * (above_render_threshold === false).
 *
 * W6 (TASK-1421) additions: passes previewState.progress to PreviewSection for the
 * process-id-driven progress bar.
 * W6 (TASK-1424) additions: builtMeshes prop renders the BuiltMeshRoster section.
 */
export function MeshWorkflow({
    isOpen,
    onToggle,
    previewState,
    onStartPreview,
    hasScenario,
    scenario,
    onAddMeshLayer,
    isMeshLayerAdded,
    builtMeshes,
    renderThreshold,
    onPreviewBuiltMesh,
    previewingRunId
}) {
    // Only show the mesh triangle layer button when the last preview confirmed
    // the mesh is below the render threshold.
    const previewBelowThreshold =
        previewState.status === 'done' &&
        previewState.result &&
        !previewState.result.above_render_threshold;

    return (
        <div className="sv-anuga-mesh-workflow-container">
            <button
                className={'btn btn-xs sv-anuga-mesh-workflow-toggle' + (isOpen ? ' active' : '')}
                onClick={onToggle}
                title={isOpen ? 'Close mesh workflow' : 'Open mesh workflow panel'}
                data-testid="anuga-mesh-workflow-toggle"
            >
                {isOpen ? 'Workflow ▲' : 'Workflow ▼'}
            </button>
            {isOpen && (
                <div className="sv-anuga-mesh-workflow-panel" data-testid="anuga-mesh-workflow-panel">
                    <PreviewSection
                        status={previewState.status}
                        result={previewState.result}
                        error={previewState.error}
                        hasScenario={hasScenario}
                        onStart={onStartPreview}
                        progress={previewState.progress}
                    />
                    <CostEstimateSection scenario={scenario}/>
                    {/* W5.3 (TASK-1275) — Add mesh triangle layer button (below render threshold only) */}
                    {previewBelowThreshold && (
                        <MeshTriangleLayerSection
                            onAddLayer={onAddMeshLayer}
                            isLayerAdded={isMeshLayerAdded}
                        />
                    )}
                    <ImportExportSection/>
                    {/* W6 (TASK-1424) — Built meshes roster; W6.1 (TASK-2630) adds the per-row WebGL preview button */}
                    <BuiltMeshRoster
                        builtMeshes={builtMeshes}
                        renderThreshold={renderThreshold}
                        onPreviewBuiltMesh={onPreviewBuiltMesh}
                        previewingRunId={previewingRunId}
                    />
                    <div className="sv-anuga-mesh-workflow-section sv-anuga-mesh-workflow-hint">
                        <span className="sv-anuga-mesh-workflow-hint-text">
                            {'Resolution field on each mesh region is a target edge length (m). '}
                            {'Max triangle area = resolution² / 2.'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

MeshWorkflow.propTypes = {
    isOpen: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
    previewState: PropTypes.shape({
        status: PropTypes.string,
        result: PropTypes.object,
        error: PropTypes.string,
        // W6 (TASK-1421): {pct: number|null, detail: string|null}
        progress: PropTypes.shape({pct: PropTypes.number, detail: PropTypes.string})
    }),
    onStartPreview: PropTypes.func.isRequired,
    hasScenario: PropTypes.bool,
    scenario: PropTypes.object,
    // W5.3
    onAddMeshLayer: PropTypes.func,
    isMeshLayerAdded: PropTypes.bool,
    // W6 (TASK-1424): built meshes roster — array of MeshRun objects
    builtMeshes: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.number,
        run_id: PropTypes.number,
        node_count: PropTypes.number,
        element_count: PropTypes.number,
        materialized: PropTypes.bool,
        created_at: PropTypes.string
    })),
    // W6.1 (TASK-2630): above-threshold Built-mesh WebGL preview
    renderThreshold: PropTypes.number,
    onPreviewBuiltMesh: PropTypes.func,
    previewingRunId: PropTypes.number
};

MeshWorkflow.defaultProps = {
    isOpen: false,
    previewState: {status: null, result: null, error: null, progress: null},
    hasScenario: false,
    scenario: null,
    onAddMeshLayer: null,
    isMeshLayerAdded: false,
    builtMeshes: null,
    renderThreshold: 150000,
    onPreviewBuiltMesh: null,
    previewingRunId: null
};

export default MeshWorkflow;
