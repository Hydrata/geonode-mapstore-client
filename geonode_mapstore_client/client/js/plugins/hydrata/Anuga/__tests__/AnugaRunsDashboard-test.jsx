/**
 * TASK-1964 (epic 1952 W5.1) — /runs staff run-actuals dashboard.
 * (Extended by a follow-up commit for TASK-1965's CPU-vs-GPU showcase.)
 *
 * Covers:
 *   - runsDashboardUtils pure helpers (server/client filter split, chart
 *     aggregators) — no DOM, no network.
 *   - the client-side staff gate (b): a resolved non-staff user is denied
 *     and never fires the ledger fetch.
 *   - the runs grid renders rows from a mocked API payload.
 *   - a filter narrows BOTH the grid and (by construction, since they share
 *     the same filteredRecords) the charts.
 *   - >=3 chart types render (tri-vs-walltime scatter, $/run, success-rate),
 *     and the dashboard renders gracefully when the ledger returns 0 rows.
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

const FIXTURE_RECORDS = [
    {
        id: 'r1', run_id: 'run-1', tool: 'anuga',
        instance_type: 'g6e.2xlarge', region: 'us-east-1',
        mode: 'gpu', triangle_count: 8160000, wall_s: 19965,
        cost_usd: 12.43, run_status: 'complete', date: '2026-07-02T10:00:00Z'
    },
    {
        id: 'r2', run_id: 'run-2', tool: 'anuga',
        instance_type: 'r7a.8xlarge', region: 'us-east-1',
        mode: 'cpu', triangle_count: 8160000, wall_s: 31150,
        cost_usd: 20.9, run_status: 'complete', date: '2026-07-01T09:00:00Z'
    },
    {
        id: 'r3', run_id: 'run-3', tool: 'anuga',
        instance_type: 'g5.xlarge', region: 'us-west-2',
        mode: 'gpu', triangle_count: 256688, wall_s: 9996,
        cost_usd: 2.79, run_status: 'failed', date: '2026-06-30T08:00:00Z'
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

    it('renders >=3 chart types (tri-vs-walltime, $/run, success-rate)', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: FIXTURE_RECORDS.length, results: FIXTURE_RECORDS });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-chart-tri-vs-walltime"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-chart-cost-per-run"]')).toExist();
            expect(host.querySelector('[data-testid="anuga-chart-success-rate"]')).toExist();
            done();
        }, 10);
    });

    it('empty-state: renders gracefully when the live ledger returns 0 rows', (done) => {
        mockAxios.onGet(LEDGER_URL).reply(200, { count: 0, results: [] });

        ReactDOM.render(<AnugaRunsDashboard user={{ is_staff: true }} />, host);

        setTimeout(() => {
            expect(host.querySelector('[data-testid="anuga-runs-empty"]')).toExist();
            expect(host.querySelectorAll('[data-testid="anuga-runs-grid-row"]').length).toBe(0);
            done();
        }, 10);
    });
});
