import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import HydrologyDetailIdfTable from './hydrologyDetailIdfTable';
import HydrologyDetailIdfDerive from './hydrologyDetailIdfDerive';
import HydrologyDetailTemporalPattern, { validateCustomCurve } from './hydrologyDetailTemporalPattern';
import HydrologyDetailTimeSeries, {HydrologyTimeSeriesCreatePanel} from './hydrologyDetailTimeSeries';
import {
    setActiveHydrologyItem,
    setActiveHydrologyPage,
    saveHydrologyItem,
    updateActiveHydrologyItem,
    deleteHydrologyItem,
    createHydrologyForm,
    // TASK-1561 (W3b) — stale Regenerate
    saveDesignStormsRequest
} from "../actionsHydrology";

// TASK-1561 (W3b) — parse the BE source string for a design-storm row so we
// can rebuild the derive cells needed to regenerate a (idf, pattern) group.
// Format (from BE): "design_storm|pattern=SCS_TYPE_II|pattern_type=preset|
//   idf_table_id=42|ari=100.00yr|aep=1.0000pct|duration_min=1440|
//   timestep_min=60|total_depth_mm=..."
// Returns null on any parse failure so callers can gate safely.
export function parseDesignStormSource(source) {
    if (!source || typeof source !== 'string') return null;
    if (!source.startsWith('design_storm|')) return null;
    try {
        const result = {};
        source.split('|').slice(1).forEach(part => {
            const eq = part.indexOf('=');
            if (eq < 0) return;
            const k = part.slice(0, eq);
            let v = part.slice(eq + 1);
            // Strip trailing unit suffixes: "100.00yr" → 100, "1.0000pct" → 1
            const numMatch = v.match(/^([\d.]+)(yr|pct)?$/);
            if (numMatch) {
                result[k] = Number(numMatch[1]);
            } else {
                result[k] = v;
            }
        });
        // Require at minimum the fields needed to rebuild a cell.
        if (!result.pattern || !result.duration_min || !result.timestep_min) return null;
        if (!result.ari && !result.aep) return null;
        return result;
    } catch (_e) {
        return null;
    }
}
import {hydrologyKeyMap} from '../reducersHydrology';
import {trackEvent} from "@js/utils/analytics";
import PropTypes from "prop-types";
import Message from '@mapstore/framework/components/I18N/Message';
import ConfirmOverlay from '../../shared/ConfirmOverlay';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';
// TASK-1557 (W2) — gate the delete affordance on MANAGER role. canManageAnugaMap
// reads state.anuga.projects.data.my_role and is true for ['owner','manager'];
// the BE is the authoritative gate (perform_destroy MANAGER check), this just
// hides the UI for users who would 403.
import {canManageAnugaMap} from "@js/plugins/hydrata/Anuga/selectorsAnuga";

// TASK-1538 — map each hydrology page to the i18n key for its auto-name base
// label, so "New Item" default names ('IDF Table 03', etc.) are localised for
// es/fr/ht users. Resolved in the component (which has the i18n context) and
// passed into createHydrologyForm; the reducer keeps an English fallback map.
const hydrologyAutoNameMsgId = {
    'idf-table': 'hydrata.hydrology.idfTable',
    'temporal-pattern': 'hydrata.hydrology.temporalPattern',
    'time-series': 'hydrata.hydrology.timeSeries'
};

class HydrologyListDetailContainerClass extends React.Component {
    static propTypes = {
        activeHydrologyPage: PropTypes.string,
        activeHydrologyItems: PropTypes.array,
        idfTables: PropTypes.array,
        activeHydrologyItem: PropTypes.object,
        setActiveHydrologyItem: PropTypes.func,
        setActiveHydrologyPage: PropTypes.func,
        saveHydrologyItem: PropTypes.func,
        updateActiveHydrologyItem: PropTypes.func,
        deleteHydrologyItem: PropTypes.func,
        createHydrologyForm: PropTypes.func,
        // TASK-1509 — non-null when the active item is a custom temporal pattern
        // whose curve fails validateCustomCurve; disables the Save button.
        customCurveError: PropTypes.string,
        // TASK-1557 (W2) — true for ['owner','manager'] on the active project;
        // gates the per-row trash + footer Delete affordances.
        canManageHydrology: PropTypes.bool,
        // TASK-1561 (W3b) — full time-series list for stale Regenerate
        timeSeriess: PropTypes.array,
        saveDesignStorms: PropTypes.func
    }

