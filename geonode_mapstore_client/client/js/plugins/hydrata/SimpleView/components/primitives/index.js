// Barrel re-exports for the SimpleView presentational primitives.
// All named exports; no default exports.
export {LayerActionToolbar} from './LayerActionToolbar';
export {OpacitySlider} from './OpacitySlider';
export {SectionHeader} from './SectionHeader';
export {CategoryRail, tristateGlyph} from './CategoryRail';
// V1 additions (TASK-1664 W2): proof-capped to TaskMonitor parity + reference panel
export {StatusBadge} from './StatusBadge';
export {ProgressBar} from './ProgressBar';
export {LogViewer} from './LogViewer';
// V1 addition (TASK-1682): operator richness verdict at the W2 UAT gate
export {Tooltip} from './Tooltip';
// Phase-0 of the 1673 rollout (TASK-1732): the two gap primitives whose
// rule-of-three the panel-x-primitive gap-audit confirmed —
//   ErrorStrip  ≥6 consumers (anuga-scenario-error-strip, sv-menu-row-delete-error,
//               sv-tm-error-message, tw-error, hgeval alert-danger, idf-derive-error)
//   EmptyState  3 consumers  (anuga-scenario-rail-empty, sv-tm-empty, tw-empty-hint)
export {ErrorStrip} from './ErrorStrip';
export {EmptyState} from './EmptyState';

// ── Chassis (layout) primitives — TASK-1759 / epic-1758 P0 ──────────────────
// 6 structural primitives the W1 panel agents can compose from.
// Each cleared the rule-of-three (≥3 real consumers across the 8 panels).
// See DESIGN-SYSTEM-AUDIT.md § Part F — Chassis layer for the full audit matrix.
//
//   PanelShell   7 consumers: SimpleView, Anuga, Hydrology, Swamm, HGeval,
//                             TaskMonitor, VectorDraw
//   PanelHeader  8 consumers: SimpleView(sv-legend-header), Anuga(pane-toolbar),
//                             Hydrology(miller-header), HGeval, TaskMonitor(sv-tm-header),
//                             VectorDraw, Swamm, TerrainWorkbench
//   Section      8 consumers: Anuga(section+pane-section), Hydrology(idf-derive-step),
//                             HGeval(hgeval-section), TerrainWorkbench(recipe-section),
//                             SimpleView, Swamm, TaskMonitor, VectorDraw
//   Card         7 consumers: Anuga(status-card,resource-summary,starter-card),
//                             Hydrology(design-storm-card,chart-card→variant="chart"),
//                             HGeval(selected-coords), Swamm, TerrainWorkbench,
//                             TaskMonitor, SimpleView
//   Table        6 consumers: Hydrology(idf-table,temporal,time-series,matrix),
//                             Anuga(built-mesh-roster,run-server),
//                             HGeval(results table), Swamm, VectorDraw, TaskMonitor
//   FormRow      7 consumers: Anuga(scenario-pane-section label+field rows),
//                             Hydrology(idf-derive-step rows),
//                             HGeval(hgeval-input-panel rows),
//                             SimpleView(panel-item-row), Swamm, TaskMonitor, TerrainWorkbench
export {PanelShell} from './PanelShell';
export {PanelHeader} from './PanelHeader';
export {Section} from './Section';
export {Card} from './Card';
export {Table} from './Table';
export {FormRow} from './FormRow';

// Still deferred (rule-of-three NOT met, or already covered):
//   StatusTag    — already covered by StatusBadge (5-state pill)
//   SectionRow   — header concept already covered by SectionHeader; no shared body-row
//   Button       — heterogeneous (react-bootstrap Button + per-panel classes); no
//                  canonical dark-glass button, not requested by any Phase-1 spec
//   Input        — canonical input is CSS-token-backed (.simple-view-panel input),
//                  not a component; VectorDraw uses white inputs (theme divergence);
//                  the .msgapi specificity (0,3,1) gotcha bites a JS wrapper
//   StarterCard, InlineHint, SelectField, InlineConfirm, ResourceSummaryCard —
//                  single-consumer organisms; see DESIGN-SYSTEM-AUDIT.md § Part C
