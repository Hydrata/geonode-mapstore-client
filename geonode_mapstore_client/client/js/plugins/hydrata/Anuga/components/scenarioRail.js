import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {EmptyState} from '../../SimpleView/components/primitives';
import {ScenarioStatusPill} from './scenarioStatusPill';

/**
 * TASK-C-scenarios-miller W1 — presentational rail item for one scenario in
 * the Miller-columns rail. Reuses the SimpleView `.sv-category-rail-item`
 * shell (defined in simpleView.css:840+) so all existing rail hover, focus,
 * and `.is-active` selectors apply unchanged. Adds scenario-specific
 * modifier classes (`.sv-scenario-rail-item.is-archived`, `.is-unsaved`) and
 * a 2-line layout with the compact `ScenarioStatusPill` underneath the id +
 * name row.
 *
 * Compare-mode renders a checkbox on the leading edge. The checkbox is
 * always in the DOM (visibility flipped via `.is-hidden`) to keep Karma
 * deterministic per the React 16.14/dom 16.10 mismatch pin
 * (feedback-mapstore-react-version-mismatch).
 *
 * Ownership badge reuses the `.sv-scenario-ownership-mine|other` rules from
 * anuga.css:850-857. Unsaved drafts render `#*` for the id; archived rows
 * dim opacity via `.is-archived`.
 *
 * Analytics: `anuga-scenario-menu-select-scenario-<id>` fires on row
 * click. Interpolating scenario.id (integer) keeps the event key
 * low-cardinality so Umami doesn't accrete unbounded event types from
 * freetext scenario names.
 */
const ScenarioRailItem = ({
    scenario,
    isActive,
    compareMode,
    currentUserId,
    onSelect,
    onToggleSelected
}, context) => {
    if (!scenario) return null;
    const messages = (context && context.messages) || {};
    const tr = (msgId, fallback) => {
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };
    const unsavedAriaLabel = tr('hydrata.anuga.railUnsavedAriaLabel', 'Unsaved');
    const archivedAriaLabel = tr('hydrata.anuga.railArchivedAriaLabel', 'Archived');
    const isUnsaved = !scenario.id;
    const isArchived = !!scenario.archived_at;
    const isSelected = !!scenario.selected;

    const idLabel = scenario.id ? `#${scenario.id}` : '#*';

    const ownerId = scenario.created_by;
    let ownershipBadge = null;
    if (scenario.id && ownerId != null) { // eslint-disable-line no-eq-null, eqeqeq
        if (currentUserId != null && ownerId === currentUserId) { // eslint-disable-line no-eq-null, eqeqeq
            ownershipBadge = (
                <span className="sv-scenario-ownership-badge sv-scenario-ownership-mine">
                    <Message msgId="hydrata.anuga.yourScenario" />
                </span>
            );
        } else if (scenario.created_by_username) {
            ownershipBadge = (
                <span className="sv-scenario-ownership-badge sv-scenario-ownership-other">
                    <Message msgId="hydrata.anuga.createdByPrefix" /> {scenario.created_by_username}
                </span>
            );
        }
    }

    const className = [
        'sv-category-rail-item',
        'sv-scenario-rail-item',
        isActive ? 'is-active' : '',
        isArchived ? 'is-archived' : '',
        isUnsaved ? 'is-unsaved' : ''
    ].filter(Boolean).join(' ');

    const handleSelect = () => {
        if (onSelect) onSelect(scenario);
        if (scenario?.id) {
            trackEvent('button', 'click', `anuga-scenario-menu-select-scenario-${scenario.id}`);
        }
    };

    const handleCheckboxClick = (e) => {
        e.stopPropagation();
        if (onToggleSelected) onToggleSelected(scenario);
    };

    return (
        <div
            className={className}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={handleSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            }}
        >
            <span
                className={
                    'sv-scenario-rail-item-compare-checkbox'
          + (compareMode ? '' : ' is-hidden')
          + (isSelected ? ' is-checked' : '')
                }
                role="checkbox"
                aria-checked={isSelected}
                aria-hidden={compareMode ? undefined : true}
                tabIndex={compareMode ? 0 : -1}
                onClick={handleCheckboxClick}
                onKeyDown={(e) => {
                    if (compareMode && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onToggleSelected) onToggleSelected(scenario);
                    }
                }}
            >
                <span
                    className={
                        'glyphicon ' + (isSelected ? 'glyphicon-ok' : 'glyphicon-unchecked')
                    }
                    aria-hidden="true"
                />
            </span>
            <div className="sv-scenario-rail-item-body">
                <div className="sv-scenario-rail-item-top">
                    <span className="sv-scenario-rail-item-id">{idLabel}</span>
                    {isUnsaved ?
                        <span className="sv-scenario-rail-item-unsaved" aria-label={unsavedAriaLabel}>*</span> : null
                    }
                    <h5 className="sv-category-rail-item-label sv-scenario-rail-item-name">
                        {scenario.name || ''}
                    </h5>
                    {isArchived ?
                        <span
                            className="sv-scenario-rail-item-archived-dot glyphicon glyphicon-folder-close"
                            aria-label={archivedAriaLabel}
                        /> : null
                    }
                </div>
                <div className="sv-scenario-rail-item-bottom">
                    <ScenarioStatusPill scenario={scenario} compact />
                    {ownershipBadge}
                </div>
            </div>
        </div>
    );
};

