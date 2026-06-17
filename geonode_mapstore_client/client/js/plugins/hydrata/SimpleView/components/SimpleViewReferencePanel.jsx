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
    Tooltip,
    PanelShell,
    PanelHeader,
    Section,
    Card,
    Table,
    FormRow
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

// Local catalogue section wrapper (NOT the Section chassis primitive — renamed
// to RefSection to avoid shadowing the imported Section from the barrel).
const RefSection = ({ title, children }) => (
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
                <RefSection title="StatusBadge">
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
                </RefSection>

                {/* ── ProgressBar ── */}
                <RefSection title="ProgressBar">
                    <Row label="0%"><ProgressBar pct={0} /></Row>
                    <Row label="42%"><ProgressBar pct={this.state.progress} /></Row>
                    <Row label="100%"><ProgressBar pct={100} /></Row>
                    <Note type="do">Use ProgressBar for all track+fill patterns. pct is clamped 0-100.</Note>
                    <Note type="dont">Don{"'"}t hardcode height or bg-color on the fill — use the sv-progress-* rules.</Note>
                </RefSection>

                {/* ── LogViewer ── */}
                <RefSection title="LogViewer">
                    <Row label="With log">
                        <LogViewer log={DEMO_LOG} />
                    </Row>
                    <Row label="Empty">
                        <LogViewer log={null} />
                    </Row>
                    <Note type="do">LogViewer uses a dark terminal bg (#1e1e1e) — this is intentional, not a drift.</Note>
                    <Note type="dont">Don{"'"}t wrap in a .simple-view-panel input rule — the bg is terminal convention.</Note>
                </RefSection>

                {/* ── Tooltip ── */}
                <RefSection title="Tooltip">
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
                </RefSection>

                {/* ── SectionHeader ── */}
                <RefSection title="SectionHeader">
                    <SectionHeader>
                        <h5>Default section header</h5>
                    </SectionHeader>
                    <SectionHeader extraClassName="anuga-section-header">
                        <h5>With extraClassName</h5>
                    </SectionHeader>
                    <Note type="do">SectionHeader always wraps children — it applies .row.menu-row.menu-row-header.</Note>
                    <Note type="dont">Don{"'"}t add text-align:center on section content — it inherits from .simple-view-panel. Override with text-align:left.</Note>
                </RefSection>

                {/* ── CategoryRail ── */}
                <RefSection title="CategoryRail">
                    <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                        <CategoryRail
                            items={DEMO_RAIL_ITEMS}
                            selectedSubHeading="Terrain"
                            onSelect={() => {}}
                            onToggleGroupVisibility={() => {}}
                        />
                    </div>
                    <Note type="do">CategoryRail owns tristate visibility + selection. Parent owns selectedSubHeading state + dispatch.</Note>
                </RefSection>

                {/* ── Chassis Primitives ── */}
                <Section title="Chassis: PanelShell (sv-panel-shell)">
                    <div className="sv-ref-row" style={{ alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ position: 'relative', width: 280, height: 80 }}>
                            <PanelShell style={{ position: 'relative', left: 'unset', top: 'unset', minWidth: 280 }}>
                                <span style={{ color: 'var(--sv-text)', fontSize: 12 }}>Dark-glass shell with blur + border</span>
                            </PanelShell>
                        </div>
                    </div>
                    <Note type="do">PanelShell owns position:absolute/fixed-right, z-index, backdrop-filter, border. Don{"'"}t recreate it per-panel.</Note>
                    <Note type="dont">Don{"'"}t nest PanelShell inside another PanelShell — it sets its own position.</Note>
                </Section>

                <Section title="Chassis: PanelHeader (sv-panel-header)">
                    <Row label="With close">
                        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}>
                            <PanelHeader title="Scenarios" onClose={() => {}} />
                        </div>
                    </Row>
                    <Row label="With actions">
                        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}>
                            <PanelHeader title="Terrain Inputs" onClose={() => {}}>
                                <button className="btn btn-xs" style={{ fontSize: 11 }}>+ New</button>
                            </PanelHeader>
                        </div>
                    </Row>
                    <Row label="No close">
                        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}>
                            <PanelHeader title="Legend" />
                        </div>
                    </Row>
                    <Note type="do">PanelHeader close chip is always position:static (never absolute) — avoids the .legend-close cascade trap.</Note>
                    <Note type="dont">Don{"'"}t add class="legend-close" to the close button — that CSS rule has position:absolute which breaks flex layout.</Note>
                </Section>

                <Section title="Chassis: Section (sv-section)">
                    <Section title="Default section (border-bottom)">
                        <span style={{ color: 'var(--sv-text-dim)', fontSize: 11 }}>Content inside a Section</span>
                    </Section>
                    <Section title="Boxed section" variant="boxed">
                        <span style={{ color: 'var(--sv-text-dim)', fontSize: 11 }}>Content inside a boxed Section</span>
                    </Section>
                    <Note type="do">Use Section to group form fields under a titled separator. variant="boxed" matches anuga-section style.</Note>
                </Section>

                <Section title="Chassis: Card (sv-card)">
                    <Row label="Default">
                        <Card style={{ width: 200 }}>
                            <span style={{ color: 'var(--sv-text)', fontSize: 11 }}>Dark-glass card body</span>
                        </Card>
                    </Row>
                    <Row label="Chart variant">
                        <Card variant="chart" title="IDF Curve" style={{ width: 200 }}>
                            <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#333', fontSize: 11 }}>Light surface for recharts</span>
                            </div>
                        </Card>
                    </Row>
                    <Row label="Dashed">
                        <Card variant="dashed" style={{ width: 200 }}>
                            <span style={{ color: 'var(--sv-text-dim)', fontSize: 11 }}>Starter card style</span>
                        </Card>
                    </Row>
                    <Row label="Info">
                        <Card variant="info" style={{ width: 200 }}>
                            <span style={{ color: 'var(--sv-text)', fontSize: 11 }}>Terrain bbox inline review</span>
                        </Card>
                    </Row>
                    <Note type="do">variant="chart": dark frame + light body (--sv-chart-surface) — TASK-1534 carve-out. recharts axes/grid read on light bg.</Note>
                    <Note type="dont">Don{"'"}t darken recharts — the carve-out exists precisely to keep chart surfaces white.</Note>
                </Section>

                <Section title="Chassis: Table (sv-table)">
                    <Row label="Dark surface">
                        <Table
                            columns={[{key: 'name', label: 'Name'}, {key: 'size', label: 'Size'}]}
                            data={[{name: 'terrain.tif', size: '342 MB'}, {name: 'mesh.pt', size: '12 MB'}]}
                        />
                    </Row>
                    <Row label="Light surface">
                        <Table
                            surface="light"
                            columns={[{key: 'dur', label: 'Duration'}, {key: 'mmh', label: 'Intensity'}]}
                            data={[{dur: '30 min', mmh: '18.5 mm/h'}, {dur: '60 min', mmh: '12.1 mm/h'}]}
                        />
                    </Row>
                    <Note type="do">surface="light" for IDF/temporal tables that sit next to recharts. surface="dark" for scenario/run/HGeval result tables.</Note>
                </Section>

                <Section title="Chassis: FormRow (sv-form-row)">
                    <FormRow label="DEM source">
                        <select className="scenario-select" style={{ width: 140 }}>
                            <option>LiDAR 1m</option>
                            <option>SRTM 30m</option>
                        </select>
                    </FormRow>
                    <FormRow label="Duration" hint="comma-separated, e.g. 15,30,60" divider>
                        <input type="text" defaultValue="15,30,60,120" style={{ width: 160 }} />
                    </FormRow>
                    <FormRow label="Latitude" layout="stacked">
                        <input type="number" defaultValue="24.33" style={{ width: 120 }} />
                    </FormRow>
                    <Note type="do">FormRow inline (default): 130px label + flex:1 field — matches anuga-scenario-pane-section. stacked: label above.</Note>
                    <Note type="dont">Don{"'"}t hand-roll label+input flex rows — they diverge in width and text-align across panels.</Note>
                </Section>

                {/* ── Shell gotchas ── */}
                <RefSection title="Shell gotchas (do/don't)">
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
                </RefSection>

                {/* ── Token swatch ── */}
                <RefSection title="Token swatches">
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
                </RefSection>
            </div>
        );
    }
}

export { SimpleViewReferencePanel };
export default SimpleViewReferencePanel;
