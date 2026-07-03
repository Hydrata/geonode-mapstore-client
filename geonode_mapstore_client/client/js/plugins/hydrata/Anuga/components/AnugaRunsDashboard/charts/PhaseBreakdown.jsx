/**
 * TASK-1964 (epic 1952 W5) — where runtime goes (phase share).
 *
 * The PM asks "what drives runtime — triangles, duration, something else?".
 * Triangle count is one axis (the scatter); this is the other: WITHIN a run,
 * which pipeline phase eats the wall clock. Aggregates raw.observed
 * .phase_durations_s across the runs in view (buildPhaseBreakdown) as a share
 * of total runtime, so the evolve/solve dominance is obvious. Renders nothing
 * fabricated — runs predating phase instrumentation contribute no data, and
 * an all-uninstrumented view shows an honest empty state.
 */
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { buildPhaseBreakdown, formatWalltime } from '../runsDashboardUtils';

const PHASE_LABELS = {
    mesh_gen: 'Mesh gen',
    distribute: 'Distribute',
    evolve: 'Evolve (solve)',
    cog_export: 'COG export',
    archive: 'Archive'
};

// The dominant solve phase gets the strong navy; supporting phases a muted blue.
const phaseFill = (phase) => (phase === 'evolve' ? '#0c3756' : '#8fb4cf');

const PhaseBreakdown = ({ records = [], height = 260 }) => {
    const data = buildPhaseBreakdown(records).map((d) => ({ ...d, label: PHASE_LABELS[d.phase] || d.phase }));

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-phase-breakdown">
            <h5 className="anuga-runs-chart__title">Where runtime goes</h5>
            {data.length === 0 ? (
                <p className="anuga-runs-chart__empty" data-testid="anuga-chart-phase-breakdown-empty">
                    No phase instrumentation in the current runs.
                </p>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tickLine={false} axisLine={{ stroke: '#e6edf3' }} />
                        <YAxis type="category" dataKey="label" width={96} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value, name, entry) => [`${value}% · ${formatWalltime(entry.payload.seconds)}`, 'share of runtime']} />
                        <Bar dataKey="pct" name="share of runtime" radius={[0, 3, 3, 0]} maxBarSize={26} isAnimationActive={false}>
                            {data.map((d) => (<Cell key={d.phase} fill={phaseFill(d.phase)} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default PhaseBreakdown;
