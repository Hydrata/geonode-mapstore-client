import React from "react";
const PropTypes = require('prop-types');

/**
 * TASK-1007 (W3) — Pure presentational replacement for the 12 inline
 * `<div className="row menu-row menu-row-header ...">` blocks across:
 *  - `anugaInputMenu.js` (5 occurrences — terrain, advanced, fullMesh,
 *    frictionRasters, networks)
 *  - `InputSection.js` (1 occurrence)
 *  - `swammInputMenu.js` (6 occurrences — erosion, swammModels, bmps,
 *    outlets, footprints, watersheds)
 *
 * Per Phase 0.5 red-team spec verification:
 *  - Anuga uses `row menu-row menu-row-header anuga-section-header`
 *    (the `.anuga-section-header` rule lives in `Anuga/anuga.css` lines
 *    272/278/283/291).
 *  - Swamm uses just `row menu-row menu-row-header` PLUS an inline
 *    `style={{width: "510px", textAlign: "left", border: "none"}}`
 *    (swammInputMenu does NOT import anuga.css — the style prop
 *    pass-through is the safest in-PR move; Option A from the spec).
 *
 * Design decision (Phase 0.5 — recorded in EPIC.md):
 *   We pick STYLE PROP PASS-THROUGH over creating a new shared
 *   `.simpleview-section-header` rule, because the alternative would
 *   require either (a) duplicating the inline 540px Anuga width onto a
 *   new shared rule (risking visual drift if Anuga ever changes its
 *   width) or (b) injecting a swamm-specific class import into
 *   swammInputMenu (couples a SimpleView primitive to Swamm CSS). The
 *   inline-style pass-through preserves the per-site contract exactly
 *   while keeping the primitive presentation-only.
 *
 * After this refactor, AC #4 demands:
 *   grep -c "row menu-row menu-row-header" {anugaInputMenu, InputSection,
 *     swammInputMenu} = 0 in all three files (the literal string moves
 *   into THIS file's `className=` only).
 *
 * Optional pass-through props (`role`, `tabIndex`, `onClick`,
 * `onKeyDown`) are forwarded as-is so consumers can keep header-level
 * keyboard interaction in their parent components (e.g. swammInputMenu
 * currently has no header interactivity; anugaInputMenu has clickable
 * text spans inside the header but the wrapper itself is non-
 * interactive — this prop set is the union of possible needs).
 */
const SectionHeader = ({
    children,
    extraClassName,
    style,
    role,
    tabIndex,
    onClick,
    onKeyDown
}) => {
    const className = "row menu-row menu-row-header"
        + (extraClassName ? " " + extraClassName : "");
    return (
        <div
            className={className}
            style={style}
            role={role}
            tabIndex={tabIndex}
            onClick={onClick}
            onKeyDown={onKeyDown}
        >
            {children}
        </div>
    );
};

SectionHeader.propTypes = {
    children: PropTypes.node,
    extraClassName: PropTypes.string,
    style: PropTypes.object,
    role: PropTypes.string,
    tabIndex: PropTypes.number,
    onClick: PropTypes.func,
    onKeyDown: PropTypes.func
};

export {SectionHeader};
