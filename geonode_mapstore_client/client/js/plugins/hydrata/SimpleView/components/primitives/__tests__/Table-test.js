import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Table} from '../Table';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the Table chassis primitive.
 *
 * Table is the dark-glass data table. Supports surface="light" for
 * IDF/temporal tables that sit adjacent to recharts. Presentation-only.
 *
 * Spec:
 *   - Renders a table.sv-table
 *   - Default surface="dark" adds sv-table--dark
 *   - surface="light" adds sv-table--light + uses --sv-chart-surface
 *   - Structured form: columns + data renders thead+tbody
 *   - Empty data renders a "No data" row
 *   - extraClassName is carried
 *   - children (raw JSX) bypass the structured form
 *   - Returns null when columns is empty and no children
 */

const DEMO_COLS = [
    { key: 'duration', label: 'Duration' },
    { key: 'intensity', label: 'Intensity (mm/h)' }
];

const DEMO_DATA = [
    { duration: '30 min', intensity: '18.5' },
    { duration: '60 min', intensity: '12.1' }
];

describe('SimpleView Table chassis primitive (TASK-1759)', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    describe('Base structure', () => {
        it('renders a table.sv-table', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const el = container.querySelector('table.sv-table');
                expect(el).toExist();
                done();
            });
        });

        it('renders a thead with column headers', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const headers = container.querySelectorAll('thead th');
                expect(headers.length).toBe(2);
                expect(headers[0].textContent).toInclude('Duration');
                expect(headers[1].textContent).toInclude('Intensity');
                done();
            });
        });

        it('renders a tbody row per data item', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const rows = container.querySelectorAll('tbody tr');
                expect(rows.length).toBe(2);
                done();
            });
        });

        it('renders cell text from data objects', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const cells = container.querySelectorAll('tbody td');
                // Row 0: duration=30 min, intensity=18.5
                expect(cells[0].textContent).toInclude('30 min');
                expect(cells[1].textContent).toInclude('18.5');
                done();
            });
        });

        it('renders "No data" when data array is empty', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={[]} />, container, () => {
                const cells = container.querySelectorAll('tbody td');
                expect(cells.length).toBe(1);
                expect(cells[0].textContent).toInclude('No data');
                done();
            });
        });

        it('returns null when columns is empty and no children', (done) => {
            ReactDOM.render(<Table columns={[]} data={[]} />, container, () => {
                expect(container.querySelector('table')).toNotExist();
                done();
            });
        });
    });

    describe('Surface variants', () => {
        it('default surface="dark" adds sv-table--dark', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const el = container.querySelector('.sv-table--dark');
                expect(el).toExist();
                done();
            });
        });

        it('surface="light" adds sv-table--light', (done) => {
            ReactDOM.render(<Table surface="light" columns={DEMO_COLS} data={DEMO_DATA} />, container, () => {
                const el = container.querySelector('.sv-table--light');
                expect(el).toExist();
                done();
            });
        });

        it('surface="light" uses --sv-chart-surface token in inline style', (done) => {
            ReactDOM.render(<Table surface="light" columns={DEMO_COLS} data={[]} />, container, () => {
                const el = container.querySelector('table');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('--sv-chart-surface');
                done();
            });
        });

        it('surface="dark" does NOT use --sv-chart-surface', (done) => {
            ReactDOM.render(<Table surface="dark" columns={DEMO_COLS} data={[]} />, container, () => {
                const el = container.querySelector('table');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toNotInclude('--sv-chart-surface');
                done();
            });
        });
    });

    describe('extraClassName', () => {
        it('carries extraClassName alongside sv-table', (done) => {
            ReactDOM.render(<Table columns={DEMO_COLS} data={DEMO_DATA} extraClassName="idf-table" />, container, () => {
                const el = container.querySelector('.sv-table');
                expect(el.className).toInclude('idf-table');
                done();
            });
        });
    });

    describe('Raw JSX children', () => {
        it('renders raw thead/tbody children when provided', (done) => {
            ReactDOM.render(
                <Table>
                    <thead><tr><th>Col A</th></tr></thead>
                    <tbody><tr><td>Row 1</td></tr></tbody>
                </Table>,
                container,
                () => {
                    const el = container.querySelector('table.sv-table');
                    expect(el).toExist();
                    expect(el.querySelector('th').textContent).toInclude('Col A');
                    expect(el.querySelector('td').textContent).toInclude('Row 1');
                    done();
                }
            );
        });
    });
});
