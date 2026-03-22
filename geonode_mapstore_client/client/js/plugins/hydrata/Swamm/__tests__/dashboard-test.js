import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';
import { FILTER_TOOLTIPS, DOWNLOAD_TOOLTIP } from '../components/dashboard/TargetSelector';
import { exportSummaryCSV } from '../../Utils/utils';
import { downloadSummaryCSV, downloadTargetPdf, DOWNLOAD_SUMMARY_CSV, DOWNLOAD_TARGET_PDF } from '../actionsSwamm';

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

});
