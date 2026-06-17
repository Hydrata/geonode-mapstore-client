import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioErrorStrip} from '../scenarioErrorStrip';

/**
 * TASK-C-scenarios-miller Wave 3A — render contract for the
 * ScenarioErrorStrip component. The strip is visible only when the
 * resolved scenario status is 'error'.
 *
 * TASK-1730 (Phase-C parity migration) — the strip now renders through the
 * shared {ErrorStrip} primitive. The outer `.sv-anuga-scenario-error-strip`
 * class + `role="alert"` are preserved (via `extraClassName`); the inner
 * head/payload hooks canonicalised from `.sv-anuga-scenario-error-strip-head/
 * -payload` to the primitive's `.sv-error-strip-head/-payload`. These specs
 * assert BOTH the preserved outer hook AND the canonical inner hooks so the
 * structural parity is pinned.
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
            expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
            done();
        });
    });

    it('returns null when status is not error', (done) => {
        ReactDOM.render(
            <ScenarioErrorStrip scenario={{id: 1, status: 'built'}} />,
            container,
            () => {
                expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
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
                const strip = container.querySelector('.sv-anuga-scenario-error-strip');
                expect(strip).toExist();
                expect(strip.getAttribute('role')).toBe('alert');
                // Canonical: the shared primitive carries the sv-error-strip hook too.
                expect(strip.className).toInclude('sv-error-strip');
                expect(container.querySelector('.sv-error-strip-head')).toExist();
                const payload = container.querySelector('.sv-error-strip-payload');
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
                expect(container.querySelector('.sv-error-strip-payload')).toExist();
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
                expect(container.querySelector('.sv-anuga-scenario-error-strip')).toExist();
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
                const code = container.querySelector('code.sv-error-strip-payload');
                expect(code).toExist();
                expect(code.textContent).toBe('Boom');
                done();
            }
        );
    });
});
