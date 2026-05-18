import React from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus} from './scenarioHelpers';
import {TERMINAL_RUN_STATES} from '../anugaConstants';

/**
 * TASK-C-scenarios-miller W2 — presentational button strip for a scenario.
 *
 * Used by the ScenarioPane Run + Actions subtabs. All buttons render in
 * locked source order (Build | Run | Log | Duplicate | Archive | Delete);
 * visibility is CSS-toggled via `.is-hidden` so Karma tests can locate
 * buttons deterministically regardless of role / status (memory pin
 * feedback-mapstore-react-version-mismatch).
 *
 * Analytics event names match the legacy ScenarioTableRow.js exactly so
 * Umami dashboards keep functioning post-cutover:
 *   - anuga-scenario-menu-build
 *   - anuga-scenario-menu-run
 *   - anuga-scenario-menu-rerun       (cancelled state)
 *   - anuga-scenario-menu-retry       (error state)
 *   - anuga-scenario-menu-download    (complete state)
 *   - anuga-scenario-menu-view-log
 *   - anuga-scenario-menu-duplicate-scenario
 *   - anuga-scenario-menu-archive-scenario
 *   - anuga-scenario-menu-unarchive-scenario
 *   - anuga-scenario-menu-delete-scenario
 *   - anuga-scenario-menu-cancel-run
 *
 * `onConfirmDelete` and `onConfirmCancelRun` are the new inline-dialog
 * triggers — the container owns the confirm dialog state (memory pin
 * feedback-window-confirm-blocks-automation, replacing the two legacy
 * window.confirm sites in ScenarioTableRow.js lines 657-674).
 */

