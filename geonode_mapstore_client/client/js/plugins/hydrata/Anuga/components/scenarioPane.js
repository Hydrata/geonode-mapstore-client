import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, toHHMM, getSecondsFromHHMM} from './scenarioHelpers';
import {ScenarioStatusPill} from './scenarioStatusPill';
import {ScenarioActionToolbar} from './scenarioActionToolbar';

/**
 * TASK-C-scenarios-miller W2 — per-category pane renderer for the
 * Miller-columns scenarios panel. Switches on `category` to render
 * Inputs / Advanced / Run / Actions content for the rail-selected
 * scenario.
 *
 * Field-edit callbacks (name, dropdowns, resolution, duration) are
 * delegated to the container's `onUpdateScenario` prop which dispatches
 * `updateAnugaScenario`. The container also owns Build/Run/Log/Duplicate/
 * Archive/Delete dispatches — this pane only passes them down to the
 * ScenarioActionToolbar.
 *
 * Status pill uses `ScenarioStatusPill` (compact=false in the Run subtab).
 * Empty state ("Select a scenario from the list...") renders when
 * `scenario === null`.
 */

const CATEGORIES = [
  {id: 'inputs', msgId: 'hydrata.anuga.inputs'},
  {id: 'advanced', msgId: 'hydrata.anuga.advanced'},
  {id: 'run', msgId: 'hydrata.anuga.run'},
  {id: 'actions', msgId: 'hydrata.anuga.actions'}
];

function renderSubtabs({selectedCategoryId, onSelectCategory}) {
  return (
    <div className="anuga-scenario-pane-subtabs" role="tablist">
      {CATEGORIES.map(cat => {
        const isActive = cat.id === selectedCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            className={"anuga-scenario-pane-subtab" + (isActive ? ' is-active' : '')}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (onSelectCategory) onSelectCategory(cat.id);
              trackEvent('button', 'click', `anuga-scenario-menu-${cat.id}-tab-toggle`);
            }}
          >
            <Message msgId={cat.msgId} />
          </button>
        );
      })}
    </div>
  );
}

