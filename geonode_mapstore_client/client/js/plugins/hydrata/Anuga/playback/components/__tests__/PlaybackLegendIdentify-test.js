/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2628 (W3.2, epic 2618) — smoke tests for PlaybackLegend and
 * PlaybackIdentifyReadout. Named TDD skip (UI wiring — the value logic they
 * display is already covered by playbackColormap-test.js and
 * playbackIdentify-test.js): only proves the right DOM/AC-required copy
 * shows up for each state shape.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

import { PlaybackLegendComponent } from '../PlaybackLegend';
import { PlaybackIdentifyReadoutComponent } from '../PlaybackIdentifyReadout';
import { DEPTH_SLD_STOPS, VELOCITY_SLD_STOPS } from '../../playbackColormap';

describe('PlaybackLegend — TASK-2628', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('renders one swatch row per depth SLD stop when quantity=depth', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={{ depth: { valid_max: 4 } }} />, container);
        const rows = container.querySelectorAll('[data-testid^="playback-legend-row-"]');
        expect(rows.length).toBe(DEPTH_SLD_STOPS.length);
    });

    it('renders the velocity stops when quantity=speed', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="speed" quantization={{ x_velocity: { valid_max: 3, valid_min: -3 } }} />, container);
        const rows = container.querySelectorAll('[data-testid^="playback-legend-row-"]');
        expect(rows.length).toBe(VELOCITY_SLD_STOPS.length);
    });

    it('AC: the tolerance-vs-max-raster note is always visible', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={null} />, container);
        expect(container.querySelector('[data-testid="playback-legend-tolerance-note"]')).toBeTruthy();
    });

    it('shows the exceeds-SLD note when the store colorMax exceeds the fixed 6-unit SLD cap', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={{ depth: { valid_max: 22 } }} />, container);
        expect(container.querySelector('[data-testid="playback-legend-exceeds-sld"]')).toBeTruthy();
    });

    it('hides the exceeds-SLD note when within the SLD cap', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={{ depth: { valid_max: 2 } }} />, container);
        expect(container.querySelector('[data-testid="playback-legend-exceeds-sld"]')).toBe(null);
    });
});

describe('PlaybackIdentifyReadout — TASK-2628', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('renders nothing when no result is present', () => {
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={null} />, container);
        expect(container.firstChild).toBe(null);
    });

    it('shows depth/velocity values and the surface note for a located hit', () => {
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={{ located: true, depth: 1.234, speed: 0.5, wet: true, surface: 'vertex-smoothed' }} />, container);
        expect(container.querySelector('[data-testid="playback-identify-depth"]').textContent).toContain('1.234');
        expect(container.querySelector('[data-testid="playback-identify-surface-note"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="playback-identify-dry"]')).toBe(null);
    });

    it('shows the dry-ground note when wet=false', () => {
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={{ located: true, depth: 0, speed: 0, wet: false, surface: 'vertex-smoothed' }} />, container);
        expect(container.querySelector('[data-testid="playback-identify-dry"]')).toBeTruthy();
    });

    it('shows the no-data message when located=false', () => {
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={{ located: false, surface: 'vertex-smoothed' }} />, container);
        expect(container.querySelector('[data-testid="playback-identify-no-data"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="playback-identify-depth"]')).toBe(null);
    });
});
