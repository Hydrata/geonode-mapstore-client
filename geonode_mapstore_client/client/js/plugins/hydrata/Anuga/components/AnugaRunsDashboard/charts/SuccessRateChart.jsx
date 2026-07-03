/**
 * TASK-1964 (epic 1952 W5.1) — success rate (run_status === 'complete') by mode.
 */
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { buildSuccessRateSeries, MODE_COLORS, MODE_LABELS } from '../runsDashboardUtils';

const toPct = (rate) => Math.round(rate * 1000) / 10;

const SuccessRateChart = ({ records = [], height = 260 }) => {
    const data = buildSuccessRateSeries(records).map((g) => ({
        ...g,
        rate_pct: toPct(g.rate),
        label: MODE_LABELS[g.mode] || g.mode
    }));

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-success-rate">
            <h5 className="anuga-runs-chart__title">Success rate by mode</h5>
            {data.length === 0 ? (
                <p className="anuga-runs-chart__empty" data-testid="anuga-chart-success-rate-empty">No runs for the current filters.</p>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e6edf3' }} />
                        <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={40} />
                        <Tooltip formatter={(value, name, entry) => [`${value}%  (${entry.payload.success}/${entry.payload.total})`, 'success']} />
                        <Bar dataKey="rate_pct" name="Success %" radius={[3, 3, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                            {data.map((d) => (<Cell key={d.mode} fill={MODE_COLORS[d.mode] || '#397aab'} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default SuccessRateChart;
