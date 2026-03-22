import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import { ErrorBoundary } from 'react-error-boundary';
import {hideSwammBmpChart, selectSwammTargetId, setBmpFilterMode, showTargetForm, downloadTargetData, downloadSummaryCSV, downloadTargetPdf, setDashboardView, setNormalizationMode} from "../../actionsSwamm";
import '../../swamm.css';
import {CIRCLE_SIZE, POLLUTANTS, CHART_COLOURS} from "./constants";
import {TargetSelector} from "./TargetSelector";
import {PollutantCard} from "./PollutantCard";
import {SummaryTable} from "./SummaryTable";
import {LegendPanel} from "./LegendPanel";
import {OrgTable} from "./OrgTable";

const DashboardErrorFallback = () => (
    <div style={{padding: '20px', color: 'white', textAlign: 'center'}}>
        Dashboard encountered an error. Please try closing and reopening the dashboard.
    </div>
);

class SwammBmpChartClass extends React.Component {
    static propTypes = {
        hideSwammBmpChart: PropTypes.func,
        data: PropTypes.array,
        rechartsBarData: PropTypes.array,
        targets: PropTypes.array,
        selectSwammTargetId: PropTypes.func,
        showTargetForm: PropTypes.func,
        selectedTargetId: PropTypes.number,
        defaultTargetId: PropTypes.number,
        selectedTarget: PropTypes.object,
        bmpFilterMode: PropTypes.string,
        setBmpFilterMode: PropTypes.func,
        downloadTargetData: PropTypes.func,
        downloadSummaryCSV: PropTypes.func,
        downloadTargetPdf: PropTypes.func,
        dashboardView: PropTypes.string,
        setDashboardView: PropTypes.func,
        normalizationMode: PropTypes.string,
        setNormalizationMode: PropTypes.func,
        projectId: PropTypes.number
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            tooltipKey: null
        };
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    render() {
        const isTableView = this.props.dashboardView === 'table';
        return (
            <div
                id={'swamm-bmp-chart-panel'}
                className={'simple-view-panel menu-rows-container'}
                role="region"
                aria-label="SWAMM Dashboard"
            >
                <div id={"swamm-bmp-chart-header"}>
                    <div>
                        Dashboard: {this.props.selectedTarget?.name}
                        {' '}
                        <a href="/docs/" target="_blank" rel="noopener noreferrer" aria-label="Dashboard help" style={{color: 'white', fontSize: 'small'}}>
                            <span className="glyphicon glyphicon-question-sign" />
                        </a>
                        <span style={{marginLeft: '20px', fontSize: 'small'}}>
                            <button
                                className="swamm-button"
                                style={{
                                    fontSize: 'small',
                                    backgroundColor: !isTableView ? 'rgba(39,202,59,1)' : 'rgba(39,202,59,0.6)'
                                }}
                                onClick={() => this.props.setDashboardView('chart')}
                            >
                                Chart
                            </button>
                            <button
                                className="swamm-button"
                                style={{
                                    fontSize: 'small',
                                    backgroundColor: isTableView ? 'rgba(39,202,59,1)' : 'rgba(39,202,59,0.6)'
                                }}
                                onClick={() => this.props.setDashboardView('table')}
                            >
                                Table
                            </button>
                        </span>
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        aria-label="Close dashboard"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                            this.props.hideSwammBmpChart();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                this.props.hideSwammBmpChart();
                            }
                        }}
                    />
                </div>
                <div id={"swamm-bmp-chart-body"}>
                    {(!this.props.targets || this.props.targets.length === 0) ? (
                        <div style={{padding: '20px', color: 'white', textAlign: 'center', width: '100%'}}>
                            No pollutant loading targets configured for this project.
                        </div>
                    ) : (
                        <React.Fragment>
                            <TargetSelector
                                targets={this.props.targets}
                                selectedTargetId={this.props.selectedTargetId}
                                selectSwammTargetId={this.props.selectSwammTargetId}
                                showTargetForm={this.props.showTargetForm}
                                selectedTarget={this.props.selectedTarget}
                                bmpFilterMode={this.props.bmpFilterMode}
                                setBmpFilterMode={this.props.setBmpFilterMode}
                                downloadTargetData={this.props.downloadTargetData}
                                downloadSummaryCSV={this.props.downloadSummaryCSV}
                                downloadTargetPdf={this.props.downloadTargetPdf}
                                normalizationMode={this.props.normalizationMode}
                                setNormalizationMode={this.props.setNormalizationMode}
                                projectId={this.props.projectId}
                            />
                            <ErrorBoundary FallbackComponent={DashboardErrorFallback}>
                                {isTableView ? (
                                    <OrgTable
                                        barChartData={this.props.selectedTarget?.barChartData}
                                        speedDialData={this.props.selectedTarget?.speedDialData}
                                        bmpFilterMode={this.props.bmpFilterMode}
                                    />
                                ) : (
                                    <div id={"swamm-bmp-chart-col-two"}>
                                        {
                                            POLLUTANTS.map(pollutant => {
                                                return (
                                                    <PollutantCard
                                                        key={pollutant.name}
                                                        pollutant={pollutant}
                                                        selectedTarget={this.props.selectedTarget}
                                                        rechartsBarData={this.props.rechartsBarData}
                                                        colours={CHART_COLOURS}
                                                        circleSize={CIRCLE_SIZE}
                                                        tooltipKey={this.state.tooltipKey}
                                                        onTooltipKeyChange={(key) => this.setState({ tooltipKey: key })}
                                                        normalizationMode={this.props.normalizationMode}
                                                    />
                                                );
                                            })
                                        }
                                        <SummaryTable
                                            selectedTarget={this.props.selectedTarget}
                                        />
                                    </div>
                                )}
                            </ErrorBoundary>
                            {!isTableView && (
                                <LegendPanel
                                    selectedTarget={this.props.selectedTarget}
                                    bmpFilterMode={this.props.bmpFilterMode}
                                    colours={CHART_COLOURS}
                                />
                            )}
                        </React.Fragment>
                    )}
                </div>
                <div id={"swamm-bmp-chart-footer"}>
                    <button
                        className={"swamm-button"}
                        aria-label="Close dashboard"
                        onClick={() => this.props.hideSwammBmpChart()}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const selectedTarget = state?.swamm?.targets?.filter((target) => target.id === state?.swamm?.selectedTargetId)?.[0];
    const bmpFilterMode = state?.swamm?.bmpFilterMode || 'type';
    const rechartsBarData = [{'barOne': selectedTarget?.barChartData?.[bmpFilterMode]}];
    return {
        statuses: state?.swamm?.statuses || [],
        targets: state?.swamm?.targets || [],
        selectedTargetId: state?.swamm?.selectedTargetId,
        selectedTarget: selectedTarget,
        rechartsBarData: rechartsBarData,
        bmpFilterMode: bmpFilterMode,
        visibleTargetForm: state?.swamm.visibleTargetForm,
        projectId: state?.swamm?.projectData?.id,
        dashboardView: state?.swamm?.dashboardView || 'chart',
        normalizationMode: state?.swamm?.normalizationMode || 'total'
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideSwammBmpChart: () => dispatch(hideSwammBmpChart()),
        selectSwammTargetId: (selectedTargetId) => dispatch(selectSwammTargetId(selectedTargetId)),
        setBmpFilterMode: (mode) => dispatch(setBmpFilterMode(mode)),
        showTargetForm: (target) => dispatch(showTargetForm(target)),
        downloadTargetData: (projectId, targetId) => dispatch(downloadTargetData(projectId, targetId)),
        downloadSummaryCSV: (speedDialData, targetName) => dispatch(downloadSummaryCSV(speedDialData, targetName)),
        downloadTargetPdf: (projectId, targetId) => dispatch(downloadTargetPdf(projectId, targetId)),
        setDashboardView: (view) => dispatch(setDashboardView(view)),
        setNormalizationMode: (mode) => dispatch(setNormalizationMode(mode))
    };
};

const SwammBmpChart = connect(mapStateToProps, mapDispatchToProps)(SwammBmpChartClass);


export {
    SwammBmpChart,
    DashboardErrorFallback
};
