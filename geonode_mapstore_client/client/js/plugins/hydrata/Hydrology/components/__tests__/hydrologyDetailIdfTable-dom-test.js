/*
 * TASK-743 — hydrologyDetailIdfTable DOM contract tests (P2).
 *
 * The default export is the Redux-CONNECTED HydrologyDetailIdfTable. It reads
 * `state.hydrology.activeHydrologyItem` (an IdfTable instance) and renders an
 * editable `.idf-table` plus a recharts curve. These tests seed `state` through
 * the shared `mountWithProviders` helper (AC2). The connection IS the point
 * here (mapState pulls activeHydrologyItem; mapDispatch wires updateIdfRowData),
 * so we test the connected export. For the dispatch contract we pass a real
 * redux store (createTestStore) whose `dispatch` is wrapped to record actions.
 *
 * A real `IdfTable` instance is used as the fixture so columnDefs / rowData /
 * getChartData() / id are all genuine (the component calls getChartData() and
 * iterates rowData). The spec named no specific contracts, so these REAL,
 * observable contracts were derived from the source:
 *
 *   (a) renders the `.idf-table` with one header row of 10 ARI columns and one
 *       <tr> body row per rowData entry, each cell an editable <input>.
 *   (b) column headers render the i18n msgIds (no IntlProvider in tests, so
 *       <Message> falls back to the literal msgId text).
 *   (c) editing a cell input + blurring dispatches UPDATE_IDF_ROW_DATA carrying
 *       the table id, row index, column id and new value.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import createTestStore from '../../../../../__tests__/helpers/createTestStore';
import { UPDATE_IDF_ROW_DATA } from '../../actionsHydrology';
import { IdfTable } from '../../classesHydrology';
import HydrologyDetailIdfTable from '../hydrologyDetailIdfTable';

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

describe('TASK-743 hydrologyDetailIdfTable DOM', () => {

    it('renders the .idf-table with a header row of 10 columns and one body row per rowData entry', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const table = container.querySelector('table.idf-table');
        expect(table).toExist();

        const headerCells = table.querySelectorAll('thead th');
        expect(headerCells.length).toBe(item.columnDefs.length); // 10 ARI columns

        const bodyRows = table.querySelectorAll('tbody tr');
        expect(bodyRows.length).toBe(item.rowData.length);
    });

    it('renders an editable <input> in each body cell (10 inputs per row)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const firstRow = container.querySelector('table.idf-table tbody tr');
        expect(firstRow).toExist();
        const inputs = firstRow.querySelectorAll('input');
        expect(inputs.length).toBe(item.columnDefs.length);
        // The TableCell uses meta.type "number" for these columns.
        expect(inputs[0].getAttribute('type')).toBe('number');
    });

    it('renders the i18n column-header msgIds (no IntlProvider -> literal msgId text)', () => {
        const item = new IdfTable();
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, {
            state: { hydrology: { activeHydrologyItem: item } }
        });
        const headText = container.querySelector('table.idf-table thead').textContent;
        expect(headText).toInclude('hydrata.hydrology.durationMin');
        expect(headText).toInclude('hydrata.hydrology.ari100yr');
    });

    it('dispatches UPDATE_IDF_ROW_DATA with (tableId, rowIndex, columnId, value) on cell blur', () => {
        const item = new IdfTable();
        const { store, dispatched } = recordingStore({
            hydrology: { activeHydrologyItem: item }
        });
        const { container } = mountWithProviders(<HydrologyDetailIdfTable />, { store });

        // First cell of the first row is the "duration" column (column id 'duration').
        const firstInput = container.querySelector('table.idf-table tbody tr input');
        expect(firstInput).toExist();
        fireEvent.change(firstInput, { target: { value: '99' } });
        fireEvent.blur(firstInput);

        const action = dispatched.find(a => a && a.type === UPDATE_IDF_ROW_DATA);
        expect(action).toExist();
        // updateIdfRowData(idfTableId, rowIndex, columnId, value)
        expect(action.idfTableId).toBe(item.id);
        expect(action.rowIndex).toBe(0);
        expect(action.columnId).toBe('duration');
        expect(action.value).toBe('99');
    });
});
