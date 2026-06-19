import React from "react";
import {Card, Table} from "../../../SimpleView/components/primitives";
import {formatMoney, formatCurrency} from "../../../Utils/utils";

const computeProjectedCost = (targetRequired, actual, costPerUnit) => {
    if (!targetRequired || !costPerUnit) return null;
    const remaining = targetRequired - (actual || 0);
    if (remaining <= 0) return 'met';
    return remaining * costPerUnit;
};

const renderProjectedCost = (targetRequired, actual, costPerUnit) => {
    const result = computeProjectedCost(targetRequired, actual, costPerUnit);
    if (result === 'met') {
        return <span style={{color: '#27ca3b'}}>Target met</span>;
    }
    return formatCurrency(result);
};

const SummaryTable = ({ selectedTarget }) => {
    const sd = selectedTarget?.speedDialData;
    return (
        <Card
            variant="chart"
            extraClassName="swamm-bmp-chart-summary"
            style={{margin: '10px'}}
            bodyStyle={{padding: 0}}
        >
            <Table surface="light" extraClassName="text-right sv-swamm-summary-table" style={{tableLayout: 'auto'}} aria-label="Dashboard summary">
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
                        <td>{formatMoney(sd?.currentPhosphorusLoad, 0)}</td>
                        <td>{formatMoney(sd?.currentNitrogenLoad, 0)}</td>
                        <td>{formatMoney(sd?.currentSedimentLoad, 0)}</td>
                        <td className={"text-left"}>units/year</td>
                    </tr>
                    <tr>
                        <td>Selected target reduction percentage:</td>
                        <td>{(sd?.percentPhosphorusReductionTarget * 100).toFixed(0)}</td>
                        <td>{(sd?.percentNitrogenReductionTarget * 100).toFixed(0)}</td>
                        <td>{(sd?.percentSedimentReductionTarget * 100).toFixed(0)}</td>
                        <td className={"text-left"}>% of total</td>
                    </tr>
                    <tr>
                        <td>Selected target load reduction required:</td>
                        <td>{formatMoney(sd?.targetPhosphorusLoadReductionRequired, 0)}</td>
                        <td>{formatMoney(sd?.targetNitrogenLoadReductionRequired, 0)}</td>
                        <td>{formatMoney(sd?.targetSedimentLoadReductionRequired, 0)}</td>
                        <td className={"text-left"}>units/year</td>
                    </tr>
                    <tr>
                        <td>Actual pollutant reduction from BMPs:</td>
                        <td>{formatMoney(sd?.totalBmpPhosphorusReduction, 0)}</td>
                        <td>{formatMoney(sd?.totalBmpNitrogenReduction, 0)}</td>
                        <td>{formatMoney(sd?.totalBmpSedimentReduction, 0)}</td>
                        <td className={"text-left"}>units/year</td>
                    </tr>
                    <tr>
                        <td>Percentage of target achieved:</td>
                        <td>{sd?.percentPhosphorusTarget?.[0]?.value?.toFixed(1)}</td>
                        <td>{sd?.percentNitrogenTarget?.[0]?.value?.toFixed(1)}</td>
                        <td>{sd?.percentSedimentTarget?.[0]?.value?.toFixed(1)}</td>
                        <td className={"text-left"}>%</td>
                    </tr>
                    <tr>
                        <td>Avg cost per unit reduced:</td>
                        <td>{formatCurrency(sd?.costPerLbsPReduced)}</td>
                        <td>{formatCurrency(sd?.costPerLbsNReduced)}</td>
                        <td>{formatCurrency(sd?.costPerTonSReduced)}</td>
                        <td className={"text-left"}>$/unit</td>
                    </tr>
                    <tr>
                        <td>Projected cost to target:</td>
                        <td>{renderProjectedCost(sd?.targetPhosphorusLoadReductionRequired, sd?.totalBmpPhosphorusReduction, sd?.costPerLbsPReduced)}</td>
                        <td>{renderProjectedCost(sd?.targetNitrogenLoadReductionRequired, sd?.totalBmpNitrogenReduction, sd?.costPerLbsNReduced)}</td>
                        <td>{renderProjectedCost(sd?.targetSedimentLoadReductionRequired, sd?.totalBmpSedimentReduction, sd?.costPerTonSReduced)}</td>
                        <td className={"text-left"}>$</td>
                    </tr>
                </tbody>
            </Table>
        </Card>
    );
};

export { SummaryTable };
