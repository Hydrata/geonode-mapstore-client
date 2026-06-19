import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Section} from '../Section';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the Section chassis primitive.
 *
 * Section is a titled content section with a border divider. Presentation-only.
 *
 * Spec:
 *   - Renders a div.sv-section
 *   - Default variant 'default' adds sv-section (no extra modifier class)
 *   - variant='boxed' adds sv-section--boxed
 *   - title renders as .sv-section-title
 *   - No title element when title is absent
 *   - Children are rendered inside
 *   - extraClassName is carried alongside sv-section
 *   - Inline style is token-backed (--sv-section-border, --sv-section-gap)
 */

describe('SimpleView Section chassis primitive (TASK-1759)', () => {
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
        it('renders a div.sv-section', (done) => {
            ReactDOM.render(<Section title="Status" />, container, () => {
                const el = container.querySelector('.sv-section');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('renders the title in .sv-section-title', (done) => {
            ReactDOM.render(<Section title="Run Details" />, container, () => {
                const title = container.querySelector('.sv-section-title');
                expect(title).toExist();
                expect(title.textContent).toInclude('Run Details');
                done();
            });
        });

        it('does NOT render a title element when title prop is absent', (done) => {
            ReactDOM.render(<Section><p>body</p></Section>, container, () => {
                expect(container.querySelector('.sv-section-title')).toNotExist();
                done();
            });
        });

        it('renders children inside the section', (done) => {
            ReactDOM.render(
                <Section title="T"><span className="body-node">content</span></Section>,
                container,
                () => {
                    expect(container.querySelector('.body-node')).toExist();
                    done();
                }
            );
        });

        it('carries extraClassName alongside sv-section', (done) => {
            ReactDOM.render(<Section title="T" extraClassName="sv-anuga-section" />, container, () => {
                const el = container.querySelector('.sv-section');
                expect(el.className).toInclude('sv-anuga-section');
                done();
            });
        });
    });

    describe('Variants', () => {
        it('default variant renders only sv-section (no modifier)', (done) => {
            ReactDOM.render(<Section title="T" />, container, () => {
                const el = container.querySelector('.sv-section');
                // default: should NOT have sv-section--default (which is variant "default" stripped)
                expect(el.className.trim()).toNotInclude('sv-section--default');
                done();
            });
        });

        it('variant="boxed" adds sv-section--boxed', (done) => {
            ReactDOM.render(<Section title="T" variant="boxed" />, container, () => {
                const el = container.querySelector('.sv-section');
                expect(el.className).toInclude('sv-section--boxed');
                done();
            });
        });

        it('boxed variant uses --sv-section-border token in inline style', (done) => {
            ReactDOM.render(<Section title="T" variant="boxed" />, container, () => {
                const el = container.querySelector('.sv-section');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('--sv-section-border');
                done();
            });
        });
    });

    describe('Style pass-through', () => {
        it('merges the style prop over the defaults', (done) => {
            ReactDOM.render(<Section title="T" style={{ paddingTop: '20px' }} />, container, () => {
                const el = container.querySelector('.sv-section');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('20px');
                done();
            });
        });
    });
});
