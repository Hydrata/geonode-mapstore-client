/**
 * TASK-2026 (W5.4) — ManualPasteGrid: page-aware value-column header.
 * When series_type='hydrograph', the header reads 'Flow (m3/s)' only.
 * When series_type is absent/'hyetograph', the original rainfall header is shown.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { fireEvent } from '@testing-library/react';
import { ManualPasteGrid } from '../ManualPasteGrid';

describe('ManualPasteGrid TASK-2026 (W5.4) page-aware value-column header', () => {
    const noop = () => {};
    const baseItem = {
        id: 'temp-1',
        name: 'Test',
        columnDefs: [],
        rowData: []
    };

    it('series_type=hydrograph: header includes "Flow" and excludes "Rainfall" and "mm/hr"', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: {...baseItem, series_type: 'hydrograph'},
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        // The table header should contain 'Flow (m3/s)' not 'Rainfall (mm/hr)'
        const headers = container.querySelectorAll('th');
        const valueHeader = Array.from(headers).find(h => h.textContent.includes('Flow'));
        expect(valueHeader).toExist();
        const headerHtml = container.querySelector('thead').innerHTML;
        expect(headerHtml.includes('Rainfall')).toBe(false);
        expect(headerHtml.includes('mm/hr')).toBe(false);
        expect(headerHtml.includes('Flow (m3/s)')).toBe(true);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('no series_type (Design Storms): header includes "Rainfall" and "mm/hr"', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: baseItem,
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const headerHtml = container.querySelector('thead').innerHTML;
        expect(headerHtml.includes('Rainfall')).toBe(true);
        expect(headerHtml.includes('mm/hr')).toBe(true);
        // TASK-2005 (epic-2001 W1d): Design-Storm value-column header is now
        // 'Rainfall (mm/hr)' only — no Flow string in the non-hydrograph branch.
        expect(headerHtml.includes('Flow')).toBe(false);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('series_type=hyetograph (Design Storms): header is Rainfall-only (no Flow)', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: {...baseItem, series_type: 'hyetograph'},
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const headerHtml = container.querySelector('thead').innerHTML;
        expect(headerHtml.includes('Rainfall')).toBe(true);
        expect(headerHtml.includes('mm/hr')).toBe(true);
        // TASK-2005 (epic-2001 W1d): hyetograph design-storm branch is rainfall-only.
        expect(headerHtml.includes('Flow')).toBe(false);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});

describe('TASK-2084 (epic-2077) — page-aware editor heading', () => {
    const noop = () => {};
    const baseItem = {
        id: 'temp-1',
        name: 'Test',
        columnDefs: [],
        rowData: []
    };

    // No IntlProvider in this bare-render test, so <Message> falls back to
    // rendering the raw msgId — the established assertion pattern for this
    // codebase (see DiscriminatorPickerIntegration-test.js AC1).
    it('series_type=hydrograph: h3 heading resolves to the hydrograph msgId', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: {...baseItem, series_type: 'hydrograph'},
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const heading = container.querySelector('h3');
        expect(heading).toExist();
        expect(heading.textContent).toBe('hydrata.hydrology.hydrograph');
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('no series_type (Design Storms): h3 heading resolves to the timeSeries (Design Storm) msgId', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: baseItem,
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const heading = container.querySelector('h3');
        expect(heading).toExist();
        expect(heading.textContent).toBe('hydrata.hydrology.timeSeries');
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('series_type=hyetograph (Design Storms): h3 heading resolves to the timeSeries (Design Storm) msgId, not hydrograph', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: {...baseItem, series_type: 'hyetograph'},
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const heading = container.querySelector('h3');
        expect(heading).toExist();
        expect(heading.textContent).toBe('hydrata.hydrology.timeSeries');
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});

// ---------------------------------------------------------------------------
// TASK-2081 (epic-2077 W1) — drop the local rowData mirror; table + chart now
// read activeHydrologyItem.rowData directly (ManualPasteGrid.js). A committed
// edit's new array (classesHydrology.js updateRowValues :549-557) must reach
// the chart/table with NO Save/reload. The reducer deliberately keeps the
// SAME activeHydrologyItem object reference across a data-only mutation
// (reducersHydrology.js UPDATE_TIME_SERIES_ROW_DATA/REPLACE_TIME_SERIES_ROW_
// DATA mutate the instance in place — stable ref so the editor isn't torn
// down mid-typing, epic-2077 D4); dispatchUpdateRowData below mirrors that
// exact shape (mutates a shared `item`, in place, same identity) so these
// tests exercise the real reactivity gap, not an idealised one.
// ---------------------------------------------------------------------------
describe('TASK-2081 (epic-2077) — live update after committed edit', () => {
    function makeHydrographItem(id) {
        return {
            id: id || 'hg-1',
            name: 'Test Hydrograph',
            series_type: 'hydrograph',
            columnDefs: [],
            rowData: [
                {timestamp: '2025-01-01T00:00:00', value: 0},
                {timestamp: '2025-01-01T00:06:00', value: 0}
            ]
        };
    }

    // Mirrors classesHydrology.js updateRowValues: replaces .rowData with a
    // NEW array (immutable per-row update); the passed-in item's OWN identity
    // is never swapped (mirrors the reducer's stable-ref UPDATE_TIME_SERIES_
    // ROW_DATA case).
    function mutateRowValue(item, rowIndex, columnId, value) {
        const newRowData = [...item.rowData];
        newRowData[rowIndex] = {...newRowData[rowIndex], [columnId]: value};
        item.rowData = newRowData;
    }

    it('AC1: committing a cell edit (blur) updates the table + Estimated Total Flow Volume with no Save/reload', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const item = makeHydrographItem();
        const dispatchUpdateRowData = (id, rowIndex, columnId, value) => mutateRowValue(item, rowIndex, columnId, value);

        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: item,
                    dispatchUpdateRowData,
                    dispatchReplaceRowData: () => {}
                }),
                container
            );
        });
        // Both rows start at value=0 -> volume = 0.
        expect(container.textContent.includes('0.0 m3')).toBe(true);

        const valueInputs = container.querySelectorAll('table.time-series-table tbody input[type="number"]');
        expect(valueInputs.length).toBe(2);
        // change + blur are two SEPARATE native events; each gets its own
        // act() so React flushes TableCell's onChange state update (a fresh
        // 'value' closure) before onBlur reads it. Batching both inside one
        // act() call defers the flush past onBlur, so onBlur's closure reads
        // the PRE-edit value ('0', not '100') — this was the actual failure
        // mode reproduced while root-causing TASK-2081 (a test bug, not an
        // implementation bug: ManualPasteGrid's renderTick correctly forces
        // a fresh re-render once onBlur commits the real typed value).
        act(() => {
            fireEvent.change(valueInputs[0], {target: {value: '100'}});
        });
        act(() => {
            fireEvent.blur(valueInputs[0]);
        });

        // 100 m3/s * 360s (6-min timestep) = 36000 m3 — same component
        // instance, no unmount/remount, no dispatchReplaceRowData/reload.
        expect(container.textContent.includes('36000.0 m3')).toBe(true);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('AC2: typing within a cell does not reset mid-edit (stable-ref guarantee intact)', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const item = makeHydrographItem();
        // Not called until blur — asserts no premature commit resets the cell.
        const dispatchUpdateRowData = () => { throw new Error('must not commit before blur'); };

        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: item,
                    dispatchUpdateRowData,
                    dispatchReplaceRowData: () => {}
                }),
                container
            );
        });
        const input = container.querySelectorAll('table.time-series-table tbody input[type="number"]')[0];
        act(() => { fireEvent.change(input, {target: {value: '5'}}); });
        expect(input.value).toBe('5');
        act(() => { fireEvent.change(input, {target: {value: '51'}}); });
        expect(input.value).toBe('51'); // NOT reverted to '0' mid-typing
        act(() => { fireEvent.change(input, {target: {value: '512'}}); });
        expect(input.value).toBe('512');
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('AC3: switching to a different item resets the grid + chart to the new item\'s data', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const itemA = makeHydrographItem('hg-a');
        itemA.rowData[0].value = 100;

        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: itemA,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: () => {}
                }),
                container
            );
        });
        expect(container.textContent.includes('36000.0 m3')).toBe(true);

        const itemB = makeHydrographItem('hg-b');
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: itemB,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: () => {}
                }),
                container
            );
        });
        expect(container.textContent.includes('36000.0 m3')).toBe(false);
        expect(container.textContent.includes('0.0 m3')).toBe(true);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});

// ---------------------------------------------------------------------------
// TASK-2120 — Paste Data format hint + visible parse-failure feedback.
// Previously the "Paste Data:" field silently no-oped on unparseable input
// (worse: an invalid timestamp actually THREW inside the native paste
// listener via moment's null .toISOString() on an invalid date — an
// uncaught exception, not merely a silent no-op).
// ---------------------------------------------------------------------------
describe('TASK-2120 — ManualPasteGrid paste format hint + parse-failure feedback', () => {
    const baseItem = {
        id: 'temp-2120',
        name: 'Test',
        columnDefs: [],
        rowData: []
    };

    // Fires a real 'paste' DOM event on the given node — handlePaste is a
    // native addEventListener (not a React synthetic prop), so it must be
    // dispatched, not Simulate'd.
    const firePaste = (node, text) => {
        const event = new Event('paste', { bubbles: true, cancelable: true });
        event.clipboardData = { getData: () => text };
        act(() => { node.dispatchEvent(event); });
    };

    it('renders a persistent (not hover-only) format hint below the paste field', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: baseItem,
                dispatchUpdateRowData: () => {},
                dispatchReplaceRowData: () => {}
            }),
            container
        );
        const hint = container.querySelector('.sv-hydrology-paste-format-hint');
        expect(hint).toExist();
        // No IntlProvider in this bare render → Message falls back to the
        // raw msgId, the established pattern elsewhere in this suite.
        expect(hint.textContent).toBe('hydrata.hydrology.pasteDataFormatHint');
        // The paste target itself also carries a real placeholder (resolveMsg
        // English-fallback idiom, since it's a plain attribute not a <Message>).
        const pasteInput = container.querySelector('input#name');
        expect(pasteInput.getAttribute('placeholder')).toBe('Click here, then paste (Ctrl/Cmd+V)…');
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('a well-formed paste (tab-separated timestamp+value) replaces rowData and shows NO error', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        let replaced = null;
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: baseItem,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: (id, rowData) => { replaced = {id, rowData}; }
                }),
                container
            );
        });
        const pasteInput = container.querySelector('input#name');
        firePaste(pasteInput, '2025-01-01 00:00\t1.5\n2025-01-01 00:06\t2.5');
        expect(replaced).toExist();
        expect(replaced.id).toBe('temp-2120');
        expect(replaced.rowData.length).toBe(2);
        expect(replaced.rowData[0].value).toBe(1.5);
        expect(replaced.rowData[1].value).toBe(2.5);
        expect(container.querySelector('.sv-error-strip')).toNotExist();
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // Regression guard (Phase 1.7 self-review catch): the parse-failure fix
    // must stay LENIENT, not strict — a real spreadsheet paste can plausibly
    // contain a single-digit hour or trailing seconds, both of which the
    // ORIGINAL (pre-2120) parsing silently accepted. Strict-mode moment
    // parsing (briefly used during implementation) would have REJECTED both
    // as "parse errors", narrowing acceptance versus prior behaviour.
    it('still accepts a single-digit hour and trailing seconds (no acceptance-breadth regression)', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        let replaced = null;
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: baseItem,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: (id, rowData) => { replaced = {id, rowData}; }
                }),
                container
            );
        });
        const pasteInput = container.querySelector('input#name');
        firePaste(pasteInput, '2025-01-01 0:00\t1.5\n2025-01-01 00:06:00\t2.5');
        expect(replaced).toExist();
        expect(replaced.rowData.length).toBe(2);
        expect(container.querySelector('.sv-error-strip')).toNotExist();
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('pasting garbage (unparseable timestamp) shows a visible error and does NOT dispatch/crash', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        let replaced = null;
        let thrown = null;
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: baseItem,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: (id, rowData) => { replaced = {id, rowData}; }
                }),
                container
            );
        });
        const pasteInput = container.querySelector('input#name');
        try {
            firePaste(pasteInput, 'not a date\tnot a number\nsome other prose');
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBe(null); // no uncaught exception (the old .toISOString()-on-null crash)
        expect(replaced).toBe(null); // no broken data reached the reducer
        const errorStrip = container.querySelector('.sv-error-strip');
        expect(errorStrip).toExist();
        // tr()'s getMessageById-with-fallback idiom (no IntlProvider here)
        // returns the English fallback text, not the raw msgId — mirrors the
        // sourcePlaceholder/descriptionPlaceholder assertions in TASK-2119.
        expect(errorStrip.textContent).toBe(
            'Could not read the pasted data — expected two tab-separated columns (Timestamp, Value), one row per line. No changes were made.'
        );
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('pasting a numeric value with a garbled timestamp is still rejected (partial-garbage guard)', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        let replaced = null;
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: baseItem,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: (id, rowData) => { replaced = {id, rowData}; }
                }),
                container
            );
        });
        const pasteInput = container.querySelector('input#name');
        // First row well-formed, second row's timestamp is garbage — the
        // WHOLE paste must be rejected (never a partially-applied replace).
        firePaste(pasteInput, '2025-01-01 00:00\t1.5\nnot-a-date\t2.5');
        expect(replaced).toBe(null);
        expect(container.querySelector('.sv-error-strip')).toExist();
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('a successful paste after a prior parse failure clears the error strip', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        act(() => {
            ReactDOM.render(
                React.createElement(ManualPasteGrid, {
                    activeHydrologyItem: baseItem,
                    dispatchUpdateRowData: () => {},
                    dispatchReplaceRowData: () => {}
                }),
                container
            );
        });
        const pasteInput = container.querySelector('input#name');
        firePaste(pasteInput, 'garbage');
        expect(container.querySelector('.sv-error-strip')).toExist();
        firePaste(pasteInput, '2025-01-01 00:00\t1.5');
        expect(container.querySelector('.sv-error-strip')).toNotExist();
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});
