/*
 * Container-level wiring + header-strip behaviour test for the new
 * Miller-columns anugaScenarioMenu. Re-cut after the Option A header
 * refactor replaced the chip/tab group with the
 * `<span id="scenario-header-actions">` action strip.
 *
 * Anchors:
 *   - Header action strip composition (3 or 4 buttons in the right order).
 *   - + New Scenario dispatches addAnugaScenario via the new class hook.
 *   - Compare-mode toggle (`.sv-anuga-btn-compare`) flips local state, gets
 *     `.is-active` when on, and clears `selected` flags via
 *     toggleScenarioSelected when leaving compare mode.
 *   - Execute Compare button (`.anuga-btn-run-compare`) only renders when
 *     `compareMode && readyToCompare`, and dispatches COMPARE_SCENARIOS.
 *   - Duplicate header button (`.sv-anuga-btn-duplicate-header`) is disabled
 *     without a saved selected scenario and opens the inline confirm
 *     dialog when clicked with one.
 *   - Wave 3C C3: Close X removed per operator decision D3 — top-tab
 *     switch on anugaContainer.js handles panel close + polling stop. The
 *     panel header MUST NOT render a .sv-legend-close element.
 *   - Category rail removed (UAT re-aim, finding 1): no `.sv-anuga-scenario-category-item` / rail / section-label anywhere.
 *
 * Memory pin guardrails:
 *   - feedback-mapstore-react-version-mismatch: use simple
 *     .click()/dispatched-action capture instead of setState→re-render
 *     flush patterns.
 *   - feedback-window-confirm-blocks-automation: beforeEach reassigns
 *     window.confirm to a throw-on-call mock so any synchronous-dialog
 *     code path fails fast.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { AnugaScenarioMenu, AnugaScenarioMenuClass } from '../anugaScenarioMenu';

function makeStore({archiveFilter = 'none', scenariosArr = []} = {}) {
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
        security: { user: { pk: 9999 } }
    };
    const dispatched = [];
    return {
        getState: () => state,
        dispatch: (a) => { dispatched.push(a); return a; },
        subscribe: () => () => {},
        __actions: () => dispatched
    };
}

function makeScenario(id, name, extras = {}) {
    return {
        id, name, status: 'created', created_by: 7,
        terrain: null, boundary: null, inflow: null, rainfall: null,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800,
        ...extras
    };
}

describe('anugaScenarioMenu — header strip wiring', () => {
    let container;
    let origConfirm;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        origConfirm = window.confirm;
        window.confirm = () => { throw new Error('window.confirm was called inside the scenarios surface'); };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        window.confirm = origConfirm;
    });

    // ----------------------------------------------------------------
    // Header action strip composition (Option A refactor)
    // ----------------------------------------------------------------
    describe('Header action strip composition', () => {
        it('renders #scenario-header-actions in place of #scenario-tab-button-group', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // New: action strip.
            expect(container.querySelector('#scenario-header-actions')).toExist();
            // Old chip group must NOT come back.
            expect(container.querySelector('#scenario-tab-button-group')).toNotExist();
        });

        it('renders 3 header buttons in order: New, Compare, Duplicate (when compareMode off)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const strip = container.querySelector('#scenario-header-actions');
            expect(strip).toExist();
            const btns = Array.from(strip.querySelectorAll('button'));
            // 3 buttons rendered (no run-compare).
            expect(btns.length).toBe(3);
            expect(btns[0].className).toInclude('anuga-btn-new-scenario');
            expect(btns[1].className).toInclude('sv-anuga-btn-compare');
            expect(btns[2].className).toInclude('sv-anuga-btn-duplicate-header');
            // run-compare absent.
            expect(strip.querySelector('.anuga-btn-run-compare')).toNotExist();
        });

        it('omits the New Scenario button when canCreateScenario is false', () => {
            // Viewer role kills canCreateScenario.
            const store = makeStore();
            const state = store.getState();
            state.anuga.projects.data.my_role = 'viewer';
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.anuga-btn-new-scenario')).toNotExist();
            // Compare + Duplicate still render.
            expect(container.querySelector('.sv-anuga-btn-compare')).toExist();
            expect(container.querySelector('.sv-anuga-btn-duplicate-header')).toExist();
        });
    });

    // ----------------------------------------------------------------
    // + New Scenario button
    // ----------------------------------------------------------------
    describe('+ New Scenario button', () => {
        it('renders inside .anuga-btn-new-scenario when canCreateScenario is true', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.anuga-btn-new-scenario')).toExist();
        });

        it('dispatches ADD_ANUGA_SCENARIO when clicked', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const btn = container.querySelector('.anuga-btn-new-scenario');
            expect(btn).toExist();
            btn.click();
            const add = store.__actions().find(a => a?.type === 'ADD_ANUGA_SCENARIO');
            expect(add).toExist();
        });
    });

    // ----------------------------------------------------------------
    // Compare-mode toggle
    // ----------------------------------------------------------------
    describe('Compare-mode toggle', () => {
        it('renders .sv-anuga-btn-compare without .is-active by default', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            expect(compareBtn).toExist();
            expect(compareBtn.className).toNotInclude('is-active');
        });

        it('clicking the Compare button flips compareMode + reveals rail checkboxes', (done) => {
            const s1 = makeScenario(21, 'Baseline');
            const s2 = makeScenario(22, 'With levee');
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            const hiddenBefore = container.querySelectorAll('.sv-scenario-rail-item-compare-checkbox.is-hidden');
            expect(hiddenBefore.length).toBe(2);
            compareBtn.click();
            setTimeout(() => {
                const visibleAfter = container.querySelectorAll(
                    '.sv-scenario-rail-item-compare-checkbox:not(.is-hidden)'
                );
                expect(visibleAfter.length).toBe(2);
                const compareBtnAfter = container.querySelector('.sv-anuga-btn-compare');
                expect(compareBtnAfter.className).toInclude('is-active');
                done();
            });
        });

        it('toggling Compare twice clears any `selected` flags via toggleScenarioSelected', (done) => {
            const s1 = makeScenario(21, 'Baseline', {selected: true});
            const s2 = makeScenario(22, 'With levee', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            compareBtn.click(); // enter compare
            setTimeout(() => {
                const compareBtn2 = container.querySelector('.sv-anuga-btn-compare');
                compareBtn2.click(); // leave compare → should clear flags
                setTimeout(() => {
                    const toggles = store.__actions().filter(a => a?.type === 'TOGGLE_SCENARIO_SELECTED');
                    expect(toggles.length).toBe(2);
                    done();
                });
            });
        });
    });

    // ----------------------------------------------------------------
    // Execute Compare button (.anuga-btn-run-compare)
    // ----------------------------------------------------------------
    describe('Execute Compare button', () => {
        it('is absent by default (compareMode off)', () => {
            const store = makeStore({scenariosArr: [makeScenario(21, 'A'), makeScenario(22, 'B')]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
            // Old id should not come back.
            expect(container.querySelector('#depth-difference-button')).toNotExist();
        });

        it('is absent in compare mode when fewer than 2 are selected', (done) => {
            const s1 = makeScenario(21, 'A'); // not selected → readyToCompare=false
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            compareBtn.click();
            setTimeout(() => {
                expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
                done();
            });
        });

        it('renders only when compareMode && readyToCompare (2 selected scenarios)', (done) => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // Before compare-toggle click, button is not rendered.
            expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            compareBtn.click();
            setTimeout(() => {
                expect(container.querySelector('.anuga-btn-run-compare')).toExist();
                done();
            });
        });

        it('dispatches COMPARE_SCENARIOS when clicked with exactly 2 selected', (done) => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const compareBtn = container.querySelector('.sv-anuga-btn-compare');
            compareBtn.click();
            setTimeout(() => {
                const runCompare = container.querySelector('.anuga-btn-run-compare');
                expect(runCompare).toExist();
                runCompare.click();
                const dispatched = store.__actions().filter(a => a?.type === 'COMPARE_SCENARIOS');
                expect(dispatched.length).toBe(1);
                done();
            });
        });
    });

    // ----------------------------------------------------------------
    // Duplicate header button (.sv-anuga-btn-duplicate-header)
    // ----------------------------------------------------------------
    describe('Duplicate header button', () => {
        it('renders and is disabled when no selectedScenario.id', () => {
            // Empty store → no selected.
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const dupBtn = container.querySelector('.sv-anuga-btn-duplicate-header');
            expect(dupBtn).toExist();
            expect(dupBtn.disabled).toBe(true);
            expect(dupBtn.className).toInclude('disabled');
        });

        it('is enabled when a saved scenario is selected', () => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const dupBtn = container.querySelector('.sv-anuga-btn-duplicate-header');
            expect(dupBtn).toExist();
            expect(dupBtn.disabled).toBe(false);
            expect(dupBtn.className).toNotInclude('disabled');
        });

        it('opens the inline confirm dialog (.is-open) when clicked with a selected scenario', (done) => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // Dialog is always rendered; .is-open toggles via CSS.
            const dialog = container.querySelector('.sv-anuga-scenario-confirm-dialog');
            expect(dialog).toExist();
            expect(dialog.className).toNotInclude('is-open');
            const dupBtn = container.querySelector('.sv-anuga-btn-duplicate-header');
            dupBtn.click();
            setTimeout(() => {
                const dialogAfter = container.querySelector('.sv-anuga-scenario-confirm-dialog');
                expect(dialogAfter.className).toInclude('is-open');
                done();
            });
        });

        it('does not open the confirm dialog when disabled (no selected)', (done) => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const dupBtn = container.querySelector('.sv-anuga-btn-duplicate-header');
            // .click() on a `disabled` button is a no-op in JSDOM (no event fires).
            // Defensive: even if it did fire, openConfirm is gated on canDuplicateNow.
            dupBtn.click();
            setTimeout(() => {
                const dialog = container.querySelector('.sv-anuga-scenario-confirm-dialog');
                expect(dialog.className).toNotInclude('is-open');
                done();
            });
        });
    });

    // ----------------------------------------------------------------
    // Category rail REMOVED (UAT re-aim, 2026-07-06, epic 2111 W2 dogfood
    // follow-up, finding 1) — regression guard
    // ----------------------------------------------------------------
    describe('Category rail removed (finding 1)', () => {
        it('renders no .sv-anuga-scenario-category-item / rail / section-label anywhere', () => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-category-rail')).toNotExist();
            expect(container.querySelectorAll('.sv-anuga-scenario-category-item').length).toBe(0);
            expect(container.querySelectorAll('.sv-anuga-scenario-category-section-label').length).toBe(0);
        });
    });

    // ----------------------------------------------------------------
    // Close X removed (Wave 3C C3) — regression guard
    // ----------------------------------------------------------------
    describe('Close X regression (Wave 3C C3)', () => {
        it('does NOT render a .sv-legend-close element in the panel header', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // Operator decision D3: panel exits via top-tab switch on
            // anugaContainer.js, which already toggles
            // setAnugaScenarioMenu + start/stopAnugaScenarioPolling.
            const closeBtn = container.querySelector('.sv-legend-close');
            expect(closeBtn).toNotExist();
        });
    });

    // ----------------------------------------------------------------
    // TASK-2078 — View Results gate + freshness banner (D1: RESULT
    // consumers read latest_complete_run; the status pill/card/error strip
    // stay on latest_run untouched, tested separately).
    // ----------------------------------------------------------------
    describe('TASK-2078 — View Results gate + freshness banner', () => {
        it('shows View Results from the OLDER complete run while a newer run is in-flight (AC1)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-btn-view-results')).toExist();
        });

        // TASK-2115 (C) — one consistent action row: View Results now lives
        // INSIDE #scenario-run-actions (ScenarioHeaderActions), leading the
        // Build/Run/Download/Archive/Delete row, not a separate sibling bar.
        it('TASK-2115: View Results renders inside #scenario-run-actions, not a separate bar', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const strip = container.querySelector('#scenario-run-actions');
            expect(strip).toExist();
            expect(strip.querySelector('.sv-anuga-btn-view-results')).toExist();
            expect(container.querySelector('.sv-anuga-view-results-bar')).toNotExist();
        });

        it('hides View Results when there is no complete run yet (only an in-flight run)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: null
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-btn-view-results')).toNotExist();
        });

        it('shows the freshness banner when latest_run is newer + in-flight (AC1)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-results-freshness-banner')).toExist();
        });

        it('shows the freshness banner when latest_run is newer + errored', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'error'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-results-freshness-banner')).toExist();
        });

        it('clears the banner once the newer run also completes (AC2: latest_run === latest_complete_run)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'complete'},
                latest_complete_run: {id: 2, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-results-freshness-banner')).toNotExist();
            // Results still shown — View Results stays enabled.
            expect(container.querySelector('.sv-anuga-btn-view-results')).toExist();
        });

        it('does not show the banner when there is no complete run at all', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: null
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-results-freshness-banner')).toNotExist();
        });
    });
});

/*
 * UAT #8 correctness fix — "Build and Run" ALWAYS builds then runs (you clicked
 * Build), awaiting the build before running.
 *
 * The container owns the chaining via ONE path: handleBuildAndRunClick validates,
 * dispatches the build and arms a two-phase state machine; componentDidUpdate
 * (maybeRunAfterBuild) advances it as the LIVE scenario status (flowing into
 * this.props.scenarios via the poller) is observed entering an in-flight build
 * state (IN_FLIGHT_STATUSES) and THEN reaching 'built', firing the run exactly
 * once. A bare 'built' never preceded by an observed in-flight episode (a save
 * that did not rebuild, or the stale pre-rebuild 'built' of an already-built
 * scenario) must NOT fire. A build that reaches a failure status (error/cancelled)
 * drops the pending run.
 *
 * These render the unconnected AnugaScenarioMenuClass directly with explicit
 * props (no Provider — none of its descendants are connect()ed) so the test can
 * push fresh scenario status by re-rendering, which drives componentDidUpdate.
 * Dispatches are captured via spies passed as the build/run/save props.
 */
