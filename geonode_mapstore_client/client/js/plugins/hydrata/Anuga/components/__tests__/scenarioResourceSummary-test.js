import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioResourceSummary, summariseResource} from '../scenarioResourceSummary';

/**
 * TASK-C-scenarios-miller Wave 3A — basic render contract for the
 * ScenarioResourceSummary component.
 */

describe('Wave 3A — ScenarioResourceSummary', () => {
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

    it('renders the body + glyph for a terrain kind', (done) => {
        ReactDOM.render(
            <ScenarioResourceSummary
                kind="terrain"
                body="1.0 m raster"
                meta="EPSG:28356"
            />,
            container,
            () => {
                const card = container.querySelector('.anuga-scenario-resource-summary');
                expect(card).toExist();
                expect(card.className).toInclude('anuga-scenario-resource-summary--terrain');
                expect(container.querySelector('.anuga-scenario-resource-summary-glyph')).toExist();
                expect(container.textContent).toInclude('1.0 m raster');
                expect(container.textContent).toInclude('EPSG:28356');
                done();
            }
        );
    });

    it('omits the meta slot when meta is null', (done) => {
        ReactDOM.render(
            <ScenarioResourceSummary kind="boundary" body="4 segments" />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-resource-summary-meta')).toNotExist();
                done();
            }
        );
    });

    it('returns null when neither body nor meta is provided', (done) => {
        ReactDOM.render(
            <ScenarioResourceSummary kind="inflow" />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-resource-summary')).toNotExist();
                done();
            }
        );
    });

    it('applies the kind modifier class for each known kind', (done) => {
        const kinds = ['terrain', 'boundary', 'inflow', 'rainfall', 'friction', 'structure', 'mesh_region', 'network'];
        let remaining = kinds.length;
        kinds.forEach(kind => {
            const wrap = document.createElement('div');
            container.appendChild(wrap);
            ReactDOM.render(
                <ScenarioResourceSummary kind={kind} body="x" />,
                wrap,
                () => {
                    const card = wrap.querySelector('.anuga-scenario-resource-summary');
                    expect(card.className).toInclude(`anuga-scenario-resource-summary--${kind}`);
                    remaining -= 1;
                    if (remaining === 0) done();
                }
            );
        });
    });
});

describe('Wave 3A — summariseResource helper', () => {
    it('returns null when no resource matches the assigned id', () => {
        const out = summariseResource([{id: 1, title: 'A'}], 99, 'terrain');
        expect(out).toBe(null);
    });

    it('returns null when assignedId is null', () => {
        const out = summariseResource([{id: 1, title: 'A'}], null, 'terrain');
        expect(out).toBe(null);
    });

    it('falls back to title only when no domain metadata is present', () => {
        const out = summariseResource([{id: 7, title: 'Plain'}], 7, 'terrain');
        expect(out.body).toBe('Plain');
        expect(out.meta).toBe(null);
    });

    it('renders terrain summary with resolution + area + meta CRS', () => {
        const t = {
            id: 7,
            title: 'Riverbank LiDAR 1m',
            resolution_m: 1,
            area_km2: 14.2,
            crs: 'EPSG:28356'
        };
        const out = summariseResource([t], 7, 'terrain');
        expect(out.body).toInclude('1 m raster');
        expect(out.body).toInclude('14.2 km²');
        expect(out.meta).toBe('EPSG:28356');
    });

    it('renders boundary summary with segments + perimeter', () => {
        const b = {id: 7, title: 'Outline', segment_count: 4, perimeter_km: 12.4};
        const out = summariseResource([b], 7, 'boundary');
        expect(out.body).toInclude('4 segments');
        expect(out.body).toInclude('12.4 km perimeter');
    });

    it('renders rainfall summary with total + duration', () => {
        const r = {id: 7, title: 'BOM IFD', total_mm: 189, duration_hr: 6};
        const out = summariseResource([r], 7, 'rainfall');
        expect(out.body).toInclude('189 mm total');
        expect(out.body).toInclude('6h duration');
    });
});
