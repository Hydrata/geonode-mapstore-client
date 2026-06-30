import React from "react";
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";

/**
 * TASK-1448 (W1) — vertical category rail for the Hydrology panel.
 * Modeled on Anuga's scenarioCategoryRail.js (4-item, no section headers,
 * no progress tags). Drives activeHydrologyPage (Redux) as selected-id.
 *
 * Rail items:
 *   IDF             → 'idf'         (consolidates sv-idf-table + idf-derive)
 *   Temporal Patterns → 'temporal-pattern'
 *   Design Storms   → 'time-series'
 *   Hydrographs     → 'hydrographs' (TASK-1985, epic-1970)
 *   Networks        → 'networks'
 *
 * Active state: lime (#cae33b) 3px left-border, panel-blue fill.
 * Bootstrap 3 glyphicons keep SVG footprint zero.
 */

const CATEGORIES = [
    {
        id: 'idf',
        msgId: 'hydrata.hydrology.idfTables'
    },
    {
        id: 'temporal-pattern',
        msgId: 'hydrata.hydrology.temporalPatterns'
    },
    {
        id: 'time-series',
        msgId: 'hydrata.hydrology.timeseries'
    },
    {
        // TASK-1985 (epic-1970): hydrograph series split from hyetograph/design-storm.
        id: 'hydrographs',
        msgId: 'hydrata.hydrology.hydrographs'
    },
    {
        id: 'networks',
        msgId: 'hydrata.anuga.networks'
    }
];

const CATEGORY_GLYPHS = {
    'idf': 'glyphicon-list-alt',
    'temporal-pattern': 'glyphicon-align-left',
    'time-series': 'glyphicon-stats'
    // 'hydrographs' renders HydrographIcon inline SVG (TASK-2023, W5.1) — an
    // X-Y axis + rise/fall curve distinguishes flow from the rainfall bar-stats
    // glyph used by Design Storms. 'networks' renders NetworksIcon.
};

// HydrographIcon — X-Y axis pair + a rise/fall curve representing a flow
// hydrograph. Inline SVG because no Bootstrap-3 glyphicon matches this mark.
// Sized 16×16 to match .sv-hydrology-category-item-glyph; uses currentColor so
// active/inactive theming stays consistent with the sibling glyphicons.
// TASK-2023 (W5.1): replaces the misleading water-drop (glyphicon-tint).
const HydrographIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{display: 'block'}}
    >
        {/* Y-axis */}
        <line x1="4" y1="2" x2="4" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        {/* X-axis */}
        <line x1="4" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        {/* Rise/fall hydrograph curve: flat base, steep rise, smooth peak, gradual recession */}
        <path
            d="M4 19 L7 19 Q9 19 11 12 Q13 5 14 8 Q15 11 17 16 Q19 20 22 19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);

// NetworksIcon — node-and-link network (one big hub + two smaller spur nodes)
// under four uniform rainfall streaks. Inline SVG because no glyphicon webfont
// glyph fits this mark. Uses currentColor so it inherits the rail glyph colour
// and active/inactive theming stays consistent with the sibling glyphicons.
// Sized 16×16 to match the .sv-hydrology-category-item-glyph box.
const NetworksIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{display: 'block'}}
    >
        {/* rainfall: 4 uniform streaks */}
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6.5 4 L5.7 6.2"/>
            <path d="M10.5 4 L9.7 6.2"/>
            <path d="M14.5 4 L13.7 6.2"/>
            <path d="M18.5 4 L17.7 6.2"/>
        </g>
        {/* links */}
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8.5 16 L17.5 12.5 M8.5 16 L16 21"/>
        </g>
        {/* nodes: big hub + 2 spurs */}
        <g fill="currentColor">
            <circle cx="8.5" cy="16" r="2.6"/>
            <circle cx="17.5" cy="12.5" r="1.5"/>
            <circle cx="16" cy="21" r="1.4"/>
        </g>
    </svg>
);

// Map rail category ids → activeHydrologyPage values.
// TASK-1452 (W5) entered IDF on idf-derive; UAT 2026-06-23 reverted to
// sv-idf-table (Input/Manual) per operator. Users switch to Derive via the
// sub-toggle.
// TASK-1985 (epic-1970): hydrographs added at index 3.
const CATEGORY_TO_PAGE = {
    'idf': 'sv-idf-table',
    'temporal-pattern': 'temporal-pattern',
    'time-series': 'time-series',
    'hydrographs': 'hydrographs',
    'networks': 'networks'
};

// Map activeHydrologyPage → rail category id (reverse lookup).
export const pageToCategory = (page) => {
    if (page === 'sv-idf-table' || page === 'idf-derive') return 'idf';
    return page || 'idf';
};

const HydrologyCategoryRail = ({activeHydrologyPage, onSelectCategory}) => {
    const selectedCategoryId = pageToCategory(activeHydrologyPage);

    const handleSelect = (categoryId) => {
        if (onSelectCategory) {
            onSelectCategory(CATEGORY_TO_PAGE[categoryId] || categoryId);
        }
        trackEvent('button', 'click', `hydrology-category-rail-${categoryId}`);
    };

    return (
        <div
            className="sv-hydrology-category-rail"
            role="tablist"
            aria-label="Hydrology categories"
        >
            {CATEGORIES.map(cat => {
                const isActive = cat.id === selectedCategoryId;
                const className = [
                    'sv-hydrology-category-item',
                    isActive ? 'is-active' : ''
                ].filter(Boolean).join(' ');
                return (
                    <div
                        key={cat.id}
                        className={className}
                        role="tab"
                        aria-selected={isActive}
                        tabIndex={0}
                        onClick={() => handleSelect(cat.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelect(cat.id);
                            }
                        }}
                    >
                        {cat.id === 'networks'
                            ? (
                                <span
                                    className="sv-hydrology-category-item-glyph"
                                    aria-hidden="true"
                                >
                                    <NetworksIcon />
                                </span>
                            )
                            : cat.id === 'hydrographs'
                                ? (
                                    <span
                                        className="sv-hydrology-category-item-glyph"
                                        aria-hidden="true"
                                    >
                                        <HydrographIcon />
                                    </span>
                                )
                                : (
                                    <span
                                        className={
                                            'sv-hydrology-category-item-glyph glyphicon '
                                            + (CATEGORY_GLYPHS[cat.id] || 'glyphicon-record')
                                        }
                                        aria-hidden="true"
                                    />
                                )}
                        <span className="sv-hydrology-category-item-label">
                            <Message msgId={cat.msgId} />
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

HydrologyCategoryRail.propTypes = {
    activeHydrologyPage: PropTypes.string,
    onSelectCategory: PropTypes.func
};

HydrologyCategoryRail.defaultProps = {
    // Default matches reducer initialState (sv-idf-table = Input-first; UAT 2026-06-23).
    activeHydrologyPage: 'sv-idf-table'
};

export {HydrologyCategoryRail, CATEGORIES, CATEGORY_TO_PAGE};
