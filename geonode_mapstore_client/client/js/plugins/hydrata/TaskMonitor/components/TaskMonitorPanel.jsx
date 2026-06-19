/**
 * TaskMonitorPanel — dark-glass migration (TASK-1665, W2 epic/1659-simpleview-design-system).
 *
 * Structural-parity migration: preserves all DOM structure + behaviour exactly.
 * Replaces the light-theme (.tm-panel) shell with .simple-view-panel (dark-glass)
 * and migrates inner classes from tm-* to sv-tm-* (all styled in simpleView.css).
 * taskMonitor.css no longer carries any panel rules — only button-positioning remains.
 *
 * Visual shifts vs BEFORE (light theme) — enumerated for operator sign-off at W2 gate:
 *   See SIMPLEVIEW-BUILD-A-PANEL-GUIDE.md § "TaskMonitor 1665 visual-shift list".
 *
 * TASK-1784 (epic-1758 W1 pass-2, full-visual-conform): adopt the PanelShell
 * chassis primitive for the outer shell. PARITY panel — ZERO visual regression
 * target. The shell now renders through <PanelShell>, carrying the pinned
 * `.simple-view-panel` + `.sv-tm-container` classes via extraClassName so every
 * pinned test + the taskMonitor.css button-positioning keeps working. The
 * fixed-right drawer geometry (previously the double-class
 * `.simple-view-panel.sv-tm-container` rule in taskMonitor.css) is reproduced
 * verbatim via the `style` prop, because PanelShell governs geometry through
 * cascade-proof inline styles that would otherwise win over the stylesheet and
 * reset the panel to the default absolute/left:20px layout (UAT 2026-06-12
 * finding #1). PanelShell's inline chrome (bg/blur/border/radius/padding/color)
 * is token-identical to `.simple-view-panel`, so the chrome is unchanged.
 *
 * The header (sv-tm-header + .sv-legend-close close chip) and the inner content
 * (process-row list, subtask list, detail sections) are intentionally LEFT
 * bespoke for W1 — their visual treatment lives entirely in the SHARED
 * simpleView.css sv-tm-* rules (lines ~1211-1385) which W1 must NOT touch
 * (that namespace cleanup is W2/TASK-1766). Adopting PanelHeader/Section/Table/
 * Card on those surfaces would layer competing inline styles over the shared
 * CSS (and break the .sv-legend-close pinned test) → visual drift, the opposite of
 * the parity target. See the TASK-1784 gaps_flagged report.
 */

import React from 'react';
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';
import {EmptyState, PanelShell} from '../../SimpleView/components/primitives';
import FilterBar from './FilterBar';
import ProcessRow from './ProcessRow';
import ProcessDetail from './ProcessDetail';

// Fixed-right drawer geometry — reproduces the taskMonitor.css
// `.simple-view-panel.sv-tm-container` rule verbatim so PanelShell's
// cascade-proof inline styles render the panel in the SAME place/size.
// (PanelShell defaults to position:absolute/left:20px/min-width:500px, which
// would push this right-side drawer off-screen — UAT 2026-06-12 finding #1.)
const DRAWER_STYLE = {
    position: 'fixed',
    top: 'var(--sv-panel-top, 65px)',
    right: '70px',     // clear of the right toolbar button column (right: 15px)
    left: 'auto',
    width: '350px',
    minWidth: 0,
    height: 'auto',
    // stop short of the bottom edge so the corner map controls stay visible
    maxHeight: 'calc(100vh - var(--sv-panel-top, 65px) - 120px)',
    zIndex: 1200,
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.4)'
};

class TaskMonitorPanel extends React.Component {
    static propTypes = {
        processes: PropTypes.array,
        filter: PropTypes.string,
        expandedProcessId: PropTypes.string,
        showLog: PropTypes.bool,
        onClose: PropTypes.func,
        onSetFilter: PropTypes.func,
        onExpandProcess: PropTypes.func,
        onToggleLog: PropTypes.func,
        onCancel: PropTypes.func
    };

    render() {
        const {
            processes, filter, expandedProcessId, showLog,
            onClose, onSetFilter, onExpandProcess, onToggleLog, onCancel
        } = this.props;

        const expandedProcess = expandedProcessId
            ? (processes || []).find(p => p.id === expandedProcessId)
            : null;

        return (
            <PanelShell
                extraClassName="simple-view-panel sv-tm-container"
                style={DRAWER_STYLE}
            >
                {/* Header LEFT bespoke for W1: the close chip is pinned to
                    .sv-legend-close by taskMonitorComponents-test, which PanelHeader
                    cannot emit (it uses .sv-panel-header-close). Conforming the
                    header is deferred to W2 alongside the test update. */}
                <div className="sv-tm-header">
                    <h5 className="sv-tm-title">
                        <Message msgId="hydrata.taskMonitor.title" />
                    </h5>
                    <span
                        className="glyphicon glyphicon-remove sv-legend-close"
                        onClick={onClose}
                        title="Close"
                    />
                </div>
                <FilterBar activeFilter={filter} onSetFilter={onSetFilter} />
                <div className="sv-tm-process-list">
                    {(!processes || processes.length === 0) ? (
                        // TASK-1680: compose the shared EmptyState primitive (the
                        // .sv-tm-empty hook is carried via extraClassName so the
                        // existing CSS + DOM-contract test keep working).
                        <EmptyState
                            extraClassName="sv-tm-empty"
                            heading={<Message msgId="hydrata.taskMonitor.noProcesses" />}
                        />
                    ) : (
                        processes.map(p => (
                            <div key={p.id}>
                                <ProcessRow
                                    process={p}
                                    expanded={expandedProcessId === p.id}
                                    onClick={onExpandProcess}
                                />
                                {expandedProcessId === p.id ? (
                                    <ProcessDetail
                                        process={expandedProcess}
                                        showLog={showLog}
                                        onToggleLog={onToggleLog}
                                        onCancel={onCancel}
                                    />
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            </PanelShell>
        );
    }
}

export default TaskMonitorPanel;
