import React from "react";

const LegendPanel = ({ selectedTarget, bmpFilterMode, colours }) => (
    <div id={"swamm-bmp-chart-col-three"}>
        <div className={"swamm-bmp-chart-heading"}>Legend</div>
        <div id={"swamm-bmp-chart-legend-rows"}>
            {
                selectedTarget?.barChartData?.[bmpFilterMode]?.map((bar, index) => {
                    return (
                        <div className={"swamm-bmp-chart-legend-row"}>
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
    </div>
);

export { LegendPanel };
