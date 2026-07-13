# How to build a new Hydrata panel from the SimpleView library

**Version:** v1 (W2, TASK-1666, epic/1659-simpleview-design-system, 2026-06-12)
**Scope:** `.simple-view-panel` dark-glass theme. Light panels (HGeval, Swamps) are out of scope until TASK-1673.

---

## 1. The panel skeleton

Every new Hydrata panel must render inside `.simple-view-panel`. Copy this skeleton:

```jsx
// MyPanel.jsx
import React from 'react';
import { SectionHeader, StatusBadge, ProgressBar, LogViewer } from
    '../SimpleView/components/primitives';
import '../SimpleView/simpleView.css';  // tokens + all sv-* rules

const MyPanel = ({ onClose, items }) => (
    <div className="simple-view-panel my-panel">
        {/* Header: use .legend-close for the close chip */}
        <SectionHeader>
            <h5>My Panel</h5>
            <span className="glyphicon glyphicon-remove legend-close" onClick={onClose} />
        </SectionHeader>

        {/* Content: always set text-align:left — see Shell gotcha #1 */}
        <div style={{ textAlign: 'left', padding: '8px 12px' }}>
            {items.map(item => (
                <div key={item.id}>
                    <span>{item.name}</span>
                    <StatusBadge status={item.status} compact />
                </div>
            ))}
        </div>
    </div>
);

export default MyPanel;
```

---

## 2. Shell gotchas — the two traps every panel hits

### Gotcha 1: `text-align:center` inherited from `.simple-view-panel`

`.simple-view-panel { text-align: center }` is a root rule in `simpleView.css`.
Every descendant element **inherits** it unless you explicitly override.

**DO:**
```css
.my-panel-content {
    text-align: left;  /* always reset for content containers */
}
```
```jsx
<div style={{ textAlign: 'left', padding: '8px 12px' }}>
```

**DON'T:** rely on browser default left-alignment inside `.simple-view-panel` — it will be centered.

All v1 primitives already set `text-align: left` internally where needed (StatusBadge, ProgressBar, LogViewer, sv-tm-process-row, etc.), so you only need to reset it on your own container divs.

---

### Gotcha 2: `.msgapi .simple-view-panel input` specificity (0,3,1)

There is a rule at specificity (0,3,1) in the page CSS:
```css
.msgapi .simple-view-panel input { background-color: var(--sv-input-blue, #5178af); ... }
```
This wins over panel-level `input` rules at (0,2,1) or lower.

**DO:** Use `!important` if you need a transparent-input variant inside the panel:
```css
.my-panel-input-transparent {
    background-color: transparent !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    color: var(--sv-text) !important;
}
```

**DON'T:** write a plain `.simple-view-panel input { background: transparent }` rule — the (0,3,1) rule will win and the input will stay blue.

---

## 3. Primitive API reference (v1)

### From `SimpleView/components/primitives` barrel:

| Primitive | Props | When to use |
|-----------|-------|-------------|
| `<SectionHeader>` | `children`, `extraClassName`, `style` | Panel header rows, section dividers |
| `<CategoryRail>` | `items`, `selectedSubHeading`, `onSelect`, `onToggleGroupVisibility` | Miller-column sidebar navigation |
| `<LayerActionToolbar>` | (see source) | 4-icon locked layer action row |
| `<OpacitySlider>` | (see source) | Layer transparency slider |
| `<StatusBadge>` | `status` (required), `label`, `showGlyph`, `compact` | Process/task state pills |
| `<ProgressBar>` | `pct` (0-100) | Horizontal progress track + fill |
| `<LogViewer>` | `log`, `emptyText` | Terminal-style log pane |

### Deferred (W3 — not yet rule-of-three):
`EmptyState`, `ErrorStrip`, `StarterCard`, `InlineHint`, `SelectField`, `InlineConfirm`, `ResourceSummaryCard`

---

## 4. Tokens-only rule

Never hardcode a colour value that a token covers. The full token list lives in
`SimpleView/tokens.css`. Key tokens:

| Token | Value | Use for |
|-------|-------|---------|
| `--sv-panel-bg` | `rgba(0,60,136,0.8)` | Panel background |
| `--sv-text` | `rgba(255,255,255,0.85)` | Primary text |
| `--sv-text-dim` | `rgba(255,255,255,0.55)` | Secondary/dim text |
| `--sv-input-blue` | `#5178af` | Input bg, scrollbar thumb |
| `--sv-input-bg` | `rgba(255,255,255,0.22)` | Standard input background |
| `--sv-info-bg` | `rgba(91,192,222,0.12)` | Info/hint banner bg |
| `--sv-info-border` | `#5bc0de` | Info/hint banner border |
| `--sv-delete-error-bg` | `rgba(220,53,69,0.1)` | Error strip bg |
| `--sv-delete-error-border` | `#dc3545` | Error strip border |
| `--sv-section-border` | `rgba(255,255,255,0.6)` | Section divider colour |
| `--sv-glyph-active` | `limegreen` | Active glyph/icon |
| `--sv-glyph-inactive` | `red` | Inactive/close glyph |

**Exception:** `LogViewer` uses a terminal-convention `#1e1e1e` bg. This is deliberate — it is a terminal, not a panel. Do not replace it with a token.

---

## 5. Worked example — TaskMonitor migration (TASK-1665)

The TaskMonitor plugin is the W2 parity proof. It migrated from a light-white side-drawer to the dark-glass `.simple-view-panel` theme.

### Enumerated visual-shift list (for operator sign-off at W2 gate)

