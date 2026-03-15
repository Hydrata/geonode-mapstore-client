import React from 'react';
import ReactDOM from 'react-dom';
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
import Message from '@mapstore/framework/components/I18N/Message';
import {AnugaInputMenu} from './anugaInputMenu';
import {AnugaScenarioMenu} from './anugaScenarioMenu';
import {PublicationPanel} from './publicationPanel';
import {AnugaScenarioLogViewer} from "./anugaScenarioLogViewer";
import {NetworkMenu} from "./networkMenu";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {AnugaRunMenu} from "@js/plugins/hydrata/Anuga/components/anugaRunMenu";
import {trackEvent} from "@js/utils/analytics";

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
            this.props.initAnuga();
        }
    }

    renderToolbarButtons() {
        return (
            <React.Fragment>
                <button
                    key="anuga-input-button"
                    className={'simple-view-menu-button'}
                    onClick={() => {
                        this.props.setAnugaInputMenu(!this.props.showAnugaInputMenu);
                        this.props.setOpenMenuGroupId(null);
                        trackEvent('button', `click`, `anuga-input-menu-toggle`);
                    }}
                >
                    <Message msgId="hydrata.anuga.inputs" />
                </button>
                {this.props.canEditAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-scenario-button"
                        className={'simple-view-menu-button'}
                        onClick={() => {
                            this.props.setAnugaScenarioMenu(!this.props.showAnugaScenarioMenu);
                            this.props.showAnugaScenarioMenu ? this.props.stopAnugaScenarioPolling() : this.props.startAnugaScenarioPolling();
                            this.props.setOpenMenuGroupId(null);
                            trackEvent('button', `click`, `anuga-scenario-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.scenarios" />
                    </button>
                    : null
                }
                {this.props.canViewAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-results-button"
                        className={'simple-view-menu-button'}
                        onClick={() => {
                            this.props.setOpenMenuGroupId('Results');
                            trackEvent('button', `click`, `anuga-results-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.results" />
                    </button>
                    : null
                }
                {this.props.canEditAnugaMap && this.props.hasEPSGset ?
                    <button
                        key="anuga-publication-button"
                        className={'simple-view-menu-button disabled'}
                        onClick={() => {
                            this.props.setPublicationPanel(!this.props.showPublicationPanel);
                            this.props.setOpenMenuGroupId(null);
                            trackEvent('button', `click`, `anuga-publication-menu-toggle`);
                        }}
                    >
                        <Message msgId="hydrata.anuga.publish" />
                    </button>
                    : null
                }
            </React.Fragment>
        );
    }

    render() {
        const toolbarTarget = typeof document !== 'undefined'
            ? document.querySelector('.simple-view-left-toolbar')
            : null;
        return this.props.isAnugaProject ?
            (
                <div id={"anuga-container"}>
                    {toolbarTarget ? ReactDOM.createPortal(this.renderToolbarButtons(), toolbarTarget) : null}
                    {this.props.showAnugaInputMenu ? <AnugaInputMenu/> : null}
                    {this.props.canEditAnugaMap && this.props.hasEPSGset && this.props.showAnugaScenarioMenu ?
                        <AnugaScenarioMenu/> : null
                    }
                    {this.props.canEditAnugaMap && this.props.hasEPSGset && this.props.showPublicationPanel ?
                        <PublicationPanel/> : null
                    }
                    {this.props.visibleAnugaScenarioLogId ?
                        <AnugaScenarioLogViewer logText={this.props.logText}/> : null
                    }
                    {this.props.visibleAnugaRunMenu ? <AnugaRunMenu/> : null}
                    {this.props.showNetworkMenu ? <NetworkMenu/> : null}
                </div>
            ) :
            null;
    }
}

const mapStateToProps = (state) => {
    const selectedId = state?.anuga?.scenarios?.selectedId;
    const selectedScenario = selectedId ? state?.anuga?.scenarios?.byId?.[selectedId] : null;
    const latestRunIsValid = selectedScenario?.latest_run_is_valid;
    const logText = latestRunIsValid ?
        selectedScenario?.latest_run?.log || '-' :
        selectedScenario?.log || '-';
    return {
        logText: logText,
        gnResourceLoaded: state?.gnresource?.id,
        isAnugaProject: state?.anuga?.projects?.data?.id,
        hasEPSGset: !!state?.anuga?.projects?.data?.projection,
        showAnugaInputMenu: state?.anuga?.ui?.showAnugaInputMenu,
        showAnugaScenarioMenu: state?.anuga?.ui?.showAnugaScenarioMenu,
        showAnugaResultMenu: state?.anuga?.ui?.showAnugaResultMenu,
        showReviewPanel: state?.anuga?.ui?.showReviewPanel,
        showPublicationPanel: state?.anuga?.ui?.showPublicationPanel,
        isAnugaMenuOpen: state?.anuga?.ui?.showAnugaInputMenu || state?.anuga?.ui?.showAnugaScenarioMenu || state?.anuga?.ui?.showAnugaResultMenu,
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        numberOfMenus: state?.layers?.groups?.length || 1,
        showAddAnugaElevationData: state?.anuga?.ui?.showAddAnugaElevationData,
        visibleAnugaScenarioLogId: state?.anuga?.ui?.visibleAnugaScenarioLogId,
        visibleIntroduction: state?.simpleView.hasOwnProperty('visibleIntroduction') ? state?.simpleView?.visibleIntroduction : true,
        showNetworkMenu: state?.anuga?.ui?.showNetworkMenu,
        visibleNetworkMenu: state?.anuga?.ui?.visibleNetworkMenu,
        visibleAnugaRunMenu: state?.anuga?.ui?.visibleAnugaRunMenu,
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
