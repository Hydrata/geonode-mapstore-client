/**
 * TASK-1964 (epic 1952 W5) — runs & spend over time.
 *
 * Answers the PM's "trends in runs over time" question, which the first cut of
 * the dashboard had no view for. Daily buckets (buildRunsOverTimeSeries):
 * stacked bars for run volume split CPU/GPU (the blue↔green spine) on the left
 * axis, a navy line for daily spend on the right axis. Fluid width via
 * ResponsiveContainer so it fills the full-width trends row at any viewport.
 */
import React from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { buildRunsOverTimeSeries, MODE_COLORS } from '../runsDashboardUtils';

const RunsOverTime = ({ records = [], height = 260 }) => {
    const data = buildRunsOverTimeSeries(records);

    return (
        <div className="anuga-runs-chart anuga-runs-chart--wide" data-testid="anuga-chart-runs-over-time">
            <h5 className="anuga-runs-chart__title">Runs &amp; spend over time</h5>
            {data.length === 0 ? (
                <p className="anuga-runs-chart__empty" data-testid="anuga-chart-runs-over-time-empty">
                    No dated runs for the current filters.
                </p>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: '#e6edf3' }} />
                        <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                            formatter={(value, name) => (name === 'Daily $' ? [`$${Number(value).toFixed(2)}`, name] : [value, name])}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="cpu" name="CPU runs" stackId="mode" fill={MODE_COLORS.cpu} maxBarSize={54} isAnimationActive={false} />
                        <Bar yAxisId="left" dataKey="gpu" name="GPU runs" stackId="mode" fill={MODE_COLORS.gpu} radius={[3, 3, 0, 0]} maxBarSize={54} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cost_usd" name="Daily $" stroke="#0c3756" strokeWidth={2} dot={{ r: 3, fill: '#0c3756' }} isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default RunsOverTime;
