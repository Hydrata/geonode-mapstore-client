/**
 * TASK-1964 (epic 1952 W5.1) — staff run-actuals dashboard.
 *
 * Pure, framework-free helpers for the /runs dashboard. Kept separate from
 * the React tree so they're trivial to unit test and reuse across the grid
 * and the chart panels.
 *
 * Server vs client filtering split (see AdminRunResourceRecordSerializer,
 * RunLedgerFilterSet in apps/gn_anuga/api_v2.py, W4/TASK-1962):
 *   - project_id / instance_type / region / date_from / date_to / spot /
 *     oom_flag / partial are NATIVE ledger columns -> server query params
 *     (buildServerParams).
 *   - mode / run_status / triangle-count band are DERIVED serializer
 *     fields, not server-filterable -> applied client-side over whatever
 *     the last fetch returned (applyClientFilters).
 */

// Native, server-filterable keys (RunLedgerFilterSet.Meta.fields + date_from/to).
export const SERVER_FILTER_KEYS = [
    'project_id', 'instance_type', 'region', 'scenario_id', 'run_id',
    'capture_source', 'spot', 'oom_flag', 'partial', 'date_from', 'date_to'
];

/**
 * Strip empty/undefined values and merge in the fixed pagination + ordering
 * params. `?page_size=500` pulls the whole (small) corpus in one request
 * per the API contract (max_page_size=500).
 */
export const buildServerParams = (serverFilters = {}, { ordering = '-recorded_at' } = {}) => {
    const params = { page_size: 500, ordering };
    SERVER_FILTER_KEYS.forEach((key) => {
        const value = serverFilters[key];
        if (value !== undefined && value !== null && value !== '') {
            params[key] = value;
        }
    });
    return params;
};

// Mesh-size bands over the derived `triangle_count` field. Boundaries chosen
// to separate the towradgi benchmark scale (~257K) from the Hydrata prod
// scale (4.35M/8.16M) — see comparison.csv.
export const TRIANGLE_BANDS = ['<100K', '100K-1M', '1M-5M', '5M+'];

export const deriveTriangleBand = (triangleCount) => {
    if (triangleCount === null || triangleCount === undefined || Number.isNaN(triangleCount)) {
        return 'unknown';
    }
    if (triangleCount < 100000) {
        return '<100K';
    }
    if (triangleCount < 1000000) {
        return '100K-1M';
    }
    if (triangleCount < 5000000) {
        return '1M-5M';
    }
    return '5M+';
};

const DEFAULT_CLIENT_FILTERS = { mode: 'all', runStatus: 'all', band: 'all' };

export const getDefaultClientFilters = () => ({ ...DEFAULT_CLIENT_FILTERS });

/**
 * Client-side pass over the (already server-filtered) records for the
 * derived fields the API cannot filter on. Any filter left at 'all' is a
 * no-op, so an empty/default filters object returns `records` unchanged.
 */
export const applyClientFilters = (records = [], clientFilters = {}) => {
    const { mode = 'all', runStatus = 'all', band = 'all' } = clientFilters;
    return (records || []).filter((record) => {
        if (mode !== 'all' && record.mode !== mode) {
            return false;
        }
        if (runStatus !== 'all' && record.run_status !== runStatus) {
            return false;
        }
        if (band !== 'all' && deriveTriangleBand(record.triangle_count) !== band) {
            return false;
        }
        return true;
    });
};

// -- Chart-data aggregators -------------------------------------------------

/** One point per record with both a triangle count and a wall time. */
export const buildTriVsWalltimeSeries = (records = []) =>
    (records || [])
        .filter((r) => r.triangle_count !== null && r.triangle_count !== undefined && r.wall_s !== null && r.wall_s !== undefined)
        .map((r) => ({
            id: r.id,
            triangle_count: r.triangle_count,
            wall_s: r.wall_s,
            mode: r.mode || 'cpu'
        }));

/** Mean $/run grouped by instance_type (nulls excluded from the mean). */
export const buildCostPerRunSeries = (records = []) => {
    const groups = {};
    (records || []).forEach((r) => {
        if (r.cost_usd === null || r.cost_usd === undefined) {
            return;
        }
        const key = r.instance_type || 'unknown';
        if (!groups[key]) {
            groups[key] = { instance_type: key, total: 0, count: 0 };
        }
        groups[key].total += r.cost_usd;
        groups[key].count += 1;
    });
    return Object.values(groups)
        .map((g) => ({ instance_type: g.instance_type, avg_cost_usd: g.total / g.count, count: g.count }))
        .sort((a, b) => b.avg_cost_usd - a.avg_cost_usd);
};

/** Success rate grouped by mode (cpu/gpu). 'complete' is the sole success status. */
export const buildSuccessRateSeries = (records = []) => {
    const groups = {};
    (records || []).forEach((r) => {
        const key = r.mode || 'cpu';
        if (!groups[key]) {
            groups[key] = { mode: key, total: 0, success: 0 };
        }
        groups[key].total += 1;
        if (r.run_status === 'complete') {
            groups[key].success += 1;
        }
    });
    return Object.values(groups).map((g) => ({
        mode: g.mode,
        total: g.total,
        success: g.success,
        rate: g.total ? g.success / g.total : 0
    }));
};

