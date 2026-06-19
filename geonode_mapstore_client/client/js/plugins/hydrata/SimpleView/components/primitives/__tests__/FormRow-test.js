import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormRow} from '../FormRow';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the FormRow chassis primitive.
 *
 * FormRow is a label + control row for dark-glass forms. Presentation-only.
 *
 * Spec:
 *   - Renders a div.sv-form-row
 *   - Default layout="inline" adds sv-form-row--inline
 *   - layout="stacked" adds sv-form-row--stacked
 *   - label renders as .sv-form-row-label (span inline / label stacked)
 *   - children render in .sv-form-row-field
 *   - hint renders as .sv-form-row-hint
 *   - divider adds border-bottom to inline style
 *   - extraClassName is carried
 *   - style prop is merged
 *   - labelWidth overrides the 130px label column
 */

describe('SimpleView FormRow chassis primitive (TASK-1759)', () => {
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
        it('renders a div.sv-form-row', (done) => {
            ReactDOM.render(<FormRow label="Name" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('renders children inside .sv-form-row-field', (done) => {
            ReactDOM.render(
                <FormRow label="DEM"><input className="test-input" /></FormRow>,
                container,
                () => {
                    const field = container.querySelector('.sv-form-row-field');
                    expect(field).toExist();
                    expect(field.querySelector('.test-input')).toExist();
                    done();
                }
            );
        });

        it('renders the label in .sv-form-row-label', (done) => {
            ReactDOM.render(<FormRow label="Duration" />, container, () => {
                const label = container.querySelector('.sv-form-row-label');
                expect(label).toExist();
                expect(label.textContent).toInclude('Duration');
                done();
            });
        });

        it('does NOT render a label element when label prop is absent', (done) => {
            ReactDOM.render(<FormRow><input /></FormRow>, container, () => {
                expect(container.querySelector('.sv-form-row-label')).toNotExist();
                done();
            });
        });

        it('carries extraClassName alongside sv-form-row', (done) => {
            ReactDOM.render(<FormRow label="T" extraClassName="sv-anuga-scenario-pane-section" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                expect(el.className).toInclude('sv-anuga-scenario-pane-section');
                done();
            });
        });
    });

    describe('Layout variants', () => {
        it('default layout="inline" adds sv-form-row--inline', (done) => {
            ReactDOM.render(<FormRow label="T" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                expect(el.className).toInclude('sv-form-row--inline');
                done();
            });
        });

        it('default layout does NOT add sv-form-row--stacked', (done) => {
            ReactDOM.render(<FormRow label="T" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                expect(el.className).toNotInclude('sv-form-row--stacked');
                done();
            });
        });

        it('layout="stacked" adds sv-form-row--stacked', (done) => {
            ReactDOM.render(<FormRow label="T" layout="stacked" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                expect(el.className).toInclude('sv-form-row--stacked');
                done();
            });
        });

        it('stacked layout uses a <label> element (not a <span>) for the label', (done) => {
            ReactDOM.render(<FormRow label="Latitude" layout="stacked" />, container, () => {
                const label = container.querySelector('label.sv-form-row-label');
                expect(label).toExist();
                done();
            });
        });

        it('inline layout uses a <span> element for the label', (done) => {
            ReactDOM.render(<FormRow label="Duration" />, container, () => {
                const span = container.querySelector('span.sv-form-row-label');
                expect(span).toExist();
                done();
            });
        });
    });

    describe('divider prop', () => {
        it('divider=true adds border-bottom to inline style', (done) => {
            ReactDOM.render(<FormRow label="T" divider />, container, () => {
                const el = container.querySelector('.sv-form-row');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('border-bottom');
                done();
            });
        });

        it('divider=false (default) does NOT add border-bottom', (done) => {
            ReactDOM.render(<FormRow label="T" />, container, () => {
                const el = container.querySelector('.sv-form-row');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toNotInclude('border-bottom');
                done();
            });
        });
    });

    describe('hint prop', () => {
        it('renders .sv-form-row-hint when hint is provided', (done) => {
            ReactDOM.render(<FormRow label="T" hint="e.g. 15,30,60" />, container, () => {
                const hint = container.querySelector('.sv-form-row-hint');
                expect(hint).toExist();
                expect(hint.textContent).toInclude('e.g. 15,30,60');
                done();
            });
        });

        it('does NOT render hint when hint is absent', (done) => {
            ReactDOM.render(<FormRow label="T" />, container, () => {
                expect(container.querySelector('.sv-form-row-hint')).toNotExist();
                done();
            });
        });
    });

    describe('style + labelWidth props', () => {
        it('merges the style prop over defaults', (done) => {
            ReactDOM.render(<FormRow label="T" style={{ marginTop: '8px' }} />, container, () => {
                const el = container.querySelector('.sv-form-row');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('8px');
                done();
            });
        });
    });
});
