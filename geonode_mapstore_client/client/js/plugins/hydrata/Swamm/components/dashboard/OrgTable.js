import React, { useState } from "react";
import { formatMoney, formatCurrency } from "../../../Utils/utils";

const OrgTable = ({ barChartData, speedDialData, bmpFilterMode = 'group_profile' }) => {
    const [sortKey, setSortKey] = useState('label');
    const [sortDir, setSortDir] = useState('asc');

    const data = barChartData?.[bmpFilterMode] || [];

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
        bmp_count: (acc.bmp_count || 0) + (row.bmp_count || 0),
        total_cost: (acc.total_cost || 0) + (row.total_cost || 0),
        total_n_load_reduction: (acc.total_n_load_reduction || 0) + (row.total_n_load_reduction || 0),
        total_p_load_reduction: (acc.total_p_load_reduction || 0) + (row.total_p_load_reduction || 0),
        total_s_load_reduction: (acc.total_s_load_reduction || 0) + (row.total_s_load_reduction || 0)
    }), {});

    const buildTsvString = () => {
        const header = 'Organization\tBMP Count\tTotal Cost\tN Reduction\tP Reduction\tS Reduction';
        const rows = sortedData.map(row =>
            `${row.label}\t${row.bmp_count || 0}\t${row.total_cost || 0}\t${row.total_n_load_reduction || 0}\t${row.total_p_load_reduction || 0}\t${row.total_s_load_reduction || 0}`
        );
        const totalRow = `Total\t${totals.bmp_count}\t${totals.total_cost}\t${totals.total_n_load_reduction}\t${totals.total_p_load_reduction}\t${totals.total_s_load_reduction}`;
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
        <div style={{ color: '#155481', backgroundColor: 'white', margin: '10px', borderRadius: '4px', padding: '10px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div className="swamm-bmp-chart-heading">Organization Contributions</div>
                <button className="swamm-button" onClick={handleCopy} style={{ fontSize: 'small' }}>
                    Copy
                </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Organization contributions">
                <thead>
                    <tr style={{ backgroundColor: '#063167', color: 'white' }}>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'left' }} onClick={() => handleSort('label')}>
                            Organization{sortIndicator('label')}
                        </th>
                        <th style={{ padding: '6px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('bmp_count')}>
                            BMP Count{sortIndicator('bmp_count')}
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
                            <td style={{ padding: '6px', textAlign: 'right' }}>{row.bmp_count || 0}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.total_cost)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_n_load_reduction, 0)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_p_load_reduction, 0)}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(row.total_s_load_reduction, 0)}</td>
                        </tr>
                    ))}
                    <tr style={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
                        <td style={{ padding: '6px', textAlign: 'left' }}>Total</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{totals.bmp_count || 0}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(totals.total_cost)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_n_load_reduction, 0)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_p_load_reduction, 0)}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatMoney(totals.total_s_load_reduction, 0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export { OrgTable };
