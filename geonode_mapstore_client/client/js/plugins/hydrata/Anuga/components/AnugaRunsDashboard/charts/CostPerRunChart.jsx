/**
 * TASK-1964 (epic 1952 W5.1) — mean $/run by instance_type.
 */
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { buildCostPerRunSeries } from '../runsDashboardUtils';

const CostPerRunChart = ({ records = [], height = 260 }) => {
    const data = buildCostPerRunSeries(records);

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-cost-per-run">
            <h5 className="anuga-runs-chart__title">Avg $/run by instance type</h5>
            {data.length === 0 ? (
                <p className="anuga-runs-chart__empty" data-testid="anuga-chart-cost-per-run-empty">No cost data for the current filters.</p>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" vertical={false} />
                        <XAxis dataKey="instance_type" interval={0} angle={-25} textAnchor="end" height={52} tickLine={false} axisLine={{ stroke: '#e6edf3' }} />
                        <YAxis tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} width={44} />
                        <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'avg $/run']} />
                        <Bar dataKey="avg_cost_usd" name="Avg $/run" fill="#397aab" radius={[3, 3, 0, 0]} maxBarSize={46} isAnimationActive={false} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default CostPerRunChart;
