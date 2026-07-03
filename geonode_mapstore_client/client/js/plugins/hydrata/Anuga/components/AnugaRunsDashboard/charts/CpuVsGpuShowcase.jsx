/**
 * TASK-1965 (epic 1952 W5.2, build portion) — CPU-vs-GPU benchmark showcase.
 *
 * Renders the CURATED benchmark corpus (data/gpuBenchmark.json, itself
 * derived from deploy/scripts/anuga_gpu_benchmark/{comparison,scaling}.csv)
 * — deliberately NOT the live run-actuals ledger. The two data sources are
 * different in kind: the ledger is "what actually ran in prod", this is
 * "a controlled A/B benchmark corpus" (same scenario, swept across
 * hardware). Mixing them into one series would misrepresent both, so this
 * panel always renders from the static snapshot, independent of whatever
 * the ledger fetch above returned (including a 0-row ledger).
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import gpuBenchmark from '../data/gpuBenchmark.json';

const CONFIG_COLORS = {
    cpu_np16: '#9d9d9d',
    cpu_np32: '#54a24b',
    gpu_t4: '#f2cf5b',
    gpu_a10g: '#f58518',
    gpu_l40s: '#e45756',
    laptop_rtx5070: '#4c78a8'
};

const CONFIG_LABELS = {
    cpu_np16: 'CPU (np16)',
    cpu_np32: 'CPU (np32, baseline)',
    gpu_t4: 'GPU T4',
    gpu_a10g: 'GPU A10G',
    gpu_l40s: 'GPU L40S',
    laptop_rtx5070: 'RTX 5070 (laptop, untested ref.)'
};

const SPEEDUP_SCENARIO = 'towradgi-full';

const CpuVsGpuShowcase = () => {
    const { provenance, comparison, scaling } = gpuBenchmark;
    const speedupRows = (comparison || []).filter((r) => r.scenario === SPEEDUP_SCENARIO);
    const speedupChartData = speedupRows
        .filter((r) => r.speedup_vs_cpu_np32 !== null && r.speedup_vs_cpu_np32 !== undefined)
        .map((r) => ({ config: CONFIG_LABELS[r.config] || r.config, speedup: r.speedup_vs_cpu_np32, key: r.config }));

    return (
        <div className="anuga-cpu-vs-gpu-showcase" data-testid="anuga-cpu-vs-gpu-showcase">
            <h2>CPU vs GPU benchmark</h2>
            <p className="anuga-benchmark-provenance" data-testid="anuga-benchmark-provenance">
                <strong>Snapshot</strong> — source: {provenance.source}, captured {provenance.date}.
                {' '}{provenance.note}
            </p>

            <h5>Speedup vs CPU (np32 baseline) — {SPEEDUP_SCENARIO}</h5>
            {speedupChartData.length === 0 ? (
                <p data-testid="anuga-benchmark-speedup-empty">No speedup data in this snapshot.</p>
            ) : (
                <div data-testid="anuga-chart-cpu-vs-gpu-speedup">
                    <BarChart width={520} height={300} data={speedupChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="config" />
                        <YAxis label={{ value: '× CPU np32', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `${value}×`} />
                        <Legend />
                        <Bar dataKey="speedup" name="Speedup">
                            {speedupChartData.map((entry) => (
                                <Cell key={entry.key} fill={CONFIG_COLORS[entry.key] || '#4c78a8'} />
                            ))}
                        </Bar>
                    </BarChart>
                </div>
            )}

            <h5>Full comparison corpus</h5>
            <table className="anuga-benchmark-table" data-testid="anuga-benchmark-comparison-table">
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Config</th>
                        <th>Hardware</th>
                        <th>Triangles</th>
                        <th>Solve wall (s)</th>
                        <th>$/run (on-demand)</th>
                        <th>Speedup vs np32</th>
                        <th>Cost ratio vs np32</th>
                        <th>Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    {(comparison || []).map((r) => (
                        <tr key={`${r.scenario}-${r.config}`} data-testid="anuga-benchmark-row">
                            <td>{r.scenario}</td>
                            <td>{CONFIG_LABELS[r.config] || r.config}</td>
                            <td>{r.hardware}</td>
                            <td>{r.tri_count !== null ? Number(r.tri_count).toLocaleString() : '—'}</td>
                            <td>{r.solve_wall_s !== null && r.solve_wall_s !== undefined ? r.solve_wall_s : '—'}</td>
                            <td>{r.usd_per_run_ondemand !== null ? `$${Number(r.usd_per_run_ondemand).toFixed(2)}` : '—'}</td>
                            <td>{r.speedup_vs_cpu_np32 !== null && r.speedup_vs_cpu_np32 !== undefined ? `${r.speedup_vs_cpu_np32}×` : '—'}</td>
                            <td>{r.cost_ratio_vs_cpu_np32 !== null && r.cost_ratio_vs_cpu_np32 !== undefined ? `${r.cost_ratio_vs_cpu_np32}×` : '—'}</td>
                            <td className="anuga-benchmark-evidence">{r.evidence}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h5>GPU VRAM / mesh-size ceiling (scaling.csv)</h5>
            <table className="anuga-benchmark-table" data-testid="anuga-benchmark-scaling-table">
                <thead>
                    <tr>
                        <th>Card</th>
                        <th>VRAM (GB)</th>
                        <th>Triangles tested</th>
                        <th>Peak VRAM (MB)</th>
                        <th>GB / M-tri</th>
                        <th>Solve wall (s)</th>
                        <th>Mean GPU util %</th>
                        <th>Est. ceiling (M-tri)</th>
                    </tr>
                </thead>
                <tbody>
                    {(scaling || []).map((r, i) => (
                        <tr key={`${r.card}-${r.triangle_count}-${i}`} data-testid="anuga-benchmark-scaling-row">
                            <td>{r.card}</td>
                            <td>{r.vram_capacity_gb}</td>
                            <td>{Number(r.triangle_count).toLocaleString()}</td>
                            <td>{r.peak_vram_mb}</td>
                            <td>{r.gb_per_mtri}</td>
                            <td>{r.solve_wall_s}</td>
                            <td>{r.mean_gpu_util_pct !== null && r.mean_gpu_util_pct !== undefined ? r.mean_gpu_util_pct : '—'}</td>
                            <td>{r.ceiling_est_mtri}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CpuVsGpuShowcase;
