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
 * TASK-1887: staleness guard (stalled badge + no progress bar + inline error
 * snippet) asserted in the describe block below.
 */
import expect from 'expect';
import React from 'react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ProcessRow from '../ProcessRow';
import { STALE_MS } from '../../selectorsTaskMonitor';

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
// TASK-1887 — staleness guard (stalled badge, no progress bar, error snippet)
// ============================================================================

describe('TASK-1887 ProcessRow staleness', () => {
    const noop = () => {};
    // Stale timestamp: older than STALE_MS so isStale() returns true.
    const staleUpdated = new Date(Date.now() - STALE_MS - 60000).toISOString();
    // Fresh timestamp: well within STALE_MS.
    const freshUpdated = new Date(Date.now() - 30000).toISOString();

    it('stale running row shows no progress bar', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 1, name: 'Upload', process_type: 'terrain_create', status: 'running', progress_pct: 50, updated: staleUpdated }}
                onClick={noop}
            />
        );
        // AC-3: showProgress false for stale running → no progress bar
        expect(container.querySelector('.sv-progress-track')).toNotExist();
    });

    it('fresh running row still shows progress bar', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 2, name: 'Upload', process_type: 'terrain_create', status: 'running', progress_pct: 50, updated: freshUpdated }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.sv-progress-track')).toExist();
    });

    it('stale running row shows a stalled badge (distinct i18n key)', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 3, name: 'Upload', process_type: 'terrain_create', status: 'running', updated: staleUpdated }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.sv-status-badge');
        expect(badge).toExist();
        // The badge resolves via getMessageById with STALLED_MSG_ID
        // (no catalogue in test → returns the msgId unchanged — named proof).
        expect(badge.textContent).toInclude('hydrata.taskMonitor.statusStalled');
        // Must NOT be the standard running key
        expect(badge.textContent).toNotInclude('hydrata.taskMonitor.statusRunning');
    });

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
                expanded={true}
                onClick={noop}
            />
        );
        // When expanded, ProcessDetail shows the full message — the collapsed snippet is hidden.
        expect(container.querySelector('.sv-tm-error-message')).toNotExist();
    });
});
