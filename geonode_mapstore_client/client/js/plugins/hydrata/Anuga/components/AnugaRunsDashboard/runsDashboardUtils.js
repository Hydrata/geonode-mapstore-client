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
