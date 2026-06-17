import React from 'react';
import PropTypes from 'prop-types';

/**
 * FormRow — a label + control row for dark-glass forms.
 *
 * Best-of-breed sources:
 *   - `.simple-view-panel-item-row` (simpleView.css lines 141-149):
 *     display:flex, justify-content:space-between, align-items:center,
 *     height:40px, padding:4px 10px, border:1px solid rgba(255,255,255,0.2)
 *   - `.sv-anuga-scenario-pane-section` (anuga.css lines 1649-1655):
 *     display:flex, align-items:center, gap:8px, padding:6px 10px,
 *     border-bottom:1px solid --sv-section-border
 *   - `.sv-anuga-scenario-pane-label` (anuga.css): width:130px, flex-shrink:0,
 *     font-size:12px, color rgba(255,255,255,0.85)
 *   - `.sv-anuga-scenario-pane-field` (anuga.css): flex:1, min-width:0, flex row
 *   - `.hgeval-input-panel label` (hgeval.css): font-weight:600, font-size:12px,
 *     color --sv-text-dim, display:block
 *   - `.hgeval-coord-row .form-group` (hgeval.css): flex:1, margin-bottom:8px
 *   - `.membership-add-form-row` (anuga.css): display:flex, gap:4px, flex-wrap
 *   - `.idf-derive-step` (hydrology.css): label + field structure throughout
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. Anuga/Scenarios    — sv-anuga-scenario-pane-section (label+field rows throughout
 *                           the 3-pane scenario detail — Run, Mesh, Terrain, Inputs)
 *   2. Hydrology          — idf-derive-step label+input rows, hydrology-networks-pane rows
 *   3. HGeval             — hgeval-input-panel form-group rows, hgeval-coord-row
 *   4. SimpleView         — simple-view-panel-item-row (dataset transparency rows)
 *   5. Swamm              — swamm-bmp-form-panel field rows (input grid)
 *   6. TaskMonitor        — sv-tm-subtask-row (label + status)
 *   7. TerrainWorkbench   — terrain recipe form field rows
 * Total: 7 consumers.
 *
 * Two layout modes:
 *   - 'inline' (default): label left, control right, single flex row
 *     (matches sv-anuga-scenario-pane-section + simple-view-panel-item-row)
 *   - 'stacked': label above, control below (matches hgeval-input-panel)
 *
 * Themed via --sv-* tokens only; no hardcoded panel-chrome colours.
 *
 * Usage:
 *   // Inline (side-by-side)
 *   <FormRow label="DEM source">
 *     <select className="scenario-select">...</select>
 *   </FormRow>
 *
 *   // Stacked (label above)
 *   <FormRow label="Latitude" layout="stacked">
 *     <input type="number" />
 *   </FormRow>
 *
 *   // With hint
 *   <FormRow label="Duration" hint="comma-separated, e.g. 15,30,60">
 *     <input className="idf-derive-wide-input" />
 *   </FormRow>
 *
 *   // Divider after the row (sv-anuga-scenario-pane-section style)
 *   <FormRow label="Mesh type" divider>
 *     <select />
 *   </FormRow>
 */

const getRowStyle = (layout, divider, style) => {
    const base = layout === 'stacked' ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sv-form-row-gap, 4px)',
        padding: '4px 0',
        textAlign: 'left'
    } : {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sv-form-row-gap, 8px)',
        padding: '6px 10px',
        textAlign: 'left'
    };

    if (divider) {
        base.borderBottom = '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.18))';
    }

    return { ...base, ...(style || {}) };
};

const labelStyle = {
    width: '130px',
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--sv-text, rgba(255, 255, 255, 0.85))',
    margin: 0
};

const stackedLabelStyle = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))',
    display: 'block',
    marginBottom: '2px'
};

const fieldStyle = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const hintStyle = {
    fontSize: '10.5px',
    color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.55))',
    marginTop: '2px',
    display: 'block'
};

const FormRow = ({
    label,
    children,
    layout,
    divider,
    hint,
    labelWidth,
    style,
    extraClassName
}) => {
    const rowStyle = getRowStyle(layout, divider, style);
    const isStacked = layout === 'stacked';
    const _labelStyle = isStacked ? stackedLabelStyle : {
        ...labelStyle,
        ...(labelWidth ? { width: labelWidth } : {})
    };

    const className = 'sv-form-row' + (isStacked ? ' sv-form-row--stacked' : ' sv-form-row--inline') + (extraClassName ? ' ' + extraClassName : '');

    if (isStacked) {
        return (
            <div className={className} style={rowStyle}>
                {label !== null && label !== undefined ? (
                    <label className="sv-form-row-label" style={_labelStyle}>{label}</label>
                ) : null}
                <div className="sv-form-row-field">
                    {children}
                </div>
                {hint ? (
                    <span className="sv-form-row-hint" style={hintStyle}>{hint}</span>
                ) : null}
            </div>
        );
    }

    return (
        <div className={className} style={rowStyle}>
            {label !== null && label !== undefined ? (
                <span className="sv-form-row-label" style={_labelStyle}>{label}</span>
            ) : null}
            <div className="sv-form-row-field" style={fieldStyle}>
                {children}
            </div>
            {hint ? (
                <span className="sv-form-row-hint" style={hintStyle}>{hint}</span>
            ) : null}
        </div>
    );
};

FormRow.propTypes = {
    /** Label text or node (left side in inline mode, above in stacked mode). */
    label: PropTypes.node,
    /** Form control(s) — input, select, checkbox, etc. */
    children: PropTypes.node,
    /**
     * Layout mode:
     *   - 'inline' (default): label left (130px), control right (flex:1)
     *   - 'stacked': label above, control below (hgeval-input-panel style)
     */
    layout: PropTypes.oneOf(['inline', 'stacked']),
    /**
     * When true, adds a border-bottom divider (sv-anuga-scenario-pane-section style).
     * Use on all but the last row in a section to match the Scenarios pane.
     */
    divider: PropTypes.bool,
    /** Optional hint text rendered below the control. */
    hint: PropTypes.node,
    /**
     * Override the label column width (inline mode only). CSS length string.
     * Default: 130px (matches sv-anuga-scenario-pane-label).
     */
    labelWidth: PropTypes.string,
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object,
    /** Per-panel variant class carried alongside sv-form-row. */
    extraClassName: PropTypes.string
};

FormRow.defaultProps = {
    layout: 'inline',
    divider: false
};

export {FormRow};
