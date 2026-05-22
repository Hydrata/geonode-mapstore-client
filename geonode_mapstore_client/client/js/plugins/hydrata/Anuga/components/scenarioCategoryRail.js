import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {validateCategoryProgress} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller Wave 3A — vertical category rail (Pane 2) for the
 * Miller-columns scenarios panel. Replaces the 4 horizontal subtabs at the
 * top of the legacy ScenarioPane with 5 items grouped under 3 section
 * headers:
 *
 *   INPUTS         → Inputs, Advanced
 *   CONFIGURATION  → Run config
 *   EXECUTION      → Status and actions, Run log
 *
 * Per-category progress tags (e.g. "4/4", "OK", "47%", "err") come from
 * `validateCategoryProgress(category, scenario)` in scenarioHelpers.js.
 * The shipped Inputs CategoryRail primitive bakes in tristate visibility
 * + zoom glyphs that scenarios don't need, so a dedicated component is
 * the cleaner path (architectural-choice note in the Wave 3A closeout).
 *
 * Visual contract follows the operator-approved Option A mockup
 * (docs/reports/2026-05-18-scenarios-redesign-option-A.html):
 *   - section label uppercase 9.5px letter-spaced
 *   - cat-item: 6px gap, 6/10px padding, transparent 3px left-border
 *   - is-active: panel-blue fill + lime (#cae33b) left-border
 *   - is-alert: red tag tint (used by Advanced when not all assigned,
 *     and by Status and actions when status==='error')
 *
 * Analytics: clicking a rail item fires
 * `anuga-scenario-menu-category-${categoryId}` so Umami can track which
 * category the user lands on. Label uses the stable categoryId, not
 * the locale-dependent label, keeping the event keyspace bounded.
 */

const CATEGORIES = [
    {
        id: 'inputs',
        section: 'inputs',
        msgId: 'hydrata.anuga.requiredInputs'
    },
    {
        id: 'advanced',
        section: 'inputs',
        msgId: 'hydrata.anuga.optionalInputs'
    },
    {
        id: 'runConfig',
        section: 'configuration',
        msgId: 'hydrata.anuga.runConfig'
    },
    {
        id: 'statusActions',
        section: 'execution',
        msgId: 'hydrata.anuga.statusActions'
    }
];

const SECTIONS = [
    {id: 'inputs', msgId: 'hydrata.anuga.sectionInputs'},
    {id: 'configuration', msgId: 'hydrata.anuga.sectionConfiguration'},
    {id: 'execution', msgId: 'hydrata.anuga.sectionExecution'}
];

// Per-category glyph icons. Plain glyphicon classes from Bootstrap 3 (the
// MapStore2 bundle) keep the SVG footprint zero, matching the rest of the
// ANUGA surface. The decorative glyph carries no information beyond "this
// row maps to this category", so a glyphicon is sufficient.
const CATEGORY_GLYPHS = {
    inputs: 'glyphicon-th-large',
    advanced: 'glyphicon-cog',
    runConfig: 'glyphicon-wrench',
    statusActions: 'glyphicon-play-circle'
};

// SECTIONS + CATEGORIES are module-level constants, so the per-section
// grouping is too — hoisting out of render avoids rebuilding the lookup
// on every keystroke in the name input.
const ITEMS_BY_SECTION = SECTIONS.reduce((acc, s) => {
    acc[s.id] = CATEGORIES.filter(cat => cat.section === s.id);
    return acc;
}, {});

const ScenarioCategoryRail = ({scenario, selectedCategoryId, onSelectCategory}, context) => {
    const handleSelect = (categoryId) => {
        if (onSelectCategory) onSelectCategory(categoryId);
        trackEvent('button', 'click', `anuga-scenario-menu-category-${categoryId}`);
    };
    const messages = (context && context.messages) || {};
    const resolvedRailLabel = getMessageById(messages, 'hydrata.anuga.categoryRailAriaLabel');
    const railAriaLabel = resolvedRailLabel === 'hydrata.anuga.categoryRailAriaLabel'
        ? 'Scenario categories'
        : resolvedRailLabel;

    return (
        <div
            className="anuga-scenario-category-rail"
            role="tablist"
            aria-label={railAriaLabel}
        >
            {SECTIONS.map(section => (
                <div
                    key={section.id}
                    className={`anuga-scenario-category-section anuga-scenario-category-section-${section.id}`}
                >
                    {ITEMS_BY_SECTION[section.id].map(cat => {
                        const isActive = cat.id === selectedCategoryId;
                        const progress = validateCategoryProgress(cat.id, scenario);
                        const className = [
                            'anuga-scenario-category-item',
                            isActive ? 'is-active' : '',
                            progress.severity === 'err' ? 'is-alert' : '',
                            progress.severity === 'warn' ? 'is-warn' : ''
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
                                        'anuga-scenario-category-item-glyph glyphicon '
                                        + (CATEGORY_GLYPHS[cat.id] || 'glyphicon-record')
                                    }
                                    aria-hidden="true"
                                />
                                <span className="anuga-scenario-category-item-label">
                                    <Message msgId={cat.msgId} />
                                </span>
                                <span
                                    className={
                                        'anuga-scenario-category-item-tag'
                                        + (progress.severity === 'ok' ? ' is-ok' : '')
                                        + (progress.severity === 'warn' ? ' is-warn' : '')
                                        + (progress.severity === 'err' ? ' is-err' : '')
                                        + (progress.unsaved ? ' is-unsaved' : '')
                                    }
                                >
                                    {/* Wave 3C C4 — unsaved-diffs prefix.
                                        Scenario-level coarse signal (no
                                        per-category diff available without
                                        a backend snapshot cache). */}
                                    {progress.unsaved ? (
                                        <span
                                            className="anuga-scenario-category-item-unsaved-dot"
                                            aria-label="unsaved changes"
                                        >
                                            *
                                        </span>
                                    ) : null}
                                    {progress.tag}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

ScenarioCategoryRail.propTypes = {
    scenario: PropTypes.object,
    selectedCategoryId: PropTypes.string,
    onSelectCategory: PropTypes.func
};

ScenarioCategoryRail.defaultProps = {
    selectedCategoryId: 'inputs'
};

// Pull intl messages off React legacy context so the tablist aria-label can
// be localised at render time.
ScenarioCategoryRail.contextTypes = {
    messages: PropTypes.object
};

// Wave 3D Tier B7 — category rail is pure on its props. Default shallow
// comparator is sufficient: scenario object reference change drives
// per-category progress recomputation; selectedCategoryId is a string;
// onSelectCategory identity is stable from the parent's bound method.
const MemoScenarioCategoryRail = React.memo(ScenarioCategoryRail);

export {MemoScenarioCategoryRail as ScenarioCategoryRail, CATEGORIES, SECTIONS};
