/*
 * TASK-743 / TASK-1665 — ProcessRow DOM contract tests (P0, TASK-673 polling gate).
 *
 * ProcessRow.jsx is a plain presentational class taking only
 * `{process, expanded, onClick}` — NO redux, NO security lookup. These tests
 * render it through the shared `mountWithProviders` helper and assert
 * its REAL observable contracts:
 *
 *   (a) returns null when `process` is falsy.
 *   (b) detailAsBadge = (status==='pending' && !!status_detail): the status
 *       badge shows the capitalized status_detail ('built' -> 'Built',
 *       'processing' -> 'Processing Results') INSTEAD of the status text.
 *   (c) status==='running' && progress_pct != null -> a `.sv-progress-track`
 *       renders (ProgressBar primitive — previously `.tm-progress-bar`).
 *   (d) the type icon maps via `typeIcons` (anuga_run -> glyphicon-flash;
 *       unknown type -> glyphicon-cog).
 *
 * TASK-1665 migration: class names changed from tm-* to sv-tm-*; status badge
 * changed from hand-rolled tm-badge-* to StatusBadge primitive (.sv-status-badge).
 * The detailAsBadge and status_detail behaviours are structurally preserved.
 *
 * TASK-2674 (epic 2662 W2.4): the FE clock-staleness heuristic is DELETED.
 * Liveness/phase/ETA/wedged arrive from the serializer and are rendered
 * verbatim — asserted in the server-truth describe block below.
 */
import expect from 'expect';
import React from 'react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ProcessRow, { formatEtaSeconds } from '../ProcessRow';

const noop = () => {};

describe('TASK-743 ProcessRow DOM', () => {

    it('renders nothing (null) when process is falsy', () => {
        const { container } = mountWithProviders(
            <ProcessRow process={null} onClick={noop} />
        );
        expect(container.querySelector('.sv-tm-process-row')).toNotExist();
        expect(container.innerHTML).toBe('');
    });

    it('shows the i18n status label in the badge when NOT in a pending detail sub-state (TASK-1679)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 1, name: 'Run A', process_type: 'anuga_run', status: 'running' }}
                onClick={noop}
            />
        );
        // TASK-1665: badge is now .sv-status-badge (StatusBadge primitive)
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist();
        // TASK-1679 named proof: the badge label is wired through the i18n
        // mechanism (getMessageById) — NOT StatusBadge's raw-status fallback.
        // mountWithProviders supplies no catalogue entry for this key, so
        // getMessageById returns the msgId unchanged, proving the label flows
        // through i18n. The legacy regression rendered the bare key 'running'.
        expect(badge.textContent).toBe('hydrata.taskMonitor.statusRunning');
        expect(badge.textContent).toNotEqual('running');
        expect(badge.className).toContain('is-running');
    });

    it('maps each status to its statusMsgId i18n key in the badge (TASK-1679)', () => {
        const cases = [
            { status: 'running', key: 'hydrata.taskMonitor.statusRunning' },
            { status: 'pending', key: 'hydrata.taskMonitor.statusPending' },
            { status: 'complete', key: 'hydrata.taskMonitor.statusComplete' },
            { status: 'error', key: 'hydrata.taskMonitor.statusError' },
            { status: 'cancelled', key: 'hydrata.taskMonitor.statusCancelled' }
        ];
        cases.forEach(({ status, key }) => {
            const { container } = mountWithProviders(
                <ProcessRow
                    process={{ id: status, name: 'Run', process_type: 'anuga_run', status }}
                    onClick={noop}
                />
            );
            const badge = container.querySelector('.sv-status-badge');
            expect(badge).toExist();
            expect(badge.textContent).toBe(key);
        });
    });

    it('detailAsBadge: capitalizes a plain status_detail ("built" -> "Built") in the badge for pending', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 2, name: 'Run B', process_type: 'anuga_run', status: 'pending', status_detail: 'built' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist();
        // StatusBadge receives label="Built" (formatStatusDetail result)
        expect(badge.textContent).toInclude('Built');
        // It must NOT be the raw status string
        expect(badge.textContent).toNotInclude('pending');
        // And it is the BADGE, not the separate .sv-tm-status-detail line.
        expect(container.querySelector('.sv-tm-status-detail')).toNotExist();
    });

    it('detailAsBadge: maps the special "processing" detail to "Processing Results"', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 3, name: 'Run C', process_type: 'anuga_run', status: 'pending', status_detail: 'processing' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('Processing Results');
    });

    it('renders status_detail as a separate .sv-tm-status-detail line (NOT badge) when status is not pending', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 4, name: 'Run D', process_type: 'anuga_run', status: 'running', status_detail: 'evolving' }}
                onClick={noop}
            />
        );
        // Badge keeps the status; the detail moves to its own line, capitalized.
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist();
        const detail = container.querySelector('.sv-tm-status-detail');
        expect(detail).toExist();
        expect(detail.textContent).toBe('Evolving');
    });

    it('renders a .sv-progress-track (ProgressBar primitive) with right width when running + progress_pct present', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 5, name: 'Run E', process_type: 'anuga_run', status: 'running', progress_pct: 42 }}
                onClick={noop}
            />
        );
        // TASK-1665: ProgressBar primitive → .sv-progress-track + .sv-progress-fill
        const track = container.querySelector('.sv-progress-track');
        expect(track).toExist();
        const fill = container.querySelector('.sv-progress-fill');
        expect(fill).toExist();
        expect(fill.style.width).toBe('42%');
    });

    it('renders NO progress bar when running but progress_pct is null/absent', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 6, name: 'Run F', process_type: 'anuga_run', status: 'running', progress_pct: null }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-progress-track')).toNotExist();
    });

    it('maps a known process_type to its glyph (anuga_run -> glyphicon-flash) and unknown -> glyphicon-cog', () => {
        const known = mountWithProviders(
            <ProcessRow
                process={{ id: 7, name: 'Run G', process_type: 'anuga_run', status: 'complete' }}
                onClick={noop}
            />
        );
        // TASK-1665: icon class changed to sv-tm-type-icon
        const knownIcon = known.container.querySelector('.sv-tm-type-icon');
        expect(knownIcon.className).toContain('glyphicon-flash');

        const unknown = mountWithProviders(
            <ProcessRow
                process={{ id: 8, name: 'Run H', process_type: 'totally_unknown_type', status: 'complete' }}
                onClick={noop}
            />
        );
        const unknownIcon = unknown.container.querySelector('.sv-tm-type-icon');
        expect(unknownIcon.className).toContain('glyphicon-cog');
    });
});

