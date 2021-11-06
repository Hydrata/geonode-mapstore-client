import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu
} from '../actionsAnuga';
import AnugaInputMenu from './AnugaInputMenu';
import AnugaScenarioMenu from './AnugaScenarioMenu';
import AnugaResultMenu from './AnugaResultMenu';
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        showAnugaInputMenu: PropTypes.string,
        setAnugaInputMenu: PropTypes.func,
        showAnugaScenarioMenu: PropTypes.string,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaResultMenu: PropTypes.string,
        setAnugaResultMenu: PropTypes.func,
        openMenuGroupId: PropTypes.string,
        numberOfMenus: PropTypes.number,
        setOpenMenuGroupId: PropTypes.func
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        this.props.initAnuga();
    }

    render() {
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    <div id={"anuga-inputs"}>
                        <button
                            key="anuga-input-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus + 1) * 100 + 20}}
                            onClick={() => {
                                this.props.setAnugaInputMenu(!this.props.showAnugaInputMenu);
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Inputs
                        </button>
                        {
                            this.props.showAnugaInputMenu ?
                                <AnugaInputMenu/>
                                : null
                        }
                    </div>
                    <div id={"anuga-scenario"}>
                        <button
                            key="anuga-scenario-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus + 2) * 100 + 20}}
                            onClick={() => {
                                this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Scenarios
                        </button>
                        {
                            this.props.showAnugaScenarioMenu ?
                                <AnugaScenarioMenu/>
                                : null
                        }
                    </div>
                    <div id={"anuga-results"}>
                        <button
                            key="anuga-result-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus + 3) * 100 + 20}}
                            onClick={() => {
                                this.props.setAnugaResultMenu(!this.props.showAnugaResultMenu);
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Results
                        </button>
                        {
                            this.props.showAnugaResultMenu ?
                                <AnugaResultMenu/>
                                : null
                        }
                    </div>
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    console.log('state for Anuga:', state);
    return {
        isAnugaProject: state?.anuga?.project?.id,
        anugaInputMenuGroupId: state?.mapConfigRawData?.map?.groups?.filter((group) => group.title === "Inputs")[0]?.id,
        showAnugaInputMenu: state?.anuga?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups.length
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