| Element | BEFORE (light) | AFTER (dark-glass) | Token/class |
|---------|---------------|-------------------|-------------|
| Panel background | `#ffffff` | `var(--sv-panel-bg)` = `rgba(0,60,136,0.8)` | `.simple-view-panel` |
| Panel shadow | `rgba(0,0,0,0.15)` | `rgba(0,0,0,0.4)` | `.sv-tm-container` |
| Header text | `color: inherit (#333)` | `var(--sv-text)` = `rgba(255,255,255,0.85)` | `.sv-tm-title` |
| Header border-bottom | `#ddd` | `var(--sv-section-border)` = `rgba(255,255,255,0.6)` | `.sv-tm-header` |
| Close button | Red chip `.tm-close-btn` (24px, `#d9534f`) | `.legend-close` (24px, `var(--sv-glyph-inactive)`) | `.legend-close` (existing) |
| Filter bar border | `#eee` | `var(--sv-section-border)` | `.sv-tm-filter-bar` |
| Filter buttons | Bootstrap `btn-default` (white bg) | `var(--sv-button-bg)` dark-glass | `.sv-tm-filter-bar .btn` |
| Process row bg | `#fff` (hover `#f7f7f7`) | transparent (hover `rgba(255,255,255,0.06)`) | `.sv-tm-process-row` |
| Process row border | `#f0f0f0` | `rgba(255,255,255,0.08)` | `.sv-tm-process-row` |
| Expanded row bg | `#f0f4f8` | `rgba(255,255,255,0.10)` | `.sv-tm-process-row.sv-tm-expanded` |
| Process name colour | inherit `#333` | `var(--sv-text)` | `.sv-tm-process-name` |
| Status badge (running) | `#d9edf7 bg / #31708f text` (Bootstrap info) | `var(--sv-info-bg) bg / var(--sv-info-border) text` | `StatusBadge is-running` |
| Status badge (pending) | `#fcf8e3 bg / #8a6d3b text` (Bootstrap warning) | `rgba(240,173,78,0.20) bg / #f0e08a text` | `StatusBadge is-pending` |
| Status badge (complete) | `#dff0d8 bg / #3c763d text` (Bootstrap success) | `rgba(92,184,92,0.20) bg / #a8e6a8 text` | `StatusBadge is-ok` |
| Status badge (error) | `#f2dede bg / #a94442 text` (Bootstrap danger) | `rgba(217,83,79,0.20) bg / var(--sv-delete-error-color) text` | `StatusBadge is-err` |
| Status badge (cancelled) | `#eee bg / #777 text` | `rgba(255,255,255,0.07) bg / var(--sv-text-dim) text` | `StatusBadge is-cancelled` |
| Progress bar track | `#e8e8e8` | `rgba(255,255,255,0.15)` | `.sv-progress-track` |
| Progress bar fill | `#5bc0de` | gradient `var(--sv-info-border) → var(--sv-glyph-active)` | `.sv-progress-fill` |
| Status detail text | `#888` | `var(--sv-text-dim)` | `.sv-tm-status-detail` |
| Type icon | `#666` | `var(--sv-text-dim)` | `.sv-tm-type-icon` |
| Error message | `#f2dede bg / #a94442 text` | `var(--sv-delete-error-bg) + left-border` | `.sv-tm-error-message` |
| Detail pane bg | `#fafafa` | `rgba(0,0,0,0.15)` | `.sv-tm-process-detail` |
| Subtask text | `#555` | `var(--sv-text-dim)` | `.sv-tm-subtask-name` |
| Detail actions | Bootstrap btn-default/btn-danger | sv-tm-detail-actions btn styling | `.sv-tm-detail-actions .btn` |
| Log viewer bg | `#1e1e1e` | `#1e1e1e` (**unchanged — intentional terminal bg**) | `LogViewer / .sv-log-viewer` |
| Empty state text | `#999, italic` | `var(--sv-text-dim), italic` | `.sv-tm-empty` |
| Notification dot | `#d9534f` | `var(--sv-glyph-inactive, red)` | `.sv-tm-notification-dot` |

### What stayed the same (structural parity)
- DOM structure: panel header + filter bar + process list (exactly as before)
- Filter tabs: Active / Completed / Failed / All (4 tabs, same labels)
- Process rows: icon + name + badge + optional status-detail + optional progress bar
- Expanded process row: subtask list + error message + log/cancel buttons
- Log viewer: scrollable `<pre>` terminal, auto-scroll on log change
- The `--sv-tm-top` CSS variable wiring (Tasks button position below right toolbar)
- Panel size: 350px wide, full viewport height, fixed position top-right

---

## 6. Reference panel (TASK-1662)

The dev-only primitive catalogue is registered as `SimpleViewReference` in the
**dev localConfig only** (gitignored working copy).

**How to open on :8081:**
1. Navigate to any map URL, e.g. `http://localhost:8081/catalogue/#/map/1335` (the old `/maps/<id>/map_viewer` path 404s — the viewer rides the catalogue hash route)
2. Look for the yellow `☰ Ref` button at the **bottom-left** of the map.
3. Click it — the primitive catalogue opens in a `.simple-view-panel` shell.
4. The panel is scrollable; all v1 primitives + variants + token swatches are shown.

The button is yellow to make it obviously dev-only. It is never present on production
sites (the plugin is guarded by `process.env.NODE_ENV !== 'production'` in `plugins/index.js`
and only registered in the dev localConfig, never in any per-site deploy file).

---

## 7. CSS namespace rules

- New panel classes: prefix `sv-` (SimpleView system primitives)
- Panel-specific variants: `sv-<panel_abbrev>-` e.g. `sv-tm-` for TaskMonitor
- Never add a new hardcoded colour to any CSS file — use a token
- The `css-namespace-guard.js` lint guard (`SimpleView/css-namespace-guard.js`)
  rejects non-`sv-` classes on migration PRs; its allowlist shrinks as panels are migrated
