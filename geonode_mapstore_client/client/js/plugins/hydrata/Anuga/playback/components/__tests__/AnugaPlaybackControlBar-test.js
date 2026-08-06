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
});