describe('anugaScenarioMenu — Build and Run awaits build (UAT #8)', () => {
    let container;

    // A scenario that PASSES validateScenario (name/terrain/water-source/
    // resolution/duration/boundary all present) at the given lifecycle status.
    function validScenario(id, status, extras = {}) {
        return {
            id,
            name: `Valid ${id}`,
            status,
            terrain: 10,
            boundary: 20,
            inflow: 30,
            rainfall: null,
            friction: null,
            structure: null,
            mesh_region: null,
            network: null,
            resolution: 1000,
            duration: 1800,
            created_by: 9999,
            unsaved: false,
            ...extras
        };
    }

    // Stable spies + base props shared across the re-renders of one test, so the
    // same component instance is reused (preserving the pending-run state) while
    // only scenarios/selectedScenario change. renderMany supports the
    // cross-scenario case where the awaited scenario A is one of several.
    function makeHarness() {
        const buildCalls = [];
        const runCalls = [];
        const saveCalls = [];
        const base = {
            archiveFilter: 'none',
            terrain: [], boundaries: [], inflows: [], rainfalls: [],
            frictions: [], structures: [], meshRegions: [], networks: [],
            computeInstances: [],
            canCreateScenario: true,
            canRunScenario: true,
            myRole: 'editor',
            currentUserId: 9999,
            selectedScenarios: [],
            readyToCompare: false,
            flatLayers: [],
            selectAnugaScenario: () => {},
            setOpenMenuGroupId: () => {},
            saveAnugaScenario: (s) => saveCalls.push(s),
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t})
        };
        const renderMany = (scenarios, selected) => {
            ReactDOM.render(
                <AnugaScenarioMenuClass
                    {...base}
                    scenarios={scenarios}
                    selectedScenario={selected || scenarios[0]}
                />,
                container
            );
        };
        const render = (scenario) => renderMany([scenario], scenario);
        return {buildCalls, runCalls, saveCalls, render, renderMany};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('(a) dispatches build but NOT run in the same tick as the click', () => {
        const {buildCalls, runCalls, render} = makeHarness();
        render(validScenario(31, 'created'));
        const btn = container.querySelector('.sv-scenario-action-build-run');
        expect(btn).toExist();
        btn.click();
        // Build dispatched immediately with the scenario id…
        expect(buildCalls).toEqual([31]);
        // …but run is deferred — it must NOT fire against the unbuilt scenario.
        expect(runCalls.length).toBe(0);
    });

    it('(b) dispatches run once on the building→built transition', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(32, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(runCalls.length).toBe(0);
        // Poller pushes the in-flight build status — still no run, but the
        // state machine now arms for 'built'.
        render(validScenario(32, 'building'));
        expect(runCalls.length).toBe(0);
        // Poller pushes 'built' — run fires, with the FRESH built scenario.
        render(validScenario(32, 'built'));
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].scenario.status).toBe('built');
    });

    it('(c) does NOT dispatch run if the build reaches a failure status', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(33, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(33, 'building'));
        render(validScenario(33, 'error'));
        expect(runCalls.length).toBe(0);
        // A later transition into 'built' must NOT resurrect the dropped run.
        render(validScenario(33, 'built'));
        expect(runCalls.length).toBe(0);
    });

    it('(d) fires run at most once across repeated built / follow-on updates', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(34, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(34, 'building'));
        render(validScenario(34, 'built'));
        expect(runCalls.length).toBe(1);
        // A second 'built' poll tick must not re-fire.
        render(validScenario(34, 'built'));
        expect(runCalls.length).toBe(1);
        // Nor the in-flight status that follows once the run actually starts.
        render(validScenario(34, 'computing'));
        expect(runCalls.length).toBe(1);
    });

    it('(e) already-built: a REBUILD is dispatched and run fires after the rebuild reaches built', () => {
        const {buildCalls, runCalls, render} = makeHarness();
        render(validScenario(35, 'built'));
        container.querySelector('.sv-scenario-action-build-run').click();
        // Always-build semantics: a real server rebuild is dispatched even though
        // the scenario was already built…
        expect(buildCalls).toEqual([35]);
        // …and the run does NOT fire inline against the stale pre-rebuild artifact.
        expect(runCalls.length).toBe(0);
        // The rebuild goes in flight, then settles to 'built' — run fires now.
        render(validScenario(35, 'building'));
        expect(runCalls.length).toBe(0);
        render(validScenario(35, 'built'));
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].scenario.status).toBe('built');
        // …and exactly once — a subsequent 'built' poll tick must not re-fire.
        render(validScenario(35, 'built'));
        expect(runCalls.length).toBe(1);
    });

    it('(f) leak guard: a save with no in-flight episode never arms — a later unrelated building→built does NOT run', () => {
        const {buildCalls, runCalls, saveCalls, render} = makeHarness();
        // Unsaved scenario → handleBuildClick dispatches a SAVE, not a build, so
        // no deferred run is armed.
        render(validScenario(41, 'created', {unsaved: true}));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(saveCalls.length).toBe(1);
        expect(buildCalls.length).toBe(0);
        expect(runCalls.length).toBe(0);
        // Later the (now-saved) scenario undergoes an unrelated build→built. With
        // nothing armed, that transition must NOT surprise-fire a run.
        render(validScenario(41, 'building'));
        render(validScenario(41, 'built'));
        expect(runCalls.length).toBe(0);
    });

    it('(g) cross-scenario: scenario B reaching built does not fire scenario A\'s armed run', () => {
        const {runCalls, renderMany} = makeHarness();
        const a0 = validScenario(51, 'created');
        const b0 = validScenario(52, 'created');
        renderMany([a0, b0], a0);
        // Arm A's Build and Run (A is the selected scenario).
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(runCalls.length).toBe(0);
        // B builds and reaches 'built' while A stays 'created' — A's pending run
        // is keyed to A's id, so B's transition must NOT fire it.
        renderMany([validScenario(51, 'created'), validScenario(52, 'building')], a0);
        renderMany([validScenario(51, 'created'), validScenario(52, 'built')], a0);
        expect(runCalls.length).toBe(0);
        // A's own build→built still fires A's run (and only A's).
        renderMany([validScenario(51, 'building'), validScenario(52, 'built')], a0);
        renderMany([validScenario(51, 'built'), validScenario(52, 'built')], a0);
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].scenario.id).toBe(51);
    });

    /*
     * TASK-2194 (epic 2190 W2) — every run dispatch path passes the
     * Redux-TRANSIENT session choice scenario.compute_target (Scenario has NO
     * such column), or null when none was chosen so the POST omits the field
     * and the server resolves the site default. This pins the RE-RUN
     * regression: the old code sent scenario?.compute_backend || 'local',
     * silently forcing 'local' whenever nothing was chosen.
     */
    it('(h) TASK-2194: Run click with NO session target passes null (field omitted downstream)', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(81, 'built'));
        const btn = container.querySelector('.sv-scenario-action-run');
        expect(btn).toExist();
        btn.click();
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe(null);
    });

    it('(i) TASK-2194: Run click passes the staff-chosen session compute_target verbatim', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(82, 'built', {compute_target: 'batch-gpu-a10g'}));
        container.querySelector('.sv-scenario-action-run').click();
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe('batch-gpu-a10g');
    });

    it('(j) TASK-2194: the deferred build-and-run dispatch carries the session target too', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(83, 'created', {compute_target: 'batch-x32'}));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(runCalls.length).toBe(0);
        render(validScenario(83, 'building', {compute_target: 'batch-x32'}));
        render(validScenario(83, 'built', {compute_target: 'batch-x32'}));
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe('batch-x32');
    });
});

