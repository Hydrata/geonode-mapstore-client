import React from "react";
import {connect} from "react-redux";
import {Button, Table} from "react-bootstrap";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {HydrologyDetailDefault} from './hydrologyDetailDefault';
import {HydrologyDetailIdfTable} from './hydrologyDetailIdfTable';
import {HydrologyDetailTemporalPattern} from './hydrologyDetailTemporalPattern';
import {HydrologyDetailTimeSeries} from './hydrologyDetailTimeSeries';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyListItem
} from "../actionsHydrology";
import {hydrologyKeyMap} from '../reducersHydrology';
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";
import {Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {formatMoney} from "@js/plugins/hydrata/Utils/utils";

class HydrologyListDetailContainerClass extends React.Component {
    static propTypes = {
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
                                {this.props.activeHydrologyListItems?.map((item) => {
                                    return (
                                        <button
                                            className={"hydrology-button"}
                                            style={{
                                                backgroundColor: item.id === this.props.activeHydrologyListItem?.id ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                            }}
                                            onClick={
                                                () => this.props.setActiveHydrologyListItem(item)
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
                                        () => window.alert('New Item box')
                                    }
                                >
                                    New Item
                                </button>
                                <button
                                    className={"hydrology-button"}
                                    style={{marginTop: "10px", marginBottom: "10px"}}
                                    onClick={
                                        () => window.alert('Edit Item box')
                                    }
                                >
                                    Edit Item
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id={"hydrology-list-detail-col-two"}>
                        {
                            (() => {
                                switch (this.props.activeHydrologyPage) {
                                    case 'idf-tables':
                                        return <HydrologyDetailIdfTable/>;
                                    case 'temporal-patterns':
                                        return <HydrologyDetailTemporalPattern/>;
                                    case 'time-series':
                                        return <HydrologyDetailTimeSeries/>;
                                    default:
                                        return <HydrologyDetailDefault/>;
                                }
                            })()
                        }
                    </div>
                </div>
                <div id={"hydrology-list-detail-footer"}>
                </div>
            </div>
        )
            ;
    }

    trackEvent = (page) => {
        CustomEvent.trackEvent('button', `click`, `tracking hydrology-page-${page}-button`);
    }



}

const mapStateToProps = (state) => {
    return {
        activeHydrologyPage: state?.hydrology?.activeHydrologyPage,
        activeHydrologyListItems: state?.hydrology[hydrologyKeyMap[state.hydrology.activeHydrologyPage]],
        activeHydrologyListItem: state?.hydrology?.activeHydrologyListItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyListItem: (item) => dispatch(setActiveHydrologyListItem(item))
    };
};

const HydrologyListDetailContainer = connect(mapStateToProps, mapDispatchToProps)(HydrologyListDetailContainerClass);


export {
    HydrologyListDetailContainer
};
