import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ErrorStrip} from '../ErrorStrip';

/**
 * TASK-1732 (epic 1673 Phase 0): unit tests for the ErrorStrip primitive.
 *
 * ErrorStrip is presentation-only (no redux). It is the shared, token-backed
 * red-left-border alert strip pulled from the ≥6 divergent per-panel error
 * blocks (anuga-scenario-error-strip, sv-menu-row-delete-error, sv-tm-error-message,
 * tw-error, hgeval alert-danger, idf-derive-error).
 *
 * Spec:
 *   - Renders nothing when there is no message, no children and no items
 *   - When it renders: a div.sv-error-strip with role="alert"
 *   - `head` renders an uppercase .sv-error-strip-head
 *   - `children` OR `message` renders a .sv-error-strip-message body
 *   - `payload` renders a monospace <code>.sv-error-strip-payload
 *   - `items` renders a .sv-error-strip-list with one <li> per item
 *   - is token-backed: the danger colour is composed from a var(--sv-text-danger…) token
 */

describe('SimpleView ErrorStrip primitive (TASK-1732)', () => {
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

    describe('Empty / render-guard', () => {
        it('renders nothing when message, children, payload and items are all absent', (done) => {
            ReactDOM.render(<ErrorStrip />, container, () => {
                expect(container.querySelector('.sv-error-strip')).toNotExist();
                done();
            });
        });

        it('renders the strip when only a message is supplied', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" />, container, () => {
                expect(container.querySelector('.sv-error-strip')).toExist();
                done();
            });
        });
    });

    describe('Base structure', () => {
        it('renders a div.sv-error-strip with role="alert"', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" />, container, () => {
                const el = container.querySelector('.sv-error-strip');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                expect(el.getAttribute('role')).toBe('alert');
                done();
            });
        });

        it('is token-backed: inline colour composes the --sv-text-danger token', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" />, container, () => {
                const el = container.querySelector('.sv-error-strip');
                // jsdom/headless preserves the raw var() expression in cssText
                expect((el.getAttribute('style') || '')).toInclude('--sv-text-danger');
                done();
            });
        });

        it('carries an extraClassName when provided', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" extraClassName="tw-error" />, container, () => {
                const el = container.querySelector('.sv-error-strip');
                expect(el.className).toInclude('tw-error');
                done();
            });
        });
    });

    describe('head slot', () => {
        it('does NOT render a head by default', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" />, container, () => {
                expect(container.querySelector('.sv-error-strip-head')).toNotExist();
                done();
            });
        });

        it('renders the head text in .sv-error-strip-head when head is supplied', (done) => {
            ReactDOM.render(<ErrorStrip head="Run failed" message="Boom" />, container, () => {
                const head = container.querySelector('.sv-error-strip-head');
                expect(head).toExist();
                expect(head.textContent).toInclude('Run failed');
                done();
            });
        });
    });

    describe('message / children body', () => {
        it('renders the message prop in .sv-error-strip-message', (done) => {
            ReactDOM.render(<ErrorStrip message="Disk full" />, container, () => {
                const body = container.querySelector('.sv-error-strip-message');
                expect(body).toExist();
                expect(body.textContent).toInclude('Disk full');
                done();
            });
        });

        it('renders children in the body when no message prop is given', (done) => {
            ReactDOM.render(<ErrorStrip><span className="child">From children</span></ErrorStrip>, container, () => {
                const body = container.querySelector('.sv-error-strip-message');
                expect(body).toExist();
                expect(body.querySelector('.child')).toExist();
                done();
            });
        });
    });

    describe('payload slot', () => {
        it('renders the payload as a monospace <code>.sv-error-strip-payload', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" payload="Traceback (most recent call last)" />, container, () => {
                const code = container.querySelector('code.sv-error-strip-payload');
                expect(code).toExist();
                expect(code.textContent).toInclude('Traceback');
                done();
            });
        });

        it('does NOT render a payload when payload is absent', (done) => {
            ReactDOM.render(<ErrorStrip message="Boom" />, container, () => {
                expect(container.querySelector('.sv-error-strip-payload')).toNotExist();
                done();
            });
        });
    });

    describe('items list', () => {
        it('renders one <li> per item in .sv-error-strip-list', (done) => {
            ReactDOM.render(<ErrorStrip message="Blocked by" items={['Scenario A', 'Scenario B']} />, container, () => {
                const list = container.querySelector('.sv-error-strip-list');
                expect(list).toExist();
                expect(list.querySelectorAll('li').length).toBe(2);
                done();
            });
        });

        it('renders the strip from items alone (no message/children)', (done) => {
            ReactDOM.render(<ErrorStrip items={['Only this']} />, container, () => {
                expect(container.querySelector('.sv-error-strip')).toExist();
                expect(container.querySelectorAll('.sv-error-strip-list li').length).toBe(1);
                done();
            });
        });
    });
});
