import React from "react";
import {Table} from "react-bootstrap";
import {formatMoney} from "../../../Utils/utils";

const SummaryTable = ({ selectedTarget }) => (
    <div id={"swamm-bmp-chart-summary"}>
        <Table bordered condensed hover className={"text-right"} aria-label="Dashboard summary">
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
                    <td>{formatMoney(selectedTarget?.speedDialData?.currentPhosphorusLoad, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.currentNitrogenLoad, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.currentSedimentLoad, 0)}</td>
                    <td className={"text-left"}>units/year</td>
                </tr>
                <tr>
                    <td>Selected target reduction percentage:</td>
                    <td>{(selectedTarget?.speedDialData?.percentPhosphorusReductionTarget * 100).toFixed(0)}</td>
                    <td>{(selectedTarget?.speedDialData?.percentNitrogenReductionTarget * 100).toFixed(0)}</td>
                    <td>{(selectedTarget?.speedDialData?.percentSedimentReductionTarget * 100).toFixed(0)}</td>
                    <td className={"text-left"}>% of total</td>
                </tr>
                <tr>
                    <td>Selected target load reduction required:</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.targetPhosphorusLoadReductionRequired, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.targetNitrogenLoadReductionRequired, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.targetSedimentLoadReductionRequired, 0)}</td>
                    <td className={"text-left"}>units/year</td>
                </tr>
                <tr>
                    <td>Actual pollutant reduction from BMPs:</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.totalBmpPhosphorusReduction, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.totalBmpNitrogenReduction, 0)}</td>
                    <td>{formatMoney(selectedTarget?.speedDialData?.totalBmpSedimentReduction, 0)}</td>
                    <td className={"text-left"}>units/year</td>
                </tr>
                <tr>
                    <td>Percentage of target achieved:</td>
                    <td>{selectedTarget?.speedDialData?.percentPhosphorusTarget?.[0]?.value?.toFixed(1)}</td>
                    <td>{selectedTarget?.speedDialData?.percentNitrogenTarget?.[0]?.value?.toFixed(1)}</td>
                    <td>{selectedTarget?.speedDialData?.percentSedimentTarget?.[0]?.value?.toFixed(1)}</td>
                    <td className={"text-left"}>%</td>
                </tr>
            </tbody>
        </Table>
    </div>
);

export { SummaryTable };
