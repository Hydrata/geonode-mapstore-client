import React from "react";
import {Table} from "react-bootstrap";

const BmpReductionDisplay = ({ storedBmpForm, complexBmpForm, watershedIsFootprint }) => {
    if (complexBmpForm) {
        return (
            <React.Fragment>
                <Table
                    condensed
                    bordered
                    hover
                    responsive="sm"
                    className={"text-right"}
                    style={{
                        tableLayout: "fixed",
                        border: "solid 1px rgb(255, 255, 255, 0.2)",
                        borderRadius: "2px"
                    }}
                >
                    <thead>
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <th style={{"width": "30%"}}>Results</th>
                            <th style={{"width": "13%"}}>Surface</th>
                            <th style={{"width": "13%"}}>Tiled</th>
                            <th style={{"width": "13%", "word-break": "break-word"}}>Gully/<wbr/>Bank</th>
                            <th style={{"width": "10%"}}>Total</th>
                            {
                                watershedIsFootprint ?
                                    <React.Fragment>
                                        <th style={{"width": "10%"}}>Per Acre</th>
                                        <th style={{"width": "11%"}}/>
                                    </React.Fragment>
                                    :
                                    <th style={{"width": "11%"}}/>
                            }
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Nitrogen load previous: </td>
                            <td>{parseFloat(storedBmpForm?.surface_previous_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_previous_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_previous_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_previous_n_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_n_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Nitrogen load reduction: </td>
                            <td>{parseFloat(storedBmpForm?.surface_n_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_n_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_n_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_n_load_reduction?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_n_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Nitrogen load new: </td>
                            <td>{parseFloat(storedBmpForm?.surface_new_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_new_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_new_n_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_new_n_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_n_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Phosphorus load previous: </td>
                            <td>{parseFloat(storedBmpForm?.surface_previous_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_previous_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_previous_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_previous_p_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_p_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Phosphorus load reduction: </td>
                            <td>{parseFloat(storedBmpForm?.surface_p_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_p_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_p_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_p_load_reduction?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_p_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Phosphorus load new: </td>
                            <td>{parseFloat(storedBmpForm?.surface_new_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_new_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_new_p_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_new_p_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_p_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Sediment load previous: </td>
                            <td>{parseFloat(storedBmpForm?.surface_previous_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_previous_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_previous_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_previous_s_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_s_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Sediment load reduction: </td>
                            <td>{parseFloat(storedBmpForm?.surface_s_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_s_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_s_load_reduction?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_s_load_reduction?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_s_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        <tr style={{borderBottom: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Sediment load new: </td>
                            <td>{parseFloat(storedBmpForm?.surface_new_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.tiled_new_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.erosion_new_s_load?.toPrecision(3))}</td>
                            <td>{parseFloat(storedBmpForm?.total_new_s_load?.toPrecision(3))}</td>
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_s_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Cost Estimate:</td>
                            {storedBmpForm?.calculated_total_cost ?
                                <td>${Number(storedBmpForm?.calculated_total_cost?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td/>
                        </tr>
                        <tr>
                            <td>Nitrogen reduction value: </td>
                            {storedBmpForm?.total_cost_per_lbs_n_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_lbs_n_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/lb/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Phosphorus reduction value: </td>
                            {storedBmpForm?.total_cost_per_lbs_p_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_lbs_p_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/lb/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Sediment reduction value: </td>
                            {storedBmpForm?.total_cost_per_ton_s_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_ton_s_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/ton/<wbr/>year</td>
                        </tr>
                    </tbody>
                </Table>
                {storedBmpForm?.created_by ?
                    <p>Created by: {storedBmpForm?.created_by} on {new Date(storedBmpForm?.created_at).toLocaleString()}</p> :
                    null
                }
                {storedBmpForm?.updated_by ?
                    <p>Updated by: {storedBmpForm?.updated_by} on {new Date(storedBmpForm?.updated_at).toLocaleString()}</p> :
                    null
                }
            </React.Fragment>
        );
    }

    return (
        <Table
            bordered
            condensed
            hover
            responsive="sm"
            style={{
                tableLayout: "fixed",
                border: "solid 1px rgb(255, 255, 255, 0.2)",
                borderRadius: "2px"
            }}
            className={"text-right"}
        >
            <thead>
                <tr>
                    <th>Results</th>
                    <th style={{"width": "100px"}}>Total</th>
                    <th/>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Nitrogen load reduction: </td>
                    <td>{storedBmpForm?.total_n_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>lbs/year</td>
                </tr>
                <tr>
                    <td>Phosphorus load reduction: </td>
                    <td>{storedBmpForm?.total_p_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>lbs/year</td>
                </tr>
                <tr>
                    <td>Sediment load reduction: </td>
                    <td>{storedBmpForm?.total_s_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>tons/year</td>
                </tr>
            </tbody>
        </Table>
    );
};

export { BmpReductionDisplay };
