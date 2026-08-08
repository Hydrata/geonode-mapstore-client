/*
 * Container-level wiring + header-strip behaviour test for the new
 * Miller-columns anugaScenarioMenu. Re-cut after the Option A header
 * refactor replaced the chip/tab group with the
 * `<span id="scenario-header-actions">` action strip; re-cut AGAIN for
 * TASK-2240 (epic 2237 W1.2), which replaced that strip's New/Compare/
 * Duplicate buttons with a single custom portaled overflow (kebab) menu
 * (AnugaScenarioOverflowMenu) carrying New scenario / Duplicate /
 * Archive-Restore / Delete. Compare's UI entry is REMOVED entirely.
 *
 * Anchors:
 *   - Header renders exactly one kebab trigger; opening it portals a menu
 *     with New scenario / Duplicate / Archive / Delete, in that order.
 *   - The kebab itself is gated on canCreateScenario (scenario-INDEPENDENT
 *     — the menu, not just one item inside it, disappears for a viewer).
 *   - + New scenario dispatches addAnugaScenario via the new class hook.
 *   - Compare is REMOVED entirely — regression guard below.
 *   - Duplicate menu item is disabled without a saved selected scenario and
 *     opens the inline confirm dialog when clicked with one.
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
import { Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

import {
    AnugaScenarioMenu, AnugaScenarioMenuClass,
    // TASK-2684 (W6.75.2, epic 2618) — Results menu redesign exports.
    AnugaResultsMenu, AnugaResultsMenuClass,
    buildPlaybackManifestUrl, scenarioHasActivatablePlayback, ANUGA_RESULTS_PLAYBACK_LAYER_ID
} from '../anugaScenarioMenu';
import { PLAYBACK_INIT } from '../../playback/actions/playbackActions';
// TASK-2194 (review fix) — real reducer tree + action creators for the
// session compute-target integration block (drives the REAL store paths the
// original fixture-seeded specs bypassed).
import anuga from '../../reducersAnuga';
import {
    setAnugaScenarioData,
    setAnugaPollingData,
    setAnugaComputeConfig,
    selectAnugaScenario,
    SAVE_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    RUN_ANUGA_SCENARIO,
    UPDATE_ANUGA_SCENARIO,
    BUILD_SCENARIO
} from '../../actionsAnuga';

function makeStore({archiveFilter = 'none', scenariosArr = [], anugaPlayback} = {}) {
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
        security: { user: { pk: 9999 } },
        // TASK-2684 — AnugaResultsMenu reads this for the "active" row
        // highlight; defaults to no run loaded (IDLE-equivalent runId null).
        anugaPlayback: anugaPlayback || { runId: null, layerId: null }
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

// TASK-2240 — the overflow menu portals to document.body, so its items are
// never inside `container`; open it via the trigger and read the portal off
// the document.
function openKebab(container) {
    const trigger = container.querySelector('.sv-anuga-scenario-overflow-trigger');
    trigger.click();
    return trigger;
}
function kebabMenu() {
    return document.querySelector('.sv-anuga-scenario-overflow-menu');
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
    // Header action strip composition (TASK-2240 — single kebab menu)
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

        it('renders exactly one kebab trigger; opening it lists New / Duplicate / Archive / Delete in order', () => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const strip = container.querySelector('#scenario-header-actions');
            expect(strip).toExist();
            expect(strip.querySelectorAll('.sv-anuga-scenario-overflow-trigger').length).toBe(1);
            openKebab(container);
            const items = Array.prototype.slice.call(kebabMenu().querySelectorAll('[role="menuitem"]'));
            expect(items.length).toBe(4);
            expect(items[0].className).toInclude('sv-anuga-scenario-overflow-new');
            expect(items[1].className).toInclude('sv-anuga-scenario-overflow-duplicate');
            expect(items[2].className).toInclude('sv-anuga-scenario-overflow-archive');
            expect(items[3].className).toInclude('sv-anuga-scenario-overflow-delete');
        });

        it('the kebab itself is gated on canCreateScenario (viewer role never sees it — scenario-independent gate)', () => {
            // Viewer role kills canCreateScenario.
            const store = makeStore();
            const state = store.getState();
            state.anuga.projects.data.my_role = 'viewer';
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toNotExist();
        });
    });

    // ----------------------------------------------------------------
    // + New Scenario menu item
    // ----------------------------------------------------------------
    describe('+ New Scenario menu item', () => {
        it('renders inside the kebab menu when canCreateScenario is true', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            expect(kebabMenu().querySelector('.sv-anuga-scenario-overflow-new')).toExist();
        });

        it('is enabled + dispatches ADD_ANUGA_SCENARIO even with NO scenario selected (survives the empty project)', () => {
            const store = makeStore(); // no scenarios → no selectedScenario
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const btn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-new');
            expect(btn.disabled).toBe(false);
            btn.click();
            const add = store.__actions().find(a => a?.type === 'ADD_ANUGA_SCENARIO');
            expect(add).toExist();
        });
    });

    // ----------------------------------------------------------------
    // Compare REMOVED entirely (epic 2237 amendment, TASK-2240) —
    // regression guard. No button anywhere (old header cluster OR the
    // kebab menu) can dispatch COMPARE_SCENARIOS or reveal the rail's
    // compare checkboxes any more.
    // ----------------------------------------------------------------
    describe('Compare removed entirely (TASK-2240)', () => {
        it('renders no .sv-anuga-btn-compare / .anuga-btn-run-compare anywhere', () => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-btn-compare')).toNotExist();
            expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
            // Old id should not come back either.
            expect(container.querySelector('#depth-difference-button')).toNotExist();
        });

        it('rail compare-checkboxes stay permanently hidden (compareMode can never become true)', () => {
            const s1 = makeScenario(21, 'Baseline');
            const s2 = makeScenario(22, 'With levee');
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const hidden = container.querySelectorAll('.sv-scenario-rail-item-compare-checkbox.is-hidden');
            expect(hidden.length).toBe(2);
            expect(container.querySelectorAll('.sv-scenario-rail-item-compare-checkbox:not(.is-hidden)').length).toBe(0);
        });

        it('never dispatches COMPARE_SCENARIOS or TOGGLE_SCENARIO_SELECTED from the header', () => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            expect(store.__actions().filter(a => a?.type === 'COMPARE_SCENARIOS').length).toBe(0);
            expect(store.__actions().filter(a => a?.type === 'TOGGLE_SCENARIO_SELECTED').length).toBe(0);
        });
    });

    // ----------------------------------------------------------------
    // Duplicate menu item (.sv-anuga-scenario-overflow-duplicate)
    // ----------------------------------------------------------------
    describe('Duplicate menu item', () => {
        it('is disabled when no selectedScenario.id', () => {
            // Empty store → no selected.
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const dupBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate');
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
            openKebab(container);
            const dupBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate');
            expect(dupBtn).toExist();
            expect(dupBtn.disabled).toBe(false);
            expect(dupBtn.className).toNotInclude('disabled');
        });

        it('opens the inline confirm dialog (.is-open) when clicked with a selected scenario', () => {
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
            openKebab(container);
            kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate').click();
            const dialogAfter = container.querySelector('.sv-anuga-scenario-confirm-dialog');
            expect(dialogAfter.className).toInclude('is-open');
        });

        it('does not open the confirm dialog when disabled (no selected)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            openKebab(container);
            const dupBtn = kebabMenu().querySelector('.sv-anuga-scenario-overflow-duplicate');
            // .click() on a `disabled` button is a no-op in JSDOM (no event fires).
            // Defensive: even if it did fire, the item's own onClick is gated on
            // canDuplicateNow.
            dupBtn.click();
            const dialog = container.querySelector('.sv-anuga-scenario-confirm-dialog');
            expect(dialog.className).toNotInclude('is-open');
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

        // TASK-2684 (W6.75.2, epic 2618) — View Results now activates
        // playback for the scenario instead of toggling the 3 static
        // max-raster layers' visibility.
        it('clicking View Results dispatches playbackInit with the run id, the stable layer id, and the run\'s manifest URL', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_complete_run: {id: 501, status: 'complete', has_playback_store: true}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            container.querySelector('.sv-anuga-btn-view-results').click();
            const initAction = store.__actions().find(a => a.type === PLAYBACK_INIT);
            expect(initAction).toExist();
            expect(initAction.runId).toBe('501');
            expect(initAction.layerId).toBe(ANUGA_RESULTS_PLAYBACK_LAYER_ID);
            expect(initAction.manifestUrl).toBe(buildPlaybackManifestUrl(501));
        });

        it('clicking View Results is a no-op (pre-authorized tradeoff) when the complete run has no playback store', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_complete_run: {id: 501, status: 'complete', has_playback_store: false}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            container.querySelector('.sv-anuga-btn-view-results').click();
            expect(store.__actions().find(a => a.type === PLAYBACK_INIT)).toNotExist();
        });

        // TASK-2243 (epic 2237 W2.1) — the freshness banner relocated into
        // the notices panel (scenarioPane.js's ScenarioNoticesPanel, nested
        // INSIDE this same AnugaScenarioMenu tree via renderPane), under new
        // classnames (the old .sv-anuga-results-freshness-banner retired —
        // nothing outside anugaScenarioMenu.js/scenarioPane.js consumed it).
        // Both variants still exist under their ORIGINAL msgIds — see
        // scenarioPane-test.js's 'Results-freshness notice' block for the
        // msgId/role assertions; these container-level specs just prove the
        // notice actually surfaces through the connected menu.
        it('shows the failed-variant freshness notice inside the notices panel when latest_run is newer + errored', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'error'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const panel = container.querySelector('.sv-anuga-notices-panel');
            expect(panel).toExist();
            expect(panel.querySelector('.sv-anuga-scenario-results-freshness-failed-hint')).toExist();
            expect(panel.querySelector('.sv-anuga-scenario-results-freshness-building-hint')).toNotExist();
        });

        it('shows the building-variant freshness notice inside the notices panel when latest_run is newer + in-flight (AC1)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: {id: 1, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const panel = container.querySelector('.sv-anuga-notices-panel');
            expect(panel).toExist();
            expect(panel.querySelector('.sv-anuga-scenario-results-freshness-building-hint')).toExist();
            expect(panel.querySelector('.sv-anuga-scenario-results-freshness-failed-hint')).toNotExist();
        });

        it('clears the freshness notice once the newer run also completes (AC2: latest_run === latest_complete_run)', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'complete'},
                latest_complete_run: {id: 2, status: 'complete'}
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-results-freshness-failed-hint')).toNotExist();
            expect(container.querySelector('.sv-anuga-scenario-results-freshness-building-hint')).toNotExist();
            // Results still shown — View Results stays enabled.
            expect(container.querySelector('.sv-anuga-btn-view-results')).toExist();
        });

        it('does not show a freshness notice when there is no complete run at all', () => {
            const s1 = makeScenario(21, 'Baseline', {
                latest_run: {id: 2, status: 'computing'},
                latest_complete_run: null
            });
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-results-freshness-failed-hint')).toNotExist();
            expect(container.querySelector('.sv-anuga-scenario-results-freshness-building-hint')).toNotExist();
        });
    });
});

// TASK-2684 (W6.75.2, epic 2618) — Results menu simplification: one row per
// scenario, no per-quantity (Depth/Velocity/Depth Integrated Velocity)
// selectors or their column.
describe('scenarioHasActivatablePlayback / buildPlaybackManifestUrl (pure helpers)', () => {
    it('buildPlaybackManifestUrl mirrors the built-mesh-binary sibling action\'s URL shape', () => {
        expect(buildPlaybackManifestUrl(501)).toBe('/api/v2/anuga/runs/501/playback-manifest/');
    });

    it('a complete run WITH has_playback_store is activatable', () => {
        expect(scenarioHasActivatablePlayback({latest_complete_run: {id: 1, has_playback_store: true}})).toBe(true);
    });

    it('a complete run WITHOUT has_playback_store is NOT activatable (pre-authorized tradeoff)', () => {
        expect(scenarioHasActivatablePlayback({latest_complete_run: {id: 1, has_playback_store: false}})).toBe(false);
        expect(scenarioHasActivatablePlayback({latest_complete_run: {id: 1}})).toBe(false);
    });

    it('no complete run at all is NOT activatable', () => {
        expect(scenarioHasActivatablePlayback({latest_complete_run: null})).toBe(false);
        expect(scenarioHasActivatablePlayback({})).toBe(false);
        expect(scenarioHasActivatablePlayback(null)).toBe(false);
    });
});

describe('AnugaResultsMenuClass (unconnected — rendering logic)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('renders exactly one row per scenario with an activatable run, labelled with the scenario name', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'Upstream diversion', {latest_complete_run: {id: 102, has_playback_store: true}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toBe('Baseline');
        expect(rows[1].textContent).toBe('Upstream diversion');
    });

    it('AC: no Depth / Velocity / Depth Integrated Velocity selectors or column anywhere in the output', () => {
        const scenarios = [makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}})];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        const text = container.textContent;
        expect(text).toNotMatch(/Depth Integrated Velocity/);
        expect(text).toNotMatch(/\bVelocity\b/);
        // A bare "Depth" WOULD false-positive on a scenario literally named
        // "Depth" — not a concern here (fixture scenario names above), so a
        // direct substring check is safe and simpler than a DOM-structure walk.
        expect(text).toNotMatch(/\bDepth\b/);
    });

    it('excludes a scenario with no complete run (row absent, not a dead affordance)', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'No runs yet', {latest_complete_run: null})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toBe('Baseline');
    });

    it('excludes a scenario whose complete run has NO playback store (pre-authorized tradeoff — same treatment as no complete run)', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'Legacy run', {latest_complete_run: {id: 102, has_playback_store: false}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toBe('Baseline');
    });

    it('renders a clear non-actionable empty state when NO scenario has an activatable run', () => {
        const scenarios = [makeScenario(1, 'Baseline', {latest_complete_run: null})];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        expect(container.querySelectorAll('.sv-anuga-results-row').length).toBe(0);
        expect(container.querySelector('[data-testid="anuga-results-empty"]')).toExist();
    });

    it('marks the row matching activeRunId as active; only ONE row is ever active', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'Alternate', {latest_complete_run: {id: 102, has_playback_store: true}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={'102'} onSelectScenario={() => {}} />,
            container
        );
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        const activeRows = [...rows].filter(r => r.className.includes('active'));
        expect(activeRows.length).toBe(1);
        expect(activeRows[0].textContent).toBe('Alternate');
    });

    it('clicking a row calls onSelectScenario with that scenario', () => {
        const scenario = makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}});
        let selected = null;
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={[scenario]} activeRunId={null} onSelectScenario={(s) => { selected = s; }} />,
            container
        );
        container.querySelector('.sv-anuga-results-row').click();
        expect(selected).toBe(scenario);
    });
});

describe('AnugaResultsMenu (connected)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('selecting a scenario dispatches playbackInit (activates playback) and closes the Scenarios menu', () => {
        const s1 = makeScenario(21, 'Baseline', {latest_complete_run: {id: 501, has_playback_store: true}});
        const store = makeStore({scenariosArr: [s1]});
        ReactDOM.render(
            <Provider store={store}><AnugaResultsMenu /></Provider>,
            container
        );
        container.querySelector('.sv-anuga-results-row').click();
        const actions = store.__actions();
        const initAction = actions.find(a => a.type === PLAYBACK_INIT);
        expect(initAction).toExist();
        expect(initAction.runId).toBe('501');
        expect(initAction.layerId).toBe(ANUGA_RESULTS_PLAYBACK_LAYER_ID);
        expect(initAction.manifestUrl).toBe(buildPlaybackManifestUrl(501));
        // setAnugaScenarioMenu(false) — SET_ANUGA_SCENARIO_MENU action type,
        // imported indirectly via its dispatched shape (no new import needed:
        // asserting the visible flag lands on the payload is enough here).
        expect(actions.some(a => a.visible === false)).toBe(true);
    });

    it('GIVEN a second scenario is selected THEN the first is no longer the active run (never two active at once)', () => {
        const s1 = makeScenario(21, 'Baseline', {latest_complete_run: {id: 501, has_playback_store: true}});
        const s2 = makeScenario(22, 'Alternate', {latest_complete_run: {id: 502, has_playback_store: true}});
        // Simulate scenario 1 already active (as if a prior PLAYBACK_INIT landed).
        const store = makeStore({scenariosArr: [s1, s2], anugaPlayback: {runId: '501', layerId: ANUGA_RESULTS_PLAYBACK_LAYER_ID}});
        ReactDOM.render(
            <Provider store={store}><AnugaResultsMenu /></Provider>,
            container
        );
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        const s1Row = [...rows].find(r => r.textContent === 'Baseline');
        const s2Row = [...rows].find(r => r.textContent === 'Alternate');
        expect(s1Row.className).toContain('active');
        expect(s2Row.className).toNotContain('active');
        // Select scenario 2 — the SAME stable layerId means playbackInitEpic
        // replaces the single active run in place (playbackController's
        // reducer state is a runId/layerId singleton), never two active runs.
        s2Row.click();
        const initAction = store.__actions().find(a => a.type === PLAYBACK_INIT);
        expect(initAction.runId).toBe('502');
        expect(initAction.layerId).toBe(ANUGA_RESULTS_PLAYBACK_LAYER_ID); // SAME id as scenario 1's — replaces in place
    });

    it('clicking a non-actionable row is impossible — the row is simply absent', () => {
        const s1 = makeScenario(21, 'No runs', {latest_complete_run: null});
        const store = makeStore({scenariosArr: [s1]});
        ReactDOM.render(
            <Provider store={store}><AnugaResultsMenu /></Provider>,
            container
        );
        expect(container.querySelectorAll('.sv-anuga-results-row').length).toBe(0);
        expect(store.__actions().find(a => a.type === PLAYBACK_INIT)).toNotExist();
    });
});

/*
 * UAT #8 correctness fix — "Build and Run" ALWAYS BUILDS then, byte-identical
 * to before, RUNS awaiting the build.
 *
 * TASK-2211 (W3.2, epic 2204, od-4) — DOCUMENTED REVERSAL: the run half of
 * "ALWAYS...runs" is no longer unconditional. All the fixtures in THIS
 * describe block carry no `latest_run` (or one with no mesh_provenance), so
 * getMeshDivergence always resolves exceedsThreshold=false for them — they
 * exercise exactly the byte-identical below-threshold/missing-data path and
 * remain valid, UNCHANGED tests of that path. The new interrupt-on-divergence
 * behaviour (pause / confirm / cancel) is covered by its OWN describe block
 * below ("anugaScenarioMenu — divergence interrupt on Build-and-Run").
 *
 * The container owns the chaining via ONE path: handleBuildAndRunClick validates,
 * dispatches the build and arms a two-phase state machine; componentDidUpdate
 * (maybeRunAfterBuild) advances it as the LIVE scenario status (flowing into
 * this.props.scenarios via the poller) is observed entering an in-flight build
 * state (IN_FLIGHT_STATUSES) and THEN reaching 'built', resolving exactly
 * once (fire the run, or — TASK-2211 — pause for a divergence confirm). A bare
 * 'built' never preceded by an observed in-flight episode (a save that did
 * not rebuild, or the stale pre-rebuild 'built' of an already-built scenario)
 * must NOT fire. A build that reaches a failure status (error/cancelled)
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
    // `extraProps` lets a spec pin e.g. sessionComputeTargets (TASK-2194).
    function makeHarness(extraProps = {}) {
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
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t}),
            ...extraProps
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
     * TASK-2194 (epic 2190 W2, review fix) — every run dispatch path passes
     * the staff user's THIS-SESSION choice read from the per-scenario ui
     * slot (props.sessionComputeTargets, i.e.
     * state.anuga.ui.sessionComputeTargets — NOT a field on the scenario
     * object, which a save/refresh wholesale-replace would wipe), or null
     * when none was chosen so the POST omits the field and the server
     * resolves the site default. This pins the RE-RUN regression: the old
     * code sent scenario?.compute_backend || 'local', silently forcing
     * 'local' whenever nothing was chosen. The full UI-reachable path
     * (pane select -> unsaved untouched -> build-and-run -> dispatch) is
     * covered by the real-store integration block below.
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

    it('(i) TASK-2194: Run click passes the session choice from the ui slot verbatim', () => {
        const {runCalls, render} = makeHarness({sessionComputeTargets: {82: 'batch-gpu-a10g'}});
        render(validScenario(82, 'built'));
        container.querySelector('.sv-scenario-action-run').click();
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe('batch-gpu-a10g');
    });

    it('(j) TASK-2194: the deferred build-and-run dispatch carries the session choice too', () => {
        const {runCalls, render} = makeHarness({sessionComputeTargets: {83: 'batch-x32'}});
        render(validScenario(83, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(runCalls.length).toBe(0);
        render(validScenario(83, 'building'));
        render(validScenario(83, 'built'));
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe('batch-x32');
    });

    it('(k) TASK-2194: a choice for ANOTHER scenario never leaks into this run dispatch', () => {
        const {runCalls, render} = makeHarness({sessionComputeTargets: {999: 'batch-gpu-a10g'}});
        render(validScenario(84, 'built'));
        container.querySelector('.sv-scenario-action-run').click();
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].target).toBe(null);
    });
});

/*
 * TASK-2211 (W3.2, epic 2204, od-4) — divergence interrupt on Build-and-Run.
 *
 * Explicit-reversal tests for the "Build and Run ALWAYS runs" claim the
 * describe block above pins for the below-threshold/missing-data path only.
 * These pin the ABOVE-threshold pause/confirm/cancel behaviour AC#1
 * introduces, AC#2's byte-identical-below-threshold guarantee WITH real
 * comparison data present (not just absent, as above), and AC#4's
 * settings-tunable threshold.
 */
