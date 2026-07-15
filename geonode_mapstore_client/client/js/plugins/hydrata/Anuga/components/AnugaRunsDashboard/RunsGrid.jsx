/**
 * TASK-1964 (epic 1952 W5.1) — sortable runs grid for the /runs dashboard.
 *
 * Client-side sort only (the corpus is fully in memory after the
 * page_size=500 fetch) — clicking a column header toggles asc/desc on that
 * field. Columns intentionally mix native ledger columns (instance_type,
 * wall_s) with derived serializer fields (mode, triangle_count, cost_usd,
 * run_status) — both come back on the same record, see
 * AdminRunResourceRecordSerializer.
 */
import React, { useMemo, useState } from 'react';

const COLUMNS = [
    { key: 'run_id', label: 'Run' },
    { key: 'mode', label: 'Mode' },
    // TASK-2195 (epic 2190 W2) — the flat compute target the run was
    // dispatched to ('local' | 'batch-x4' | 'batch-x32' | 'batch-gpu-a10g');
    // null for historical rows (pre-2190) renders as '—', never fabricated.
    // These target-labelled rows are the calibration corpus for later
    // target-aware estimates.
    { key: 'compute_target', label: 'Target' },
    { key: 'instance_type', label: 'Instance' },
    { key: 'region', label: 'Region' },
    { key: 'triangle_count', label: 'Triangles' },
    { key: 'wall_s', label: 'Wall (s)' },
    { key: 'predicted_wall_s', label: 'Pred wall (s)' },
    { key: 'cost_usd', label: '$/run' },
    { key: 'predicted_usd', label: 'Pred $/run' },
    { key: 'run_status', label: 'Status' },
    // TASK-2285 (epic 2280 W2) — durable per-run code provenance. `code` renders
    // the per-component GitHub deep-links (run_anuga / anuga_core / hydrata);
    // `provenance` renders the 3-state honesty badge. Both are DERIVED from the
    // AdminRunResourceRecordSerializer's code_provenance / provenance_complete
    // fields — there is no record[key] for them, renderCell special-cases both.
    { key: 'code', label: 'Code' },
    { key: 'provenance', label: 'Provenance' },
    { key: 'date', label: 'Date' }
];

const NUM_KEYS = ['triangle_count', 'wall_s', 'predicted_wall_s', 'cost_usd', 'predicted_usd'];

// TASK-2285 — the three code components a run is pinned to. Order is the
// dispatch → engine → app stack (run_anuga drives, anuga_core solves, hydrata
// orchestrates). Each maps to code_provenance[comp] = {git_url, sha, github_url}.
const PROVENANCE_COMPONENTS = ['run_anuga', 'anuga_core', 'hydrata'];

// Short git sha for link text — the serializer already derived github_url
// server-side (pure fn of git_url+sha); the FE only truncates for display.
const shortSha = (sha) => (sha ? String(sha).slice(0, 8) : '');

// 3-STATE provenance honesty badge (AC6 fail-loud + the W1 adversarial-review
// refinement). Keyed on provenance_source so a green badge NEVER vouches for a
// best-effort dispatch stamp — the dispatch fallback bakes fork-default git_urls
// that are known-wrong for a GPU run until the container self-report lands, so
// it is AMBER even when every sha is present. Precedence matters: dispatch is
// checked before completeness so a "complete" dispatch row still reads amber.
const provenanceBadge = (record) => {
    const cp = record.code_provenance;
    if (!cp) {
        return { cls: 'is-err', label: 'none' };
    }
    if (cp.provenance_source === 'dispatch') {
        return { cls: 'is-warn', label: 'best-effort' };
    }
    const authoritative = cp.provenance_source === 'container'
        || cp.provenance_source === 'local'
        || cp.provenance_source === 'backfill';
    if (authoritative && record.provenance_complete === true) {
        return { cls: 'is-ok', label: 'verified' };
    }
    // legacy source, provenance_complete=false, or any unknown source -> honest RED.
    return { cls: 'is-err', label: 'incomplete' };
};

