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

// Deferred to W3 (rule-of-three not yet met, or single-consumer organisms):
//   EmptyState, ErrorStrip, StarterCard, InlineHint, SelectField, InlineConfirm,
//   ResourceSummaryCard — see DESIGN-SYSTEM-AUDIT.md § Part C
