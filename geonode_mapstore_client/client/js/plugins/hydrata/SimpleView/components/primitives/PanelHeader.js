import React from 'react';
import PropTypes from 'prop-types';

/**
 * PanelHeader — panel title bar with optional close chip + optional actions slot.
 *
 * Best-of-breed sources:
 *   - `.simple-view-panel-header` (simpleView.css): font-size:x-large, border-bottom
 *   - `.anuga-pane-toolbar` / `.anuga-pane-head-title` (anuga.css): flex, gap:6px,
 *     padding 6px 8px, border-bottom rgba(255,255,255,0.18), dim bg rgba(0,0,0,0.10)
 *   - `.sv-tm-header` / `.sv-tm-title` (simpleView.css): TaskMonitor header
 *   - `.sv-legend-header` (simpleView.css): flex, justify-content:space-between
 *   - `.hgeval-header` (hgeval.css): flex, justify-content:space-between
 *   - `.hydrology-miller-header` (hydrology.css): 44px flex, border-bottom
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. SimpleView         — .simple-view-panel-header / .sv-legend-header
 *   2. Anuga/Scenarios    — .anuga-pane-toolbar + .anuga-pane-head-title
 *   3. Hydrology          — .hydrology-miller-header
 *   4. HGeval             — .hgeval-header
 *   5. TaskMonitor        — .sv-tm-header / .sv-tm-title
 *   6. VectorDraw         — inherits the .simple-view-panel-header pattern
 *   7. Swamm              — panel header row pattern
 *   8. TerrainWorkbench   — anuga-pane-toolbar usage
 * Total: 8 consumers.
 *
 * CRITICAL — close chip position:static safety:
 *   The surviving `.sv-legend-close` rule in simpleView.css has `position:absolute`,
 *   which causes a CASCADE TRAP: any close button that inadvertently picks up
 *   `.sv-legend-close` will escape the flex row and overlap the title text.
 *   This primitive renders the close chip via inline style with `position:'static'`
 *   (explicit, not relying on flex default) so the cascade trap cannot bite.
 *   The stable `.sv-panel-header-close` class is also emitted, but it carries NO
 *   positional CSS in simpleView.css — only the `.sv-legend-close` rule does, and
 *   that only applies when the class is literally "sv-legend-close". As long as
 *   PanelHeader uses sv-panel-header-close, the trap is avoided at the DOM level.
 *
 * Cascade-proof self-styling via inline styles (same principle as ErrorStrip):
 *   inline style >> later-loaded equal-specificity sheet.
 *
 * Usage:
 *   <PanelHeader title="Scenarios" onClose={handleClose} />
 *
 *   <PanelHeader title="Terrain Inputs" onClose={handleClose}>
 *     <button className="anuga-btn" onClick={handleNew}>+ New</button>
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

// CRITICAL: position:static (explicit) prevents the .sv-legend-close{position:absolute}
// cascade trap. The close chip is ALWAYS a flex sibling, never absolutely positioned.
const closeStyle = {
    position: 'static',   // safe: explicit override even if .sv-legend-close somehow applies
    flexShrink: 0,
    cursor: 'pointer',
    color: '#fff',
    backgroundColor: '#c9544d',
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
        <div className={className} style={{...headerStyle, ...style}}>
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
                    aria-label={closeLabel || 'Close panel'}
                    type="button"
                >
                    &times;
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
