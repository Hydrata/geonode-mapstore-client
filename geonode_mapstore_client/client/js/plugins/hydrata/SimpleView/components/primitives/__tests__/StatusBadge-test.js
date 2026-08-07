import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {StatusBadge} from '../StatusBadge';

/**
 * TASK-1664 W2: unit tests for the StatusBadge primitive.
 *
 * StatusBadge is presentation-only (no redux). It renders a span with sv- class
 * variants for each of the 5 process states: running, pending, complete, error, cancelled.
 *
 * Spec:
 *   - Always renders .sv-status-badge
 *   - State maps to .is-running / .is-pending / .is-ok / .is-err / .is-cancelled
 *   - label prop overrides display text
 *   - compact=true adds .is-compact
 *   - showGlyph=true renders a glyphicon span
 *   - Unknown status falls through to .is-unknown (no crash)
 */

describe('SimpleView StatusBadge primitive (TASK-1664 W2)', () => {
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
        it('renders a span with class sv-status-badge', (done) => {
            ReactDOM.render(<StatusBadge status="complete" />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el).toExist();
                expect(el.tagName).toBe('SPAN');
                done();
            });
        });

        it('renders without crashing when status is an unknown string', (done) => {
            ReactDOM.render(<StatusBadge status="banana" />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el).toExist();
                expect(el.className).toInclude('is-unknown');
                done();
            });
        });
    });

    describe('State class mapping', () => {
        const cases = [
            { status: 'running',   expectedClass: 'is-running' },
            { status: 'pending',   expectedClass: 'is-pending' },
            { status: 'complete',  expectedClass: 'is-ok' },
            { status: 'error',     expectedClass: 'is-err' },
            { status: 'cancelled', expectedClass: 'is-cancelled' }
        ];

        cases.forEach(({ status, expectedClass }) => {
            it(`status="${status}" adds class ${expectedClass}`, (done) => {
                ReactDOM.render(<StatusBadge status={status} />, container, () => {
                    const el = container.querySelector('.sv-status-badge');
                    expect(el.className).toInclude(expectedClass);
                    done();
                });
            });
        });
    });

    describe('Liveness state class mapping (TASK-2689, epic 2662)', () => {
        // Server-derived D5 liveness states TaskMonitor renders verbatim
        // (TASK-2674). First-class entries — none may fall through to the
        // is-unknown question-mark fallback.
        const cases = [
            { status: 'stalled',          expectedClass: 'is-stalled',          expectedGlyph: 'glyphicon-hourglass' },
            { status: 'zombie-candidate', expectedClass: 'is-zombie-candidate', expectedGlyph: 'glyphicon-alert' },
            { status: 'provisioning',     expectedClass: 'is-provisioning',     expectedGlyph: 'glyphicon-cloud' }
        ];

        cases.forEach(({ status, expectedClass, expectedGlyph }) => {
            it(`status="${status}" adds class ${expectedClass} (not is-unknown)`, (done) => {
                ReactDOM.render(<StatusBadge status={status} />, container, () => {
                    const el = container.querySelector('.sv-status-badge');
                    expect(el.className).toInclude(expectedClass);
                    expect(el.className).toNotInclude('is-unknown');
                    done();
                });
            });

            it(`status="${status}" glyph is ${expectedGlyph}`, (done) => {
                ReactDOM.render(<StatusBadge status={status} showGlyph />, container, () => {
                    const glyph = container.querySelector('.sv-status-badge-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude(expectedGlyph);
                    expect(glyph.className).toNotInclude('glyphicon-question-sign');
                    done();
                });
            });
        });

        it('liveness badges keep the compact variant', (done) => {
            ReactDOM.render(<StatusBadge status="zombie-candidate" compact />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el.className).toInclude('is-zombie-candidate');
                expect(el.className).toInclude('is-compact');
                done();
            });
        });
    });

    describe('Label prop', () => {
        it('renders the status string as text when label is not provided', (done) => {
            ReactDOM.render(<StatusBadge status="running" />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el.textContent).toInclude('running');
                done();
            });
        });

        it('renders the label prop as text instead of the status string', (done) => {
            ReactDOM.render(<StatusBadge status="running" label="In Progress" />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el.textContent).toInclude('In Progress');
                expect(el.textContent).toNotInclude('running');
                done();
            });
        });
    });

    describe('compact prop', () => {
        it('does NOT add is-compact by default', (done) => {
            ReactDOM.render(<StatusBadge status="complete" />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el.className).toNotInclude('is-compact');
                done();
            });
        });

        it('adds is-compact when compact=true', (done) => {
            ReactDOM.render(<StatusBadge status="complete" compact />, container, () => {
                const el = container.querySelector('.sv-status-badge');
                expect(el.className).toInclude('is-compact');
                done();
            });
        });
    });

    describe('showGlyph prop', () => {
        it('does NOT render a glyph span by default', (done) => {
            ReactDOM.render(<StatusBadge status="complete" />, container, () => {
                const glyph = container.querySelector('.sv-status-badge-glyph');
                expect(glyph).toNotExist();
                done();
            });
        });

        it('renders a .sv-status-badge-glyph span when showGlyph=true', (done) => {
            ReactDOM.render(<StatusBadge status="complete" showGlyph />, container, () => {
                const glyph = container.querySelector('.sv-status-badge-glyph');
                expect(glyph).toExist();
                expect(glyph.className).toInclude('glyphicon');
                done();
            });
        });

        it('running glyph is glyphicon-refresh', (done) => {
            ReactDOM.render(<StatusBadge status="running" showGlyph />, container, () => {
                const glyph = container.querySelector('.sv-status-badge-glyph');
                expect(glyph.className).toInclude('glyphicon-refresh');
                done();
            });
        });
    });
});
