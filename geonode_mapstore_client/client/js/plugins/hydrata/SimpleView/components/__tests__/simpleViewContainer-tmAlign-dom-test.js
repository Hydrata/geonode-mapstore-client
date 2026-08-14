/*
 * RHS toolbar / TaskMonitor alignment.
 *
 * The Tasks button lives in a SEPARATE plugin (TaskMonitor, also used in
 * dataset_viewer) so it cannot be a flex child of the SimpleView RHS toolbar.
 * Instead SimpleViewContainer publishes the toolbar's bottom edge as the CSS
 * custom property `--sv-tm-top`, and #task-monitor-container consumes it so the
 * Tasks icon sits exactly one toolbar-gap below the last button — equally
 * spaced — regardless of how many (conditional) buttons are showing.
 *
 * These tests cover the pure offset helper and the DOM contract that the var is
 * set on mount and cleared on unmount (so dataset_viewer falls back to default).
 */
import expect from 'expect';
import React from 'react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import {
    SimpleViewContainer,
    computeTaskMonitorTop,
    SV_TOOLBAR_GAP
} from '../simpleViewContainer';

const TM_VAR = '--sv-tm-top';

describe('SimpleView RHS toolbar / TaskMonitor alignment', () => {
    afterEach(() => {
        document.documentElement.style.removeProperty(TM_VAR);
        document.documentElement.style.removeProperty('--sv-widget-right');
    });

    describe('computeTaskMonitorTop (pure)', () => {
        it('continues the column one gap below the last button', () => {
            // toolbar top 11px, height 132px → bottom 143 + 4px gap = 147
            expect(computeTaskMonitorTop(11, 132, 4)).toBe(147);
        });
        it('defaults the gap to the toolbar gap', () => {
            expect(computeTaskMonitorTop(11, 40)).toBe(11 + 40 + SV_TOOLBAR_GAP);
        });
        it('tracks button count via the measured height', () => {
            // fewer buttons → smaller height → smaller top (no hardcoded 240px)
            const few = computeTaskMonitorTop(11, 40);
            const many = computeTaskMonitorTop(11, 260);
            expect(many).toBeGreaterThan(few);
        });
    });

    describe('CSS var contract', () => {
        const baseProps = {
            menuGroups: [],
            visibleIntroduction: false,
            visibleLegendPanel: false,
            // keep the conditional clusters off so the toolbar renders just the
            // always-present Legend button (a real, measurable button in Chrome)
            searchPluginPresent: false,
            measurePluginPresent: false,
            canEdit: false,
            loggedIn: false,
            setVisibleLegendPanel: () => {}
        };

        it('publishes --sv-tm-top below the toolbar on mount', () => {
            const { unmount } = mountWithProviders(
                <SimpleViewContainer {...baseProps} />, { state: {} }
            );
            const val = document.documentElement.style.getPropertyValue(TM_VAR);
            expect(val).toMatch(/px$/);
            // must sit below the toolbar's top (11px) — i.e. an actual offset,
            // not the old hardcoded 240px that ignored the button count.
            expect(parseFloat(val)).toBeGreaterThan(11);
            unmount();
        });

        it('measures the toolbar WITH the About button, so Tasks still sits one gap below the LAST button', () => {
            // TASK-2775 AC5 (epic 2765 W3). Adding a button to this column
            // MOVES the TaskMonitor: `--sv-tm-top` is derived from the LIVE
            // toolbar's measured bottom edge, not from a button count. Asserted
            // rather than eyeballed — the two ways this silently breaks are a
            // button rendered OUTSIDE the measured box, and a var computed from
            // a stale measurement.
            const { container, unmount } = mountWithProviders(
                <SimpleViewContainer {...baseProps} />, { state: {} }
            );
            const toolbar = container.querySelector('.simple-view-right-toolbar');
            const about = toolbar.querySelector('button[title="About this project"]');
            expect(about).toBeTruthy();
            // Last child, so the toolbar's bottom edge IS the About button's.
            expect(toolbar.lastElementChild).toBe(about);

            const toolbarRect = toolbar.getBoundingClientRect();
            const aboutRect = about.getBoundingClientRect();
            // Real Chrome under karma: a rendered button has real height, so a
            // zero-height box would mean nothing painted and every comparison
            // below would be vacuous.
            expect(toolbarRect.height).toBeGreaterThan(0);
            expect(aboutRect.height).toBeGreaterThan(0);
            expect(aboutRect.bottom <= toolbarRect.bottom + 1).toBe(true);

            const expected = computeTaskMonitorTop(toolbar.offsetTop, toolbar.offsetHeight);
            expect(parseFloat(document.documentElement.style.getPropertyValue(TM_VAR)))
                .toBe(expected);
            unmount();
        });

        it('clears --sv-tm-top on unmount so dataset_viewer falls back', () => {
            const { unmount } = mountWithProviders(
                <SimpleViewContainer {...baseProps} />, { state: {} }
            );
            unmount();
            expect(document.documentElement.style.getPropertyValue(TM_VAR)).toBe('');
        });
    });
});
