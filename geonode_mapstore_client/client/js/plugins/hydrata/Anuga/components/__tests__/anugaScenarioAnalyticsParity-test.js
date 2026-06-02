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
 * or removed in the Miller / Option A refactor):
 *   - anuga-scenario-menu-{manage,advanced}-tab-toggle (header tabs
 *     removed — categories now live inside the pane as
 *     anuga-scenario-menu-category-{inputs,advanced,runConfig,
 *     statusActions} after Wave 3A vertical-rail refactor; runLog was
 *     dropped from the rail in the Option A redesign).
 *   - anuga-scenario-menu-build-validate-missing-{field} — fires only
 *     when Build is clicked on an invalid scenario; covered by the
 *     scenarioActionToolbar / Build code-path tests.
 *   - anuga-scenario-menu-select-scenario-{id}: covered by
 *     scenarioRail-test.js (where the spy is local). The label is keyed
 *     on scenario.id (integer) rather than scenario.name to keep Umami
 *     event types bounded (was -{name} until Bug K7 fix).
 *   - anuga-scenario-menu-archive-filter-{only,none} — chip UI removed
 *     in Option A; see 'removed analytics labels regression guard'
 *     block for the negative assertions guarding against regression.
 *   - anuga-scenario-menu-category-runLog — runLog category removed
 *     from the rail in Option A; regression guard below.
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
        // Scenarios Option A redesign — the header is now a flat
        // .scenario-header-actions span with .anuga-btn-new-scenario /
        // .anuga-btn-compare / .anuga-btn-run-compare /
        // .anuga-btn-duplicate-header. The old #scenario-tab-button-group +
        // .scenario-tab structure (active+compare tabs) is gone, along
        // with #new-scenario-button and #depth-difference-button id
        // wrappers. The archive-filter chip UI is removed entirely;
        // setAnugaScenarioArchiveFilter still exists as a handler but no
        // surface fires it (see the 'removed analytics labels regression
        // guard' block below).

        it('fires anuga-scenario-menu-new-scenario on + New Scenario click', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const btn = container.querySelector('.anuga-btn-new-scenario');
            expect(btn).toExist();
            btn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-new-scenario');
        });

        // Wave 3C C3: Close X removed per operator decision D3 — Option A
        // exits via the top-tab switch on anugaContainer.js. The
        // .legend-close element no longer renders and the
        // 'anuga-scenario-menu-close' Umami label is no longer fired from
        // this surface. The top-tab analytics event
        // 'anuga-scenario-menu-toggle' (on anugaContainer.js) is the
        // replacement signal — exercised by anugaContainer's own coverage.
        it('does NOT render .legend-close (Wave 3C C3 regression guard)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.legend-close')).toNotExist();
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-close');
        });

        it('fires anuga-scenario-menu-compare-tab-toggle when toggling compare mode', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const btn = container.querySelector('.anuga-btn-compare');
            expect(btn).toExist();
            btn.click();
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
            // Enter compare mode first so .anuga-btn-run-compare renders
            // (it only mounts when compareMode && readyToCompare).
            container.querySelector('.anuga-btn-compare').click();
            setTimeout(() => {
                const execBtn = container.querySelector('.anuga-btn-run-compare');
                expect(execBtn).toExist();
                execBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-compare-execute');
                done();
            });
        });
    });

    describe('Pane category events (Wave 3A — vertical rail)', () => {
        it('fires anuga-scenario-menu-category-inputs on Inputs category click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[0].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-category-inputs');
        });

        it('fires anuga-scenario-menu-category-advanced on Advanced category click', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[1].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-category-advanced');
        });

        // TASK-1416: items[2] is now the merged 'run' category (was runConfig).
        it('fires anuga-scenario-menu-category-run on Run category click (TASK-1416)', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-category-run');
        });

        // TASK-1416: statusActions no longer exists as a separate rail item.
        // Both runConfig and statusActions redirect to 'run'.
        it('no separate statusActions rail item — only 3 categories total (TASK-1416)', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            expect(items.length).toBe(3);
        });

        // Scenarios Option A redesign — runLog category was removed from
        // the rail. The 'anuga-scenario-menu-category-runLog' label can no
        // longer fire from this surface; the regression-guard block below
        // asserts the category id is absent from the rail.
    });

    describe('Action toolbar events', () => {
        it('fires anuga-scenario-menu-run on Run button click (built status)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
            setTimeout(() => {
                const rerunBtn = container.querySelector('.scenario-action-rerun');
                expect(rerunBtn).toExist();
                rerunBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-rerun');
                done();
            });
        });

        it('opens the confirm dialog when the header Duplicate button is clicked (saved scenario)', () => {
            // Scenarios Option A redesign — Duplicate moved from the
            // toolbar (.scenario-action-duplicate) to the header
            // (.anuga-btn-duplicate-header). It opens the confirm dialog
            // via openConfirm('duplicate', scenario) without firing a
            // bare 'anuga-scenario-menu-duplicate-scenario' label — only
            // -confirm / -duplicate-cancel fire from the dialog flow.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const dupBtn = container.querySelector('.anuga-btn-duplicate-header');
            expect(dupBtn).toExist();
            expect(dupBtn.className).toNotInclude('disabled');
            dupBtn.click();
            const dialog = container.querySelector('.anuga-scenario-confirm-dialog.is-open');
            expect(dialog).toExist();
            // The header opens the dialog without a bare label; the
            // -confirm / -cancel labels fire from the dialog buttons (see
            // 'Confirm-dialog parity events' block below).
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-duplicate-scenario');
        });

        it('disables the header Duplicate button when no scenario is selected', () => {
            const store = makeStore(); // no scenarios → no selectedScenario
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const dupBtn = container.querySelector('.anuga-btn-duplicate-header');
            expect(dupBtn).toExist();
            expect(dupBtn.className).toInclude('disabled');
        });

        it('fires anuga-scenario-menu-archive-scenario on Archive click', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            // Scenarios Option A — dialog opens from the header
            // .anuga-btn-duplicate-header (not the toolbar). Confirm/
            // cancel flow on the dialog itself is unchanged.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            container.querySelector('.anuga-btn-duplicate-header').click();
            setTimeout(() => {
                const confirmBtn = container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm');
                expect(confirmBtn).toExist();
                confirmBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-scenario-confirm');
                done();
            });
        });

        it('fires anuga-scenario-menu-archive-scenario-confirm on Archive confirm', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
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
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
            setTimeout(() => {
                container.querySelector('.scenario-action-cancel-run').click();
                setTimeout(() => {
                    container.querySelector('.anuga-scenario-confirm-dialog.is-open .confirm').click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-cancel-run-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-duplicate-cancel on confirm dialog Cancel (header-opened)', (done) => {
            // Cancel label uses the action that was active (duplicate).
            // The dialog opens via the header .anuga-btn-duplicate-header
            // post-Option A redesign; the cancel-label semantics are
            // unchanged.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            container.querySelector('.anuga-btn-duplicate-header').click();
            setTimeout(() => {
                const cancelBtn = container.querySelector('.anuga-scenario-confirm-dialog.is-open .cancel');
                expect(cancelBtn).toExist();
                cancelBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-cancel');
                done();
            });
        });
    });

    describe('removed analytics labels regression guard', () => {
        // Three legacy labels are no longer fireable from this surface
        // post-Option A redesign. The handler functions for archive-filter
        // remain (setAnugaScenarioArchiveFilter is still a registered
        // dispatch prop) but no DOM element wires them — so we assert
        // the wiring elements themselves are gone. Per the TASK-897-class
        // silent-event-drift concern, dropping a Umami label from a
        // dashboard for 365d without a guard is a bigger risk than the
        // tiny extra cost of these regression assertions.

        it('does not render any .scenario-tab element (archive-filter chip UI removed)', () => {
            const store = makeStore({archiveFilter: 'none'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.scenario-tab')).toNotExist();
            // The removed labels cannot fire because no DOM hook reaches
            // handleArchiveFilterToggle from this surface anymore.
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-archive-filter-only');
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-archive-filter-none');
        });

        it('does not render the #scenario-tab-button-group wrapper', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('#scenario-tab-button-group')).toNotExist();
        });

        it('does not render a rail item with category id "runLog"', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // Rail items now have 4 entries (inputs, advanced, runConfig,
            // statusActions); runLog is removed from the rail data so
            // the category-runLog label has no DOM hook.
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            expect(items.length).toBe(4);
            // Walk all rail labels — none should textually claim runLog.
            const labels = Array.from(container.querySelectorAll('.anuga-scenario-category-item-label'))
                .map(n => (n.textContent || '').toLowerCase());
            labels.forEach(text => {
                expect(text.indexOf('run log')).toBe(-1);
            });
            // The category-runLog label cannot fire from this surface.
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-runLog');
        });

        it('does not render the toolbar .scenario-action-duplicate button', (done) => {
            // Scenarios Option A — Duplicate moved from the toolbar to
            // the header. The toolbar no longer fires the bare
            // 'anuga-scenario-menu-duplicate-scenario' label.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.anuga-scenario-category-item');
            items[2].click(); // run (TASK-1416)
            setTimeout(() => {
                expect(container.querySelector('.scenario-action-duplicate')).toNotExist();
                expect(labelsFired()).toNotInclude('anuga-scenario-menu-duplicate-scenario');
                done();
            });
        });
    });
});
