/**
 * TASK-2029 (W5.7) — Hydrographs panel capstone unit consistency check.
 *
 * Renders the full Hydrographs detail (chart + grid header) for a
 * series_type='hydrograph' item and asserts NO 'mm/hr' substring survives
 * anywhere; at least one 'm3/s' is present. Also asserts the Design Storms
 * panel STILL shows mm/hr (no regression).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { HyetographChart } from '../hydrologyDetailTimeSeries';
import { ManualPasteGrid } from '../ManualPasteGrid';

const HYDRO_ROW_DATA = [
    {timestamp: '2025-01-01T00:00:00', value: 50},
    {timestamp: '2025-01-01T00:06:00', value: 120},
    {timestamp: '2025-01-01T00:12:00', value: 80}
];

const HYDRO_ITEM = {
    id: 'temp-1',
    name: 'Test Hydrograph',
    series_type: 'hydrograph',
    columnDefs: [],
    rowData: HYDRO_ROW_DATA
};

describe('TASK-2029 (W5.7) Hydrographs panel capstone: no mm/hr, all m3/s', () => {
    it('HyetographChart with activeHydrologyPage=hydrographs: no mm/hr, at least one m3/s', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(HyetographChart, {
                rowData: HYDRO_ROW_DATA,
                timestepMin: 6,
                title: 'Test Hydrograph',
                activeHydrologyPage: 'hydrographs'
            }),
            container
        );
        const html = container.innerHTML;
        // No mm/hr anywhere in the chart
        expect(html.includes('mm/hr')).toBe(false);
        // At least one m3/s present (Y-axis + tooltip + stat)
        expect(html.includes('m3/s')).toBe(true);
        // Volume stat present (not depth)
        expect(html.includes('Flow Volume')).toBe(true);
        expect(html.includes('total depth')).toBe(false);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('ManualPasteGrid with series_type=hydrograph: table header has no mm/hr', () => {
        const noop = () => {};
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: HYDRO_ITEM,
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const thead = container.querySelector('thead');
        expect(thead).toExist();
        expect(thead.innerHTML.includes('mm/hr')).toBe(false);
        expect(thead.innerHTML.includes('Rainfall')).toBe(false);
        expect(thead.innerHTML.includes('Flow (m3/s)')).toBe(true);
        // Chart inside ManualPasteGrid also has no mm/hr
        const fullHtml = container.innerHTML;
        expect(fullHtml.includes('mm/hr')).toBe(false);
        expect(fullHtml.includes('m3/s')).toBe(true);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // Design Storms regression: mm/hr must survive on the non-hydrograph path.
    it('HyetographChart without activeHydrologyPage (Design Storms): mm/hr present, no Flow Volume', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(HyetographChart, {
                rowData: HYDRO_ROW_DATA,
                timestepMin: 6,
                title: 'Design Storm 01'
            }),
            container
        );
        const html = container.innerHTML;
        expect(html.includes('mm/hr')).toBe(true);
        expect(html.includes('Intensity')).toBe(true);
        expect(html.includes('total depth')).toBe(true);
        expect(html.includes('Flow Volume')).toBe(false);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('ManualPasteGrid with no series_type (Design Storms): header includes mm/hr', () => {
        const noop = () => {};
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(ManualPasteGrid, {
                activeHydrologyItem: {...HYDRO_ITEM, series_type: undefined},
                dispatchUpdateRowData: noop,
                dispatchReplaceRowData: noop
            }),
            container
        );
        const thead = container.querySelector('thead');
        expect(thead.innerHTML.includes('mm/hr')).toBe(true);
        expect(thead.innerHTML.includes('Rainfall')).toBe(true);
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });
});
