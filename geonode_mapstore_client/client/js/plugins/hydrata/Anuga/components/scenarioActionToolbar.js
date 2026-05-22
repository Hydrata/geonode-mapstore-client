import React from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
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

// Dispatch table for renderRunControl. One entry per scenario status; the
// 4 mid-run statuses (queued/computing/processing/building) share the
// `spinner` shape via a shared reference. Each entry returns a Button-shaped
// descriptor; the renderer wires it into the DOM, taking care of the
// canRunScenario gate (per-entry `gateOnCanRun`), the Build-disabled-when-
// not-unsaved suffix, and the download anchor extras.
//
// Analytics event names (trackEvent third argument) are preserved 1:1 with
// the legacy ScenarioTableRow.js per the file-level guarantee.
const SPINNER_RUN_CONTROL = {
  className: 'scenario-action-run disabled',
  spinner: true,
  gateOnCanRun: false
};

const RUN_CONTROL_BY_STATUS = {
  built: {
    className: 'scenario-action-run',
    msgId: 'hydrata.anuga.run',
    trackEvent: 'anuga-scenario-menu-run',
    onClickHandler: 'onRunClick',
    bsStyle: 'success',
    gateOnCanRun: true
  },
  complete: {
    className: 'scenario-action-download',
    iconGlyph: 'glyphicon-download',
    trackEvent: 'anuga-scenario-menu-download',
    download: true,
    bsStyle: 'success',
    gateOnCanRun: false
  },
  error: {
    className: 'scenario-action-retry',
    msgId: 'hydrata.anuga.retry',
    trackEvent: 'anuga-scenario-menu-retry',
    onClickHandler: 'onRetryClick',
    bsStyle: 'warning',
    gateOnCanRun: true
  },
  cancelled: {
    className: 'scenario-action-rerun',
    msgId: 'hydrata.anuga.run',
    trackEvent: 'anuga-scenario-menu-rerun',
    onClickHandler: 'onRunClick',
    bsStyle: 'success',
    gateOnCanRun: true
  },
  queued: SPINNER_RUN_CONTROL,
  computing: SPINNER_RUN_CONTROL,
  processing: SPINNER_RUN_CONTROL,
  building: SPINNER_RUN_CONTROL,
  created: {
    className: 'scenario-action-build',
    msgId: 'hydrata.anuga.build',
    trackEvent: 'anuga-scenario-menu-build',
    onClickHandler: 'onBuildClick',
    bsStyle: 'success',
    gateOnCanRun: true,
    disableWhenNotUnsaved: true
  }
};

// Run / Build / Retry / Download / Re-run renderer. Returns null when the
// status has no entry in RUN_CONTROL_BY_STATUS or when the entry is gated
// on canRunScenario and the caller cannot run (read-only role).
function renderRunControl({scenario, canRunScenario, onBuildClick, onRunClick, onRetryClick}) {
  const status = findScenarioStatus(scenario);
  const entry = RUN_CONTROL_BY_STATUS[status];
  if (!entry) return null;
  if (entry.gateOnCanRun && !canRunScenario) return null;

  const handlers = {onBuildClick, onRunClick, onRetryClick};
  const isUnsaved = !!scenario?.unsaved;
  const extraDisabled = entry.disableWhenNotUnsaved && !isUnsaved ? ' disabled' : '';
  const className = 'anuga-btn scenario-action-toolbar-btn ' + entry.className + extraDisabled;

  if (entry.spinner) {
    return (
      <Button bsStyle={'success'} bsSize={'xsmall'} className={className}>
        <span className="glyphicon glyphicon-refresh glyphicon-spin" aria-hidden="true" />
      </Button>
    );
  }

  const onClickHandler = entry.onClickHandler ? handlers[entry.onClickHandler] : null;
  const onClick = () => {
    if (onClickHandler) onClickHandler(scenario);
    trackEvent('button', 'click', entry.trackEvent);
  };

  if (entry.download) {
    return (
      <Button
        download
        href={scenario?.latest_run?.s3_package_url}
        bsStyle={entry.bsStyle}
        bsSize={'xsmall'}
        className={className}
        onClick={() => trackEvent('button', 'click', entry.trackEvent)}
      >
        <span className={'glyphicon ' + entry.iconGlyph} aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      bsStyle={entry.bsStyle}
      bsSize={'xsmall'}
      className={className}
      onClick={onClick}
    >
      <Message msgId={entry.msgId} />
    </Button>
  );
}

// Wave 3C — Duplicate moved to the scenario panel header (next to New
// Scenario), so canDuplicateScenario + onDuplicateClick props are no longer
// destructured here. The header owns the openConfirm('duplicate', ...) dispatch.
const ScenarioActionToolbar = ({
  scenario,
  canEdit,
  canRunScenario,
  onBuildClick,
  onRunClick,
  onRetryClick,
  onArchiveClick,
  onUnarchiveClick,
  onConfirmDelete,
  onConfirmCancelRun
}, context) => {
  // Resolve archive-disabled tooltip via the locale dictionary, falling back
  // to English so the title still surfaces before i18n has loaded.
  const tr = (msgId, fallback) => {
    const messages = (context && context.messages) || {};
    return getMessageById(messages, msgId) || fallback;
  };
  if (!scenario) return null;
  const status = findScenarioStatus(scenario);
  // W7 (TASK-1045) — add 'processing' to the cancellable set. The status
  // value lands when results post-processing is in flight; until W7 the
  // cancel affordance disappeared at the moment the run moved to processing,
  // leaving the user no way to abort late-stage work that can still be
  // safely cancelled BE-side.
  const isCancellable = ['queued', 'computing', 'building', 'processing'].includes(status);
  // Wave 3C C2 — defence-in-depth gate. isCancellable + TERMINAL_RUN_STATES
  // are mutually exclusive sets today, but reading the run status directly
  // means future status-set drift can't accidentally enable the Cancel
  // button on a finished run.
  const runStatus = scenario?.latest_run?.status;
  const isTerminalRun = TERMINAL_RUN_STATES.includes(runStatus);

  const canCancelRun = isCancellable && canRunScenario && !isTerminalRun;
  const canDeleteScenario = !isCancellable && canEdit;
  const showDeleteOrCancel = canCancelRun || canDeleteScenario;

  // Duplicate button moved to the scenario panel header (next to New Scenario).
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
        bsStyle={isArchived ? 'success' : 'warning'}
        bsSize={'xsmall'}
        className={"anuga-btn scenario-action-toolbar-btn "
          + (isArchived ? 'anuga-btn-unarchive scenario-action-unarchive' : 'anuga-btn-archive scenario-action-archive')
          + (showArchive ? '' : ' is-hidden')
          + (isArchiveDisabled ? ' disabled' : '')}
        disabled={isArchiveDisabled}
        title={isArchiveDisabled
          ? tr('hydrata.anuga.archiveDisabledWhileRunning',
              'Cannot archive while a run is in progress. Cancel the run first.')
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
  onBuildClick: PropTypes.func,
  onRunClick: PropTypes.func,
  onRetryClick: PropTypes.func,
  onArchiveClick: PropTypes.func,
  onUnarchiveClick: PropTypes.func,
  onConfirmDelete: PropTypes.func,
  onConfirmCancelRun: PropTypes.func
};

// Pull intl messages off React legacy context so getMessageById can resolve
// the archive-disabled tooltip key at render time.
ScenarioActionToolbar.contextTypes = {
  messages: PropTypes.object
};

ScenarioActionToolbar.defaultProps = {
  canEdit: false,
  canRunScenario: false
};

export {ScenarioActionToolbar};
