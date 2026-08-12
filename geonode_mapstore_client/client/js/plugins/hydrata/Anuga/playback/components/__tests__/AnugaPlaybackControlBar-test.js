/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * TASK-2627 (W3.1, epic 2618) — AnugaPlaybackControlBar smoke tests. Named
 * TDD skip per the wave brief ("UI wiring/JSX may skip"): the behavioural
 * logic it wires to (playbackController's state machine) already has full
 * RED-GREEN coverage in playbackController-test.js; this file only proves
 * the wiring itself (right handler called with the right args, the right
 * DOM shows up for each status) with plain ReactDOM (DemRampLegend-test.js's
 * own pattern — no enzyme dep in this repo).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import { AnugaPlaybackControlBarComponent } from '../AnugaPlaybackControlBar';
import { PLAYBACK_STATUS, createInitialPlaybackState } from '../../playbackController';

describe('AnugaPlaybackControlBar — TASK-2627', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function render(props) {
        ReactDOM.render(<AnugaPlaybackControlBarComponent {...props} />, container);
    }

    it('renders the manifest-URL loader when no run is active (IDLE)', () => {
        render({ playback: createInitialPlaybackState() });
        expect(container.querySelector('[data-testid="anuga-playback-bar-loader"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="anuga-playback-bar"]')).toBe(null);
    });

    it('Load button is disabled with an empty URL and calls onInit(runId, layerId, url) once typed', () => {
        const onInit = expect.createSpy();
        render({ playback: createInitialPlaybackState(), onInit });
        const button = container.querySelector('[data-testid="anuga-playback-load-button"]');
        expect(button.disabled).toBe(true);

        const input = container.querySelector('[data-testid="anuga-playback-manifest-input"]');
        TestUtils.Simulate.change(input, { target: { value: '/manifest.json' } });
        const buttonAfter = container.querySelector('[data-testid="anuga-playback-load-button"]');
        expect(buttonAfter.disabled).toBe(false);
        TestUtils.Simulate.click(buttonAfter);
        expect(onInit.calls.length).toBe(1);
        expect(onInit.calls[0].arguments[2]).toBe('/manifest.json');
        expect(typeof onInit.calls[0].arguments[0]).toBe('string');
        expect(typeof onInit.calls[0].arguments[1]).toBe('string');
    });

    it('shows Play when paused/ready and Pause when playing, wired to onPlay/onPause', () => {
        const onPlay = expect.createSpy();
        const onPause = expect.createSpy();
        const readyState = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, currentTimestep: 0 };
        render({ playback: readyState, onPlay, onPause });
        const btn = container.querySelector('[data-testid="anuga-playback-playpause"]');
        expect(btn.textContent).toBe('▶');
        TestUtils.Simulate.click(btn);
        expect(onPlay.calls.length).toBe(1);
        expect(onPause.calls.length).toBe(0);

        render({ playback: { ...readyState, status: PLAYBACK_STATUS.PLAYING }, onPlay, onPause });
        const btn2 = container.querySelector('[data-testid="anuga-playback-playpause"]');
        expect(btn2.textContent).toBe('❙❙');
        TestUtils.Simulate.click(btn2);
        expect(onPause.calls.length).toBe(1);
    });

    it('scrubbing calls onSeek with a numeric timestep', () => {
        const onSeek = expect.createSpy();
        const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, currentTimestep: 2 };
        render({ playback: state, onSeek });
        const scrubber = container.querySelector('[data-testid="anuga-playback-scrubber"]');
        expect(scrubber.max).toBe('9');
        TestUtils.Simulate.change(scrubber, { target: { value: '7' } });
        expect(onSeek.calls.length).toBe(1);
        expect(onSeek.calls[0].arguments[0]).toBe(7);
    });

    it('shows the buffering indicator for buffering-family statuses, not for ready/playing', () => {
        const base = { ...createInitialPlaybackState(), nTime: 10 };
        [PLAYBACK_STATUS.BUFFERING, PLAYBACK_STATUS.SEEKING, PLAYBACK_STATUS.STALLED].forEach((status) => {
            render({ playback: { ...base, status } });
            expect(container.querySelector('[data-testid="anuga-playback-buffering"]')).toBeTruthy();
        });
        [PLAYBACK_STATUS.READY, PLAYBACK_STATUS.PLAYING].forEach((status) => {
            render({ playback: { ...base, status } });
            expect(container.querySelector('[data-testid="anuga-playback-buffering"]')).toBe(null);
        });
    });

    it('shows the degraded badge only when playback.degraded is true', () => {
        const base = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.STALLED, nTime: 10 };
        render({ playback: { ...base, degraded: false } });
        expect(container.querySelector('[data-testid="anuga-playback-degraded"]')).toBe(null);
        render({ playback: { ...base, degraded: true } });
        expect(container.querySelector('[data-testid="anuga-playback-degraded"]')).toBeTruthy();
    });

    it('quantity picker reflects state and calls onSetQuantity on change', () => {
        const onSetQuantity = expect.createSpy();
        const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, quantity: 'depth' };
        render({ playback: state, onSetQuantity });
        const select = container.querySelector('[data-testid="anuga-playback-quantity"]');
        expect(select.value).toBe('depth');
        TestUtils.Simulate.change(select, { target: { value: 'speed' } });
        expect(onSetQuantity.calls.length).toBe(1);
        expect(onSetQuantity.calls[0].arguments[0]).toBe('speed');
    });

    // TASK-2629 (W4.1) — AC: "Courant hidden gracefully when dt absent".
    it('quantity picker lists all eight options (incl. Courant) when hasDt is true', () => {
        const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, hasDt: true };
        render({ playback: state });
        const select = container.querySelector('[data-testid="anuga-playback-quantity"]');
        const values = Array.from(select.options).map((o) => o.value);
        expect(values.length).toBe(8);
        expect(values).toContain('courant');
    });
    it('quantity picker omits ONLY Courant when hasDt is false', () => {
        const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, hasDt: false };
        render({ playback: state });
        const select = container.querySelector('[data-testid="anuga-playback-quantity"]');
        const values = Array.from(select.options).map((o) => o.value);
        expect(values.length).toBe(7);
        expect(values).toNotContain('courant');
        expect(values).toContain('depth');
        expect(values).toContain('hazard');
    });

    // TASK-2656d (W6.5, epic 2618) — real wireframe toggle (was hardcoded
    // `false` in playbackEpics.js baseProps with no control anywhere).
    describe('wireframe toggle (TASK-2656d)', () => {
        it('reflects playback.wireframe in its active class and calls onSetWireframe(!current) on click', () => {
            const onSetWireframe = expect.createSpy();
            const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, wireframe: false };
            render({ playback: state, onSetWireframe });
            const btn = container.querySelector('[data-testid="anuga-playback-wireframe-toggle"]');
            expect(btn).toBeTruthy();
            expect(btn.className).toNotContain('active');
            TestUtils.Simulate.click(btn);
            expect(onSetWireframe.calls.length).toBe(1);
            expect(onSetWireframe.calls[0].arguments[0]).toBe(true);
        });

        it('shows active when playback.wireframe is true and toggles it back off', () => {
            const onSetWireframe = expect.createSpy();
            const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10, wireframe: true };
            render({ playback: state, onSetWireframe });
            const btn = container.querySelector('[data-testid="anuga-playback-wireframe-toggle"]');
            expect(btn.className).toContain('active');
            TestUtils.Simulate.click(btn);
            expect(onSetWireframe.calls[0].arguments[0]).toBe(false);
        });

        it('defaults to OFF (AC) when playback.wireframe is not set', () => {
            const state = { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 10 };
            render({ playback: state });
            const btn = container.querySelector('[data-testid="anuga-playback-wireframe-toggle"]');
            expect(btn.className).toNotContain('active');
        });
    });

    // TASK-2744 (AC2, epic 2706) — THE RUN MUST BE UNLOADABLE.
    // RED on HEAD: there was NO control anywhere on the bar that dispatched
    // playbackReset(), so a loaded run could never be released — measured live
    // on map 1461, `[data-testid="anuga-playback-unload"]` was null while
    // status was 'ready'.
    describe('Unload — TASK-2744 AC2', () => {
        function loadedState(extra = {}) {
            return {
                ...createInitialPlaybackState(),
                status: PLAYBACK_STATUS.READY,
                nTime: 31,
                runId: 'run-77',
                layerId: 'layer-77',
                ...extra
            };
        }

        it('renders a visible Unload control whenever a run is active', () => {
            render({ playback: loadedState() });
            const btn = container.querySelector('[data-testid="anuga-playback-unload"]');
            expect(btn).toBeTruthy();
            // an accessible name, not a bare glyph (AC7 applies to it too)
            expect(btn.getAttribute('title')).toBeTruthy();
        });

        it('dispatches onReset(runId, layerId) so the epic can free the fetcher AND remove the overlay', () => {
            const onReset = expect.createSpy();
            render({ playback: loadedState(), onReset });
            TestUtils.Simulate.click(container.querySelector('[data-testid="anuga-playback-unload"]'));
            expect(onReset.calls.length).toBe(1);
            expect(onReset.calls[0].arguments[0]).toBe('run-77');
            expect(onReset.calls[0].arguments[1]).toBe('layer-77');
        });

        it('after a reset the component returns to IDLE and shows the manifest loader again', () => {
            render({ playback: loadedState() });
            expect(container.querySelector('[data-testid="anuga-playback-manifest-input"]')).toBe(null);
            // what the reducer's PLAYBACK_RESET case actually produces
            render({ playback: createInitialPlaybackState() });
            expect(container.querySelector('[data-testid="anuga-playback-manifest-input"]')).toBeTruthy();
            expect(container.querySelector('[data-testid="anuga-playback-unload"]')).toBe(null);
        });
    });
});
