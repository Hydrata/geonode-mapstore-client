import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {PanelHeader} from '../PanelHeader';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the PanelHeader chassis primitive.
 *
 * PanelHeader is the panel title bar with optional close chip + actions.
 * It is presentation-only.
 *
 * Spec:
 *   - Renders a div.sv-panel-header
 *   - title renders as .sv-panel-header-title h4
 *   - onClose renders a .sv-panel-header-close button
 *   - CRITICAL: close chip has position:static (not absolute) — cascade-trap safety
 *   - No close button when onClose is not provided
 *   - children render in .sv-panel-header-actions
 *   - extraClassName is carried alongside sv-panel-header
 *   - style prop is merged
 */

describe('SimpleView PanelHeader chassis primitive (TASK-1759)', () => {
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
        it('renders a div.sv-panel-header', (done) => {
            ReactDOM.render(<PanelHeader title="Scenarios" />, container, () => {
                const el = container.querySelector('.sv-panel-header');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('renders the title text in .sv-panel-header-title', (done) => {
            ReactDOM.render(<PanelHeader title="Terrain Inputs" />, container, () => {
                const title = container.querySelector('.sv-panel-header-title');
                expect(title).toExist();
                expect(title.textContent).toInclude('Terrain Inputs');
                done();
            });
        });

        it('does NOT render a title element when title prop is absent', (done) => {
            ReactDOM.render(<PanelHeader />, container, () => {
                expect(container.querySelector('.sv-panel-header-title')).toNotExist();
                done();
            });
        });

        it('carries extraClassName alongside sv-panel-header', (done) => {
            ReactDOM.render(<PanelHeader title="T" extraClassName="sv-tm-header" />, container, () => {
                const el = container.querySelector('.sv-panel-header');
                expect(el.className).toInclude('sv-tm-header');
                done();
            });
        });
    });

    describe('Close chip', () => {
        it('renders .sv-panel-header-close button when onClose is provided', (done) => {
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                expect(btn).toExist();
                expect(btn.tagName).toBe('BUTTON');
                done();
            });
        });

        it('does NOT render a close button when onClose is absent', (done) => {
            ReactDOM.render(<PanelHeader title="T" />, container, () => {
                expect(container.querySelector('.sv-panel-header-close')).toNotExist();
                done();
            });
        });

        it('CRITICAL: close chip is corner-anchored (absolute top/right 2px) with reserved header padding', (done) => {
            // TASK-2235 r2 (operator): the chip hugs the panel's top-right corner
            // at exactly 2px, matching the Task Manager chip. The historic
            // cascade-trap concern (an absolute chip overlapping the title) is
            // neutralised structurally: the header reserves padding-right for
            // the chip whenever onClose renders.
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                expect(btn).toExist();
                expect(btn.style.position).toBe('absolute');
                expect(btn.style.top).toBe('2px');
                expect(btn.style.right).toBe('2px');
                const header = container.querySelector('.sv-panel-header');
                expect(header.style.paddingRight).toInclude('--sv-icon-size');
                done();
            });
        });

        it('close chip does NOT have class sv-legend-close (avoids cascade trap at class level)', (done) => {
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                expect(btn.className).toNotInclude('sv-legend-close');
                done();
            });
        });

        it('calls onClose when the close button is clicked', (done) => {
            let called = false;
            ReactDOM.render(<PanelHeader title="T" onClose={() => { called = true; }} />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                btn.click();
                setTimeout(() => {
                    expect(called).toBe(true);
                    done();
                });
            });
        });

        it('uses the closeLabel prop as aria-label when provided', (done) => {
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} closeLabel="Close scenarios" />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                expect(btn.getAttribute('aria-label')).toBe('Close scenarios');
                done();
            });
        });

        it('defaults aria-label to "Close panel" when closeLabel is absent', (done) => {
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const btn = container.querySelector('.sv-panel-header-close');
                expect(btn.getAttribute('aria-label')).toBe('Close panel');
                done();
            });
        });
    });

    describe('Actions slot', () => {
        it('renders children in .sv-panel-header-actions when children are provided', (done) => {
            ReactDOM.render(
                <PanelHeader title="T">
                    <button className="new-btn">+ New</button>
                </PanelHeader>,
                container,
                () => {
                    const actions = container.querySelector('.sv-panel-header-actions');
                    expect(actions).toExist();
                    expect(actions.querySelector('.new-btn')).toExist();
                    done();
                }
            );
        });

        it('does NOT render actions when children are absent', (done) => {
            ReactDOM.render(<PanelHeader title="T" />, container, () => {
                expect(container.querySelector('.sv-panel-header-actions')).toNotExist();
                done();
            });
        });
    });

    // TASK-2235 — the close chip adopts the RED close convention (matching the
    // Task Manager .sv-legend-close chip), reversing the W1.9 translucent chip
    // on operator instruction (2026-07-13). r2: same glyphicon-remove cross as
    // the Task Manager (the thin &times; entity read too small), corner-anchored
    // at 2px (asserted in the CRITICAL positioning spec above).
    describe('Close chip red convention (TASK-2235)', () => {
        it('close chip carries the red close-bg token + the Task-Manager glyphicon cross', (done) => {
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const chip = container.querySelector('.sv-panel-header-close');
                expect(chip).toExist();
                expect(chip.style.backgroundColor).toInclude('--sv-close-bg');
                expect(chip.querySelector('.glyphicon.glyphicon-remove')).toExist();
                done();
            });
        });

        it('hover swaps to the hover token and restores on leave', (done) => {
            // Simulate drives the synthetic onMouseEnter/onMouseLeave handlers
            // directly — native mouseover does not reliably reach React 16's
            // enter/leave synthesis in the test harness.
            const TestUtils = require('react-dom/test-utils');
            ReactDOM.render(<PanelHeader title="T" onClose={() => {}} />, container, () => {
                const chip = container.querySelector('.sv-panel-header-close');
                TestUtils.Simulate.mouseEnter(chip);
                expect(chip.style.backgroundColor).toInclude('--sv-close-bg-hover');
                TestUtils.Simulate.mouseLeave(chip);
                expect(chip.style.backgroundColor).toInclude('--sv-close-bg');
                expect(chip.style.backgroundColor).toExclude('--sv-close-bg-hover');
                done();
            });
        });
    });
});
