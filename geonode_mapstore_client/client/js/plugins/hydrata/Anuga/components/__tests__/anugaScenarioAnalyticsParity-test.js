/*
 * TASK-C-scenarios-miller W4 — analytics parity test.
 *
 * Confirms every `anuga-scenario-menu-*` label fired by the old
 * ScenarioTableRow + anugaScenarioMenu still fires from the equivalent
 * button in the new Miller-columns header + pane + toolbar. Umami
 * dashboards key on these label strings; if any drift, the dashboards
 * silently lose data for 365 days (pin: TASK-606 / TASK-897-class bug).
 *
 * TASK-2241 (epic 2237 W1.3) — re-cut for the run cluster + lifecycle-slot
 * mutex (TASK-2239) and the custom portaled overflow (kebab) menu
 * (TASK-2240): every RETAINED control (build, run, rerun, retry,
 * cancel-run, build-and-run, download, view-results, archive, unarchive,
 * delete, duplicate, new-scenario) is re-verified firing its
 * BYTE-IDENTICAL label from its new location, closing two pre-existing
 * coverage gaps (build-and-run, view-results — see 'Action toolbar
 * events'). Click targets are the actual clickable elements throughout
 * (menu <button role="menuitem"> anchors, never a wrapping <li> — see
 * 'overflow-menu click targets are anchors, not li elements' below,
 * amendment A3). compare-tab-toggle / compare-execute retire into the
 * removed-labels regression-guard pattern (precedent below) now that
 * Compare's UI entry is gone entirely.
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
 *     removed — categories briefly lived inside the pane as
 *     anuga-scenario-menu-category-{inputs,advanced,runConfig,
 *     statusActions} after the Wave 3A vertical-rail refactor, but the
 *     UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 1)
 *     REMOVED the rail entirely — none of these labels can fire from this
 *     surface any more; see 'Category rail removed (finding 1)' below).
 *   - anuga-scenario-menu-build-validate-missing-{field} — fires only
 *     when Build is clicked on an invalid scenario; covered by the
 *     scenarioHeaderActions / Build code-path tests.
 *   - anuga-scenario-menu-select-scenario-{id}: covered by
 *     scenarioRail-test.js (where the spy is local). The label is keyed
 *     on scenario.id (integer) rather than scenario.name to keep Umami
 *     event types bounded (was -{name} until Bug K7 fix).
 *   - anuga-scenario-menu-archive-filter-{only,none} — chip UI removed
 *     in Option A; see 'removed analytics labels regression guard'
 *     block for the negative assertions guarding against regression.
 *   - anuga-scenario-menu-category-runLog — runLog category removed
 *     from the rail in Option A; the whole rail (and thus every
 *     category-{id} label) is gone now — regression guard below.
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

// TASK-2240 — the overflow menu portals to document.body; open it via the
// trigger and read the portal off the document, not `container`.
function openKebab(container) {
    container.querySelector('.sv-anuga-scenario-overflow-trigger').click();
}
function kebabMenu() {
    return document.querySelector('.sv-anuga-scenario-overflow-menu');
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
        // TASK-2240 (epic 2237 W1.2) — the header's New Scenario/Compare/
        // Duplicate cluster is now a single overflow (kebab) menu
        // (AnugaScenarioOverflowMenu). The old #scenario-tab-button-group +
        // .sv-scenario-tab structure (active+compare tabs) is gone, along
        // with #new-scenario-button and #depth-difference-button id
        // wrappers. The archive-filter chip UI is removed entirely;
        // setAnugaScenarioArchiveFilter still exists as a handler but no
        // surface fires it (see the 'removed analytics labels regression
        // guard' block below, which also now covers Compare's two retired
        // labels).

        it('fires anuga-scenario-menu-new-scenario on + New Scenario click (via the kebab menu)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const btn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-new');
            expect(btn).toExist();
            btn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-new-scenario');
        });

        // Wave 3C C3: Close X removed per operator decision D3 — Option A
        // exits via the top-tab switch on anugaContainer.js. The
        // .sv-legend-close element no longer renders and the
        // 'anuga-scenario-menu-close' Umami label is no longer fired from
        // this surface. The top-tab analytics event
        // 'anuga-scenario-menu-toggle' (on anugaContainer.js) is the
        // replacement signal — exercised by anugaContainer's own coverage.
        it('does NOT render .sv-legend-close (Wave 3C C3 regression guard)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-legend-close')).toNotExist();
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-close');
        });
    });

    // UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 1) —
    // the vertical category rail (Pane 2) is REMOVED entirely: it's obsolete
    // now that the merged pane is one scroll (TASK-2114). None of the
    // `anuga-scenario-menu-category-{id}` labels this describe block used to
    // exercise via rail clicks can fire from this surface any more — same
    // "removed feature" pattern as the block further down guarding the
    // archive-filter chips / duplicate toolbar button. The completeness
    // counts the rail used to carry move to each section's own heading
    // badge instead (finding 2 — see scenarioPane-test.js, not this file:
    // the badges are plain text, not Umami events).
    describe('Category rail removed (finding 1) — regression guard', () => {
        it('does not render any .sv-anuga-scenario-category-item / rail, and never fires a category-click label', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-category-rail')).toNotExist();
            expect(container.querySelectorAll('.sv-anuga-scenario-category-item').length).toBe(0);
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-inputs');
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-advanced');
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-run');
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-runLog');
        });
    });

    describe('Action toolbar events', () => {
        it('fires anuga-scenario-menu-run on Run button click (built status)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            setTimeout(() => {
                const runBtn = container.querySelector('.sv-scenario-action-run');
                expect(runBtn).toExist();
                runBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-run');
                done();
            });
        });

        // TASK-2241 (epic 2237 W1.3) — closes a pre-existing parity-coverage
        // gap: build-and-run and view-results moved location across earlier
        // waves (2239's run cluster; TASK-2115's "leads the row") without
        // ever gaining a parity assertion in THIS file. Added now so both
        // are byte-identical-pinned like every other retained control.
        it('fires anuga-scenario-menu-build-and-run on Build & Run click (created status)', (done) => {
            const s1 = makeScenario(21, 'A', {status: 'created'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            setTimeout(() => {
                const btn = container.querySelector('.sv-scenario-action-build-run');
                expect(btn).toExist();
                btn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-build-and-run');
                done();
            });
        });

        it('fires anuga-scenario-menu-view-results on View Results click (complete run present)', (done) => {
            const s1 = makeScenario(21, 'A', {
                status: 'complete',
                latest_run: {id: 999, status: 'complete'},
                latest_complete_run: {id: 999, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            setTimeout(() => {
                const btn = container.querySelector('.sv-anuga-btn-view-results');
                expect(btn).toExist();
                btn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-view-results');
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
            setTimeout(() => {
                const retryBtn = container.querySelector('.sv-scenario-action-retry');
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
            setTimeout(() => {
                const dlBtn = container.querySelector('.sv-scenario-action-download');
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
            setTimeout(() => {
                const rerunBtn = container.querySelector('.sv-scenario-action-rerun');
                expect(rerunBtn).toExist();
                rerunBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-rerun');
                done();
            });
        });

        it('opens the confirm dialog when the Duplicate menu item is clicked (saved scenario)', () => {
            // TASK-2240 — Duplicate moved from the header cluster into the
            // overflow (kebab) menu (.sv-anuga-scenario-overflow-duplicate).
            // It opens the confirm dialog via openConfirm('duplicate', scenario)
            // without firing a bare 'anuga-scenario-menu-duplicate-scenario'
            // label — only -confirm / -duplicate-cancel fire from the dialog flow.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const dupBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate');
            expect(dupBtn).toExist();
            expect(dupBtn.className).toNotInclude('disabled');
            dupBtn.click();
            const dialog = container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open');
            expect(dialog).toExist();
            // The menu item opens the dialog without a bare label; the
            // -confirm / -cancel labels fire from the dialog buttons (see
            // 'Confirm-dialog parity events' block below).
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-duplicate-scenario');
        });

        it('disables the Duplicate menu item when no scenario is selected', () => {
            const store = makeStore(); // no scenarios → no selectedScenario
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const dupBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate');
            expect(dupBtn).toExist();
            expect(dupBtn.className).toInclude('disabled');
        });

        it('fires anuga-scenario-menu-archive-scenario on Archive click (from the overflow menu)', () => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const archBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-archive');
            expect(archBtn).toExist();
            archBtn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-archive-scenario');
        });

        it('fires anuga-scenario-menu-unarchive-scenario on Unarchive click (from the overflow menu)', () => {
            const s1 = makeScenario(21, 'A', {status: 'built', archived_at: '2026-01-01T00:00:00Z'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const unarchBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-unarchive');
            expect(unarchBtn).toExist();
            unarchBtn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-unarchive-scenario');
        });

        it('fires anuga-scenario-menu-delete-scenario on Delete click (from the overflow menu, non-cancellable)', () => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const delBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-delete');
            expect(delBtn).toExist();
            expect(delBtn.disabled).toBe(false);
            delBtn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-delete-scenario');
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
            setTimeout(() => {
                const cancelBtn = container.querySelector('.sv-scenario-action-cancel-run');
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
            setTimeout(() => {
                const buildBtn = container.querySelector('.sv-scenario-action-build');
                expect(buildBtn).toExist();
                buildBtn.click();
                expect(labelsFired()).toInclude('anuga-scenario-menu-build');
                done();
            });
        });
    });

    describe('Confirm-dialog parity events', () => {
        it('fires anuga-scenario-menu-duplicate-scenario-confirm on Duplicate confirm', () => {
            // TASK-2240 — dialog opens from the overflow menu's
            // .sv-anuga-scenario-overflow-duplicate item (not the header
            // cluster). Confirm/cancel flow on the dialog itself is unchanged.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate').click();
            const confirmBtn = container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open .confirm');
            expect(confirmBtn).toExist();
            confirmBtn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-scenario-confirm');
        });

        it('fires anuga-scenario-menu-archive-scenario-confirm on Archive confirm', () => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            kebabMenu().querySelector('.sv-anuga-scenario-overflow-archive').click();
            container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open .confirm').click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-archive-scenario-confirm');
        });

        it('fires anuga-scenario-menu-delete-scenario-confirm on Delete confirm', () => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            kebabMenu().querySelector('.sv-anuga-scenario-overflow-delete').click();
            container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open .confirm').click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-delete-scenario-confirm');
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
            setTimeout(() => {
                container.querySelector('.sv-scenario-action-cancel-run').click();
                setTimeout(() => {
                    container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open .confirm').click();
                    expect(labelsFired()).toInclude('anuga-scenario-menu-cancel-run-confirm');
                    done();
                });
            });
        });

        it('fires anuga-scenario-menu-duplicate-cancel on confirm dialog Cancel (opened from the overflow menu)', () => {
            // Cancel label uses the action that was active (duplicate).
            // TASK-2240 — the dialog opens via the overflow menu's
            // .sv-anuga-scenario-overflow-duplicate item; the cancel-label
            // semantics are unchanged.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate').click();
            const cancelBtn = container.querySelector('.sv-anuga-scenario-confirm-dialog.is-open .cancel');
            expect(cancelBtn).toExist();
            cancelBtn.click();
            expect(labelsFired()).toInclude('anuga-scenario-menu-duplicate-cancel');
        });
    });

    // TASK-2241 / amendment A3 — react-bootstrap 0.31 MenuItem puts its
    // className on the <li> while onClick lives on the inner <a>, which
    // breaks the "the label fires from the thing that carries the
    // classname" assumption every other parity test in this file relies
    // on. AnugaScenarioOverflowMenu deliberately uses plain
    // <button role="menuitem"> so class + onClick + the fired label all
    // live on the SAME node — this locks that in as a regression guard.
    describe('overflow-menu click targets are anchors, not li elements (amendment A3)', () => {
        it('every kebab menu item is a <button>, never an <li>, and carries its own analytics classname', () => {
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const items = Array.prototype.slice.call(kebabMenu().querySelectorAll('[role="menuitem"]'));
            expect(items.length).toBe(4);
            items.forEach((item) => {
                expect(item.tagName).toBe('BUTTON');
                expect(item.className).toInclude('sv-anuga-scenario-overflow-item');
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

        it('does not render any .sv-scenario-tab element (archive-filter chip UI removed)', () => {
            const store = makeStore({archiveFilter: 'none'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-scenario-tab')).toNotExist();
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

        // UAT re-aim finding 1 superseded TASK-1416's "3 items" rail count —
        // the rail (all categories, including the never-reinstated runLog)
        // is gone entirely now. Coverage lives in the 'Category rail removed'
        // regression guard above; this test keeps the "run log" text-content
        // negative-assertion (it was never specific to the rail's item count).
        it('never renders "run log" as visible text anywhere in the surface', () => {
            const s1 = makeScenario(21, 'A');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect((container.textContent || '').toLowerCase().indexOf('run log')).toBe(-1);
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-category-runLog');
        });

        it('does not render the toolbar .sv-scenario-action-duplicate button', (done) => {
            // Scenarios Option A — Duplicate moved from the toolbar to
            // the header. The toolbar no longer fires the bare
            // 'anuga-scenario-menu-duplicate-scenario' label.
            const s1 = makeScenario(21, 'A', {status: 'built'});
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            setTimeout(() => {
                expect(container.querySelector('.sv-scenario-action-duplicate')).toNotExist();
                expect(labelsFired()).toNotInclude('anuga-scenario-menu-duplicate-scenario');
                done();
            });
        });

        // TASK-2240/2241 (epic 2237, "Compare is REMOVED from the UI
        // entirely; its code stays dark") — the two Compare Umami labels
        // retire into this SAME regression-guard pattern so a future
        // re-add can never silently mint new label spellings for the same
        // feature. No DOM element anywhere (old header cluster, the
        // overflow menu, or elsewhere) can fire either label any more.
        it('does not render .sv-anuga-btn-compare / .anuga-btn-run-compare, and never fires the retired compare labels', () => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-btn-compare')).toNotExist();
            expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
            openKebab(container);
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-compare-tab-toggle');
            expect(labelsFired()).toNotInclude('anuga-scenario-menu-compare-execute');
        });
    });
});
