/*
 * TASK-1850 (epic 1814 W2) — DemRampLegend component spec.
 *
 * Asserts:
 *   - renders 11 swatches (one per fixed ramp colour),
 *   - elevation labels track the LIVE stops parsed from demLayer.params.env,
 *   - falls back to the terrain row's stored dem_elev_min/max when no live env,
 *   - shows the "full range" indicator when degraded (PART A) OR on the stored
 *     fallback range.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

import {
    DemRampLegendComponent,
    resolveLegendStops
} from '../DemRampLegend';
import {
    buildEnvString
} from '../../epics/demRescaleEpic';
import { computeDemRampStops } from '../../utils/demRamp';

describe('DemRampLegend — TASK-1850', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const liveEnv = buildEnvString(computeDemRampStops(200, 400));

    it('renders 11 swatches', () => {
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded={false} />,
            container
        );
        const swatches = container.querySelectorAll('.sv-dem-legend-swatch');
        expect(swatches.length).toBe(11);
        const rows = container.querySelectorAll('.sv-dem-legend-row');
        expect(rows.length).toBe(11);
    });

    it('labels track the LIVE stops from demLayer.params.env', () => {
        // computeDemRampStops(200,400): min snaps to 200, max to 400, step 20 →
        // top stop (elevMax) = 400, bottom (elevMin) = 200.
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded={false} />,
            container
        );
        const labels = Array.from(container.querySelectorAll('.sv-dem-legend-label')).map(n => n.textContent);
        // Rendered high->low, so the FIRST label is elevMax (400), the LAST is elevMin (200).
        expect(labels[0]).toBe('400');
        expect(labels[labels.length - 1]).toBe('200');
        // No full-range badge when we have live stops and not degraded.
        expect(container.querySelector('.sv-dem-legend-fullrange')).toNotExist();
    });

    it('falls back to stored dem_elev_min/max when no live env, and shows full-range', () => {
        const demLayer = { id: 'l1', params: {} }; // no env yet
        const terrainModel = { dem_elev_min: 100, dem_elev_max: 300 };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={terrainModel} degraded={false} />,
            container
        );
        const labels = Array.from(container.querySelectorAll('.sv-dem-legend-label')).map(n => n.textContent);
        expect(labels[0]).toBe('300');           // elevMax (stored)
        expect(labels[labels.length - 1]).toBe('100'); // elevMin (stored)
        // Stored (whole-raster) range → full-range indicator shown.
        expect(container.querySelector('.sv-dem-legend-fullrange')).toExist();
    });

    it('shows the full-range indicator when degraded even with a live env present', () => {
        const demLayer = { id: 'l1', params: { env: liveEnv } };
        ReactDOM.render(
            <DemRampLegendComponent demLayer={demLayer} terrainModel={{}} degraded />,
            container
        );
        expect(container.querySelector('.sv-dem-legend-fullrange')).toExist();
        expect(container.querySelector('[data-testid="dem-ramp-legend-fullrange"]').textContent).toBe('full range');
    });

    describe('resolveLegendStops (precedence)', () => {
        it('prefers the live env over the stored range', () => {
            const demLayer = { params: { env: liveEnv } };
            const { stops, source } = resolveLegendStops(demLayer, { dem_elev_min: 0, dem_elev_max: 50 });
            expect(source).toBe('live');
            expect(stops.elevMax).toBe(400);
        });
        it('falls back to stored when env absent', () => {
            const { stops, source } = resolveLegendStops({ params: {} }, { dem_elev_min: 100, dem_elev_max: 300 });
            expect(source).toBe('stored');
            expect(stops.elevMin).toBe(100);
        });
        it('returns source=none when neither is available', () => {
            const { source } = resolveLegendStops({ params: {} }, {});
            expect(source).toBe('none');
        });
    });
});