/*
 * TASK-2116 (F4) — build-time confirm for a drawn-but-unattached MeshRegion.
 * Same unconnected AnugaScenarioMenuClass + spy-prop pattern as the UAT #8
 * block above (no Redux store needed — meshRegionNeedsWarning reads
 * this.props.meshRegions directly).
 */
describe('anugaScenarioMenu — MeshRegion unattached build confirm (TASK-2116)', () => {
    let container;

    // Passes validateScenario (mesh_region is legitimately optional) so the
    // click reaches the mesh-region-warning gate rather than the
    // missing-field validation dialog.
    function validScenario(id, extras = {}) {
        return {
            id, name: `Valid ${id}`, status: 'created',
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, created_by: 9999, unsaved: false,
            ...extras
        };
    }

    function makeHarness(meshRegions) {
        const buildCalls = [];
        const runCalls = [];
        const base = {
            archiveFilter: 'none',
            terrain: [], boundaries: [], inflows: [], rainfalls: [],
            frictions: [], structures: [], meshRegions: meshRegions || [], networks: [],
            computeInstances: [],
            canCreateScenario: true,
            canRunScenario: true,
            myRole: 'editor',
            currentUserId: 9999,
            selectedScenarios: [],
            readyToCompare: false,
            flatLayers: [],
            selectAnugaScenario: () => {},
            setOpenMenuGroupId: () => {},
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t})
        };
        const render = (scenario) => {
            ReactDOM.render(
                <AnugaScenarioMenuClass {...base} scenarios={[scenario]} selectedScenario={scenario} />,
                container
            );
        };
        return {buildCalls, runCalls, render};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('Build click opens the warning dialog instead of dispatching, when a drawn region is unattached', () => {
        const {buildCalls, render} = makeHarness([{id: 9, title: 'Corridor 10m'}]);
        render(validScenario(61));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        const dialog = container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open');
        expect(dialog).toExist();
        expect(dialog.textContent).toInclude('hydrata.anuga.meshRegionUnattachedConfirm');
    });

    it('Build click dispatches immediately when no mesh regions are drawn (AC3)', () => {
        const {buildCalls, render} = makeHarness([]);
        render(validScenario(62));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(1);
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toNotExist();
    });

    it('Build click dispatches immediately when a mesh region is already attached (AC3)', () => {
        const {buildCalls, render} = makeHarness([{id: 9, title: 'Corridor 10m'}]);
        render(validScenario(63, {mesh_region: 9}));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(1);
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toNotExist();
    });

    it('"Build anyway" dispatches the deferred build and closes the dialog (NO auto-attach)', () => {
        const {buildCalls, render} = makeHarness([{id: 9, title: 'Corridor 10m'}]);
        render(validScenario(64));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        container.querySelector('.sv-anuga-mesh-region-build-anyway').click();
        expect(buildCalls.length).toBe(1);
        expect(buildCalls[0]).toBe(64);
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toNotExist();
    });

    it('"Attach first" closes the dialog WITHOUT building and focuses #mesh_region', () => {
        const {buildCalls, render} = makeHarness([{id: 9, title: 'Corridor 10m'}]);
        render(validScenario(65));
        container.querySelector('.sv-scenario-action-build').click();
        container.querySelector('.sv-anuga-mesh-region-attach-first').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toNotExist();
        expect(document.activeElement.id).toBe('mesh_region');
    });

    it('Build-and-Run click ALSO opens the warning dialog when unattached (AC2)', () => {
        const {buildCalls, runCalls, render} = makeHarness([{id: 9, title: 'Corridor 10m'}]);
        render(validScenario(66));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(buildCalls.length).toBe(0);
        expect(runCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toExist();
    });
});

