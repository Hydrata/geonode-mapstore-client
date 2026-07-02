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
        act(() => {
            fireEvent.change(valueInputs[0], {target: {value: '100'}});
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
