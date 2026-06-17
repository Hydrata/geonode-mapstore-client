import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Card} from '../Card';

/**
 * TASK-1759 (epic-1758 P0): unit tests for the Card chassis primitive.
 *
 * Card is the dark-glass content card. Supports variant="chart" for the
 * TASK-1534 chart-carve-out (light body surface for recharts). Presentation-only.
 *
 * Spec:
 *   - Renders a div.sv-card
 *   - Default variant: dark-glass card
 *   - variant="chart" adds sv-card--chart + body uses --sv-chart-surface (light)
 *   - variant="dashed" adds sv-card--dashed
 *   - variant="info" adds sv-card--info
 *   - title renders as .sv-card-header
 *   - No header when title is absent
 *   - children render in .sv-card-body
 *   - extraClassName is carried
 *   - style prop is merged on the frame
 *   - bodyStyle prop is merged on the body
 */

describe('SimpleView Card chassis primitive (TASK-1759)', () => {
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
        it('renders a div.sv-card', (done) => {
            ReactDOM.render(<Card />, container, () => {
                const el = container.querySelector('.sv-card');
                expect(el).toExist();
                expect(el.tagName).toBe('DIV');
                done();
            });
        });

        it('renders children inside .sv-card-body', (done) => {
            ReactDOM.render(
                <Card><span className="body-child">hello</span></Card>,
                container,
                () => {
                    expect(container.querySelector('.body-child')).toExist();
                    done();
                }
            );
        });

        it('renders .sv-card-header when title is provided', (done) => {
            ReactDOM.render(<Card title="Status" />, container, () => {
                const header = container.querySelector('.sv-card-header');
                expect(header).toExist();
                expect(header.textContent).toInclude('Status');
                done();
            });
        });

        it('does NOT render .sv-card-header when title is absent', (done) => {
            ReactDOM.render(<Card />, container, () => {
                expect(container.querySelector('.sv-card-header')).toNotExist();
                done();
            });
        });

        it('carries extraClassName alongside sv-card', (done) => {
            ReactDOM.render(<Card extraClassName="anuga-scenario-status-card" />, container, () => {
                const el = container.querySelector('.sv-card');
                expect(el.className).toInclude('anuga-scenario-status-card');
                done();
            });
        });
    });

    describe('Chart carve-out (grill q-1 / TASK-1534)', () => {
        it('variant="chart" adds sv-card--chart class', (done) => {
            ReactDOM.render(<Card variant="chart" />, container, () => {
                const el = container.querySelector('.sv-card--chart');
                expect(el).toExist();
                done();
            });
        });

        it('variant="chart" body uses --sv-chart-surface token (LIGHT surface for recharts)', (done) => {
            ReactDOM.render(<Card variant="chart"><span>chart</span></Card>, container, () => {
                const body = container.querySelector('.sv-card-body');
                expect(body).toExist();
                // The body background must reference --sv-chart-surface (light)
                const styleAttr = body.getAttribute('style') || '';
                expect(styleAttr).toInclude('--sv-chart-surface');
                done();
            });
        });

        it('default variant does NOT apply --sv-chart-surface to the body', (done) => {
            ReactDOM.render(<Card><span>content</span></Card>, container, () => {
                const body = container.querySelector('.sv-card-body');
                const styleAttr = (body && body.getAttribute('style')) || '';
                expect(styleAttr).toNotInclude('--sv-chart-surface');
                done();
            });
        });

        it('variant="chart" title renders in .sv-card-header (dark frame)', (done) => {
            ReactDOM.render(<Card variant="chart" title="IDF Curve" />, container, () => {
                const header = container.querySelector('.sv-card-header');
                expect(header).toExist();
                expect(header.textContent).toInclude('IDF Curve');
                done();
            });
        });
    });

    describe('Other variants', () => {
        it('variant="dashed" adds sv-card--dashed', (done) => {
            ReactDOM.render(<Card variant="dashed" />, container, () => {
                const el = container.querySelector('.sv-card--dashed');
                expect(el).toExist();
                done();
            });
        });

        it('variant="info" adds sv-card--info', (done) => {
            ReactDOM.render(<Card variant="info" />, container, () => {
                const el = container.querySelector('.sv-card--info');
                expect(el).toExist();
                done();
            });
        });
    });

    describe('Style props', () => {
        it('merges the style prop on the card frame', (done) => {
            ReactDOM.render(<Card style={{ margin: '12px 0' }} />, container, () => {
                const el = container.querySelector('.sv-card');
                const styleAttr = el.getAttribute('style') || '';
                expect(styleAttr).toInclude('12px');
                done();
            });
        });

        it('merges bodyStyle on the card body', (done) => {
            ReactDOM.render(<Card bodyStyle={{ padding: '20px' }} />, container, () => {
                const body = container.querySelector('.sv-card-body');
                const styleAttr = (body && body.getAttribute('style')) || '';
                expect(styleAttr).toInclude('20px');
                done();
            });
        });
    });
});