    static defaultProps = {}

    // TASK-1538 — pull intl messages off React legacy context so createItem can
    // resolve the localised auto-name base label at dispatch time (mirrors the
    // idiom in hydrologyDetailIdfTable).
    static contextTypes = {
        messages: PropTypes.object
    }

    constructor(props) {
        super(props);
        // TASK-1409 — inline confirm overlay state replaces window.confirm.
        // deleteConfirmVisible → the footer (active-item) delete confirm.
        // deleteConfirmItemId → the per-row list delete confirm (the trash
        // button on an item row opens an inline ConfirmOverlay for that id).
        this.state = {
            deleteConfirmVisible: false,
            deleteConfirmItemId: null,
            // TASK-1558 (W2) — Create-panel mode for the time-series (Design
            // Storms) page. tsCreateMode toggles col-two from the slim DETAIL to
            // the two-tab CREATE panel; tsCreateTab selects Input|Derive.
            // Entered by "New Item" on the time-series page (enterTimeSeriesCreate),
            // exited by selecting a saved list item or "Back to list"
            // (exitTimeSeriesCreate). Scoped to time-series; idf/temporal pages
            // are unaffected.
            tsCreateMode: false,
            tsCreateTab: 'input',
            // TASK-1557 (W2) — hidable name-search filter above the items list.
            // filterText narrows the rendered rows by a case-insensitive name
            // substring; filtersCollapsed hides the search box (collapsed by
            // default so the rail stays compact until the user opens it).
            filterText: '',
            filtersCollapsed: true
        };
    }

    // TASK-1558 (W2) — enter Create mode for the time-series page. Called after
    // a new time-series instance is created so "New Item" opens the Create panel
    // rather than dropping the user straight into the (now slim) detail.
    enterTimeSeriesCreate = () => {
        this.setState({tsCreateMode: true, tsCreateTab: 'input'});
    }

    // Exit Create mode. The unsaved instance is discarded by clearing the active
    // item so it does not orphan in the list (the reducer drops temp-* ids that
    // were never saved). Callers that select a real saved item pass it through.
    exitTimeSeriesCreate = (selectedItem) => {
        this.setState({tsCreateMode: false});
        if (selectedItem) {
            this.props.setActiveHydrologyItem(selectedItem);
        } else {
            this.props.setActiveHydrologyItem(null);
        }
    }