const formatCell = (key, value) => {
    if (value === null || value === undefined) {
        return '—';
    }
    if (key === 'cost_usd' || key === 'predicted_usd') {
        return `$${Number(value).toFixed(2)}`;
    }
    if (key === 'triangle_count' || key === 'wall_s' || key === 'predicted_wall_s') {
        return Number(value).toLocaleString();
    }
    if (key === 'date') {
        return String(value).slice(0, 19).replace('T', ' ');
    }
    return value;
};

// complete = the sole success status; failed/oom/error read as failures; any
// other transient status (created/running) reads as pending.
const statusPillClass = (status) => {
    if (status === 'complete') {
        return 'is-ok';
    }
    if (status === 'failed' || status === 'oom' || status === 'error') {
        return 'is-err';
    }
    return 'is-warn';
};

const cellClassName = (key) => {
    if (NUM_KEYS.includes(key)) {
        return 'ard-num';
    }
    if (key === 'run_id') {
        return 'ard-mono';
    }
    return '';
};

// TASK-2285 — per-component GitHub deep-links. A present github_url renders as
// an <a target="_blank" rel="noopener"> whose text is the component short-name +
// truncated sha; a null github_url renders as a plain dash (never a broken
// link). No code_provenance at all renders a single em-dash.
const renderProvenanceLinks = (record) => {
    const cp = record.code_provenance;
    if (!cp) {
        return '—';
    }
    return (
        <span className="ard-prov-links" data-testid="ard-prov-links">
            {PROVENANCE_COMPONENTS.map((comp) => {
                const info = cp[comp] || {};
                const text = info.sha ? `${comp} ${shortSha(info.sha)}` : comp;
                return info.github_url
                    ? (
                        <a
                            key={comp}
                            className="ard-prov-link"
                            href={info.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`ard-prov-link-${comp}`}
                        >{text}</a>
                    )
                    : (
                        <span
                            key={comp}
                            className="ard-prov-link ard-prov-link--missing"
                            data-testid={`ard-prov-dash-${comp}`}
                        >{comp} —</span>
                    );
            })}
        </span>
    );
};

// Mode → blue/green chip; status → coloured pill; run_id falls back to the
// Batch job_id so a run without a resolved Run FK still shows an identifier;
// code/provenance are the TASK-2285 derived provenance columns.
const renderCell = (key, value, record) => {
    if (key === 'mode' && value) {
        return <span className={`ard-chip ard-chip--${value === 'gpu' ? 'gpu' : 'cpu'}`}>{String(value).toUpperCase()}</span>;
    }
    if (key === 'run_status' && value) {
        return <span className={`ard-pill ${statusPillClass(value)}`}>{value}</span>;
    }
    if (key === 'code') {
        return renderProvenanceLinks(record);
    }
    if (key === 'provenance') {
        const badge = provenanceBadge(record);
        return <span className={`ard-pill ${badge.cls}`} data-testid="ard-prov-badge">{badge.label}</span>;
    }
    if (key === 'run_id') {
        return value || record.job_id || '—';
    }
    return formatCell(key, value);
};

const compareValues = (a, b) => {
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }
    return String(a).localeCompare(String(b));
};

const RunsGrid = ({ records = [] }) => {
    const [sort, setSort] = useState({ field: 'date', dir: 'desc' });

    const sorted = useMemo(() => {
        const copy = [...(records || [])];
        copy.sort((a, b) => {
            const cmp = compareValues(a[sort.field], b[sort.field]);
            return sort.dir === 'asc' ? cmp : -cmp;
        });
        return copy;
    }, [records, sort]);

    const toggleSort = (field) => {
        setSort((prev) => (
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        ));
    };

    return (
        <table className="anuga-runs-grid" data-testid="anuga-runs-grid">
            <thead>
                <tr>
                    {COLUMNS.map((col) => (
                        <th
                            key={col.key}
                            className={cellClassName(col.key)}
                            data-testid={`anuga-runs-grid-header-${col.key}`}
                            onClick={() => toggleSort(col.key)}
                            style={{ cursor: 'pointer' }}
                        >
                            {col.label}{sort.field === col.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {sorted.map((record) => (
                    <tr key={record.id} data-testid="anuga-runs-grid-row">
                        {COLUMNS.map((col) => (
                            <td key={col.key} className={cellClassName(col.key)}>{renderCell(col.key, record[col.key], record)}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default RunsGrid;
