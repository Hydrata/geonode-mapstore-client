import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {hideSwammBmpChart, selectSwammTargetId, setBmpFilterMode, showTargetForm, downloadTargetData} from "../../actionsSwamm";
import '../../swamm.css';
import {CIRCLE_SIZE, POLLUTANTS, CHART_COLOURS} from "./constants";
import {TargetSelector} from "./TargetSelector";
import {PollutantCard} from "./PollutantCard";
import {SummaryTable} from "./SummaryTable";
import {LegendPanel} from "./LegendPanel";

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
        return (
            <div
                id={'swamm-bmp-chart-panel'}
                className={'simple-view-panel menu-rows-container'}
            >
                <div id={"swamm-bmp-chart-header"}>
                    <div>
                        Dashboard: {this.props.selectedTarget?.name}
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.hideSwammBmpChart();
                        }}
                    />
                </div>
                <div id={"swamm-bmp-chart-body"}>
                    <TargetSelector
                        targets={this.props.targets}
                        selectedTargetId={this.props.selectedTargetId}
                        selectSwammTargetId={this.props.selectSwammTargetId}
                        showTargetForm={this.props.showTargetForm}
                        selectedTarget={this.props.selectedTarget}
                        bmpFilterMode={this.props.bmpFilterMode}
                        setBmpFilterMode={this.props.setBmpFilterMode}
                        downloadTargetData={this.props.downloadTargetData}
                        projectId={this.props.projectId}
                    />
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
                                    />
                                );
                            })
                        }
                        <SummaryTable
                            selectedTarget={this.props.selectedTarget}
                        />
                    </div>
                    <LegendPanel
                        selectedTarget={this.props.selectedTarget}
                        bmpFilterMode={this.props.bmpFilterMode}
                        colours={CHART_COLOURS}
                    />
                </div>
                <div id={"swamm-bmp-chart-footer"}>
                    <button
                        className={"swamm-button"}
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
        projectId: state?.swamm?.projectData?.id
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideSwammBmpChart: () => dispatch(hideSwammBmpChart()),
        selectSwammTargetId: (selectedTargetId) => dispatch(selectSwammTargetId(selectedTargetId)),
        setBmpFilterMode: (mode) => dispatch(setBmpFilterMode(mode)),
        showTargetForm: (target) => dispatch(showTargetForm(target)),
        downloadTargetData: (projectId, targetId) => dispatch(downloadTargetData(projectId, targetId))
    };
};

const SwammBmpChart = connect(mapStateToProps, mapDispatchToProps)(SwammBmpChartClass);


export {
    SwammBmpChart
};
