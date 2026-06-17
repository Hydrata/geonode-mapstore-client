import React from "react";
import {Card} from "../../../SimpleView/components/primitives";

const LegendPanel = ({ selectedTarget, bmpFilterMode, colours }) => (
    <div id={"swamm-bmp-chart-col-three"} aria-label="Chart legend">
        <Card variant="chart" title="Legend" style={{margin: 0, color: '#155481'}}>
            <div id={"swamm-bmp-chart-legend-rows"}>
                {
                    selectedTarget?.barChartData?.[bmpFilterMode]?.map((bar, index) => {
                        return (
                            <div className={"swamm-bmp-chart-legend-row"} key={`legend-${index}`}>
                                <div>
                                    <svg width="30px" height="15px">
                                        <rect
                                            width="15px"
                                            height="15px"
                                            fill={colours[index]}
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
        </Card>
    </div>
);

export { LegendPanel };
