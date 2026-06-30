/**
 * TASK-2026 (W5.4) — ManualPasteGrid: page-aware value-column header.
 * When series_type='hydrograph', the header reads 'Flow (m3/s)' only.
 * When series_type is absent/'hyetograph', the original rainfall header is shown.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
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
