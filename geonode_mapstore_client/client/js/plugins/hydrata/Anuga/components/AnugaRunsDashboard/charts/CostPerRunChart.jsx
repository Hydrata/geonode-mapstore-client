/**
 * TASK-1964 (epic 1952 W5.1) — mean $/run by instance_type.
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { buildCostPerRunSeries } from '../runsDashboardUtils';

const CostPerRunChart = ({ records = [], width = 480, height = 300 }) => {
    const data = buildCostPerRunSeries(records);

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-cost-per-run">
            <h5>$/run by instance type</h5>
            {data.length === 0 ? (
                <p data-testid="anuga-chart-cost-per-run-empty">No cost data for the current filters.</p>
            ) : (
                <BarChart width={width} height={height} data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="instance_type" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="avg_cost_usd" name="Avg $/run" fill="#4c78a8" />
                </BarChart>
            )}
        </div>
    );
};

export default CostPerRunChart;
