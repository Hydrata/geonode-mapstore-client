import React from "react";
import PropTypes from 'prop-types';

/**
 * Presentational Miller-columns rail: tri-state visibility glyph +
 * label, one entry per subheading.
 *
 * Presentation-only; no redux. The parent owns `getGroupLayers`,
 * `selectedSubHeading` local state, localStorage collapse helpers,
 * and the dispatchers. `items` is a pre-computed array (see propTypes).
 */
const MENU_ROW_GLYPH = "btn glyphicon menu-row-glyph";

/**
 * Tri-state visibility glyph class string. Exported so the legacy
 * single-subheading fallback (simpleViewMenuRows.js) can use the same
 * formula as the rail.
 */
export function tristateGlyph(allVisible, noneVisible) {
    if (allVisible) return "glyphicon-ok glyph-active";
    if (noneVisible) return "glyphicon-remove glyph-inactive";
    return "glyphicon-minus glyph-partial";
}

const CategoryRail = ({
    items,
    selectedSubHeading,
    onSelect,
    onToggleGroupVisibility
}) => {
    return (
        <div className="sv-category-rail" role="tablist">
            {items.map(({subHeading, groupLayers, allVisible, noneVisible}) => {
                const isActive = selectedSubHeading === subHeading;
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
                            className={`${MENU_ROW_GLYPH} sv-category-rail-item-tristate ${tristateGlyph(allVisible, noneVisible)}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleGroupVisibility(groupLayers, !allVisible, subHeading);
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
    items: PropTypes.array.isRequired,
    selectedSubHeading: PropTypes.string,
    onSelect: PropTypes.func,
    onToggleGroupVisibility: PropTypes.func
};

export {CategoryRail};
