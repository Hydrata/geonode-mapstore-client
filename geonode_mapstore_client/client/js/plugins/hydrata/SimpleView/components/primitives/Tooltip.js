import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Tooltip — focusable tag that reveals a hover/focus text bubble.
 *
 * Pulled into the v1 set by the operator's richness verdict at the W2 UAT
 * gate (TASK-1682). First interactive primitive: the trigger is a real tab
 * stop, so the bubble works for keyboard users and is assertable in tests —
 * a hover-only tooltip is invisible to both.
 *
 * Portal-free: the bubble positions off the trigger inside the panel's
 * stacking context, so it never fights the .gn-page-wrapper z-index stack.
 *
 * Themed via --sv-* tokens only; no hardcoded colour values.
 *
 * Usage:
 *   <Tooltip label="DEM">Digital Elevation Model — the terrain raster…</Tooltip>
 *   <Tooltip label="CRS" placement="bottom" showGlyph={false}>…</Tooltip>
 */

let tooltipIdCounter = 0;

const Tooltip = ({ label, children, placement, showGlyph }) => {
    const [visible, setVisible] = useState(false);
    const idRef = useRef(null);
    if (idRef.current === null) {
        tooltipIdCounter += 1;
        idRef.current = `sv-tooltip-${tooltipIdCounter}`;
    }
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            hide();
        }
    };

    return (
        <span className="sv-tooltip">
            <span
                className="sv-tooltip-trigger"
                tabIndex={0}
                aria-describedby={visible ? idRef.current : undefined}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                onKeyDown={onKeyDown}
            >
                {label}
                {showGlyph && (
                    <span
                        className="glyphicon glyphicon-info-sign sv-tooltip-glyph"
                        aria-hidden="true"
                    />
                )}
            </span>
            {visible && (
                <span
                    id={idRef.current}
                    role="tooltip"
                    className={`sv-tooltip-bubble is-${placement}`}
                >
                    {children}
                </span>
            )}
        </span>
    );
};

Tooltip.propTypes = {
    /** Visible trigger text (the tag) */
    label: PropTypes.node.isRequired,
    /** Tooltip body revealed on hover/focus */
    children: PropTypes.node.isRequired,
    /** Bubble placement relative to the trigger: top | bottom */
    placement: PropTypes.oneOf(['top', 'bottom']),
    /** Show the info glyph after the label */
    showGlyph: PropTypes.bool
};

Tooltip.defaultProps = {
    placement: 'top',
    showGlyph: true
};

export { Tooltip };
