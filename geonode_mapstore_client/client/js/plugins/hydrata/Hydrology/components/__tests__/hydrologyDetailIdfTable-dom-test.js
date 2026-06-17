/*
 * TASK-743 / TASK-1497 (UAT note-1) — hydrologyDetailIdfTable DOM contract tests.
 *
 * The default export is the Redux-CONNECTED HydrologyDetailIdfTable. It reads
 * `state.hydrology.activeHydrologyItem` (an IdfTable instance) and renders the
 * manual Input IDF table as a derive-matrix-style grid (.sv-idf-matrix-table):
 * durations as ROW headers, the 9 canonical ARI return periods as COLUMN
 * headers. Each cell is either:
 *   • DISABLED  (value 0 / empty) → .sv-idf-matrix-cell--empty, click to enable
 *   • ENABLED   (non-zero value)  → holds a .sv-idf-matrix-input float entry
 * TASK-1525 (UAT round-2): strict two-axis AND-gating. A cell is editable IFF
 * BOTH its duration ROW header and its ARI COLUMN header are selected. A
 * single-axis click selects/highlights that header but reveals NO inputs on
 * its own; the direct single-cell-click affordance is dropped. Editing + blur
 * dispatches UPDATE_IDF_ROW_DATA. Entry is clamped to 2 decimals (no spinner).
 *
 * recordingStore uses createTestStore WITHOUT reducers → a passthrough store,
 * so dispatched actions are recorded but never hit the real reducer (which would
 * need state.idfTables). The action shape is the contract under test.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import createTestStore from '../../../../../__tests__/helpers/createTestStore';
import { UPDATE_IDF_ROW_DATA } from '../../actionsHydrology';
import { IdfTable } from '../../classesHydrology';
import HydrologyDetailIdfTable, { DURATION_TICKS, DURATION_X_DOMAIN } from '../hydrologyDetailIdfTable';

// Wrap a real (passthrough) store's dispatch to record dispatched actions.
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

describe('TASK-743/1497 hydrologyDetailIdfTable DOM (matrix grid)', () => {

    it('renders the .sv-idf-matrix-table: corner + 9 ARI column headers, one body row per rowData entry', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const table = container.querySelector('table.sv-idf-matrix-table');
        expect(table).toExist();

        // 1 empty corner + 9 ARI column headers
        const headerCells = table.querySelectorAll('thead th');
        expect(headerCells.length).toBe(10);
        expect(table.querySelectorAll('thead th.sv-idf-matrix-col-header').length).toBe(9);

        // one <tr> per rowData entry; each with a row-header + 9 cells
        const bodyRows = table.querySelectorAll('tbody tr');
        expect(bodyRows.length).toBe(item.rowData.length);
        const firstRow = bodyRows[0];
        expect(firstRow.querySelectorAll('td.sv-idf-matrix-row-header').length).toBe(1);
        expect(firstRow.querySelectorAll('td.sv-idf-matrix-cell').length).toBe(9);
    });

    it('column headers show the ARI labels (0.5yr ... 500yr)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const headText = container.querySelector('table.sv-idf-matrix-table thead').textContent;
        expect(headText).toInclude('0.5yr');
        expect(headText).toInclude('100yr');
        expect(headText).toInclude('500yr');
    });

    it('a default all-zero table renders every ARI cell DISABLED (no float inputs)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
        expect(container.querySelectorAll('.sv-idf-matrix-cell--empty').length)
            .toBe(item.rowData.length * 9);
    });

    it('a seeded non-zero cell renders ENABLED as a float text input (no spinner)', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 12.5;
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const inputs = container.querySelectorAll('.sv-idf-matrix-input');
        expect(inputs.length).toBe(1);
        expect(inputs[0].getAttribute('type')).toBe('text'); // text, not number → no spinner
        expect(inputs[0].value).toBe('12.5');
    });

    // TASK-1525 — strict two-axis AND-gating. Clicking a disabled cell does
    // nothing (the single-cell-click affordance was dropped).
    it('clicking a disabled cell does NOT enable it (single-cell affordance dropped)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
        const firstEmpty = container.querySelector('.sv-idf-matrix-cell--empty');
        fireEvent.click(firstEmpty);
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
    });

    // TASK-1525 acceptance: col-header only selected → no cell in that column editable.
    it('clicking a column header ALONE reveals no inputs (column axis only)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const firstColHeader = container.querySelector('thead th.sv-idf-matrix-col-header');
        fireEvent.click(firstColHeader);
        // header is marked selected, but no row is selected → 0 inputs
        expect(firstColHeader.className).toInclude('sv-idf-matrix-header--selected');
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
    });

    // TASK-1525 acceptance: row-header only selected → no cell in that row editable.
    it('clicking a row header ALONE reveals no inputs (row axis only)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const firstRowHeader = container.querySelector('tbody td.sv-idf-matrix-row-header');
        fireEvent.click(firstRowHeader);
        expect(firstRowHeader.className).toInclude('sv-idf-matrix-header--selected');
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
    });

    // TASK-1525 acceptance: row + col both selected → exactly the intersection
    // cell shows a float input; deselecting either header removes it again.
    it('row + column both selected → exactly 1 input at the intersection; deselect → gone', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const firstRowHeader = container.querySelector('tbody td.sv-idf-matrix-row-header');
        const firstColHeader = container.querySelector('thead th.sv-idf-matrix-col-header');

        // select the row alone → still 0 inputs
        fireEvent.click(firstRowHeader);
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);

        // now also select the column → exactly 1 input at the intersection
        fireEvent.click(firstColHeader);
        const inputs = container.querySelectorAll('.sv-idf-matrix-input');
        expect(inputs.length).toBe(1);
        // and it sits in the first body row, first ARI column
        const firstBodyRow = container.querySelector('tbody tr');
        expect(firstBodyRow.querySelectorAll('.sv-idf-matrix-input').length).toBe(1);

        // deselect the column → input gone
        fireEvent.click(firstColHeader);
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);

        // re-select column, then deselect the row → input gone again
        fireEvent.click(firstColHeader);
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(1);
        fireEvent.click(firstRowHeader);
        expect(container.querySelectorAll('.sv-idf-matrix-input').length).toBe(0);
    });

    it('dispatches UPDATE_IDF_ROW_DATA(tableId, rowIndex, columnId, value) on cell blur', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 10; // pre-enable a known cell
        const { store, dispatched } = recordingStore({
            hydrology: { activeHydrologyItem: item }
        });
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, { store });

        const input = container.querySelector('.sv-idf-matrix-input');
        expect(input).toExist();
        fireEvent.change(input, { target: { value: '15.5' } });
        fireEvent.blur(input);

        const action = dispatched.find(a => a && a.type === UPDATE_IDF_ROW_DATA);
        expect(action).toExist();
        expect(action.idfTableId).toBe(item.id);
        expect(action.rowIndex).toBe(0);
        expect(action.columnId).toBe('1yrARI');
        expect(action.value).toBe(15.5); // committed as a Number, not a string
    });

    it('clamps entry to 2 decimal places', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 10;
        const { store, dispatched } = recordingStore({
            hydrology: { activeHydrologyItem: item }
        });
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, { store });

        const input = container.querySelector('.sv-idf-matrix-input');
        fireEvent.change(input, { target: { value: '12.345' } });
        expect(input.value).toBe('12.34'); // 3rd+ decimal stripped on change
        fireEvent.blur(input);
        const action = dispatched.find(a => a && a.type === UPDATE_IDF_ROW_DATA);
        expect(action.value).toBe(12.34); // committed as a Number
    });

    it('the "Display in hours" toggle defaults to ticked', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const checkbox = container.querySelector('#idf-input-show-hours');
        expect(checkbox).toExist();
        expect(checkbox.checked).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// TASK-1526 — the IDF curve is promoted to an on-demand portal modal. The
// inline chart is GONE; a 'View IDF curve' trigger button is rendered beside
// the table and is enabled IFF the table holds ≥1 non-zero intensity
// (hasValidData = Object.values(getChartData()).some(l => l.length)). Clicking
// it opens an overlay-div modal (createPortal → document.body) with a titled
// header, an × close, the recharts curve, and backdrop-click-to-close.
// ---------------------------------------------------------------------------
describe('TASK-1526 hydrologyDetailIdfTable IDF-curve modal', () => {

    it('an all-zero table renders NO inline chart and a DISABLED trigger button', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        // No inline chart anywhere (the recharts wrapper is gone with all-zero data).
        expect(container.querySelector('.recharts-responsive-container')).toNotExist();
        // Trigger button present but disabled, with an explanatory title.
        const btn = container.querySelector('.sv-idf-curve-open-btn');
        expect(btn).toExist();
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('title')).toExist();
        expect(btn.getAttribute('title').length).toBeGreaterThan(0);
    });

    it('a table with ≥1 non-zero intensity ENABLES the trigger button', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 12.5;
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const btn = container.querySelector('.sv-idf-curve-open-btn');
        expect(btn).toExist();
        expect(btn.disabled).toBe(false);
    });

    it('clicking the enabled trigger mounts the modal (portal to document.body) with the curve', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 12.5;
        const { container, unmount } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        try {
            // No modal before the click.
            expect(document.body.querySelector('.sv-idf-curve-modal-overlay')).toNotExist();
            const btn = container.querySelector('.sv-idf-curve-open-btn');
            fireEvent.click(btn);
            // Modal mounted in document.body (portal), with a header + chart.
            const overlay = document.body.querySelector('.sv-idf-curve-modal-overlay');
            expect(overlay).toExist();
            expect(overlay.querySelector('.sv-legend-close')).toExist();
            expect(overlay.querySelector('.recharts-responsive-container')).toExist();
        } finally {
            unmount();
        }
    });

    it('clicking the × close button unmounts the modal', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 12.5;
        const { container, unmount } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        try {
            fireEvent.click(container.querySelector('.sv-idf-curve-open-btn'));
            const close = document.body.querySelector('.sv-idf-curve-modal-overlay .sv-legend-close');
            expect(close).toExist();
            fireEvent.click(close);
            expect(document.body.querySelector('.sv-idf-curve-modal-overlay')).toNotExist();
        } finally {
            unmount();
        }
    });

    it('clicking the backdrop unmounts the modal (but clicking the panel does NOT)', () => {
        const item = new IdfTable();
        item.rowData[0]['1yrARI'] = 12.5;
        const { container, unmount } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        try {
            fireEvent.click(container.querySelector('.sv-idf-curve-open-btn'));
            const overlay = document.body.querySelector('.sv-idf-curve-modal-overlay');
            expect(overlay).toExist();
            // Clicking the inner panel must NOT close (stopPropagation).
            const panel = overlay.querySelector('.simple-view-panel');
            expect(panel).toExist();
            fireEvent.click(panel);
            expect(document.body.querySelector('.sv-idf-curve-modal-overlay')).toExist();
            // Clicking the backdrop (overlay itself) closes it.
            fireEvent.click(overlay);
            expect(document.body.querySelector('.sv-idf-curve-modal-overlay')).toNotExist();
        } finally {
            unmount();
        }
    });
});

// ---------------------------------------------------------------------------
// TASK-1524 (UAT round-2) — the manual Input IDF table must not clip its lower
// duration rows. The old layout wrapped the table in an outer div with a fixed
// inline `height:'600px'` and `.sv-idf-matrix-wrapper` had only overflow-x:auto
// (no vertical scroll), so when rowData held more durations than fit in 600px
// the bottom rows were clipped off with no scrollbar. The fix gives the Input
// matrix wrapper its own scroll region (a dedicated `.sv-idf-matrix-wrapper--input`
// modifier with max-height + overflow-y:auto) and drops the fixed inner height,
// so EVERY duration row is in the DOM and reachable via the wrapper's own
// vertical scrollbar.
//
// NOTE: karma/jsdom does NOT apply the .css file, so we assert the contract at
// the DOM-structure level (every duration row-header present; the wrapper
// carries the scroll-modifier class; the outer box no longer hard-codes a fixed
// pixel height that would clip). The actual scroll geometry is verified visually
// on :9921 by the TOP.
// ---------------------------------------------------------------------------
describe('TASK-1524 hydrologyDetailIdfTable no-clip (all durations reachable)', () => {

    it('renders a row-header for EVERY duration in rowData (none clipped from the DOM)', () => {
        const item = new IdfTable();
        // Default IdfTable seeds many durations (well past what 600px would show).
        expect(item.rowData.length).toBeGreaterThan(5);
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const rowHeaders = container.querySelectorAll('tbody td.sv-idf-matrix-row-header');
        // One row-header per duration — including the LAST (longest) duration row.
        expect(rowHeaders.length).toBe(item.rowData.length);
        const lastDuration = item.rowData[item.rowData.length - 1].duration;
        // The longest duration's label must be present (its row is not clipped off).
        expect(rowHeaders[rowHeaders.length - 1].textContent).toInclude(String(lastDuration / 60));
    });

    it('the Input matrix wrapper carries the scroll-modifier class (overflow-y region)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const wrapper = container.querySelector('.sv-idf-matrix-wrapper');
        expect(wrapper).toExist();
        // The Input variant gets a dedicated modifier so its scroll region is
        // separate from the shared (Derive) .sv-idf-matrix-wrapper, avoiding a
        // double-scrollbar inside the Derive grid's own .sv-idf-derive-body.
        expect(wrapper.className).toInclude('sv-idf-matrix-wrapper--input');
    });

    it('the table-side outer box no longer hard-codes a fixed clipping height', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        // The outer box wrapping the table (the one holding the .sv-idf-matrix-wrapper)
        // must not impose a fixed `height` that clips overflow; the wrapper itself
        // owns the (max-height + overflow-y) scroll region.
        const wrapper = container.querySelector('.sv-idf-matrix-wrapper');
        const outerBox = wrapper.parentElement;
        expect(outerBox.style.height).toNotEqual('600px');
    });
});

// ---------------------------------------------------------------------------
// TASK-1754 — the IDF-curve duration X-axis is LOGARITHMIC over a FIXED domain.
// The earlier `domain={[5, 'auto']}` let recharts float the upper bound off the
// plotted data, so the right-hand DURATION_TICKS (720/1440/2880/4320 min)
// bunched and overlapped whenever the data max sat below 4320. The fix pins the
// domain to [firstTick, lastTick] (= [5, 4320]) with allowDataOverflow, which
// keeps every tick evenly spaced. recharts renders 0-tall in jsdom (no
// measurable SVG to assert tick geometry on), so the contract is locked at the
// exported-config level: the domain spans the full tick range, and the ticks
// are strictly increasing (a precondition for an even log-axis layout).
// ---------------------------------------------------------------------------
describe('TASK-1754 IDF-curve log duration axis', () => {
    it('pins the X-axis domain to the first..last duration tick (5..4320), not a floating auto', () => {
        expect(DURATION_X_DOMAIN).toEqual([5, 4320]);
        // The domain bounds are exactly the tick extremes — no clipping, no float.
        expect(DURATION_X_DOMAIN[0]).toBe(DURATION_TICKS[0]);
        expect(DURATION_X_DOMAIN[1]).toBe(DURATION_TICKS[DURATION_TICKS.length - 1]);
    });

    it('DURATION_TICKS are strictly increasing and positive (valid for a log scale)', () => {
        // A log axis is undefined at <=0; strictly-increasing ticks are the
        // precondition for the evenly-spaced layout the fix delivers.
        DURATION_TICKS.forEach(t => expect(t).toBeGreaterThan(0));
        for (let i = 1; i < DURATION_TICKS.length; i++) {
            expect(DURATION_TICKS[i]).toBeGreaterThan(DURATION_TICKS[i - 1]);
        }
    });

    it('every duration tick lies within the pinned domain (none dropped at the edges)', () => {
        const [lo, hi] = DURATION_X_DOMAIN;
        DURATION_TICKS.forEach(t => {
            expect(t).toBeGreaterThanOrEqualTo(lo);
            expect(t).toBeLessThanOrEqualTo(hi);
        });
    });
});
