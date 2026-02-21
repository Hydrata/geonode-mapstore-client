import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table} from "react-bootstrap";
import {formatMoney} from "../../Utils/utils";
import {hideSwammBmpChart, selectSwammTargetId, setBmpFilterMode, showTargetForm, downloadTargetData} from "../actionsSwamm";
const {Cell, BarChart, Bar, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import Message from '@mapstore/framework/components/I18N/Message';
import '../swamm.css';

const circleSize = 100;

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
                        <Message msgId="hydrata.swamm.dashboardPrefix" /> {this.props.selectedTarget?.name}
                    </div>
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.hideSwammBmpChart();
                        }}
                    />
                </div>
                <div id={"swamm-bmp-chart-body"}>
                    <div id={"swamm-bmp-chart-col-one"}>
                        <div id={"swamm-bmp-chart-targets"}>
                            <div className={"swamm-bmp-chart-heading"}><Message msgId="hydrata.swamm.targets" /></div>
                            {this.props.targets.map((target) => {
                                return (
                                    <button
                                        className={"swamm-button"}
                                        style={{
                                            backgroundColor: target.id === this.props.selectedTargetId ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                        }}
                                        onClick={() => this.props.selectSwammTargetId(target?.id)}>
                                        {target?.name}
                                    </button>
                                );
                            })}
                            <button
                                className={"swamm-button"}
                                style={{marginTop: "10px"}}
                                onClick={() => this.props.showTargetForm(null)}>
                                <Message msgId="hydrata.swamm.newTarget" />
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{marginTop: "10px", marginBottom: "10px"}}
                                onClick={() => this.props.showTargetForm(this.props.selectedTarget)}>
                                <Message msgId="hydrata.swamm.editTarget" />
                            </button>
                        </div>
                        <div id={"swamm-bmp-chart-filter"}>
                            <div className={"swamm-bmp-chart-heading"}>
                                <Message msgId="hydrata.swamm.sortDataBy" />:
                            </div>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'type' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('type')}
                            >
                                <Message msgId="hydrata.swamm.bmpType" />
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'status' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('status')}
                            >
                                <Message msgId="hydrata.swamm.bmpStatus" />
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'group_profile' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('group_profile')}
                            >
                                <Message msgId="hydrata.swamm.organization" />
                            </button>
                        </div>
                        <div id={"swamm-bmp-chart-download"}>
                            <div className={"swamm-bmp-chart-heading"}>
                                <Message msgId="hydrata.swamm.downloadTargetData" />:
                            </div>
                            <button
                                className={"swamm-button"}
                                onClick={() => this.props.downloadTargetData(this.props.projectId, this.props.selectedTargetId)}
                            >
                                *.xlsx
                            </button>
                        </div>
                    </div>
                    <div id={"swamm-bmp-chart-col-two"}>
                        {
                            this.pollutants.map(pollutant => {
                                return (
                                    <div
                                        id={`swamm-bmp-chart-${pollutant.name.toLowerCase()}`}
                                        className={"swamm-bmp-chart-graph-container"}
                                    >
                                        <div className={"swamm-bmp-chart-heading"}>
                                            {pollutant.title}
                                        </div>
                                        <div
                                            id={`swamm-bmp-chart-${pollutant.name.toLowerCase()}-graph-box`}
                                            className={"swamm-bmp-chart-graph-box"}
                                        >
                                            <div className={"swamm-bmp-chart-pie-group"}>
                                                <PieChart
                                                    width={circleSize * 1.5}
                                                    height={circleSize * 1.5}
                                                    style={{paddingTop: "10px"}}
                                                >
                                                    <Pie
                                                        data={this.props.selectedTarget?.speedDialData?.[`percent${pollutant.name}Target`]}
                                                        dataKey="value"
                                                        cx={circleSize / 1.3 - 10}
                                                        cy={circleSize / 2}
                                                        innerRadius={circleSize / 3}
                                                        outerRadius={circleSize / 2}
                                                        fill="#82ca9d"
                                                        startAngle={180}
                                                        endAngle={0}
                                                        isAnimationActive={false}
                                                    >
                                                        <Cell fill={"#27ca3b"} cornerRadius={1}/>
                                                        <Cell fill={"#97b3c3"} cornerRadius={1}/>
                                                    </Pie>
                                                    {
                                                        pollutant.initial !== 'a' ?
                                                            <text
                                                                x={circleSize / 1.3 - 5}
                                                                y={circleSize / 2 - 5}
                                                                textAnchor="middle"
                                                                fontSize={circleSize / 5}
                                                                dominantBaseline="middle"
                                                                className="progress-label"
                                                            >
                                                                <tspan
                                                                    y={40}
                                                                >
                                                                    {this.props.selectedTarget?.speedDialData[`percent${pollutant.name}Target`]?.[0]?.value.toFixed(1) + '%'}
                                                                </tspan>
                                                                <tspan
                                                                    x={circleSize / 1.3 - 5}
                                                                    y={circleSize / 2 + 18}
                                                                    textAnchor="middle"
                                                                    fontSize={circleSize / 5}
                                                                    dominantBaseline="middle"
                                                                    className="progress-label"
                                                                >
                                                                    of Target
                                                                </tspan>
                                                            </text> :
                                                            <text
                                                                x={circleSize / 1.3 - 5}
                                                                y={18}
                                                                textAnchor="middle"
                                                                fontSize={circleSize / 5}
                                                                dominantBaseline="middle"
                                                                className="progress-label"
                                                            >
                                                                <tspan
                                                                    y={18}
                                                                >
                                                                    BMP Count:
                                                                </tspan>
                                                                <tspan
                                                                    x={circleSize / 1.3 - 5}
                                                                    y={50}
                                                                    textAnchor="middle"
                                                                    fontSize={circleSize / 5}
                                                                    dominantBaseline="middle"
                                                                    className="progress-label"
                                                                >
                                                                    {this.props.selectedTarget?.barChartData?.total_bmp_count}
                                                                </tspan>
                                                            </text>
                                                    }
                                                </PieChart>
                                            </div>
                                            <div className={"swamm-bmp-chart-bar-group"}>
                                                <ResponsiveContainer
                                                    width={'95%'}
                                                    height={100}
                                                    className={'swamm-bmp-chart-bar-group-responsive'}
                                                >
                                                    <BarChart
                                                        data={this.props.rechartsBarData}
                                                        layout="vertical"
                                                        height={100}
                                                    >
                                                        {this.props.rechartsBarData?.[0]?.barOne?.map((bar, index) => {
                                                            const dataKey = `barOne.${index}.${pollutant.load_red_total_key}`;
                                                            return (
                                                                <Bar
                                                                    key={`${bar?.type} + ${pollutant.initial} + ${index}`}
                                                                    stackId={`a`}
                                                                    dataKey={dataKey}
                                                                    fill={this.colours[index]}
                                                                    name={bar?.label}
                                                                    onMouseOver={ () => this.setState({ tooltipKey: dataKey }) }
                                                                    isAnimationActive={false}
                                                                />
                                                            );
                                                        })}
                                                        <Tooltip content={<CustomTooltipTwo tooltipKey={this.state.tooltipKey}/>} />
                                                        <XAxis type="number"/>
                                                        <YAxis type="category" domain={[0, 0]} hide />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                        <div id={"swamm-bmp-chart-summary"}>
                            <Table bordered condensed hover className={"text-right"}>
                                <thead>
                                    <tr>
                                        <th><Message msgId="hydrata.swamm.summary" /></th>
                                        <th style={{'textAlign': 'center'}}><Message msgId="hydrata.swamm.phosphorus" /></th>
                                        <th style={{'textAlign': 'center'}}><Message msgId="hydrata.swamm.nitrogen" /></th>
                                        <th style={{'textAlign': 'center'}}><Message msgId="hydrata.swamm.sediment" /></th>
                                        <th/>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><Message msgId="hydrata.swamm.currentTotalUntreatedVolume" /></td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentPhosphorusLoad, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentNitrogenLoad, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentSedimentLoad, 0)}</td>
                                        <td className={"text-left"}><Message msgId="hydrata.swamm.unitsPerYear" /></td>
                                    </tr>
                                    <tr>
                                        <td><Message msgId="hydrata.swamm.selectedTargetReductionPercentage" /></td>
                                        <td>{(this.props.selectedTarget?.speedDialData?.percentPhosphorusReductionTarget * 100).toFixed(0)}</td>
                                        <td>{(this.props.selectedTarget?.speedDialData?.percentNitrogenReductionTarget * 100).toFixed(0)}</td>
                                        <td>{(this.props.selectedTarget?.speedDialData?.percentSedimentReductionTarget * 100).toFixed(0)}</td>
                                        <td className={"text-left"}><Message msgId="hydrata.swamm.percentOfTotal" /></td>
                                    </tr>
                                    <tr>
                                        <td><Message msgId="hydrata.swamm.selectedTargetLoadReductionRequired" /></td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetPhosphorusLoadReductionRequired, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetNitrogenLoadReductionRequired, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetSedimentLoadReductionRequired, 0)}</td>
                                        <td className={"text-left"}><Message msgId="hydrata.swamm.unitsPerYear" /></td>
                                    </tr>
                                    <tr>
                                        <td><Message msgId="hydrata.swamm.actualPollutantReductionFromBmps" /></td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpPhosphorusReduction, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpNitrogenReduction, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpSedimentReduction, 0)}</td>
                                        <td className={"text-left"}><Message msgId="hydrata.swamm.unitsPerYear" /></td>
                                    </tr>
                                    <tr>
                                        <td><Message msgId="hydrata.swamm.percentageOfTargetAchieved" /></td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentPhosphorusTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentNitrogenTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentSedimentTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td className={"text-left"}><Message msgId="hydrata.swamm.percent" /></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <div id={"swamm-bmp-chart-col-three"}>
                        <div className={"swamm-bmp-chart-heading"}><Message msgId="hydrata.swamm.legend" /></div>
                        <div id={"swamm-bmp-chart-legend-rows"}>
                            {
                                this.props.selectedTarget?.barChartData?.[this.props.bmpFilterMode]?.map((bar, index) => {
                                    return (
                                        <div className={"swamm-bmp-chart-legend-row"}>
                                            <div>
                                                <svg width="30px" height="15px">
                                                    <rect
                                                        width="15px"
                                                        height="15px"
                                                        fill={this.colours[index]}
                                                    />
                                                </svg>
                                            </div>
                                            <div>
                                                {bar?.label}
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                </div>
                <div id={"swamm-bmp-chart-footer"}>
                    <button
                        className={"swamm-button"}
                        onClick={() => this.props.hideSwammBmpChart()}>
                        <Message msgId="hydrata.swamm.close" />
                    </button>
                </div>
            </div>
        );
    }

    pollutants = [
        {
            name: 'Phosphorus',
            load_red_total_key: 'total_p_load_reduction',
            title: 'Phosphorus Load reductions (lbs/year)',
            initial: 'p'
        },
        {
            name: 'Nitrogen',
            load_red_total_key: 'total_n_load_reduction',
            title: 'Nitrogen Load reductions (lbs/year)',
            initial: 'n'
        },
        {
            name: 'Sediment',
            load_red_total_key: 'total_s_load_reduction',
            title: 'Sediment Load reductions (tons/year)',
            initial: 's'
        }, {
            name: 'Total',
            load_red_total_key: 'calculated_watershed_area',
            title: 'Treated Area (acres)',
            initial: 'a'
        }
    ]

    colours = [
        '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
        '#39CCCC', '#7FDBFF', '#0074D9', '#001f3f',
        '#FFDC00', '#01FF70', '#2ECC40', '#3D9970',
        '#DDDDDD', '#AAAAAA', '#B10DC9', '#F012BE',
        '#85144b', '#FF4136', '#FF851B', '#FFFFFF',
        '#0088FEAA', '#00C49FAA', '#FFBB28AA', '#FF8042AA',
        '#39CCCCAA', '#7FDBFFAA', '#0074D9AA', '#001f3fAA'
    ];
}

const CustomTooltipTwo = ({ active, payload, label, tooltipKey }) => {
    if (active && payload && payload.length && tooltipKey) {
        return payload.map(bar => {
            if (bar.dataKey === tooltipKey) {
                const tooltipKeys = tooltipKey.split('.');
                const barValue = bar.payload[tooltipKeys[0]][Number(tooltipKeys[1])][tooltipKeys[2]];
                return (
                    <div className="custom-tooltip">
                        <div className="custom-tooltip-label">
                            {bar?.name} - {formatMoney(barValue, 0)}
                        </div>
                        <br/>
                    </div >
                );
            }
            return null;
        });
    }
    return null;
};

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
