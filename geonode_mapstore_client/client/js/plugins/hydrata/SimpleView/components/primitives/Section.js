import React from 'react';
import PropTypes from 'prop-types';

/**
 * Section — titled content section with a top-border divider.
 *
 * Best-of-breed sources:
 *   - `.sv-anuga-section` / `.sv-anuga-section-header` (anuga.css): border:1px solid
 *     --sv-section-border, border-radius:3px, padding:4px 0 6px
 *   - `.sv-anuga-scenario-pane-section` (anuga.css): flex, padding:6px 10px,
 *     border-bottom 1px solid --sv-section-border
 *   - `.hgeval-section` / `.hgeval-section h5` (hgeval.css): margin-bottom:12px,
 *     border-bottom:2px solid --sv-section-border, padding-bottom:3px
 *   - `.sv-anuga-terrain-recipe-section` (terrainWorkbench.css): border-top:1px solid
 *     --sv-section-border
 *   - `.idf-derive-step` (hydrology.css): border-bottom:1px solid rgba(255,255,255,0.10)
 *   - `.membership-visibility` (anuga.css): padding:8px 0, border-bottom section
 *   - `.sv-ref-section` (simpleView.css): margin-bottom:16px
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. Anuga/Scenarios    — sv-anuga-section, sv-anuga-scenario-pane-section, membership-visibility
 *   2. Hydrology          — idf-derive-step, hydrology-idf-subtoggle section, design-storm-card
 *   3. HGeval             — hgeval-section (with h5 border-bottom)
 *   4. TerrainWorkbench   — sv-anuga-terrain-recipe-section (border-top divider)
 *   5. SimpleView         — sv-ref-section, sv-anuga-mesh-workflow-section
 *   6. Swamm              — section-like groupings in swamm-bmp-form-panel
 *   7. TaskMonitor        — sv-tm-process-detail inner sections
 *   8. VectorDraw         — inherits section patterns from SimpleView chrome
 * Total: 8 consumers.
 *
 * Two variants:
 *   - 'default': border-bottom divider after the title row; content below
 *   - 'boxed': full border around the section (sv-anuga-section style)
 *
 * Themed via --sv-* tokens only; no hardcoded panel-chrome colours.
 *
 * Usage:
 *   <Section title="Status">
 *     <p>Content here</p>
 *   </Section>
 *
 *   <Section title="Fields" variant="boxed">
 *     <FormRow label="Name"><input /></FormRow>
 *   </Section>
 *
 *   // No title — section is just a spacing + divider unit
 *   <Section>
 *     <SomeBlock />
 *   </Section>
 */

const Section = ({
    title,
    children,
    variant,
    style,
    extraClassName
}) => {
    const isBoxed = variant === 'boxed';

    const wrapperStyle = isBoxed ? {
        border: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))',
        borderRadius: '3px',
        margin: 'var(--sv-section-gap, 4px) 0',
        padding: '4px 0 6px',
        flexShrink: 0,
        minHeight: 'auto',
        textAlign: 'left',
        ...style
    } : {
        marginBottom: 'var(--sv-section-gap, 8px)',
        textAlign: 'left',
        ...style
    };

    const titleStyle = {
        width: '100%',
        textAlign: 'left',
        borderBottom: '2px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))',
        paddingBottom: '3px',
        marginBottom: '6px',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))'
    };

    // Only append a modifier for non-default variants (so default renders just 'sv-section').
    const variantClass = variant && variant !== 'default' ? ` sv-section--${variant}` : '';
    const className = 'sv-section' + variantClass + (extraClassName ? ' ' + extraClassName : '');

    return (
        <div className={className} style={wrapperStyle}>
            {title !== null && title !== undefined ? (
                <div className="sv-section-title" style={titleStyle}>{title}</div>
            ) : null}
            {children}
        </div>
    );
};

Section.propTypes = {
    /** Section heading text or node. Omit for an un-titled spacing unit. */
    title: PropTypes.node,
    /** Section body content. */
    children: PropTypes.node,
    /**
     * Visual variant:
     *   - 'default' (default): bottom-border after the title; content flows below
     *   - 'boxed': full border around the section (sv-anuga-section style)
     */
    variant: PropTypes.oneOf(['default', 'boxed']),
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object,
    /** Per-panel variant class carried alongside sv-section. */
    extraClassName: PropTypes.string
};

Section.defaultProps = {
    variant: 'default'
};

export {Section};
