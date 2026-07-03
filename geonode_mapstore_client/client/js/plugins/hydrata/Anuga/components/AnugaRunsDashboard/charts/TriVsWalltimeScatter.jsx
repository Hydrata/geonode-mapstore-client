/**
 * TASK-1964 (epic 1952 W5.1) — triangle-count vs wall-time scatter.
 *
 * Two Scatter series (cpu/gpu) over the same axes so the GPU offload effect is
 * visually obvious. recharts 0.22.4: XAxis/YAxis need `type="number"` for a
 * numeric (non-category) scatter axis, and `Scatter` takes its own `data` prop
 * rather than reading off a shared chart-level dataset.
 *
 * Triangle counts span ~250K → 8M+; on a LINEAR x-axis the largest run stretches
 * the scale and collapses everything else into an unreadable smear at the origin
 * (the first cut of this chart did exactly that). A LOG x-axis spreads the whole
 * corpus so the triangles→walltime relationship — the PM's core "what drives
 * runtime" question — is actually visible. Fluid width via ResponsiveContainer.
 */
import React from 'react';
import {
    ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { buildTriVsWalltimeSeries, MODE_COLORS } from '../runsDashboardUtils';

const fmtTri = (v) => {
    if (v >= 1e6) {
        return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
    }
    if (v >= 1e3) {
        return `${Math.round(v / 1e3)}K`;
    }
    return `${v}`;
};

const TriVsWalltimeScatter = ({ records = [], height = 260 }) => {
    const series = buildTriVsWalltimeSeries(records);
    const cpuPoints = series.filter((p) => p.mode === 'cpu');
    const gpuPoints = series.filter((p) => p.mode === 'gpu');

    return (
        <div className="anuga-runs-chart" data-testid="anuga-chart-tri-vs-walltime">
            <h5 className="anuga-runs-chart__title">Triangles vs wall time <span className="anuga-runs-chart__hint">(log scale)</span></h5>
            <ResponsiveContainer width="100%" height={height}>
                <ScatterChart margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" />
                    <XAxis
                        type="number"
                        dataKey="triangle_count"
                        name="Triangles"
                        scale="log"
                        domain={['dataMin', 'dataMax']}
                        allowDataOverflow
                        tickFormatter={fmtTri}
                        tickLine={false}
                        axisLine={{ stroke: '#e6edf3' }}
                    />
                    <YAxis type="number" dataKey="wall_s" name="Wall (s)" tickLine={false} axisLine={false} width={44} />
                    <ZAxis range={[70, 70]} />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => (name === 'Triangles' ? [Number(value).toLocaleString(), name] : [value, name])}
                    />
                    <Legend />
                    <Scatter name="CPU" data={cpuPoints} fill={MODE_COLORS.cpu} isAnimationActive={false} />
                    <Scatter name="GPU" data={gpuPoints} fill={MODE_COLORS.gpu} isAnimationActive={false} />
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TriVsWalltimeScatter;
