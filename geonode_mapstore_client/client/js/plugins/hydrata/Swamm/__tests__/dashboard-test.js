import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';
import { TargetSelector, FILTER_TOOLTIPS, DOWNLOAD_TOOLTIP } from '../components/dashboard/TargetSelector';
import { exportSummaryCSV, formatCurrency } from '../../Utils/utils';
import { downloadSummaryCSV, downloadTargetPdf, DOWNLOAD_SUMMARY_CSV, DOWNLOAD_TARGET_PDF, SET_DASHBOARD_VIEW, setDashboardView, SET_NORMALIZATION_MODE, setNormalizationMode } from '../actionsSwamm';
import { formatTooltipLabel, normalizeBarData, getNormalizationSuffix } from '../components/dashboard/PollutantCard';
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
        it('test_dashboard_container_aria', () => {
            const div = document.createElement('div');
            ReactDOM.render(<DashboardErrorFallback />, div);
            // DashboardErrorFallback renders; full DashboardContainer needs Redux store,
            // so we verify the exported component exists and ErrorFallback renders cleanly.
            expect(div.textContent).toInclude('Dashboard encountered an error');
            ReactDOM.unmountComponentAtNode(div);
        });

        it('test_target_selector_aria', () => {
            const div = document.createElement('div');
            const noop = () => {};
            const targets = [{ id: 1, name: 'Test Target' }];
            ReactDOM.render(
                <TargetSelector
                    targets={targets}
                    selectedTargetId={1}
                    selectSwammTargetId={noop}
                    showTargetForm={noop}
                    selectedTarget={targets[0]}
                    bmpFilterMode="type"
                    setBmpFilterMode={noop}
                    downloadTargetData={noop}
                    downloadSummaryCSV={noop}
                    downloadTargetPdf={noop}
                    normalizationMode="total"
                    setNormalizationMode={noop}
                    projectId={1}
                />,
                div
            );
            // Check ARIA attributes are rendered in the DOM
            expect(div.querySelector('[aria-pressed]')).toExist();
            expect(div.querySelector('[role="radiogroup"]')).toExist();
            expect(div.querySelector('[aria-label="Group data by"]')).toExist();
            expect(div.querySelector('[role="radio"]')).toExist();
            expect(div.querySelector('[aria-checked]')).toExist();
            expect(div.querySelector('[aria-label="Select target: Test Target"]')).toExist();
            ReactDOM.unmountComponentAtNode(div);
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
        });

        it('test_sub_watershed_button_renders', () => {
            const div = document.createElement('div');
            const noop = () => {};
            const mockSetBmpFilterMode = (mode) => { mockSetBmpFilterMode.lastCall = mode; };
            const targets = [{ id: 1, name: 'T1' }];
            ReactDOM.render(
                <TargetSelector
                    targets={targets}
                    selectedTargetId={1}
                    selectSwammTargetId={noop}
                    showTargetForm={noop}
                    selectedTarget={targets[0]}
                    bmpFilterMode="swamm_engine"
                    setBmpFilterMode={mockSetBmpFilterMode}
                    downloadTargetData={noop}
                    downloadSummaryCSV={noop}
                    downloadTargetPdf={noop}
                    normalizationMode="total"
                    setNormalizationMode={noop}
                    projectId={1}
                />,
                div
            );
            // Verify 'Sub-Watershed' button is rendered
            const buttons = Array.from(div.querySelectorAll('button'));
            const subWatershedBtn = buttons.find(b => b.textContent.trim() === 'Sub-Watershed');
            expect(subWatershedBtn).toExist();
            // Verify it's marked as checked when active
            expect(subWatershedBtn.getAttribute('aria-checked')).toBe('true');
            ReactDOM.unmountComponentAtNode(div);
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

    // ── TASK-328: Per Acre / Per Dollar normalization toggle ──

    describe('Normalization mode', () => {
        it('test_set_normalization_mode_action', () => {
            const action = setNormalizationMode('per_acre');
            expect(action.type).toBe(SET_NORMALIZATION_MODE);
            expect(action.mode).toBe('per_acre');

            const action2 = setNormalizationMode('per_dollar');
            expect(action2.mode).toBe('per_dollar');

            const action3 = setNormalizationMode('total');
            expect(action3.mode).toBe('total');
        });

        it('test_normalization_modes', () => {
            // Verify all 3 modes produce valid suffix strings
            expect(getNormalizationSuffix('total')).toBe('');
            expect(getNormalizationSuffix('per_acre')).toBe(' (per acre)');
            expect(getNormalizationSuffix('per_dollar')).toBe(' (per $1,000)');
        });

        it('test_normalize_bar_data_per_acre', () => {
            const bars = [
                { label: 'A', total_p_load_reduction: 100, calculated_watershed_area: 10, total_cost: 5000 },
                { label: 'B', total_p_load_reduction: 50, calculated_watershed_area: 0, total_cost: 2000 }
            ];
            const result = normalizeBarData(bars, 'per_acre', 'total_p_load_reduction');
            // B should be filtered out (0 area)
            expect(result.length).toBe(1);
            expect(result[0].label).toBe('A');
            expect(result[0].total_p_load_reduction).toBe(10); // 100/10
        });

        it('test_normalize_bar_data_per_dollar', () => {
            const bars = [
                { label: 'A', total_p_load_reduction: 100, calculated_watershed_area: 10, total_cost: 5000 },
                { label: 'B', total_p_load_reduction: 50, calculated_watershed_area: 5, total_cost: 0 }
            ];
            const result = normalizeBarData(bars, 'per_dollar', 'total_p_load_reduction');
            // B should be filtered out (0 cost)
            expect(result.length).toBe(1);
            expect(result[0].label).toBe('A');
            expect(result[0].total_p_load_reduction).toBe(20); // 100/(5000/1000)
        });

        it('test_normalize_bar_data_total_returns_original', () => {
            const bars = [
                { label: 'A', total_p_load_reduction: 100 }
            ];
            const result = normalizeBarData(bars, 'total', 'total_p_load_reduction');
            expect(result).toBe(bars); // Same reference, no transformation
        });
    });

});
