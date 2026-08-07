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
import { DEPTH_SLD_STOPS, VELOCITY_SLD_STOPS, HAZARD_CLASS_COLORS } from '../../playbackColormap';

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

    // TASK-2629 (W4.1) — AC: "the legend must render discrete classes" for
    // the AIDR hazard classification (unlike the continuous SLD ramps above).
    describe('hazard (discrete classes, AC-required)', () => {
        it('renders exactly one row per AIDR hazard class, never blended between them', () => {
            ReactDOM.render(<PlaybackLegendComponent quantity="hazard" quantization={null} />, container);
            const rows = container.querySelectorAll('[data-testid^="playback-legend-hazard-"]');
            expect(rows.length).toBe(HAZARD_CLASS_COLORS.length);
        });
        it('never shows the exceeds-SLD note (classification has no "exceeds its scale" concept)', () => {
            ReactDOM.render(<PlaybackLegendComponent quantity="hazard" quantization={null} />, container);
            expect(container.querySelector('[data-testid="playback-legend-exceeds-sld"]')).toBe(null);
        });
    });

    // TASK-2629 (W4.1) — AC: Courant is LABELLED approximate/global-dt.
    it('shows the Courant approximate-dt note only for the courant quantity', () => {
        ReactDOM.render(<PlaybackLegendComponent quantity="courant" quantization={null} />, container);
        expect(container.querySelector('[data-testid="playback-legend-approximate-note"]')).toBeTruthy();
        ReactDOM.render(<PlaybackLegendComponent quantity="depth" quantization={null} />, container);
        expect(container.querySelector('[data-testid="playback-legend-approximate-note"]')).toBe(null);
    });

    // TASK-2629 (W4.1) — the other four new continuous-ramp quantities render
    // through the SAME swatch-list path depth/speed already used.
    ['stage', 'div', 'froude', 'shear'].forEach((quantity) => {
        it(`renders a swatch-row legend for the '${quantity}' quantity without throwing`, () => {
            ReactDOM.render(<PlaybackLegendComponent quantity={quantity} quantization={{}} elevationMin={0} elevationMax={5} />, container);
            const rows = container.querySelectorAll('[data-testid^="playback-legend-row-"]');
            expect(rows.length).toBeGreaterThan(0);
        });
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

    // TASK-2629 (W4.1) — the six derived-quantity readout rows, shown only
    // when sampleFieldAtPoint actually computed that field (numeric present).
    it('shows stage/div/froude/shear/courant rows when present in the result', () => {
        const result = {
            located: true, surface: 'vertex-smoothed', depth: 1, speed: 2, wet: true,
            stage: 11.5, div: 2, froude: 0.64, shear: 12.3, courant: 0.8
        };
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result} />, container);
        expect(container.querySelector('[data-testid="playback-identify-stage"]').textContent).toContain('11.500');
        expect(container.querySelector('[data-testid="playback-identify-div"]').textContent).toContain('2.000');
        expect(container.querySelector('[data-testid="playback-identify-froude"]').textContent).toContain('0.640');
        expect(container.querySelector('[data-testid="playback-identify-shear"]').textContent).toContain('12.300');
        expect(container.querySelector('[data-testid="playback-identify-courant"]').textContent).toContain('0.800');
    });
    it('omits a derived-quantity row when it is not a number (backward compatible with a W3-shaped result)', () => {
        const result = { located: true, surface: 'vertex-smoothed', depth: 1, speed: 2, wet: true };
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result} />, container);
        expect(container.querySelector('[data-testid="playback-identify-stage"]')).toBe(null);
        expect(container.querySelector('[data-testid="playback-identify-courant"]')).toBe(null);
    });
    it('shows the hazard class row when hazardClass is present', () => {
        const result = { located: true, surface: 'vertex-smoothed', depth: 1, speed: 2, wet: true, hazardClass: 'H3', hazardClassIndex: 2 };
        ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result} />, container);
        expect(container.querySelector('[data-testid="playback-identify-hazard"]').textContent).toContain('H3');
    });

    // TASK-2656b (W6.5, epic 2618) — UAT: the panel's CSS bottom-left anchor
    // clips at the viewport edge once the result grows past a couple of
    // rows. The clamp logic must not depend on whichever incidental CSS
    // this karma bundle happens to have pulled in (the readout component
    // itself imports no CSS — anuga.css is only reachable transitively via
    // OTHER *-test.js files sharing this one webpack build), so the rect is
    // overridden directly on the DOM node to simulate an out-of-viewport
    // box regardless of real layout, then a result change (adds rows, the
    // same trigger a real taller readout hits) is used to exercise
    // componentDidUpdate's re-clamp path.
    //
    // LIVE-CAUGHT REGRESSION (W6.5 self-verify, not karma): the first cut of
    // this clamp wrote a viewport-relative left/top straight onto the
    // element's CSS-default `position: absolute` — but `absolute` positions
    // relative to the nearest POSITIONED ANCESTOR, not the viewport,
    // wherever that ancestor happens to sit. In the real app (nested deep in
    // MapStore's layout) that put the "fixed" panel at `top:1004px,
    // left:-297px` on a 766px-tall window — MORE broken than the original
    // bug. A plain `document.body`-appended container (no offset ancestor)
    // does not reproduce this — body's own origin ≈ the viewport origin, so
    // `absolute` and `fixed` looked identical there (same class of "test
    // data hides the bug" trap as an xllcorner=0 SWW fixture, memory:
    // reference-prove-the-detector-before-trusting-a-zero). This describe
    // wraps its container in an OFFSET positioned ancestor so a viewport-
    // relative write onto an `absolute`-positioned element would land
    // visibly wrong, the same way the real layout did.
    describe('viewport clamping', () => {
        let offsetAncestor;
        let offsetContainer;
        beforeEach(() => {
            offsetAncestor = document.createElement('div');
            offsetAncestor.style.position = 'absolute';
            offsetAncestor.style.left = '300px';
            offsetAncestor.style.top = '200px';
            document.body.appendChild(offsetAncestor);
            offsetContainer = document.createElement('div');
            offsetAncestor.appendChild(offsetContainer);
        });
        afterEach(() => {
            ReactDOM.unmountComponentAtNode(offsetContainer);
            document.body.removeChild(offsetAncestor);
        });

        it('clamps an out-of-viewport box back inside the visible window (position:fixed, not absolute)', () => {
            const result1 = { located: true, surface: 'vertex-smoothed', depth: 1, speed: 2, wet: true };
            ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result1} />, offsetContainer);
            const el = offsetContainer.querySelector('[data-testid="playback-identify-readout"]');
            expect(el).toExist();

            // Simulate the UAT repro: a box straddling the bottom-left edge
            // (partly off-screen on both axes), measured in VIEWPORT space —
            // exactly what the real getBoundingClientRect() returns.
            el.getBoundingClientRect = () => ({
                left: -40, top: window.innerHeight + 20, width: 200, height: 150,
                right: 160, bottom: window.innerHeight + 170
            });

            const result2 = { ...result1, stage: 11.5, div: 2, froude: 0.64 };
            ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result2} />, offsetContainer);

            expect(el.style.left).toNotBe(''); // clamp applied an inline override
            // The regression: writing viewport-relative coordinates onto a
            // `position: absolute` element (relative to offsetAncestor,
            // itself offset 300/200 from the viewport) would land it at the
            // WRONG place. `fixed` is unambiguous — its own containing block
            // IS the viewport here, so this assertion is the one that would
            // have caught the live bug.
            expect(el.style.position).toBe('fixed');
            const left = parseFloat(el.style.left);
            const top = parseFloat(el.style.top);
            expect(left).toBeGreaterThanOrEqualTo(0);
            expect(top).toBeGreaterThanOrEqualTo(0);
            expect(left + 200).toBeLessThanOrEqualTo(window.innerWidth);
            expect(top + 150).toBeLessThanOrEqualTo(window.innerHeight);
        });

        it('leaves position untouched when the box already fits (no gratuitous inline style)', () => {
            const result = { located: true, surface: 'vertex-smoothed', depth: 1, speed: 2, wet: true };
            ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result} />, offsetContainer);
            const el = offsetContainer.querySelector('[data-testid="playback-identify-readout"]');
            el.getBoundingClientRect = () => ({ left: 8, top: 8, width: 200, height: 150, right: 208, bottom: 158 });

            const result2 = { ...result, stage: 11.5 };
            ReactDOM.render(<PlaybackIdentifyReadoutComponent result={result2} />, offsetContainer);

            expect(el.style.left).toBe('');
            expect(el.style.top).toBe('');
        });
    });
});