describe('anugaScenarioMenu — divergence interrupt on Build-and-Run (TASK-2211, od-4)', () => {
    let container;

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

    function builtWithComparison(id, {actual, estimate, provenance} = {}) {
        const meshProvenance = provenance !== undefined
            ? provenance
            : (estimate !== undefined ? {pre_build_triangle_estimate: estimate} : {});
        return validScenario(id, 'built', {
            latest_run: {
                id: id * 10,
                status: 'complete',
                mesh_triangle_count: actual !== undefined ? actual : 0,
                mesh_provenance: meshProvenance
            }
        });
    }

    function makeHarness(extraProps = {}) {
        const buildCalls = [];
        const runCalls = [];
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
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t}),
            ...extraProps
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

    it('AC#1: pauses (does not fire) when the actual mesh diverges beyond the default (2x) threshold', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(201, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(201, 'building'));
        // actual 300,000 vs estimate 100,000 -> 3x, above the 2x default.
        render(builtWithComparison(201, {actual: 300000, estimate: 100000}));
        expect(runCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toExist();
    });

    it('AC#1: one confirm click fires the deferred run', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(202, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(202, 'building'));
        render(builtWithComparison(202, {actual: 300000, estimate: 100000}));
        expect(runCalls.length).toBe(0);
        container.querySelector('.sv-anuga-divergence-confirm-run').click();
        expect(runCalls.length).toBe(1);
        expect(runCalls[0].scenario.id).toBe(202);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
    });

    it('AC#1: Cancel dispatches no run — the scenario stays "built"', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(203, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(203, 'building'));
        const built = builtWithComparison(203, {actual: 300000, estimate: 100000});
        render(built);
        container.querySelector('.sv-anuga-divergence-confirm-cancel').click();
        expect(runCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
        // A later, unrelated re-render of the SAME (still-built) scenario must
        // not resurrect the dropped run — Cancel is a terminal decision.
        render(built);
        expect(runCalls.length).toBe(0);
    });

    it('AC#2: at/below threshold, auto-fires byte-identically EVEN WITH real comparison data present', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(204, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(204, 'building'));
        // actual 150,000 vs estimate 100,000 -> 1.5x, below the 2x default.
        render(builtWithComparison(204, {actual: 150000, estimate: 100000}));
        expect(runCalls.length).toBe(1);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
    });

    it('AC#2: exactly AT the threshold auto-fires (strictly-greater-than gate)', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(205, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(205, 'building'));
        render(builtWithComparison(205, {actual: 200000, estimate: 100000})); // exactly 2x
        expect(runCalls.length).toBe(1);
    });

    // Edge case (epic environment note, VERIFIED live): a FAILED build
    // carries an EMPTY mesh_provenance {} — can't evaluate divergence, must
    // take the below-threshold (auto-fire) path, never pause on missing data.
    it('edge case: empty mesh_provenance (failed-build shape) never pauses', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(206, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(206, 'building'));
        render(builtWithComparison(206, {actual: 0, provenance: {}}));
        expect(runCalls.length).toBe(1);
    });

    // Edge case (AC context) — a completed build with NO stamped estimate
    // (legacy scenario built pre-W2) carries mesh_provenance: null. Can't
    // evaluate divergence -> below-threshold path, never pauses.
    it('edge case: null mesh_provenance (legacy pre-W2 scenario) never pauses', () => {
        const {runCalls, render} = makeHarness();
        render(validScenario(207, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(207, 'building'));
        render(builtWithComparison(207, {actual: 500000, provenance: null}));
        expect(runCalls.length).toBe(1);
    });

    it('AC#4: honours a settings-tunable meshDivergenceThreshold prop (3x lets a 2.5x build through)', () => {
        const {runCalls, render} = makeHarness({meshDivergenceThreshold: 3});
        render(validScenario(208, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(208, 'building'));
        // 2.5x — above the 2x default, but below this scenario's 3x override.
        render(builtWithComparison(208, {actual: 250000, estimate: 100000}));
        expect(runCalls.length).toBe(1);
    });

    it('AC#4: the SAME custom threshold still pauses a build that exceeds IT', () => {
        const {runCalls, render} = makeHarness({meshDivergenceThreshold: 3});
        render(validScenario(209, 'created'));
        container.querySelector('.sv-scenario-action-build-run').click();
        render(validScenario(209, 'building'));
        render(builtWithComparison(209, {actual: 350000, estimate: 100000})); // 3.5x
        expect(runCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toExist();
    });
});

/*
 * P0-A (TASK-2217/2204 gate-fix) — the divergence-confirm dialog must be
 * invalidated by (a) switching to a DIFFERENT scenario, (b) ANY new
 * Build/Build-and-Run dispatch, and (c) name the scenario it refers to so
 * a stale-but-still-open dialog is never mistaken for referring to what's
 * currently on screen. Confirming a dialog whose scenario/run no longer
 * matches current state must no-op (not fire a run).
 */
describe('anugaScenarioMenu — divergence dialog invalidation (P0-A, TASK-2217/2204 gate-fix)', () => {
    let container;

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

    function builtWithComparison(id, {actual, estimate, provenance} = {}) {
        const meshProvenance = provenance !== undefined
            ? provenance
            : (estimate !== undefined ? {pre_build_triangle_estimate: estimate} : {});
        return validScenario(id, 'built', {
            latest_run: {
                id: id * 10,
                status: 'complete',
                mesh_triangle_count: actual !== undefined ? actual : 0,
                mesh_provenance: meshProvenance
            }
        });
    }

    function makeHarness(extraProps = {}) {
        const buildCalls = [];
        const runCalls = [];
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
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: (s, t) => runCalls.push({scenario: s, target: t}),
            ...extraProps
        };
        // render(list, selected) — unlike the TASK-2211 describe's single-
        // scenario helper, P0-A needs BOTH scenarios present in the rail
        // simultaneously so a real rail-item click can select the OTHER one.
        // Returns (and tracks) the mounted CLASS INSTANCE — a class
        // component's ReactDOM.render return value — so a test can invoke a
        // handler directly (e.g. handleBuildAndRunClick) to sidestep the
        // header strip's UNRELATED 2s post-click debounce
        // (scenarioHeaderActions.ACTION_DEBOUNCE_MS), which unavoidably
        // disables a real second DOM click immediately after the first.
        let instance = null;
        const render = (scenarios, selected) => {
            instance = ReactDOM.render(
                <AnugaScenarioMenuClass {...base} scenarios={scenarios} selectedScenario={selected} />,
                container
            );
            return instance;
        };
        const selectRailItem = (id) => {
            const items = Array.prototype.slice.call(container.querySelectorAll('.sv-scenario-rail-item'));
            const target = items.find((el) => {
                const idEl = el.querySelector('.sv-scenario-rail-item-id');
                return idEl && idEl.textContent === `#${id}`;
            });
            if (target) target.click();
        };
        return {buildCalls, runCalls, render, selectRailItem, getInstance: () => instance};
    }

    // Drives scenario A through Build-and-Run to the paused/diverged state,
    // with scenario B also present in the rail (unselected).
    function pauseOnDivergence(harness, idA, idB) {
        const {render} = harness;
        const created = validScenario(idA, 'created');
        const other = validScenario(idB, 'created');
        render([created, other], created);
        container.querySelector('.sv-scenario-action-build-run').click();
        render([validScenario(idA, 'building'), other], validScenario(idA, 'building'));
        const built = builtWithComparison(idA, {actual: 300000, estimate: 100000}); // 3x, above 2x default
        render([built, other], built);
        return {built, other};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('shows the scenario name in the dialog text', () => {
        const harness = makeHarness();
        pauseOnDivergence(harness, 301, 302);
        const nameEl = container.querySelector('.sv-anuga-divergence-confirm-scenario-name');
        expect(nameEl).toExist();
        // Bare (non-Provider) render has no locale context, so <Message>
        // renders the raw msgId — same convention the file's existing
        // rainfall-dialog test asserts on (line ~1505). Proves the CORRECT
        // translation key was requested; msgParams interpolation itself is
        // a MapStore-framework concern, not re-tested at this level.
        expect(nameEl.textContent).toInclude('hydrata.anuga.divergenceConfirmScenarioName');
    });

    it('scenario-switch clears the dialog (does not stay open/interactive against the OLD scenario)', () => {
        const harness = makeHarness();
        const {selectRailItem} = harness;
        pauseOnDivergence(harness, 303, 304);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toExist();
        selectRailItem(304);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
    });

    it('a new Build/Build-and-Run dispatch clears a still-open dialog for the SAME scenario', () => {
        const harness = makeHarness();
        const {render, getInstance} = harness;
        const {built, other} = pauseOnDivergence(harness, 305, 306);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toExist();
        // Re-render still selected on the built (paused) scenario, then
        // dispatch Build-and-Run again — a real second dispatch for the
        // SAME scenario. Invoked via the instance method (not a second DOM
        // click) because scenarioHeaderActions' UNRELATED 2s post-click
        // debounce (ACTION_DEBOUNCE_MS) leaves the real button disabled
        // immediately after the first click — a concern orthogonal to
        // divergenceConfirm invalidation, which is what this test targets.
        render([built, other], built);
        getInstance().handleBuildAndRunClick(built);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
    });

    it('confirm-after-invalidation (scenario switch) does not fire a run', () => {
        const harness = makeHarness();
        const {runCalls, selectRailItem} = harness;
        pauseOnDivergence(harness, 307, 308);
        selectRailItem(308);
        expect(container.querySelector('.sv-anuga-divergence-confirm-dialog.is-open')).toNotExist();
        // The confirm BUTTON element itself stays permanently in the DOM
        // (module convention: "always rendered, .is-open toggled via CSS
        // for Karma determinism") — clicking it while closed must still be
        // a safe no-op, since state.divergenceConfirm is now null.
        const confirmBtn = container.querySelector('.sv-anuga-divergence-confirm-run');
        expect(confirmBtn).toExist();
        confirmBtn.click();
        expect(runCalls.length).toBe(0);
    });

    it('handleDivergenceConfirm no-ops when the pending run no longer matches the fresh scenario (belt-and-braces)', () => {
        const harness = makeHarness();
        const {render, runCalls} = harness;
        const {built, other} = pauseOnDivergence(harness, 309, 310);
        // Simulate a race: the underlying scenario's latest_run has already
        // moved on (a NEW run id) by the time the confirm click lands, but
        // the dialog itself is still showing (e.g. invalidation missed this
        // exact race window). The instance's internal state still holds the
        // OLD pending scenario/run.
        const movedOn = {...built, latest_run: {...built.latest_run, id: built.latest_run.id + 1}};
        render([movedOn, other], movedOn);
        // The dialog re-renders against the SAME (stale) state.divergenceConfirm
        // (React state is untouched by this prop-only re-render), so the
        // confirm button is still present and clickable.
        const confirmBtn = container.querySelector('.sv-anuga-divergence-confirm-run');
        expect(confirmBtn).toExist();
        confirmBtn.click();
        expect(runCalls.length).toBe(0);
    });
});

/*
 * TASK-2194 (epic 2190 W2, review fix) — REAL-PATH integration coverage for
 * the staff compute-target session choice, driving the actual reducers
 * (scenariosReducer + uiReducer) through the connected AnugaScenarioMenu.
 *
 * The wave's original specs seeded {compute_target, unsaved:false} directly
 * into fixtures — a state the UI could never reach, because the selector
 * wrote the choice via UPDATE_ANUGA_SCENARIO which unconditionally flipped
 * unsaved:true (detouring 'Build and Run' into dispatchBuild's save-only
 * branch, so the deferred run never armed) and the save/refresh
 * wholesale-replaces then wiped the choice. These specs pin the fix (the
 * choice rides state.anuga.ui.sessionComputeTargets) by walking the exact
 * store transitions production takes.
 */
describe('anugaScenarioMenu — session compute-target rides the ui slot (TASK-2194 review fix)', () => {
    let container;

    // Exactly what the server returns for a scenario: valid for
    // validateScenario, and NEVER carrying compute_target (Scenario has no
    // such column).
    function serverScenario(id, status) {
        return {
            id, name: `Server ${id}`, status, computed_status: status,
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, created_by: 7, unsaved: false
        };
    }

    // Real store: the full anuga reducer tree (scenarios + ui are what these
    // specs exercise) + static security/layers slices. Dispatches are
    // recorded so specs can assert exactly which actions each click emitted.
    function makeRealStore() {
        const dispatched = [];
        const rootReducer = combineReducers({
            anuga,
            security: (state = {user: {pk: 7, is_staff: true}}) => state,
            layers: (state = {flat: []}) => state
        });
        const store = createStore(rootReducer, {
            anuga: {projects: {data: {id: 1, my_role: 'editor'}}}
        });
        const rawDispatch = store.dispatch;
        store.dispatch = (action) => {
            dispatched.push(action);
            return rawDispatch(action);
        };
        store.actionsOfType = (type) => dispatched.filter((a) => a && a.type === type);
        return store;
    }

    function mountWithScenario(store, scenario) {
        store.dispatch(setAnugaComputeConfig({
            available_compute_targets: ['batch-x4', 'batch-x32'],
            default_compute_target: 'batch-x32',
            // TASK-2644 (epic 2635 W1) — this describe block's `security`
            // reducer stubs is_staff:true (see makeRealStore below), which
            // pre-2644 was itself sufficient to show the selector. The gate
            // moved onto this capability field (2635-D3: no is_staff
            // bridge) — these specs are about session-target PERSISTENCE,
            // not the gate itself, so grant it explicitly as a precondition.
            can_select_compute_target: true
        }));
        store.dispatch(setAnugaScenarioData([scenario]));
        store.dispatch(selectAnugaScenario(scenario));
        ReactDOM.render(
            <Provider store={store}><AnugaScenarioMenu /></Provider>,
            container
        );
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // TASK-2644 (epic 2635 W1 AC6, 2635-D3 anti-vacuity arm) — the connected
    // mapStateToProps reads state.anuga.ui.canSelectComputeTarget, NOT
    // state.security.user.is_staff. makeRealStore's security reducer stubs
    // is_staff:true unconditionally; WITHOUT the capability granted the
    // selector must not render even though is_staff is true. Fails RED at
    // pre-2644 HEAD (is_staff:true alone used to be sufficient).
    it('the compute-target selector does NOT render for is_staff:true without the tester capability', () => {
        const store = makeRealStore();
        store.dispatch(setAnugaComputeConfig({
            available_compute_targets: ['batch-x4', 'batch-x32'],
            default_compute_target: 'batch-x32'
            // can_select_compute_target deliberately omitted (defaults false).
        }));
        const scenario = serverScenario(94, 'built');
        store.dispatch(setAnugaScenarioData([scenario]));
        store.dispatch(selectAnugaScenario(scenario));
        ReactDOM.render(<Provider store={store}><AnugaScenarioMenu /></Provider>, container);

        expect(store.getState().security.user.is_staff).toBe(true);
        expect(container.querySelector('#compute_target')).toBe(null);
    });

    it('(i) picking a target leaves the scenario saved (unsaved stays false) and Build and Run POSTs the chosen target', () => {
        const store = makeRealStore();
        mountWithScenario(store, serverScenario(91, 'built'));
        const sel = container.querySelector('#compute_target');
        expect(sel).toExist();
        Simulate.change(sel, {target: {value: 'batch-x4'}});
        // The choice landed on the ui slot…
        expect(store.getState().anuga.ui.sessionComputeTargets).toEqual({91: 'batch-x4'});
        // …NOT on the scenario object, and unsaved was NOT flipped.
        const s = store.getState().anuga.scenarios.byId[91];
        expect(s.compute_target).toBe(undefined);
        expect(!!s.unsaved).toBe(false);
        expect(store.actionsOfType(UPDATE_ANUGA_SCENARIO).length).toBe(0);
        // Build and Run dispatches a REAL build — not the save-only detour
        // that used to eat the click (and never armed the deferred run).
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(store.actionsOfType(BUILD_SCENARIO).length).toBe(1);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);
        expect(store.actionsOfType(RUN_ANUGA_SCENARIO).length).toBe(0);
        // The deferred run fires on the polled building→built transition,
        // carrying the session choice.
        store.dispatch(setAnugaPollingData([{id: 91, status: 'building', computed_status: 'building'}]));
        store.dispatch(setAnugaPollingData([{id: 91, status: 'built', computed_status: 'built'}]));
        const runs = store.actionsOfType(RUN_ANUGA_SCENARIO);
        expect(runs.length).toBe(1);
        expect(runs[0].computeTarget).toBe('batch-x4');
    });

    it('(ii) the choice SURVIVES a save round-trip whose payload lacks compute_target, and Run POSTs it', () => {
        const store = makeRealStore();
        mountWithScenario(store, serverScenario(92, 'built'));
        Simulate.change(container.querySelector('#compute_target'), {target: {value: 'batch-x4'}});
        // Save success wholesale-replaces the scenario with the server
        // payload (which never contains compute_target).
        store.dispatch({type: SAVE_ANUGA_SCENARIO_SUCCESS, scenario: serverScenario(92, 'built')});
        // The select still shows the session choice (it rides the ui slot)…
        expect(container.querySelector('#compute_target').value).toBe('batch-x4');
        // …and Run POSTs it.
        container.querySelector('.sv-scenario-action-run').click();
        const runs = store.actionsOfType(RUN_ANUGA_SCENARIO);
        expect(runs.length).toBe(1);
        expect(runs[0].computeTarget).toBe('batch-x4');
    });

    it('(iii) the choice survives a SET_ANUGA_SCENARIO_DATA full refresh', () => {
        const store = makeRealStore();
        mountWithScenario(store, serverScenario(93, 'built'));
        Simulate.change(container.querySelector('#compute_target'), {target: {value: 'batch-x4'}});
        // Re-init / archive-filter refresh: full replace of the scenarios slice.
        store.dispatch(setAnugaScenarioData([serverScenario(93, 'built')]));
        expect(container.querySelector('#compute_target').value).toBe('batch-x4');
        container.querySelector('.sv-scenario-action-run').click();
        const runs = store.actionsOfType(RUN_ANUGA_SCENARIO);
        expect(runs.length).toBe(1);
        expect(runs[0].computeTarget).toBe('batch-x4');
    });

    it('(iv) with no session choice the select shows the site default and the run dispatch carries null', () => {
        const store = makeRealStore();
        mountWithScenario(store, serverScenario(94, 'built'));
        expect(container.querySelector('#compute_target').value).toBe('batch-x32');
        container.querySelector('.sv-scenario-action-run').click();
        const runs = store.actionsOfType(RUN_ANUGA_SCENARIO);
        expect(runs.length).toBe(1);
        expect(runs[0].computeTarget).toBe(null);
    });

    it('(v) explicitly choosing the SITE DEFAULT stores it and the run POSTs it verbatim (server validates membership)', () => {
        const store = makeRealStore();
        mountWithScenario(store, serverScenario(95, 'built'));
        Simulate.change(container.querySelector('#compute_target'), {target: {value: 'batch-x32'}});
        expect(store.getState().anuga.ui.sessionComputeTargets).toEqual({95: 'batch-x32'});
        container.querySelector('.sv-scenario-action-run').click();
        const runs = store.actionsOfType(RUN_ANUGA_SCENARIO);
        expect(runs.length).toBe(1);
        expect(runs[0].computeTarget).toBe('batch-x32');
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
 * TASK-2245 (epic 2237 W3.1, AC#2/#3) — Run settings expand-then-focus:
 * resolution/duration live inside the collapsed-by-default Run settings
 * section (scenarioPane.js), so a missing-field build-validation failure on
 * either one must expand the section AND focus the field, not just pop the
 * (pre-existing) validation dialog. Direct mirror of the MeshRegion/Rainfall
 * "Attach first" harness above — mesh_region's "Attach first" expand-then-
 * focus is ALREADY covered by 'anugaScenarioMenu — MeshRegion unattached
 * build confirm (TASK-2116)' / "Attach first" ... focuses #mesh_region'
 * above, unmodified: that test still passes because the expand commits
 * synchronously (useLayoutEffect, scenarioPane.js) within the same click —
 * TASK-2265 (epic 2237 W5) retargets that flow at the SEPARATE Optional
 * inputs section (mesh_region moved out of Run settings), via the new
 * requestOptionalInputsFocus/optionalInputsExpandToken pair, but the test's
 * own assertions (focus lands on #mesh_region) are unaffected by which
 * section actually opened.
 */
describe('anugaScenarioMenu — RUN SETTINGS auto-expand on build validation (TASK-2245)', () => {
    let container;

    // Passes every validateScenario field EXCEPT the one under test, and
    // carries empty meshRegions/rainfalls so the click reaches the missing-
    // field validation dialog rather than either "unattached" gate.
    function scenarioMissing(id, field, extras = {}) {
        const base = {
            id, name: `Scenario ${id}`, status: 'created', created_by: 9999,
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, unsaved: false,
            ...extras
        };
        delete base[field];
        if (field === 'resolution') base.resolution = 0;
        if (field === 'duration') base.duration = null;
        return base;
    }

    function makeHarness() {
        const buildCalls = [];
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
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: () => {}
        };
        const render = (scenario) => {
            ReactDOM.render(
                <AnugaScenarioMenuClass {...base} scenarios={[scenario]} selectedScenario={scenario} />,
                container
            );
        };
        return {buildCalls, render};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('Build with duration null: validation dialog fires, RUN SETTINGS auto-expands, #duration-hours is focused (AC#2)', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(81, 'duration'));
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toNotInclude('is-open');
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        const dialog = container.querySelector('.anuga-build-validation-dialog.is-open');
        expect(dialog).toExist();
        expect(dialog.textContent).toInclude('hydrata.anuga.validateMissingField.duration');
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('duration-hours');
    });

    it('Build with resolution unset: validation dialog fires, RUN SETTINGS auto-expands, #resolution is focused', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(82, 'resolution'));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.anuga-build-validation-dialog.is-open')).toExist();
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('resolution');
    });

    it('Build-and-Run with duration null ALSO auto-expands + focuses #duration-hours', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(83, 'duration'));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('duration-hours');
    });

    it('a missing REQUIRED-section field (e.g. terrain) does NOT touch the RUN SETTINGS collapse', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(84, 'terrain'));
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.anuga-build-validation-dialog.is-open')).toExist();
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toNotInclude('is-open');
    });
});

