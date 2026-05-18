import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {ScenarioStatusPill} from './scenarioStatusPill';

/**
 * TASK-C-scenarios-miller W1 — presentational rail item for one scenario in
 * the Miller-columns rail. Reuses the SimpleView `.sv-category-rail-item`
 * shell (defined in simpleView.css:840+) so all existing rail hover, focus,
 * and `.is-active` selectors apply unchanged. Adds scenario-specific
 * modifier classes (`.scenario-rail-item.is-archived`, `.is-unsaved`) and
 * a 2-line layout with the compact `ScenarioStatusPill` underneath the id +
 * name row.
 *
 * Compare-mode renders a checkbox on the leading edge. The checkbox is
 * always in the DOM (visibility flipped via `.is-hidden`) to keep Karma
 * deterministic per the React 16.14/dom 16.10 mismatch pin
 * (feedback-mapstore-react-version-mismatch).
 *
 * Ownership badge reuses the `.scenario-ownership-mine|other` rules from
 * anuga.css:850-857. Unsaved drafts render `#*` for the id; archived rows
 * dim opacity via `.is-archived`.
 *
 * Analytics: `anuga-scenario-menu-select-scenario-<name>` fires on row
 * click (matches today's `anuga-scenario-menu-select-scenario-${name}`
 * event from ScenarioTableRow line 690 — the compare-glyph click site).
 */
const ScenarioRailItem = ({
  scenario,
  isActive,
  compareMode,
  currentUserId,
  onSelect,
  onToggleSelected
}) => {
  if (!scenario) return null;
  const isUnsaved = !scenario.id;
  const isArchived = !!scenario.archived_at;
  const isSelected = !!scenario.selected;

  const idLabel = scenario.id ? `#${scenario.id}` : '#*';

  const ownerId = scenario.created_by;
  let ownershipBadge = null;
  if (scenario.id && ownerId != null) { // eslint-disable-line no-eq-null, eqeqeq
    if (currentUserId != null && ownerId === currentUserId) { // eslint-disable-line no-eq-null, eqeqeq
      ownershipBadge = (
        <span className="scenario-ownership-badge scenario-ownership-mine">
          <Message msgId="hydrata.anuga.yourScenario" />
        </span>
      );
    } else if (scenario.created_by_username) {
      ownershipBadge = (
        <span className="scenario-ownership-badge scenario-ownership-other">
          <Message msgId="hydrata.anuga.createdByPrefix" /> {scenario.created_by_username}
        </span>
      );
    }
  }

  const className = [
    'sv-category-rail-item',
    'scenario-rail-item',
    isActive ? 'is-active' : '',
    isArchived ? 'is-archived' : '',
    isUnsaved ? 'is-unsaved' : ''
  ].filter(Boolean).join(' ');

  const handleSelect = () => {
    if (onSelect) onSelect(scenario);
    if (scenario?.name) {
      trackEvent('button', 'click', `anuga-scenario-menu-select-scenario-${scenario.name}`);
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
          'scenario-rail-item-compare-checkbox'
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
      <div className="scenario-rail-item-body">
        <div className="scenario-rail-item-top">
          <span className="scenario-rail-item-id">{idLabel}</span>
          {isUnsaved ?
            <span className="scenario-rail-item-unsaved" aria-label="Unsaved">*</span> : null
          }
          <h5 className="sv-category-rail-item-label scenario-rail-item-name">
            {scenario.name || ''}
          </h5>
          {isArchived ?
            <span
              className="scenario-rail-item-archived-dot glyphicon glyphicon-folder-close"
              aria-label="Archived"
            /> : null
          }
        </div>
        <div className="scenario-rail-item-bottom">
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

/**
 * Pure-presentational rail wrapper. Maps `scenarios` to <ScenarioRailItem/>.
 * Selection + compare-toggle callbacks bubble up to the container which
 * dispatches the corresponding redux action.
 */
const ScenarioRail = ({
  scenarios,
  selectedId,
  compareMode,
  currentUserId,
  onSelect,
  onToggleSelected
}) => {
  return (
    <div className="sv-category-rail anuga-scenario-rail" role="tablist">
      {(scenarios || []).map(scenario => {
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
