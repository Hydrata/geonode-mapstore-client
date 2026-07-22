import React, {useState, useRef, useEffect, useCallback} from "react";
const PropTypes = require('prop-types');
import {Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
import {trackEvent} from "@js/utils/analytics";
import {findScenarioStatus, IN_FLIGHT_STATUSES} from './scenarioHelpers';
import {TERMINAL_RUN_STATES} from '../anugaConstants';

/**
 * UAT #8 — always-visible run-action strip for the selected scenario, rendered
 * on the right-hand side of the Scenarios heading (a sibling of, and visually
 * separate from, the overflow-menu kebab — anugaScenarioOverflowMenu.js,
 * TASK-2240 — that now carries New Scenario / Duplicate / Archive / Delete).
 *
 * Replaces the status-mutex ScenarioActionToolbar that used to live INSIDE the
 * Run pane: the user can now Build / Build-and-Run / Run / Retry / Download
 * from anywhere in the panel, not just when the Run tab is open. The button
 * class names + Umami analytics labels are preserved 1:1 from the old
 * toolbar so the analytics-parity suite (and the Umami dashboards it guards)
 * keep working after the move.
 *
 * TASK-2115 (C, epic 2111 W2, dogfood finding C) — View Results renders in
 * THIS same strip instead of a separate `.sv-anuga-view-results-bar` sibling
 * row, so the panel has ONE consistent action row instead of two. Gate +
 * href logic is unchanged (the container still derives `hasCompleteResults`
 * from `latest_complete_run`, TASK-2078's D1 "RESULT consumer" contract) —
 * only WHERE the button renders has moved (see TASK-2266 below).
 * `hasCompleteResults`/`onViewResultsClick` are both optional so every
 * existing caller/test that doesn't pass them keeps rendering exactly as
 * before (no button, no behaviour change).
 *
 * TASK-2266 (epic 2237 W5, UAT re-aim finding 1) — View Results originally
 * led the row (leftmost); the operator's dogfood UAT read it as visually
 * disconnected from Download (the other read-only/OUTLINE action it
 * pairs with), separated by the whole run cluster. Moved to render
 * immediately LEFT of Download — 2nd-from-right in the strip — regardless
 * of whether the price-band span or the build-conflict info span also
 * render in between (both are non-button `<span>`s, not buttons the
 * "2nd from the right" count is about). Gate/handler/classname are
 * byte-identical; only JSX position changed (no CSS `order:` reordering
 * exists anywhere in this strip — DOM order IS visual order here).
 *
 * TASK-2239 (epic 2237 W1.1, "hydraulics panel declutter") — the Build /
 * Build-and-Run / Run family regroups into an explicit RUN CLUSTER
 * (`.sv-scenario-run-cluster`): Build-and-Run, then a 4-state LIFECYCLE SLOT
 * mutex (Run / Re-run / Retry / Cancel run), then Build — three raised
 * FILLED sv-* buttons with a small explicit gap (deliberately NOT an inset
 * segmented pill/tab strip). Family rule for the whole strip: FILLED =
 * executes or costs money (the cluster); OUTLINE = safe/non-destructive
 * (View Results, Download — `.sv-scenario-action-outline`).
 *
 * TASK-2240 (epic 2237 W1.2) — Archive/Unarchive and Delete moved OUT of
 * this strip into the new custom portaled overflow (kebab) menu
 * (anugaScenarioOverflowMenu.js), alongside New Scenario/Duplicate (which
 * moved out of the SectionHeader). Cancel run stays HERE, in the lifecycle
 * slot — it is a run-lifecycle action, not a scenario-management one.
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
 * Confirm-requiring actions (cancel-run, still rendered here; archive /
 * unarchive / delete, now in the overflow menu) dispatch through the
 * container's inline-dialog props — NO window.confirm here (memory pin
 * feedback-window-confirm-blocks-automation).
 *
 * TASK-2242 (epic 2237 W1.4) — the three executables (Build-and-Run, the
 * lifecycle slot, Build) each carry a hover tooltip: helper text explaining
 * what the click actually does, plus (Build / Build-and-Run only) a live
 * echo of the pre-build estimate (scenario.mesh_triangle_count_estimate /
 * compute_cost_estimate) when the scenario carries one — the estimate's
 * HOME stays the in-pane section (scenarioPane.js); this is a read-only
 * echo, no new data plumbing (amendment A1). The removed runConfigHelp
 * paragraph's content is now fully covered by these tooltips.
 *
 * Two idioms reused verbatim from commit 82eca8880 (Terrain/Friction
 * pane-header tooltips, same class of bug):
 *   - z-index: react-bootstrap OverlayTrigger portals its overlay to
 *     <body>, where geonode.css's `.msgapi .tooltip` sits at z-index:10000
 *     — BELOW `.gn-page-wrapper`'s z-index:99999, so a body-level tooltip
 *     paints invisibly behind the whole app unless lifted. PANE_TOOLTIP_STYLE
 *     (inline zIndex:100000) fixes that; every Tooltip below also carries the
 *     `id` react-bootstrap requires for screen-reader accessibility.
 *   - disabled buttons swallow pointer events, so OverlayTrigger's hover
 *     listener on a `disabled` <button> never fires. Each tooltip-bearing
 *     executable is wrapped in a plain <span> (withExecutableTooltip below)
 *     — the OverlayTrigger listens on the SPAN, which stays hoverable
 *     regardless of the button's own disabled state (acceptance: tooltip
 *     still renders while disabled mid-flight).
 *
 * UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 3) —
 * STANDARDISED this row: every button is now EQUAL WIDTH (anuga.css,
 * `.sv-scenario-action-toolbar-btn` — the shared hook class every button
 * here already carried) and ICON-FREE (all glyphicons removed: View
 * Results' eye-open, the build-conflict info-sign, Download's
 * download-glyph, Cancel-run's ban-circle). Cancel-run was previously an
 * icon-ONLY button; it now renders visible text via the SAME Message
 * msgId the confirm dialog already used (btnCancelRun) — no new
 * translation strings were needed. Classnames + Umami labels are all
 * BYTE-IDENTICAL (analytics-parity constraint) — only icon presence, text
 * presentation, and width changed.
 */

// Minimum time (ms) a debounced action button stays disabled after a click.
export const ACTION_DEBOUNCE_MS = 2000;

// TASK-2242 — see the file doc comment's z-index note (idiom from commit
// 82eca8880). Inline beats the stylesheet rule.
const PANE_TOOLTIP_STYLE = {zIndex: 100000};

// TASK-2242 — Build / Build-and-Run tooltips echo the SAME pre-build
// estimate scenarioPane.js's own in-pane section renders (mesh triangle
// count + dollar cost), read-only, no new data plumbing (amendment A1).
// Returns null (renders nothing) when the scenario carries neither value.
//
// TASK-2400 (dogfood F1 #1/#2a) — two truth-pass fixes mirroring
// scenarioPane.js's in-pane estimate section:
//   (b) a $0 (free-band) run reads "Free", never a bare "$0.00" — same call
//       scenarioHeaderActions.js's own priceLabel already makes for the
//       POST-build exact price band, below.
//   (a) when the scenario carries unsaved local edits (scenario.unsaved),
//       this echo is committing the user to a run priced off the LAST
//       SAVED config, not what they're currently editing — flagged inline
//       so the tooltip never reads as authoritative for an edit in flight.
const estimateEcho = (scenario) => {
    const hasTriangles = scenario?.mesh_triangle_count_estimate !== null
        && scenario?.mesh_triangle_count_estimate !== undefined;
    const hasCost = scenario?.compute_cost_estimate !== null
        && scenario?.compute_cost_estimate !== undefined;
    if (!hasTriangles && !hasCost) return null;
    const parts = [];
    if (hasTriangles) parts.push(`~${Number(scenario.mesh_triangle_count_estimate).toLocaleString()} triangles`);
    if (hasCost) parts.push(Number(scenario.compute_cost_estimate) === 0 ? 'Free' : `~$${Number(scenario.compute_cost_estimate).toFixed(2)} est.`);
    const stale = scenario?.unsaved ? ' — estimate outdated, rebuild to refresh' : '';
    return ` (${parts.join(', ')}${stale})`;
};

// TASK-2242 — wraps an executable button in an OverlayTrigger + a plain
// <span> (see the file doc comment's disabled-pointer-events note). `id`
// must be unique per call site (react-bootstrap requires it on Tooltip).
const withExecutableTooltip = (id, content, child) => (
    <OverlayTrigger placement="top" overlay={<Tooltip id={id} style={PANE_TOOLTIP_STYLE}>{content}</Tooltip>}>
        <span className="sv-scenario-tooltip-wrap">{child}</span>
    </OverlayTrigger>
);

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

    // Resolve the build-conflict info text via the locale dictionary, falling
    // back to English. getMessageById returns the msgId itself on a miss, so
    // compare against the input id to detect the unresolved case (same idiom
    // as the legacy toolbar).
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

    const runStatus = scenario?.latest_run?.status;
    const isTerminalRun = TERMINAL_RUN_STATES.includes(runStatus);

    const canCancelRun = inFlight && canRunScenario && !isTerminalRun;

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
            return withExecutableTooltip(
                'sv-scenario-cancel-run-tooltip',
                <Message msgId="hydrata.anuga.cancelRunTooltip" />,
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
            return withExecutableTooltip(
                'sv-scenario-retry-tooltip',
                <Message msgId="hydrata.anuga.retryTooltip" />,
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
            return withExecutableTooltip(
                'sv-scenario-run-tooltip',
                <Message msgId={isRerun ? 'hydrata.anuga.rerunTooltip' : 'hydrata.anuga.runTooltip'} />,
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
            {/* TASK-2239 (epic 2237 W1.1) — the run cluster: Build-and-Run,
                then the 4-state lifecycle slot, then Build. Three raised
                FILLED sv-* buttons with a small explicit gap (anuga.css
                `.sv-scenario-run-cluster`) — deliberately NOT an inset
                segmented pill/tab strip. */}
            <div className="sv-scenario-run-cluster">
                {canEdit && canRunScenario ?
                    withExecutableTooltip(
                        'sv-scenario-build-and-run-tooltip',
                        <React.Fragment>
                            <Message msgId="hydrata.anuga.buildAndRunTooltip" />
                            {estimateEcho(scenario)}
                        </React.Fragment>,
                        <Button
                            bsStyle={'primary'}
                            bsSize={'xsmall'}
                            className={btn('sv-scenario-action-build-run') + (lockBuildAndRun ? ' disabled' : '')}
                            disabled={lockBuildAndRun}
                            onClick={fireDebounced('buildAndRun', onBuildAndRunClick, 'anuga-scenario-menu-build-and-run')}
                        >
                            <Message msgId="hydrata.anuga.buildAndRun" />
                        </Button>
                    ) : null
                }
                {renderLifecycleSlot()}
                {canEdit ?
                    withExecutableTooltip(
                        'sv-scenario-build-tooltip',
                        <React.Fragment>
                            <Message msgId="hydrata.anuga.buildTooltip" />
                            {estimateEcho(scenario)}
                        </React.Fragment>,
                        <Button
                            bsStyle={'success'}
                            bsSize={'xsmall'}
                            className={btn('sv-scenario-action-build') + (lockBuild ? ' disabled' : '')}
                            disabled={lockBuild}
                            onClick={fireDebounced('build', onBuildClick, 'anuga-scenario-menu-build')}
                        >
                            <Message msgId="hydrata.anuga.build" />
                        </Button>
                    ) : null
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
            {/* TASK-2115 (C); repositioned TASK-2266 (epic 2237 W5, UAT
                re-aim finding 1) — View Results now renders immediately LEFT
                of Download (2nd-from-right), not leading the row: both are
                the strip's OUTLINE (safe/non-destructive read) actions and
                now sit adjacent, rather than View Results being separated
                from Download by the whole run cluster. Same classname +
                gate + handler as before; only JSX position changed. */}
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
    onConfirmCancelRun: PropTypes.func
};

ScenarioHeaderActions.defaultProps = {
    canEdit: false,
    canRunScenario: false,
    hasCompleteResults: false
};

// Pull intl messages off React legacy context so getMessageById can resolve
// the build-conflict info text at render time (same pattern as the toolbar).
ScenarioHeaderActions.contextTypes = {
    messages: PropTypes.object
};

export {ScenarioHeaderActions};
