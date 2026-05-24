/*
 * TASK-743 — ProcessRow DOM contract tests (P0, TASK-673 polling gate).
 *
 * ProcessRow.jsx is a plain presentational class taking only
 * `{process, expanded, onClick}` — NO redux, NO security lookup. These tests
 * render it through the shared `mountWithProviders` helper (AC2; the store is
 * unused by the component but keeps all 5 TASK-743 files consistent) and assert
 * its REAL observable contracts:
 *
 *   (a) returns null when `process` is falsy.
 *   (b) detailAsBadge = (status==='pending' && !!status_detail): the status
 *       badge shows the capitalized status_detail ('built' -> 'Built',
 *       'processing' -> 'Processing Results') INSTEAD of the i18n status text.
 *   (c) status==='running' && progress_pct != null -> a `.tm-progress-bar`
 *       renders with width set to `${progress_pct}%`.
 *   (d) the type icon maps via `typeIcons` (anuga_run -> glyphicon-flash;
 *       unknown type -> glyphicon-cog).
 *
 * NOTE on i18n: `mountWithProviders` provides no IntlProvider, so `<Message>`
 * falls back to rendering `<span>{msgId}</span>` (Message.jsx:36). That makes
 * the non-detail status badge text equal to the raw msgId
 * (e.g. 'hydrata.taskMonitor.statusRunning'), which is exactly what we assert
 * against to prove the detail branch substitutes a DIFFERENT, literal label.
 */
import expect from 'expect';
import React from 'react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import ProcessRow from '../ProcessRow';

const noop = () => {};

describe('TASK-743 ProcessRow DOM', () => {

    it('renders nothing (null) when process is falsy', () => {
        const { container } = mountWithProviders(
            <ProcessRow process={null} onClick={noop} />
        );
        expect(container.querySelector('.tm-process-row')).toNotExist();
        expect(container.innerHTML).toBe('');
    });

    it('shows the i18n status msgId in the badge when NOT in a pending detail sub-state', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 1, name: 'Run A', process_type: 'anuga_run', status: 'running' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.tm-badge');
        expect(badge).toExist();
        // No IntlProvider -> Message renders the raw msgId text.
        expect(badge.textContent).toBe('hydrata.taskMonitor.statusRunning');
        expect(badge.className).toContain('tm-badge-running');
    });

    it('detailAsBadge: capitalizes a plain status_detail ("built" -> "Built") in the badge for pending', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 2, name: 'Run B', process_type: 'anuga_run', status: 'pending', status_detail: 'built' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.tm-badge');
        expect(badge).toExist();
        expect(badge.textContent).toBe('Built');
        // It must NOT be the i18n status string in this sub-state.
        expect(badge.textContent).toNotInclude('hydrata.taskMonitor');
        expect(badge.className).toContain('tm-badge-pending');
        // And it is the BADGE, not the separate .tm-status-detail line.
        expect(container.querySelector('.tm-status-detail')).toNotExist();
    });

    it('detailAsBadge: maps the special "processing" detail to "Processing Results"', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 3, name: 'Run C', process_type: 'anuga_run', status: 'pending', status_detail: 'processing' }}
                onClick={noop}
            />
        );
        const badge = container.querySelector('.tm-badge');
        expect(badge.textContent).toBe('Processing Results');
    });

    it('renders status_detail as a separate .tm-status-detail line (NOT badge) when status is not pending', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 4, name: 'Run D', process_type: 'anuga_run', status: 'running', status_detail: 'evolving' }}
                onClick={noop}
            />
        );
        // Badge keeps the i18n status; the detail moves to its own line, capitalized.
        const badge = container.querySelector('.tm-badge');
        expect(badge.textContent).toBe('hydrata.taskMonitor.statusRunning');
        const detail = container.querySelector('.tm-status-detail');
        expect(detail).toExist();
        expect(detail.textContent).toBe('Evolving');
    });

    it('renders a .tm-progress-bar with the right width when running + progress_pct present', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 5, name: 'Run E', process_type: 'anuga_run', status: 'running', progress_pct: 42 }}
                onClick={noop}
            />
        );
        const bar = container.querySelector('.tm-progress-bar');
        expect(bar).toExist();
        expect(bar.style.width).toBe('42%');
    });

    it('renders NO progress bar when running but progress_pct is null/absent', () => {
        const { container } = mountWithProviders(
            <ProcessRow
                process={{ id: 6, name: 'Run F', process_type: 'anuga_run', status: 'running', progress_pct: null }}
                onClick={noop}
            />
        );
        expect(container.querySelector('.tm-progress-bar')).toNotExist();
    });

    it('maps a known process_type to its glyph (anuga_run -> glyphicon-flash) and unknown -> glyphicon-cog', () => {
        const known = mountWithProviders(
            <ProcessRow
                process={{ id: 7, name: 'Run G', process_type: 'anuga_run', status: 'complete' }}
                onClick={noop}
            />
        );
        const knownIcon = known.container.querySelector('.tm-type-icon');
        expect(knownIcon.className).toContain('glyphicon-flash');

        const unknown = mountWithProviders(
            <ProcessRow
                process={{ id: 8, name: 'Run H', process_type: 'totally_unknown_type', status: 'complete' }}
                onClick={noop}
            />
        );
        const unknownIcon = unknown.container.querySelector('.tm-type-icon');
        expect(unknownIcon.className).toContain('glyphicon-cog');
    });
});
