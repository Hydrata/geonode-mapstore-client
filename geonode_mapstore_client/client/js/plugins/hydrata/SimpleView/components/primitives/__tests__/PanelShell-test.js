import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {PanelShell} from '../PanelShell';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the PanelShell chassis primitive.
 *
 * PanelShell is the outer dark-glass panel container. It is presentation-only.
 *
 * Spec:
 *   - Renders a div.sv-panel-shell
 *   - Uses token-backed inline styles (position, backgroundColor)
 *   - Default position is 'absolute'
 *   - position='fixed-right' sets position:fixed, right:0
 *   - extraClassName is carried alongside sv-panel-shell
 *   - style prop is merged over defaults
 *   - Children are rendered inside
 */

describe('SimpleView PanelShell chassis primitive (TASK-1759)', () => {
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
        it('renders a div.sv-panel-shell', (done) => {
            ReactDOM.render(<PanelShell />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('renders children inside the shell', (done) => {
            ReactDOM.render(
                <PanelShell><span className="child-test">Hello</span></PanelShell>,
                container,
                () => {
                    expect(container.querySelector('.child-test')).toExist();
                    done();
                }
            );
        });

        it('carries extraClassName alongside sv-panel-shell', (done) => {
            ReactDOM.render(<PanelShell extraClassName="anuga-panel" />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                expect(el.className).toInclude('sv-panel-shell');
                expect(el.className).toInclude('anuga-panel');
                done();
            });
        });
    });

    describe('Token-backed styling', () => {
        it('uses the --sv-panel-bg token as backgroundColor (inline style)', (done) => {
            ReactDOM.render(<PanelShell />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('--sv-panel-bg');
                done();
            });
        });

        it('default position is absolute', (done) => {
            ReactDOM.render(<PanelShell />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('absolute');
                done();
            });
        });
    });

    describe('position prop', () => {
        it('position="fixed-right" sets position:fixed in inline style', (done) => {
            ReactDOM.render(<PanelShell position="fixed-right" />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('fixed');
                done();
            });
        });

        it('position="absolute" (default) sets position:absolute', (done) => {
            ReactDOM.render(<PanelShell position="absolute" />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('absolute');
                done();
            });
        });
    });

    describe('style prop pass-through', () => {
        it('merges the style prop over the defaults', (done) => {
            ReactDOM.render(<PanelShell style={{ width: '640px' }} />, container, () => {
                const el = container.querySelector('.sv-panel-shell');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('640px');
                done();
            });
        });
    });
});