export const isStaffUser = (user) => !!(user && (user.is_staff || user.is_superuser));

// -- Shared presentation tokens --------------------------------------------
// The CPU/GPU duality is the dashboard's visual spine: CPU = Hydrata brand
// blue (the baseline), GPU = Hydrata green (the accelerated path). Every place
// the two modes appear (KPI split, scatter, over-time bars, ledger pills) reuses
// these exact colours so the eye reads "blue = CPU, green = GPU" everywhere.
export const MODE_COLORS = { cpu: '#3a7ca5', gpu: '#2fa84f' };
export const MODE_LABELS = { cpu: 'CPU', gpu: 'GPU' };

// -- Formatters (shared by KPI band, grid, tooltips) -----------------------
export const formatUsd = (v, dp = 2) =>
    (v === null || v === undefined || Number.isNaN(Number(v))) ? '—' : `$${Number(v).toFixed(dp)}`;

export const formatInt = (v) =>
    (v === null || v === undefined || Number.isNaN(Number(v))) ? '—' : Number(v).toLocaleString();

/** Human wall-clock: 42s / 6m 12s / 5h 7m. */
export const formatWalltime = (s) => {
    if (s === null || s === undefined || Number.isNaN(Number(s))) {
        return '—';
    }
    const sec = Math.round(Number(s));
    if (sec < 60) {
        return `${sec}s`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) {
        return `${h}h ${m}m`;
    }
    return `${m}m ${sec % 60}s`;
};

export const formatPct = (rate) =>
    (rate === null || rate === undefined || Number.isNaN(Number(rate))) ? '—' : `${Math.round(rate * 1000) / 10}%`;

// -- Overview KPIs ----------------------------------------------------------
/** Headline aggregates for the hero band, over whatever records are in view. */
export const computeKpis = (records = []) => {
    const rs = records || [];
    const total = rs.length;
    const costs = rs.map((r) => r.cost_usd).filter((v) => typeof v === 'number');
    const walls = rs.map((r) => r.wall_s).filter((v) => typeof v === 'number');
    const totalCost = costs.reduce((a, b) => a + b, 0);
    const complete = rs.filter((r) => r.run_status === 'complete').length;
    const gpu = rs.filter((r) => r.mode === 'gpu').length;
    return {
        total,
        totalCost,
        avgCost: costs.length ? totalCost / costs.length : null,
        avgWall: walls.length ? walls.reduce((a, b) => a + b, 0) / walls.length : null,
        successRate: total ? complete / total : null,
        gpu,
        cpu: total - gpu,
        failures: rs.filter((r) => r.run_status && r.run_status !== 'complete').length,
        ooms: rs.filter((r) => r.oom_flag).length
    };
};

// -- Trends over time -------------------------------------------------------
/**
 * Daily buckets over the `date` (recorded_at) field: run count split by mode
 * plus summed $/run per day. Answers "trends in runs over time" — bars for
 * volume (cpu/gpu stack), a line for daily spend.
 */
export const buildRunsOverTimeSeries = (records = []) => {
    const byDay = {};
    (records || []).forEach((r) => {
        const ts = r.date || r.started_at || r.finished_at;
        if (!ts) {
            return;
        }
        const day = String(ts).slice(0, 10);
        if (!byDay[day]) {
            byDay[day] = { day, runs: 0, cpu: 0, gpu: 0, cost_usd: 0 };
        }
        byDay[day].runs += 1;
        byDay[day][r.mode === 'gpu' ? 'gpu' : 'cpu'] += 1;
        if (typeof r.cost_usd === 'number') {
            byDay[day].cost_usd += r.cost_usd;
        }
    });
    return Object.values(byDay)
        .map((d) => ({ ...d, cost_usd: Math.round(d.cost_usd * 100) / 100 }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
};

// -- Phase breakdown (where runtime goes) -----------------------------------
// Canonical ANUGA run pipeline order; the solve ("evolve") dominates.
export const PHASE_ORDER = ['mesh_gen', 'distribute', 'evolve', 'cog_export', 'archive'];

/**
 * Aggregate per-phase seconds (raw.observed.phase_durations_s) across the
 * records that carry instrumentation, as a share of total runtime. Returns []
 * when no run in view has phase data (pre-instrumentation runs — never faked).
 * Sorted by seconds desc so the dominant phase reads first.
 */
export const buildPhaseBreakdown = (records = []) => {
    const totals = {};
    let any = false;
    (records || []).forEach((r) => {
        const p = r.phase_durations_s;
        if (!p || typeof p !== 'object') {
            return;
        }
        any = true;
        Object.keys(p).forEach((k) => {
            const v = Number(p[k]);
            if (!Number.isNaN(v)) {
                totals[k] = (totals[k] || 0) + v;
            }
        });
    });
    if (!any) {
        return [];
    }
    const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.keys(totals)
        .map((phase) => ({ phase, seconds: totals[phase], pct: Math.round((totals[phase] / grand) * 1000) / 10 }))
        .sort((a, b) => b.seconds - a.seconds);
};
