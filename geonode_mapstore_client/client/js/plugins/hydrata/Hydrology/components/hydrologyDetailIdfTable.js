import React from "react";
import {connect} from "react-redux";
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {
    setActiveHydrologyItem,
    updateActiveHydrologyItem
} from "../actionsHydrology";
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import PropTypes from "prop-types";

class HydrologyDetailIdfTableClass extends React.Component {
    static propTypes = {
        activeHydrologyItem: PropTypes.object,
        updateActiveHydrologyItem: PropTypes.func,
        activeHydrologyPage: PropTypes.string
    }

    static defaultProps = {}

    constructor(props) {
        super(props);
    }

    render() {
        return (
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
                    {/*{JSON.stringify(this.props.activeHydrologyItem)}*/}
                </div>
                <div style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    padding: '10px',
                    boxSizing: 'border-box'
                }}>
                    <p>Graph</p>
                    {/*{JSON.stringify(this.props.activeHydrologyItem)}*/}
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
        activeHydrologyItem: state?.hydrology?.activeHydrologyItem

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setActiveHydrologyItem: (item) => dispatch(setActiveHydrologyItem(item))
    };
};

const HydrologyDetailIdfTable = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfTableClass);


export {
    HydrologyDetailIdfTable
};
