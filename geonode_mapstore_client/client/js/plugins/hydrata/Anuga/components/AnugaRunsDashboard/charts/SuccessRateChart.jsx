/**
 * TASK-1964 (epic 1952 W5.1) — success rate (run_status === 'complete') by mode.
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { buildSuccessRateSeries } from '../runsDashboardUtils';

const toPct = (rate) => Math.round(rate * 1000) / 10;

const SuccessRateChart = ({ records = [], width = 420, height = 300 }) => {
    const data = buildSuccessRateSeries(records).map((g) => ({ ...g, rate_pct: toPct(g.rate) }));

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-success-rate">
            <h5>Success rate by mode</h5>
            {data.length === 0 ? (
                <p data-testid="anuga-chart-success-rate-empty">No runs for the current filters.</p>
            ) : (
                <BarChart width={width} height={height} data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mode" />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="rate_pct" name="Success %" fill="#54a24b" />
                </BarChart>
            )}
        </div>
    );
};

export default SuccessRateChart;
