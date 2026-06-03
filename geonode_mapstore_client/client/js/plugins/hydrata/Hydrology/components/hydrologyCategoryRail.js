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
 *   IDF             → 'idf'         (consolidates idf-table + idf-derive)
 *   Temporal Patterns → 'temporal-pattern'
 *   Timeseries      → 'time-series'
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
        id: 'networks',
        msgId: 'hydrata.anuga.networks'
    }
];

const CATEGORY_GLYPHS = {
    'idf': 'glyphicon-list-alt',
    'temporal-pattern': 'glyphicon-align-left',
    'time-series': 'glyphicon-stats',
    'networks': 'glyphicon-road'
};

// Map rail category ids → activeHydrologyPage values.
// TASK-1452 (W5): idf-derive is the default (common path) when entering the
// IDF category. Users can switch to idf-table (Manual) via the sub-toggle.
const CATEGORY_TO_PAGE = {
    'idf': 'idf-derive',
    'temporal-pattern': 'temporal-pattern',
    'time-series': 'time-series',
    'networks': 'networks'
};

// Map activeHydrologyPage → rail category id (reverse lookup).
export const pageToCategory = (page) => {
    if (page === 'idf-table' || page === 'idf-derive') return 'idf';
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
            className="hydrology-category-rail"
            role="tablist"
            aria-label="Hydrology categories"
        >
            {CATEGORIES.map(cat => {
                const isActive = cat.id === selectedCategoryId;
                const className = [
                    'hydrology-category-item',
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
                        <span
                            className={
                                'hydrology-category-item-glyph glyphicon '
                                + (CATEGORY_GLYPHS[cat.id] || 'glyphicon-record')
                            }
                            aria-hidden="true"
                        />
                        <span className="hydrology-category-item-label">
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
    // TASK-1452 (W5): default matches reducer initialState (idf-derive = Derive-first).
    activeHydrologyPage: 'idf-derive'
};

export {HydrologyCategoryRail, CATEGORIES};
