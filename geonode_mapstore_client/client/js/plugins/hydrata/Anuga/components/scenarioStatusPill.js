import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {findScenarioStatus} from './scenarioHelpers';

/**
 * TASK-C-scenarios-miller W1 — presentational status pill extracted from
 * ScenarioTableRow.renderStatusCell (lines 241-313). Renders the 9-state
 * scenario status display:
 *
 *   created  | building  | queued     | computing | processing
 *   complete | error     | cancelled  | built
 *
 * Visual contract preserved 1:1 with the legacy table cell (same glyph,
 * same Message keys, same status-complete / status-error / status-cancelled
 * CSS hooks). The pill is presentation-only — `findScenarioStatus` is the
 * only logic dependency.
 *
 * `compact` mode (used by the rail item) hides the ETA-minutes badge and
 * the truncated error_message tooltip so the rail row stays one-line.
 */
const ScenarioStatusPill = ({scenario, compact}) => {
  const status = findScenarioStatus(scenario);
  const latestRun = scenario?.latest_run;

  switch (status) {
  case 'building':
    return (
      <span className={"scenario-status-pill status-building" + (compact ? " is-compact" : "")}>
        <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
        <Message msgId="hydrata.anuga.statusBuilding" />
      </span>
    );
  case 'queued':
    return (
      <span className={"scenario-status-pill status-queued" + (compact ? " is-compact" : "")}>
        <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
        <Message msgId="hydrata.anuga.statusQueued" />
      </span>
    );
  case 'computing': {
    const pct = latestRun?.progress_pct || 0;
    const eta = latestRun?.eta_seconds;
    return (
      <span className={"scenario-status-pill status-computing" + (compact ? " is-compact" : "")}>
        <span className="scenario-status-progress-track">
          <span
            className="scenario-status-progress-fill"
            style={{width: `${pct}%`}}
          />
        </span>
        <span className="scenario-status-progress-pct">{Math.round(pct)}%</span>
        {eta && !compact ?
          <span className="scenario-status-progress-eta">{Math.ceil(eta / 60)}m</span> : null
        }
      </span>
    );
  }
  case 'processing':
    return (
      <span className={"scenario-status-pill status-processing" + (compact ? " is-compact" : "")}>
        <span className="glyphicon glyphicon-refresh glyphicon-spin status-icon" />
        <Message msgId="hydrata.anuga.statusProcessing" />
      </span>
    );
  case 'complete':
    return (
      <span className={"scenario-status-pill status-complete" + (compact ? " is-compact" : "")}>
        <span className="glyphicon glyphicon-ok status-icon" />
        <Message msgId="hydrata.anuga.statusComplete" />
      </span>
    );
  case 'error':
    return (
      <span className={"scenario-status-pill status-error" + (compact ? " is-compact" : "")}>
        <Message msgId="hydrata.anuga.statusError" />
        {latestRun?.error_message && !compact ?
          <span
            className="scenario-status-error-detail"
            title={latestRun.error_message}
          >
            {latestRun.error_message.substring(0, 30)}{latestRun.error_message.length > 30 ? '...' : ''}
          </span> : null
        }
      </span>
    );
  case 'cancelled':
    return (
      <span className={"scenario-status-pill status-cancelled" + (compact ? " is-compact" : "")}>
        <Message msgId="hydrata.anuga.statusCancelled" />
      </span>
    );
  case 'built':
    return (
      <span className={"scenario-status-pill status-built" + (compact ? " is-compact" : "")}>
        <Message msgId="hydrata.anuga.statusBuilt" />
      </span>
    );
  case 'created':
  default:
    return (
      <span className={"scenario-status-pill status-created" + (compact ? " is-compact" : "")}>
        {status}
      </span>
    );
  }
};

ScenarioStatusPill.propTypes = {
  scenario: PropTypes.object,
  compact: PropTypes.bool
};

ScenarioStatusPill.defaultProps = {
  compact: false
};

export {ScenarioStatusPill};
