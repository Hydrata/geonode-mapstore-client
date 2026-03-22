import React from "react";
import {formatMoney} from "../../../Utils/utils";
const {Cell, BarChart, Bar, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Tooltip} = require('recharts');

const formatTooltipLabel = (name, value, barEntry, loadKey) => {
    const reduction = formatMoney(value, 0);
    if (!barEntry || !barEntry.total_cost || !value) {
        return `${name} - ${reduction}`;
    }
    const costPerUnit = barEntry.total_cost / value;
    if (loadKey === 'total_s_load_reduction') {
        return `${name} - ${reduction} tons/yr ($${formatMoney(costPerUnit, 0)}/ton)`;
    }
    return `${name} - ${reduction} lbs/yr ($${formatMoney(costPerUnit, 0)}/lb)`;
};

const CustomTooltipTwo = ({ active, payload, label, tooltipKey }) => {
    if (active && payload && payload.length && tooltipKey) {
        return payload.map(bar => {
            if (bar.dataKey === tooltipKey) {
                const tooltipKeys = tooltipKey.split('.');
                const barEntry = bar.payload[tooltipKeys[0]][Number(tooltipKeys[1])];
                const barValue = barEntry[tooltipKeys[2]];
                const loadKey = tooltipKeys[2];
                return (
                    <div className="custom-tooltip">
                        <div className="custom-tooltip-label">
                            {formatTooltipLabel(bar?.name, barValue, barEntry, loadKey)}
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

const PollutantCard = ({
    pollutant,
    selectedTarget,
    rechartsBarData,
    colours,
    circleSize,
    tooltipKey,
    onTooltipKeyChange
}) => (
    <div
        id={`swamm-bmp-chart-${pollutant.name.toLowerCase()}`}
        className={"swamm-bmp-chart-graph-container"}
        aria-label={`${pollutant.name} load reduction chart`}
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
                        data={selectedTarget?.speedDialData?.[`percent${pollutant.name}Target`]}
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
                                    {selectedTarget?.speedDialData[`percent${pollutant.name}Target`]?.[0]?.value.toFixed(1) + '%'}
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
                                    {selectedTarget?.barChartData?.total_bmp_count}
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
                        data={rechartsBarData}
                        layout="vertical"
                        height={100}
                    >
                        {rechartsBarData?.[0]?.barOne?.map((bar, index) => {
                            const dataKey = `barOne.${index}.${pollutant.load_red_total_key}`;
                            return (
                                <Bar
                                    key={`${bar?.type} + ${pollutant.initial} + ${index}`}
                                    stackId={`a`}
                                    dataKey={dataKey}
                                    fill={colours[index]}
                                    name={bar?.label}
                                    onMouseOver={ () => onTooltipKeyChange(dataKey) }
                                    isAnimationActive={false}
                                />
                            );
                        })}
                        <Tooltip content={<CustomTooltipTwo tooltipKey={tooltipKey}/>} />
                        <XAxis type="number"/>
                        <YAxis type="category" domain={[0, 0]} hide />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
);

export { PollutantCard, formatTooltipLabel };
