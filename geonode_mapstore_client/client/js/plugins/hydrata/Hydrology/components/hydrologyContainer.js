/* eslint-disable react/prop-types */
import React from 'react';
import {connect} from 'react-redux';

import {
    initHydrology
} from '../actionsHydrology';
import {HydrologyMainMenu} from './hydrologyMainMenu';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';
import {CustomEvent} from "@piwikpro/react-piwik-pro";
import {setHydrologyMainMenu} from "@js/plugins/hydrata/Hydrology/actionsHydrology";
import {setOpenMenuGroupId} from "@js/plugins/hydrata/SimpleView/actionsSimpleView";
import PropTypes from "prop-types";

class HydrologyContainer extends React.Component {
    static propTypes = {
        setHydrologyMainMenu: PropTypes.func,
        initHydrology: PropTypes.func,
        setOpenMenuGroupId: PropTypes.func,
        showHydrologyMainMenu: PropTypes.bool,
        isAnugaProject: PropTypes.bool,
        hydrologyProjectId: PropTypes.number
    }

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidUpdate(prevProps) {
        if (!this.props.hydrologyProjectId && this.props.isAnugaProject !== prevProps.isAnugaProject) {
            this.props.initHydrology();
        }
    }

    render() {
        return this.props.isAnugaProject ?
            <div id={"hydrology-container"}>
                <div id={"hydrology-main-menu-button"}>
                    <button
                        key="hydrology-main-menu-button"
                        className={'simple-view-menu-button'}
                        style={{left: 620}}
                        onClick={() => {
                            this.props.setHydrologyMainMenu(!this.props.showHydrologyMainMenu);
                            this.props.setOpenMenuGroupId(null);
                            console.log('tracking hydrology-main-menu-toggle');
                            CustomEvent.trackEvent('button', `click`, `hydrology-main-menu-toggle`);
                        }}
                    >
                        Hydrology
                    </button>
                </div>
                {
                    this.props.showHydrologyMainMenu ?
                        <HydrologyMainMenu/>
                        : null
                }
            </div> :
            null;
    }
}

const mapStateToProps = (state) => {
    return {
        isAnugaProject: !!state?.anuga?.projectData?.id,
        anugaProjectId: state?.anuga?.projectData?.id,
        hydrologyProjectId: state?.hydrology?.projectId,
        showHydrologyMainMenu: state?.hydrology?.showHydrologyMainMenu
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initHydrology: () => dispatch(initHydrology()),
        setHydrologyMainMenu: (visible) => dispatch(setHydrologyMainMenu(visible)),
        setOpenMenuGroupId: (openMenuGroupId) => dispatch(setOpenMenuGroupId(openMenuGroupId))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(HydrologyContainer);
