/**
 * TASK-1964 (epic 1952 W5.1) — /runs dashboard filters sidebar.
 *
 * Two groups of controls, mirroring the server/client filter split (see
 * runsDashboardUtils.js):
 *   - server-driven: project_id, instance_type, region, spot, oom_flag,
 *     partial, date_from, date_to. Changing one of these re-fetches the
 *     ledger (onServerFilterChange -> parent issues a new GET).
 *   - client-driven: mode (cpu/gpu), run_status, mesh-size band. These are
 *     DERIVED serializer fields, filtered in-memory over the last fetch
 *     (onClientFilterChange -> parent re-derives `filteredRecords`).
 *
 * Select options for the server-driven text-ish fields (instance_type,
 * region) are derived from the currently loaded corpus rather than a
 * separate distinct-values endpoint (none exists) — good enough for a
 * corpus this size (single page_size=500 fetch).
 */
import React from 'react';
import { TRIANGLE_BANDS } from './runsDashboardUtils';

const distinctValues = (records, key) =>
    Array.from(new Set((records || []).map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== ''))).sort();

const FiltersSidebar = ({
    serverFilters = {},
    clientFilters = {},
    onServerFilterChange = () => {},
    onClientFilterChange = () => {},
    records = []
}) => {
    const instanceTypes = distinctValues(records, 'instance_type');
    const regions = distinctValues(records, 'region');
    const runStatuses = distinctValues(records, 'run_status');

    const setServer = (key, value) => {
        onServerFilterChange({ ...serverFilters, [key]: value === '' ? undefined : value });
    };
    const setClient = (key, value) => {
        onClientFilterChange({ ...clientFilters, [key]: value });
    };

    return (
        <div className="anuga-runs-filters" data-testid="anuga-runs-filters">
            <h4>Filter runs</h4>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-mode">Mode</label>
                <select
                    id="anuga-runs-filter-mode"
                    data-testid="anuga-runs-filter-mode"
                    value={clientFilters.mode || 'all'}
                    onChange={(e) => setClient('mode', e.target.value)}
                >
                    <option value="all">All</option>
                    <option value="cpu">CPU</option>
                    <option value="gpu">GPU</option>
                </select>
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-status">Run status</label>
                <select
                    id="anuga-runs-filter-status"
                    data-testid="anuga-runs-filter-status"
                    value={clientFilters.runStatus || 'all'}
                    onChange={(e) => setClient('runStatus', e.target.value)}
                >
                    <option value="all">All</option>
                    {runStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-band">Mesh size</label>
                <select
                    id="anuga-runs-filter-band"
                    data-testid="anuga-runs-filter-band"
                    value={clientFilters.band || 'all'}
                    onChange={(e) => setClient('band', e.target.value)}
                >
                    <option value="all">All</option>
                    {TRIANGLE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-instance-type">Instance type</label>
                <select
                    id="anuga-runs-filter-instance-type"
                    data-testid="anuga-runs-filter-instance-type"
                    value={serverFilters.instance_type || ''}
                    onChange={(e) => setServer('instance_type', e.target.value)}
                >
                    <option value="">All</option>
                    {instanceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-region">Region</label>
                <select
                    id="anuga-runs-filter-region"
                    data-testid="anuga-runs-filter-region"
                    value={serverFilters.region || ''}
                    onChange={(e) => setServer('region', e.target.value)}
                >
                    <option value="">All</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-project">Project ID</label>
                <input
                    id="anuga-runs-filter-project"
                    data-testid="anuga-runs-filter-project"
                    type="text"
                    placeholder="any"
                    value={serverFilters.project_id || ''}
                    onChange={(e) => setServer('project_id', e.target.value)}
                />
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-date-from">Date from</label>
                <input
                    id="anuga-runs-filter-date-from"
                    data-testid="anuga-runs-filter-date-from"
                    type="date"
                    value={serverFilters.date_from ? serverFilters.date_from.slice(0, 10) : ''}
                    onChange={(e) => setServer('date_from', e.target.value ? `${e.target.value}T00:00:00Z` : '')}
                />
            </div>

            <div className="ard-field">
                <label htmlFor="anuga-runs-filter-date-to">Date to</label>
                <input
                    id="anuga-runs-filter-date-to"
                    data-testid="anuga-runs-filter-date-to"
                    type="date"
                    value={serverFilters.date_to ? serverFilters.date_to.slice(0, 10) : ''}
                    onChange={(e) => setServer('date_to', e.target.value ? `${e.target.value}T23:59:59Z` : '')}
                />
            </div>

            <label className="ard-check" htmlFor="anuga-runs-filter-spot">
                <input
                    id="anuga-runs-filter-spot"
                    data-testid="anuga-runs-filter-spot"
                    type="checkbox"
                    checked={serverFilters.spot === true}
                    onChange={(e) => setServer('spot', e.target.checked ? true : undefined)}
                />
                Spot only
            </label>

            <label className="ard-check" htmlFor="anuga-runs-filter-oom">
                <input
                    id="anuga-runs-filter-oom"
                    data-testid="anuga-runs-filter-oom"
                    type="checkbox"
                    checked={serverFilters.oom_flag === true}
                    onChange={(e) => setServer('oom_flag', e.target.checked ? true : undefined)}
                />
                OOM only
            </label>
        </div>
    );
};

export default FiltersSidebar;
