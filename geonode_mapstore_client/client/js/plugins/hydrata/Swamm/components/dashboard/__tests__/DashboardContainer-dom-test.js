/*
 * TASK-743 — DashboardContainer (SwammBmpChart) DOM contract tests (P1).
 *
 * DashboardContainer.js exports a Redux-CONNECTED `SwammBmpChart` plus the
 * presentational `DashboardErrorFallback`. The connected component reads
 * everything from `state.swamm` (targets, selectedTargetId, dashboardView,
 * etc.), so these tests seed `state` through the shared `mountWithProviders`
 * helper (AC2). For the dispatch contract we pass a real redux store
 * (createTestStore, passthrough reducer) whose `dispatch` is wrapped to record
 * actions — the passthrough `mountWithProviders` store has a no-op dispatch and
 * cannot observe action types.
 *
 * REAL contracts asserted (spec's "jobName glyph" contract does NOT exist in
 * the source and is intentionally NOT tested):
 *   (a) empty / missing targets -> "No pollutant loading targets configured"
 *       message; no TargetSelector.
 *   (b) targets present, chart view -> TargetSelector renders + the 4
 *       PollutantCards (POLLUTANTS) render in the chart column.
 *   (c) dashboardView === 'table' -> OrgTable renders instead of PollutantCards.
 *   (d) clicking the footer Close button dispatches { type: HIDE_SWAMM_BMP_CHART }.
 *   (e) DashboardErrorFallback renders its error text.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../../__tests__/helpers/mountWithProviders';
import createTestStore from '../../../../../../__tests__/helpers/createTestStore';
import { SwammBmpChart, DashboardErrorFallback } from '../DashboardContainer';
import { HIDE_SWAMM_BMP_CHART } from '../../../actionsSwamm';

// A target rich enough for the chart/table children to render without throwing.
// PollutantCard reads selectedTarget.speedDialData.percent<Name>Target[0].value
// (non-optional after `selectedTarget?.`), so each pollutant needs a populated
// array or the card throws during render.
function makeTarget(id = 1, name = 'My Target') {
    return {
        id,
        name,
        speedDialData: {
            percentPhosphorusTarget: [{ value: 40 }, { value: 60 }],
            percentNitrogenTarget: [{ value: 33.3 }, { value: 66.7 }],
            percentSedimentTarget: [{ value: 28.6 }, { value: 71.4 }],
            percentTotalTarget: [{ value: 50 }, { value: 50 }]
        },
        barChartData: {
            total_bmp_count: 7,
            type: [],
            status: [],
            group_profile: [],
            swamm_engine: []
        }
    };
}

// Wrap a real store's dispatch to record dispatched actions.
function recordingStore(preloadedState) {
    const store = createTestStore({ preloadedState });
    const dispatched = [];
    const originalDispatch = store.dispatch;
    store.dispatch = (action) => {
        dispatched.push(action);
        return originalDispatch(action);
    };
    return { store, dispatched };
}

describe('TASK-743 DashboardContainer DOM', () => {

    it('renders the "no targets configured" message when state.swamm.targets is empty', () => {
        const { container } = mountWithProviders(<SwammBmpChart />, {
            state: { swamm: { targets: [] } }
        });
        expect(container.textContent).toInclude('No pollutant loading targets configured');
        // No TargetSelector group when there are no targets.
        expect(container.querySelector('[role="radiogroup"]')).toNotExist();
    });

    it('renders the "no targets configured" message when state.swamm has no targets key at all', () => {
        const { container } = mountWithProviders(<SwammBmpChart />, {
            state: { swamm: {} }
        });
        expect(container.textContent).toInclude('No pollutant loading targets configured');
    });

    it('renders TargetSelector + the 4 PollutantCards in chart view when targets are present', () => {
        const target = makeTarget(7, 'Bay Watershed');
        const { container } = mountWithProviders(<SwammBmpChart />, {
            state: { swamm: { targets: [target], selectedTargetId: 7, dashboardView: 'chart' } }
        });
        // TargetSelector renders its radiogroup of filter modes.
        expect(container.querySelector('[role="radiogroup"]')).toExist();
        // Chart column present.
        expect(container.querySelector('#swamm-bmp-chart-col-two')).toExist();
        // POLLUTANTS has 4 entries -> 4 PollutantCard containers, each id'd
        // `swamm-bmp-chart-<name>` (lowercased). Assert all four rendered.
        ['phosphorus', 'nitrogen', 'sediment', 'total'].forEach((p) => {
            expect(container.querySelector(`#swamm-bmp-chart-${p}`)).toExist();
        });
        // No "no targets" message on the happy path.
        expect(container.textContent).toNotInclude('No pollutant loading targets configured');
    });

    it('renders OrgTable (table view) instead of PollutantCards when dashboardView === "table"', () => {
        const target = makeTarget(3, 'Org View');
        const { container } = mountWithProviders(<SwammBmpChart />, {
            state: { swamm: { targets: [target], selectedTargetId: 3, dashboardView: 'table' } }
        });
        // Still has the chart column wrapper + TargetSelector.
        expect(container.querySelector('[role="radiogroup"]')).toExist();
        expect(container.querySelector('#swamm-bmp-chart-col-two')).toExist();
        // The toggle buttons exist; "Table" button reflects the active state.
        const buttons = Array.from(container.querySelectorAll('#swamm-bmp-chart-header button'));
        const labels = buttons.map(b => b.textContent.trim());
        expect(labels).toContain('Chart');
        expect(labels).toContain('Table');
    });

    it('dispatches HIDE_SWAMM_BMP_CHART when the footer Close button is clicked', () => {
        const { store, dispatched } = recordingStore({
            swamm: { targets: [makeTarget(1)], selectedTargetId: 1, dashboardView: 'chart' }
        });
        const { container } = mountWithProviders(<SwammBmpChart />, { store });
        const footer = container.querySelector('#swamm-bmp-chart-footer');
        expect(footer).toExist();
        const closeBtn = footer.querySelector('button');
        expect(closeBtn).toExist();
        expect(closeBtn.textContent.trim()).toBe('Close');
        fireEvent.click(closeBtn);
        expect(dispatched.some(a => a && a.type === HIDE_SWAMM_BMP_CHART)).toBe(true);
    });

    it('DashboardErrorFallback renders the error text', () => {
        const { container } = mountWithProviders(<DashboardErrorFallback />);
        expect(container.textContent).toInclude('Dashboard encountered an error');
        expect(container.textContent).toInclude('Please try closing and reopening the dashboard');
    });
});