/*
 * TASK-2160 (epic 2147 W4) — build-time confirm for a drawn-but-unattached
 * Rainfall. Direct mirror of the MeshRegion block above, with one extra case:
 * a scenario tripping BOTH warnings surfaces rainfall first, then the mesh
 * warning on "Build anyway" (proceedPastRainfall composition).
 */
describe('anugaScenarioMenu — Rainfall unattached build confirm (TASK-2160)', () => {
    let container;

    // Passes validateScenario (inflow set, so inflowOrRainfall is satisfied)
    // so the click reaches the rainfall-warning gate rather than the
    // missing-field validation dialog.
    function validScenario(id, extras = {}) {
        return {
            id, name: `Valid ${id}`, status: 'created',
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, created_by: 9999, unsaved: false,
            ...extras
        };
    }

    function makeHarness({rainfalls, meshRegions} = {}) {
        const buildCalls = [];
        const runCalls = [];
        const base = {
            archiveFilter: 'none',
            terrain: [], boundaries: [], inflows: [],
            rainfalls: rainfalls || [], meshRegions: meshRegions || [],
            frictions: [], structures: [], networks: [],
            computeInstances: [],
            canCreateScenario: true,
            canRunScenario: true,
            myRole: 'editor',
            currentUserId: 9999,
            selectedScenarios: [],
            readyToCompare: false,
            flatLayers: [],
            selectAnugaScenario: () => {},
            setOpenMenuGroupId: () => {},
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t})
        };
        const render = (scenario) => {
            ReactDOM.render(
                <AnugaScenarioMenuClass {...base} scenarios={[scenario]} selectedScenario={scenario} />,
                container
            );
        };
        return {buildCalls, runCalls, render};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('Build click opens the rainfall warning dialog instead of dispatching, when a drawn rainfall is unattached', () => {
        const {buildCalls, render} = makeHarness({rainfalls: [{id: 6, title: 'Design Storm 1%'}]});
        render(validScenario(71));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        const dialog = container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open');
        expect(dialog).toExist();
        expect(dialog.textContent).toInclude('hydrata.anuga.rainfallUnattachedConfirm');
    });

    it('Build click dispatches immediately when no rainfalls are drawn', () => {
        const {buildCalls, render} = makeHarness({rainfalls: []});
        render(validScenario(72));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(1);
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toNotExist();
    });

    it('Build click dispatches immediately when a rainfall is already attached', () => {
        const {buildCalls, render} = makeHarness({rainfalls: [{id: 6, title: 'Design Storm 1%'}]});
        render(validScenario(73, {rainfall: 6}));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(1);
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toNotExist();
    });

    it('"Build anyway" dispatches the deferred build and closes the dialog (NO auto-attach)', () => {
        const {buildCalls, render} = makeHarness({rainfalls: [{id: 6, title: 'Design Storm 1%'}]});
        render(validScenario(74));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        container.querySelector('.sv-anuga-rainfall-build-anyway').click();
        expect(buildCalls.length).toBe(1);
        expect(buildCalls[0]).toBe(74);
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toNotExist();
    });

    it('"Attach first" closes the dialog WITHOUT building and focuses #rainfall', () => {
        const {buildCalls, render} = makeHarness({rainfalls: [{id: 6, title: 'Design Storm 1%'}]});
        render(validScenario(75));
        // #rainfall lives in the pane; render includes ScenarioPane so the
        // selector exists in the DOM to receive focus.
        container.querySelector('.sv-scenario-action-build').click();
        container.querySelector('.sv-anuga-rainfall-attach-first').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toNotExist();
        expect(document.activeElement.id).toBe('rainfall');
    });

    it('Build-and-Run click ALSO opens the rainfall warning dialog when unattached', () => {
        const {buildCalls, runCalls, render} = makeHarness({rainfalls: [{id: 6, title: 'Design Storm 1%'}]});
        render(validScenario(76));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(buildCalls.length).toBe(0);
        expect(runCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toExist();
    });

    it('composition: "Build anyway" on rainfall then surfaces the mesh-region warning when BOTH are unattached', () => {
        const {buildCalls, render} = makeHarness({
            rainfalls: [{id: 6, title: 'Design Storm 1%'}],
            meshRegions: [{id: 9, title: 'Corridor 10m'}]
        });
        render(validScenario(77));
        container.querySelector('.sv-scenario-action-build').click();
        // Rainfall warning first, mesh not yet shown, nothing dispatched.
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toExist();
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toNotExist();
        expect(buildCalls.length).toBe(0);
        // Acknowledge rainfall → mesh-region warning surfaces, still no dispatch.
        container.querySelector('.sv-anuga-rainfall-build-anyway').click();
        expect(container.querySelector('.sv-anuga-rainfall-warning-dialog.is-open')).toNotExist();
        expect(container.querySelector('.sv-anuga-mesh-region-warning-dialog.is-open')).toExist();
        expect(buildCalls.length).toBe(0);
        // Acknowledge mesh → the build finally dispatches.
        container.querySelector('.sv-anuga-mesh-region-build-anyway').click();
        expect(buildCalls.length).toBe(1);
        expect(buildCalls[0]).toBe(77);
    });
});

