/*
 * TASK-2165 — tests for the simpleViewMenuRow onZoom guard chain.
 *
 * ANUGA vector layers are created empty with a world-extent placeholder
 * bbox; WFS-T draws bypass Django so the GeoNode Dataset extent stays
 * world. onZoom already rejects a world Redux bbox and falls back to the
 * datasets API — but pre-fix the fallback did NOT re-apply the guard, so
 * the same stale world coords came back and the map planet-zoomed.
 *
 * Covers:
 *   - real Redux bbox -> zooms directly, no API call
 *   - world Redux bbox -> falls back to /api/v2/datasets/?filter{name}=
 *   - fallback returning world coords -> "Zoom unavailable" toast, NO zoom
 *   - fallback returning real coords -> zooms to them
 *   - fallback returning no extent / erroring -> toast
 *
 * Renders nothing: onZoom/fetchAndZoomToLayer only touch this.props and
 * axios, so the unconnected MenuRowClass is instantiated directly (same
 * rationale as simpleViewMenuRowDelete-test.js's unwrapped-class usage).
 */
import expect from 'expect';
import axios from '../../../../../../MapStore2/web/client/libs/ajax';
import { MenuRowClass } from '../simpleViewMenuRow';

const MockAdapter = require('axios-mock-adapter');

const WORLD_BOUNDS = { minx: -180, miny: -90, maxx: 180, maxy: 90 };
const REAL_BOUNDS = { minx: 150.9, miny: -33.9, maxx: 151.0, maxy: -33.8 };
const REAL_COORDS = [150.9, -33.9, 151.0, -33.8];
const WORLD_COORDS = [-180, -90, 180, 90];

const makeLayer = (bounds) => ({
    id: 'geonode:bdy_1_boundary_01__uuid',
    name: 'geonode:bdy_1_boundary_01',
    title: 'Boundary 01',
    ...(bounds ? { bbox: { bounds, crs: 'EPSG:4326' } } : {})
});

const makeRow = (layer, spies) => new MenuRowClass({
    layer,
    zoomToLayer: spies.zoomToLayer,
    showExtentUnavailable: spies.showExtentUnavailable
});

const makeSpies = () => {
    const calls = { zoom: [], toast: [] };
    return {
        calls,
        zoomToLayer: (extent, crs) => calls.zoom.push({ extent, crs }),
        showExtentUnavailable: (title) => calls.toast.push(title)
    };
};

const datasetsResponse = (coords) => ({
    datasets: coords ? [{ extent: { coords, srid: 'EPSG:4326' } }] : []
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('simpleViewMenuRow onZoom (TASK-2165 world-extent guard)', () => {
    let mockAxios;
    beforeEach(() => { mockAxios = new MockAdapter(axios); });
    afterEach(() => { mockAxios.restore(); });

    it('zooms directly when the Redux bbox is real (no API call)', () => {
        const spies = makeSpies();
        makeRow(makeLayer(REAL_BOUNDS), spies).onZoom();
        expect(spies.calls.zoom.length).toBe(1);
        expect(spies.calls.zoom[0].extent).toEqual(REAL_COORDS);
        expect((mockAxios.history.get || []).length).toBe(0);
    });

    it('world Redux bbox falls back to the datasets API', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(200, datasetsResponse(REAL_COORDS));
        makeRow(makeLayer(WORLD_BOUNDS), spies).onZoom();
        await flush();
        const gets = mockAxios.history.get || [];
        expect(gets.length).toBe(1);
        expect(gets[0].url).toContain('filter{name}=bdy_1_boundary_01');
    });

    it('fallback returning the SAME world extent shows the toast instead of planet-zooming', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(200, datasetsResponse(WORLD_COORDS));
        makeRow(makeLayer(WORLD_BOUNDS), spies).onZoom();
        await flush();
        expect(spies.calls.zoom.length).toBe(0);
        expect(spies.calls.toast).toEqual(['Boundary 01']);
    });

    it('fallback returning a real extent zooms to it', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(200, datasetsResponse(REAL_COORDS));
        makeRow(makeLayer(WORLD_BOUNDS), spies).onZoom();
        await flush();
        expect(spies.calls.zoom.length).toBe(1);
        expect(spies.calls.zoom[0].extent).toEqual(REAL_COORDS);
        expect(spies.calls.zoom[0].crs).toBe('EPSG:4326');
        expect(spies.calls.toast.length).toBe(0);
    });

    it('fallback returning no extent shows the toast', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(200, datasetsResponse(null));
        makeRow(makeLayer(WORLD_BOUNDS), spies).onZoom();
        await flush();
        expect(spies.calls.zoom.length).toBe(0);
        expect(spies.calls.toast).toEqual(['Boundary 01']);
    });

    it('fallback API error shows the toast', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(500);
        makeRow(makeLayer(WORLD_BOUNDS), spies).onZoom();
        await flush();
        expect(spies.calls.zoom.length).toBe(0);
        expect(spies.calls.toast).toEqual(['Boundary 01']);
    });

    it('missing Redux bbox also routes through the guarded fallback', async() => {
        const spies = makeSpies();
        mockAxios.onGet(/\/api\/v2\/datasets\//).reply(200, datasetsResponse(WORLD_COORDS));
        makeRow(makeLayer(null), spies).onZoom();
        await flush();
        expect(spies.calls.zoom.length).toBe(0);
        expect(spies.calls.toast).toEqual(['Boundary 01']);
    });
});
