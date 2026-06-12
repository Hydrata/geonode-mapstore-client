import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {LogViewer} from '../LogViewer';

/**
 * TASK-1664 W2: unit tests for the LogViewer primitive.
 *
 * LogViewer is a terminal-style <pre> that auto-scrolls to the bottom when
 * the log prop changes. Presentation-only.
 */

describe('SimpleView LogViewer primitive (TASK-1664 W2)', () => {
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

    describe('Structure', () => {
        it('renders a <pre> element with class sv-log-viewer', (done) => {
            ReactDOM.render(<LogViewer log="hello" />, container, () => {
                const pre = container.querySelector('pre.sv-log-viewer');
                expect(pre).toExist();
                done();
            });
        });
    });

    describe('Content rendering', () => {
        it('renders the log text when provided', (done) => {
            ReactDOM.render(<LogViewer log="Line 1\nLine 2" />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('Line 1');
                expect(pre.textContent).toInclude('Line 2');
                done();
            });
        });

        it('renders the default placeholder when log is null', (done) => {
            ReactDOM.render(<LogViewer log={null} />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('(no log output)');
                done();
            });
        });

        it('renders the default placeholder when log is empty string', (done) => {
            ReactDOM.render(<LogViewer log="" />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('(no log output)');
                done();
            });
        });

        it('renders the custom emptyText prop when log is null', (done) => {
            ReactDOM.render(<LogViewer log={null} emptyText="No output yet" />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('No output yet');
                expect(pre.textContent).toNotInclude('(no log output)');
                done();
            });
        });
    });
});
