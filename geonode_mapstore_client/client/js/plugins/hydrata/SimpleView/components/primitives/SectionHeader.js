import React from "react";
import PropTypes from 'prop-types';

/**
 * Presentational `.row.sv-menu-row.sv-menu-row-header` section header used by
 * anugaInputMenu / InputSection / swammInputMenu.
 *
 * Presentation-only; no redux. `extraClassName` carries the per-site
 * variant (Anuga uses `sv-anuga-section-header`); `style` carries the
 * Swamm inline-width pass-through so the primitive stays uncoupled
 * from Swamm CSS.
 */
const SectionHeader = ({children, extraClassName, style}) => {
    const className = "row sv-menu-row sv-menu-row-header"
        + (extraClassName ? " " + extraClassName : "");
    return (
        <div className={className} style={style}>
            {children}
        </div>
    );
};

SectionHeader.propTypes = {
    children: PropTypes.node,
    extraClassName: PropTypes.string,
    style: PropTypes.object
};

export {SectionHeader};
