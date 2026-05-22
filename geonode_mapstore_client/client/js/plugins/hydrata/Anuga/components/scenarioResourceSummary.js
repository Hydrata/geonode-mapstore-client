import React from "react";
const PropTypes = require('prop-types');

/**
 * TASK-C-scenarios-miller Wave 3A — per-resource summary card. Rendered
 * BENEATH each Pane 3 dropdown when the dropdown has a value, showing
 * a glyph + inline metadata + optional trailing meta (e.g. an EPSG code).
 *
 * Why a dedicated component instead of inline JSX:
 *   - Both Inputs (terrain, boundary, inflow, rainfall) and Advanced
 *     (friction, structures, mesh_region, network) reuse the same shape.
 *   - The run-history list inside the Status-and-actions pane uses the
 *     same card shell with a clock or check glyph (see anuga.css
 *     anuga-scenario-resource-summary).
 *
 * Glyph hooks:
 *   - kind === 'terrain'     → glyphicon-tower (triangle-mountain
 *                              approximation; the shipped icon font
 *                              has no native mountain glyph).
 *   - kind === 'boundary'    → glyphicon-record (dashed polygon
 *                              approximation; the icon-font lacks a
 *                              clean dashed-poly glyph).
 *   - kind === 'inflow'      → glyphicon-arrow-right
 *   - kind === 'rainfall'    → glyphicon-cloud
 *   - kind === 'friction'    → glyphicon-th
 *   - kind === 'structure'   → glyphicon-link
 *   - kind === 'mesh_region' → glyphicon-screenshot
 *   - kind === 'network'     → glyphicon-share-alt
 *   - kind === 'history'     → glyphicon-time
 *   - kind === 'history-ok'  → glyphicon-ok
 *   - kind === 'history-err' → glyphicon-exclamation-sign
 *
 * The `meta` slot floats to the trailing edge (margin-left: auto via
 * .anuga-scenario-resource-summary-meta). Pass `null` or omit to skip.
 */

const KIND_TO_GLYPH = {
    terrain: 'glyphicon-tower',
    boundary: 'glyphicon-record',
    inflow: 'glyphicon-arrow-right',
    rainfall: 'glyphicon-cloud',
    friction: 'glyphicon-th',
    structure: 'glyphicon-link',
    mesh_region: 'glyphicon-screenshot',
    network: 'glyphicon-share-alt',
    history: 'glyphicon-time',
    'history-ok': 'glyphicon-ok',
    'history-err': 'glyphicon-exclamation-sign'
};

const ScenarioResourceSummary = ({kind, body, meta, extraClassName}) => {
    if (!body && !meta) return null;
    const glyph = KIND_TO_GLYPH[kind] || 'glyphicon-record';
    const className = [
        'anuga-scenario-resource-summary',
        kind ? `anuga-scenario-resource-summary--${kind}` : '',
        extraClassName || ''
    ].filter(Boolean).join(' ');
    return (
        <div className={className}>
            <span
                className={'anuga-scenario-resource-summary-glyph glyphicon ' + glyph}
                aria-hidden="true"
            />
            <span className="anuga-scenario-resource-summary-body">
                {body}
            </span>
            {meta != null ? ( // eslint-disable-line no-eq-null, eqeqeq
                <span className="anuga-scenario-resource-summary-meta">{meta}</span>
            ) : null}
        </div>
    );
};

ScenarioResourceSummary.propTypes = {
    kind: PropTypes.string,
    body: PropTypes.node,
    meta: PropTypes.node,
    extraClassName: PropTypes.string
};

// Wave 3D Tier B7 — summary card renders once per dropdown (up to 8 times
// per pane) and is pure on its props. Memoising trims rework on unrelated
// re-renders of the parent pane.
const MemoScenarioResourceSummary = React.memo(ScenarioResourceSummary);

/**
 * Convenience helper: derive a one-line summary string from a resource
 * object (terrain/boundary/inflow/rainfall/friction/etc). Falls back to
 * the resource title when no domain-specific fields are present so the
 * card still renders something useful for legacy rows that pre-date the
 * extended metadata.
 *
 * Returns `null` when no resource matches the assigned id, signalling to
 * the caller that the card should be omitted entirely.
 */
function summariseResource(resourceList, assignedId, kind) {
    if (!assignedId || !Array.isArray(resourceList)) return null;
    const found = resourceList.find(r => r && r.id === assignedId);
    if (!found) return null;
    // Generic shape: title + optional units/dimension hints. The card body
    // collapses to whichever fields the backend serialised.
    const bits = [];
    if (found.title) bits.push(found.title);
    if (kind === 'terrain') {
        if (found.resolution_m) bits.push(`${found.resolution_m} m raster`);
        if (found.area_km2) bits.push(`${found.area_km2} km²`);
    } else if (kind === 'boundary') {
        if (found.segment_count) bits.push(`${found.segment_count} segments`);
        if (found.perimeter_km) bits.push(`${found.perimeter_km} km perimeter`);
    } else if (kind === 'inflow') {
        if (found.peak_value && found.peak_unit) {
            bits.push(`Peak ${found.peak_value} ${found.peak_unit}`);
        }
    } else if (kind === 'rainfall') {
        if (found.total_mm) bits.push(`${found.total_mm} mm total`);
        if (found.duration_hr) bits.push(`${found.duration_hr}h duration`);
    }
    return {
        body: bits.join(' · '),
        meta: kind === 'terrain' && found.crs ? found.crs : null
    };
}

export {MemoScenarioResourceSummary as ScenarioResourceSummary, summariseResource};
