import React from "react";
import {connect} from "react-redux";
import {Button, Table} from "react-bootstrap";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setHydrologyMainMenu,
    setActiveHydrologyPage,
    setActiveHydrologyItem
} from "../actionsHydrology";
import {
    setOpenMenuGroupId
} from "../../SimpleView/actionsSimpleView";
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";
import {Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {formatMoney} from "@js/plugins/hydrata/Utils/utils";

class HydrologyDetailDefaultClass extends React.Component {
    static propTypes = {
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={"hydrology-detail-container"}>
                {JSON.stringify(this.props?.activeHydrologyItem)}
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
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item))
    };
};

const HydrologyDetailDefault = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailDefaultClass);


export {
    HydrologyDetailDefault
};
