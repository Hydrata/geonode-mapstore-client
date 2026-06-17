import React from 'react';
import PropTypes from 'prop-types';

/**
 * Card — content card with optional header slot.
 *
 * Best-of-breed sources:
 *   - `.anuga-scenario-status-card` (anuga.css lines 1539-1545): dark tinted card,
 *     margin:6px 10px 12px, bg rgba(0,0,0,0.20), border rgba(255,255,255,0.18),
 *     border-radius:4px, padding:14px
 *   - `.anuga-scenario-resource-summary` (anuga.css lines 1405-1416): compact card,
 *     bg rgba(0,0,0,0.20), border rgba(255,255,255,0.08), border-radius:3px
 *   - `.anuga-starter-card` (anuga.css): bg rgba(255,255,255,0.08), dashed border
 *   - `.design-storm-card` (hydrology.css): bg rgba(255,255,255,0.04),
 *     border rgba(255,255,255,0.15), border-radius:4px
 *   - `.sv-terrain-bbox-inline-review` (anuga.css): bg rgba(255,255,255,0.06), full border
 *   - `.anuga-mesh-preview-too-large` (anuga.css): amber-left-border card
 *   - `.hgeval-selected-coords` info-card (hgeval.css)
 *
 * Chart carve-out (grill q-1, TASK-1534, MANDATORY):
 *   variant="chart" — the card FRAME (border/header chrome) stays dark-glass,
 *   but the card BODY (the plotting surface) uses --sv-chart-surface (light).
 *   This is the documented mechanism so W1 panel agents wrapping Hydrology
 *   (IDF + design-storm) and Swamm (pollutant bar/pie) get a LIGHT chart
 *   surface inside a DARK frame WITHOUT ever darkening recharts.
 *   recharts 0.22.4 needs light backgrounds — TASK-1534 deliberately keeps
 *   chart cards white so axes/grid lines read. See:
 *   docs/reports/2026-06-17-q-1-chart-surface-carveout.html
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. Anuga/Scenarios    — anuga-scenario-status-card, anuga-scenario-resource-summary,
 *                           anuga-starter-card, sv-terrain-bbox-inline-review
 *   2. Hydrology          — design-storm-card, design-storm-preview-card,
 *                           design-storm-chart-card (→ variant="chart"),
 *                           custom-pattern-editor-card
 *   3. HGeval             — hgeval-selected-coords, hgeval-disclaimer
 *   4. Swamm              — swamm-bmp chart body containers
 *   5. TerrainWorkbench   — terrain bbox review card
 *   6. TaskMonitor        — sv-tm-process-detail card-like detail pane
 *   7. SimpleView         — menu-row-mini-container card
 * Total: 7 consumers.
 *
 * Themed via --sv-* tokens only; no hardcoded panel-chrome colours.
 *
 * Usage:
 *   // Dark-glass card (default)
 *   <Card>
 *     <p>Status details here</p>
 *   </Card>
 *
 *   // Chart carve-out: dark frame, light body for recharts
 *   <Card variant="chart" title="IDF Curve">
 *     <ResponsiveContainer>...</ResponsiveContainer>
 *   </Card>
 *
 *   // Dashed "starter" card
 *   <Card variant="dashed">
 *     <p>Start by adding a terrain layer...</p>
 *   </Card>
 */

// Shared frame styles
const getCardFrameStyle = (variant, style) => {
    const base = {
        margin: 'var(--sv-card-margin, 6px 0)',
        borderRadius: 'var(--sv-card-radius, 4px)',
        textAlign: 'left',
        overflow: 'hidden'
    };

    if (variant === 'chart') {
        return {
            ...base,
            background: 'rgba(0, 0, 0, 0.20)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            ...style
        };
    }
    if (variant === 'dashed') {
        return {
            ...base,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px dashed var(--sv-section-border, rgba(255, 255, 255, 0.6))',
            padding: 'var(--sv-card-padding, 12px 14px)',
            ...style
        };
    }
    if (variant === 'info') {
        return {
            ...base,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))',
            padding: 'var(--sv-card-padding, 10px 12px)',
            ...style
        };
    }
    // default dark card
    return {
        ...base,
        background: 'rgba(0, 0, 0, 0.20)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        padding: 'var(--sv-card-padding, 10px 12px)',
        ...style
    };
};

const cardHeaderStyle = {
    padding: '6px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--sv-text, rgba(255, 255, 255, 0.85))'
};

// Chart body uses --sv-chart-surface (light) so recharts axes/grid read.
// DO NOT change this to dark — see TASK-1534 carve-out decision.
const getBodyStyle = (variant) => {
    if (variant === 'chart') {
        return {
            padding: 'var(--sv-card-padding, 8px)',
            background: 'var(--sv-chart-surface, #ffffff)',
            borderRadius: '0 0 var(--sv-card-radius, 4px) var(--sv-card-radius, 4px)'
        };
    }
    // For non-chart variants the body inherits the frame padding (already set)
    return {};
};

const Card = ({
    title,
    children,
    variant,
    style,
    bodyStyle,
    extraClassName
}) => {
    const frameStyle = getCardFrameStyle(variant, variant !== 'chart' ? style : undefined);
    const _bodyStyle = getBodyStyle(variant);
    const hasHeader = title !== null && title !== undefined;

    const className = 'sv-card' + (variant && variant !== 'default' ? ` sv-card--${variant}` : '') + (extraClassName ? ' ' + extraClassName : '');

    if (variant === 'chart') {
        // Chart variant: explicit header + body separation so frame is dark, body is light
        return (
            <div className={className} style={{...frameStyle, ...(style || {})}}>
                {hasHeader ? (
                    <div className="sv-card-header" style={cardHeaderStyle}>{title}</div>
                ) : null}
                <div className="sv-card-body" style={{..._bodyStyle, ...(bodyStyle || {})}}>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className={className} style={frameStyle}>
            {hasHeader ? (
                <div className="sv-card-header" style={cardHeaderStyle}>{title}</div>
            ) : null}
            <div className="sv-card-body" style={bodyStyle || {}}>
                {children}
            </div>
        </div>
    );
};

Card.propTypes = {
    /** Optional card heading, rendered in a dark-glass header row above the body. */
    title: PropTypes.node,
    /** Card body content. */
    children: PropTypes.node,
    /**
     * Visual variant:
     *   - 'default' (default): standard dark-glass card (anuga-scenario-status-card)
     *   - 'chart': dark frame + LIGHT body (--sv-chart-surface) for recharts — TASK-1534
     *   - 'dashed': dashed border + lighter bg (anuga-starter-card style)
     *   - 'info': tinted info card (sv-terrain-bbox-inline-review style)
     */
    variant: PropTypes.oneOf(['default', 'chart', 'dashed', 'info']),
    /** Inline style pass-through on the card FRAME. */
    style: PropTypes.object,
    /** Inline style pass-through on the card BODY (inside the frame). */
    bodyStyle: PropTypes.object,
    /** Per-panel variant class carried alongside sv-card. */
    extraClassName: PropTypes.string
};

Card.defaultProps = {
    variant: 'default'
};

export {Card};
