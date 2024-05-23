import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {HydrologyDetailDefault} from './hydrologyDetailDefault';
import {HydrologyDetailIdfTable} from './hydrologyDetailIdfTable';
import {HydrologyDetailTemporalPattern} from './hydrologyDetailTemporalPattern';
import {HydrologyDetailTimeSeries} from './hydrologyDetailTimeSeries';
import {
    setActiveHydrologyItem,
    saveHydrologyItem,
    updateActiveHydrologyItem,
    deleteHydrologyItem,
    createHydrologyForm
} from "../actionsHydrology";
import {hydrologyKeyMap} from '../reducersHydrology';
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";

class HydrologyListDetailContainerClass extends React.Component {
    static propTypes = {
        activeHydrologyPage: PropTypes.string,
        activeHydrologyItems: PropTypes.array,
        activeHydrologyItem: PropTypes.object,
        setActiveHydrologyItem: PropTypes.func,
        saveHydrologyItem: PropTypes.func,
        updateActiveHydrologyItem: PropTypes.func,
        deleteHydrologyItem: PropTypes.func
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"hydrology-list-detail-container"}>
                <div id={"hydrology-list-detail-body"}>
                    <div id={"hydrology-list-detail-col-one"}>
                        <div id={"hydrology-list-detail-items"}>
                            <div id={"top buttons"}>
                                <div className={"hydrology-list-detail-heading"}>Items</div>
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
                            <div id={"bottom buttons"}>
                                <button
                                    className={"hydrology-button"}
                                    style={{marginTop: "10px"}}
                                    onClick={
                                        () => this.props.createHydrologyForm(this.props.activeHydrologyPage)
                                    }
                                >
                                    New Item
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
                                        height: "100vh"
                                    }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            padding: '10px',
                                            boxSizing: 'border-box'
                                        }}>
                                            <p style={{marginRight: '5px'}}>Name:</p>
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
                                        {(() => {
                                            switch (this.props.activeHydrologyPage) {
                                            case 'idf-table':
                                                return <HydrologyDetailIdfTable/>;
                                            case 'temporal-pattern':
                                                return <HydrologyDetailTemporalPattern/>;
                                            case 'time-series':
                                                return <HydrologyDetailTimeSeries/>;
                                            default:
                                                return <HydrologyDetailDefault/>;
                                            }
                                        })()}
                                    </div>
                                    : <div>Select an item on the left.</div>
                            }
                        </div>
                    </div>
                </div>
                <div id={"hydrology-list-detail-footer"}>
                    <button
                        className={"hydrology-button"}
                        style={{backgroundColor: "darkred"}}
                        onClick={() => {
                            if (window.confirm('This action can not be undone. Are you sure?')) {
                                this.props.deleteHydrologyItem(this.props.activeHydrologyPage, this.props.activeHydrologyItem);
                            }
                        }}
                    >
                        Delete
                    </button>
                    <button
                        className={this.props.activeHydrologyItem?.unsaved ? "hydrology-button" : "hydrology-button-disabled"}
                        style={{backgroundColor: this.props.activeHydrologyItem?.unsaved ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"}}
                        onClick={() => this.props.saveHydrologyItem(this.props.activeHydrologyPage, this.props.activeHydrologyItem)}
                    >
                        Save
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
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
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
