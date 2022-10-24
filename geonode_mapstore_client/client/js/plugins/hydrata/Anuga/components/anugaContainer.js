import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    startAnugaScenarioPolling,
    stopAnugaScenarioPolling
} from '../actionsAnuga';
import {canEditAnugaMap} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import {AnugaInputMenu} from './AnugaInputMenu';
import {AnugaScenarioMenu} from './AnugaScenarioMenu';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {LumpedCatchmentMenu} from "./lumpedCatchmentMenu";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
// import {updateCustomEditorsOptions} from "../../../../../MapStore2/web/client/actions/featuregrid";
import Introduction from "@js/plugins/hydrata/SimpleView/components/simpleViewIntroduction";
import {AnugaRunMenu} from "@js/plugins/hydrata/Anuga/components/anugaRunMenu";

class AnugaContainer extends React.Component {
    static propTypes = {
        initAnuga: PropTypes.func,
        showAnugaInputMenu: PropTypes.bool,
        setAnugaInputMenu: PropTypes.func,
        showAnugaScenarioMenu: PropTypes.bool,
        setAnugaScenarioMenu: PropTypes.func,
        showAnugaResultMenu: PropTypes.bool,
        setAnugaResultMenu: PropTypes.func,
        showLumpedCatchmentMenu: PropTypes.bool,
        isAnugaMenuOpen: PropTypes.bool,
        openMenuGroupId: PropTypes.string,
        numberOfMenus: PropTypes.number,
        setOpenMenuGroupId: PropTypes.func,
        showAddAnugaElevationData: PropTypes.bool,
        setAddAnugaElevation: PropTypes.func,
        visibleAnugaScenarioLogId: PropTypes.number,
        startAnugaScenarioPolling: PropTypes.func,
        stopAnugaScenarioPolling: PropTypes.func,
        updateCustomEditorsOptions: PropTypes.func,
        logText: PropTypes.string,
        gnResourceLoaded: PropTypes.string,
        visibleAnugaRunMenu: PropTypes.bool,
        canEditAnugaMap: PropTypes.bool,
        hasEPSGset: PropTypes.bool
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // this.props.updateCustomEditorsOptions(this.editorOptions);
    }

    componentDidUpdate() {
        if (this.props.gnResourceLoaded && !this.props.isAnugaProject) {
            console.log('componentDidUpdate initing Anuga');
            this.props.initAnuga();
        }
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
                    {
                        this.props.canEditAnugaMap && this.props.hasEPSGset ?
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
                            : null
                    }
                    {
                        this.props.visibleAnugaScenarioLogId ?
                            <AnugaScenarioLogViewer logText={this.props.logText}/>
                            : null
                    }
                    {
                        this.props.visibleAnugaRunMenu ?
                            <AnugaRunMenu/>
                            : null
                    }
                    {
                        this.props.showLumpedCatchmentMenu ?
                            <LumpedCatchmentMenu/>
                            : null
                    }
                    {this.props.visibleIntroduction ?
                        <Introduction />
                        : null
                    }
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    console.log('state for Anuga:', state);
    const latestRunIsValid = state?.anuga?.selectedScenario?.latest_run_is_valid;
    const logText = latestRunIsValid ?
        state?.anuga?.selectedScenario?.latest_run?.log || '-' :
        state?.anuga?.selectedScenario?.log || '-';
    return {
        logText: logText,
        gnResourceLoaded: state?.gnresource?.id,
        isAnugaProject: state?.anuga?.projectData?.id,
        hasEPSGset: !!state?.anuga?.projectData?.projection,
        anugaInputMenuGroupId: state?.layers?.groups?.filter((group) => group.name === "Input Data")?.[0]?.id,
        showAnugaInputMenu: state?.anuga?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.showAnugaResultMenu,
        isAnugaMenuOpen: state?.anuga?.showAnugaInputMenu || state?.anuga?.showAnugaScenarioMenu || state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        visibleAnugaScenarioLogId: state?.anuga?.visibleAnugaScenarioLogId,
        visibleIntroduction: state?.simpleView.hasOwnProperty('visibleIntroduction') ? state?.simpleView?.visibleIntroduction : true,
        showLumpedCatchmentMenu: state?.anuga?.showLumpedCatchmentMenu,
        visibleLumpedCatchmentMenu: state?.anuga?.visibleLumpedCatchmentMenu,
        canEditAnugaMap: canEditAnugaMap(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        startAnugaScenarioPolling: () => dispatch(startAnugaScenarioPolling()),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling())
        // updateCustomEditorsOptions: (payload) => dispatch(updateCustomEditorsOptions(payload))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
