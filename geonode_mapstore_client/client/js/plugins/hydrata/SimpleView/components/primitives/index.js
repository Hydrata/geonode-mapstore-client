// TASK-1007 (W3) — Barrel re-exports for the SimpleView presentational
// primitives. All named exports; no default exports anywhere in
// `components/primitives/`. Consumer files import a single primitive
// per line for tree-shaking clarity and easier blame attribution.
export {LayerActionToolbar} from './LayerActionToolbar';
export {OpacitySlider} from './OpacitySlider';
export {SectionHeader} from './SectionHeader';
export {CategoryRail} from './CategoryRail';
