import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ProgressBar} from '../ProgressBar';

/**
 * TASK-1664 W2: unit tests for the ProgressBar primitive.
 *
 * ProgressBar is presentation-only. It renders a track + fill where the
 * fill width is clamped to [0, 100]%.
 */

describe('SimpleView ProgressBar primitive (TASK-1664 W2)', () => {
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

    describe('Structure', () => {
        it('renders a .sv-progress-track wrapper with role=progressbar', (done) => {
            ReactDOM.render(<ProgressBar pct={50} />, container, () => {
                const track = container.querySelector('.sv-progress-track');
                expect(track).toExist();
                expect(track.getAttribute('role')).toBe('progressbar');
                done();
            });
        });

        it('renders a .sv-progress-fill inside the track', (done) => {
            ReactDOM.render(<ProgressBar pct={50} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill).toExist();
                done();
            });
        });
    });

    describe('ARIA attributes', () => {
        it('sets aria-valuenow to the clamped pct', (done) => {
            ReactDOM.render(<ProgressBar pct={42} />, container, () => {
                const track = container.querySelector('.sv-progress-track');
                expect(track.getAttribute('aria-valuenow')).toBe('42');
                done();
            });
        });

        it('sets aria-valuemin=0 and aria-valuemax=100', (done) => {
            ReactDOM.render(<ProgressBar pct={10} />, container, () => {
                const track = container.querySelector('.sv-progress-track');
                expect(track.getAttribute('aria-valuemin')).toBe('0');
                expect(track.getAttribute('aria-valuemax')).toBe('100');
                done();
            });
        });
    });

    describe('Fill width clamping', () => {
        it('sets fill width to "50%" when pct=50', (done) => {
            ReactDOM.render(<ProgressBar pct={50} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('50%');
                done();
            });
        });

        it('clamps to 0% when pct=0', (done) => {
            ReactDOM.render(<ProgressBar pct={0} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('0%');
                done();
            });
        });

        it('clamps to 100% when pct=100', (done) => {
            ReactDOM.render(<ProgressBar pct={100} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('100%');
                done();
            });
        });

        it('clamps to 0% when pct is undefined', (done) => {
            ReactDOM.render(<ProgressBar />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('0%');
                done();
            });
        });

        it('clamps over-100 values to 100%', (done) => {
            ReactDOM.render(<ProgressBar pct={150} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('100%');
                done();
            });
        });

        it('clamps negative values to 0%', (done) => {
            ReactDOM.render(<ProgressBar pct={-10} />, container, () => {
                const fill = container.querySelector('.sv-progress-fill');
                expect(fill.style.width).toBe('0%');
                done();
            });
        });
    });
});
