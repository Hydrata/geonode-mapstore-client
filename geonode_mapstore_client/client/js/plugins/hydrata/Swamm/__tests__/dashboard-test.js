import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';
import { FILTER_TOOLTIPS, DOWNLOAD_TOOLTIP } from '../components/dashboard/TargetSelector';
import { exportSummaryCSV, formatCurrency } from '../../Utils/utils';
import { downloadSummaryCSV, downloadTargetPdf, DOWNLOAD_SUMMARY_CSV, DOWNLOAD_TARGET_PDF, SET_DASHBOARD_VIEW, setDashboardView } from '../actionsSwamm';
import { formatTooltipLabel } from '../components/dashboard/PollutantCard';
import { OrgTable } from '../components/dashboard/OrgTable';

describe('SWAMM Dashboard', () => {

    // ── TASK-315: Error boundaries and loading states ──

    describe('DashboardErrorFallback', () => {
        it('test_dashboard_error_fallback_message', () => {
            const div = document.createElement('div');
            ReactDOM.render(<DashboardErrorFallback />, div);
            expect(div.textContent).toInclude('Dashboard encountered an error');
            expect(div.textContent).toInclude('Please try closing and reopening the dashboard');
            ReactDOM.unmountComponentAtNode(div);
        });
    });

    // ── TASK-316: ARIA labels and keyboard navigation ──

    describe('ARIA labels', () => {
        it('test_aria_labels_present', () => {
            const fs = require('fs');
            const path = require('path');
            const dashboardSrc = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/DashboardContainer.js'), 'utf8'
            );
            const targetSelectorSrc = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/TargetSelector.js'), 'utf8'
            );
            const pollutantCardSrc = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/PollutantCard.js'), 'utf8'
            );
            const summaryTableSrc = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/SummaryTable.js'), 'utf8'
            );
            const legendPanelSrc = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/LegendPanel.js'), 'utf8'
            );

            // DashboardContainer ARIA
            expect(dashboardSrc).toInclude('aria-label="SWAMM Dashboard"');
            expect(dashboardSrc).toInclude('role="region"');
            expect(dashboardSrc).toInclude('aria-label="Close dashboard"');

            // TargetSelector ARIA
            expect(targetSelectorSrc).toInclude('aria-label={"Select target: "');
            expect(targetSelectorSrc).toInclude('aria-pressed={isSelected}');
            expect(targetSelectorSrc).toInclude('role="radiogroup"');
            expect(targetSelectorSrc).toInclude('aria-label="Group data by"');
            expect(targetSelectorSrc).toInclude('role="radio"');
            expect(targetSelectorSrc).toInclude('aria-checked={');

            // PollutantCard ARIA
            expect(pollutantCardSrc).toInclude('load reduction chart');

            // SummaryTable ARIA
            expect(summaryTableSrc).toInclude('aria-label="Dashboard summary"');

            // LegendPanel ARIA
            expect(legendPanelSrc).toInclude('aria-label="Chart legend"');
        });
    });

    // ── TASK-317: Tooltips and help text ──

    describe('Tooltip text constants', () => {
        it('test_tooltip_text_constants', () => {
            expect(FILTER_TOOLTIPS.type).toBe('Group chart data by BMP practice type');
            expect(FILTER_TOOLTIPS.status).toBe('Group chart data by BMP implementation status');
            expect(FILTER_TOOLTIPS.group_profile).toBe('Group chart data by implementing organization');
            expect(DOWNLOAD_TOOLTIP).toBe('Download all BMP data as Excel spreadsheet');
        });
    });

    // ── TASK-318: CSV/PDF export ──

    describe('Export CSV', () => {
        const mockSpeedDialData = {
            currentPhosphorusLoad: 100,
            currentNitrogenLoad: 200,
            currentSedimentLoad: 300,
            percentPhosphorusReductionTarget: 0.25,
            percentNitrogenReductionTarget: 0.30,
            percentSedimentReductionTarget: 0.35,
            targetPhosphorusLoadReductionRequired: 25,
            targetNitrogenLoadReductionRequired: 60,
            targetSedimentLoadReductionRequired: 105,
            totalBmpPhosphorusReduction: 10,
            totalBmpNitrogenReduction: 20,
            totalBmpSedimentReduction: 30,
            percentPhosphorusTarget: [{ value: 40 }],
            percentNitrogenTarget: [{ value: 33.3 }],
            percentSedimentTarget: [{ value: 28.6 }]
        };

        it('test_export_summary_csv_format', () => {
            const csv = exportSummaryCSV(mockSpeedDialData);
            const lines = csv.split('\n');
            expect(lines.length).toBe(6);
            expect(lines[0]).toBe('Metric,Phosphorus,Nitrogen,Sediment,Units');
            expect(lines[1]).toInclude('100');
            expect(lines[1]).toInclude('200');
            expect(lines[1]).toInclude('300');
            expect(lines[2]).toInclude('25');
            expect(lines[2]).toInclude('30');
            expect(lines[2]).toInclude('35');
        });

        it('test_download_actions_exist', () => {
            expect(typeof downloadSummaryCSV).toBe('function');
            expect(typeof downloadTargetPdf).toBe('function');
            expect(typeof DOWNLOAD_SUMMARY_CSV).toBe('string');
            expect(typeof DOWNLOAD_TARGET_PDF).toBe('string');
        });
    });

    // ── TASK-324: Cost rows in SummaryTable ──

    describe('formatCurrency', () => {
        it('test_format_currency', () => {
            const result = formatCurrency(1234.56);
            expect(result).toInclude('$');
            expect(result).toInclude('1,235');
        });

        it('test_format_currency_zero_returns_dash', () => {
            expect(formatCurrency(0)).toBe('\u2014');
            expect(formatCurrency(null)).toBe('\u2014');
            expect(formatCurrency(undefined)).toBe('\u2014');
        });
    });

    // ── TASK-325: Cost tooltip in bar chart ──

    describe('Bar chart cost tooltip', () => {
        it('test_tooltip_format_with_cost', () => {
            const barEntry = { total_cost: 5000, total_p_load_reduction: 100 };
            const result = formatTooltipLabel('Rain Garden', 100, barEntry, 'total_p_load_reduction');
            expect(result).toInclude('Rain Garden');
            expect(result).toInclude('100');
            expect(result).toInclude('$');
            expect(result).toInclude('/lb');
        });

        it('test_tooltip_format_without_cost', () => {
            const barEntry = { total_cost: 0, total_p_load_reduction: 100 };
            const result = formatTooltipLabel('Rain Garden', 100, barEntry, 'total_p_load_reduction');
            expect(result).toBe('Rain Garden - 100');
            expect(result).toNotInclude('$');
        });

        it('test_tooltip_format_sediment_shows_ton', () => {
            const barEntry = { total_cost: 10000, total_s_load_reduction: 50 };
            const result = formatTooltipLabel('Wetland', 50, barEntry, 'total_s_load_reduction');
            expect(result).toInclude('/ton');
            expect(result).toInclude('tons/yr');
        });
    });

    // ── TASK-326: Sub-watershed filter button ──

    describe('Sub-watershed filter mode', () => {
        it('test_sub_watershed_filter_mode_constant', () => {
            // Verify 'swamm_engine' is in FILTER_TOOLTIPS (meaning it's a valid filter mode)
            expect(FILTER_TOOLTIPS.swamm_engine).toBe('Group chart data by sub-watershed');

            // Verify the TargetSelector source contains the sub-watershed button
            const fs = require('fs');
            const path = require('path');
            const src = fs.readFileSync(
                path.resolve(__dirname, '../components/dashboard/TargetSelector.js'), 'utf8'
            );
            expect(src).toInclude("setBmpFilterMode('swamm_engine')");
            expect(src).toInclude('Sub-Watershed');
        });
    });

    // ── TASK-327: Organization contribution table ──

    describe('Dashboard view toggle', () => {
        it('test_set_dashboard_view_action', () => {
            const action = setDashboardView('table');
            expect(action.type).toBe(SET_DASHBOARD_VIEW);
            expect(action.view).toBe('table');

            const chartAction = setDashboardView('chart');
            expect(chartAction.view).toBe('chart');
        });

        it('test_org_table_exports', () => {
            expect(OrgTable).toExist();
            expect(typeof OrgTable).toBe('function');
        });
    });

});
