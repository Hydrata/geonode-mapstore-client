import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import HydrologyDetailIdfTable from './hydrologyDetailIdfTable';
import HydrologyDetailIdfDerive from './hydrologyDetailIdfDerive';
import HydrologyDetailTemporalPattern from './hydrologyDetailTemporalPattern';
import HydrologyDetailTimeSeries from './hydrologyDetailTimeSeries';
import {Button} from 'react-bootstrap';
import {
    setActiveHydrologyItem,
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

class HydrologyListDetailContainerClass extends React.Component {
    static propTypes = {
        activeHydrologyPage: PropTypes.string,
        activeHydrologyItems: PropTypes.array,
        activeHydrologyItem: PropTypes.object,
        setActiveHydrologyItem: PropTypes.func,
        saveHydrologyItem: PropTypes.func,
        updateActiveHydrologyItem: PropTypes.func,
        deleteHydrologyItem: PropTypes.func,
        createHydrologyForm: PropTypes.func
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
        // TASK-1409 — inline confirm overlay state replaces window.confirm.
        this.state = {
            deleteConfirmVisible: false
        };
    }

    render() {
        // TASK-1448 (W1) — IDF sub-toggle: when the IDF rail category is active,
        // show a minimal Manual|Derive segmented switch so both idf-table and
        // idf-derive detail components remain reachable under a single rail item.
        // The full segmented-control polish is deferred to W5 (TASK-1452).
        const isIdfPage = this.props.activeHydrologyPage === 'idf-table'
            || this.props.activeHydrologyPage === 'idf-derive';
        const IdfSubToggle = isIdfPage ? (
            <div className={"hydrology-idf-subtoggle"}>
                <Button
                    bsSize={'xsmall'}
                    bsStyle={this.props.activeHydrologyPage === 'idf-table' ? 'primary' : 'default'}
                    onClick={() => this.props.setActiveHydrologyPage('idf-table')}
                >
                    <Message msgId="hydrata.hydrology.idfTables" />
                </Button>
                <Button
                    bsSize={'xsmall'}
                    bsStyle={this.props.activeHydrologyPage === 'idf-derive' ? 'primary' : 'default'}
                    onClick={() => this.props.setActiveHydrologyPage('idf-derive')}
                >
                    <Message msgId="hydrata.hydrology.idfDerive" />
                </Button>
            </div>
        ) : null;

        // TASK-934 — IDF Derive is a one-shot form, not a list-of-items
        // workflow. Bypass the items column + save/delete footer entirely
        // when this tab is active; the panel manages its own submit state.
        if (this.props.activeHydrologyPage === 'idf-derive') {
            return (
                <div id={"hydrology-list-detail-container"}>
                    {IdfSubToggle}
                    <div id={"hydrology-list-detail-body"}>
                        <div id={"hydrology-idf-derive-container"} style={{padding: '10px', width: '100%'}}>
                            <HydrologyDetailIdfDerive/>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div id={"hydrology-list-detail-container"}>
                {IdfSubToggle}
                <div id={"hydrology-list-detail-body"}>
                    <div id={"hydrology-list-detail-col-one"}>
                        <div id={"hydrology-list-detail-items"}>
                            <div id={"top-buttons"} style={{display: "flex", flexDirection: "column"}}>
                                <div className={"hydrology-list-detail-heading"}><Message msgId="hydrata.hydrology.items" /></div>
                                {this.props.activeHydrologyItems?.map((item) => {
                                    return (
                                        <button
                                            className={"hydrology-button"}
                                            style={{
                                                backgroundColor: item.id === this.props.activeHydrologyItem?.id ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                            }}
                                            onClick={
                                                () => this.props.setActiveHydrologyItem(item)
                                            }
                                        >
                                            {item?.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <div id={"bottom-buttons"}>
                                <button
                                    className={"hydrology-button"}
                                    style={{marginTop: "10px"}}
                                    onClick={
                                        () => this.props.createHydrologyForm(this.props.activeHydrologyPage)
                                    }
                                >
                                    <Message msgId="hydrata.hydrology.newItem" />
                                </button>
                            </div>
                        </div>
                    </div>
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
                        className={this.props.activeHydrologyItem?.unsaved ? "hydrology-button" : "hydrology-button-disabled"}
                        style={{backgroundColor: this.props.activeHydrologyItem?.unsaved ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"}}
                        onClick={() => this.props.saveHydrologyItem(this.props.activeHydrologyPage, this.props.activeHydrologyItem)}
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
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyItems: state?.hydrology[hydrologyKeyMap[state.hydrology.activeHydrologyPage]],
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item)),
        updateActiveHydrologyItem: (activeHydrologyPage, item, kv) => dispatch(updateActiveHydrologyItem(activeHydrologyPage, item, kv)),
        saveHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(saveHydrologyItem(activeHydrologyPage, activeHydrologyItem)),
        createHydrologyForm: (activeHydrologyPage) => dispatch(createHydrologyForm(activeHydrologyPage)),
        deleteHydrologyItem: (activeHydrologyPage, activeHydrologyItem) => dispatch(deleteHydrologyItem(activeHydrologyPage, activeHydrologyItem))
    };
};

const HydrologyListDetailContainer = connect(mapStateToProps, mapDispatchToProps)(HydrologyListDetailContainerClass);


export {
    HydrologyListDetailContainer
};