// ============================================================================
// TASK-2674 (epic 2662 W2.4) — ProcessRow renders SERVER truth verbatim:
// liveness drives the stalled/unresponsive/provisioning badges, phase and
// eta_seconds render as their own elements, wedged is advisory-only display.
// The FE never derives liveness (clock heuristic deleted) — proven by feeding
// timestamps that would have inverted every verdict under the old heuristic.
// ============================================================================

describe('TASK-2674 ProcessRow server-truth liveness', () => {
    // Under the deleted heuristic: ancient => "stalled", fresh => "running".
    // Server liveness must now win in BOTH directions.
    const ancientUpdated = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const freshUpdated = new Date(Date.now() - 5000).toISOString();

    it('liveness=stalled shows the stalled badge even with a FRESH updated (server wins)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 1, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'stalled', updated: freshUpdated }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist();
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusStalled');
        expect(badge.textContent).toNotInclude('hydrata.taskMonitor.statusRunning');
    });

    it('liveness=live keeps the Running badge + progress bar even with an ANCIENT updated (the epic-2662 bug: healthy long runs were flagged stalled)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 2, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', progress_pct: 50, updated: ancientUpdated }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusRunning');
        expect(container.querySelector('.sv-progress-track')).toExist();
    });

    it('liveness=stalled suppresses the progress bar (mid-bar on a stuck process is misleading)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 3, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'stalled', progress_pct: 50 }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-progress-track')).toNotExist();
    });

    it('liveness=zombie-candidate shows the unresponsive badge and no progress bar', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 4, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'zombie-candidate', progress_pct: 50 }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusUnresponsive');
        expect(container.querySelector('.sv-progress-track')).toNotExist();
    });

    it('provisioning exemption: running + liveness=provisioning + no progress shows the Provisioning badge — never stalled — regardless of age', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 5, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'provisioning', progress_pct: null, updated: ancientUpdated }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusProvisioning');
        expect(badge.textContent).toNotInclude('hydrata.taskMonitor.statusStalled');
    });

    it('provisioning with progress_pct present falls back to the status badge (celery types never heartbeat but ARE working)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 6, name: 'Upload', process_type: 'layer_create', status: 'running', liveness: 'provisioning', progress_pct: 40 }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusRunning');
        expect(container.querySelector('.sv-progress-track')).toExist();
    });

    it('pending detail sub-state still wins over provisioning (existing detailAsBadge contract)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 7, name: 'Run', process_type: 'anuga_run', status: 'pending', status_detail: 'built', liveness: 'provisioning' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('Built');
        expect(badge.textContent).toNotInclude('statusProvisioning');
    });

    it('no liveness field (synthetic FE rows / terminal rows) renders the plain status badge', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 8, name: 'Export', process_type: 'terrain_export', status: 'running', updated: ancientUpdated }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusRunning');
    });
});

