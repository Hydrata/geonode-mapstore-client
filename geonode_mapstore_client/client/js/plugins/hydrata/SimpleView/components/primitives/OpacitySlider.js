import React from "react";
import PropTypes from 'prop-types';
const Slider = require('react-nouislider');

/**
 * Presentational transparency slider for a layer row.
 *
 * Presentation-only; no redux. Always-mounted with CSS-toggled `hidden`
 * (R04) so the nouislider instance is not unmounted when the delete-
 * confirm overlay is open. `onChange(values)` receives nouislider's
 * raw array; the container converts to the `0..1` opacity scale.
 */
const OpacitySlider = ({opacity, onChange, hidden}) => {
    const start = (opacity ?? 1) * 100;
    return (
        <div
            className={
                "mapstore-slider sv-dataset-transparency with-tooltip menu-row-slider-subrow"
                + (hidden ? " sv-glyph-hidden" : "")
            }
            onClick={(e) => { e.stopPropagation(); }}
            style={{ width: "150px", marginBottom: "0", marginTop: "2px" }}
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
