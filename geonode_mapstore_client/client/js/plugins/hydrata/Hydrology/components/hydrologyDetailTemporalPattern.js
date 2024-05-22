import React from "react";
import {connect} from "react-redux";
import {Button, Table} from "react-bootstrap";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyListItem
} from "../actionsHydrology";
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";
import {Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {formatMoney} from "@js/plugins/hydrata/Utils/utils";

class HydrologyDetailTemporalPatternClass extends React.Component {
    static propTypes = {
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"hydrology-detail-container"}>
                Temporal Pattern
                {JSON.stringify(this.props?.activeHydrologyListItem)}
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
        activeHydrologyListItem: state?.hydrology?.activeHydrologyListItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyListItem: (item) => dispatch(setActiveHydrologyListItem(item))
    };
};

const HydrologyDetailTemporalPattern = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailTemporalPatternClass);


export {
    HydrologyDetailTemporalPattern
};
