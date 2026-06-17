# Hydrata SimpleView Design System Audit

**Date:** 2026-06-12
**Branch:** epic/1659-simpleview-design-system (based on origin/5.x c0ad090b0)
**Scope:** 8 hydrata panel CSS files (TerrainWorkbench is on epic/1587 — out of scope for W1)

---

## Part A — Drift Map

### Theme alignment

| Panel | CSS file | Theme | Conforms to dark-glass standard? |
|-------|----------|-------|----------------------------------|
| **SimpleView** | simpleView.css (1009 lines) | Dark blue/glass | YES — the system origin; hosts all --sv-* tokens on :root |
| **Anuga/Scenarios** | anuga.css (2132 lines) | Dark blue/glass | YES — best-of-breed source for rail/scenario patterns |
| **Hydrology** | hydrology.css (1515 lines) | MIXED — dark panel outer + white-card inner for charts | PARTIAL — outer panel dark; IDF/Hydrology detail pane uses white `design-storm-chart-card` cards deliberately |
| **Swamm** | swamm.css (772 lines) | MIXED — dark header + light white chart panels | NON-CONFORMING — `background-color: white` on chart cols |
| **Swamps** | swamps.css (55 lines) | LIGHT (#ffffff backgrounds) | NON-CONFORMING |
| **HGeval** | hgeval.css (338 lines) | LIGHT (`background: #fff`, `color: #333`) | NON-CONFORMING — fully light/white side-drawer |
| **TaskMonitor** | taskMonitor.css (273 lines) | LIGHT (white side-drawer) | NON-CONFORMING for dark-glass BUT SELF-CONSISTENT |
| **VectorDraw** | vectorDrawPopup.css (148 lines) | Inherits SimpleView chrome | CONFORMING — extends .simple-view-panel, overrides only typography |

### Widget-level drift inventory

| Widget | Panels where it appears | Key divergences |
|--------|------------------------|-----------------|
| **Panel container** | All | SimpleView: `--sv-panel-bg` + border + z-index 1025; HGeval/TaskMonitor: `position:fixed; right:0` drawer; Swamm: `rgba(43,89,148)` hardcoded; Swamps: `#ffffff` |
| **Section header** | SimpleView, Anuga, Hydrology | SimpleView: `font-size:x-large; border-bottom:2px #ffffffad`; Anuga: `hydrology-miller-header` 44px flex; sm differences |
| **Category rail** | SimpleView, Anuga, Hydrology | 3 SEPARATE implementations: `sv-category-rail` (simpleView.css), `anuga-scenario-category-rail` (anuga.css), `hydrology-category-rail` (hydrology.css). Same visual concept, different prefixes, near-identical CSS. Width: 180px / 220px / 200px. Rail items: `sv-category-rail-item` / `anuga-scenario-category-item` / `hydrology-category-item`. Active state: all use `border-left-color: #cae33b`. |
| **Status tags / pills** | Anuga | `anuga-scenario-category-item-tag.is-ok/is-warn/is-err` — lime/amber/red; no equivalent in other panels |
| **Progress bar** | Anuga, TaskMonitor | Anuga: `.anuga-scenario-status-card-progress-track` 5px + blue gradient; TaskMonitor: `.tm-progress-bar-container` 4px + `#5bc0de`; structurally identical, different sizing/colour |
| **Status badge (inline text)** | Anuga, TaskMonitor | Anuga: `scenario-status-pill.status-complete/error/cancelled` coloured text; TaskMonitor: `tm-badge-running/pending/complete/error/cancelled` background pills |
| **Error strip** | Anuga, SimpleView | Anuga: `anuga-scenario-error-strip` red-left-border card; SimpleView: `menu-row-delete-error` same pattern; identical design intent |
| **Empty state** | Anuga | `anuga-scenario-rail-empty` centred glyph+heading+subcopy; no equivalent in other panels |
| **Starter card / onboarding** | Anuga | `anuga-starter-card` with numbered steps; no equivalent |
| **Log viewer** | Anuga, TaskMonitor | Anuga: `anuga-scenario-pane-log-viewer` dark terminal (#000000cc); TaskMonitor: `tm-log-viewer` (#1e1e1e); functionally identical |
| **Input (text/number)** | All dark-glass panels | 4 divergent "dark input" blues: `#5178af` (simpleView, hydrology), `#537ab1` (swamm glyph), `#5279B0` (swamm select), `#6085b5` (anuga btn-compare). VectorDraw: white inputs on white card (`#fff`). HGeval/TaskMonitor: browser-default. |
| **Inline confirm dialog** | Anuga, SimpleView | `menu-row-delete-confirm.is-open` vs `anuga-scenario-confirm-dialog.is-open` — same always-rendered/`.is-open` pattern |
| **Glyph action chips** | SimpleView | `span.menu-row-glyph` white-chip 24×24px; not directly reused in Anuga/Hydrology |
| **Scrollbar** | SimpleView, Anuga, Hydrology | All use `scrollbar-color: #5178af transparent; scrollbar-width: thin` |
| **Section divider** | Anuga, Hydrology | `border-bottom: 1px solid var(--sv-section-border, …)` — most consume the token correctly |

### Token consumption (current)

| Panel | --sv-* tokens consumed | Notable gaps |
|-------|------------------------|-------------|
| Anuga | 9 (`--sv-panel-top-anuga`, `--sv-section-border` ×4, `--sv-glyph-active` ×3, `--sv-panel-bg`, `--sv-input-bg`, `--sv-input-readonly-bg`, `--sv-text-dim` ×3, `--sv-text`, `--sv-info-bg`, `--sv-info-border`, `--sv-tm-top` indirect) | Hardcodes many blues (`#6085b5`, `#3363a0`, `#397AAB`); no --sv-input-bg on select |
| Hydrology | 2 (`--sv-section-border` ×2, `--sv-panel-bg` ×1) | All other values hardcoded; no --sv-input token |
| Swamm | 0 | Everything hardcoded (`#537ab1`, `#5279B0FF`, `rgba(43,89,148)`) |
| HGeval | 0 | Fully light-themed, no --sv- tokens |
| TaskMonitor | 3 (`--sv-tm-top` CSS var, `--sv-panel-bg` indirect via container) | Light-themed, no panel tokens |
| VectorDraw | 1 (`--sv-icon-size` in legend-close override) | Inherits SimpleView chrome via .simple-view-panel |

### Undeclared tokens referenced by Anuga

The following tokens are used in anuga.css but **NOT declared** in simpleView.css `:root`:
- `--sv-text-dim` (rgba(255,255,255,0.55) fallback)
- `--sv-text` (rgba(255,255,255,0.85) fallback)
- `--sv-info-bg` (rgba(91,192,222,0.12) fallback)
- `--sv-info-border` (#5bc0de fallback)
- `--sv-input-readonly-bg` (rgba(255,255,255,0.03) fallback)

These are consumed via CSS fallback (second argument to `var()`). They should be formally declared in tokens.css as part of the proof-cap.

### Input blue divergence

Four different values used as "panel input blue":
1. `#5178af` — scrollbar thumb (simpleView.css), hydrology inputs, IDF table headers; most common
2. `#537ab1` — swamm `bmp-type-group-glyph` background
3. `#5279B0` — swamm `simple-view-panel-item-row select` + `#bmp-notes` (note: `#5279B0FF` = same with full alpha)
4. `#6085b5` — anuga `scenario-tab`, `anuga-btn-compare`, `anuga-btn-duplicate-header`

**Canonical choice: `#5178af`** — most common, used in the foundational simpleView.css rule that sets the scrollbar and the panel's baseline input style; the "losing" values (#537ab1, #5279B0, #6085b5) are documented here and in tokens.css.

---

## Part B — Best-of-Breed Inventory

For each recurring widget, the single best existing implementation:

| Widget | Best panel | Best class(es) | Why |
|--------|-----------|----------------|-----|
| **Panel shell** | SimpleView | `.simple-view-panel` | System origin; correct token usage, responsive overrides |
| **Section header (large)** | SimpleView | `.simple-view-panel-header` | Clean font-size:x-large + border-bottom pattern |
| **Section header (medium/labeled)** | Anuga | `.anuga-pane-toolbar` + `.anuga-pane-head-title` | Flex row, 6px gap, border-bottom, bg overlay — richest |
| **Category rail (container)** | SimpleView | `.sv-category-rail` (inside `simple-view-panel--miller`) | Declared with --sv-* tokens, correct overflow, scrollbar-color:#5178af |
| **Category rail item** | Anuga (Scenario pane) | `.anuga-scenario-category-item` | Most complete: hover/focus-visible/active states, left-border lime accent, glyph slot, label ellipsis |
| **Category rail item — status tag** | Anuga | `.anuga-scenario-category-item-tag.is-ok/.is-warn/.is-err` | Canonical tri-state with lime/amber/red semantics |
| **Layer action toolbar** | SimpleView (component) | `LayerActionToolbar.js` + `.menu-row-toolbar` | 4-icon locked row; defined as primitive already |
| **Opacity slider** | SimpleView (component) | `OpacitySlider.js` + `.dataset-transparency` | Defined as primitive already |
| **Row glyph chip** | SimpleView | `span.menu-row-glyph` | White-box 24×24px chip; cleanest; most used |
| **Glyph states (active/inactive/etc)** | SimpleView | `.menu-row-glyph.glyph-active/.glyph-inactive/...` | Token-backed via --sv-glyph-active etc. |
| **Progress bar** | Anuga | `.anuga-scenario-status-card-progress-track` + `.anuga-scenario-pane-log` | 5px track with gradient fill, border-radius, overflow:hidden |
| **Status badge / pill** | Anuga | `.scenario-status-pill` + `.is-compact` + status modifiers | Cleanest: inline-flex, gap, all states, compact variant |
| **Error strip** | Anuga | `.anuga-scenario-error-strip` + `-head` + `-payload` | Canonical: left-border red, tinted bg, head + payload parts |
| **Inline confirm dialog** | SimpleView | `.menu-row-delete-confirm` + `.is-open` | Pattern: always-rendered + .is-open; Karma-safe; use as model |
| **Log viewer** | Anuga | `.anuga-scenario-pane-log-viewer` | Terminal-style, resize:vertical, scrollbar, pre whitespace — most complete |
| **Empty state** | Anuga | `.anuga-scenario-rail-empty` + sub-elements | Centred, glyph + heading + subcopy; correct --sv-text-dim |
| **Input (dark panel)** | SimpleView | `.simple-view-panel input` + `--sv-input-bg` | Token-backed; canonical blue |
| **Select (dark panel)** | Anuga | `.scenario-select` | SVG chevron, appearance:none, focus states, option bg |
| **Section divider** | Anuga / Hydrology | `border-bottom: 1px solid var(--sv-section-border, ...)` | Token-backed pattern, used consistently |
| **Close button** | SimpleView | `.legend-close` | Red 24×24px chip with cursor:pointer, inline-flex center |
| **Inline help/info banner** | Anuga | `.anuga-scenario-pane-readonly-hint` | info-border left-border, --sv-info-bg, glyph+text flex |
| **Resource summary card** | Anuga | `.anuga-scenario-resource-summary` | Dark card: opacity card, inline meta, empty state variant |

---

## Part C — Proof-Capped V1 Primitive List

The proof cap is: **4 existing primitives + what the parity-proof panel (TaskMonitor) and the reference panel will consume in W2.**

### Existing primitives (carry forward as-is)
1. `CategoryRail` — `.sv-category-rail` + items (simpleView.css)
2. `LayerActionToolbar` — `.menu-row-toolbar` (simpleView.css)
3. `OpacitySlider` — `.dataset-transparency` (simpleView.css)
4. `SectionHeader` — `.simple-view-panel-header` / `.menu-row-header` (simpleView.css)

### V1 additions (consumed by TaskMonitor parity proof in W2)

TaskMonitor (W2 migration target) uses these widget concepts:
- Panel shell (`.tm-panel`) → existing `.simple-view-panel`
- Panel header with close button → existing `SectionHeader` + `.legend-close`
- Status badge (`.tm-badge-*`) → candidate new primitive: `StatusBadge`
- Progress bar (`.tm-progress-bar*`) → candidate new primitive: `ProgressBar`
- Process row (`.tm-process-row`) → list row pattern; maps to existing `.menu-row` concept
- Log viewer (`.tm-log-viewer`) → candidate new primitive: `LogViewer`
- Filter bar (`.tm-filter-bar`) → toolbar pattern; no new primitive needed (button group)

**V1 primitive additions (proof-capped to TaskMonitor + reference panel):**
5. `StatusBadge` — encapsulates the 5-state (running/pending/complete/error/cancelled) badge; best-of-breed source: `.anuga-scenario-category-item-tag.is-ok/.is-warn/.is-err` + `.scenario-status-pill`
6. `ProgressBar` — encapsulates track+fill pattern; best-of-breed source: `.anuga-scenario-status-card-progress-track`
7. `LogViewer` — encapsulates terminal-style log box; best-of-breed source: `.anuga-scenario-pane-log-viewer`

**NOT in v1 (deferred — not consumed by proof panel):**
- EmptyState, StarterCard, InlineConfirm, ResourceSummaryCard, ErrorStrip, SelectField, InlineHint — all deferred to W3 rollout

---

## Part D — Recommended Parity-Proof Panel + Rubric

### Recommendation: **TaskMonitor**

**Rubric applied:**
1. **Already-on-standard-form** — TaskMonitor is a clean, self-contained light-drawer with its own `tm-` prefix namespace. It has zero cross-panel dependencies and no unresolved token debt. It is the simplest non-trivial panel.
2. **Exercises the most-reused widgets** — It exercises panel shell, panel header, close button, status badge (5 states), progress bar, log viewer, process row (list row), and filter bar. This covers the core v1 primitive set.
3. **Stable/not-mid-epic** — TaskMonitor is NOT currently being modified by any active epic (1587 terrain is separate; 1578 ANUGA is done). No open subtasks touch taskMonitor.css.
4. **Zero structural delta target** — The migration spec (TASK-1665) is pixel-zero: TaskMonitor's light-drawer aesthetic is intentional (spec says "enumerated, signed-off list of intended token-unification shifts" is OK, not pixel-zero). The structural token migration is measurable and auditable.

**Why not Anuga/Scenarios?** Anuga is mid-epic (1587 terrain branch; ongoing active development); its CSS is 2132 lines with multiple nested column layouts — too complex for a clean proof. Its light panels (chart, log viewer) introduce cross-theme complexity.

**Why not VectorDraw?** VectorDraw has no independent token usage — it inherits SimpleView chrome. It doesn't exercise enough distinct primitives to be representative.

---

## Part E — Conform-Migration List (for rollout epic TASK-1673)

Ordered by effort (lowest first):

| Panel | Migration type | Key work |
|-------|---------------|----------|
| **VectorDraw** | Already inherits SimpleView chrome; needs only prefix migration from `vector-draw-` to `sv-` | Low — rename classes, update JSX |
| **TaskMonitor** | W2 parity proof (TASK-1665); light-drawer → token-backed dark-glass | Medium — structural migration + enumerate token shifts |
| **HGeval** | Fully light; standalone right-drawer; no tokens consumed | Medium-high — full theme change, test report rendering |
| **Swamps** | Minimal CSS (55 lines), white chart containers | Low-medium — mostly white chart backgrounds (intentional?) |
| **Swamm** | Mixed; white chart panels + dark form panels | High — grid layout + white chart panels + responsive rules |
| **Hydrology** | Mixed; already dark outer + white-card charts (by design per memory reference) | Medium — outer panel already partially dark; white-card charts are intentional |

**Ratchet protocol** (for TASK-1663 lint guard): On each rollout PR, delete the migrated panel's prefix from the allowlist in `js/plugins/hydrata/SimpleView/css-namespace-guard.js`. The guard then rejects any new class with the old prefix.

---

## Notes / Caveats

- `tw-` prefix (terrain workbench) was noted as ~86 in prior context but is NOT present in any of the 8 CSS files on this branch (TerrainWorkbench is on epic/1587, not yet merged). The lint guard allowlist MUST NOT include `tw-` — it is out of scope for W1.
- `hyrdology-` (typo of `hydrology-`) appears once in hydrology.css — noted as technical debt; the allowlist seeds it as-is (one class: `.hyrdology-textarea`).
- SimpleView's `.simple-view-panel { text-align: center }` INHERITS into all descendant content — panels that add `text-align: left` overrides are working around this. Document in token migration as a gotcha.
- `.msgapi .simple-view-panel input` wins at specificity (0,3,1) — transparent-input overrides need `!important` (see memory reference-simple-view-panel-css.md).

---

## Part F — Chassis Layer (TASK-1759 / epic-1758 P0)

**Date:** 2026-06-17
**Branch:** epic/1587-terrain-assembly
**Scope:** 6 layout/structural chassis primitives built on top of the V1 widget set.

These are the LAYOUT/STRUCTURE primitives that the 1659 widget set deferred (it only covered
_widgets_ — StatusBadge, ProgressBar, etc.). Each primitive cleared the rule-of-three gate
(≥ 3 real consumers across the 8 panels), confirmed by reading every panel CSS file.

### Rule-of-three matrix

| Primitive | Source class(es) | Consumers | Panel files confirmed |
|-----------|-----------------|-----------|----------------------|
| **PanelShell** | `.simple-view-panel` (simpleView.css) | 7 | SimpleView, Anuga (`.anuga-panel`), Hydrology (`.hydrology-miller-panel`), Swamm (`#swamm-bmp-form-panel`), HGeval (`.hgeval-panel`), TaskMonitor (sv-migrated), VectorDraw (inherits) |
| **PanelHeader** | `.simple-view-panel-header`, `.anuga-pane-toolbar`, `.sv-tm-header`, `.legend-header`, `.hgeval-header`, `.hydrology-miller-header` | 8 | SimpleView (legend-header + simple-view-panel-header), Anuga (pane-toolbar), Hydrology (miller-header), HGeval, TaskMonitor (sv-tm-header), VectorDraw, Swamm, TerrainWorkbench |
| **Section** | `.anuga-section`, `.anuga-scenario-pane-section`, `.hgeval-section`, `.anuga-terrain-recipe-section`, `.idf-derive-step`, `.membership-visibility` | 8 | Anuga (section+pane-section+membership), Hydrology (idf-derive-step+subtoggle), HGeval (hgeval-section), TerrainWorkbench (recipe-section), SimpleView, Swamm, TaskMonitor, VectorDraw |
| **Card** | `.anuga-scenario-status-card`, `.anuga-scenario-resource-summary`, `.design-storm-card`, `.anuga-starter-card`, `.terrain-bbox-inline-review` | 7 | Anuga (status-card, resource-summary, starter-card, terrain-bbox), Hydrology (design-storm-card, design-storm-chart-card → variant="chart"), HGeval (hgeval-disclaimer), Swamm, TerrainWorkbench, TaskMonitor, SimpleView |
| **Table** | `.idf-table`, `.temporal-pattern-table`, `.time-series-table`, `.idf-matrix-table`, `.anuga-built-mesh-roster-table`, `.hgeval-section .table` | 6 | Hydrology (idf-table, temporal, time-series, matrix), Anuga (built-mesh-roster, run-server, network), HGeval (results table), Swamm, VectorDraw, TaskMonitor |
| **FormRow** | `.simple-view-panel-item-row`, `.anuga-scenario-pane-section` (label+field pattern), `.hgeval-input-panel label`, `.hgeval-coord-row`, `.membership-add-form-row` | 7 | Anuga (scenario-pane-section — all 3 scenario detail panes), Hydrology (idf-derive-step rows), HGeval (hgeval-input-panel), SimpleView (panel-item-row), Swamm, TaskMonitor, TerrainWorkbench |

### CRITICAL — PanelHeader close chip cascade trap

The `.legend-close` rule in simpleView.css carries `position:absolute`. Any close button
that inadvertently picks up this class would escape the flex row and overlap the title text.
PanelHeader renders its close chip with `position:'static'` via inline style (explicit, not
relying on flex default), and uses the class `sv-panel-header-close` (NOT `legend-close`).
This blocks the cascade trap at two levels: (1) wrong class name, (2) inline style wins.
Covered by the `PanelHeader close chip has position:static` karma assertion.

### Chart carve-out (grill q-1 decision)

- Token `--sv-chart-surface: #ffffff` added to `tokens.css`.
- `Card variant="chart"`: card FRAME is dark-glass, card BODY uses `--sv-chart-surface`.
- rationale: recharts 0.22.4 renders axes/grid on the container background; a dark container
  makes all axis labels and grid lines near-invisible. TASK-1534 deliberately keeps chart
  cards white. The carve-out is the ONLY permitted mechanism — never darken recharts directly.
- Full decision: `docs/reports/2026-06-17-q-1-chart-surface-carveout.html` (deploy repo).

### Layout tokens added (tokens.css)

6 chassis-specific tokens: `--sv-panel-padding`, `--sv-header-height`, `--sv-header-font-size`,
`--sv-header-padding`, `--sv-section-gap`, `--sv-card-padding`, `--sv-card-radius`,
`--sv-form-row-gap`. Plus `--sv-chart-surface` for the carve-out.

### Files changed

- `primitives/PanelShell.js` (new)
- `primitives/PanelHeader.js` (new)
- `primitives/Section.js` (new)
- `primitives/Card.js` (new)
- `primitives/Table.js` (new)
- `primitives/FormRow.js` (new)
- `primitives/index.js` (exports added)
- `tokens.css` (layout tokens + --sv-chart-surface added)
- `DESIGN-SYSTEM-AUDIT.md` (this section appended)
- `SimpleViewReferencePanel.jsx` (chassis showcase added)
- `primitives/__tests__/PanelShell-test.js` (new)
- `primitives/__tests__/PanelHeader-test.js` (new)
- `primitives/__tests__/Section-test.js` (new)
- `primitives/__tests__/Card-test.js` (new)
- `primitives/__tests__/Table-test.js` (new)
- `primitives/__tests__/FormRow-test.js` (new)
