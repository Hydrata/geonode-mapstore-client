import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import HydrologyDetailIdfTable from './hydrologyDetailIdfTable';
import HydrologyDetailIdfDerive from './hydrologyDetailIdfDerive';
import HydrologyDetailTemporalPattern, { validateCustomCurve } from './hydrologyDetailTemporalPattern';
import HydrologyDetailTimeSeries from './hydrologyDetailTimeSeries';
import {
    setActiveHydrologyItem,
    setActiveHydrologyPage,
    saveHydrologyItem,
    updateActiveHydrologyItem,
    deleteHydrologyItem,
    createHydrologyForm
} from "../actionsHydrology";
import {hydrologyKeyMap} from '../reducersHydrology';
import {trackEvent} from "@js/utils/analytics";
import PropTypes from "prop-types";
import Message from '@mapstore/framework/components/I18N/Message';
import ConfirmOverlay from '../../shared/ConfirmOverlay';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';

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
        customCurveError: PropTypes.string
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
            deleteConfirmItemId: null
        };
    }

    // TASK-1497 (UAT note-5) — the "Items" column renders on BOTH the Manual
    // (idf-table) and Derive (idf-derive) pages so the left rail stays present
    // when switching IDF modes. On the Derive page it lists the existing IDF
    // tables; selecting one (or "New Item") jumps to the Manual editor with
    // that item active, since Derive is a one-shot form that has no active item.
    renderItemsColumn = () => {
        const onDerive = this.props.activeHydrologyPage === 'idf-derive';
        const items = onDerive ? this.props.idfTables : this.props.activeHydrologyItems;
        const selectItem = (item) => {
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
        };
        return (
            <div id={"hydrology-list-detail-col-one"}>
                <div id={"hydrology-list-detail-items"}>
                    <div id={"top-buttons"} style={{display: "flex", flexDirection: "column"}}>
                        <div className={"hydrology-list-detail-heading"}><Message msgId="hydrata.hydrology.items" /></div>
                        {items?.map((item) => {
                            const isActive = item.id === this.props.activeHydrologyItem?.id;
                            const confirming = this.state.deleteConfirmItemId === item.id;
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
                                            </button>
                                            <button
                                                type="button"
                                                className={"hydrology-item-delete-btn"}
                                                title={deleteTitle}
                                                aria-label={deleteTitle}
                                                onClick={() => this.setState({deleteConfirmItemId: item.id})}
                                            >
                                                <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                                            </button>
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
                                            <input
                                                id={'source'}
                                                key={`source-${this.props.activeHydrologyItem.id}`}
                                                type={"text"}
                                                className={'hydrology-text-input'}
                                                style={{textAlign: "left"}}
                                                value={this.props.activeHydrologyItem.source}
                                                onChange={(e) => this.handleTextChange(e, this.props.activeHydrologyItem)}
                                            />
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
                                                return <HydrologyDetailTimeSeries/>;
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
                    {/* TASK-1438: shared ConfirmOverlay replaces the inline copy-paste. */}
                    {this.state.deleteConfirmVisible ? (
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
                    )}
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
        customCurveError
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        setActiveHydrologyPage: (page) => dispatch(setActiveHydrologyPage(page)),
        updateActiveHydrologyItem: (activeHydrologyPage, item, kv) => dispatch(updateActiveHydrologyItem(activeHydrologyPage, item, kv)),
        saveHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(saveHydrologyItem(activeHydrologyPage, activeHydrologyItem)),
        createHydrologyForm: (activeHydrologyPage, autoNameLabel) => dispatch(createHydrologyForm(activeHydrologyPage, autoNameLabel)),
        deleteHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(deleteHydrologyItem(activeHydrologyPage, activeHydrologyItem))
    };
};

const HydrologyListDetailContainer = connect(mapStateToProps, mapDispatchToProps)(HydrologyListDetailContainerClass);


export {
    HydrologyListDetailContainer,
    HydrologyListDetailContainerClass
};