/*
 * TASK-2268 (epic 2237 W5.3) — REQUIRED section expand-then-focus: the
 * Required section (name/terrain/boundary/inflow-or-rainfall) became
 * collapsible in TASK-2265, but its own missing-field build-validation
 * failures were never wired to the expand-then-focus bridge the way
 * resolution/duration (Run settings, TASK-2245) and mesh_region (Optional
 * inputs, TASK-2265) already are — so a user who had collapsed Required
 * would get the validation dialog with the offending field still
 * CSS-hidden behind it. Direct mirror of the RUN SETTINGS harness above,
 * with the section collapsed FIRST (Required starts open by default,
 * unlike Run settings/Optional inputs, so the "reopen" half of the bridge
 * has nothing to prove unless the user already collapsed it).
 */
describe('anugaScenarioMenu — REQUIRED auto-expand on build validation (TASK-2268)', () => {
    let container;

    // Passes every validateScenario field EXCEPT the one under test, and
    // carries empty meshRegions/rainfalls so the click reaches the missing-
    // field validation dialog rather than either "unattached" gate.
    // 'inflowOrRainfall' clears BOTH substitutable water-source fields
    // (validateScenario requires one of the two).
    function scenarioMissing(id, field, extras = {}) {
        const base = {
            id, name: `Scenario ${id}`, status: 'created', created_by: 9999,
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, unsaved: false,
            ...extras
        };
        if (field === 'inflowOrRainfall') {
            delete base.inflow;
            delete base.rainfall;
        } else {
            delete base[field];
        }
        return base;
    }

    function makeHarness() {
        const buildCalls = [];
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
            saveAnugaScenario: () => {},
            buildScenarioExplicit: (sid) => buildCalls.push(sid),
            runAnugaScenario: () => {}
        };
        const render = (scenario) => {
            ReactDOM.render(
                <AnugaScenarioMenuClass {...base} scenarios={[scenario]} selectedScenario={scenario} />,
                container
            );
        };
        return {buildCalls, render};
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('Build with terrain missing while Required is collapsed: validation dialog fires, REQUIRED auto-expands, #terrain is focused', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(90, 'terrain'));
        // Required starts OPEN by default (TASK-2265, AC#3) — collapse it
        // first via the user-action toggle so the auto-EXPAND this test
        // proves actually has something to reverse.
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toNotInclude('is-open');
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        const dialog = container.querySelector('.anuga-build-validation-dialog.is-open');
        expect(dialog).toExist();
        expect(dialog.textContent).toInclude('hydrata.anuga.validateMissingField.terrain');
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('terrain');
    });

    it('Build with name missing while Required is collapsed: REQUIRED auto-expands, #name is focused', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(91, 'name'));
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('name');
    });

    it('Build with boundary missing while Required is collapsed: REQUIRED auto-expands, #boundary is focused', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(92, 'boundary'));
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('boundary');
    });

    it('Build with neither inflow nor rainfall set while Required is collapsed: REQUIRED auto-expands, #inflow is focused', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(93, 'inflowOrRainfall'));
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        const dialog = container.querySelector('.anuga-build-validation-dialog.is-open');
        expect(dialog.textContent).toInclude('hydrata.anuga.validateMissingField.inflowOrRainfall');
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('inflow');
    });

    it('Build-and-Run with terrain missing while Required is collapsed ALSO auto-expands + focuses #terrain', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(94, 'terrain'));
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('terrain');
    });

    it('a missing RUN-SETTINGS-section field (e.g. duration) does NOT touch the REQUIRED collapse', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(95, 'duration'));
        container.querySelector('.sv-anuga-scenario-pane-required-header').click();
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toNotInclude('is-open');
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.anuga-build-validation-dialog.is-open')).toExist();
        // Required stays collapsed — this token belongs to Run settings, not Required.
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toNotInclude('is-open');
        expect(container.querySelector('.sv-anuga-scenario-pane-run-settings').className).toInclude('is-open');
    });

    it('when Required is already open (default), a validation failure notifies without a further OPEN transition (focus still lands)', () => {
        const {buildCalls, render} = makeHarness();
        render(scenarioMissing(96, 'terrain'));
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        container.querySelector('.sv-scenario-action-build').click();
        expect(buildCalls.length).toBe(0);
        expect(container.querySelector('.sv-anuga-scenario-pane-required').className).toInclude('is-open');
        expect(document.activeElement.id).toBe('terrain');
    });
});