describe('TASK-2674 ProcessRow phase / ETA / wedged rendering', () => {
    it('renders the server phase as its own .sv-tm-phase line (capitalized) for a non-terminal row', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 1, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', phase: 'evolve' }}
                onClick={noop}
            />
        );
        const phase = container.querySelector('.sv-tm-phase');
        expect(phase).toExist();
        expect(phase.textContent).toInclude('Evolve');
    });

    it('does NOT render .sv-tm-phase on terminal rows (a frozen last phase is noise)', () => {
        ['complete', 'error', 'cancelled'].forEach(status => {
            const { container } = mountWithProviders(
                <ProcessRow
                    process={{ id: status, name: 'Run', process_type: 'anuga_run', status, phase: 'evolve' }}
                    onClick={noop}
                />
            );
            expect(container.querySelector('.sv-tm-phase')).toNotExist();
        });
    });

    it('does NOT render .sv-tm-phase when phase is null/absent', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 2, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', phase: null }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-phase')).toNotExist();
    });

    it('renders the server eta_seconds as .sv-tm-eta alongside the progress bar', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 3, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', progress_pct: 40, eta_seconds: 200 }}
                onClick={noop}
            />
        );
        const eta = container.querySelector('.sv-tm-eta');
        expect(eta).toExist();
        expect(eta.textContent).toInclude('3m 20s');
    });

    it('no .sv-tm-eta when eta_seconds is null/absent', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 4, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', progress_pct: 40, eta_seconds: null }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-eta')).toNotExist();
    });

    it('no .sv-tm-eta when the progress bar is suppressed (stalled row with a leftover eta)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 5, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'stalled', progress_pct: 40, eta_seconds: 200 }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-eta')).toNotExist();
    });

    it('wedged=true renders the .sv-tm-wedged-advisory hint WITHOUT changing the badge (ADVISORY-ONLY, D5)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 6, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', wedged: true }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-wedged-advisory')).toExist();
        const badge = container.querySelector('.sv-status-badge');
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusRunning');
    });

    it('wedged=false/absent renders no advisory hint', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 7, name: 'Run', process_type: 'anuga_run', status: 'running', liveness: 'live', wedged: false }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-wedged-advisory')).toNotExist();
    });

    it('formatEtaSeconds formats seconds / minutes / hours and rejects junk', () => {
        expect(formatEtaSeconds(45)).toBe('45s');
        expect(formatEtaSeconds(200)).toBe('3m 20s');
        expect(formatEtaSeconds(3600)).toBe('1h 0m');
        expect(formatEtaSeconds(4530)).toBe('1h 15m');
        expect(formatEtaSeconds(0)).toBe('0s');
        expect(formatEtaSeconds(-5)).toBe(null);
        expect(formatEtaSeconds(null)).toBe(null);
        expect(formatEtaSeconds(undefined)).toBe(null);
        expect(formatEtaSeconds('soon')).toBe(null);
        expect(formatEtaSeconds(NaN)).toBe(null);
    });
});

describe('TASK-1887 ProcessRow error snippet (retained behaviour)', () => {
    const freshUpdated = new Date(Date.now() - 30000).toISOString();

    it('complete/error/cancelled rows never render a progress bar', () => {
        ['complete', 'error', 'cancelled'].forEach(status => {
            const { container } = mountWithProviders(
                <ProcessRow
                    process={{ id: status, name: 'P', process_type: 'terrain_create', status, progress_pct: 80, updated: freshUpdated }}
                    onClick={noop}
                />
            );
            expect(container.querySelector('.sv-progress-track')).toNotExist();
        });
    });

    it('collapsed error row shows truncated error_message in .sv-tm-error-message', () => {
        const errorMsg = 'watchdog: terrain upload abandoned (upload not finalized — finalize step never ran)';
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 10, name: 'Upload', process_type: 'terrain_create', status: 'error', error_message: errorMsg, updated: freshUpdated }}
                expanded={false}
                onClick={noop}
            />
        );
        const snippet = container.querySelector('.sv-tm-error-message');
        expect(snippet).toExist();
        // Snippet text should start with the error message (possibly truncated).
        expect(snippet.textContent).toInclude('watchdog');
    });

    it('non-error collapsed row shows NO .sv-tm-error-message', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 11, name: 'Run', process_type: 'anuga_run', status: 'running', updated: freshUpdated }}
                expanded={false}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-tm-error-message')).toNotExist();
    });

    it('expanded error row does NOT render inline .sv-tm-error-message (full ProcessDetail shows it)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 12, name: 'Upload', process_type: 'terrain_create', status: 'error', error_message: 'oops', updated: freshUpdated }}
                expanded
                onClick={noop}
            />
        );
        // When expanded, ProcessDetail shows the full message — the collapsed snippet is hidden.
        expect(container.querySelector('.sv-tm-error-message')).toNotExist();
    });
});
