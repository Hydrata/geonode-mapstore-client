import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import {Tooltip} from '../Tooltip';

/**
 * TASK-1682 (W2 UAT richness verdict): unit tests for the Tooltip primitive.
 *
 * Tooltip is presentation-only (no redux). It renders a focusable trigger tag
 * (label + optional info glyph) and reveals a positioned bubble on hover OR
 * keyboard focus — the 1549 lesson: a non-focusable tooltip is invisible to
 * keyboard users and untestable.
 *
 * Spec:
 *   - Renders .sv-tooltip-trigger with the label text, tabIndex=0
 *   - .sv-tooltip-bubble absent by default
 *   - mouseEnter shows the bubble (role="tooltip", children text); mouseLeave hides
 *   - focus shows the bubble; blur hides
 *   - aria-describedby on the trigger references the bubble id while visible
 *   - Escape dismisses while visible (WCAG 1.4.13)
 *   - placement="bottom" adds .is-bottom (default .is-top)
 */

describe('SimpleView Tooltip primitive (TASK-1682 W2)', () => {
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

    const renderTooltip = (props, cb) => {
        ReactDOM.render(
            <Tooltip label="DEM" {...props}>Digital Elevation Model</Tooltip>,
            container,
            cb
        );
    };

    // Simulate.mouseEnter does not route through React's EnterLeave plugin —
    // dispatch native events (repo precedent: VectorDrawPopupPickerTrash-test).
    const hoverIn = (el) => el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true, cancelable: true}));
    const hoverOut = (el) => el.dispatchEvent(new MouseEvent('mouseout', {bubbles: true, cancelable: true, relatedTarget: document.body}));

    // The ReactDOM.render callback runs inside React's commit batch: events
    // dispatched there enqueue updates that flush only after the callback
    // returns, so assertions would read stale DOM. Defer interactions out of
    // the batch before asserting.
    const afterRender = (props, fn, done) => {
        renderTooltip(props, () => {
            setTimeout(() => {
                fn();
                done();
            });
        });
    };

    describe('Base structure', () => {
        it('renders a focusable .sv-tooltip-trigger with the label', (done) => {
            renderTooltip({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                expect(trigger).toExist();
                expect(trigger.textContent).toContain('DEM');
                expect(trigger.tabIndex).toBe(0);
                done();
            });
        });

        it('renders the info glyph by default and hides it with showGlyph=false', (done) => {
            renderTooltip({}, () => {
                expect(container.querySelector('.sv-tooltip-glyph')).toExist();
                renderTooltip({showGlyph: false}, () => {
                    expect(container.querySelector('.sv-tooltip-glyph')).toNotExist();
                    done();
                });
            });
        });

        it('does not render the bubble by default', (done) => {
            renderTooltip({}, () => {
                expect(container.querySelector('.sv-tooltip-bubble')).toNotExist();
                done();
            });
        });
    });

    describe('Hover behaviour', () => {
        it('shows the bubble with the children text on mouseEnter, hides on mouseLeave', (done) => {
            afterRender({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                hoverIn(trigger);
                const bubble = container.querySelector('.sv-tooltip-bubble');
                expect(bubble).toExist();
                expect(bubble.getAttribute('role')).toBe('tooltip');
                expect(bubble.textContent).toContain('Digital Elevation Model');
                hoverOut(trigger);
                expect(container.querySelector('.sv-tooltip-bubble')).toNotExist();
            }, done);
        });
    });

    describe('Keyboard behaviour', () => {
        it('shows the bubble on focus and hides on blur', (done) => {
            afterRender({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                TestUtils.Simulate.focus(trigger);
                expect(container.querySelector('.sv-tooltip-bubble')).toExist();
                TestUtils.Simulate.blur(trigger);
                expect(container.querySelector('.sv-tooltip-bubble')).toNotExist();
            }, done);
        });

        it('dismisses on Escape while visible', (done) => {
            afterRender({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                TestUtils.Simulate.focus(trigger);
                expect(container.querySelector('.sv-tooltip-bubble')).toExist();
                TestUtils.Simulate.keyDown(trigger, {key: 'Escape'});
                expect(container.querySelector('.sv-tooltip-bubble')).toNotExist();
            }, done);
        });
    });

    describe('ARIA wiring', () => {
        it('sets aria-describedby to the bubble id while visible, clears when hidden', (done) => {
            afterRender({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                expect(trigger.getAttribute('aria-describedby')).toNotExist();
                hoverIn(trigger);
                const bubble = container.querySelector('.sv-tooltip-bubble');
                expect(bubble.id).toExist();
                expect(trigger.getAttribute('aria-describedby')).toBe(bubble.id);
                hoverOut(trigger);
                expect(trigger.getAttribute('aria-describedby')).toNotExist();
            }, done);
        });
    });

    describe('Placement', () => {
        it('defaults to .is-top and honours placement="bottom"', (done) => {
            afterRender({}, () => {
                const trigger = container.querySelector('.sv-tooltip-trigger');
                hoverIn(trigger);
                expect(container.querySelector('.sv-tooltip-bubble.is-top')).toExist();
            }, () => {
                afterRender({placement: 'bottom'}, () => {
                    // same instance re-rendered: visible state persists
                    expect(container.querySelector('.sv-tooltip-bubble.is-bottom')).toExist();
                }, done);
            });
        });
    });
});
