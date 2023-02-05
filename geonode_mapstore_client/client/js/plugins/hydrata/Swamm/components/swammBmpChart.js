import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table} from "react-bootstrap";
import {formatMoney} from "../../Utils/utils";
import {hideSwammBmpChart, selectSwammTargetId, setBmpFilterMode, showTargetForm} from "../actionsSwamm";
const {Cell, BarChart, Bar, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import '../swamm.css';

const circleSize = 100;

class SwammBmpChartClass extends React.Component {
    static propTypes = {
        hideSwammBmpChart: PropTypes.func,
        allBmps: PropTypes.array,
        data: PropTypes.array,
        layerForLegend: PropTypes.object,
        targets: PropTypes.array,
        selectSwammTargetId: PropTypes.func,
        showTargetForm: PropTypes.func,
        selectedTargetId: PropTypes.number,
        defaultTargetId: PropTypes.number,
        selectedTarget: PropTypes.object,
        bmpFilterMode: PropTypes.string,
        setBmpFilterMode: PropTypes.func
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
                    <div>Dashboard: {this.props.selectedTarget?.name}</div>
                </div>
                <div id={"swamm-bmp-chart-body"}>
                    <div id={"swamm-bmp-chart-col-one"}>
                        <div id={"swamm-bmp-chart-targets"}>
                            <div className={"swamm-bmp-chart-heading"}>Targets</div>
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
                                New Target
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{marginTop: "10px", marginBottom: "10px"}}
                                onClick={() => this.props.showTargetForm(this.props.selectedTarget)}>
                                Edit Target
                            </button>
                        </div>
                        <div id={"swamm-bmp-chart-filter"}>
                            <div className={"swamm-bmp-chart-heading"}>
                                Sort Data By:
                            </div>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'type' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('type')}
                            >
                                BMP Type
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'status' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('status')}
                            >
                                BMP Status
                            </button>
                            <button
                                className={"swamm-button"}
                                style={{
                                    backgroundColor: this.props.bmpFilterMode === 'group_profile' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                                }}
                                onClick={() => this.props.setBmpFilterMode('group_profile')}
                            >
                                Organization
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
                                        {
                                            pollutant.name !== 'area' ?
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
                                                            <text
                                                                x={circleSize / 1.3 - 5}
                                                                y={circleSize / 2 - 5}
                                                                textAnchor="middle"
                                                                fontSize={circleSize / 5}
                                                                dominantBaseline="middle"
                                                                className="progress-label"
                                                            >
                                                                {
                                                                    (
                                                                        pollutant.initial !== 'a' ?
                                                                            this.props.selectedTarget?.speedDialData[`percent${pollutant.name}Target`]?.[0]?.value.toFixed(1) + '%' :
                                                                            `BMP Count: ${this.props.selectedTarget?.barChartData?.total_bmp_count}`
                                                                    )
                                                                }
                                                            </text>
                                                        </PieChart>
                                                    </div>
                                                    <div className={"swamm-bmp-chart-bar-group"}>
                                                        <ResponsiveContainer
                                                            width={'95%'}
                                                            height={150}
                                                            id={'responsive-test'}
                                                        >
                                                            <BarChart
                                                                data={[{'barOne': this.props.selectedTarget?.barChartData?.[this.props.bmpFilterMode]}]}
                                                                margin={{top: 0, right: 0, left: 10, bottom: 10}}
                                                                layout="vertical"
                                                                maxBarSize={100}
                                                            >
                                                                {this.props.selectedTarget?.barChartData?.[this.props.bmpFilterMode]?.map((bar, index) => {
                                                                    const key = `barOne.${index}.${pollutant.load_red_total_key}`;
                                                                    console.log('bar returning: ', bar, index, this.colours[index]);
                                                                    console.log('bar returning key: ', `${bar[this.props.bmpFilterMode]} + ${pollutant.initial}`);
                                                                    return (
                                                                        <Bar
                                                                            key={`${bar[this.props.bmpFilterMode]} + ${pollutant.initial}`}
                                                                            stackId={'a'}
                                                                            dataKey={key}
                                                                            fill={this.colours[index]}
                                                                            name={bar?.label}
                                                                            // onMouseOver={ () => this.setState({ tooltipKey: key }) }
                                                                            isAnimationActive={false}
                                                                        />
                                                                    );
                                                                })}
                                                                <Tooltip content={<CustomTooltipTwo tooltipKey={this.state.tooltipKey}/>} />
                                                                <XAxis type="number"/>
                                                                <YAxis type="category" hide/>
                                                                }
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div> :
                                                <div id={`${pollutant}-placeholder`}>
                                                </div>
                                        }
                                    </div>
                                );
                            })
                        }
                        <div id={"swamm-bmp-chart-summary"}>
                            <Table bordered condensed hover className={"text-right"}>
                                <thead>
                                    <tr>
                                        <th>Summary</th>
                                        <th style={{'textAlign': 'center'}}>Phosphorus</th>
                                        <th style={{'textAlign': 'center'}}>Nitrogen</th>
                                        <th style={{'textAlign': 'center'}}>Sediment</th>
                                        <th/>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Current total untreated pollutant volume:</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentPhosphorusLoad, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentNitrogenLoad, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.currentSedimentLoad, 0)}</td>
                                        <td className={"text-left"}>units/year</td>
                                    </tr>
                                    <tr>
                                        <td>Selected target reduction percentage:</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentPhosphorusReductionTarget * 100}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentNitrogenReductionTarget * 100}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentSedimentReductionTarget * 100}</td>
                                        <td className={"text-left"}>% of total</td>
                                    </tr>
                                    <tr>
                                        <td>Selected target load reduction required:</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetPhosphorusLoadReductionRequired, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetNitrogenLoadReductionRequired, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.targetSedimentLoadReductionRequired, 0)}</td>
                                        <td className={"text-left"}>units/year</td>
                                    </tr>
                                    <tr>
                                        <td>Actual pollutant reduction from BMPs:</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpPhosphorusReduction, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpNitrogenReduction, 0)}</td>
                                        <td>{formatMoney(this.props.selectedTarget?.speedDialData?.totalBmpSedimentReduction, 0)}</td>
                                        <td className={"text-left"}>units/year</td>
                                    </tr>
                                    <tr>
                                        <td>Percentage of target achieved:</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentPhosphorusTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentNitrogenTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td>{this.props.selectedTarget?.speedDialData?.percentSedimentTarget?.[0]?.value?.toFixed(1)}</td>
                                        <td className={"text-left"}>%</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <div id={"smamm-bmp-chart-col-three"}>
                        <div id={"swamm-bmp-chart-legend-container"}>
                            <div className={"swamm-bmp-chart-heading"}>Legend</div>
                            <div id={"swamm-bmp-chart-legend-rows"}>
                                {
                                    this.props.selectedTarget?.barChartData?.[this.props.bmpFilterMode]?.map((bar, index) => {
                                        return (
                                            <div className={"swamm-bmp-chart-legend-row"}>
                                                <svg width="15" height="15">
                                                    <rect
                                                        width="15"
                                                        height="15"
                                                        fill={this.colours[index]}
                                                    />
                                                </svg>
                                                <div style={{marginLeft: "15px"}}>
                                                    {bar?.label}
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>
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
        },
        {
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
        '#85144b', '#FF4136', '#FF851B', '#FFFFFF'
    ];
}

const CustomTooltipTwo = ({ active, payload, label, tooltipKey }) => {
    if (active && payload && payload.length && tooltipKey) {
        return payload.map(bar => {
            if (bar.dataKey === tooltipKey) {
                const tooltipKeys = tooltipKey.split('.');
                const barValue = bar.payload[tooltipKeys[0]][Number(tooltipKeys[1])][tooltipKeys[2]];
                return (
                    <div className="custom-tooltip" style={{background: "black", borderRadius: "3px"}}>
                        <div className="label">
                            {bar.name} - {formatMoney(barValue, 0)}
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
    const projectCode = state?.swamm?.data?.code;
    const legendLayerName = projectCode + '_bmp_footprint';
    return {
        mapId: state?.swamm?.data?.base_map,
        layerForLegend: state?.layers?.flat?.filter((layer) => layer.name === legendLayerName)[0],
        allBmps: state?.swamm?.allBmps,
        statuses: state?.swamm?.statuses || [],
        targets: state?.swamm?.targets || [],
        selectedTargetId: state?.swamm?.selectedTargetId,
        selectedTarget: state?.swamm?.targets?.filter((target) => target.id === state?.swamm?.selectedTargetId)?.[0],
        bmpFilterMode: state?.swamm?.bmpFilterMode || 'type',
        visibleTargetForm: state?.swamm.visibleTargetForm
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideSwammBmpChart: () => dispatch(hideSwammBmpChart()),
        selectSwammTargetId: (selectedTargetId) => dispatch(selectSwammTargetId(selectedTargetId)),
        setBmpFilterMode: (mode) => dispatch(setBmpFilterMode(mode)),
        showTargetForm: (target) => dispatch(showTargetForm(target))
    };
};

const SwammBmpChart = connect(mapStateToProps, mapDispatchToProps)(SwammBmpChartClass);


export {
    SwammBmpChart
};
