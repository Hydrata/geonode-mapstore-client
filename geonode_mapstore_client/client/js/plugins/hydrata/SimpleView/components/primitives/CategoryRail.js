import React from "react";
const PropTypes = require('prop-types');

/**
 * TASK-1007 (W3) — Pure presentational replacement for the inline
 * Miller-columns rail JSX from W1 (TASK-1005) in
 * `simpleViewMenuRows.js` — `.sv-category-rail` + per-item
 * `.sv-category-rail-item` with tri-state visibility glyph + zoom
 * glyph + label.
 *
 * DOM is byte-identical to the W1 inline version (R03 class-name
 * contract). Selectors used by `simpleViewMillerLayout-test.js`
 * (`.sv-category-rail-item`, `.sv-category-rail-item .sv-category-rail-item-zoom`)
 * continue to resolve. The `is-active` class on the selected item
 * mirrors W1 exactly.
 *
 * No redux: this primitive has no store binding (verified by the
 * AC #6 grep). The parent `MenuRowsClass` keeps:
 *  - the `getGroupLayers(subHeading)` lookup
 *  - the `selectedSubHeading` local state
 *  - the localStorage collapse helpers
 *  - the `toggleGroupVisibility` and `zoomToGroup` dispatchers (via
 *    its own `mapDispatchToProps`)
 *
 * The rail simply receives a pre-computed `items` array and lets the
 * parent own all derivation logic. The `trackEvent` calls stay in the
 * parent's callback bodies — the rail itself emits no analytics.
 *
 * `items` shape:
 *   Array<{
 *     subHeading: string,         // display label AND key
 *     groupLayers: Array<layer>,  // passed back to onToggleGroupVisibility/onZoomToGroup
 *     allVisible: boolean,        // tri-state: true → ok glyph
 *     noneVisible: boolean        // tri-state: true → remove glyph; else partial glyph
 *   }>
 */
const CategoryRail = ({
    items,
    selectedSubHeading,
    onSelect,
    onToggleGroupVisibility,
    onZoomToGroup
}) => {
    return (
        <div className="sv-category-rail" role="tablist">
            {(items || []).map(({subHeading, groupLayers, allVisible, noneVisible}) => {
                const isActive = selectedSubHeading === subHeading;
                const tristateGlyph = allVisible
                    ? "glyphicon-ok glyph-active"
                    : noneVisible
                        ? "glyphicon-remove glyph-inactive"
                        : "glyphicon-minus glyph-partial";
                return (
                    <div
                        key={subHeading}
                        className={"sv-category-rail-item" + (isActive ? " is-active" : "")}
                        role="tab"
                        aria-selected={isActive}
                        tabIndex={0}
                        onClick={() => onSelect(subHeading)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(subHeading);
                            }
                        }}
                    >
                        <span
                            className={"btn glyphicon menu-row-glyph sv-category-rail-item-tristate " + tristateGlyph}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleGroupVisibility(groupLayers, !allVisible, subHeading);
                            }}
                        />
                        <span
                            className={"btn glyphicon menu-row-glyph glyph-zoom glyphicon-zoom-to sv-category-rail-item-zoom"}
                            onClick={(e) => {
                                e.stopPropagation();
                                onZoomToGroup(groupLayers, subHeading);
                            }}
                        />
                        <h5 className="sv-category-rail-item-label">{subHeading}</h5>
                    </div>
                );
            })}
        </div>
    );
};

CategoryRail.propTypes = {
    items: PropTypes.array,
    selectedSubHeading: PropTypes.string,
    onSelect: PropTypes.func,
    onToggleGroupVisibility: PropTypes.func,
    onZoomToGroup: PropTypes.func
};

export {CategoryRail};
