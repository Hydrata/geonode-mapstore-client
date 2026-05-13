/* eslint-disable react/prop-types */
import React from 'react';
import {connect} from 'react-redux';

import {initHydrology} from '../actionsHydrology';
import {HydrologyMainMenu} from './hydrologyMainMenu';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {getProjectId} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import PropTypes from "prop-types";

class HydrologyContainer extends React.Component {
    static propTypes = {
        initHydrology: PropTypes.func,
        showHydrologyMainMenu: PropTypes.bool,
        isAnugaProject: PropTypes.bool
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
        return <HydrologyMainMenu/>;
    }
}

const mapStateToProps = (state) => {
    const anugaProjectId = getProjectId(state);
    return {
        isAnugaProject: !!anugaProjectId,
        anugaProjectId,
        showHydrologyMainMenu: state?.hydrology?.showHydrologyMainMenu
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initHydrology: () => dispatch(initHydrology())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyContainer);
