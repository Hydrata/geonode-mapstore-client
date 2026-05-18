import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioErrorStrip} from '../scenarioErrorStrip';

/**
 * TASK-C-scenarios-miller Wave 3A — render contract for the
 * ScenarioErrorStrip component. The strip is visible only when the
 * resolved scenario status is 'error'.
 */

describe('Wave 3A — ScenarioErrorStrip', () => {
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

    it('returns null when scenario is null', (done) => {
        ReactDOM.render(<ScenarioErrorStrip scenario={null} />, container, () => {
            expect(container.querySelector('.anuga-scenario-error-strip')).toNotExist();
            done();
        });
    });

    it('returns null when status is not error', (done) => {
        ReactDOM.render(
            <ScenarioErrorStrip scenario={{id: 1, status: 'built'}} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-error-strip')).toNotExist();
                done();
            }
        );
    });

    it('renders the head + error payload when status is error', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {error_message: 'ValueError: mesh validation failed'}
        };
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                const strip = container.querySelector('.anuga-scenario-error-strip');
                expect(strip).toExist();
                expect(strip.getAttribute('role')).toBe('alert');
                expect(container.querySelector('.anuga-scenario-error-strip-head')).toExist();
                const payload = container.querySelector('.anuga-scenario-error-strip-payload');
                expect(payload).toExist();
                expect(payload.textContent).toInclude('mesh validation failed');
                done();
            }
        );
    });

    it('falls back to the statusError message when latest_run has no error_message', (done) => {
        const s = {id: 1, status: 'error', latest_run: {}};
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-error-strip-payload')).toExist();
                done();
            }
        );
    });

    it('still renders when latest_run is missing entirely', (done) => {
        const s = {id: 1, status: 'error'};
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-error-strip')).toExist();
                done();
            }
        );
    });

    it('renders the error message as a code element when provided', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {error_message: 'Boom'}
        };
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                const code = container.querySelector('code.anuga-scenario-error-strip-payload');
                expect(code).toExist();
                expect(code.textContent).toBe('Boom');
                done();
            }
        );
    });
});
