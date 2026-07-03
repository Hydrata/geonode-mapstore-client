/**
 * TASK-1964 (epic 1952 W5.1) — staff-only run-actuals dashboard, mounted at
 * /runs (see geonode_mapstore_client/views.py::runs_dashboard,
 * templates/geonode-mapstore-client/pages/runs.html, js/apps/gn-runs.jsx).
 *
 * Triple-defended staff gate (per the epic brief):
 *   (a) server-side: the Django view is wrapped in staff_member_required
 *       (redirects non-staff before this bundle even loads);
 *   (b) client-side: this component re-checks `user` (passed down from
 *       gn-runs.jsx's getAccountInfo() call) and renders a denial message
 *       instead of fetching/rendering the ledger for a non-staff user —
 *       belt-and-braces in case the page is ever reached some other way;
 *   (c) the API itself (/api/v2/anuga/admin/runs/) is IsAdminUser — a
 *       non-staff fetch 401/403s regardless of (a)/(b).
 *
 * `user` is optional: when the caller can't/hasn't resolved it yet (undefined)
 * we render the dashboard rather than block on it — the server gate (a) and
 * API gate (c) still hold. `null` (resolved, anonymous) or a non-staff user
 * object trips the client gate (b).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { listAdminRunLedger } from '../../api/anugaApi';
import {
    applyClientFilters,
    buildServerParams,
    getDefaultClientFilters,
    isStaffUser
} from './runsDashboardUtils';
import FiltersSidebar from './FiltersSidebar';
import RunsGrid from './RunsGrid';
import TriVsWalltimeScatter from './charts/TriVsWalltimeScatter';
import CostPerRunChart from './charts/CostPerRunChart';
import SuccessRateChart from './charts/SuccessRateChart';
// CpuVsGpuShowcase (TASK-1965, curated benchmark corpus) is wired in below —
// see the follow-up commit that adds charts/CpuVsGpuShowcase.jsx.

const AnugaRunsDashboard = ({ user }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serverFilters, setServerFilters] = useState({});
    const [clientFilters, setClientFilters] = useState(getDefaultClientFilters());

    const denied = user !== undefined && user !== null && !isStaffUser(user);

    const fetchRuns = useCallback((filters) => {
        setLoading(true);
        setError(null);
        return listAdminRunLedger(buildServerParams(filters))
            .then((response) => {
                const data = response && response.data;
                setRecords((data && data.results) || []);
                setLoading(false);
            })
            .catch((err) => {
                setError(err);
                setRecords([]);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (denied) {
            return;
        }
        fetchRuns(serverFilters);
        // Only re-fetch when the server-driven filters change (client-only
        // filters are applied in-memory below, no re-fetch needed).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [denied, serverFilters]);

    if (denied) {
        return (
            <div className="anuga-runs-dashboard anuga-runs-dashboard--denied" data-testid="anuga-runs-denied">
                <h2>Staff access required</h2>
                <p>The run-actuals dashboard is restricted to staff accounts.</p>
            </div>
        );
    }

    const filteredRecords = applyClientFilters(records, clientFilters);

    return (
        <div className="anuga-runs-dashboard" data-testid="anuga-runs-dashboard">
            <h1>ANUGA run actuals</h1>
            <div className="anuga-runs-dashboard__body">
                <FiltersSidebar
                    serverFilters={serverFilters}
                    clientFilters={clientFilters}
                    onServerFilterChange={setServerFilters}
                    onClientFilterChange={setClientFilters}
                    records={records}
                />
                <div className="anuga-runs-dashboard__main">
                    {loading && <div data-testid="anuga-runs-loading">Loading run actuals…</div>}
                    {!loading && error && (
                        <div data-testid="anuga-runs-error">Failed to load run actuals.</div>
                    )}
                    {!loading && !error && filteredRecords.length === 0 && (
                        <div data-testid="anuga-runs-empty">No runs match the current filters.</div>
                    )}
                    {!loading && !error && (
                        <React.Fragment>
                            <RunsGrid records={filteredRecords} />
                            <div className="anuga-runs-dashboard__charts">
                                <TriVsWalltimeScatter records={filteredRecords} />
                                <CostPerRunChart records={filteredRecords} />
                                <SuccessRateChart records={filteredRecords} />
                            </div>
                        </React.Fragment>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnugaRunsDashboard;