/*
 * TASK-2438 (epic 2425 W3.1) — the paywall props reach the header strip.
 *
 * mapStateToProps has carried paywallEnabled/accountBalance/freeBand (and
 * mapDispatchToProps onOpenAccountBilling) since TASK-2420, but
 * renderRunActions passed NONE of them down: scenarioPane got all four,
 * ScenarioHeaderActions got none, so the price beside Run had nothing to be
 * computed from even after the component learned how. This pins the
 * threading itself — the component's own behaviour is covered in
 * scenarioHeaderActions-test.js.
 */
describe('anugaScenarioMenu — paywall props reach the run-actions strip (TASK-2438)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('a never-run priced scenario shows its price inside #scenario-run-actions', () => {
        const scenario = {
            id: 21, name: 'Priced', status: 'built', created_by: 9999,
            terrain: 10, boundary: 20, inflow: 30, rainfall: null,
            friction: null, structure: null, mesh_region: null, network: null,
            resolution: 1000, duration: 1800, unsaved: false,
            compute_cost_estimate: 3, mesh_triangle_count_estimate: 42000,
            latest_run: null
        };
        let opened = 0;
        ReactDOM.render(
            <AnugaScenarioMenuClass
                archiveFilter="none"
                terrain={[]} boundaries={[]} inflows={[]} rainfalls={[]}
                frictions={[]} structures={[]} meshRegions={[]} networks={[]}
                computeInstances={[]}
                canCreateScenario canRunScenario
                myRole="editor" currentUserId={9999}
                selectedScenarios={[]} readyToCompare={false} flatLayers={[]}
                selectAnugaScenario={() => {}} setOpenMenuGroupId={() => {}}
                saveAnugaScenario={() => {}} buildScenarioExplicit={() => {}}
                runAnugaScenario={() => {}}
                paywallEnabled
                accountBalance="0.00"
                freeBand={{cap: 3, usedToday: 0, edge: '0.50', table: [[2, '1'], [5, '2'], [20, '5']]}}
                onOpenAccountBilling={() => { opened++; }}
                scenarios={[scenario]}
                selectedScenario={scenario}
            />,
            container
        );
        const strip = container.querySelector('#scenario-run-actions');
        expect(strip).toExist();
        const price = strip.querySelector('[data-testid="sv-scenario-run-price"]');
        expect(price).toExist();
        // "at least" — W3c adversarial: a pre-build estimate is a floor, not the
        // bill, and dropping the hedge in the one state where the number is an
        // instruction is what let a customer top up exactly $2, watch a larger
        // mesh price at $5, and be refused for doing what the chip said.
        expect(price.textContent).toBe('Costs $2 · balance $0.00 · add at least $2 to run');
        price.click();
        expect(opened).toBe(1);
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
