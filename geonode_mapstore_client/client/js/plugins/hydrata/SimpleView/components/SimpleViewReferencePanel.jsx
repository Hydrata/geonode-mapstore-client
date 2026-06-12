/**
 * SimpleViewReferencePanel — dev-only browsable catalogue of all v1 primitives.
 *
 * TASK-1662 (W2 epic/1659-simpleview-design-system)
 *
 * HOW TO OPEN ON :8081:
 *   1. Navigate to a map (e.g. http://localhost:8081/maps/1335/map_viewer — any map_viewer URL).
 *   2. A "Reference" button appears in the left toolbar next to the layer group buttons.
 *   3. Click "Reference" → the reference panel opens in the .simple-view-panel shell.
 *   4. The panel shows all v1 primitives + variants + token swatches + do/don't notes.
 *
 * REGISTRATION: this component is NOT registered in any production localConfig.
 *   It is conditionally rendered inside SimpleViewContainer ONLY when
 *   process.env.NODE_ENV !== 'production' AND the 'Reference' button is clicked.
 *   The dev localConfig (~/.../configs/localConfig.json) passes cfg.showReferencePanel=true
 *   to SimpleView; the component is dead-code-eliminated in prod builds.
 *
 * NOTE: This file imports from the primitives barrel — if a primitive drifts, this
 *   catalogue immediately breaks, which is the intended proof-of-correctness signal.
 */

import React from 'react';
import {
    StatusBadge,
    ProgressBar,
    LogViewer,
    CategoryRail,
    SectionHeader,
    Tooltip
} from './primitives';

const DEMO_LOG = [
    '[2026-06-12 10:00:01] INFO  Starting terrain assembly...',
    '[2026-06-12 10:00:02] INFO  Loading DEM priority stack (3 sources)',
    '[2026-06-12 10:00:05] INFO  Processing source 1/3: LiDAR 1m',
    '[2026-06-12 10:00:08] WARN  Source 2/3 missing CRS — reprojecting to EPSG:4326',
    '[2026-06-12 10:00:12] INFO  Merging extents...',
    '[2026-06-12 10:00:15] INFO  Done. Output: terrain_merged.tif (342 MB)'
].join('\n');

const DEMO_RAIL_ITEMS = [
    { subHeading: 'Terrain', groupLayers: [], allVisible: true, noneVisible: false },
    { subHeading: 'Catchments', groupLayers: [], allVisible: false, noneVisible: false },
    { subHeading: 'Base Maps', groupLayers: [], allVisible: false, noneVisible: true }
];

const Section = ({ title, children }) => (
    <div className="sv-ref-section">
        <div className="sv-ref-section-title">{title}</div>
        {children}
    </div>
);

const Row = ({ label, children }) => (
    <div className="sv-ref-row">
        {label && <span className="sv-ref-label">{label}</span>}
        {children}
    </div>
);

const Note = ({ type, children }) => (
    <div className={type === 'do' ? 'sv-ref-do' : type === 'dont' ? 'sv-ref-dont' : 'sv-ref-note'}>
        {type === 'do' ? '✓ DO: ' : type === 'dont' ? '✗ DON\'T: ' : ''}{children}
    </div>
);

class SimpleViewReferencePanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = { progress: 42 };
    }

    render() {
        return (
            <div className="sv-ref-panel">
                <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 15, color: 'var(--sv-text)' }}>
                        SimpleView Design System v1 — Primitive Catalogue
                    </strong>
                    <div className="sv-ref-note" style={{ marginTop: 4 }}>
                        Dev-only (TASK-1662). Every item is composed from the primitives barrel —
                        if a primitive drifts, this panel breaks first.
                    </div>
                </div>

                {/* ── StatusBadge ── */}
                <Section title="StatusBadge">
                    <Row label="States">
                        <StatusBadge status="running" />
                        <StatusBadge status="pending" />
                        <StatusBadge status="complete" />
                        <StatusBadge status="error" />
                        <StatusBadge status="cancelled" />
                    </Row>
                    <Row label="Labels">
                        <StatusBadge status="running" label="In Progress" />
                        <StatusBadge status="complete" label="Done" />
                        <StatusBadge status="error" label="Failed" />
                    </Row>
                    <Row label="Compact">
                        <StatusBadge status="running" compact />
                        <StatusBadge status="complete" compact />
                        <StatusBadge status="error" compact />
                    </Row>
                    <Row label="With glyph">
                        <StatusBadge status="running" showGlyph />
                        <StatusBadge status="complete" showGlyph />
                        <StatusBadge status="error" showGlyph />
                        <StatusBadge status="cancelled" showGlyph compact />
                    </Row>
                    <Note type="do">Use StatusBadge for all 5 process states — never handwrite tm-badge classes.</Note>
                    <Note type="dont">Don{"'"}t add new hardcoded colours — map to is-ok/is-err/is-warn/is-running/is-cancelled.</Note>
                </Section>

                {/* ── ProgressBar ── */}
                <Section title="ProgressBar">
                    <Row label="0%"><ProgressBar pct={0} /></Row>
                    <Row label="42%"><ProgressBar pct={this.state.progress} /></Row>
                    <Row label="100%"><ProgressBar pct={100} /></Row>
                    <Note type="do">Use ProgressBar for all track+fill patterns. pct is clamped 0-100.</Note>
                    <Note type="dont">Don{"'"}t hardcode height or bg-color on the fill — use the sv-progress-* rules.</Note>
                </Section>

                {/* ── LogViewer ── */}
                <Section title="LogViewer">
                    <Row label="With log">
                        <LogViewer log={DEMO_LOG} />
                    </Row>
                    <Row label="Empty">
                        <LogViewer log={null} />
                    </Row>
                    <Note type="do">LogViewer uses a dark terminal bg (#1e1e1e) — this is intentional, not a drift.</Note>
                    <Note type="dont">Don{"'"}t wrap in a .simple-view-panel input rule — the bg is terminal convention.</Note>
                </Section>

                {/* ── Tooltip ── */}
                <Section title="Tooltip">
                    <Row label="Tag w/ hover">
                        <Tooltip label="DEM" placement="bottom">
                            Digital Elevation Model — the terrain raster this scenario derives from.
                        </Tooltip>
                        <Tooltip label="CRS" placement="bottom">
                            Coordinate Reference System — how map coordinates map to the Earth.
                        </Tooltip>
                    </Row>
                    <Row label="No glyph">
                        <Tooltip label="hover me" showGlyph={false} placement="bottom">
                            Bubble without the info glyph on the trigger.
                        </Tooltip>
                    </Row>
                    <Note type="do">Tooltip triggers are real tab stops — the bubble opens on keyboard focus too, and Escape dismisses it.</Note>
                    <Note type="dont">Don{"'"}t body-portal tooltip bubbles — they fight the .gn-page-wrapper z-index stack. The bubble positions off the trigger.</Note>
                </Section>

                {/* ── SectionHeader ── */}
                <Section title="SectionHeader">
                    <SectionHeader>
                        <h5>Default section header</h5>
                    </SectionHeader>
                    <SectionHeader extraClassName="anuga-section-header">
                        <h5>With extraClassName</h5>
                    </SectionHeader>
                    <Note type="do">SectionHeader always wraps children — it applies .row.menu-row.menu-row-header.</Note>
                    <Note type="dont">Don{"'"}t add text-align:center on section content — it inherits from .simple-view-panel. Override with text-align:left.</Note>
                </Section>

                {/* ── CategoryRail ── */}
                <Section title="CategoryRail">
                    <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                        <CategoryRail
                            items={DEMO_RAIL_ITEMS}
                            selectedSubHeading="Terrain"
                            onSelect={() => {}}
                            onToggleGroupVisibility={() => {}}
                        />
                    </div>
                    <Note type="do">CategoryRail owns tristate visibility + selection. Parent owns selectedSubHeading state + dispatch.</Note>
                </Section>

                {/* ── Shell gotchas ── */}
                <Section title="Shell gotchas (do/don't)">
                    <Note type="dont">
                        .simple-view-panel sets text-align:center — all content inherits it.
                        Always set text-align:left on containers that need left-aligned text.
                    </Note>
                    <Note type="dont">
                        .msgapi .simple-view-panel input has specificity (0,3,1) — it beats plain
                        input rules. Use the transparent-input variant (Input primitive) or add
                        !important to override.
                    </Note>
                    <Note type="do">
                        Consume only --sv-* tokens. Never hardcode a colour that a token covers.
                    </Note>
                    <Note type="do">
                        See SimpleView/BUILD-A-PANEL-GUIDE.md for the full panel skeleton + worked example.
                    </Note>
                </Section>

                {/* ── Token swatch ── */}
                <Section title="Token swatches">
                    {[
                        { name: '--sv-panel-bg', sample: 'rgba(0,60,136,0.88)' },
                        { name: '--sv-text', sample: 'rgba(255,255,255,0.85)' },
                        { name: '--sv-text-dim', sample: 'rgba(255,255,255,0.68)' },
                        { name: '--sv-input-blue', sample: '#5178af' },
                        { name: '--sv-input-bg', sample: 'rgba(255,255,255,0.22)' },
                        { name: '--sv-info-bg', sample: 'rgba(91,192,222,0.12)' },
                        { name: '--sv-info-border', sample: '#5bc0de' },
                        { name: '--sv-delete-error-border', sample: '#dc3545' },
                        { name: '--sv-glyph-active', sample: 'limegreen' },
                        { name: '--sv-glyph-inactive', sample: 'red' }
                    ].map(({ name, sample }) => (
                        <div key={name} className="sv-ref-row" style={{ marginBottom: 3 }}>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 14, height: 14,
                                    borderRadius: 2,
                                    background: sample,
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    marginRight: 6,
                                    flexShrink: 0
                                }}
                            />
                            <span style={{ fontSize: 10, color: 'var(--sv-text)', fontFamily: 'monospace' }}>{name}</span>
                            <span style={{ fontSize: 9, color: 'var(--sv-text-dim)', marginLeft: 6 }}>{sample}</span>
                        </div>
                    ))}
                </Section>
            </div>
        );
    }
}

export { SimpleViewReferencePanel };
export default SimpleViewReferencePanel;
