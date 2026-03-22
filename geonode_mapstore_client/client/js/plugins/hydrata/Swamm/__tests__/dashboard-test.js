import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';

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

});
