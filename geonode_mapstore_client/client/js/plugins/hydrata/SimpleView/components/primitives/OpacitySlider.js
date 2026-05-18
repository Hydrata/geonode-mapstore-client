import React from "react";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');

/**
 * TASK-1007 (W3) — Pure presentational replacement for the inline
 * `<div className="menu-row-slider-subrow">` block in
 * `simpleViewMenuRow.js` (lifted out of `.menu-row-right` in W2 and
 * placed as the LAST CHILD of `.menu-row` per AC#2).
 *
 * Always-mounted + CSS-toggle (R04): `hidden` prop appends the
 * `.glyph-hidden` class to the wrapper, NEVER `display:none`. The
 * slider DOM stays in the tree even while the delete-confirm overlay
 * is shown, so React reconciliation doesn't unmount the nouislider
 * instance (which would lose internal range state).
 *
 * Wrapper className + inline style are byte-identical to the pre-W3
 * inline block (R03 class-name contract): same
 * `mapstore-slider dataset-transparency with-tooltip menu-row-slider-subrow`
 * prefix, same width/marginBottom/marginTop. `onClick` stops
 * propagation so clicking the slider doesn't bubble to the parent
 * row's click handlers (matches today).
 *
 * Slider props match the pre-W2 behaviour:
 *  - `step=1`, `range.min=0`, `range.max=100`
 *  - `start` is `opacity * 100` (or 100 if opacity is null/undefined)
 *  - `onChange(values)` is called with a single arg (nouislider's
 *    array shape) — the container's setOpacity handler does the
 *    `parseFloat(value) * 0.01` conversion.
 */
const OpacitySlider = ({opacity, onChange, hidden}) => {
    // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom matches pre-W3 inline behaviour
    const start = opacity != null ? opacity * 100 : 100;
    return (
        <div
            className={
                "mapstore-slider dataset-transparency with-tooltip menu-row-slider-subrow"
                + (hidden ? " glyph-hidden" : "")
            }
            onClick={(e) => { e.stopPropagation(); }}
            style={{ width: "150px", marginBottom: "-10px", marginTop: "2px" }}
        >
            <Slider
                step={1}
                start={start}
                range={{min: 0, max: 100}}
                onChange={onChange}
            />
        </div>
    );
};

OpacitySlider.propTypes = {
    opacity: PropTypes.number,
    onChange: PropTypes.func,
    hidden: PropTypes.bool
};

export {OpacitySlider};
