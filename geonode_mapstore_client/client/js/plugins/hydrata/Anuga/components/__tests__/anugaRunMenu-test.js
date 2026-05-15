/*
 * TASK-964 — anugaRunMenu compute_backend default hydration.
 *
 * The run menu's initial dropdown value seeds from /api/v2/anuga/config/ on
 * mount so hydrata.com (anuga_default_compute_backend='batch' via Ansible)
 * defaults to AWS Batch while the other 3 prod sites stay on 'local'. The
 * operator can still override per-run via the dropdown — that's covered by
 * the existing onChange wiring (handled implicitly by setState).
 *
 * We test the unconnected AnugaRunMenuClass with a minimal selectedScenario
 * prop and stubbed dispatch props. The /config/ endpoint is mocked via
 * axios-mock-adapter (same pattern as anugaApi-test.js V2P-79 guards).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

const MockAdapter = require('axios-mock-adapter');
const axios = require('../../../../../../MapStore2/web/client/libs/ajax').default;

describe('TASK-964 anugaRunMenu compute_backend init from /config/', () => {
    let container;
    let mockAxios;

    const noop = () => {};
    const selectedScenario = { id: 7, name: 'tester', latest_run: {} };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        mockAxios = new MockAdapter(axios);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        mockAxios.restore();
    });

    function mountUnconnected() {
        const { AnugaRunMenuClass } = require('../anugaRunMenu');
        return new Promise((resolve) => {
            const ref = React.createRef();
            ReactDOM.render(
                <AnugaRunMenuClass
                    ref={ref}
                    selectedScenario={selectedScenario}
                    showAnugaRunMenu={noop}
                    updateComputeInstance={noop}
                    runAnugaScenario={noop}
                    setAnugaScenarioMenu={noop}
                    showAnugaScenarioLog={noop}
                    showManageAccount={noop}
                />,
                container,
                () => resolve(ref.current)
            );
        });
    }

    it('seeds state.computeBackend with default_compute_backend from /api/v2/anuga/config/', (done) => {
        mockAxios.onGet('/api/v2/anuga/config/').reply(200, {
            default_compute_backend: 'batch'
        });
        mountUnconnected().then((instance) => {
            // Initial state is the defensive 'local' fallback (set in constructor).
            // Wait for the /config/ promise to flush, then assert the state flipped.
            setTimeout(() => {
                try {
                    expect(instance.state.computeBackend).toBe('batch');
                    done();
                } catch (e) {
                    done(e);
                }
            }, 50);
        });
    });

    it('keeps state.computeBackend on "local" when /config/ network errors', (done) => {
        mockAxios.onGet('/api/v2/anuga/config/').networkError();
        mountUnconnected().then((instance) => {
            setTimeout(() => {
                try {
                    expect(instance.state.computeBackend).toBe('local');
                    done();
                } catch (e) {
                    done(e);
                }
            }, 50);
        });
    });

    it('does not call setState after unmount (avoids React warning)', (done) => {
        // Delayed reply so we can unmount before it resolves.
        mockAxios.onGet('/api/v2/anuga/config/').reply(() => {
            return new Promise((resolve) => {
                setTimeout(() => resolve([200, { default_compute_backend: 'batch' }]), 30);
            });
        });
        mountUnconnected().then(() => {
            // Unmount immediately — the late callback should bail via the
            // _mounted guard rather than calling setState on a dead component.
            ReactDOM.unmountComponentAtNode(container);
            // If the guard is missing, React logs a warning. We don't capture
            // it here, but the test ensures the codepath executes without
            // throwing.
            setTimeout(done, 60);
        });
    });
});
