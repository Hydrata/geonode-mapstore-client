import React, { useState } from "react";
import { Card, Table } from "../../../SimpleView/components/primitives";
import { formatMoney, formatCurrency } from "../../../Utils/utils";

const FILTER_LABELS = {
    group_profile: 'Organization',
    type: 'BMP Type',
    status: 'Status',
    swamm_engine: 'Sub-Watershed'
};

const OrgTable = ({ barChartData, bmpFilterMode = 'group_profile' }) => {
    const [sortKey, setSortKey] = useState('label');
    const [sortDir, setSortDir] = useState('asc');

    const data = barChartData?.[bmpFilterMode] || [];
    const groupLabel = FILTER_LABELS[bmpFilterMode] || 'Group';

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedData = [...data].sort((a, b) => {
        const aVal = a[sortKey] || 0;
        const bVal = b[sortKey] || 0;
        if (typeof aVal === 'string') {
            return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const totals = data.reduce((acc, row) => ({
        total_cost: (acc.total_cost || 0) + (row.total_cost || 0),
        total_n_load_reduction: (acc.total_n_load_reduction || 0) + (row.total_n_load_reduction || 0),
        total_p_load_reduction: (acc.total_p_load_reduction || 0) + (row.total_p_load_reduction || 0),
        total_s_load_reduction: (acc.total_s_load_reduction || 0) + (row.total_s_load_reduction || 0)
    }), {});

    const buildTsvString = () => {
        const header = `${groupLabel}\tTotal Cost\tN Reduction\tP Reduction\tS Reduction`;
        const rows = sortedData.map(row =>
            `${row.label}\t${row.total_cost || 0}\t${row.total_n_load_reduction || 0}\t${row.total_p_load_reduction || 0}\t${row.total_s_load_reduction || 0}`
        );
        const totalRow = `Total\t${totals.total_cost}\t${totals.total_n_load_reduction}\t${totals.total_p_load_reduction}\t${totals.total_s_load_reduction}`;
        return [header, ...rows, totalRow].join('\n');
    };

    const handleCopy = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(buildTsvString());
        }
    };

    const sortIndicator = (key) => {
        if (sortKey !== key) return '';
        return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
    };

    return (
        <Card
            variant="chart"
            extraClassName="swamm-bmp-chart-org-table"
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{groupLabel} Contributions</span>
                    <button className="swamm-button" onClick={handleCopy} style={{ fontSize: 'small', marginTop: 0 }}>
                        Copy
                    </button>
                </div>
            }
            style={{ margin: '10px', color: '#155481' }}
            bodyStyle={{ overflowX: 'auto' }}
        >
            <Table surface="light" style={{ tableLayout: 'auto' }} aria-label={`${groupLabel} contributions`}>
                <thead>
                    <tr style={{ backgroundColor: '#063167', color: 'white' }}>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'left' }} onClick={() => handleSort('label')}>
                            {groupLabel}{sortIndicator('label')}
                        </th>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('total_cost')}>
                            Total Cost{sortIndicator('total_cost')}
                        </th>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('total_n_load_reduction')}>
                            N Reduction{sortIndicator('total_n_load_reduction')}
                        </th>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('total_p_load_reduction')}>
                            P Reduction{sortIndicator('total_p_load_reduction')}
                        </th>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('total_s_load_reduction')}>
                            S Reduction{sortIndicator('total_s_load_reduction')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5' }}>
                            <td style={{ padding: '6px', textAlign: 'left' }}>{row.label}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.total_cost)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_n_load_reduction, 0)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_p_load_reduction, 0)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_s_load_reduction, 0)}</td>
                        </tr>
                    ))}
                    <tr style={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
                        <td style={{ padding: '6px', textAlign: 'left' }}>Total</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(totals.total_cost)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_n_load_reduction, 0)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_p_load_reduction, 0)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_s_load_reduction, 0)}</td>
                    </tr>
                </tbody>
            </Table>
        </Card>
    );
};

export { OrgTable };
