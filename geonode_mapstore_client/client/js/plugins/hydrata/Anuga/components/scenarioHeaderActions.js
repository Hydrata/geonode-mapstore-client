import React, {useState, useRef, useEffect, useCallback} from "react";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, IN_FLIGHT_STATUSES} from './scenarioHelpers';
import {TERMINAL_RUN_STATES} from '../anugaConstants';

/**
 * UAT #8 — always-visible run-action strip for the selected scenario, rendered
 * on the right-hand side of the Scenarios heading (a sibling of, and visually
 * separate from, the New Scenario / Compare / Duplicate cluster).
 *
 * Replaces the status-mutex ScenarioActionToolbar that used to live INSIDE the
 * Run pane: the user can now Build / Build-and-Run / Run / Retry / Download /
 * Archive / Delete from anywhere in the panel, not just when the Run tab is
 * open. The button class names + Umami analytics labels are preserved 1:1 from
 * the old toolbar so the analytics-parity suite (and the Umami dashboards it
 * guards) keep working after the move.
 *
 * TASK-2115 (C, epic 2111 W2, dogfood finding C) — View Results now renders
 * as the FIRST (leftmost, most prominent) button in THIS same strip instead
 * of a separate `.sv-anuga-view-results-bar` sibling row, so the panel has
 * ONE consistent action row instead of two. Gate + href logic is unchanged
 * (the container still derives `hasCompleteResults` from
 * `latest_complete_run`, TASK-2078's D1 "RESULT consumer" contract) — only
 * WHERE the button renders moved. `hasCompleteResults`/`onViewResultsClick`
 * are both optional so every existing caller/test that doesn't pass them
 * keeps rendering exactly as before (no button, no behaviour change).
 *
 * TASK-2239 (epic 2237 W1.1, "hydraulics panel declutter") — the Build /
 * Build-and-Run / Run family regroups into an explicit RUN CLUSTER
 * (`.sv-scenario-run-cluster`): Build-and-Run, then a 4-state LIFECYCLE SLOT
 * mutex (Run / Re-run / Retry / Cancel run), then Build — three raised
 * FILLED sv-* buttons with a small explicit gap (deliberately NOT an inset
 * segmented pill/tab strip). Family rule for the whole strip: FILLED =
 * executes or costs money (the cluster, Archive/Unarchive, Delete);
 * OUTLINE = safe/non-destructive (View Results, Download — `.sv-scenario-
 * action-outline`).
 *
 * Lifecycle slot (amendment A2) — a MUTEX, not independent conditionals:
 * today's code rendered a (possibly disabled) Run/Retry button ALONGSIDE
 * Cancel while a run was in flight; this collapses that to exactly one
 * visible control at a time, in priority order:
 *   1. Cancel run  — cancellable (in flight, not yet terminal); destructive
 *      fill, existing confirm (onConfirmCancelRun).
 *   2. Retry       — status === 'error'.
 *   3. Run / Re-run — everything else (Re-run label+class when status ===
 *      'cancelled'); disabled while created/in-flight/debounced.
 *   4. FALLBACK: a disabled Run silently falls out of branch 3 in the
 *      poll-lag window — scenario status still reads in-flight but
 *      latest_run has already gone terminal (Cancel's `!isTerminalRun` gate
 *      fails, so control falls through to Run, which the `inFlight` term of
 *      `lockRun` keeps disabled). No separate fallback branch needed — the
 *      existing gates already produce it.
 * The underlying gating CONDITIONS (`canCancelRun`, `isError`, `isRerun`,
 * `lockRun`, …) are byte-for-byte unchanged from before this task; only the
 * VISIBLE SET they render into collapsed from "independent" to "mutex".
 *
 * Three new behaviours land here (pre-2239, UAT #8):
 *   - "Build and Run" — a combined button that calls the existing build then
 *     run handlers in sequence (the container owns the chaining).
 *   - "Download" — visible only when the scenario is actually BUILT (status
 *     'built'; also kept for 'complete' so the result package stays reachable),
 *     linking to the run's presigned s3_package_url.
 *   - Debounce — Build / Run / Build-and-Run disable for at least
 *     ACTION_DEBOUNCE_MS after a click (immediate "press registered" feedback).
 *     The button also stays disabled while the scenario is in flight, so the
 *     effective lock is max(2s, pending) per the UAT note.
 *
 * Confirm-requiring actions (archive / unarchive / delete / cancel-run) dispatch
 * through the container's inline-dialog props — NO window.confirm here (memory
 * pin feedback-window-confirm-blocks-automation).
 *
 * UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 3) —
 * STANDARDISED this row: every button is now EQUAL WIDTH (anuga.css,
 * `.sv-scenario-action-toolbar-btn` — the shared hook class every button
 * here already carried) and ICON-FREE (all glyphicons removed: View
 * Results' eye-open, the build-conflict info-sign, Download's
 * download-glyph, Archive/Unarchive's folder-close/open, Delete/Cancel-run's
 * trash/ban-circle). Archive/Unarchive and Delete/Cancel-run were
 * previously icon-ONLY buttons; they now render visible text via the SAME
 * Message msgIds the confirm dialog already used for these actions
 * (btnArchive/btnRestore/btnDelete/btnCancelRun) — no new translation
 * strings were needed. Classnames + Umami labels are all BYTE-IDENTICAL
 * (analytics-parity constraint) — only icon presence, text presentation,
 * and width changed.
 */

