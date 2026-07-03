/**
 * TASK-1964 (epic 1952 W5.1) — triangle-count vs wall-time scatter.
 *
 * Two Scatter series (cpu/gpu) over the same numeric axes so the GPU
 * offload effect is visually obvious. recharts 0.22.4: XAxis/YAxis need
 * `type="number"` for a numeric (non-category) scatter axis, and `Scatter`
 * takes its own `data` prop rather than reading off a shared chart-level
 * dataset (see recharts/lib/cartesian/Scatter.js defaultProps).
 *
 * Fixed pixel width/height (no ResponsiveContainer) — this is an internal
 * staff panel and fixed sizing renders reliably in jsdom for the karma spec.
 */
import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { buildTriVsWalltimeSeries } from '../runsDashboardUtils';

const COLORS = { cpu: '#4c78a8', gpu: '#f58518' };

const TriVsWalltimeScatter = ({ records = [], width = 520, height = 320 }) => {
    const series = buildTriVsWalltimeSeries(records);
    const cpuPoints = series.filter((p) => p.mode === 'cpu');
    const gpuPoints = series.filter((p) => p.mode === 'gpu');

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-tri-vs-walltime">
            <h5>Triangle count vs wall time</h5>
            <ScatterChart width={width} height={height}>
                <CartesianGrid />
                <XAxis type="number" dataKey="triangle_count" name="Triangles" />
                <YAxis type="number" dataKey="wall_s" name="Wall (s)" />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter name="CPU" data={cpuPoints} fill={COLORS.cpu} />
                <Scatter name="GPU" data={gpuPoints} fill={COLORS.gpu} />
            </ScatterChart>
        </div>
    );
};

export default TriVsWalltimeScatter;
