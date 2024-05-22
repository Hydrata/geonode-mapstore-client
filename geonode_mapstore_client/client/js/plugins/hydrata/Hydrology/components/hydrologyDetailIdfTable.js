import React from "react";
import {connect} from "react-redux";
import {Button, Table} from "react-bootstrap";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyListItem,
    updateActiveHydrologyListItem
} from "../actionsHydrology";
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";
import {Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {formatMoney} from "@js/plugins/hydrata/Utils/utils";

class HydrologyDetailIdfTableClass extends React.Component {
    static propTypes = {
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
    }

    handleTextChange = (e, item) => {
        const kv = {};
        kv[e.target.id] = e.target.value;
        this.props.updateActiveHydrologyListItem(this.props.activeHydrologyPage, item, kv);
    }

    render() {
        if (!this.props.activeHydrologyListItem)
            return (
                <div>
                    Select an item on the left.
                </div>
            )
        return (
            <div id={"hydrology-detail-container"}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100vh"
                }}>
                    <div style={{
                        padding: '10px',
                        boxSizing: 'border-box'
                    }}>
                        Name:
                        <input
                            id={'name'}
                            key={`name-${this.props.activeHydrologyListItem.id}`}
                            type={"text"}
                            className={'hydrology-text-input'}
                            style={{textAlign: "left"}}
                            value={this.props.activeHydrologyListItem.name}
                            onChange={(e) => this.handleTextChange(e, this.props.activeHydrologyListItem)}
                        />
                    </div>
                    <div style={{
                        flexGrow: 1,
                        flexShrink: 1,
                        flexBasis: 0,
                        display: 'flex',
                        flexDirection: 'row',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            flexGrow: 1,
                            flexShrink: 1,
                            flexBasis: 0,
                            padding: '10px',
                            boxSizing: 'border-box'
                        }}>
                            <p>Table</p>
                            {JSON.stringify(this.props?.activeHydrologyListItem)}
                        </div>
                        <div style={{
                            flexGrow: 1,
                            flexShrink: 1,
                            flexBasis: 0,
                            padding: '10px',
                            boxSizing: 'border-box'
                        }}>
                            <p>Graph</p>
                            {JSON.stringify(this.props?.activeHydrologyListItem)}
                        </div>
                    </div>
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
        activeHydrologyListItem: state?.hydrology?.activeHydrologyListItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyListItem: (item) => dispatch(setActiveHydrologyListItem(item)),
        updateActiveHydrologyListItem: (activeHydrologyPage, item, kv) => dispatch(updateActiveHydrologyListItem(activeHydrologyPage, item, kv))
    };
};

const HydrologyDetailIdfTable = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfTableClass);


export {
    HydrologyDetailIdfTable
};