function renderSelectField(id, label, value, options, disabled, onChange) {
  return (
    <div className="anuga-scenario-pane-section" key={id}>
      <label className="anuga-scenario-pane-label" htmlFor={id}>
        <Message msgId={label} />
      </label>
      <div className="anuga-scenario-pane-field">
        <select
          id={id}
          className={'scenario-select'}
          value={value || ''}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value === '' ? null : parseInt(e.target.value, 10);
            const kv = {};
            kv[id] = next;
            onChange(kv);
          }}
        >
          <option value={''}>-</option>
          {(options || []).map(item => (
            <option key={item?.id} value={item?.id}>{item?.title}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function renderInputsPane({scenario, canEdit, onUpdateScenario, terrain, boundaries, inflows, rainfalls}) {
  const handleField = (kv) => {
    if (onUpdateScenario) onUpdateScenario(scenario, kv);
  };
  return (
    <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-inputs">
      <div className="anuga-scenario-pane-section">
        <label className="anuga-scenario-pane-label" htmlFor="name">
          <Message msgId="hydrata.anuga.name" />
        </label>
        <div className="anuga-scenario-pane-field">
          <input
            id="name"
            type="text"
            className="scenario-input"
            value={scenario?.name || ''}
            readOnly={!canEdit}
            onChange={(e) => handleField({name: e.target.value})}
          />
        </div>
      </div>
      {renderSelectField('terrain', 'hydrata.anuga.terrain', scenario?.terrain, terrain, !canEdit, handleField)}
      {renderSelectField('boundary', 'hydrata.anuga.boundary', scenario?.boundary, boundaries, !canEdit, handleField)}
      {renderSelectField('inflow', 'hydrata.anuga.inflow', scenario?.inflow, inflows, !canEdit, handleField)}
      {renderSelectField('rainfall', 'hydrata.anuga.rainfall', scenario?.rainfall, rainfalls, !canEdit, handleField)}
    </div>
  );
}

function renderAdvancedPane({scenario, canEdit, onUpdateScenario, frictions, structures, meshRegions, networks}) {
  const handleField = (kv) => {
    if (onUpdateScenario) onUpdateScenario(scenario, kv);
  };
  const handleTimeChange = (e) => {
    handleField({tempTimeString: e.target.value});
  };
  const handleTimeBlur = (e) => {
    const seconds = Math.max(0, getSecondsFromHHMM(e.target.value));
    handleField({duration: seconds, tempTimeString: undefined});
  };
  const handleResolutionChange = (e) => {
    handleField({resolution: parseFloat(e.target.value)});
  };

  return (
    <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-advanced">
      {renderSelectField('friction', 'hydrata.anuga.friction', scenario?.friction, frictions, !canEdit, handleField)}
      {renderSelectField('structure', 'hydrata.anuga.structures', scenario?.structure, structures, !canEdit, handleField)}
      {renderSelectField('mesh_region', 'hydrata.anuga.meshRegions', scenario?.mesh_region, meshRegions, !canEdit, handleField)}
      {renderSelectField('network', 'hydrata.anuga.network', scenario?.network, networks, !canEdit, handleField)}
      <div className="anuga-scenario-pane-section">
        <label className="anuga-scenario-pane-label" htmlFor="resolution">
          <Message msgId="hydrata.anuga.resolutionM2" />
        </label>
        <div className="anuga-scenario-pane-field">
          <input
            id="resolution"
            type="number"
            className="scenario-input scenario-input-narrow"
            value={scenario?.resolution != null ? scenario.resolution : ''} // eslint-disable-line no-eq-null, eqeqeq
            readOnly={!canEdit}
            onChange={handleResolutionChange}
          />
        </div>
      </div>
      <div className="anuga-scenario-pane-section">
        <label className="anuga-scenario-pane-label" htmlFor="duration">
          <Message msgId="hydrata.anuga.duration" />
        </label>
        <div className="anuga-scenario-pane-field">
          <input
            id="duration"
            type="text"
            className="scenario-input scenario-input-narrow"
            value={scenario?.tempTimeString != null ? scenario.tempTimeString : toHHMM(scenario?.duration)} // eslint-disable-line no-eq-null, eqeqeq
            readOnly={!canEdit}
            onChange={handleTimeChange}
            onBlur={handleTimeBlur}
          />
        </div>
      </div>
    </div>
  );
}

function renderRunPane({
  scenario, canEdit, canRunScenario, canDuplicateScenario,
  onBuildClick, onRunClick, onRetryClick, onLogClick,
  onDuplicateClick, onArchiveClick, onUnarchiveClick,
  onConfirmDelete, onConfirmCancelRun
}) {
  return (
    <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-run">
      <div className="anuga-scenario-pane-section">
        <label className="anuga-scenario-pane-label">
          <Message msgId="hydrata.anuga.status" />
        </label>
        <div className="anuga-scenario-pane-field">
          <ScenarioStatusPill scenario={scenario} />
        </div>
      </div>
      <div className="anuga-scenario-pane-actions">
        <ScenarioActionToolbar
          scenario={scenario}
          canEdit={canEdit}
          canRunScenario={canRunScenario}
          canDuplicateScenario={canDuplicateScenario}
          onBuildClick={onBuildClick}
          onRunClick={onRunClick}
          onRetryClick={onRetryClick}
          onLogClick={onLogClick}
          onDuplicateClick={onDuplicateClick}
          onArchiveClick={onArchiveClick}
          onUnarchiveClick={onUnarchiveClick}
          onConfirmDelete={onConfirmDelete}
          onConfirmCancelRun={onConfirmCancelRun}
        />
      </div>
    </div>
  );
}

function renderActionsPane({
  scenario, canEdit, canRunScenario, canDuplicateScenario, currentUserId,
  onBuildClick, onRunClick, onRetryClick, onLogClick,
  onDuplicateClick, onArchiveClick, onUnarchiveClick,
  onConfirmDelete, onConfirmCancelRun
}) {
  const ownerId = scenario?.created_by;
  let ownerLabel = null;
  if (ownerId != null) { // eslint-disable-line no-eq-null, eqeqeq
    if (currentUserId != null && ownerId === currentUserId) { // eslint-disable-line no-eq-null, eqeqeq
      ownerLabel = (
        <span className="scenario-ownership-badge scenario-ownership-mine">
          <Message msgId="hydrata.anuga.yourScenario" />
        </span>
      );
    } else if (scenario?.created_by_username) {
      ownerLabel = (
        <span className="scenario-ownership-badge scenario-ownership-other">
          <Message msgId="hydrata.anuga.createdByPrefix" /> {scenario.created_by_username}
        </span>
      );
    }
  }
  return (
    <div className="anuga-scenario-pane-rows anuga-scenario-pane-rows-actions">
      {ownerLabel ?
        <div className="anuga-scenario-pane-section">
          <div className="anuga-scenario-pane-field">{ownerLabel}</div>
        </div> : null
      }
      <div className="anuga-scenario-pane-actions">
        <ScenarioActionToolbar
          scenario={scenario}
          canEdit={canEdit}
          canRunScenario={canRunScenario}
          canDuplicateScenario={canDuplicateScenario}
          onBuildClick={onBuildClick}
          onRunClick={onRunClick}
          onRetryClick={onRetryClick}
          onLogClick={onLogClick}
          onDuplicateClick={onDuplicateClick}
          onArchiveClick={onArchiveClick}
          onUnarchiveClick={onUnarchiveClick}
          onConfirmDelete={onConfirmDelete}
          onConfirmCancelRun={onConfirmCancelRun}
        />
      </div>
    </div>
  );
}

const ScenarioPane = (props) => {
  const {scenario, selectedCategoryId, onSelectCategory} = props;

  // Status of selected scenario also surfaces in the toolbar via the status pill.
  const status = scenario ? findScenarioStatus(scenario) : null;
  const isCancellable = ['queued', 'computing', 'building'].includes(status);

  return (
    <div className="menu-rows-pane anuga-pane anuga-scenario-pane">
      <div className="anuga-pane-toolbar">
        {renderSubtabs({selectedCategoryId, onSelectCategory})}
        {scenario ?
          <span className="anuga-pane-head-actions">
            <ScenarioStatusPill scenario={scenario} compact />
          </span> : null
        }
      </div>
      <div className="anuga-pane-rows">
        {!scenario ?
          <div className="anuga-scenario-empty-pane">
            <Message msgId="hydrata.anuga.scenarios" />
          </div> :
          <React.Fragment>
            {selectedCategoryId === 'inputs' && renderInputsPane(props)}
            {selectedCategoryId === 'advanced' && renderAdvancedPane(props)}
            {selectedCategoryId === 'run' && renderRunPane({...props, isCancellable})}
            {selectedCategoryId === 'actions' && renderActionsPane({...props, isCancellable})}
          </React.Fragment>
        }
      </div>
    </div>
  );
};

ScenarioPane.propTypes = {
  scenario: PropTypes.object,
  selectedCategoryId: PropTypes.oneOf(['inputs', 'advanced', 'run', 'actions']),
  onSelectCategory: PropTypes.func,
  canEdit: PropTypes.bool,
  canRunScenario: PropTypes.bool,
  canDuplicateScenario: PropTypes.bool,
  currentUserId: PropTypes.number,
  terrain: PropTypes.array,
  boundaries: PropTypes.array,
  inflows: PropTypes.array,
  rainfalls: PropTypes.array,
  frictions: PropTypes.array,
  structures: PropTypes.array,
  meshRegions: PropTypes.array,
  networks: PropTypes.array,
  onUpdateScenario: PropTypes.func,
  onBuildClick: PropTypes.func,
  onRunClick: PropTypes.func,
  onRetryClick: PropTypes.func,
  onLogClick: PropTypes.func,
  onDuplicateClick: PropTypes.func,
  onArchiveClick: PropTypes.func,
  onUnarchiveClick: PropTypes.func,
  onConfirmDelete: PropTypes.func,
  onConfirmCancelRun: PropTypes.func
};

ScenarioPane.defaultProps = {
  selectedCategoryId: 'inputs',
  canEdit: false,
  canRunScenario: false,
  canDuplicateScenario: false
};

export {ScenarioPane, CATEGORIES};