/*
 * Regression guard — source-text scan for window.confirm / window.alert.
 *
 * Stops the bug class from recurring (memory pin
 * feedback-window-confirm-blocks-automation). Chrome DevTools MCP cannot
 * dismiss native dialogs and Karma+JSDOM does not stand them up at all,
 * so every confirm/alert site must live in an always-rendered inline
 * dialog.
 *
 * Uses raw-loader to read the source files at test time; this is a
 * lint-equivalent check that runs alongside the suite. Comments are
 * stripped before the scan so historical "we replaced window.confirm
 * with an inline dialog" doc comments do not trip the guard.
 */
function stripComments(src) {
    // Strip /* … */ block comments and // line comments. This is good
    // enough for our purposes; we just need to keep the legitimate
    // "no window.confirm" comments from poisoning the assertion.
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

describe('Scenarios surface — window.confirm/alert regression guard', () => {
    // Load source via webpack raw-loader so the assertion runs against
    // the deployed bytes, not against a re-imported AST.
    const menuRawResult = require(
        '!!raw-loader!../anugaScenarioMenu.js'
    );
    const headerActionsRawResult = require(
        '!!raw-loader!../scenarioHeaderActions.js'
    );
    const menuSrc = stripComments(
        typeof menuRawResult === 'string' ? menuRawResult : (menuRawResult && menuRawResult.default)
    );
    const headerActionsSrc = stripComments(
        typeof headerActionsRawResult === 'string' ? headerActionsRawResult : (headerActionsRawResult && headerActionsRawResult.default)
    );

    it('anugaScenarioMenu.js (code) does not call window.confirm', () => {
        expect(menuSrc).toExist();
        expect(menuSrc).toNotInclude('window.confirm');
    });

    it('anugaScenarioMenu.js (code) does not call window.alert', () => {
        expect(menuSrc).toNotInclude('window.alert');
    });

    it('scenarioHeaderActions.js (code) does not call window.confirm', () => {
        expect(headerActionsSrc).toExist();
        expect(headerActionsSrc).toNotInclude('window.confirm');
    });

    it('scenarioHeaderActions.js (code) does not call window.alert', () => {
        expect(headerActionsSrc).toNotInclude('window.alert');
    });
});