// Minimum time (ms) a debounced action button stays disabled after a click.
export const ACTION_DEBOUNCE_MS = 2000;

// Mid-run statuses (IN_FLIGHT_STATUSES, imported from scenarioHelpers): no new
// build/run can start, and Build/Run/Build-and-Run are held disabled until the
// run leaves these states.

const ScenarioHeaderActions = (props, context) => {
    const {
        scenario,
        canEdit,
        canRunScenario,
        hasCompleteResults,
        onViewResultsClick,
        onBuildClick,
        onRunClick,
        onBuildAndRunClick,
        onRetryClick,
        onArchiveClick,
        onUnarchiveClick,
        onConfirmDelete,
        onConfirmCancelRun
    } = props;

    // One debounce timer id per action; cleared on unmount so a late timer
    // never calls setState on an unmounted component.
    const timers = useRef({});
    const [debounced, setDebounced] = useState({build: false, run: false, buildAndRun: false});

    useEffect(() => () => {
        Object.keys(timers.current).forEach((key) => {
            if (timers.current[key]) clearTimeout(timers.current[key]);
        });
    }, []);

    const startDebounce = useCallback((key) => {
        setDebounced((prev) => ({...prev, [key]: true}));
        if (timers.current[key]) clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            setDebounced((prev) => ({...prev, [key]: false}));
        }, ACTION_DEBOUNCE_MS);
    }, []);

    // Resolve archive-disabled tooltip via the locale dictionary, falling back
    // to English. getMessageById returns the msgId itself on a miss, so compare
    // against the input id to detect the unresolved case (same idiom as the
    // legacy toolbar).
    const tr = (msgId, fallback) => {
        const messages = (context && context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };

    if (!scenario) return null;

    const status = findScenarioStatus(scenario);
    const inFlight = IN_FLIGHT_STATUSES.includes(status);
    const isBuilt = status === 'built';
    const isComplete = status === 'complete';
    const isError = status === 'error';
    const isCreated = status === 'created';
    const isArchived = !!scenario.archived_at;

    const runStatus = scenario?.latest_run?.status;
    const isTerminalRun = TERMINAL_RUN_STATES.includes(runStatus);

    const canCancelRun = inFlight && canRunScenario && !isTerminalRun;
    const canDeleteScenario = !inFlight && canEdit;
    const showArchive = canEdit && !!scenario.id;

    // Build / Run / Build-and-Run stay disabled while a run is in flight OR
    // during the post-click debounce window.
    const lockBuild = inFlight || debounced.build;
    const lockBuildAndRun = inFlight || debounced.buildAndRun;
    // A 'created' scenario has nothing to run yet — Run is visible but disabled
    // (the user reaches a first run via Build or Build-and-Run).
    const lockRun = inFlight || debounced.run || isCreated;

    // 'cancelled' re-uses the Run button as a Re-run, with the legacy class +
    // analytics label so the parity suite still finds it.
    const isRerun = status === 'cancelled';

    // Download is the built-package presigned URL; shown when the scenario is
    // BUILT (UAT #8) and also when complete so the result package stays
    // reachable after a run finishes. TASK-2078: package download href/gate is
    // a RESULT consumer per D1 — ALSO shown (and the href points there) when a
    // latest_complete_run exists, even if a newer latest_run is now in-flight
    // or errored (isBuilt/isComplete, derived from latest_run's status, would
    // otherwise hide/break the download for that window). Falls back to
    // latest_run's package for the plain built-but-not-yet-run case, where no
    // complete run exists yet.
    const latestCompleteRun = scenario?.latest_complete_run;
    const showDownload = isBuilt || isComplete || !!latestCompleteRun;
    const downloadHref = latestCompleteRun?.s3_package_url || scenario?.latest_run?.s3_package_url;

    // TASK-2100 (epic 2092 W4.2) — the coarse, customer-BILLED price band
    // (RunSerializerV2.price_band; supersedes scenarioPane.js's exact-$
    // pre-build estimate as the answer to "what will I actually be charged").
    // null both when the meter is off (ships dark — see get_price_band's
    // gating) AND when this particular run can't yet be priced
    // (PricingUnavailable, e.g. no mesh build) — either way, nothing renders.
    const priceBand = scenario?.latest_run?.price_band;
    const hasPriceBand = priceBand !== null && priceBand !== undefined;
    const priceLabel = hasPriceBand ? (Number(priceBand) === 0 ? 'Free' : `$${priceBand}`) : null;

    const fireDebounced = (key, handler, eventName) => () => {
        if (handler) handler(scenario);
        trackEvent('button', 'click', eventName);
        startDebounce(key);
    };
    const fire = (handler, eventName) => () => {
        if (handler) handler(scenario);
        trackEvent('button', 'click', eventName);
    };

    const btn = (extra) => 'sv-anuga-btn sv-scenario-action-toolbar-btn ' + extra;
    // Family rule (TASK-2239): OUTLINE = safe/non-destructive read (View
    // Results, Download). Adds a modifier class alongside the existing
    // bsStyle-driven Bootstrap class; does not touch legacy classnames.
    const outlineBtn = (extra) => btn(extra) + ' sv-scenario-action-outline';

    // TASK-2239 — the 4-state lifecycle-slot mutex (amendment A2). Exactly
    // one of Cancel run / Retry / Run / Re-run renders, in that priority
    // order; the FALLBACK (disabled Run in the poll-lag window) falls out
    // of the Run/Re-run branch for free because canCancelRun's own
    // `!isTerminalRun` term already excludes it there. Every condition below
    // is byte-for-byte the same gate the pre-2239 independent conditionals
    // used — only the mutex wrapping is new.
    const renderLifecycleSlot = () => {
        if (canCancelRun) {
            return (
                <Button
                    bsStyle={'danger'}
                    bsSize={'xsmall'}
                    className={"sv-anuga-btn-delete sv-scenario-action-toolbar-btn sv-scenario-action-cancel-run"}
                    onClick={() => {
                        if (onConfirmCancelRun) onConfirmCancelRun(scenario);
                        trackEvent('button', 'click', 'anuga-scenario-menu-cancel-run');
                    }}
                >
                    <Message msgId="hydrata.anuga.btnCancelRun" />
                </Button>
            );
        }
        if (canRunScenario && isError) {
            return (
                <Button
                    bsStyle={'warning'}
                    bsSize={'xsmall'}
                    className={btn('sv-scenario-action-retry')}
                    onClick={fire(onRetryClick, 'anuga-scenario-menu-retry')}
                >
                    <Message msgId="hydrata.anuga.retry" />
                </Button>
            );
        }
        if (canRunScenario && !isError) {
            return (
                <Button
                    bsStyle={'success'}
                    bsSize={'xsmall'}
                    className={btn(isRerun ? 'sv-scenario-action-rerun' : 'sv-scenario-action-run')
                        + (lockRun ? ' disabled' : '')}
                    disabled={lockRun}
                    onClick={fireDebounced('run', onRunClick,
                        isRerun ? 'anuga-scenario-menu-rerun' : 'anuga-scenario-menu-run')}
                >
                    <Message msgId="hydrata.anuga.run" />
                </Button>
            );
        }
        return null;
    };

    return (
        <div id="scenario-run-actions" className="sv-scenario-header-run-actions">
            {/* TASK-2115 (C) — View Results leads the row when results exist
                (dogfood finding C: was a separate .sv-anuga-view-results-bar
                sibling row; same classname + gate + handler, new position).
                TASK-2239 — OUTLINE per the family rule (safe/non-destructive
                read, not an execute/cost action). */}
            {hasCompleteResults ?
                <Button
                    bsStyle={'success'}
                    bsSize={'xsmall'}
                    className={outlineBtn('sv-anuga-btn-view-results')}
                    onClick={() => { if (onViewResultsClick) onViewResultsClick(scenario); }}
                >
                    <Message msgId="hydrata.anuga.viewResults" />
                </Button> : null
            }
            {/* TASK-2239 (epic 2237 W1.1) — the run cluster: Build-and-Run,
                then the 4-state lifecycle slot, then Build. Three raised
                FILLED sv-* buttons with a small explicit gap (anuga.css
                `.sv-scenario-run-cluster`) — deliberately NOT an inset
                segmented pill/tab strip. */}
            <div className="sv-scenario-run-cluster">
                {canEdit && canRunScenario ?
                    <Button
                        bsStyle={'primary'}
                        bsSize={'xsmall'}
                        className={btn('sv-scenario-action-build-run') + (lockBuildAndRun ? ' disabled' : '')}
                        disabled={lockBuildAndRun}
                        onClick={fireDebounced('buildAndRun', onBuildAndRunClick, 'anuga-scenario-menu-build-and-run')}
                    >
                        <Message msgId="hydrata.anuga.buildAndRun" />
                    </Button> : null
                }
                {renderLifecycleSlot()}
                {canEdit ?
                    <Button
                        bsStyle={'success'}
                        bsSize={'xsmall'}
                        className={btn('sv-scenario-action-build') + (lockBuild ? ' disabled' : '')}
                        disabled={lockBuild}
                        onClick={fireDebounced('build', onBuildClick, 'anuga-scenario-menu-build')}
                    >
                        <Message msgId="hydrata.anuga.build" />
                    </Button> : null
                }
            </div>
            {canRunScenario && priceLabel ?
                <span
                    data-testid="sv-scenario-run-price"
                    className="sv-scenario-run-price"
                    title="This run's price band — what you'll actually be charged (compute meter)"
                >
                    {priceLabel}
                </span> : null
            }
            {/* TASK-2079: a benign 409 (build-dedup guard — a build is
                already in flight/just-dispatched for this scenario) shows
                inline info here instead of the 'Build failed' toast. Does
                NOT block the Build-and-Run piggyback: maybeRunAfterBuild
                (anugaScenarioMenu.js) arms off the synchronous dispatch
                click, then rides the live scenario-status poll to observe
                the EXISTING in-flight build through to 'built' regardless
                of whether this POST 202'd or 409'd. Amendment A5 — stays
                INLINE beside the cluster (not moved into any notices UI). */}
            {canEdit && scenario.buildConflict ?
                <span
                    className="sv-scenario-build-conflict-info"
                    role="status"
                    aria-live="polite"
                >
                    {tr('hydrata.anuga.buildAlreadyInProgress',
                        'A build is already in progress for this scenario.')}
                </span> : null
            }
            {/* TASK-2239 — OUTLINE per the family rule (safe/non-destructive
                read). */}
            {showDownload ?
                <Button
                    download
                    href={downloadHref}
                    bsStyle={'success'}
                    bsSize={'xsmall'}
                    className={outlineBtn('sv-scenario-action-download')}
                    onClick={() => trackEvent('button', 'click', 'anuga-scenario-menu-download')}
                >
                    <Message msgId="hydrata.anuga.download" />
                </Button> : null
            }
            {/* UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 3)
                — Archive/Unarchive was an icon-only glyph button; it now renders
                its existing Message text (btnArchive/btnRestore — the SAME
                msgIds the confirm dialog already uses for these actions, not new
                strings) so the row reads as text, matching every other button. */}
            {showArchive ?
                <Button
                    bsStyle={isArchived ? 'success' : 'warning'}
                    bsSize={'xsmall'}
                    className={btn(isArchived
                        ? 'sv-anuga-btn-unarchive sv-scenario-action-unarchive'
                        : 'sv-anuga-btn-archive sv-scenario-action-archive')
                        + (inFlight ? ' disabled' : '')}
                    disabled={inFlight}
                    title={inFlight
                        ? tr('hydrata.anuga.archiveDisabledWhileRunning',
                            'Cannot archive while a run is in progress. Cancel the run first.')
                        : undefined}
                    onClick={() => {
                        if (inFlight) return;
                        if (isArchived) {
                            if (onUnarchiveClick) onUnarchiveClick(scenario);
                            trackEvent('button', 'click', 'anuga-scenario-menu-unarchive-scenario');
                        } else {
                            if (onArchiveClick) onArchiveClick(scenario);
                            trackEvent('button', 'click', 'anuga-scenario-menu-archive-scenario');
                        }
                    }}
                >
                    <Message msgId={isArchived ? 'hydrata.anuga.btnRestore' : 'hydrata.anuga.btnArchive'} />
                </Button> : null
            }
            {/* TASK-2239 — Delete now stands alone (Cancel-run moved into the
                lifecycle slot above); canDeleteScenario (`!inFlight && canEdit`)
                is unchanged and was already mutually exclusive with
                canCancelRun (`inFlight && …`), so this never double-renders
                against the slot's Cancel button. Classname/label/handler
                byte-identical to the pre-2239 combined button's Delete branch. */}
            {canDeleteScenario ?
                <Button
                    bsStyle={'danger'}
                    bsSize={'xsmall'}
                    className={"sv-anuga-btn-delete sv-scenario-action-toolbar-btn sv-scenario-action-delete"}
                    onClick={() => {
                        if (onConfirmDelete) onConfirmDelete(scenario);
                        trackEvent('button', 'click', 'anuga-scenario-menu-delete-scenario');
                    }}
                >
                    <Message msgId="hydrata.anuga.btnDelete" />
                </Button> : null
            }
        </div>
    );
};

ScenarioHeaderActions.propTypes = {
    scenario: PropTypes.object,
    canEdit: PropTypes.bool,
    canRunScenario: PropTypes.bool,
    // TASK-2115 (C) — View Results, folded into this strip from the former
    // standalone .sv-anuga-view-results-bar row.
    hasCompleteResults: PropTypes.bool,
    onViewResultsClick: PropTypes.func,
    onBuildClick: PropTypes.func,
    onRunClick: PropTypes.func,
    onBuildAndRunClick: PropTypes.func,
    onRetryClick: PropTypes.func,
    onArchiveClick: PropTypes.func,
    onUnarchiveClick: PropTypes.func,
    onConfirmDelete: PropTypes.func,
    onConfirmCancelRun: PropTypes.func
};

ScenarioHeaderActions.defaultProps = {
    canEdit: false,
    canRunScenario: false,
    hasCompleteResults: false
};

// Pull intl messages off React legacy context so getMessageById can resolve
// the archive-disabled tooltip at render time (same pattern as the toolbar).
ScenarioHeaderActions.contextTypes = {
    messages: PropTypes.object
};

export {ScenarioHeaderActions};
