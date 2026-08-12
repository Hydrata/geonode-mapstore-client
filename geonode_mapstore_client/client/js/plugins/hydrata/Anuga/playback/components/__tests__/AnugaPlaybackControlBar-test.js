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

        it('AC3 — a labelled opacity control exists and moves the value across 0.2..1.0', () => {
            const onSetOpacity = expect.createSpy();
            render({ playback: loadedState(), onSetOpacity });
            const slider = container.querySelector('[data-testid="anuga-playback-opacity"]');
            expect(slider).toBeTruthy();
            // RED on HEAD: no such control existed at all and the layer was
            // pinned at 0.85 by playbackInitEpic (measured on map 1461).
            expect(slider.getAttribute('aria-label')).toBeTruthy();
            expect(Number(slider.min)).toBeLessThanOrEqualTo(0.2);
            expect(Number(slider.max)).toBe(1);
            [0.2, 0.5, 1].forEach((v) => TestUtils.Simulate.change(slider, { target: { value: String(v) } }));
            expect(onSetOpacity.calls.length).toBe(3);
            expect(onSetOpacity.calls[0].arguments[0]).toBe(0.2);
            expect(onSetOpacity.calls[2].arguments[0]).toBe(1);
            // AC7 — the current value is rendered, not just held in the handle
            expect(container.querySelector('[data-testid="anuga-playback-opacity-value"]').textContent).toBe('85%');
        });

        it('AC4 — the colour-ramp maximum is user-settable and shows the effective value', () => {
            const onSetColorMax = expect.createSpy();
            const quantization = { depth: { valid_max: 16.862720489501953 } };
            render({ playback: loadedState({ quantity: 'depth', quantization }), onSetColorMax });
            const input = container.querySelector('[data-testid="anuga-playback-colormax"]');
            expect(input).toBeTruthy();
            // RED: this is the store's valid_max — every urban depth lands in
            // the bottom 6% of the ramp.
            expect(Number(input.value)).toBe(16.863);
            TestUtils.Simulate.change(input, { target: { value: '1.5' } });
            expect(onSetColorMax.calls[0].arguments[0]).toBe('depth');
            expect(onSetColorMax.calls[0].arguments[1]).toBe(1.5);
        });

        it('AC4 — once overridden, the field shows the OVERRIDE rather than the store maximum', () => {
            const quantization = { depth: { valid_max: 16.862720489501953 } };
            render({ playback: loadedState({ quantity: 'depth', quantization, colorMaxOverride: { depth: 1.5 } }) });
            expect(Number(container.querySelector('[data-testid="anuga-playback-colormax"]').value)).toBe(1.5);
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

    // TASK-2744 (AC1, epic 2706) — UNMOUNT MUST NOT LEAVE PLAYBACK RUNNING.
    //
    // RED, measured on map 1461: press Play, switch the SimpleView menu away
    // from 'Results' (which unmounts this bar, anugaContainer.js:431) and the
    // controller stayed 'playing' — the playhead advanced 3.00 s over 3 s of
    // wall clock with the bar gone and no control left to stop it. There was
    // no componentWillUnmount in the file at all, and playbackTickEpic only
    // stops on PLAYBACK_PAUSE/PLAYBACK_RESET.
    describe('unmount stops playback — TASK-2744 AC1', () => {
        function playing(extra = {}) {
            return { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.PLAYING, nTime: 31, runId: 'r', layerId: 'l', ...extra };
        }

        it('dispatches pause on unmount while PLAYING', () => {
            const onPause = expect.createSpy();
            render({ playback: playing(), onPause });
            expect(onPause.calls.length).toBe(0);
            ReactDOM.unmountComponentAtNode(container);
            expect(onPause.calls.length).toBe(1);
        });

        it('does NOT dispatch pause on unmount when it was not playing', () => {
            const onPause = expect.createSpy();
            render({ playback: playing({ status: PLAYBACK_STATUS.READY }), onPause });
            ReactDOM.unmountComponentAtNode(container);
            expect(onPause.calls.length).toBe(0);
        });

        it('does not throw when unmounted with no run at all', () => {
            render({ playback: createInitialPlaybackState() });
            expect(() => ReactDOM.unmountComponentAtNode(container)).toNotThrow();
        });
    });

    // TASK-2744 (AC17, epic 2706) — the speed picker must state what it means.
    // RED on map 1461: options were bare multipliers 0.25x..8x, the default was
    // 1x, and at 1x a Msimbazi timestep took 60 SECONDS of wall clock.
    describe('speed picker states wall-clock meaning — TASK-2744 AC17', () => {
        const MSIMBAZI_TIME = Array.from({ length: 31 }, (_, i) => i * 60); // 0..1800 s

        function loadedRun(extra = {}) {
            return {
                ...createInitialPlaybackState(),
                status: PLAYBACK_STATUS.READY, nTime: 31, runId: 'r', layerId: 'l',
                time: MSIMBAZI_TIME, speed: 120,
                ...extra
            };
        }

        it('every option label states a duration or an explicit multiplier — never a bare "8x"', () => {
            render({ playback: loadedRun() });
            const labels = [...container.querySelectorAll('[data-testid="anuga-playback-speed"] option')].map((o) => o.textContent);
            expect(labels.length > 0).toBe(true);
            // the default option says the whole run takes 15 s, and that it is 120x
            expect(labels.some((l) => l.indexOf('15 s') !== -1 && l.indexOf('120x') !== -1)).toBe(true);
            // real time is offered AND labelled, with the run's true length
            expect(labels.some((l) => l.indexOf('Real time') !== -1 && l.indexOf('1x') !== -1)).toBe(true);
            expect(labels.some((l) => l.indexOf('30 min') !== -1)).toBe(true);
        });

        it('offers an option whose value is exactly 1 (real time stays reachable)', () => {
            render({ playback: loadedRun() });
            const values = [...container.querySelectorAll('[data-testid="anuga-playback-speed"] option')].map((o) => Number(o.value));
            expect(values.indexOf(1) !== -1).toBe(true);
        });

        it('the controlled value always has a matching option, even for an odd seeded speed', () => {
            render({ playback: loadedRun({ speed: 37.5 }) });
            const values = [...container.querySelectorAll('[data-testid="anuga-playback-speed"] option')].map((o) => Number(o.value));
            expect(values.indexOf(37.5) !== -1).toBe(true);
        });

        it('degrades to real time + slow motion when the store declares no duration', () => {
            render({ playback: { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 31, time: null, speed: 1 } });
            const values = [...container.querySelectorAll('[data-testid="anuga-playback-speed"] option')].map((o) => Number(o.value));
            expect(values.indexOf(1) !== -1).toBe(true);
            expect(values.every((v) => v <= 1)).toBe(true);
        });
    });

    // TASK-2744 (AC11, epic 2706) — OVERLAY TOGGLES MUST NOT DESYNC ACROSS A
    // REMOUNT. RED, measured on map 1461: enable Flow viz, switch the
    // SimpleView menu away from 'Results' (which UNMOUNTS this bar per
    // anugaContainer.js:431) and back — the layer still had flowVizEnabled
    // true while the button had lost its `active` class.
    //
    // The fix is structural: the knobs are controller state now, so an
    // unmount cannot lose them. The spec below reproduces the remount by
    // literally unmounting and re-rendering the component, which is what the
    // menu switch does.
    describe('overlay knobs survive a remount — TASK-2744 AC11', () => {
        function loaded(extra = {}) {
            return { ...createInitialPlaybackState(), status: PLAYBACK_STATUS.READY, nTime: 31, runId: 'r', layerId: 'l', ...extra };
        }

        it('reads the toggle state from the controller, not component-local state', () => {
            render({ playback: loaded({ flowVizEnabled: true }) });
            expect(container.querySelector('[data-testid="anuga-playback-flowviz-toggle"]').className).toContain('active');
            render({ playback: loaded({ flowVizEnabled: false }) });
            expect(container.querySelector('[data-testid="anuga-playback-flowviz-toggle"]').className).toNotContain('active');
        });

        it('button and layer AGREE after a real unmount/remount, for flow viz AND particles', () => {
            const state = loaded({ flowVizEnabled: true, particlesEnabled: true });
            render({ playback: state });
            expect(container.querySelector('[data-testid="anuga-playback-flowviz-toggle"]').className).toContain('active');
            expect(container.querySelector('[data-testid="anuga-playback-particles-toggle"]').className).toContain('active');

            // the menu switch: unmount, then mount again against the SAME
            // controller state (which the reducer, not the bar, owns)
            ReactDOM.unmountComponentAtNode(container);
            render({ playback: state });

            expect(container.querySelector('[data-testid="anuga-playback-flowviz-toggle"]').className).toContain('active');
            expect(container.querySelector('[data-testid="anuga-playback-particles-toggle"]').className).toContain('active');
            // and the knobs kept their values too
            expect(Number(container.querySelector('[data-testid="anuga-playback-flowviz-density"]').value)).toBe(state.arrowDensity);
            expect(Number(container.querySelector('[data-testid="anuga-playback-particles-density"]').value)).toBe(state.particleDensity);
        });

        it('dispatches onSetOverlay(key, value) for every knob', () => {
            const onSetOverlay = expect.createSpy();
            render({ playback: loaded({ flowVizEnabled: true, particlesEnabled: true }), onSetOverlay });
            TestUtils.Simulate.click(container.querySelector('[data-testid="anuga-playback-flowviz-toggle"]'));
            expect(onSetOverlay.calls[0].arguments).toEqual(['flowVizEnabled', false]);
            TestUtils.Simulate.change(container.querySelector('[data-testid="anuga-playback-flowviz-density"]'), { target: { value: '80' } });
            expect(onSetOverlay.calls[1].arguments).toEqual(['arrowDensity', 80]);
            TestUtils.Simulate.change(container.querySelector('[data-testid="anuga-playback-particles-exaggeration"]'), { target: { value: '2.5' } });
            expect(onSetOverlay.calls[2].arguments).toEqual(['particleSpeedExaggeration', 2.5]);
        });

        it('AC7 — every slider renders its current numeric value adjacent to it', () => {
            render({ playback: loaded({ flowVizEnabled: true, particlesEnabled: true }) });
            ['anuga-playback-opacity', 'anuga-playback-flowviz-density', 'anuga-playback-flowviz-scale',
                'anuga-playback-particles-density', 'anuga-playback-particles-exaggeration'].forEach((testid) => {
                const valueEl = container.querySelector(`[data-testid="${testid}-value"]`);
                expect(valueEl).toBeTruthy();
                expect(valueEl.textContent.length > 0).toBe(true);
            });
        });
    });
});
