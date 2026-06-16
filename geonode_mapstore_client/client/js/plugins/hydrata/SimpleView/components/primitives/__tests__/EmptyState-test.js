import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {EmptyState} from '../EmptyState';

/**
 * TASK-1732 (epic 1673 Phase 0): unit tests for the EmptyState primitive.
 *
 * EmptyState is presentation-only (no redux). It is the shared, token-backed,
 * centred "nothing here yet" block pulled from the ≥3 divergent per-panel empty
 * blocks (anuga-scenario-rail-empty, sv-tm-empty, tw-empty-hint).
 *
 * Best-of-breed source: .anuga-scenario-rail-empty (glyph + heading + subcopy).
 *
 * Spec:
 *   - Always renders a div.sv-empty-state
 *   - `glyph` renders a centred glyphicon span (aria-hidden) — omitted by default
 *   - `heading` renders an .sv-empty-state-heading; omitted when absent
 *   - `children` (subcopy) render in .sv-empty-state-subcopy; omitted when absent
 *   - token-backed: dim text colour composes the --sv-text-dim token
 *   - text-only usage (heading alone, no glyph) still renders cleanly
 */

describe('SimpleView EmptyState primitive (TASK-1732)', () => {
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
        it('renders a div.sv-empty-state', (done) => {
            ReactDOM.render(<EmptyState heading="Nothing yet" />, container, () => {
                const el = container.querySelector('.sv-empty-state');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('is token-backed: inline colour composes the --sv-text-dim token', (done) => {
            ReactDOM.render(<EmptyState heading="Nothing yet" />, container, () => {
                const el = container.querySelector('.sv-empty-state');
                expect((el.getAttribute('style') || '')).toInclude('--sv-text-dim');
                done();
            });
        });

        it('carries an extraClassName when provided', (done) => {
            ReactDOM.render(<EmptyState heading="x" extraClassName="tw-empty-hint" />, container, () => {
                const el = container.querySelector('.sv-empty-state');
                expect(el.className).toInclude('tw-empty-hint');
                done();
            });
        });

        it('renders without crashing when no props are supplied', (done) => {
            ReactDOM.render(<EmptyState />, container, () => {
                expect(container.querySelector('.sv-empty-state')).toExist();
                done();
            });
        });
    });

    describe('glyph slot', () => {
        it('does NOT render a glyph by default', (done) => {
            ReactDOM.render(<EmptyState heading="x" />, container, () => {
                expect(container.querySelector('.sv-empty-state-glyph')).toNotExist();
                done();
            });
        });

        it('renders an aria-hidden glyphicon span when glyph is supplied', (done) => {
            ReactDOM.render(<EmptyState glyph="glyphicon-list-alt" heading="x" />, container, () => {
                const glyph = container.querySelector('.sv-empty-state-glyph');
                expect(glyph).toExist();
                expect(glyph.className).toInclude('glyphicon');
                expect(glyph.className).toInclude('glyphicon-list-alt');
                expect(glyph.getAttribute('aria-hidden')).toBe('true');
                done();
            });
        });
    });

    describe('heading slot', () => {
        it('renders the heading in .sv-empty-state-heading', (done) => {
            ReactDOM.render(<EmptyState heading="No scenarios yet" />, container, () => {
                const h = container.querySelector('.sv-empty-state-heading');
                expect(h).toExist();
                expect(h.textContent).toInclude('No scenarios yet');
                done();
            });
        });

        it('does NOT render a heading element when heading is absent', (done) => {
            ReactDOM.render(<EmptyState glyph="glyphicon-list-alt" />, container, () => {
                expect(container.querySelector('.sv-empty-state-heading')).toNotExist();
                done();
            });
        });
    });

    describe('subcopy (children) slot', () => {
        it('renders children in .sv-empty-state-subcopy', (done) => {
            ReactDOM.render(
                <EmptyState heading="x"><span className="sub">Create one to begin.</span></EmptyState>,
                container,
                () => {
                    const sub = container.querySelector('.sv-empty-state-subcopy');
                    expect(sub).toExist();
                    expect(sub.querySelector('.sub')).toExist();
                    done();
                }
            );
        });

        it('does NOT render a subcopy element when no children are passed', (done) => {
            ReactDOM.render(<EmptyState heading="x" />, container, () => {
                expect(container.querySelector('.sv-empty-state-subcopy')).toNotExist();
                done();
            });
        });
    });
});
