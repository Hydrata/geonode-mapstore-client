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
 * Extracted so it can be reused or independently tested.
 */
export function PreviewSection({status, result, error, hasScenario, onStart}) {
    const isRunning = status === 'pending' || status === 'polling';

    let resultLabel = null;
    if (status === 'done' && result) {
        const tc = result.triangle_count;
        const aboveThreshold = result.above_render_threshold;
        const threshold = result.render_threshold || 150000;
        if (aboveThreshold) {
            resultLabel = (
                <div className="anuga-mesh-preview-metrics">
                    <span className="anuga-mesh-preview-count">{tc.toLocaleString()} triangles</span>
                    <span className="anuga-mesh-preview-note">
                        {'too large to preview on map (> ' + threshold.toLocaleString() + ')'}
                    </span>
                </div>
            );
        } else {
            const qa = result.mesh_qa || {};
            resultLabel = (
                <div className="anuga-mesh-preview-metrics">
                    <span className="anuga-mesh-preview-count">{(tc || 0).toLocaleString()} triangles</span>
                    {qa.min_angle_deg != null && (
                        <span className="anuga-mesh-preview-qa">{'min angle: ' + qa.min_angle_deg + '°'}</span>
                    )}
                    {qa.sliver_count > 0 && (
                        <span className="anuga-mesh-preview-qa anuga-mesh-preview-warn">
                            {qa.sliver_count + ' sliver(s)'}
                        </span>
                    )}
                </div>
            );
        }
    } else if (status === 'error') {
        resultLabel = (
            <div className="anuga-mesh-preview-error">{error || 'Preview failed'}</div>
        );
    }

    return (
        <div className="anuga-mesh-workflow-section anuga-mesh-workflow-preview">
            <button
                className={'btn btn-default anuga-mesh-preview-btn' + (isRunning ? ' disabled' : '')}
                disabled={isRunning || !hasScenario}
                title={!hasScenario ? 'Select a scenario to preview mesh' : 'Preview mesh triangulation'}
                onClick={onStart}
            >
                {isRunning ? (
                    <React.Fragment>
                        {Spinner && (
                            <Spinner color="#888" className="anuga-pending-spinner" spinnerName="circle" noFadeIn/>
                        )}
                        {' Previewing...'}
                    </React.Fragment>
                ) : 'Preview mesh'}
            </button>
            {resultLabel}
        </div>
    );
}

PreviewSection.propTypes = {
    status: PropTypes.string,
    result: PropTypes.object,
    error: PropTypes.string,
    hasScenario: PropTypes.bool,
    onStart: PropTypes.func.isRequired
};

PreviewSection.defaultProps = {
    status: null,
    result: null,
    error: null,
    hasScenario: false
};

/**
 * CostEstimateSection — renders the W3.2 pre-dispatch triangle/cost estimate.
 * Only renders when at least one of the two fields is non-null on the scenario.
 */
export function CostEstimateSection({scenario}) {
    if (!scenario) return null;
    const hasTriangles = scenario.mesh_triangle_count_estimate != null;
    const hasCost = scenario.compute_cost_estimate != null;
    if (!hasTriangles && !hasCost) return null;

    return (
        <div className="anuga-mesh-workflow-section anuga-mesh-workflow-estimate">
            <span className="anuga-scenario-estimate-label">
                {'Estimate: '}
                {hasTriangles
                    ? `~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`
                    : ''}
                {hasCost
                    ? ` — ~$${scenario.compute_cost_estimate.toFixed(2)} vCPU-h`
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
        <div className="anuga-mesh-workflow-section anuga-mesh-workflow-importexport">
            <button
                className="btn btn-default anuga-mesh-import-btn"
                disabled
                title="Import mesh (.2dm / UGRID) — coming soon"
            >
                {'Import mesh'}
            </button>
            <button
                className="btn btn-default anuga-mesh-export-btn"
                disabled
                title="Export mesh (.2dm / UGRID) — coming soon"
            >
                {'Export mesh'}
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * MeshWorkflow — the collapsible workflow panel attached to the Mesh pane.
 */
export function MeshWorkflow({
    isOpen,
    onToggle,
    previewState,
    onStartPreview,
    hasScenario,
    scenario
}) {
    return (
        <div className="anuga-mesh-workflow-container">
            <button
                className={'btn btn-xs anuga-mesh-workflow-toggle' + (isOpen ? ' active' : '')}
                onClick={onToggle}
                title={isOpen ? 'Close mesh workflow' : 'Open mesh workflow panel'}
                data-testid="anuga-mesh-workflow-toggle"
            >
                {isOpen ? 'Workflow ▲' : 'Workflow ▼'}
            </button>
            {isOpen && (
                <div className="anuga-mesh-workflow-panel" data-testid="anuga-mesh-workflow-panel">
                    <PreviewSection
                        status={previewState.status}
                        result={previewState.result}
                        error={previewState.error}
                        hasScenario={hasScenario}
                        onStart={onStartPreview}
                    />
                    <CostEstimateSection scenario={scenario}/>
                    <ImportExportSection/>
                    <div className="anuga-mesh-workflow-section anuga-mesh-workflow-hint">
                        <span className="anuga-mesh-workflow-hint-text">
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
        error: PropTypes.string
    }),
    onStartPreview: PropTypes.func.isRequired,
    hasScenario: PropTypes.bool,
    scenario: PropTypes.object
};

MeshWorkflow.defaultProps = {
    isOpen: false,
    previewState: {status: null, result: null, error: null},
    hasScenario: false,
    scenario: null
};

export default MeshWorkflow;
