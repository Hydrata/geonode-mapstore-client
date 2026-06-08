/* eslint-disable react/prop-types */
import React from 'react';
import {connect} from 'react-redux';

import {initHydrology} from '../actionsHydrology';
import {HydrologyMainMenu} from './hydrologyMainMenu';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {getProjectId} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import PropTypes from "prop-types";

export class HydrologyContainer extends React.Component {
    static propTypes = {
        initHydrology: PropTypes.func,
        showHydrologyMainMenu: PropTypes.bool,
        isAnugaProject: PropTypes.bool,
        mapPickActive: PropTypes.bool
    }

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidUpdate(prevProps) {
        if (this.props.isAnugaProject && !prevProps.isAnugaProject) {
            this.props.initHydrology();
        }
    }

    render() {
        if (!this.props.isAnugaProject || !this.props.showHydrologyMainMenu) {
            return null;
        }
        // TASK-1499 (W2) — CSS-hide during map-pick so the panel doesn't
        // obscure the map the operator is clicking. Wrap in a div with
        // display:none rather than null/unmount so form state + scroll
        // position survive the round-trip. The idfDeriveMapPickEpic clears
        // mapPickActive on the captured click so the panel reappears
        // automatically.
        if (this.props.mapPickActive) {
            return <div style={{display: 'none'}}><HydrologyMainMenu/></div>;
        }
        return <HydrologyMainMenu/>;
    }
}

const mapStateToProps = (state) => {
    const anugaProjectId = getProjectId(state);
    return {
        isAnugaProject: !!anugaProjectId,
        anugaProjectId,
        showHydrologyMainMenu: state?.hydrology?.showHydrologyMainMenu,
        mapPickActive: state?.hydrology?.idfDerive?.mapPickActive
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initHydrology: () => dispatch(initHydrology())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyContainer);
