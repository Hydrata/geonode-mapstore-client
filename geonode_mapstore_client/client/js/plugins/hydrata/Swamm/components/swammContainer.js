import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
const Spinner = require('react-spinkit');
import {
    initSwamm,
    fetchSwammBmpTypes,
    fetchProjectManagerConfig,
    fetchGroupProfiles,
    fetchSwammBmpStatuses,
    showBmpForm,
    showSwammBmpChart,
    setSwammInputMenu,
    makeBmpForm,
    selectSwammTargetId,
    toggleBmpType,
    fetchSwammTargets
} from "../actionsSwamm";
import {SwammBmpForm} from "./swammBmpForm";
import {SwammTargetForm} from "./swammTargetForm";
import {SwammBmpChart} from "./swammBmpChart";
import {SwammBmpFilters} from "./swammBmpFilters";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import {bmpByUniqueNameSelector, canEditSwammMap} from "../selectorsSwamm";
import {query, toggleSyncWms} from "../../../../../MapStore2/web/client/actions/wfsquery";

import Message from '@mapstore/framework/components/I18N/Message';
import "../../SimpleView/simpleView.css";
import "../swamm.css";
import {SwammInputMenu} from "@js/plugins/hydrata/Swamm/components/swammInputMenu";
import BmpChooserModal from "./bmpForm/BmpChooserModal";
import BmpHistoryViewer from "./bmpForm/BmpHistoryViewer";


class SwammContainer extends React.Component {
    static propTypes = {
        fetchSwammBmpTypes: PropTypes.func,
        fetchSwammBmpStatuses: PropTypes.func,
        fetchSwammTargets: PropTypes.func,
        fetchProjectManagerConfig: PropTypes.func,
        fetchGroupProfiles: PropTypes.func,
        fetchingGroupProfiles: PropTypes.bool,
        fetchingTargets: PropTypes.bool,
        statuses: PropTypes.array,
        targets: PropTypes.array,
        swammData: PropTypes.array,
        mapId: PropTypes.number,
        bmpUniqueNames: PropTypes.array,
        bmpTypes: PropTypes.array,
        groupProfiles: PropTypes.array,
        projectCode: PropTypes.string,
        layers: PropTypes.object,
        toggleLayer: PropTypes.func,
        showBmpForm: PropTypes.func,
        visibleBmpForm: PropTypes.bool,
        makeBmpForm: PropTypes.func,
        storedBmpForm: PropTypes.object,
        showMenuGroup: PropTypes.bool,
        setOpenMenuGroupId: PropTypes.func,
        loadingBmp: PropTypes.bool,
        vectorDrawActive: PropTypes.bool,
        query: PropTypes.func,
        toggleBmpType: PropTypes.func,
        visibleSwammBmpChart: PropTypes.bool,
        visibleTargetForm: PropTypes.bool,
        defaultTargetId: PropTypes.number,
        selectSwammTargetId: PropTypes.func,
        showSwammBmpChart: PropTypes.func,
        bmpByUniqueNameSelector: PropTypes.func,
        numberOfMenus: PropTypes.number,
        hasPmData: PropTypes.object,
        bmpDataLayer: PropTypes.object,
        defaultGroupProfile: PropTypes.object,
        viewBmpGroupId: PropTypes.string,
        openMenuGroupId: PropTypes.string,
        setBmpLayers: PropTypes.func,
        toggleSyncWms: PropTypes.func,
        gnResourceLoaded: PropTypes.string,
        isSwammProject: PropTypes.bool,
        initSwamm: PropTypes.func,
        setSwammInputMenu: PropTypes.func,
        showSwammInputMenu: PropTypes.bool,
        canEditSwammMap: PropTypes.func
    };