ScenarioRailItem.propTypes = {
    scenario: PropTypes.object.isRequired,
    isActive: PropTypes.bool,
    compareMode: PropTypes.bool,
    currentUserId: PropTypes.number,
    onSelect: PropTypes.func,
    onToggleSelected: PropTypes.func
};

ScenarioRailItem.defaultProps = {
    isActive: false,
    compareMode: false
};

// Pull intl messages off React legacy context so unsaved / archived
// aria-labels can be localised at render time.
ScenarioRailItem.contextTypes = {
    messages: PropTypes.object
};

/**
 * Pure-presentational rail wrapper. Maps `scenarios` to <ScenarioRailItem/>.
 * Selection + compare-toggle callbacks bubble up to the container which
 * dispatches the corresponding redux action.
 *
 * Wave 3B (B3) — when the project has zero scenarios, render a centered
 * zero-state with a glyph + heading + sub-copy that points the user at the
 * "+ New scenario" button in the header above the rail. Keep the rail
 * container in the DOM so the surrounding shell layout is undisturbed.
 *
 * TASK-1730 (Phase-C rollout) — PARITY-migrated onto the shared
 * {EmptyState} primitive (harvested FROM this very `.sv-anuga-scenario-rail-empty`
 * glyph + heading + subcopy column). The outer `sv-anuga-scenario-rail-empty`
 * class is preserved (via `extraClassName`) for the legacy CSS + tests,
 * while the inner hooks canonicalise to `sv-empty-state-glyph/-heading/-subcopy`.
 */
const ScenarioRail = ({
    scenarios,
    selectedId,
    compareMode,
    currentUserId,
    onSelect,
    onToggleSelected
}) => {
    const list = scenarios || [];
    if (list.length === 0) {
        return (
            <div className="sv-category-rail sv-anuga-scenario-rail" role="tablist">
                <EmptyState
                    extraClassName="sv-anuga-scenario-rail-empty"
                    glyph="glyphicon-list-alt"
                    heading={<Message msgId="hydrata.anuga.emptyScenariosHeading" />}
                >
                    <Message msgId="hydrata.anuga.emptyScenariosSubcopy" />
                </EmptyState>
            </div>
        );
    }
    return (
        <div className="sv-category-rail sv-anuga-scenario-rail" role="tablist">
            {list.map(scenario => {
                const key = scenario.id || scenario._tempId || `unsaved-${scenario.name || 'new'}`;
                const isActive = !!selectedId && (scenario.id === selectedId || scenario._tempId === selectedId);
                return (
                    <ScenarioRailItem
                        key={key}
                        scenario={scenario}
                        isActive={isActive}
                        compareMode={compareMode}
                        currentUserId={currentUserId}
                        onSelect={onSelect}
                        onToggleSelected={onToggleSelected}
                    />
                );
            })}
        </div>
    );
};

ScenarioRail.propTypes = {
    scenarios: PropTypes.array,
    selectedId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    compareMode: PropTypes.bool,
    currentUserId: PropTypes.number,
    onSelect: PropTypes.func,
    onToggleSelected: PropTypes.func
};

ScenarioRail.defaultProps = {
    scenarios: [],
    compareMode: false
};

export {ScenarioRail, ScenarioRailItem};
