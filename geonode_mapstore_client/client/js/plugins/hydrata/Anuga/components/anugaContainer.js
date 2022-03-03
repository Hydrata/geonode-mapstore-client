import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    startAnugaElevationPolling,
    startAnugaScenarioPolling,
    stopAnugaScenarioPolling
} from '../actionsAnuga';
import {AnugaInputMenu} from './AnugaInputMenu';
import {AnugaScenarioMenu} from './AnugaScenarioMenu';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        showAnugaInputMenu: PropTypes.bool,
        setAnugaInputMenu: PropTypes.func,
        showAnugaScenarioMenu: PropTypes.bool,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaResultMenu: PropTypes.bool,
        setAnugaResultMenu: PropTypes.func,
        isAnugaMenuOpen: PropTypes.bool,
        openMenuGroupId: PropTypes.string,
        numberOfMenus: PropTypes.number,
        setOpenMenuGroupId: PropTypes.func,
        showAddAnugaElevationData: PropTypes.bool,
        setAddAnugaElevation: PropTypes.func,
        visibleAnugaScenarioLogId: PropTypes.number,
        startAnugaElevationPolling: PropTypes.func,
        startAnugaScenarioPolling: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func
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
                            style={{left: (this.props.numberOfMenus * 100) + 20}}
                            onClick={() => {
                                this.props.setAnugaInputMenu(!this.props.showAnugaInputMenu);
                                this.props.startAnugaElevationPolling();
                                this.props.setOpenMenuGroupId(null);
                            }}
                        >
                            Inputs
                        </button>
                    </div>
                    {
                        this.props.showAnugaInputMenu ?
                            <AnugaInputMenu/>
                            : null
                    }
                    <div id={"anuga-scenario"}>
                        <button
                            key="anuga-scenario-button"
                            className={'simple-view-menu-button'}
                            style={{left: (this.props.numberOfMenus * 100) + 120}}
                            onClick={() => {
                                this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
                                this.props.showAnugaScenarioMenu ? this.props.stopAnugaScenarioPolling() : this.props.startAnugaScenarioPolling();
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
                    {
                        this.props.visibleAnugaScenarioLogId ?
                            <AnugaScenarioLogViewer/>
                            : null
                    }
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    console.log('state for Anuga:', state);
    return {
        isAnugaProject: state?.anuga?.project?.id,
        anugaInputMenuGroupId: state?.layers?.groups?.filter((group) => group.title === "Input Data")[0]?.id,
        showAnugaInputMenu: state?.anuga?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.showAnugaResultMenu,
        isAnugaMenuOpen: state?.anuga?.showAnugaInputMenu || state?.anuga?.showAnugaScenarioMenu || state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups.length || 1,
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        visibleAnugaScenarioLogId: state?.anuga?.visibleAnugaScenarioLogId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        startAnugaElevationPolling: (visible) => dispatch(startAnugaElevationPolling(visible)),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        startAnugaScenarioPolling: () => dispatch(startAnugaScenarioPolling()),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