// Run / Build / Retry / Download / Re-run renderer. Returns null when the
// caller cannot run (read-only role).
function renderRunControl({scenario, canRunScenario, onBuildClick, onRunClick, onRetryClick}) {
  const status = findScenarioStatus(scenario);
  const isUnsaved = !!scenario?.unsaved;
  switch (status) {
  case 'built':
    if (!canRunScenario) return null;
    return (
      <Button
        bsStyle={'success'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-run"
        onClick={() => {
          if (onRunClick) onRunClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-run');
        }}
      >
        <Message msgId="hydrata.anuga.run" />
      </Button>
    );
  case 'complete':
    return (
      <Button
        download
        href={scenario?.latest_run?.s3_package_url}
        bsStyle={'success'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-download"
        onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-download')}
      >
        <span className="glyphicon glyphicon-download" aria-hidden="true" />
      </Button>
    );
  case 'error':
    if (!canRunScenario) return null;
    return (
      <Button
        bsStyle={'warning'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-retry"
        onClick={() => {
          if (onRetryClick) onRetryClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-retry');
        }}
      >
        <Message msgId="hydrata.anuga.retry" />
      </Button>
    );
  case 'cancelled':
    if (!canRunScenario) return null;
    return (
      <Button
        bsStyle={'success'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-rerun"
        onClick={() => {
          if (onRunClick) onRunClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-rerun');
        }}
      >
        <Message msgId="hydrata.anuga.run" />
      </Button>
    );
  case 'queued':
  case 'computing':
  case 'processing':
  case 'building':
    return (
      <Button
        bsStyle={'success'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-run disabled"
      >
        <span className="glyphicon glyphicon-refresh glyphicon-spin" aria-hidden="true" />
      </Button>
    );
  case 'created':
    if (!canRunScenario) return null;
    return (
      <Button
        bsStyle={'success'}
        bsSize={'xsmall'}
        className={"anuga-btn scenario-action-toolbar-btn scenario-action-build"
          + (isUnsaved ? '' : ' disabled')}
        onClick={() => {
          if (onBuildClick) onBuildClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-build');
        }}
      >
        <Message msgId="hydrata.anuga.build" />
      </Button>
    );
  default:
    return null;
  }
}

const ScenarioActionToolbar = ({
  scenario,
  canEdit,
  canRunScenario,
  canDuplicateScenario,
  onBuildClick,
  onRunClick,
  onRetryClick,
  onLogClick,
  onDuplicateClick,
  onArchiveClick,
  onUnarchiveClick,
  onConfirmDelete,
  onConfirmCancelRun
}) => {
  if (!scenario) return null;
  const status = findScenarioStatus(scenario);
  const isCancellable = ['queued', 'computing', 'building'].includes(status);
  // Wave 3C C2 — defence-in-depth gate. isCancellable + TERMINAL_RUN_STATES
  // are mutually exclusive sets today, but reading the run status directly
  // means future status-set drift can't accidentally enable the Cancel
  // button on a finished run.
  const runStatus = scenario?.latest_run?.status;
  const isTerminalRun = TERMINAL_RUN_STATES.includes(runStatus);

  const canCancelRun = isCancellable && canRunScenario && !isTerminalRun;
  const canDeleteScenario = !isCancellable && canEdit;
  const showDeleteOrCancel = canCancelRun || canDeleteScenario;

  const showDuplicate = canDuplicateScenario && !!scenario.id && !isCancellable;
  // Wave 3C C1 — Archive button now renders disabled (instead of hidden)
  // while a run is in progress, with a hover tooltip explaining why. Better
  // discovery than the prior toast-after-roundtrip 412 path. The button is
  // still entirely hidden when the user lacks edit rights or the scenario
  // is unsaved.
  const showArchive = canEdit && !!scenario.id;
  const isArchiveDisabled = isCancellable;
  const isArchived = !!scenario.archived_at;

  const runControl = renderRunControl({
    scenario, canRunScenario, onBuildClick, onRunClick, onRetryClick
  });

  // Build button is separate from runControl when scenario is in non-'created'
  // states and is editable. This mirrors ScenarioTableRow renderBuildCell.
  const showBuildBtn = canEdit && status !== 'created';
  const isBuildEnabled = !!scenario?.unsaved && !isCancellable;

  return (
    <div className="scenario-action-toolbar">
      {showBuildBtn ?
        <Button
          bsStyle={'success'}
          bsSize={'xsmall'}
          className={"anuga-btn scenario-action-toolbar-btn scenario-action-build"
            + (isBuildEnabled ? '' : ' disabled')}
          onClick={() => {
            if (onBuildClick) onBuildClick(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-build');
          }}
        >
          <Message msgId="hydrata.anuga.build" />
        </Button> : null
      }
      {runControl}
      <Button
        bsStyle={'info'}
        bsSize={'xsmall'}
        className="anuga-btn scenario-action-toolbar-btn scenario-action-log"
        onClick={() => {
          if (onLogClick) onLogClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-view-log');
        }}
      >
        <Message msgId="hydrata.anuga.log" />
      </Button>
      <Button
        bsStyle={'info'}
        bsSize={'xsmall'}
        className={"anuga-btn anuga-btn-duplicate scenario-action-toolbar-btn scenario-action-duplicate"
          + (showDuplicate ? '' : ' is-hidden')}
        onClick={() => {
          if (onDuplicateClick) onDuplicateClick(scenario);
          trackEvent('button', 'click', 'anuga-scenario-menu-duplicate-scenario');
        }}
      >
        <span className="glyphicon glyphicon-duplicate" aria-hidden="true" />
      </Button>
      <Button
        bsStyle={isArchived ? 'success' : 'warning'}
        bsSize={'xsmall'}
        className={"anuga-btn scenario-action-toolbar-btn "
          + (isArchived ? 'anuga-btn-unarchive scenario-action-unarchive' : 'anuga-btn-archive scenario-action-archive')
          + (showArchive ? '' : ' is-hidden')
          + (isArchiveDisabled ? ' disabled' : '')}
        disabled={isArchiveDisabled}
        // Wave 3C C1: title is plain English here (matches the pattern used
        // by anuga-scenario-confirm-dialog's aria-label). TODO i18n: wire
        // to getMessageById once contextTypes.messages plumbing lands.
        // Locale key reserved: hydrata.anuga.archiveDisabledWhileRunning.
        title={isArchiveDisabled
          ? 'Cannot archive while a run is in progress. Cancel the run first.'
          : undefined}
        onClick={() => {
          if (isArchiveDisabled) return;
          if (isArchived) {
            if (onUnarchiveClick) onUnarchiveClick(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-unarchive-scenario');
          } else {
            if (onArchiveClick) onArchiveClick(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-archive-scenario');
          }
        }}
      >
        <span
          className={isArchived ? "glyphicon glyphicon-open" : "glyphicon glyphicon-folder-close"}
          aria-hidden="true"
        />
      </Button>
      <Button
        bsStyle={'danger'}
        bsSize={'xsmall'}
        className={"anuga-btn-delete scenario-action-toolbar-btn "
          + (isCancellable ? 'scenario-action-cancel-run' : 'scenario-action-delete')
          + (showDeleteOrCancel ? '' : ' is-hidden')}
        onClick={() => {
          if (isCancellable) {
            if (onConfirmCancelRun) onConfirmCancelRun(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run');
          } else {
            if (onConfirmDelete) onConfirmDelete(scenario);
            trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario');
          }
        }}
      >
        <span
          className={isCancellable ? "glyphicon glyphicon-ban-circle" : "glyphicon glyphicon-trash"}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
};

ScenarioActionToolbar.propTypes = {
  scenario: PropTypes.object,
  canEdit: PropTypes.bool,
  canRunScenario: PropTypes.bool,
  canDuplicateScenario: PropTypes.bool,
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

ScenarioActionToolbar.defaultProps = {
  canEdit: false,
  canRunScenario: false,
  canDuplicateScenario: false
};

export {ScenarioActionToolbar};
