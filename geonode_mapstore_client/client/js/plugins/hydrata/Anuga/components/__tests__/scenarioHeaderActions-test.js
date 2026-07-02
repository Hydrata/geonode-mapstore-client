/*
 * UAT #8 — ScenarioHeaderActions: the always-visible run-action strip that
 * moved out of the Run pane up into the Scenarios heading. Covers the three
 * new behaviours (Build-and-Run, built-gated Download, click debounce) plus
 * the preserved Build/Run/Retry/Archive/Delete/Cancel wiring + Umami labels.
 *
 * Memory pins:
 *   - feedback-window-confirm-blocks-automation: the strip must never call
 *     window.confirm/alert — confirm-requiring actions route through the
 *     onConfirm* props (the container owns the inline dialog).
 *   - feedback-mapstore-react-version-mismatch: drive via real .click() +
 *     dispatched-handler capture, not setState-flush patterns.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioHeaderActions, ACTION_DEBOUNCE_MS} from '../scenarioHeaderActions';

const baseScenario = {
    id: 21,
    name: 'Baseline',
    status: 'built',
    created_by: 7
};

describe('ScenarioHeaderActions (UAT #8)', () => {
    let container;
    let trackCalls;
    let origUmami;
    let origConfirm;
    let origAlert;
    let confirmCalls;
    let alertCalls;

    function labels() {
        return trackCalls.map(c => c.label);
    }

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        trackCalls = [];
        origUmami = window.umami;
        window.umami = { track: (label, payload) => trackCalls.push({label, ...payload}) };
        confirmCalls = 0;
        alertCalls = 0;
        origConfirm = window.confirm;
        origAlert = window.alert;
        // eslint-disable-next-line no-alert -- regression guard mock, not real
        window.confirm = () => { confirmCalls++; return true; };
        // eslint-disable-next-line no-alert -- regression guard mock, not real
        window.alert = () => { alertCalls++; };
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        window.umami = origUmami;
        window.confirm = origConfirm;
        window.alert = origAlert;
        setTimeout(done);
    });

    it('renders nothing when no scenario is selected', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={null} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('#scenario-run-actions')).toNotExist();
                done();
            }
        );
    });

    it('renders Build, Build-and-Run and Run in the always-visible strip (built status)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('#scenario-run-actions')).toExist();
                expect(container.querySelector('.sv-scenario-action-build')).toExist();
                expect(container.querySelector('.sv-scenario-action-build-run')).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toExist();
                done();
            }
        );
    });

    it('Build click fires onBuildClick + the anuga-scenario-menu-build label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onBuildClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-build').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-build');
                done();
            }
        );
    });

    it('debounce: Build button becomes disabled immediately after a click', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario onBuildClick={() => {}} />,
            container,
            () => {
                const btn = container.querySelector('.sv-scenario-action-build');
                expect(btn.disabled).toBe(false);
                btn.click();
                setTimeout(() => {
                    expect(container.querySelector('.sv-scenario-action-build').disabled).toBe(true);
                    // >= 2s debounce so the press registers visually (UAT #8).
                    expect(ACTION_DEBOUNCE_MS).toBe(2000);
                    done();
                });
            }
        );
    });

    it('Build-and-Run click fires onBuildAndRunClick + the build-and-run label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onBuildAndRunClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-build-run').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-build-and-run');
                done();
            }
        );
    });

    it('Run click fires onRunClick + the anuga-scenario-menu-run label (built status)', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onRunClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-run').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-run');
                done();
            }
        );
    });

    it('Run is disabled in created status (nothing to run yet)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'created'}}
                canEdit canRunScenario
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-run').disabled).toBe(true);
                done();
            }
        );
    });

    it('cancelled status renders the Re-run variant + the rerun label', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'cancelled', latest_run: {id: 9, status: 'cancelled'}}}
                canEdit canRunScenario
                onRunClick={() => {}}
            />,
            container,
            () => {
                const rerun = container.querySelector('.sv-scenario-action-rerun');
                expect(rerun).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toNotExist();
                rerun.click();
                expect(labels()).toInclude('anuga-scenario-menu-rerun');
                done();
            }
        );
    });

    it('error status renders Retry (not Run)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'error', latest_run: {id: 9, status: 'error'}}}
                canEdit canRunScenario
                onRetryClick={() => {}}
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-retry')).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toNotExist();
                container.querySelector('.sv-scenario-action-retry').click();
                expect(labels()).toInclude('anuga-scenario-menu-retry');
                done();
            }
        );
    });

    it('Download is visible ONLY when built and links to the run package URL', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                canEdit canRunScenario
            />,
            container,
            () => {
                const dl = container.querySelector('.sv-scenario-action-download');
                expect(dl).toExist();
                expect(dl.getAttribute('href')).toBe('https://x/y.zip');
                done();
            }
        );
    });

    it('Download is NOT rendered for a not-yet-built (created) scenario', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'created'}}
                canEdit canRunScenario
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-download')).toNotExist();
                done();
            }
        );
    });

    // TASK-2078: package download href/gate is a RESULT consumer (D1) —
    // reads latest_complete_run so a newer in-flight/errored latest_run
    // never hides/breaks the download of the last-good result package.
    it('TASK-2078: Download stays visible + points at latest_complete_run\'s package while a newer run is in-flight (AC1)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{
                    ...baseScenario,
                    status: 'computing',
                    latest_run: {id: 10, status: 'computing'},
                    latest_complete_run: {id: 9, status: 'complete', s3_package_url: 'https://x/complete-run-9.zip'}
                }}
                canEdit canRunScenario
            />,
            container,
            () => {
                const dl = container.querySelector('.sv-scenario-action-download');
                expect(dl).toExist();
                expect(dl.getAttribute('href')).toBe('https://x/complete-run-9.zip');
                done();
            }
        );
    });

    it('Delete (non-running) routes through onConfirmDelete + fires the delete label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onConfirmDelete={(s) => { captured = s; }}
            />,
            container,
            () => {
                const del = container.querySelector('.sv-scenario-action-delete');
                expect(del).toExist();
                del.click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-delete-scenario');
                done();
            }
        );
    });

    it('Cancel-run (in-flight) routes through onConfirmCancelRun', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                canEdit canRunScenario
                onConfirmCancelRun={(s) => { captured = s; }}
            />,
            container,
            () => {
                const cancel = container.querySelector('.sv-scenario-action-cancel-run');
                expect(cancel).toExist();
                cancel.click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-cancel-run');
                done();
            }
        );
    });

    it('never calls window.confirm / window.alert', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onConfirmDelete={() => {}}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-delete').click();
                expect(confirmCalls).toBe(0);
                expect(alertCalls).toBe(0);
                done();
            }
        );
    });
});
