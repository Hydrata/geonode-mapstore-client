import React from 'react';
import PropTypes from 'prop-types';

/**
 * PanelShell — outer dark-glass panel container.
 *
 * Best-of-breed source: `.simple-view-panel` (simpleView.css lines 114-139).
 * Reproduces the position:absolute / backdrop-filter / token-backed chrome in a
 * reusable component so W1 panel agents stop hand-rolling the same 15-line
 * inline-style block.
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. SimpleView         — .simple-view-panel (the canonical origin)
 *   2. Anuga/Scenarios    — .anuga-panel + .simple-view-panel base
 *   3. Hydrology          — .hydrology-miller-panel (top:70px, flex col)
 *   4. Swamm              — #swamm-bmp-form-panel / #swamm-bmp-chart-panel
 *   5. HGeval             — .hgeval-panel (right-side drawer)
 *   6. TaskMonitor        — .simple-view-panel shell (migrated by TASK-1665)
 *   7. VectorDraw         — inherits .simple-view-panel
 * Total: 7 consumers.
 *
 * IMPORTANT — cascade-proof self-styling:
 *   Inline style objects beat any later-loaded equal-specificity sheet, which
 *   is critical inside `.simple-view-panel` where `.msgapi .simple-view-panel`
 *   overrides reach specificity (0,3,1). The stable `sv-panel-shell` class hook
 *   is still emitted so a later CSS pass can attach richer chrome.
 *
 * Themed via --sv-* tokens ONLY; no hardcoded panel-chrome colour values.
 *
 * Usage:
 *   <PanelShell>
 *     <PanelHeader title="Scenarios" onClose={handleClose} />
 *     <div>...content...</div>
 *   </PanelShell>
 *
 *   // Right-side drawer (HGeval style)
 *   <PanelShell position="fixed-right" minWidth="360px">
 *     ...
 *   </PanelShell>
 */

const PanelShell = ({
    children,
    position,
    minWidth,
    maxHeight,
    style,
    extraClassName
}) => {
    const shellStyle = {
        position: position === 'fixed-right' ? 'fixed' : 'absolute',
        zIndex: 1025,
        top: position === 'fixed-right' ? 0 : 'var(--sv-panel-top, 65px)',
        ...(position === 'fixed-right' ? { right: 0, bottom: 0, width: minWidth || '360px' } : {
            left: 20,
            minWidth: minWidth || '500px',
            maxHeight: maxHeight || 'calc(100vh - var(--sv-panel-top, 65px) - 110px)'
        }),
        backgroundColor: 'var(--sv-panel-bg, rgba(0, 60, 136, 0.88))',
        WebkitBackdropFilter: 'blur(10px)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--sv-panel-border, rgba(255, 255, 255, 0.6))',
        borderRadius: '4px',
        padding: 'var(--sv-panel-padding, 5px 10px)',
        fontSize: '12px',
        lineHeight: '1.5',
        color: 'white',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        ...style
    };

    const className = 'sv-panel-shell' + (extraClassName ? ' ' + extraClassName : '');

    return (
        <div className={className} style={shellStyle}>
            {children}
        </div>
    );
};

PanelShell.propTypes = {
    /** Panel content — typically <PanelHeader> + scrollable body + optional footer. */
    children: PropTypes.node,
    /**
     * Layout mode.
     * - 'absolute' (default): left:20px, top:--sv-panel-top, constrained maxHeight
     * - 'fixed-right': full-height right drawer (HGeval style)
     */
    position: PropTypes.oneOf(['absolute', 'fixed-right']),
    /** Override minWidth (absolute) or width (fixed-right). CSS length string. */
    minWidth: PropTypes.string,
    /** Override maxHeight (absolute mode only). CSS length string. */
    maxHeight: PropTypes.string,
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object,
    /** Per-panel variant class carried alongside sv-panel-shell. */
    extraClassName: PropTypes.string
};

PanelShell.defaultProps = {
    position: 'absolute'
};

export {PanelShell};