    // TASK-1497 (UAT note-5) — the "Items" column renders on BOTH the Manual
    // (idf-table) and Derive (idf-derive) pages so the left rail stays present
    // when switching IDF modes. On the Derive page it lists the existing IDF
    // tables; selecting one (or "New Item") jumps to the Manual editor with
    // that item active, since Derive is a one-shot form that has no active item.
    renderItemsColumn = () => {
        const onDerive = this.props.activeHydrologyPage === 'idf-derive';
        const allItems = onDerive ? this.props.idfTables : this.props.activeHydrologyItems;
        // TASK-1557 (W2) — name-search filter (case-insensitive substring). The
        // search box is collapsible; when collapsed (or empty) every item shows.
        const filterText = (this.state.filterText || '').trim().toLowerCase();
        const items = filterText
            ? (allItems || []).filter((item) => (item?.name || '').toLowerCase().includes(filterText))
            : allItems;
        const selectItem = (item) => {
            // TASK-1558 — selecting a SAVED list item always shows the slim
            // detail (exit Create mode if it was open) on the time-series page.
            if (this.props.activeHydrologyPage === 'time-series' && this.state.tsCreateMode) {
                this.setState({tsCreateMode: false});
            }
            this.props.setActiveHydrologyItem(item);
            if (onDerive) this.props.setActiveHydrologyPage('idf-table');
        };
        // Delete targets the resource page, not the literal active page: on the
        // Derive page the listed items are IDF tables, so deletes route to
        // 'idf-table' (mirrors selectItem's page switch).
        const deletePage = onDerive ? 'idf-table' : this.props.activeHydrologyPage;
        const messages = (this.context && this.context.messages) || {};
        const resolvedDelete = getMessageById(messages, 'hydrata.hydrology.delete');
        const deleteTitle = (resolvedDelete && resolvedDelete !== 'hydrata.hydrology.delete')
            ? resolvedDelete : 'Delete';
        // TASK-1557 (W2) — resolve the filter labels here (the component has the
        // i18n context); getMessageById returns the key unchanged when missing,
        // so fall back to English copy in that case.
        const resolveMsg = (key, fallback) => {
            const m = getMessageById(messages, key);
            return (m && m !== key) ? m : fallback;
        };
        const filterTitle = resolveMsg('hydrata.hydrology.filterToggle', 'Search items');
        const filterPlaceholder = resolveMsg('hydrata.hydrology.filterPlaceholder', 'Search by name…');
        // TASK-1557 (W2) — the delete affordance (per-row trash + the inline
        // confirm) is hidden for non-managers; the BE 403s them anyway.
        const canManageHydrology = this.props.canManageHydrology;
        const createItem = () => {
            const page = onDerive ? 'idf-table' : this.props.activeHydrologyPage;
            if (onDerive) this.props.setActiveHydrologyPage('idf-table');
            // TASK-1538 — resolve the locale base label here (the reducer has no
            // i18n context). getMessageById returns the msgId unchanged when the
            // key is missing, so leave it undefined in that case to let the
            // reducer fall back to its English label map.
            const msgId = hydrologyAutoNameMsgId[page];
            const resolved = msgId ? getMessageById(messages, msgId) : undefined;
            const autoNameLabel = (resolved && resolved !== msgId) ? resolved : undefined;
            this.props.createHydrologyForm(page, autoNameLabel);
            // TASK-1558 — on the time-series page, "New Item" opens the two-tab
            // Create panel (Input|Derive) rather than the slim detail.
            if (page === 'time-series') {
                this.enterTimeSeriesCreate();
            }
        };
        return (
            <div id={"hydrology-list-detail-col-one"}>
                <div id={"hydrology-list-detail-items"}>
                    <div id={"top-buttons"} style={{display: "flex", flexDirection: "column"}}>
                        <div className={"hydrology-list-detail-heading hydrology-items-heading"}>
                            <Message msgId="hydrata.hydrology.items" />
                            {/* TASK-1557 (W2) — toggle the name-search filter. The
                                magnifier flips the collapsed state; a tiny clear
                                affordance lives inside the input itself. */}
                            <button
                                type="button"
                                className={
                                    'hydrology-filter-toggle'
                                    + (this.state.filtersCollapsed ? '' : ' is-open')
                                }
                                title={filterTitle}
                                aria-label={filterTitle}
                                aria-expanded={!this.state.filtersCollapsed}
                                onClick={() => this.setState((s) => ({
                                    filtersCollapsed: !s.filtersCollapsed,
                                    // Clear the query when hiding the box so a
                                    // stale filter can't silently hide rows.
                                    filterText: s.filtersCollapsed ? s.filterText : ''
                                }))}
                            >
                                <span className="glyphicon glyphicon-search" aria-hidden="true" />
                            </button>
                        </div>
                        {!this.state.filtersCollapsed && (
                            <input
                                type="text"
                                className={"hydrology-filter-input"}
                                placeholder={filterPlaceholder}
                                aria-label={filterPlaceholder}
                                value={this.state.filterText}
                                onChange={(e) => this.setState({filterText: e.target.value})}
                            />
                        )}
                        {items?.map((item) => {
                            const isActive = item.id === this.props.activeHydrologyItem?.id;
                            // TASK-1557 (W2) — the per-row delete confirm only
                            // ever opens for a manager (the trash button is
                            // hidden otherwise), but guard the confirm branch too
                            // so a non-manager can never reach the delete path.
                            const confirming = canManageHydrology
                                && this.state.deleteConfirmItemId === item.id;
                            return (
                                <div key={item.id} className={"hydrology-item-row"}>
                                    {confirming ? (
                                        // Per-row delete confirm — reuses the shared
                                        // ConfirmOverlay (NOT window.confirm), same as the
                                        // footer delete. Default copy ("…are you sure?").
                                        <ConfirmOverlay
                                            wrapperClassName="hydrology-item-delete-confirm"
                                            buttonClassName="hydrology-button"
                                            confirmClassName="hydrology-delete-confirm-btn"
                                            onCancel={() => this.setState({deleteConfirmItemId: null})}
                                            onConfirm={() => {
                                                this.setState({deleteConfirmItemId: null});
                                                this.props.deleteHydrologyItem(deletePage, item);
                                            }}
                                            confirmLabel={<Message msgId="hydrata.hydrology.delete" />}
                                        />
                                    ) : (
                                        <React.Fragment>
                                            <button
                                                className={"hydrology-button hydrology-item-button"}
                                                style={{
                                                    // TASK-1528 — existing items use the base plugin BLUE
                                                    // (selected full-opacity, others lighter); the green is
                                                    // now reserved for the "New Item" / Save buttons.
                                                    backgroundColor: isActive ? "rgba(82,121,176,1)" : "rgba(82,121,176,0.6)"
                                                }}
                                                onClick={() => selectItem(item)}
                                            >
                                                {item?.name}
                                                {/* TASK-1561 (W3b) — stale badge for auto-derived rows */}
                                                {item?.is_stale && (
                                                    <span
                                                        className="ds-stale-badge"
                                                        title="Base IDF changed since this was saved"
                                                        aria-label="Stale: base IDF changed"
                                                        style={{marginLeft: 6}}
                                                    >
                                                        <span className="glyphicon glyphicon-warning-sign" aria-hidden="true" />
                                                    </span>
                                                )}
                                            </button>
                                            {/* TASK-1561 (W3b) — Regenerate button for stale auto-derived rows.
                                                CONTRIBUTOR-level (no canManageHydrology gate). */}
                                            {item?.is_stale && item?.is_auto_derived && (
                                                <button
                                                    type="button"
                                                    className="ds-regenerate-btn"
                                                    title="Regenerate from current IDF"
                                                    aria-label="Regenerate"
                                                    onClick={() => {
                                                        // Collect all auto-derived rows sharing (idf, pattern)
                                                        const allTs = this.props.timeSeriess || [];
                                                        const idfId = item.derived_from_idf;
                                                        const pattern = item.pattern;
                                                        if (!idfId || !pattern) return;
                                                        const siblings = allTs.filter(
                                                            ts => ts.is_auto_derived
                                                                && ts.derived_from_idf === idfId
                                                                && ts.pattern === pattern
                                                        );
                                                        const cells = siblings
                                                            .map(ts => parseDesignStormSource(ts.source))
                                                            .filter(Boolean)
                                                            .map(parsed => ({
                                                                pattern: parsed.pattern,
                                                                ari: parsed.ari,
                                                                duration_min: parsed.duration_min,
                                                                timestep_min: parsed.timestep_min || 60
                                                            }));
                                                        if (cells.length > 0 && this.props.saveDesignStorms) {
                                                            this.props.saveDesignStorms(cells, idfId);
                                                        }
                                                    }}
                                                >
                                                    <span className="glyphicon glyphicon-refresh" aria-hidden="true" />
                                                </button>
                                            )}
                                            {/* TASK-1557 (W2) — per-row delete is
                                                MANAGER-only; the BE 403s a
                                                non-manager regardless. */}
                                            {canManageHydrology && (
                                                <button
                                                    type="button"
                                                    className={"hydrology-item-delete-btn"}
                                                    title={deleteTitle}
                                                    aria-label={deleteTitle}
                                                    onClick={() => this.setState({deleteConfirmItemId: item.id})}
                                                >
                                                    <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                                                </button>
                                            )}
                                        </React.Fragment>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div id={"bottom-buttons"}>
                        <button
                            className={"hydrology-button"}
                            // TASK-1528 — "New Item" gets the GREEN accent (was the
                            // inherited base blue); existing items are now blue.
                            style={{marginTop: "10px", backgroundColor: "rgba(39,202,59,1)"}}
                            onClick={createItem}
                        >
                            <Message msgId="hydrata.hydrology.newItem" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        // TASK-1448 (W1) + TASK-1452 (W5) — IDF segmented control:
        // "Manual" (idf-table editable grid) | "Derive" (idf-derive stepper).
        // Opens on Derive (the common path). Polished pill segmented control.
        const isIdfPage = this.props.activeHydrologyPage === 'idf-table'
            || this.props.activeHydrologyPage === 'idf-derive';
        // TASK-1509 — block Save when the active custom temporal-pattern curve
        // is invalid (the BE clean() would reject it with a 400 otherwise).
        const customCurveError = this.props.customCurveError;
        // TASK-1557 (W2) — gate the footer Delete on MANAGER (mirrors the
        // per-row trash gate); the BE 403s a non-manager regardless.
        const canManageHydrology = this.props.canManageHydrology;
        const IdfSubToggle = isIdfPage ? (
            <div className={"hydrology-idf-subtoggle"} role="group" aria-label="IDF mode">
                <button
                    id="idf-mode-manual"
                    className={
                        'hydrology-idf-segment'
                        + (this.props.activeHydrologyPage === 'idf-table' ? ' is-active' : '')
                    }
                    onClick={() => this.props.setActiveHydrologyPage('idf-table')}
                >
                    <Message msgId="hydrata.hydrology.idfModeManual" />
                </button>
                <button
                    id="idf-mode-derive"
                    className={
                        'hydrology-idf-segment'
                        + (this.props.activeHydrologyPage === 'idf-derive' ? ' is-active' : '')
                    }
                    onClick={() => this.props.setActiveHydrologyPage('idf-derive')}
                >
                    <Message msgId="hydrata.hydrology.idfModeDerive" />
                </button>
            </div>
        ) : null;

        // TASK-934 — IDF Derive is a one-shot form, not a list-of-items
        // workflow, so it keeps its own submit state and bypasses the
        // save/delete footer. TASK-1497 (UAT note-5): the "Items" column IS
        // shown here now (renderItemsColumn) for left-rail consistency.
        if (this.props.activeHydrologyPage === 'idf-derive') {
            return (
                <div id={"hydrology-list-detail-container"}>
                    {IdfSubToggle}
                    <div id={"hydrology-list-detail-body"}>
                        {this.renderItemsColumn()}
                        <div id={"hydrology-list-detail-col-two"}>
                            <div id={"hydrology-idf-derive-container"} className="idf-derive-container">
                                <HydrologyDetailIdfDerive/>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div id={"hydrology-list-detail-container"}>
                {IdfSubToggle}
                <div id={"hydrology-list-detail-body"}>
                    {this.renderItemsColumn()}
                    <div id={"hydrology-list-detail-col-two"}>
                        <div id={"hydrology-detail-container"}>
                            {
                                this.props.activeHydrologyItem
                                    ? <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        padding: "2px"
                                    }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            boxSizing: 'border-box',
                                            paddingTop: "5px"
                                        }}>
                                            <p style={{marginRight: '5px', width: "100px"}}><Message msgId="hydrata.hydrology.name" /></p>
                                            <input
                                                id={'name'}
                                                key={`name-${this.props.activeHydrologyItem.id}`}
                                                type={"text"}
                                                className={'hydrology-text-input'}
                                                style={{textAlign: "left"}}
                                                value={this.props.activeHydrologyItem.name}
                                                onChange={(e) => this.handleTextChange(e, this.props.activeHydrologyItem)}
                                            />
                                        </div>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            boxSizing: 'border-box'
                                        }}>
                                            <p style={{marginRight: '5px', width: "100px"}}><Message msgId="hydrata.hydrology.source" /></p>
                                            {this.props.activeHydrologyPage === 'time-series' ? (
                                                // TASK-1556 (W2) — on the Design Storms (time-series) page the
                                                // detail is a SLIM record view: source is provenance, shown
                                                // READ-ONLY. Empty / the placeholder default reads "Manual
                                                // entry". The idf-table/temporal-pattern pages keep an editable
                                                // <input> (out of scope), so this branch is page-gated.
                                                <p
                                                    id={'source'}
                                                    className={'hydrology-source-provenance'}
                                                    style={{textAlign: "left", margin: 0, color: "rgba(255,255,255,0.85)"}}
                                                >
                                                    {(() => {
                                                        const src = this.props.activeHydrologyItem.source;
                                                        if (!src || src === 'Enter source') {
                                                            return <Message msgId="hydrata.hydrology.manualEntry" />;
                                                        }
                                                        // Design-storm rows carry a pipe-delimited provenance
                                                        // string — render it as a human-readable line, never the
                                                        // raw blob (D5: source is provenance shown read-only).
                                                        const parsed = parseDesignStormSource(src);
                                                        if (parsed) {
                                                            const ariLabel = parsed.ari
                                                                ? `ARI ${parsed.ari}yr`
                                                                : (parsed.aep ? `AEP ${parsed.aep}%` : '');
                                                            const depth = parsed.total_depth_mm
                                                                ? ` · ${Number(parsed.total_depth_mm).toFixed(1)} mm`
                                                                : '';
                                                            return `Derived · ${String(parsed.pattern).replace(/_/g, ' ')}`
                                                                + ` · ${ariLabel} · ${parsed.duration_min} min${depth}`;
                                                        }
                                                        return src;
                                                    })()}
                                                </p>
                                            ) : (
                                                <input
                                                    id={'source'}
                                                    key={`source-${this.props.activeHydrologyItem.id}`}
                                                    type={"text"}
                                                    className={'hydrology-text-input'}
                                                    style={{textAlign: "left"}}
                                                    value={this.props.activeHydrologyItem.source}
                                                    onChange={(e) => this.handleTextChange(e, this.props.activeHydrologyItem)}
                                                />
                                            )}
                                        </div>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            boxSizing: 'border-box'
                                        }}>
                                            <p style={{marginRight: '5px', width: "100px"}}><Message msgId="hydrata.hydrology.description" /></p>
                                            <textarea
                                                id={'description'}
                                                key={`description-${this.props.activeHydrologyItem.id}`}
                                                className={'hydrology-text-input hyrdology-textarea'}
                                                rows={1}
                                                style={{textAlign: "left", resize: "vertical", width: "685px"}}
                                                value={this.props.activeHydrologyItem.description}
                                                onChange={(e) => this.handleTextChange(e, this.props.activeHydrologyItem)}
                                            />
                                        </div>
                                        {(() => {
                                            switch (this.props.activeHydrologyPage) {
                                            case 'idf-table':
                                                return <HydrologyDetailIdfTable/>;
                                            case 'temporal-pattern':
                                                return <HydrologyDetailTemporalPattern/>;
                                            case 'time-series':
                                                // TASK-1558 (W2) — "New Item" opens the two-tab CREATE
                                                // panel (Input|Derive); selecting a saved item shows the
                                                // slim record-centric DETAIL (TASK-1556).
                                                return this.state.tsCreateMode
                                                    ? <HydrologyTimeSeriesCreatePanel
                                                        activeTab={this.state.tsCreateTab}
                                                        onTabChange={(tab) => this.setState({tsCreateTab: tab})}
                                                        onBack={() => this.exitTimeSeriesCreate()}
                                                    />
                                                    : <HydrologyDetailTimeSeries/>;
                                            default:
                                                return <div/>;
                                            }
                                        })()}
                                    </div>
                                    : <div><Message msgId="hydrata.hydrology.selectItem" /></div>
                            }
                        </div>
                    </div>
                </div>
                <div id={"hydrology-list-detail-footer"}>
                    {/* TASK-1438: shared ConfirmOverlay replaces the inline copy-paste.
                        TASK-1557 (W2): the whole Delete affordance is MANAGER-gated. */}
                    {canManageHydrology && (this.state.deleteConfirmVisible ? (
                        <ConfirmOverlay
                            wrapperClassName="hydrology-delete-confirm"
                            buttonClassName="hydrology-button"
                            confirmClassName="hydrology-delete-confirm-btn"
                            onCancel={() => this.setState({deleteConfirmVisible: false})}
                            onConfirm={() => {
                                this.setState({deleteConfirmVisible: false});
                                this.props.deleteHydrologyItem(this.props.activeHydrologyPage, this.props.activeHydrologyItem);
                            }}
                            confirmLabel={<Message msgId="hydrata.hydrology.delete" />}
                        />
                    ) : (
                        <button
                            className={"hydrology-button"}
                            style={{backgroundColor: "darkred"}}
                            onClick={() => this.setState({deleteConfirmVisible: true})}
                        >
                            <Message msgId="hydrata.hydrology.delete" />
                        </button>
                    ))}
                    <button
                        className={(this.props.activeHydrologyItem?.unsaved && !customCurveError) ? "hydrology-button" : "hydrology-button-disabled"}
                        style={{backgroundColor: (this.props.activeHydrologyItem?.unsaved && !customCurveError) ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"}}
                        disabled={!!customCurveError}
                        title={customCurveError ? `Fix validation errors first: ${customCurveError}` : undefined}
                        onClick={() => {
                            if (customCurveError) { return; }
                            this.props.saveHydrologyItem(this.props.activeHydrologyPage, this.props.activeHydrologyItem);
                        }}
                    >
                        <Message msgId="hydrata.hydrology.save" />
                    </button>
                </div>
            </div>
        );
    }

    handleTextChange = (e, item) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateActiveHydrologyItem(this.props.activeHydrologyPage, item, kv);
    }

    trackEvent = (page) => {
        trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    }


}

const mapStateToProps = (state) => {
    const activeHydrologyItem = state?.hydrology?.activeHydrologyItem;
    // TASK-1509 — recompute the custom-curve validity on every store change
    // (the custom editor commits rowData through Redux, TASK-1508). null for
    // non-custom items, so the Save button is only ever blocked for an invalid
    // custom temporal pattern. Reuses the editor's own validateCustomCurve.
    const customCurveError = activeHydrologyItem?.pattern_type === 'custom'
        ? validateCustomCurve(activeHydrologyItem.rowData)
        : null;
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyItems: state?.hydrology[hydrologyKeyMap[state.hydrology.activeHydrologyPage]],
        // TASK-1497 (UAT note-5) — IDF tables for the Items column on the
        // Derive page (where activeHydrologyItems is undefined).
        idfTables: state?.hydrology?.idfTables,
        activeHydrologyItem,
        customCurveError,
        // TASK-1557 (W2) — MANAGER gate for the delete affordances.
        canManageHydrology: canManageAnugaMap(state),
        // TASK-1561 (W3b) — full time-series list for stale Regenerate
        timeSeriess: state?.hydrology?.timeSeriess || []
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        setActiveHydrologyPage: (page) => dispatch(setActiveHydrologyPage(page)),
        updateActiveHydrologyItem: (activeHydrologyPage, item, kv) => dispatch(updateActiveHydrologyItem(activeHydrologyPage, item, kv)),
        saveHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(saveHydrologyItem(activeHydrologyPage, activeHydrologyItem)),
        createHydrologyForm: (activeHydrologyPage, autoNameLabel) => dispatch(createHydrologyForm(activeHydrologyPage, autoNameLabel)),
        deleteHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(deleteHydrologyItem(activeHydrologyPage, activeHydrologyItem)),
        // TASK-1561 (W3b) — dispatch bulk save for Regenerate
        saveDesignStorms: (cells, idfTableId) => dispatch(saveDesignStormsRequest(cells, idfTableId))
    };
};

const HydrologyListDetailContainer = connect(mapStateToProps, mapDispatchToProps)(HydrologyListDetailContainerClass);


export {
    HydrologyListDetailContainer,
    HydrologyListDetailContainerClass
};
