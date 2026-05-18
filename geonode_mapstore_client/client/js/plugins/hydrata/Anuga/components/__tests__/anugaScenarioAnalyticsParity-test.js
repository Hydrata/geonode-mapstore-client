/*
 * TASK-C-scenarios-miller W4 — analytics parity test.
 *
 * Confirms every `anuga-scenario-menu-*` label fired by the old
 * ScenarioTableRow + anugaScenarioMenu still fires from the equivalent
 * button in the new Miller-columns header + pane + toolbar. Umami
 * dashboards key on these label strings; if any drift, the dashboards
 * silently lose data for 365 days (pin: TASK-606 / TASK-897-class bug).
 *
 * Methodology:
 *   - Set window.umami = { track: spy } so trackEvent() captures the
 *     label, category, action without requiring a webpack-aware
 *     module-spy machinery.
 *   - Mount the connected AnugaScenarioMenu + drive each surface via
 *     ordinary .click() / setter-based input events.
 *   - For each known legacy label string, assert it appears in the
 *     captured track-call labels.
 *
 * NOT covered (out of scope for this file — already covered elsewhere
 * or removed in the Miller refactor):
 *   - anuga-scenario-menu-{manage,advanced}-tab-toggle (header tabs
 *     removed — categories now live inside the pane as
 *     anuga-scenario-menu-{inputs,advanced,run,actions}-tab-toggle).
 *   - anuga-scenario-menu-build-validate-missing-{field} — fires only
 *     when Build is clicked on an invalid scenario; covered by the
 *     scenarioActionToolbar / Build code-path tests.
 *   - anuga-scenario-menu-select-scenario-{name} — covered by
 *     scenarioRail-test.js (where the spy is local).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { AnugaScenarioMenu } from '../anugaScenarioMenu';

function makeScenario(id, name, extras = {}) {
    return {
        id, name, status: 'created', created_by: 7,
        terrain: 1, boundary: 1, inflow: 1, rainfall: 1,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800,
        ...extras
    };
}

function makeStore({scenariosArr = [], archiveFilter = 'none'} = {}) {
    const byId = {};
    const allIds = [];
    scenariosArr.forEach(s => {
        byId[s.id] = s;
        allIds.push(s.id);
    });
    const state = {
        anuga: {
            project: { id: 1, my_role: 'editor' },
            projects: { data: { id: 1, my_role: 'editor' } },
            scenarios: { byId, allIds, archiveFilter, selectedId: scenariosArr[0]?.id || null },
            resources: {
                boundaries: [], terrain: [], frictions: [], inflows: [], rainfalls: [],
                structures: [], meshRegions: [], networks: []
            }
        },
        security: { user: { pk: 7 } }
    };
    const dispatched = [];
    return {
        getState: () => state,
        dispatch: (a) => { dispatched.push(a); return a; },
        subscribe: () => () => {},
        __actions: () => dispatched
    };
}

describe('anugaScenarioMenu — Umami analytics parity (TASK-C W4)', () => {
    let container;
    let origUmami;
    let trackCalls;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        trackCalls = [];
        origUmami = window.umami;
        window.umami = {
            track: (label, payload) => {
                trackCalls.push({label, ...payload});
            }
        };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        window.umami = origUmami;
    });

    function labelsFired() {
        return trackCalls.map(c => c.label);
    }

    describe('Header strip events', () => {
        it('fires anuga-scenario-menu-new-scenario on + New Scenario click', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const btn = container.querySelector('#new-scenario-button .anuga-btn');
            btn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-new-scenario');
        });

        it('fires anuga-scenario-menu-close on X click', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            container.querySelector('.legend-close').click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-close');
        });

        it('fires anuga-scenario-menu-archive-filter-only when toggling archive chip', () => {
            const store = makeStore({archiveFilter: 'none'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
            buttons[0].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-archive-filter-only');
        });

        it('fires anuga-scenario-menu-archive-filter-none when toggling archive chip off', () => {
            const store = makeStore({archiveFilter: 'only'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
            buttons[0].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-archive-filter-none');
        });

        it('fires anuga-scenario-menu-compare-tab-toggle when toggling compare mode', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
            buttons[1].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-compare-tab-toggle');
        });

        it('fires anuga-scenario-menu-compare-execute on Execute Compare click', (done) => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
            buttons[1].click();
            setTimeout(() => {
                const execBtn = container.querySelector('#depth-difference-button .anuga-btn');
                execBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-compare-execute');
                done();
            });
        });
    });

    describe('Pane subtab events', () => {
        it('fires anuga-scenario-menu-inputs-tab-toggle on Inputs subtab click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[0].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-inputs-tab-toggle');
        });

        it('fires anuga-scenario-menu-advanced-tab-toggle on Advanced subtab click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[1].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-advanced-tab-toggle');
        });

        it('fires anuga-scenario-menu-run-tab-toggle on Run subtab click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-run-tab-toggle');
        });

        it('fires anuga-scenario-menu-actions-tab-toggle on Actions subtab click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[3].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-actions-tab-toggle');
        });
    });

    describe('Action toolbar events', () => {
        it('fires anuga-scenario-menu-view-log on Log button click', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click(); // Run subtab
            setTimeout(() => {
                const logBtn = container.querySelector('.scenario-action-log');
                expect(logBtn).toExist();
                logBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-view-log');
                done();
            });
        });

        it('fires anuga-scenario-menu-run on Run button click (built status)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click(); // Run subtab
            setTimeout(() => {
                const runBtn = container.querySelector('.scenario-action-run');
                expect(runBtn).toExist();
                runBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-run');
                done();
            });
        });

        it('fires anuga-scenario-menu-retry on Retry button click (error status)', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'error',
                latest_run: {id: 999, status: 'error', error_message: 'something broke'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const retryBtn = container.querySelector('.scenario-action-retry');
                expect(retryBtn).toExist();
                retryBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-retry');
                done();
            });
        });

        it('fires anuga-scenario-menu-download on Download button click (complete status)', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'complete',
                latest_run: {id: 999, status: 'complete', s3_package_url: 'https://example.com/x.zip'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const dlBtn = container.querySelector('.scenario-action-download');
                expect(dlBtn).toExist();
                // The Download button is an <a download href=...>; a real .click()
                // would trigger a page nav under Karma. Dispatch a cancelable
                // mouse event we can preventDefault on, then verify the
                // synthetic onClick (and thus trackEvent) still fired.
                const evt = new window.MouseEvent('click', {bubbles: true, cancelable: true});
                evt.preventDefault();
                dlBtn.dispatchEvent(evt);
                expect(labelsFired()).toInclude('anuga-scenario-menu-download');
                done();
            });
        });

        it('fires anuga-scenario-menu-rerun on Run-again click (cancelled status)', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'cancelled',
                latest_run: {id: 999, status: 'cancelled'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const rerunBtn = container.querySelector('.scenario-action-rerun');
                expect(rerunBtn).toExist();
                rerunBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-rerun');
                done();
            });
        });

        it('fires anuga-scenario-menu-duplicate-scenario on Duplicate click', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const dupBtn = container.querySelector('.scenario-action-duplicate');
                expect(dupBtn).toExist();
                expect(dupBtn.className).toNotInclude('is-hidden');
                dupBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-scenario');
                done();
            });
        });

        it('fires anuga-scenario-menu-archive-scenario on Archive click', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const archBtn = container.querySelector('.scenario-action-archive');
                expect(archBtn).toExist();
                archBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-archive-scenario');
                done();
            });
        });

        it('fires anuga-scenario-menu-unarchive-scenario on Unarchive click', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built', archived_at: '2026-01-01T00:00:00Z'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const unarchBtn = container.querySelector('.scenario-action-unarchive');
                expect(unarchBtn).toExist();
                unarchBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-unarchive-scenario');
                done();
            });
        });

        it('fires anuga-scenario-menu-delete-scenario on Delete click (non-cancellable)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const delBtn = container.querySelector('.scenario-action-delete');
                expect(delBtn).toExist();
                expect(delBtn.className).toNotInclude('is-hidden');
                delBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-delete-scenario');
                done();
            });
        });

        it('fires anuga-scenario-menu-cancel-run on Cancel Run click (computing)', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'computing',
                latest_run: {id: 999, status: 'computing'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const cancelBtn = container.querySelector('.scenario-action-cancel-run');
                expect(cancelBtn).toExist();
                cancelBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-cancel-run');
                done();
            });
        });

        it('fires anuga-scenario-menu-build on Build click (status not created)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built', unsaved: true});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                const buildBtn = container.querySelector('.scenario-action-build');
                expect(buildBtn).toExist();
                buildBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-build');
                done();
            });
        });
    });

    describe('Confirm-dialog parity events', () => {
        it('fires anuga-scenario-menu-duplicate-scenario-confirm on Duplicate confirm', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                container.querySelector('.scenario-action-duplicate').click();
                setTimeout(() => {
                    const confirmBtn = container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm');
                    expect(confirmBtn).toExist();
                    confirmBtn.click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-scenario-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-archive-scenario-confirm on Archive confirm', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                container.querySelector('.scenario-action-archive').click();
                setTimeout(() => {
                    container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm').click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-archive-scenario-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-delete-scenario-confirm on Delete confirm', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                container.querySelector('.scenario-action-delete').click();
                setTimeout(() => {
                    container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm').click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-delete-scenario-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-cancel-run-confirm on Cancel Run confirm', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'computing',
                latest_run: {id: 999, status: 'computing'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                container.querySelector('.scenario-action-cancel-run').click();
                setTimeout(() => {
                    container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm').click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-cancel-run-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-confirm-cancel on confirm dialog Cancel', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const subtabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
            subtabs[2].click();
            setTimeout(() => {
                container.querySelector('.scenario-action-duplicate').click();
                setTimeout(() => {
                    const cancelBtn = container.querySelector('.anuga-scenario-confirm-dialog.is-open .cancel');
                    cancelBtn.click();
                    // Cancel label uses the action that was active (duplicate).
                    expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-cancel');
                    done();
                });
            });
        });
    });
});