    static defaultProps = {};

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // Fallback: if initSwammEpic didn't trigger on SET_RESOURCE_ID
        // (e.g., user not yet authenticated when SET_RESOURCE_ID fired)
        if (!this.props.isSwammProject) {
            this.props.initSwamm();
        }
    }

    componentDidUpdate() {
    }

    renderToolbarButtons() {
        return (
            <React.Fragment>
                <button
                    key="swamm-bmp-creator-button"
                    className={'simple-view-menu-button'}
                    disabled={this.props.vectorDrawActive || this.props.visibleBmpForm}
                    onClick={() => {
                        if (this.props.storedBmpForm) {
                            this.props.showBmpForm();
                        } else {
                            this.props.makeBmpForm(this.props.defaultGroupProfile);
                        }
                        this.props.setOpenMenuGroupId(null);
                    }}
                >
                    <Message msgId="hydrata.swamm.createBmps" />
                </button>
                {this.props.targets?.length ?
                    <button
                        key="swamm-bmp-chart-button"
                        className={'simple-view-menu-button'}
                        onClick={() => {
                            this.props.showSwammBmpChart();
                            this.props.selectSwammTargetId(this.props.defaultTargetId);
                            this.props.setOpenMenuGroupId(null);
                        }}
                    >
                        <Message msgId="hydrata.swamm.dashboard" />
                    </button> :
                    <button
                        key="swamm-bmp-chart-button"
                        className={'simple-view-menu-button disabled'}
                    >
                        <span><Spinner color="white" style={{display: "inline-block"}} spinnerName="circle" noFadeIn/></span>
                    </button>
                }
                {this.props.canEditSwammMap ?
                    <button
                        key="swamm-input-button"
                        className={'simple-view-menu-button'}
                        onClick={() => {
                            this.props.setSwammInputMenu(!this.props.showSwammInputMenu);
                            this.props.setOpenMenuGroupId(null);
                        }}
                    >
                        <Message msgId="hydrata.swamm.swammModel" />
                    </button> : null
                }
            </React.Fragment>
        );
    }

    render() {
        const toolbarTarget = typeof document !== 'undefined'
            ? document.querySelector('.simple-view-left-toolbar')
            : null;
        return (
            <div id={"swamm-container"}>
                {this.props.isSwammProject ?
                    <React.Fragment>
                        {toolbarTarget ? ReactDOM.createPortal(this.renderToolbarButtons(), toolbarTarget) : null}
                        {this.props.storedBmpForm && !this.props.visibleBmpForm && !this.props.vectorDrawActive ?
                            <Button
                                className={'simple-view-menu-button sv-bmp-progress-button-success'}
                                style={{left: 30, top: 80, width: 120, backgroundColor: "darkgreen"}}
                                bsStyle={"success"}
                                onClick={() => this.props.showBmpForm()}
                            >
                                <Message msgId="hydrata.swamm.bmpInProgress" />
                            </Button>
                            : null
                        }
                        {this.props.showSwammInputMenu ?
                            <SwammInputMenu/>
                            : null
                        }
                        {this.props.visibleTargetForm ?
                            <SwammTargetForm/>
                            : null
                        }
                        {this.props.visibleBmpForm ?
                            <SwammBmpForm/>
                            : null
                        }
                        {this.props.visibleSwammBmpChart ?
                            <SwammBmpChart/>
                            : null
                        }
                        {this.props.viewBmpGroupId === this.props.openMenuGroupId ?
                            <SwammBmpFilters/>
                            : null
                        }
                        {this.props.loadingBmp ?
                            <button className={'simple-view-menu-button sv-bmp-loading-button'}>
                                <div style={{marginBottom: "10px"}}><Message msgId="hydrata.swamm.loadingBmpData" /></div>
                                <span><Spinner color="white" style={{display: "inline-block"}} spinnerName="circle" noFadeIn/></span>
                            </button>
                            : null
                        }
                        <BmpChooserModal/>
                        <BmpHistoryViewer/>
                    </React.Fragment>
                    : null}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const membershipSlugs = state?.swamm?.userGroupProfileSlugs || state?.security?.user?.info?.groups || [];
    const allowedGroupProfileNames = membershipSlugs.filter(item => !["anonymous", "registered-members", "admin"].includes(item));
    const allowedGroupProfiles = state?.swamm?.groupProfiles?.filter(item => allowedGroupProfileNames.includes(item.slug)) || [];
    return {
        canEditSwammMap: canEditSwammMap(state),
        gnResourceLoaded: state?.gnresource?.id,
        isSwammProject: !!state?.swamm?.projectData?.id,
        mapId: state?.map?.present?.info?.id,
        hasPmData: state?.swamm?.data,
        defaultGroupProfile: allowedGroupProfiles[0],
        bmpUniqueNames: bmpByUniqueNameSelector(state),
        bmpTypes: state?.swamm?.bmpTypes,
        groupProfiles: state?.swamm.groupProfiles,
        statuses: state?.swamm?.statuses,
        targets: state?.swamm?.targets,
        fetchingTargets: state?.swamm?.fetchingTargets,
        projectCode: state?.swamm?.data?.code,
        layers: state?.layers,
        visibleBmpForm: state?.swamm?.visibleBmpForm,
        storedBmpForm: state?.swamm?.storedBmpForm,
        vectorDrawActive: state?.vectorDraw?.phase
            && state?.vectorDraw?.phase !== 'idle'
            && state?.vectorDraw?.phase !== 'cancelling',
        visibleSwammBmpChart: state?.swamm?.visibleSwammBmpChart,
        showSwammInputMenu: state?.swamm?.showSwammInputMenu,
        defaultTargetId: state?.swamm?.targets?.[0]?.id || 0,
        visibleTargetForm: state?.swamm?.visibleTargetForm,
        loadingBmp: state?.swamm?.loadingBmp,
        numberOfMenus: state?.layers?.groups?.length,
        viewBmpGroupId: state?.layers?.groups?.filter((group) => group?.title === "View BMPs" || group?.name === "View BMPs")[0]?.id,
        openMenuGroupId: state?.simpleView?.openMenuGroupId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        initSwamm: () => dispatch(initSwamm()),
        setSwammInputMenu: (visible) => dispatch(setSwammInputMenu(visible)),
        fetchSwammBmpTypes: (mapId) => dispatch(fetchSwammBmpTypes(mapId)),
        fetchProjectManagerConfig: fetchProjectManagerConfig(dispatch),
        fetchGroupProfiles: () => dispatch(fetchGroupProfiles()),
        fetchSwammBmpStatuses: (projectId) => dispatch(fetchSwammBmpStatuses(projectId)),
        fetchSwammTargets: (projectId) => dispatch(fetchSwammTargets(projectId)),
        selectSwammTargetId: (targetId) => dispatch(selectSwammTargetId(targetId)),
        toggleLayer: (layer, isVisible) => dispatch(changeLayerProperties(layer, {visibility: isVisible})),
        showBmpForm: () => dispatch(showBmpForm()),
        showSwammBmpChart: () => dispatch(showSwammBmpChart()),
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        makeBmpForm: (bmpTypeId) => dispatch(makeBmpForm(bmpTypeId)),
        query: (url, filterObj, queryOptions, reason) => dispatch(query(url, filterObj, queryOptions, reason)),
        toggleBmpType: (bmpType) => dispatch(toggleBmpType(bmpType)),
        toggleSyncWms: () => dispatch(toggleSyncWms())
    };
};


export default connect(mapStateToProps, mapDispatchToProps)(SwammContainer);
