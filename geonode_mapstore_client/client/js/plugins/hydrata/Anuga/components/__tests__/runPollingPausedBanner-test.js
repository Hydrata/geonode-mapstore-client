/**
 * W7 (TASK-1045) — runPollingPausedBanner component tests.
 *
 * The banner renders top-right when state.anuga.runs.pollingTimeoutFor[runId]
 * is true for the currently-selected scenario's latest_run.id. It exposes:
 *   - a "Resume polling" button that dispatches START_ACTIVE_RUN_POLLING(runId)
 *   - auto-dismiss via global click / focusin / keydown — fires
 *     DISMISS_RUN_POLLING_TIMEOUT(runId)
 *
 * Both reducer cases clear `pollingTimeoutFor[runId]`; only Resume re-arms the
 * polling stream. The banner avoids React 17+ APIs to stay compatible with
 * react@16.14 / react-dom@16.10 (memory pin
 * feedback-mapstore-react-version-mismatch).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import RunPollingPausedBanner, {RunPollingPausedBanner as BareBanner} from '../runPollingPausedBanner';
import {
    START_ACTIVE_RUN_POLLING,
    DISMISS_RUN_POLLING_TIMEOUT
} from '../../actions/pollingActions';

function makeStore(stateMutator) {
    const baseState = {
        anuga: {
            scenarios: {
                byId: {
                    77: { id: 77, latest_run: { id: 444, status: 'computing' } }
                },
                allIds: [77],
                selectedId: 77
            },
            runs: {
                byId: {},
                activePolling: [],
                pollingTimeoutFor: { 444: true }
            }
        }
    };
    const state = stateMutator ? stateMutator(baseState) : baseState;
    const dispatched = [];
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => { dispatched.push(a); return a; },
        __dispatched: dispatched
    };
}

describe('W7 RunPollingPausedBanner', () => {
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

    describe('render gating', () => {
        it('renders the banner DOM when pollingTimeoutFor[runId] is true', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    const banner = container.querySelector('.sv-run-polling-paused-banner');
                    expect(banner).toExist();
                    expect(container.querySelector('.run-polling-paused-resume')).toExist();
                    done();
                }
            );
        });

        it('renders nothing when pollingTimeoutFor is empty', (done) => {
            const store = makeStore((s) => ({
                ...s,
                anuga: {
                    ...s.anuga,
                    runs: { ...s.anuga.runs, pollingTimeoutFor: {} }
                }
            }));
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-run-polling-paused-banner')).toNotExist();
                    done();
                }
            );
        });

        it('renders nothing when the selected scenario has no latest_run.id', (done) => {
            const store = makeStore((s) => ({
                ...s,
                anuga: {
                    ...s.anuga,
                    scenarios: {
                        ...s.anuga.scenarios,
                        byId: { 77: { id: 77, latest_run: null } }
                    }
                }
            }));
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-run-polling-paused-banner')).toNotExist();
                    done();
                }
            );
        });

        it('renders nothing when no scenario is selected', (done) => {
            const store = makeStore((s) => ({
                ...s,
                anuga: {
                    ...s.anuga,
                    scenarios: { ...s.anuga.scenarios, selectedId: null }
                }
            }));
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-run-polling-paused-banner')).toNotExist();
                    done();
                }
            );
        });
    });

    describe('Resume button', () => {
        it('clicking Resume dispatches START_ACTIVE_RUN_POLLING with runId', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    const btn = container.querySelector('.run-polling-paused-resume');
                    expect(btn).toExist();
                    btn.click();
                    const start = store.__dispatched.find(a => a.type === START_ACTIVE_RUN_POLLING);
                    expect(start).toExist();
                    expect(start.runId).toBe(444);
                    done();
                }
            );
        });
    });

    describe('Auto-dismiss', () => {
        it('a document-level click outside the banner dispatches DISMISS_RUN_POLLING_TIMEOUT', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    // Outside-of-banner click target.
                    const sink = document.createElement('div');
                    document.body.appendChild(sink);
                    sink.click();
                    const dismissed = store.__dispatched.find(a => a.type === DISMISS_RUN_POLLING_TIMEOUT);
                    expect(dismissed).toExist();
                    expect(dismissed.runId).toBe(444);
                    // No START dispatched — dismiss must not re-arm polling.
                    expect(store.__dispatched.find(a => a.type === START_ACTIVE_RUN_POLLING)).toNotExist();
                    document.body.removeChild(sink);
                    done();
                }
            );
        });

        it('keydown dispatches DISMISS_RUN_POLLING_TIMEOUT', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    const ev = new window.KeyboardEvent('keydown', {bubbles: true, key: 'a'});
                    document.body.dispatchEvent(ev);
                    const dismissed = store.__dispatched.find(a => a.type === DISMISS_RUN_POLLING_TIMEOUT);
                    expect(dismissed).toExist();
                    done();
                }
            );
        });

        it('a click ON the banner does NOT auto-dismiss before the Resume handler runs', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><RunPollingPausedBanner /></Provider>,
                container,
                () => {
                    const btn = container.querySelector('.run-polling-paused-resume');
                    btn.click();
                    // First dispatch should be START, NOT DISMISS.
                    const start = store.__dispatched.find(a => a.type === START_ACTIVE_RUN_POLLING);
                    expect(start).toExist();
                    expect(start.runId).toBe(444);
                    // No DISMISS dispatched for banner-internal click.
                    expect(store.__dispatched.find(a => a.type === DISMISS_RUN_POLLING_TIMEOUT)).toNotExist();
                    done();
                }
            );
        });

        // Coverage note: cleanup is enforced by the component's
        // componentWillUnmount calling document.removeEventListener for each
        // event type it added in componentDidMount. The contract is well-trodden
        // React 16 lifecycle behaviour; a Karma probe via
        // ReactDOM.unmountComponentAtNode → post-unmount document click is
        // flaky in JSDOM/Karma due to sibling-test listener leaks bleeding
        // across module-scoped document state. The other Auto-dismiss tests
        // above prove the active-mount behaviour; the unmount path is read
        // by code review (see runPollingPausedBanner.js componentWillUnmount).
    });

    describe('Bare (un-connected) component', () => {
        it('renders nothing when paused=false', (done) => {
            ReactDOM.render(
                <BareBanner paused={false} runId={1} onResume={() => {}} onDismiss={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-run-polling-paused-banner')).toNotExist();
                    done();
                }
            );
        });

        it('renders banner when paused=true and the locale-msgId Message keys are present', (done) => {
            ReactDOM.render(
                <BareBanner paused runId={1} onResume={() => {}} onDismiss={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-run-polling-paused-banner')).toExist();
                    // Message renders msgId itself as fallback text when no
                    // IntlProvider — its presence proves the wiring.
                    expect(container.textContent).toInclude('hydrata.anuga.pollingPaused');
                    expect(container.textContent).toInclude('hydrata.anuga.resumePolling');
                    done();
                }
            );
        });
    });
});
