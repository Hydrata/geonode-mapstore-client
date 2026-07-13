import React from 'react';
import PropTypes from 'prop-types';

/**
 * PanelHeader — panel title bar with optional close chip + optional actions slot.
 *
 * Best-of-breed sources:
 *   - `.simple-view-panel-header` (simpleView.css): font-size:x-large, border-bottom
 *   - `.sv-anuga-pane-toolbar` / `.sv-anuga-pane-head-title` (anuga.css): flex, gap:6px,
 *     padding 6px 8px, border-bottom rgba(255,255,255,0.18), dim bg rgba(0,0,0,0.10)
 *   - `.sv-tm-header` / `.sv-tm-title` (simpleView.css): TaskMonitor header
 *   - `.sv-legend-header` (simpleView.css): flex, justify-content:space-between
 *   - `.hgeval-header` (hgeval.css): flex, justify-content:space-between
 *   - `.hydrology-miller-header` (hydrology.css): 44px flex, border-bottom
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. SimpleView         — .simple-view-panel-header / .sv-legend-header
 *   2. Anuga/Scenarios    — .sv-anuga-pane-toolbar + .sv-anuga-pane-head-title
 *   3. Hydrology          — .hydrology-miller-header
 *   4. HGeval             — .hgeval-header
 *   5. TaskMonitor        — .sv-tm-header / .sv-tm-title
 *   6. VectorDraw         — inherits the .simple-view-panel-header pattern
 *   7. Swamm              — panel header row pattern
 *   8. TerrainWorkbench   — sv-anuga-pane-toolbar usage
 * Total: 8 consumers.
 *
 * Close chip positioning (TASK-2235 r2, operator standard):
 *   The chip is corner-anchored — inline `position:absolute; top:2px; right:2px`
 *   inside the position:relative header — so it hugs the panel's top-right
 *   corner with exactly 2px clearance regardless of header padding, matching
 *   the Task Manager chip. The historic cascade trap (an absolutely positioned
 *   `.sv-legend-close` chip overlapping the title) cannot bite here because the
 *   header reserves padding-right for the chip whenever onClose renders, and
 *   the chip's inline top/right always win over any bleeding sheet rule.
 *
 * Cascade-proof self-styling via inline styles (same principle as ErrorStrip):
 *   inline style >> later-loaded equal-specificity sheet.
 *
 * Usage:
 *   <PanelHeader title="Scenarios" onClose={handleClose} />
 *
 *   <PanelHeader title="Terrain Inputs" onClose={handleClose}>
 *     <button className="sv-anuga-btn" onClick={handleNew}>+ New</button>
 *   </PanelHeader>
 *
 *   // No close button (legend-style panels with an external close):
 *   <PanelHeader title="Legend" />
 */

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: 'var(--sv-header-padding, 8px 12px)',
    borderBottom: '1px solid var(--sv-panel-border, rgba(255, 255, 255, 0.6))',
    flexShrink: 0,
    position: 'relative',  // needed for some callers that position children inside
    textAlign: 'left'
};

const titleStyle = {
    flex: 1,
    margin: 0,
    fontSize: 'var(--sv-header-font-size, 14px)',
    fontWeight: 600,
    color: 'var(--sv-text, rgba(255, 255, 255, 0.85))',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
};

const actionsStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8
};

// TASK-2235: RED close convention (operator standard 2026-07-13) — matches the
// Task Manager .sv-legend-close chip (same 24px box, same glyphicon-remove
// cross) and REPLACES the W1.9 translucent chip on every PanelHeader consumer.
// TASK-2235 r2: the chip is deliberately corner-anchored — absolute at
// top/right 2px inside the position:relative header, so it hugs the panel's
// top-right corner with exactly 2px clearance regardless of header padding.
// The old cascade-trap concern (an absolute chip overlapping the title) is
// neutralised structurally: the header reserves padding-right for the chip
// (see closePaddingStyle below). Hover rides mouse handlers because this base
// style is inline (cascade-proof), so no sheet :hover rule can reach it.
const closeStyle = {
    position: 'absolute',
    top: '2px',
    right: '2px',
    cursor: 'pointer',
    color: 'var(--sv-text, rgba(255, 255, 255, 0.95))',
    backgroundColor: 'var(--sv-close-bg, #c9544d)',
    border: 'none',
    borderRadius: '3px',
    width: 'var(--sv-icon-size, 24px)',
    height: 'var(--sv-icon-size, 24px)',
    padding: 0,
    fontSize: '14px',
    lineHeight: 'var(--sv-icon-size, 24px)',
    textAlign: 'center',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
};

// Reserved on the header whenever the close chip renders, so the flex title
// can never run under the corner-anchored chip.
const closePaddingStyle = {
    paddingRight: 'calc(var(--sv-icon-size, 24px) + 8px)'
};

const PanelHeader = ({
    title,
    onClose,
    children,
    closeLabel,
    style,
    extraClassName
}) => {
    const className = 'sv-panel-header' + (extraClassName ? ' ' + extraClassName : '');

    return (
        <div className={className} style={{...headerStyle, ...(onClose ? closePaddingStyle : {}), ...style}}>
            {title !== null && title !== undefined ? (
                <h4 className="sv-panel-header-title" style={titleStyle}>{title}</h4>
            ) : null}
            {children ? (
                <div className="sv-panel-header-actions" style={actionsStyle}>
                    {children}
                </div>
            ) : null}
            {onClose ? (
                <button
                    className="sv-panel-header-close"
                    style={closeStyle}
                    onClick={onClose}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--sv-close-bg-hover, #b5403a)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--sv-close-bg, #c9544d)'; }}
                    aria-label={closeLabel || 'Close panel'}
                    type="button"
                >
                    <span className="glyphicon glyphicon-remove" aria-hidden="true" />
                </button>
            ) : null}
        </div>
    );
};

PanelHeader.propTypes = {
    /** Panel title text or node. Renders as an <h4>. */
    title: PropTypes.node,
    /**
     * Close handler. When provided, a ×-button chip is rendered as a flex
     * sibling of the title — NEVER absolutely positioned (cascade-trap safety).
     * Omit when the panel is closed externally (e.g. Redux action only).
     */
    onClose: PropTypes.func,
    /**
     * Optional action chips / buttons rendered between title and close chip.
     * Example: "New Scenario" button, Compare toggle.
     */
    children: PropTypes.node,
    /** Accessible label for the close button. Default: "Close panel". */
    closeLabel: PropTypes.string,
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object,
    /** Per-panel variant class carried alongside sv-panel-header. */
    extraClassName: PropTypes.string
};

export {PanelHeader};
