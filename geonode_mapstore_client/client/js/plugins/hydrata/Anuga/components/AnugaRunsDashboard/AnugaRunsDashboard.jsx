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
 *
 * Layout (redesigned to match the Hydrata frontend, answering a PM's four
 * questions — what ran, when, trends, and what drives runtime/cost):
 *   hero + KPI overview band → filters toolbar → trends-over-time → drivers
 *   (triangles-vs-walltime, phase share, $/instance) → reliability → run
 *   ledger → the static CPU-vs-GPU benchmark showcase. See anugaRunsDashboard.css.
 */
import './anugaRunsDashboard.css';
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
import RunsKpiBand from './RunsKpiBand';
import RunsOverTime from './charts/RunsOverTime';
import TriVsWalltimeScatter from './charts/TriVsWalltimeScatter';
import PhaseBreakdown from './charts/PhaseBreakdown';
import CostPerRunChart from './charts/CostPerRunChart';
import SuccessRateChart from './charts/SuccessRateChart';
// TASK-1965 (W5.2) — curated CPU-vs-GPU benchmark corpus, always rendered
// (independent of the live ledger fetch above — see its own header comment
// for why the two data sources are kept separate).
import CpuVsGpuShowcase from './charts/CpuVsGpuShowcase';

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
    const ready = !loading && !error;

    return (
        <div className="anuga-runs-dashboard" data-testid="anuga-runs-dashboard">
            <header className="ard-hero">
                <div className="ard-hero__inner">
                    <span className="ard-hero__eyebrow">Staff · Compute observability</span>
                    <h1 className="ard-hero__title">ANUGA run actuals</h1>
                    <p className="ard-hero__subtitle">
                        Every hydraulic model run on AWS Batch — what ran, when, and what drives
                        runtime &amp; cost across CPU and GPU.
                    </p>
                    {ready && <RunsKpiBand records={filteredRecords} />}
                </div>
            </header>

            <div className="ard-toolbar-rail">
                <FiltersSidebar
                    serverFilters={serverFilters}
                    clientFilters={clientFilters}
                    onServerFilterChange={setServerFilters}
                    onClientFilterChange={setClientFilters}
                    records={records}
                />
            </div>

            <main className="ard-main">
                {loading && <div className="ard-state" data-testid="anuga-runs-loading">Loading run actuals…</div>}
                {!loading && error && (
                    <div className="ard-state ard-state--error" data-testid="anuga-runs-error">Failed to load run actuals.</div>
                )}
                {ready && filteredRecords.length === 0 && (
                    <div className="ard-state" data-testid="anuga-runs-empty">No runs match the current filters.</div>
                )}
                {ready && filteredRecords.length > 0 && (
                    <React.Fragment>
                        <section className="ard-section">
                            <h2 className="ard-section__title">Trends over time</h2>
                            <div className="ard-cards ard-cards--single">
                                <RunsOverTime records={filteredRecords} />
                            </div>
                        </section>

                        <section className="ard-section">
                            <h2 className="ard-section__title">What drives runtime</h2>
                            <div className="ard-cards">
                                <TriVsWalltimeScatter records={filteredRecords} />
                                <PhaseBreakdown records={filteredRecords} />
                            </div>
                        </section>

                        <section className="ard-section">
                            <h2 className="ard-section__title">Cost &amp; reliability</h2>
                            <div className="ard-cards">
                                <CostPerRunChart records={filteredRecords} />
                                <SuccessRateChart records={filteredRecords} />
                            </div>
                        </section>

                        <section className="ard-section">
                            <h2 className="ard-section__title">Run ledger</h2>
                            <div className="ard-card--table">
                                <RunsGrid records={filteredRecords} />
                            </div>
                        </section>
                    </React.Fragment>
                )}
            </main>

            <section className="ard-section--showcase">
                <CpuVsGpuShowcase />
            </section>
        </div>
    );
};

export default AnugaRunsDashboard;
