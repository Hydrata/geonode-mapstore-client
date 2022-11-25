import React from 'react';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');

import {
    initAnuga,
    setAnugaInputMenu,
    setAnugaScenarioMenu,
    setAnugaResultMenu,
    setReviewPanel,
    setPublicationPanel,
    startAnugaScenarioPolling,
    stopAnugaScenarioPolling
} from '../actionsAnuga';
import {canEditAnugaMap, canViewAnugaMap} from "@js/plugins/hydrata/Anuga/selectorsAnuga";
import {AnugaInputMenu} from './AnugaInputMenu';
import {AnugaScenarioMenu} from './AnugaScenarioMenu';
import {ReviewPanel} from './reviewPanel';
import {PublicationPanel} from './publicationPanel';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {NetworkMenu} from "./networkMenu";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
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
        showNetworkMenu: PropTypes.bool,
        setReviewPanel: PropTypes.func,
        showReviewPanel: PropTypes.bool,
        setPublicationPanel: PropTypes.func,
        showPublicationPanel: PropTypes.bool,
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
        canViewAnugaMap: PropTypes.bool,
        hasEPSGset: PropTypes.bool,
        resultsGroup: PropTypes.object,
        isAnugaProject: PropTypes.bool
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
                            style={{left: 120}}
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
                                    style={{left: 220}}
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
                        this.props.canViewAnugaMap && this.props.hasEPSGset ?
                            <button
                                key={this.props.resultsGroup?.title}
                                className={'simple-view-menu-button'}
                                style={{left: 320}}
                                onClick={() => {
                                    this.props.setOpenMenuGroupId('Results');
                                }}
                            >
                                Results
                            </button>
                            : null
                    }
                    {
                        this.props.canEditAnugaMap && this.props.hasEPSGset ?
                            <div id={"review-panel-container"}>
                                <button
                                    key="review-panel-button"
                                    className={'simple-view-menu-button'}
                                    style={{left: 420, color: "#b9b8b8"}}
                                    onClick={() => {
                                        this.props.setReviewPanel(!this.props.showReviewPanel);
                                        this.props.setOpenMenuGroupId(null);
                                    }}
                                >
                                    Review
                                </button>
                                {
                                    this.props.showReviewPanel ?
                                        null
                                        // <ReviewPanel/>
                                        : null
                                }
                            </div>
                            : null
                    }
                    {
                        this.props.canEditAnugaMap && this.props.hasEPSGset ?
                            <div id={"publication-panel-container"}>
                                <button
                                    key="publication-panel-button"
                                    className={'simple-view-menu-button disabled'}
                                    style={{left: 520}}
                                    onClick={() => {
                                        this.props.setPublicationPanel(!this.props.showPublicationPanel);
                                        this.props.setOpenMenuGroupId(null);
                                    }}
                                >
                                    Publish
                                </button>
                                {
                                    this.props.showPublicationPanel ?
                                        <PublicationPanel/>
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
                        this.props.showNetworkMenu ?
                            <NetworkMenu/>
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
        showReviewPanel: state?.anuga?.showReviewPanel,
        showPublicationPanel: state?.anuga?.showPublicationPanel,
        isAnugaMenuOpen: state?.anuga?.showAnugaInputMenu || state?.anuga?.showAnugaScenarioMenu || state?.anuga?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaElevationData: state?.anuga?.showAddAnugaElevationData,
        visibleAnugaScenarioLogId: state?.anuga?.visibleAnugaScenarioLogId,
        visibleIntroduction: state?.simpleView.hasOwnProperty('visibleIntroduction') ? state?.simpleView?.visibleIntroduction : true,
        showNetworkMenu: state?.anuga?.showNetworkMenu,
        visibleNetworkMenu: state?.anuga?.visibleNetworkMenu,
        visibleAnugaRunMenu: state?.anuga?.visibleAnugaRunMenu,
        canEditAnugaMap: canEditAnugaMap(state),
        canViewAnugaMap: canViewAnugaMap(state)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initAnuga: () => dispatch(initAnuga()),
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible)),
        setAnugaScenarioMenu: (visible) => dispatch(setAnugaScenarioMenu(visible)),
        setAnugaResultMenu: (visible) => dispatch(setAnugaResultMenu(visible)),
        setReviewPanel: (visible) => dispatch(setReviewPanel(visible)),
        setPublicationPanel: (visible) => dispatch(setPublicationPanel(visible)),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        startAnugaScenarioPolling: () => dispatch(startAnugaScenarioPolling()),
        stopAnugaScenarioPolling: () => dispatch(stopAnugaScenarioPolling())
        // updateCustomEditorsOptions: (payload) => dispatch(updateCustomEditorsOptions(payload))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AnugaContainer);
