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
    { key: 'instance_type', label: 'Instance' },
    { key: 'region', label: 'Region' },
    { key: 'triangle_count', label: 'Triangles' },
    { key: 'wall_s', label: 'Wall (s)' },
    { key: 'cost_usd', label: '$/run' },
    { key: 'run_status', label: 'Status' },
    { key: 'date', label: 'Date' }
];

const NUM_KEYS = ['triangle_count', 'wall_s', 'cost_usd'];

const formatCell = (key, value) => {
    if (value === null || value === undefined) {
        return '—';
    }
    if (key === 'cost_usd') {
        return `$${Number(value).toFixed(2)}`;
    }
    if (key === 'triangle_count' || key === 'wall_s') {
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

// Mode → blue/green chip; status → coloured pill; run_id falls back to the
// Batch job_id so a run without a resolved Run FK still shows an identifier.
const renderCell = (key, value, record) => {
    if (key === 'mode' && value) {
        return <span className={`ard-chip ard-chip--${value === 'gpu' ? 'gpu' : 'cpu'}`}>{String(value).toUpperCase()}</span>;
    }
    if (key === 'run_status' && value) {
        return <span className={`ard-pill ${statusPillClass(value)}`}>{value}</span>;
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
