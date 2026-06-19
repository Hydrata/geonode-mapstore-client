import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {findScenarioStatus} from './scenarioHelpers';
import {ScenarioStatusPill} from './scenarioStatusPill';
// TASK-1764 (epic-1758 W1) — chassis Card frames the Status-and-actions
// status card. The .sv-anuga-scenario-status-card[+--status] classes ride
// extraClassName so the legacy inner-element rules + the test's
// .sv-anuga-scenario-status-card--<status> assertions stay intact. The Card's
// default token frame supplies bg/border/padding; only the margin is
// overridden inline (style prop) to preserve the legacy 6px 10px 12px spacing.
import {Card} from '../../SimpleView/components/primitives';

/**
 * TASK-C-scenarios-miller Wave 3A — large status card for the Status and
 * actions Pane 3. Mirrors the "Computing 47% · ETA 12m 04s remaining"
 * card in the Option A mockup (docs/reports/2026-05-18-scenarios-
 * redesign-option-A.html lines 1260-1272).
 *
 * Composition:
 *   - row 1: full-size status pill + trailing ETA / "Stopped after Xm Ys"
 *   - row 2: progress track + fill (only when status === 'computing' or
 *            error with progress data)
 *   - row 3: progress meta line (sim-time + step counts when available)
 *
 * Stateless. The pill underneath reuses the existing ScenarioStatusPill
 * (`compact={false}`) so the lifecycle-state visuals stay coherent with
 * the rail row and the breadcrumb mirror.
 *
 * Empty / created status: card still renders but with neutral copy
 * ("Not yet run") so the user has a visual placeholder where the
 * progress bar would later live.
 */

function formatMinSec(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
}

const ScenarioStatusCard = ({scenario}) => {
    if (!scenario) return null;
    const status = findScenarioStatus(scenario);
    const latestRun = scenario.latest_run || {};
    const pct = Number.isFinite(latestRun.progress_pct) ? latestRun.progress_pct : null;
    const etaText = formatMinSec(latestRun.eta_seconds);
    const elapsedText = formatMinSec(latestRun.elapsed_seconds);
    const showProgressBar = (
        status === 'computing'
        || (status === 'error' && pct != null && pct > 0) // eslint-disable-line no-eq-null, eqeqeq
    );

    let trailingMeta = null;
    if (status === 'computing' && etaText) {
        trailingMeta = (
            <span className="sv-anuga-scenario-status-card-eta">
                <Message msgId="hydrata.anuga.etaPrefix" /> {etaText}
            </span>
        );
    } else if ((status === 'error' || status === 'cancelled') && elapsedText) {
        trailingMeta = (
            <span className="sv-anuga-scenario-status-card-eta is-stopped">
                <Message msgId="hydrata.anuga.stoppedAfter" /> {elapsedText}
            </span>
        );
    }

    return (
        <Card
            extraClassName={'sv-anuga-scenario-status-card sv-anuga-scenario-status-card--' + status}
            style={{margin: '6px 10px 12px'}}
        >
            <div className="sv-anuga-scenario-status-card-row">
                <ScenarioStatusPill scenario={scenario} />
                {trailingMeta}
            </div>
            {showProgressBar ? (
                <div className="sv-anuga-scenario-status-card-progress">
                    <div className="sv-anuga-scenario-status-card-progress-track">
                        <div
                            className={
                                'sv-anuga-scenario-status-card-progress-fill'
                                + (status === 'error' ? ' is-error' : '')
                            }
                            style={{width: `${Math.max(0, Math.min(100, pct || 0))}%`}}
                        />
                    </div>
                    {(latestRun.sim_time_label || latestRun.step_label) ? (
                        <div className="sv-anuga-scenario-status-card-progress-meta">
                            {latestRun.sim_time_label ? (
                                <span>{Math.round(pct || 0)}% · {latestRun.sim_time_label}</span>
                            ) : (
                                <span>{Math.round(pct || 0)}%</span>
                            )}
                            {latestRun.step_label ? (
                                <span>{latestRun.step_label}</span>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Card>
    );
};

ScenarioStatusCard.propTypes = {
    scenario: PropTypes.object
};

// Wave 3D Tier B7 — card renders inside the Status and actions pane and
// pulls only from scenario.latest_run. Default shallow comparator skips
// re-render when the parent re-renders without a scenario change.
const MemoScenarioStatusCard = React.memo(ScenarioStatusCard);

export {MemoScenarioStatusCard as ScenarioStatusCard};
