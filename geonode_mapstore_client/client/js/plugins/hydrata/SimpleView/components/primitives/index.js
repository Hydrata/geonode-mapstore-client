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
//   ErrorStrip  ≥6 consumers (anuga-scenario-error-strip, menu-row-delete-error,
//               sv-tm-error-message, tw-error, hgeval alert-danger, idf-derive-error)
//   EmptyState  3 consumers  (anuga-scenario-rail-empty, sv-tm-empty, tw-empty-hint)
export {ErrorStrip} from './ErrorStrip';
export {EmptyState} from './EmptyState';

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
