import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {SectionHeader} from '../SectionHeader';

/**
 * TASK-1008 W4: render tests for the SectionHeader primitive.
 *
 * The primitive is presentation-only (no redux). It wraps children in a
 * `.row.sv-menu-row.sv-menu-row-header` div with optional `extraClassName` and
 * optional inline `style`. The polish_2026_05_18 chore dropped all orphan
 * props (role/tabIndex/onClick/onKeyDown/title/count/group), so the
 * contract surface is exactly {children, extraClassName, style}.
 */

describe('SimpleView SectionHeader primitive (TASK-1007 W3, tested in W4)', () => {
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

    describe('Class-name contract', () => {
        it('renders the base class `row sv-menu-row sv-menu-row-header` with no extras', (done) => {
            ReactDOM.render(<SectionHeader/>, container, () => {
                const div = container.firstChild;
                expect(div.tagName).toBe('DIV');
                expect(div.className).toBe('row sv-menu-row sv-menu-row-header');
                done();
            });
        });

        it('appends extraClassName separated by a single space', (done) => {
            ReactDOM.render(
                <SectionHeader extraClassName="sv-anuga-section-header"/>,
                container,
                () => {
                    expect(container.firstChild.className)
                        .toBe('row sv-menu-row sv-menu-row-header sv-anuga-section-header');
                    done();
                }
            );
        });

        it('does NOT append a trailing space when extraClassName is an empty string (falsy)', (done) => {
            ReactDOM.render(<SectionHeader extraClassName=""/>, container, () => {
                expect(container.firstChild.className).toBe('row sv-menu-row sv-menu-row-header');
                done();
            });
        });

        it('does NOT append anything when extraClassName is undefined', (done) => {
            ReactDOM.render(<SectionHeader extraClassName={undefined}/>, container, () => {
                expect(container.firstChild.className).toBe('row sv-menu-row sv-menu-row-header');
                done();
            });
        });
    });

    describe('Children rendering', () => {
        it('renders a single child inside the header div', (done) => {
            ReactDOM.render(
                <SectionHeader><span className="kid"/></SectionHeader>,
                container,
                () => {
                    const div = container.firstChild;
                    expect(div.children.length).toBe(1);
                    expect(div.querySelector('.kid')).toExist();
                    done();
                }
            );
        });

        it('renders multiple children in source order', (done) => {
            ReactDOM.render(
                <SectionHeader>
                    <span className="a"/>
                    <span className="b"/>
                </SectionHeader>,
                container,
                () => {
                    const div = container.firstChild;
                    expect(div.children.length).toBe(2);
                    expect(div.children[0].className).toBe('a');
                    expect(div.children[1].className).toBe('b');
                    done();
                }
            );
        });

        it('renders without throwing when no children are passed', (done) => {
            ReactDOM.render(<SectionHeader/>, container, () => {
                const div = container.firstChild;
                expect(div).toExist();
                expect(div.children.length).toBe(0);
                done();
            });
        });
    });

    describe('Style pass-through', () => {
        it('applies a single inline style property', (done) => {
            ReactDOM.render(
                <SectionHeader style={{width: '180px'}}/>,
                container,
                () => {
                    expect(container.firstChild.style.width).toBe('180px');
                    done();
                }
            );
        });

        it('applies multiple inline style properties', (done) => {
            ReactDOM.render(
                <SectionHeader style={{width: '180px', background: 'red'}}/>,
                container,
                () => {
                    const div = container.firstChild;
                    expect(div.style.width).toBe('180px');
                    expect(div.style.background).toBe('red');
                    done();
                }
            );
        });

        it('renders with no inline width when style prop is omitted', (done) => {
            ReactDOM.render(<SectionHeader/>, container, () => {
                expect(container.firstChild.style.width).toBe('');
                done();
            });
        });
    });

    describe('Combined contract (extraClassName + style + children)', () => {
        it('honours all three props together', (done) => {
            ReactDOM.render(
                <SectionHeader extraClassName="x" style={{width: '180px'}}>
                    <h5>title</h5>
                </SectionHeader>,
                container,
                () => {
                    const div = container.firstChild;
                    expect(div.className).toBe('row sv-menu-row sv-menu-row-header x');
                    expect(div.style.width).toBe('180px');
                    const h5 = div.querySelector('h5');
                    expect(h5).toExist();
                    expect(h5.textContent).toBe('title');
                    done();
                }
            );
        });
    });
});
