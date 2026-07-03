/**
 * TASK-1964 (epic 1952 W5) — overview KPI band for the /runs hero.
 *
 * Overview-first: six headline aggregates over whatever records are in view
 * (post-filter), so a PM reads run volume, spend, reliability, and the CPU/GPU
 * mix at a glance before touching the charts or the ledger. All figures come
 * from computeKpis (runsDashboardUtils) — no fetching here.
 */
import React from 'react';
import { computeKpis, formatUsd, formatInt, formatWalltime, formatPct } from './runsDashboardUtils';

const successClass = (rate) => {
    if (rate === null || rate === undefined) {
        return '';
    }
    if (rate >= 0.9) {
        return 'is-ok';
    }
    if (rate >= 0.7) {
        return 'is-warn';
    }
    return 'is-err';
};

const RunsKpiBand = ({ records = [] }) => {
    const k = computeKpis(records);
    return (
        <div className="ard-kpis" data-testid="anuga-runs-kpis">
            <div className="ard-kpi">
                <span className="ard-kpi__label">Runs</span>
                <span className="ard-kpi__value">{formatInt(k.total)}</span>
                <span className="ard-kpi__sub">in view</span>
            </div>
            <div className="ard-kpi">
                <span className="ard-kpi__label">Total spend</span>
                <span className="ard-kpi__value">{formatUsd(k.totalCost)}</span>
                <span className="ard-kpi__sub">on-demand</span>
            </div>
            <div className="ard-kpi">
                <span className="ard-kpi__label">Avg $/run</span>
                <span className="ard-kpi__value">{formatUsd(k.avgCost)}</span>
                <span className="ard-kpi__sub">per run</span>
            </div>
            <div className="ard-kpi">
                <span className="ard-kpi__label">Avg walltime</span>
                <span className="ard-kpi__value">{formatWalltime(k.avgWall)}</span>
                <span className="ard-kpi__sub">wall clock</span>
            </div>
            <div className={`ard-kpi ard-kpi--status ${successClass(k.successRate)}`}>
                <span className="ard-kpi__label">Success rate</span>
                <span className="ard-kpi__value">{formatPct(k.successRate)}</span>
                <span className="ard-kpi__sub">{k.failures} failed · {k.ooms} OOM</span>
            </div>
            <div className="ard-kpi ard-kpi--split">
                <span className="ard-kpi__label">CPU / GPU</span>
                <span className="ard-kpi__value">
                    <span className="ard-mode-cpu">{k.cpu}</span>
                    {' '}<span className="ard-kpi__slash">/</span>{' '}
                    <span className="ard-mode-gpu">{k.gpu}</span>
                </span>
                <span className="ard-kpi__sub">runs by mode</span>
            </div>
        </div>
    );
};

export default RunsKpiBand;
