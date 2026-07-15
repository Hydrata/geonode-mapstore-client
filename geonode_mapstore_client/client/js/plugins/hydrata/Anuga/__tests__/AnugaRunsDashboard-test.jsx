/**
 * TASK-1964/1965 (epic 1952 W5) — /runs staff dashboard + CPU-vs-GPU showcase.
 *
 * Covers:
 *   - runsDashboardUtils pure helpers (server/client filter split, chart
 *     aggregators) — no DOM, no network.
 *   - the client-side staff gate (b): a resolved non-staff user is denied
 *     and never fires the ledger fetch.
 *   - the runs grid renders rows from a mocked API payload.
 *   - a filter narrows BOTH the grid and (by construction, since they share
 *     the same filteredRecords) the charts.
 *   - >=3 chart types render plus the CPU-vs-GPU benchmark showcase, and the
 *     showcase still renders when the ledger returns 0 rows (empty-state).
 *
 * axios is mocked via axios-mock-adapter against the SAME ajax singleton
 * anugaApi.js imports (same relative depth as api/anugaApi.js — see
 * anugaApi-test.js for the precedent), so mocking it here intercepts the
 * calls listAdminRunLedger() makes.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import MockAdapter from 'axios-mock-adapter';

import axios from '../../../../../MapStore2/web/client/libs/ajax';
import AnugaRunsDashboard from '../components/AnugaRunsDashboard';
import {
    deriveTriangleBand,
    applyClientFilters,
    buildServerParams,
    buildTriVsWalltimeSeries,
    buildCostPerRunSeries,
    buildSuccessRateSeries,
    isStaffUser,
    SERVER_FILTER_KEYS
} from '../components/AnugaRunsDashboard/runsDashboardUtils';

const LEDGER_URL = '/api/v2/anuga/admin/runs/';

// TASK-2195 — compute_target mirrors the AdminRunResourceRecordSerializer
// surface: a flat target for post-2190 rows, null for HISTORICAL rows (r3/r4)
// which must render as '—' in the grid, never a fabricated value.
const FIXTURE_RECORDS = [
    {
        id: 'r1', run_id: 'run-1', tool: 'anuga',
        instance_type: 'g6e.2xlarge', region: 'us-east-1',
        mode: 'gpu', triangle_count: 8160000, wall_s: 19965,
        cost_usd: 12.43, run_status: 'complete', date: '2026-07-02T10:00:00Z',
        compute_target: 'batch-gpu-a10g'
    },
    {
        id: 'r2', run_id: 'run-2', tool: 'anuga',
        instance_type: 'r7a.8xlarge', region: 'us-east-1',
        mode: 'cpu', triangle_count: 8160000, wall_s: 31150,
        cost_usd: 20.9, run_status: 'complete', date: '2026-07-01T09:00:00Z',
        compute_target: 'batch-x32'
    },
    {
        id: 'r3', run_id: 'run-3', tool: 'anuga',
        instance_type: 'g5.xlarge', region: 'us-west-2',
        mode: 'gpu', triangle_count: 256688, wall_s: 9996,
        cost_usd: 2.79, run_status: 'failed', date: '2026-06-30T08:00:00Z',
        compute_target: null
    },
    {
        id: 'r4', run_id: 'run-4', tool: 'anuga',
        instance_type: 'g4dn.xlarge', region: 'us-west-2',
        mode: 'gpu', triangle_count: 50000, wall_s: 500,
        cost_usd: 0.5, run_status: 'oom', date: '2026-06-29T08:00:00Z'
    }
];

describe('runsDashboardUtils (pure helpers)', () => {
    it('deriveTriangleBand buckets by the documented boundaries', () => {
        expect(deriveTriangleBand(undefined)).toBe('unknown');
        expect(deriveTriangleBand(null)).toBe('unknown');
        expect(deriveTriangleBand(50000)).toBe('<100K');
        expect(deriveTriangleBand(256688)).toBe('100K-1M');
        expect(deriveTriangleBand(4350000)).toBe('1M-5M');
        expect(deriveTriangleBand(8160000)).toBe('5M+');
    });

    it('applyClientFilters filters on the DERIVED fields (mode/run_status/band)', () => {
        const gpuOnly = applyClientFilters(FIXTURE_RECORDS, { mode: 'gpu', runStatus: 'all', band: 'all' });
        expect(gpuOnly.length).toBe(3);
        expect(gpuOnly.every((r) => r.mode === 'gpu')).toBe(true);

        const completeOnly = applyClientFilters(FIXTURE_RECORDS, { mode: 'all', runStatus: 'complete', band: 'all' });
        expect(completeOnly.length).toBe(2);

        const bigMesh = applyClientFilters(FIXTURE_RECORDS, { mode: 'all', runStatus: 'all', band: '5M+' });
        expect(bigMesh.length).toBe(2);
    });

    it('applyClientFilters is a no-op with default (all/all/all) filters', () => {
        expect(applyClientFilters(FIXTURE_RECORDS, { mode: 'all', runStatus: 'all', band: 'all' }).length)
            .toBe(FIXTURE_RECORDS.length);
    });

    it('buildServerParams only forwards NATIVE (server-filterable) keys, never mode/runStatus/band', () => {
        const params = buildServerParams({
            project_id: 42, instance_type: 'g6e.2xlarge', mode: 'gpu', runStatus: 'complete', band: '5M+'
        });
        expect(params.project_id).toBe(42);
        expect(params.instance_type).toBe('g6e.2xlarge');
        expect(params.mode).toBe(undefined);
        expect(params.runStatus).toBe(undefined);
        expect(params.band).toBe(undefined);
        expect(params.page_size).toBe(500);
        expect(SERVER_FILTER_KEYS.includes('mode')).toBe(false);
    });

    it('buildTriVsWalltimeSeries drops records missing triangle_count or wall_s', () => {
        const series = buildTriVsWalltimeSeries([
            ...FIXTURE_RECORDS,
            { id: 'r5', triangle_count: null, wall_s: 100, mode: 'cpu' }
        ]);
        expect(series.length).toBe(FIXTURE_RECORDS.length);
    });

    it('buildCostPerRunSeries averages cost_usd per instance_type', () => {
        const series = buildCostPerRunSeries([
            { instance_type: 'a', cost_usd: 10 },
            { instance_type: 'a', cost_usd: 20 },
            { instance_type: 'b', cost_usd: 5 }
        ]);
        const a = series.find((s) => s.instance_type === 'a');
        expect(a.avg_cost_usd).toBe(15);
        expect(a.count).toBe(2);
    });

    it('buildSuccessRateSeries treats only run_status=complete as success', () => {
        const series = buildSuccessRateSeries(FIXTURE_RECORDS);
        const gpu = series.find((s) => s.mode === 'gpu');
        const cpu = series.find((s) => s.mode === 'cpu');
        // gpu: run-1 complete, run-3 failed, run-4 oom -> 1/3
        expect(gpu.total).toBe(3);
        expect(gpu.success).toBe(1);
        // cpu: run-2 complete -> 1/1
        expect(cpu.total).toBe(1);
        expect(cpu.success).toBe(1);
    });

    it('isStaffUser is true for is_staff OR is_superuser, false otherwise', () => {
        expect(isStaffUser({ is_staff: true })).toBe(true);
        expect(isStaffUser({ is_superuser: true })).toBe(true);
        expect(isStaffUser({ is_staff: false, is_superuser: false })).toBe(false);
        expect(isStaffUser(null)).toBe(false);
        expect(isStaffUser(undefined)).toBe(false);
    });
});

describe('AnugaRunsDashboard (component)', () => {
    let host;
    let mockAxios;

    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        mockAxios = new MockAdapter(axios);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(host);
        host.parentNode && host.parentNode.removeChild(host);
        mockAxios.restore();
    });

    it('denies a resolved non-staff user and never calls the ledger API', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(
            <AnugaRunsDashboard user={{ is_staff: false, is_superuser: false }} />,
            host
        );

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-runs-denied"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-runs-dashboard"]')).toBe(null);
            expect(mockAxios.history.get.length).toBe(0);
            done();
        }, 10);
    });

    it('renders grid rows from a mocked API payload for a staff user', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-runs-dashboard"]')).toExist();
            const rows = host.querySelectorAll('[data-testid="anuga-runs-grid-row"]');
            expect(rows.length).toBe(FIXTURE_RECORDS.length);
            expect(mockAxios.history.get.length).toBe(1);
            done();
        }, 10);
    });

    // TASK-2195 (epic 2190 W2) — compute_target column: values verbatim for
    // target-labelled rows (the calibration corpus), '—' for historical
    // null/absent rows (never fabricated).
    it('renders a Target column with compute_target verbatim and em-dash for historical nulls (TASK-2195)', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            const header = host.querySelector('[data-testid="anuga-runs-grid-header-compute_target"]');
            expect(header).toExist();
            expect(header.textContent).toInclude('Target');
            // Column index of compute_target in the rendered table.
            const headers = Array.from(host.querySelectorAll('[data-testid^="anuga-runs-grid-header-"]'));
            const colIdx = headers.indexOf(header);
            const cellsByRunId = {};
            Array.from(host.querySelectorAll('[data-testid="anuga-runs-grid-row"]')).forEach((row) => {
                const cells = row.querySelectorAll('td');
                cellsByRunId[cells[0].textContent] = cells[colIdx].textContent;
            });
            expect(cellsByRunId['run-1']).toBe('batch-gpu-a10g');
            expect(cellsByRunId['run-2']).toBe('batch-x32');
            // null AND absent both render the em-dash placeholder.
            expect(cellsByRunId['run-3']).toBe('—');
            expect(cellsByRunId['run-4']).toBe('—');
            done();
        }, 10);
    });

    it('a client-side filter narrows both the grid and the chart panels', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelectorAll('[data-testid="anuga-runs-grid-row"]').length).toBe(4);

            const modeSelect = host.querySelector('[data-testid="anuga-runs-filter-mode"]');
            expect(modeSelect).toExist();
            modeSelect.value = 'gpu';
            TestUtils.Simulate.change(modeSelect);

            setTimeout(() => {
                // 3 of the 4 fixture records are mode='gpu'.
                expect(host.querySelectorAll('[data-testid="anuga-runs-grid-row"]').length).toBe(3);
                // the charts re-derive from the same filteredRecords, so they
                // stay mounted (not the empty-state) with the narrowed set.
                expect(host.querySelector('[data-testid="anuga-runs-empty"]')).toBe(null);
                done();
            }, 10);
        }, 10);
    });

    it('renders >=3 chart types plus the CPU-vs-GPU benchmark showcase', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-chart-tri-vs-walltime"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-chart-cost-per-run"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-chart-success-rate"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-cpu-vs-gpu-showcase"]')).toExist();
            // the showcase is scenario data, not the ledger — assert its own
            // provenance banner + comparison table rendered too.
            expect(host.querySelector('[data-testid="anuga-benchmark-provenance"]')).toExist();
            expect(host.querySelectorAll('[data-testid="anuga-benchmark-row"]').length).toBeGreaterThan(0);
            done();
        }, 10);
    });

    it('empty-state: the showcase still renders when the live ledger returns 0 rows', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: 0, results: [] });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-runs-empty"]')).toExist();
            expect(host.querySelectorAll('[data-testid="anuga-runs-grid-row"]').length).toBe(0);
            // the benchmark snapshot is independent of the ledger fetch.
            expect(host.querySelector('[data-testid="anuga-cpu-vs-gpu-showcase"]')).toExist();
            expect(host.querySelectorAll('[data-testid="anuga-benchmark-row"]').length).toBeGreaterThan(0);
            done();
        }, 10);
    });

    // TASK-2285 (epic 2280 W2) — per-component GitHub deep-links + the 3-state
    // provenance honesty badge. Each case renders a SINGLE-record ledger so the
    // provenance cell is unambiguous. Asserts on DOM structure/attrs (href,
    // badge class/text) — never computed colour — because the dashboard CSS is
    // namespaced under .msgapi (specificity ties make karma blind to colour).
    describe('TASK-2285 code-provenance render', () => {
        // (a) container self-report, complete: 3 real links (fork AND upstream
        // both render as the fixture gives them) + GREEN "verified" badge.
        it('renders 3 GitHub links with the fixture hrefs + a green verified badge for a complete container row', (done) => {
            const record = {
                id: 'cp1', run_id: 'run-cp1', mode: 'gpu', run_status: 'complete',
                date: '2026-07-02T10:00:00Z',
                provenance_complete: true,
                code_provenance: {
                    provenance_source: 'container',
                    run_anuga: {
                        git_url: 'https://github.com/Hydrata/run_anuga', sha: '189b171abcdef',
                        github_url: 'https://github.com/Hydrata/run_anuga/tree/189b171abcdef'
                    },
                    anuga_core: {
                        git_url: 'https://github.com/anuga-community/anuga_core', sha: '57a64abf00000',
                        github_url: 'https://github.com/anuga-community/anuga_core/tree/57a64abf00000'
                    },
                    hydrata: {
                        git_url: 'https://github.com/Hydrata/hydrata', sha: '83cd5b7aaaaaa',
                        github_url: 'https://github.com/Hydrata/hydrata/tree/83cd5b7aaaaaa'
                    }
                }
            };
            mockAxios.onGet(LEDGER_URL).reply(200, { count: 1, results: [record] });
            ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

            setTimeout(() => {
                const ra = host.querySelector('[data-testid="ard-prov-link-run_anuga"]');
                const ac = host.querySelector('[data-testid="ard-prov-link-anuga_core"]');
                const hy = host.querySelector('[data-testid="ard-prov-link-hydrata"]');
                expect(ra).toExist();
                expect(ac).toExist();
                expect(hy).toExist();
                // exact hrefs come straight from the serializer's github_url.
                expect(ra.getAttribute('href')).toBe('https://github.com/Hydrata/run_anuga/tree/189b171abcdef');
                // fork (Hydrata) AND upstream (anuga-community) both resolve.
                expect(ac.getAttribute('href')).toBe('https://github.com/anuga-community/anuga_core/tree/57a64abf00000');
                expect(hy.getAttribute('href')).toInclude('github.com/Hydrata/hydrata');
                // new-tab safety.
                expect(ra.getAttribute('target')).toBe('_blank');
                expect(ra.getAttribute('rel')).toInclude('noopener');
                // link text = component + truncated (8-char) sha.
                expect(ra.textContent).toBe('run_anuga 189b171a');
                // GREEN verified badge.
                const badge = host.querySelector('[data-testid="ard-prov-badge"]');
                expect(badge).toExist();
                expect(badge.className).toInclude('is-ok');
                expect(badge.textContent).toBe('verified');
                done();
            }, 10);
        });

        // (b) dispatch fallback, all shas present: AMBER "best-effort", never
        // green — the dispatch stamp bakes fork-default git_urls that are
        // known-wrong until the container self-report lands.
        it('renders an amber best-effort badge (never green) for a dispatch row even with every sha present', (done) => {
            const record = {
                id: 'cp2', run_id: 'run-cp2', mode: 'gpu', run_status: 'complete',
                date: '2026-07-02T10:00:00Z',
                provenance_complete: true,
                code_provenance: {
                    provenance_source: 'dispatch',
                    run_anuga: { git_url: 'https://github.com/Hydrata/run_anuga', sha: 'aaaaaaaa11', github_url: 'https://github.com/Hydrata/run_anuga/tree/aaaaaaaa11' },
                    anuga_core: { git_url: 'https://github.com/Hydrata/anuga_core', sha: 'bbbbbbbb22', github_url: 'https://github.com/Hydrata/anuga_core/tree/bbbbbbbb22' },
                    hydrata: { git_url: 'https://github.com/Hydrata/hydrata', sha: 'cccccccc33', github_url: 'https://github.com/Hydrata/hydrata/tree/cccccccc33' }
                }
            };
            mockAxios.onGet(LEDGER_URL).reply(200, { count: 1, results: [record] });
            ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

            setTimeout(() => {
                const badge = host.querySelector('[data-testid="ard-prov-badge"]');
                expect(badge).toExist();
                expect(badge.className).toInclude('is-warn');
                expect(badge.className).toNotInclude('is-ok');
                expect(badge.textContent).toBe('best-effort');
                // links still render (dispatch shas are present here).
                expect(host.querySelector('[data-testid="ard-prov-link-run_anuga"]')).toExist();
                done();
            }, 10);
        });

        // (c) legacy / incomplete: RED badge; a null github_url renders a dash
        // with NO anchor (never a broken link).
        it('renders a red incomplete badge + a dash (no anchor) for a null github_url on an incomplete legacy row', (done) => {
            const record = {
                id: 'cp3', run_id: 'run-cp3', mode: 'cpu', run_status: 'complete',
                date: '2026-07-02T10:00:00Z',
                provenance_complete: false,
                code_provenance: {
                    provenance_source: 'legacy',
                    run_anuga: { git_url: 'https://github.com/Hydrata/run_anuga', sha: 'dddddddd44', github_url: 'https://github.com/Hydrata/run_anuga/tree/dddddddd44' },
                    anuga_core: { git_url: null, sha: null, github_url: null },
                    hydrata: { git_url: 'https://github.com/Hydrata/hydrata', sha: 'eeeeeeee55', github_url: 'https://github.com/Hydrata/hydrata/tree/eeeeeeee55' }
                }
            };
            mockAxios.onGet(LEDGER_URL).reply(200, { count: 1, results: [record] });
            ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

            setTimeout(() => {
                const badge = host.querySelector('[data-testid="ard-prov-badge"]');
                expect(badge).toExist();
                expect(badge.className).toInclude('is-err');
                expect(badge.textContent).toBe('incomplete');
                // anuga_core has a null github_url -> a dash span, NOT an anchor.
                expect(host.querySelector('[data-testid="ard-prov-link-anuga_core"]')).toBe(null);
                const dash = host.querySelector('[data-testid="ard-prov-dash-anuga_core"]');
                expect(dash).toExist();
                expect(dash.tagName.toLowerCase()).toNotBe('a');
                expect(dash.textContent).toInclude('—');
                // the other two components still render as real links.
                expect(host.querySelector('[data-testid="ard-prov-link-run_anuga"]')).toExist();
                expect(host.querySelector('[data-testid="ard-prov-link-hydrata"]')).toExist();
                done();
            }, 10);
        });
    });
});
