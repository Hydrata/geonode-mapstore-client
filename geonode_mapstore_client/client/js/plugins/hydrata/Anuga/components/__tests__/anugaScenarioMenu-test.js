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
import { findLoadedScenario } from '../../playback/loadedScenario';
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

        // TASK-3077 — New moved OUT of the kebab into the run-action strip;
        // the kebab now lists the three scenario-scoped items only.
        it('renders exactly one kebab trigger; opening it lists Duplicate / Archive / Delete in order (no New, TASK-3077)', () => {
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
            expect(items.length).toBe(3);
            expect(items[0].className).toInclude('sv-anuga-scenario-overflow-duplicate');
            expect(items[1].className).toInclude('sv-anuga-scenario-overflow-archive');
            expect(items[2].className).toInclude('sv-anuga-scenario-overflow-delete');
            expect(kebabMenu().querySelector('.sv-anuga-scenario-overflow-new')).toNotExist();
        });

        it('the kebab is gated on canCreateScenario (viewer role never sees it, even with a scenario selected)', () => {
            // Viewer role kills canCreateScenario.
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            const state = store.getState();
            state.anuga.projects.data.my_role = 'viewer';
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toNotExist();
        });

        it('the kebab is hidden when no scenario is selected, even for a role that can create (TASK-3077)', () => {
            const store = makeStore(); // editor role, no scenarios → no selectedScenario
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('#scenario-header-actions')).toExist();
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toNotExist();
        });
    });

    // ----------------------------------------------------------------
    // "New" button in the run-action strip (TASK-3077; was a kebab item)
    // ----------------------------------------------------------------
    describe('New button in the run-action strip (TASK-3077)', () => {
        it('renders in #scenario-run-actions when canCreateScenario is true, and not for a viewer', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('#scenario-run-actions .sv-scenario-action-new')).toExist();
            ReactDOM.unmountComponentAtNode(container);

            const viewerStore = makeStore();
            viewerStore.getState().anuga.projects.data.my_role = 'viewer';
            ReactDOM.render(
                <Provider store={viewerStore}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('#scenario-run-actions .sv-scenario-action-new')).toNotExist();
        });

        it('is enabled + dispatches ADD_ANUGA_SCENARIO even with NO scenario selected (survives the empty project)', () => {
            const store = makeStore(); // no scenarios → no selectedScenario
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const strip = container.querySelector('#scenario-run-actions');
            expect(strip).toExist();
            const btn = strip.querySelector('.sv-scenario-action-new');
            expect(btn.disabled).toBe(false);
            // Alone in the strip: no run cluster without a scenario.
            expect(strip.querySelector('.sv-scenario-run-cluster')).toNotExist();
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
        // TASK-3077 — with no selection the whole kebab is hidden (every
        // remaining item is scenario-scoped), so Duplicate is UNREACHABLE
        // rather than rendered-disabled.
        it('is unreachable when no selectedScenario.id (the kebab itself is hidden, TASK-3077)', () => {
            // Empty store → no selected.
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('.sv-anuga-scenario-overflow-trigger')).toNotExist();
            expect(kebabMenu()).toNotExist();
            expect(document.querySelector('.sv-anuga-scenario-overflow-duplicate')).toNotExist();
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

        it('cannot open the confirm dialog with no selection — there is no Duplicate item to click (TASK-3077)', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(document.querySelector('.sv-anuga-scenario-overflow-duplicate')).toNotExist();
            const dialog = container.querySelector('.sv-anuga-scenario-confirm-dialog');
            expect(dialog).toExist();
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

    // TASK-3076 AC11 — ONE exported helper resolves "which scenario is loaded"
    // for BOTH the Results menu's active row and the playback bar's heading,
    // so the two cannot disagree. Same match the menu always made: the
    // scenario whose latest_complete_run.id equals the playback runId, as
    // strings (the reducer stores runId as a string, the API sends a number).
    describe('findLoadedScenario (TASK-3076)', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'Alternate', {latest_complete_run: {id: 102, has_playback_store: true}}),
            makeScenario(3, 'Never run', {latest_complete_run: null})
        ];

        it('returns the scenario whose latest complete run matches the runId, comparing as strings', () => {
            expect(findLoadedScenario(scenarios, '102').name).toBe('Alternate');
            expect(findLoadedScenario(scenarios, 102).name).toBe('Alternate');
        });

        it('returns null for no runId, an unknown runId, or no scenarios', () => {
            expect(findLoadedScenario(scenarios, null)).toBe(null);
            expect(findLoadedScenario(scenarios, undefined)).toBe(null);
            expect(findLoadedScenario(scenarios, '999')).toBe(null);
            expect(findLoadedScenario([], '101')).toBe(null);
            expect(findLoadedScenario(undefined, '101')).toBe(null);
        });

        it('the menu\'s active row IS the helper\'s answer', () => {
            ReactDOM.render(
                <AnugaResultsMenuClass scenarios={scenarios} activeRunId={'101'} onSelectScenario={() => {}} />,
                container
            );
            const active = [...container.querySelectorAll('.sv-anuga-results-row')].filter(r => r.className.includes('active'));
            expect(active.length).toBe(1);
            expect(active[0].textContent).toBe(findLoadedScenario(scenarios, '101').name);
        });
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

    /*
     * TASK-2715 (W5, epic 2706) REWRITES THIS SPEC IN PLACE — declared, not
     * hidden.
     *
     * TASK-2684's AC allowed either branch: a storeless complete run could be
     * "row absent OR clearly non-actionable". It elected "row absent", and this
     * spec pinned that. 2715 elects the OTHER sanctioned branch of the same AC,
     * because absence turned out to be indistinguishable from "you have no
     * completed runs" for a user who has just paid for a 29-hour run — see
     * prod scenario #407, run 1314, 6.8M triangles, no store.
     *
     * So the row is no longer absent; it is present and unmistakably dead. The
     * assertion below still counts ACTIONABLE rows by their class, and that
     * count is still 1 — the explanation row deliberately does NOT carry the
     * `sv-anuga-results-row` token, because three shipped specs (and this
     * describe's own fixtures) count actionable rows by exactly that selector.
     */
    it('renders a non-actionable explanation row for a complete run with no playback store', () => {
        const scenarios = [
            makeScenario(1, 'Baseline', {latest_complete_run: {id: 101, has_playback_store: true}}),
            makeScenario(2, 'Legacy run', {latest_complete_run: {id: 102, has_playback_store: false}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        // the actionable row is untouched (AC3)
        const rows = container.querySelectorAll('.sv-anuga-results-row');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toBe('Baseline');
        expect(rows[0].tagName).toBe('BUTTON');

        // ...and the storeless one is now VISIBLE, named, and explained
        const dead = container.querySelector('[data-testid="anuga-results-row-unavailable-2"]');
        expect(dead).toExist('no explanation row for the storeless scenario');
        expect(dead.textContent).toInclude('Legacy run');
        // one sentence saying why, not just a greyed-out name
        expect(dead.textContent.replace('Legacy run', '').trim().length > 20).toBe(true);

        // visibly non-actionable: not an enabled button, and it does not
        // borrow the actionable row's class token.
        expect(dead.tagName).toNotBe('BUTTON');
        expect(dead.className).toNotInclude('sv-anuga-results-row ');
        expect(dead.classList.contains('sv-anuga-results-row')).toBe(false);
    });

    it('the no-playback row dispatches no playbackInit', () => {
        // AC2. The row is not a button, so there is nothing to click — but the
        // guard in resultsMenuMapDispatchToProps must survive regardless, which
        // is what the mapDispatchToProps spec elsewhere in this file pins.
        // Here: even if a caller reaches in and invokes onSelectScenario with
        // the storeless scenario, the component offers no path that does so.
        const calls = [];
        const scenarios = [
            makeScenario(2, 'Legacy run', {latest_complete_run: {id: 102, has_playback_store: false}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={(s) => calls.push(s)} />,
            container
        );
        const dead = container.querySelector('[data-testid="anuga-results-row-unavailable-2"]');
        expect(dead).toExist();
        dead.click();
        expect(calls.length).toBe(0);
    });

    it('resultsNoRuns is NOT rendered when a complete-but-storeless scenario is present', () => {
        // AC4 — the empty state stops lying. "No scenarios have completed runs
        // with results yet." is affirmatively FALSE for a scenario that has a
        // completed run; it just has no player.
        const scenarios = [
            makeScenario(2, 'Legacy run', {latest_complete_run: {id: 102, has_playback_store: false}})
        ];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        // ANTI-VACUITY: a bare absence assertion passes if the component threw
        // and rendered nothing at all. Assert the replacement is present in the
        // SAME render before asserting the lie is gone.
        expect(container.querySelector('[data-testid="anuga-results-row-unavailable-2"]')).toExist();
        expect(container.querySelector('[data-testid="anuga-results-empty"]')).toNotExist();
    });

    it('resultsNoRuns STILL renders when there are genuinely no complete runs', () => {
        // The other half of AC4: the sentence is reserved for the case where it
        // is true, not deleted.
        const scenarios = [makeScenario(1, 'Never run', {latest_complete_run: null})];
        ReactDOM.render(
            <AnugaResultsMenuClass scenarios={scenarios} activeRunId={null} onSelectScenario={() => {}} />,
            container
        );
        expect(container.querySelector('[data-testid="anuga-results-empty"]')).toExist();
        expect(container.querySelector('[data-testid="anuga-results-row-unavailable-1"]')).toNotExist();
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

    /*
     * TASK-2973 — every Results row (actionable AND storeless) carries a
     * session-only show/hide of its run's max-value rasters. The epic hides
     * every result-shaped raster on load, so this toggle is the ONE peak-view
     * control a storeless run (or a store baked without an envelope) has left.
     * It is a SIBLING of the row inside a wrapper, never nested in the row's
     * <button>, and the wrapper carries no `sv-anuga-results-row` token — the
     * shipped specs above count actionable rows by that selector.
     */
    it('renders a max-value raster toggle on every Results row that dispatches the run id, not onSelectScenario', () => {
        const scenarios = [
            makeScenario(7, 'Storeless', {latest_complete_run: {id: 102, has_playback_store: false}}),
            makeScenario(8, 'Stored', {latest_complete_run: {id: 103, has_playback_store: true}})
        ];
        const selectCalls = [];
        const toggleCalls = [];
        const render = (shownResultRunIds) => ReactDOM.render(
            <AnugaResultsMenuClass
                scenarios={scenarios}
                activeRunId={null}
                onSelectScenario={(s) => selectCalls.push(s)}
                onToggleResultRasters={(runId, shown) => toggleCalls.push([runId, shown])}
                shownResultRunIds={shownResultRunIds}
            />,
            container
        );

        render([]);
        const toggles = container.querySelectorAll('[data-testid^="anuga-results-row-toggle-"]');
        expect(toggles.length).toBe(2);
        const toggle7 = container.querySelector('[data-testid="anuga-results-row-toggle-7"]');
        expect(toggle7).toExist();
        expect(toggle7.tagName).toBe('BUTTON');
        expect(toggle7.getAttribute('type')).toBe('button');
        // Label = the Show string while the run is not in the shown set
        // (Message renders its msgId with no intl context in this rig).
        expect(toggle7.textContent).toBe('hydrata.anuga.resultsShowMaxRasters');

        toggle7.click();
        expect(toggleCalls).toEqual([['102', true]]);
        expect(selectCalls.length).toBe(0);

        // With the run shown, the same control reads Hide and dispatches false.
        render(['102']);
        const toggle7Shown = container.querySelector('[data-testid="anuga-results-row-toggle-7"]');
        expect(toggle7Shown.textContent).toBe('hydrata.anuga.resultsHideMaxRasters');
        toggle7Shown.click();
        expect(toggleCalls).toEqual([['102', true], ['102', false]]);
        expect(selectCalls.length).toBe(0);

        // The actionable row still selects — and only selects.
        container.querySelector('[data-testid="anuga-results-row-8"]').click();
        expect(selectCalls.length).toBe(1);
        expect(selectCalls[0].id).toBe(8);
        expect(toggleCalls.length).toBe(2);

        // Structure the shipped specs depend on: ONE actionable row by class,
        // the storeless row still not a button, and neither toggle nested
        // inside a row element.
        expect(container.querySelectorAll('.sv-anuga-results-row').length).toBe(1);
        const dead = container.querySelector('[data-testid="anuga-results-row-unavailable-7"]');
        expect(dead.tagName).toNotBe('BUTTON');
        expect(dead.querySelector('[data-testid^="anuga-results-row-toggle-"]')).toNotExist();
        expect(container.querySelector('[data-testid="anuga-results-row-8"]').querySelector('button')).toNotExist();
        const wraps = container.querySelectorAll('.sv-anuga-results-row-wrap');
        expect(wraps.length).toBe(2);
        [...wraps].forEach((w) => expect(w.classList.contains('sv-anuga-results-row')).toBe(false));
    });

    // TASK-2973 review fix — the hide epic has TWO exemptions (the toggled set
    // AND the active playback run, whose depth raster showFallbackEnvelope
    // paints), so the label must read the map, not only the toggled set: a
    // run whose rasters are visible without a toggle reads Hide and its first
    // click HIDES, rather than re-showing and needing a second click.
    it('labels the toggle Hide and dispatches false when the run\'s rasters are visible without a toggle', () => {
        const scenarios = [
            makeScenario(7, 'Fallback', {latest_complete_run: {id: 102, has_playback_store: true}}),
            makeScenario(8, 'Other', {latest_complete_run: {id: 103, has_playback_store: true}})
        ];
        const toggleCalls = [];
        ReactDOM.render(
            <AnugaResultsMenuClass
                scenarios={scenarios}
                activeRunId={'102'}
                onSelectScenario={() => {}}
                onToggleResultRasters={(runId, shown) => toggleCalls.push([runId, shown])}
                shownResultRunIds={[]}
                visibleResultRunIds={['102']}
            />,
            container
        );
        const toggle7 = container.querySelector('[data-testid="anuga-results-row-toggle-7"]');
        expect(toggle7.textContent).toBe('hydrata.anuga.resultsHideMaxRasters');
        expect(toggle7.getAttribute('aria-pressed')).toBe('true');
        toggle7.click();
        expect(toggleCalls).toEqual([['102', false]]);
        // the other run is untouched by the map-derived set
        const toggle8 = container.querySelector('[data-testid="anuga-results-row-toggle-8"]');
        expect(toggle8.textContent).toBe('hydrata.anuga.resultsShowMaxRasters');
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

    // TASK-2973 review fix — mapStateToProps derives the run ids whose result
    // rasters are VISIBLE on the map (state.layers.flat), so a fallback-shown
    // raster labels its row Hide even though nothing was toggled.
    it('derives visibleResultRunIds from state.layers.flat so a fallback-shown run reads Hide', () => {
        const s1 = makeScenario(21, 'Baseline', {latest_complete_run: {
            id: 501, has_playback_store: true,
            gn_layer_depth_max: {name: 'geonode:run501_depth_max_cog'}
        }});
        const s2 = makeScenario(22, 'Alternate', {latest_complete_run: {id: 502, has_playback_store: true}});
        const store = makeStore({scenariosArr: [s1, s2], anugaPlayback: {runId: '501', layerId: ANUGA_RESULTS_PLAYBACK_LAYER_ID}});
        store.getState().layers = { flat: [
            { id: 'u-501-d', name: 'geonode:run501_depth_max_cog', group: 'Results.Depth', visibility: true },
            { id: 'u-502-d', name: 'geonode:run502_depth_max_cog', group: 'Results.Depth', visibility: false }
        ] };
        ReactDOM.render(
            <Provider store={store}><AnugaResultsMenu /></Provider>,
            container
        );
        expect(container.querySelector('[data-testid="anuga-results-row-toggle-21"]').textContent)
            .toBe('hydrata.anuga.resultsHideMaxRasters');
        expect(container.querySelector('[data-testid="anuga-results-row-toggle-22"]').textContent)
            .toBe('hydrata.anuga.resultsShowMaxRasters');
        container.querySelector('[data-testid="anuga-results-row-toggle-21"]').click();
        const toggled = store.__actions().filter(a => a.type === 'ANUGA:SET_ANUGA_RESULT_RASTERS_SHOWN');
        expect(toggled.length).toBe(1);
        expect(toggled[0].runId).toBe('501');
        expect(toggled[0].shown).toBe(false);
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
        // TASK-2826 (AC3) — RE-FIXTURED onto the id-LESS lazy-create path.
        // This spec previously rendered validScenario(41, 'created',
        // {unsaved: true}): a has-id scenario that reached dispatchBuild's save
        // branch only via the `scenario.unsaved` read TASK-2826 retires from
        // that decision. After d92 the save branch is guarded on
        // `!scenario.id`, so the id-LESS draft is the only dispatch that still
        // saves — which is where the "a save never arms a deferred run" guard
        // now has to live. The assertion is unchanged, and saveCalls stays
        // asserted here (the only place in this file that asserts it).
        // An id-less scenario → handleBuildAndRunClick dispatches a SAVE, not a
        // build, so no deferred run is armed.
        render(validScenario(null, 'created', {_tempId: 'new_41', unsaved: true}));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(saveCalls.length).toBe(1);
        expect(buildCalls.length).toBe(0);
        expect(runCalls.length).toBe(0);
        // The lazy create resolves as id 41, and that scenario later undergoes an
        // unrelated build→built. With nothing armed locally, that transition must
        // NOT surprise-fire a run.
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

    it('a never-run priced scenario shows NO price chip inside #scenario-run-actions (TASK-2872 — the CPU hedge is deleted, not merely un-banded)', () => {
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
                freeBand={{cap: 3, usedToday: 0, edge: '0.50'}}
                onOpenAccountBilling={() => { opened++; }}
                scenarios={[scenario]}
                selectedScenario={scenario}
            />,
            container
        );
        const strip = container.querySelector('#scenario-run-actions');
        expect(strip).toExist();
        // TASK-2848 — no run yet means no `quote`, and there is no FE band
        // mirror left to derive a shortfall-comparable number from
        // (AC2839-AC6). TASK-2872 (epic 2839 W5.0b) went further: the pane
        // used to fall back to a HEDGE here (formatCostEstimate of
        // compute_cost_estimate, the retired CPU vCPU-hour formula — 17.6x
        // the real GPU cost for a typical run). Deleted outright — the chip
        // renders nothing at all until a real Quote exists.
        expect(strip.querySelector('[data-testid="sv-scenario-run-price"]')).toNotExist();
        expect(opened).toBe(0);
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

/*
 * TASK-3011 (epic 2815 W5) — "+ New scenario" must MOVE the selection, and
 * the selection must then survive the lazy create's tempId -> real-id
 * migration.
 *
 * FOUND ON LIVE PRODUCTION 2026-09-08: with the selection left on the
 * previous scenario, the first field committed after "+ New scenario"
 * PATCHed the OLD scenario (scenario 417 was renamed by typing into what
 * looked like a brand-new scenario's Name field). TASK-2953 made every field
 * commit hit the server immediately, so there is no undo.
 *
 * These specs are CONNECTED on purpose. commitAnugaScenarioFieldEpic
 * (epics/crudEpics.js) branches on action.scenario.id / _tempId and NEVER
 * reads state.anuga.scenarios.selectedId, so an epic-level test commits
 * whatever scenario the test hands it and is green both before and after the
 * fix — it cannot go RED. Only driving the real store (selection ->
 * ScenarioPane -> field commit) lets the SELECTION be what chooses the
 * commit target, which is the actual regression fence.
 */
describe('anugaScenarioMenu — + New scenario moves the selection (TASK-3011)', () => {
    // The sibling makeRealStore() above cannot be reused: commitAnugaScenarioField
    // is a redux-thunk action creator (scenarioActions.js) and that store has no
    // middleware. Same local-require pattern as anugaInputMenu-test.js's
    // TASK-1752 real-store block.
    const { applyMiddleware } = require('redux');
    const reduxThunk = require('redux-thunk');
    const thunkMiddleware = reduxThunk.default || reduxThunk.thunk || reduxThunk;
    const { ADD_ANUGA_SCENARIO, COMMIT_ANUGA_SCENARIO_FIELD } = require('../../actionsAnuga');

    let container;

    // Real anuga reducer tree + thunk, with a recording middleware BEHIND the
    // thunk so `dispatched` holds the plain actions the thunks unwrap into.
    function makeThunkStore() {
        const dispatched = [];
        const record = () => (next) => (action) => {
            dispatched.push(action);
            return next(action);
        };
        const store = createStore(
            combineReducers({
                anuga,
                security: (state = {user: {pk: 7, is_staff: true}}) => state,
                layers: (state = {flat: []}) => state
            }),
            {anuga: {projects: {data: {id: 1, my_role: 'editor'}}}},
            applyMiddleware(thunkMiddleware, record)
        );
        store.actionsOfType = (type) => dispatched.filter((a) => a && a.type === type);
        return store;
    }

    // The scenario the user is already on. Its id is LOW on purpose: it is
    // what getScenariosArray's ascending-id sort puts at scenarios[0], and
    // therefore what a dangling selection falls back onto.
    const existingScenario = () => ({
        id: 417, name: 'Trial 01', status: 'created', computed_status: 'created',
        terrain: 10, boundary: 20, inflow: 30, rainfall: null,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800, created_by: 7, unsaved: false
    });

    function mountOnExisting(store) {
        store.dispatch(setAnugaScenarioData([existingScenario()]));
        store.dispatch(selectAnugaScenario(existingScenario()));
        ReactDOM.render(<Provider store={store}><AnugaScenarioMenu /></Provider>, container);
    }

    // TASK-3077 — New lives in the run-action strip now, not the kebab.
    function clickNewScenario() {
        container.querySelector('#scenario-run-actions .sv-scenario-action-new').click();
    }

    function newestId(store) {
        const allIds = store.getState().anuga.scenarios.allIds;
        return allIds[allIds.length - 1];
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('AC3 — the Name field shows the seeded "New scenario" default, not the previous scenario name', () => {
        const store = makeThunkStore();
        mountOnExisting(store);
        // Non-vacuous seed: the pane really is showing the OLD name first.
        expect(container.querySelector('#name').value).toBe('Trial 01');
        clickNewScenario();
        expect(store.actionsOfType(ADD_ANUGA_SCENARIO).length).toBe(1);
        expect(container.querySelector('#name').value).toBe('New scenario');
    });

    it('AC4 — the first field committed after + New scenario targets the NEW draft, not the previous scenario', () => {
        const store = makeThunkStore();
        mountOnExisting(store);
        clickNewScenario();
        const tempId = newestId(store);
        expect(store.getState().anuga.scenarios.selectedId).toBe(tempId);

        Simulate.change(container.querySelector('#terrain'), {target: {value: '11'}});

        const commits = store.actionsOfType(COMMIT_ANUGA_SCENARIO_FIELD);
        expect(commits.length).toBe(1);
        expect(commits[0].scenario._tempId).toBe(tempId);
        expect(commits[0].scenario.id).toBe(null);
        expect(commits[0].scenario.terrain).toBe(11);
        // The scenario the user was on is untouched.
        expect(store.getState().anuga.scenarios.byId[417].terrain).toBe(10);
    });

    it('AC7 — after the lazy create resolves, the NEXT field commit still targets the new scenario', () => {
        const store = makeThunkStore();
        mountOnExisting(store);
        clickNewScenario();
        const tempId = newestId(store);

        // First commit for this scenario == the lazy CREATE (crudEpics.js).
        Simulate.change(container.querySelector('#terrain'), {target: {value: '11'}});
        expect(store.actionsOfType(COMMIT_ANUGA_SCENARIO_FIELD)[0].scenario._tempId).toBe(tempId);

        // The create resolves. This is verbatim the action crudEpics.js's
        // lazy-create branch emits — saveAnugaScenarioSuccess(data, {tempId,
        // sentPayload}) — minus sentPayload, which only steers TASK-2953's
        // no-clobber merge (covered by its own specs) and not the migration
        // under test. The server id is HIGHER than 417 because it is a real
        // autoincrement pk: that is what makes this spec able to fail, since
        // a dangling selection falls back to scenarios[0] = 417.
        store.dispatch({
            type: SAVE_ANUGA_SCENARIO_SUCCESS,
            scenario: {
                id: 9001, name: 'New scenario', status: 'new', computed_status: 'created',
                terrain: 11, boundary: null, inflow: null, rainfall: null,
                resolution: 100, duration: null, created_by: 7
            },
            tempId
        });

        // Second commit, on a DIFFERENT field, once the row is real.
        Simulate.change(container.querySelector('#boundary'), {target: {value: '21'}});

        const commits = store.actionsOfType(COMMIT_ANUGA_SCENARIO_FIELD);
        expect(commits.length).toBe(2);
        expect(commits[1].scenario.id).toBe(9001);
        expect(commits[1].scenario.boundary).toBe(21);
        // …and above all NOT the scenario the user started on.
        expect(store.getState().anuga.scenarios.byId[417].boundary).toBe(20);
    });
});

/*
 * TASK-2826 (epic 2815 W5, operator rulings d92 + d93) — dispatchBuild reads
 * the REAL per-scenario in-flight-commit signal (isScenarioCommitInFlight,
 * selectorsAnuga.js:174) instead of the cosmetic `scenario.unsaved` flag, and a
 * Build clicked while a field commit is still ON THE WIRE is DEFERRED rather
 * than detoured through a redundant whole-object save.
 *
 * Why the save had to go (ruling d92): saveAnugaScenarioEpic's has-id branch
 * PATCHes through the UN-QUEUED _patchScenario (crudEpics.js:638) while
 * TASK-3012's serialisation queue covers only COMMIT_ANUGA_SCENARIO_FIELD. Both
 * ship the whole 12-key SCENARIO_PATCH_FIELDS snapshot taken at action-creation
 * time, so the two overlap and the one the server commits LAST wins — a silent
 * stale write that TASK-2953's no-clobber reducer merge hides from redux.
 * dispatchBuild's save branch was the only live trigger.
 *
 * The red-at-HEAD condition DIFFERS per case and is named on each spec: a
 * SUCCESSFUL field commit clears `unsaved` (crudEpics.js:707-712 ->
 * scenariosReducer.js:295), so a "commit a field, let it settle, click Build"
 * fixture is green at HEAD and grades nothing.
 */
describe('anugaScenarioMenu — Build defers to an in-flight commit (TASK-2826)', () => {
    // Same local-require pattern as the TASK-3011 block above:
    // commitAnugaScenarioField is a redux-thunk action creator, so the
    // connected specs need a store with thunk middleware.
    const { applyMiddleware } = require('redux');
    const reduxThunk = require('redux-thunk');
    const thunkMiddleware = reduxThunk.default || reduxThunk.thunk || reduxThunk;
    const {
        COMMIT_ANUGA_SCENARIO_FIELD,
        commitAnugaScenarioFieldSettled
    } = require('../../actionsAnuga');

    let container;

    function makeThunkStore() {
        const dispatched = [];
        const record = () => (next) => (action) => {
            dispatched.push(action);
            return next(action);
        };
        const store = createStore(
            combineReducers({
                anuga,
                security: (state = {user: {pk: 7, is_staff: true}}) => state,
                layers: (state = {flat: []}) => state
            }),
            {anuga: {projects: {data: {id: 1, my_role: 'editor'}}}},
            applyMiddleware(thunkMiddleware, record)
        );
        store.actionsOfType = (type) => dispatched.filter((a) => a && a.type === type);
        return store;
    }

    // A saved, server-shaped scenario that PASSES validateScenario.
    const savedScenario = (extras = {}) => ({
        id: 417, name: 'Trial 01', status: 'created', computed_status: 'created',
        terrain: 10, boundary: 20, inflow: 30, rainfall: null,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800, created_by: 7, unsaved: false, ...extras
    });

    function mountConnected(store) {
        store.dispatch(setAnugaScenarioData([savedScenario()]));
        store.dispatch(selectAnugaScenario(savedScenario()));
        ReactDOM.render(<Provider store={store}><AnugaScenarioMenu /></Provider>, container);
    }

    // Unconnected harness for the id-LESS case (a) and the AC5 bound arms —
    // the in-flight signal is an explicit prop here, so a spec can pin it
    // true and hold it there (a commit that never settles), which no real
    // store can express without an epic.
    function makeUnconnected(extraProps = {}) {
        const buildCalls = [];
        const saveCalls = [];
        const runCalls = [];
        const armCalls = [];
        // TASK-3038 — tracks clearRunAfterBuildRedux calls. Previously a
        // silent no-op: no spec in this describe block asserted on it, so
        // the mirror-clearing half of AC3's "resolves its own arms while
        // mounted" was unproven for the armAndDispatchBuildAndRun (immediate)
        // path. Additive only — every pre-existing spec ignores this field.
        const clearCalls = [];
        // TASK-3038 (AC2/AC3/AC4) — captures the mounted CLASS INSTANCE so a
        // spec can invoke a handler directly (e.g. handleBuildAndRunClick),
        // sidestepping ScenarioHeaderActions' unrelated 2s post-click
        // debounce the same way the P0-A harness above (line ~1341) already
        // does. Additive only — render()'s return value was previously
        // ignored by every existing spec in this block.
        let instance = null;
        const base = {
            archiveFilter: 'none',
            terrain: [], boundaries: [], inflows: [], rainfalls: [],
            frictions: [], structures: [], meshRegions: [], networks: [],
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
            armRunAfterBuildRedux: (sid, opts) => armCalls.push({sid, opts}),
            clearRunAfterBuildRedux: (sid) => clearCalls.push(sid),
            ...extraProps
        };
        // `overrides` re-renders the SAME instance with a changed prop — how a
        // spec flips the in-flight signal the way a settling commit does.
        // Verifier-note-2 fix: `overrides` is spread LAST so it can also move
        // `selectedScenario` / `scenarios`, which is the gesture note 2 is
        // about (clicking another scenario in the rail mid-deferral). No
        // pre-existing spec overrides either key, so precedence is unchanged
        // for them.
        const render = (scenario, overrides = {}) => {
            instance = ReactDOM.render(
                <AnugaScenarioMenuClass
                    {...base}
                    scenarios={[scenario]}
                    selectedScenario={scenario}
                    {...overrides}
                />,
                container
            );
            return instance;
        };
        return {buildCalls, saveCalls, runCalls, armCalls, clearCalls, render, getInstance: () => instance};
    }

    // An id-LESS draft (the lazy-create path) that otherwise passes
    // validateScenario, so the Build buttons render and the click reaches
    // dispatchBuild rather than the missing-field dialog.
    const draftScenario = (extras = {}) => ({
        id: null, _tempId: 'new_1', name: 'Draft', status: 'created',
        computed_status: 'created',
        terrain: 10, boundary: 20, inflow: 30, rainfall: null,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800, created_by: 9999, unsaved: true, ...extras
    });

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    // ---- AC1 case (b) — the load-bearing new behaviour --------------------
    it('(b) a Build clicked while a field commit is ON THE WIRE dispatches NO save and NO build; the build fires exactly once when that commit settles [RED AT HEAD: HEAD dispatches SAVE_ANUGA_SCENARIO]', () => {
        const store = makeThunkStore();
        mountConnected(store);

        // The gesture from the card: pick a required field, then hit Build
        // before its PATCH has landed.
        Simulate.change(container.querySelector('#terrain'), {target: {value: '11'}});
        expect(store.actionsOfType(COMMIT_ANUGA_SCENARIO_FIELD).length).toBe(1);
        // Non-vacuous seed, both halves: the commit really is outstanding in
        // the store slice the new selector reads…
        expect(store.getState().anuga.scenarios.commitsInFlight[417]).toBe(1);
        // …and the retired cosmetic flag really is true, so a HEAD-shaped
        // `scenario.unsaved` read would take the save branch here.
        expect(store.getState().anuga.scenarios.byId[417].unsaved).toBe(true);

        container.querySelector('.sv-scenario-action-build-run').click();

        // d92: no redundant whole-object save (that is the PATCH that reaches
        // crudEpics.js:638 and can clobber the field commit on the server)…
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);
        // …and no build yet either — the click is held, not dropped.
        expect(store.actionsOfType(BUILD_SCENARIO).length).toBe(0);

        // The commit settles (crudEpics.js's withCommitSettled closes the
        // slice from BOTH the success and the failure arm).
        store.dispatch(commitAnugaScenarioFieldSettled(417));
        const builds = store.actionsOfType(BUILD_SCENARIO);
        expect(builds.length).toBe(1);
        expect(builds[0].scenarioId).toBe(417);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);

        // AC3 — a DEFERRED build may not lose its run: the arm survives the
        // deferral and resolves on the build's own building→built transition.
        store.dispatch(setAnugaPollingData([{id: 417, status: 'building', computed_status: 'building'}]));
        expect(store.actionsOfType(RUN_ANUGA_SCENARIO).length).toBe(0);
        store.dispatch(setAnugaPollingData([{id: 417, status: 'built', computed_status: 'built'}]));
        expect(store.actionsOfType(RUN_ANUGA_SCENARIO).length).toBe(1);
        // …and exactly once: the build is not re-dispatched by later ticks.
        expect(store.actionsOfType(BUILD_SCENARIO).length).toBe(1);
    });

    // ---- AC1 case (c) — the state where the old flag and the new signal
    // genuinely disagree. Fixture named per AC2: a FAILED field commit.
    // scenariosReducer has NO SAVE_ANUGA_SCENARIO_ERROR case, so `unsaved`
    // stays TRUE, while commitAnugaScenarioFieldEpic closes its catch arm
    // through withCommitSettled — commitsInFlight goes back to 0.
    it('(c) after a FAILED field commit (unsaved:true, nothing in flight) Build builds IMMEDIATELY and never saves [RED AT HEAD: HEAD reads scenario.unsaved and dispatches SAVE_ANUGA_SCENARIO]', () => {
        const store = makeThunkStore();
        mountConnected(store);
        Simulate.change(container.querySelector('#terrain'), {target: {value: '11'}});
        // The failure arm: settled, with NO SAVE_ANUGA_SCENARIO_SUCCESS —
        // exactly what withCommitSettled(commitKey, saveAnugaScenarioError(...))
        // leaves behind.
        store.dispatch(commitAnugaScenarioFieldSettled(417));
        expect(store.getState().anuga.scenarios.commitsInFlight[417]).toBe(undefined);
        expect(store.getState().anuga.scenarios.byId[417].unsaved).toBe(true);

        container.querySelector('.sv-scenario-action-build-run').click();

        const builds = store.actionsOfType(BUILD_SCENARIO);
        expect(builds.length).toBe(1);
        expect(builds[0].scenarioId).toBe(417);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);
    });

    // ---- AC1 case (a) — no-regression, plus the explicit !scenario.id guard
    it('(a) an id-LESS draft still SAVES and never builds — the lazy-create path is unchanged', () => {
        const h = makeUnconnected();
        h.render(draftScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.saveCalls.length).toBe(1);
        expect(h.saveCalls[0]._tempId).toBe('new_1');
        expect(h.buildCalls).toEqual([]);
        expect(h.runCalls.length).toBe(0);
    });

    it('(a) an id-LESS draft with unsaved:FALSE still SAVES — it must never reach buildScenarioExplicit(null) [RED AT HEAD: HEAD builds null]', () => {
        // AC1(a): merely deleting the `scenario.unsaved` read would leave
        // `!this.props.buildScenarioExplicit`, sending an id-less scenario to
        // buildScenarioExplicit(null) and POSTing .../scenarios/null/build/.
        // ADD_ANUGA_SCENARIO seeds a draft with exactly this shape
        // (scenariosReducer.js: id null, unsaved false).
        const h = makeUnconnected();
        h.render(draftScenario({unsaved: false}));
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);
        expect(h.saveCalls.length).toBe(1);
    });

    // ---- AC5 — the bounded wait (ruling d92) -----------------------------
    it('AC5 — a commit that NEVER settles: the injected bound elapses and the build fires anyway, so the click is never silently swallowed and the button is never dead', (done) => {
        // The bound exists for a promise that never settles at all (there is
        // no client-side axios timeout on the scenario API). A 4xx CANNOT
        // strand the deferral — isScenarioCommitInFlight clears on the catch
        // arm too (crudEpics.js:731/:787/:806), which case (c) above covers.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            deferredBuildMaxWaitMs: 20
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        // Held, not dispatched…
        expect(h.buildCalls).toEqual([]);
        expect(h.saveCalls.length).toBe(0);
        setTimeout(() => {
            // …and released by the bound even though the commit never settled.
            expect(h.buildCalls).toEqual([417]);
            expect(h.saveCalls.length).toBe(0);
            // The Build-and-Run intent survives the bound.
            expect(h.armCalls.length).toBe(1);
            expect(h.armCalls[0].sid).toBe(417);
            done();
        }, 120);
    });

    it('AC5 — a mid-deferral UNMOUNT flushes the pending build and hands the run arm to runAfterBuildEpic (localOwned NOT set)', () => {
        // anugaScenarioMenu has no componentWillUnmount at HEAD and one
        // Hydraulics-tab click unmounts the menu (anugaContainer.js:283-290,
        // :417-418). DECISION: the deferral FIRES on unmount rather than being
        // dropped — the user clicked Build, and the mirrored arm is the
        // existing machinery (TASK-2890) for an intent that outlives this
        // component, so runAfterBuildEpic resolves it.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        ReactDOM.unmountComponentAtNode(container);

        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        // localOwned is NOT set: no local machine survives to resolve it.
        expect(h.armCalls[0].opts).toBe(undefined);
    });

    it('AC5 — the commit settles INSIDE the bound: the build fires once on the settle, and the elapsed bound never adds a second', (done) => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            deferredBuildMaxWaitMs: 20
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);
        // The commit settles — the in-flight prop flips false, exactly as
        // COMMIT_ANUGA_SCENARIO_FIELD_SETTLED makes it flip in the real store.
        h.render(savedScenario(), {selectedScenarioCommitInFlight: false});
        expect(h.buildCalls).toEqual([417]);
        setTimeout(() => {
            // The bound has long elapsed by now: its timer must have been
            // cleared on the settle, or this is two builds.
            expect(h.buildCalls).toEqual([417]);
            done();
        }, 120);
    });

    // ---- AC1(b), verifier note 2 — the SELECTION MOVING AWAY mid-deferral
    // must not release the build early. Before this fix maybeDispatchDeferred
    // Build fired the instant `selectedScenario.id !== pending.scenarioId`,
    // because selectedScenarioCommitInFlight then described a DIFFERENT
    // scenario and the component had no signal for the one it was holding. It
    // has one now: `commitsInFlight`, the raw per-scenario count map
    // (scenariosReducer.js), mapped in this component's own mapStateToProps.
    // No save is dispatched on that path either way, so this was never the
    // d92 clobber — it was the stale-INPUT half: a build POST composed
    // server-side from pre-PATCH inputs.
    const otherScenario = () => ({
        id: 999, name: 'Trial 02', status: 'created', computed_status: 'created',
        terrain: 10, boundary: 20, inflow: 30, rainfall: null,
        friction: null, structure: null, mesh_region: null, network: null,
        resolution: 1000, duration: 1800, created_by: 7, unsaved: false
    });

    it('(b/note-2) the selection moving to another scenario does NOT release a build whose own commit is still on the wire [RED AT 4b5f50ff5: it fired immediately]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        // The user clicks scenario 999 in the rail. 417's PATCH is STILL on
        // the wire (its count is untouched); only the boolean below has moved
        // to describe 999, which has nothing outstanding.
        h.render(savedScenario(), {
            scenarios: [savedScenario(), otherScenario()],
            selectedScenario: otherScenario(),
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {417: 1}
        });

        expect(h.buildCalls).toEqual([]);
        expect(h.saveCalls.length).toBe(0);
        expect(h.armCalls.length).toBe(0);
    });

    it('(b/note-2) …and it is released, exactly once and WITH its run, when the DEFERRED scenario own commit settles while another scenario is selected [RED AT 4b5f50ff5]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        const moved = {
            scenarios: [savedScenario(), otherScenario()],
            selectedScenario: otherScenario(),
            selectedScenarioCommitInFlight: false
        };
        h.render(savedScenario(), {...moved, commitsInFlight: {417: 1}});
        expect(h.buildCalls).toEqual([]);

        // COMMIT_ANUGA_SCENARIO_FIELD_SETTLED deletes the key at zero
        // (scenariosReducer.js), rebuilding the map — which is the very prop
        // change that re-enters componentDidUpdate.
        h.render(savedScenario(), {...moved, commitsInFlight: {}});

        expect(h.buildCalls).toEqual([417]);
        expect(h.saveCalls.length).toBe(0);
        // AC3 — a Build-and-Run whose build was deferred may NOT lose its run,
        // and that stays true when the deferral outlived the selection.
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        expect(h.armCalls[0].opts).toEqual({localOwned: true});

        // A further unrelated re-render must not add a second build.
        h.render(savedScenario(), {...moved, commitsInFlight: {}});
        expect(h.buildCalls).toEqual([417]);
    });

    it('(b/note-2) the selection moving away when the deferred scenario has NOTHING in flight still fires immediately [NO-REGRESSION: green at 4b5f50ff5 by design — it asserts the new read does not OVER-block]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        // 417's commit settled in the SAME tick the selection moved (and 999
        // has one of its own outstanding, which must be ignored — the map is
        // read per scenario, not "is anything in flight").
        h.render(savedScenario(), {
            scenarios: [savedScenario(), otherScenario()],
            selectedScenario: otherScenario(),
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {999: 1}
        });

        expect(h.buildCalls).toEqual([417]);
        expect(h.saveCalls.length).toBe(0);
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
    });

    it('(b/note-2) CONNECTED: the same, through the real store — proves mapStateToProps publishes commitsInFlight and that the settle wakes componentDidUpdate [RED AT 4b5f50ff5]', () => {
        // The three unconnected specs above grade the DECISION. This one
        // grades the WIRING they depend on: without the new
        // `commitsInFlight` entry in mapStateToProps the prop is undefined,
        // the map reads empty, and the held build is released on the
        // selection move exactly as before — and, worse, nothing would
        // re-render this component when the deferred scenario's commit
        // finally settles, because the boolean it used to watch describes
        // scenario 999 now.
        const store = makeThunkStore();
        store.dispatch(setAnugaScenarioData([savedScenario(), otherScenario()]));
        store.dispatch(selectAnugaScenario(savedScenario()));
        ReactDOM.render(<Provider store={store}><AnugaScenarioMenu /></Provider>, container);

        Simulate.change(container.querySelector('#terrain'), {target: {value: '11'}});
        expect(store.getState().anuga.scenarios.commitsInFlight[417]).toBe(1);
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(store.actionsOfType(BUILD_SCENARIO).length).toBe(0);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);

        // The user clicks scenario 999 in the rail while 417's PATCH is still
        // on the wire.
        store.dispatch(selectAnugaScenario(otherScenario()));
        expect(store.getState().anuga.scenarios.selectedId).toBe(999);
        expect(store.getState().anuga.scenarios.commitsInFlight[417]).toBe(1);
        expect(store.actionsOfType(BUILD_SCENARIO).length).toBe(0);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);

        // 417's commit settles. Its key is deleted at zero, rebuilding the
        // map — the prop change that re-enters maybeDispatchDeferredBuild.
        store.dispatch(commitAnugaScenarioFieldSettled(417));
        const builds = store.actionsOfType(BUILD_SCENARIO);
        expect(builds.length).toBe(1);
        expect(builds[0].scenarioId).toBe(417);
        expect(store.actionsOfType(SAVE_ANUGA_SCENARIO).length).toBe(0);
    });

    // ---- AC6, verifier note 3 — a has-id scenario can no longer reach the
    // save branch by ANY route ---------------------------------------------
    it('(note-3) a HAS-ID scenario with no buildScenarioExplicit wired dispatches NOTHING — never a has-id SAVE_ANUGA_SCENARIO [RED AT 4b5f50ff5: it saved scenario 417]', () => {
        // AC6 claims crudEpics.js:638's has-id PATCH is unreachable from
        // production once the save branch is restricted to id-less scenarios.
        // At 4b5f50ff5 that held only because mapDispatchToProps always wires
        // buildScenarioExplicit: the surviving `|| !this.props.build
        // ScenarioExplicit` disjunct still routed a has-id scenario to the
        // save branch. The guard is now `!scenario.id` alone, and a missing
        // dispatcher is its own dead end.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            buildScenarioExplicit: undefined
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build').click();
        expect(h.saveCalls.length).toBe(0);
        expect(h.buildCalls).toEqual([]);
        expect(h.runCalls.length).toBe(0);
        expect(h.armCalls.length).toBe(0);
    });

    it('(note-3) the same with NOTHING in flight, via Build-and-Run: still no save, and no run is armed for a build that never happened [RED AT 4b5f50ff5]', () => {
        const h = makeUnconnected({buildScenarioExplicit: undefined});
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.saveCalls.length).toBe(0);
        expect(h.buildCalls).toEqual([]);
        expect(h.armCalls.length).toBe(0);
        expect(h.runCalls.length).toBe(0);
    });

    it('(note-3) AC1(a) is intact: an id-LESS draft with no buildScenarioExplicit wired STILL saves', () => {
        // The (d) dead end must not swallow the lazy-create path — case (a) is
        // tested first and is keyed on !scenario.id alone.
        const h = makeUnconnected({buildScenarioExplicit: undefined});
        h.render(draftScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.saveCalls.length).toBe(1);
        expect(h.saveCalls[0]._tempId).toBe('new_1');
        expect(h.buildCalls).toEqual([]);
    });

    // ---- The CROSS-SCENARIO STRAND (re-verifier, blocking) and the rest of
    // the deferral's release contract ---------------------------------------
    //
    // f4d32f1b9 correctly stopped a selection move from releasing a held build
    // early. That made it possible, for the first time, for the deferral slot
    // to still be OCCUPIED when a second Build click landed — and the slot was
    // SINGULAR: arming for B overwrote A's intent and clearTimeout()'d A's
    // bound, so A's click was discarded with no build, no bound, no toast and
    // no trace, taking its Build-and-Run run intent with it. Exactly the
    // silently-swallowed click ruling d92's bounded wait exists to prevent.
    //
    // The deferrals are now a Map keyed by scenarioId, each entry owning its
    // own timer and its own runAfterBuild intent. The four release paths below
    // are the ones a map refactor has to get right, and until now every one of
    // them was proven only by throwaway verifier specs.
    //
    // The `moved` overrides are the "user clicks another scenario in the rail"
    // gesture: both scenarios in `scenarios`, 999 selected.
    const movedTo999 = () => ({
        scenarios: [savedScenario(), otherScenario()],
        selectedScenario: otherScenario()
    });

    // TWO-CLICK SPECS MUST USE THE OTHER BUTTON, or they grade nothing.
    // ScenarioHeaderActions debounces each action button for ACTION_DEBOUNCE_MS
    // (2000 ms, scenarioHeaderActions.js:132/:205-211/:239-240) and renders it
    // `disabled` for that window — and the debounce lives in the strip's own
    // useState with NO `key` on the element (anugaScenarioMenu.js:1558), so
    // SELECTING ANOTHER SCENARIO DOES NOT RESET IT. Clicking the same button
    // twice inside 2 s is therefore a no-op that would make a two-click spec
    // silently vacuous. The keys are independent, so Build-and-Run then Build
    // (the gesture used below) lands immediately — and that is also how the
    // cross-scenario strand is reachable in the product without waiting 2 s.
    // clickLive asserts the button really is live before clicking it, so the
    // vacuum cannot come back unnoticed.
    const clickLive = (selector) => {
        const el = container.querySelector(selector);
        expect(el).toExist();
        expect(el.disabled).toBe(false);
        el.click();
    };

    // An expect() that throws inside a setTimeout never reaches done(), so the
    // spec reports a bare "Timeout of 2000ms exceeded" instead of the actual
    // mismatch — useless to whoever is reading a future regression. Route the
    // failure to done(err) so the real diff is what gets printed.
    const settle = (done, assertions) => {
        try {
            assertions();
            done();
        } catch (err) {
            done(err);
        }
    };

    // The same for an INTERMEDIATE timed step: surface a throw through done(),
    // but do not finish the spec.
    const step = (done, actions) => {
        try {
            actions();
        } catch (err) {
            done(err);
        }
    };

    it('(strand) a build held for scenario A still fires exactly once when A own commit settles, even though a deferral was armed for scenario B in between — and B fires too [RED AT f4d32f1b9: arming B overwrote A pending intent, observed buildCalls [999]]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        // A = 417, Build-and-Run clicked while 417's field commit is on the wire.
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        // The user clicks scenario 999 in the rail. 417's PATCH is still on the
        // wire, so its build stays held (that is f4d32f1b9's note-2 fix).
        const moved = movedTo999();
        h.render(savedScenario(), {
            ...moved,
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {417: 1}
        });
        expect(h.buildCalls).toEqual([]);

        // B = 999. The user edits a field on it (999's commit opens) and clicks
        // Build there too, so a SECOND deferral is armed while A's is held.
        h.render(savedScenario(), {
            ...moved,
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1, 999: 1}
        });
        clickLive('.sv-scenario-action-build');
        expect(h.buildCalls).toEqual([]);
        expect(h.saveCalls.length).toBe(0);

        // 417's PATCH lands. A's build must fire — arming B may not have
        // discarded it.
        h.render(savedScenario(), {
            ...moved,
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {999: 1}
        });
        expect(h.buildCalls).toEqual([417]);
        // …and A's Build-and-Run run intent went with it, not with B.
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        expect(h.armCalls[0].opts).toEqual({localOwned: true});

        // 999's PATCH lands: B fires too, exactly once, and A is not
        // re-dispatched. B was a plain Build, so it arms no run.
        h.render(savedScenario(), {
            ...moved,
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {}
        });
        expect(h.buildCalls).toEqual([417, 999]);
        expect(h.armCalls.length).toBe(1);
        expect(h.saveCalls.length).toBe(0);

        // A further unrelated re-render adds neither.
        h.render(savedScenario(), {...moved, selectedScenarioCommitInFlight: false, commitsInFlight: {}});
        expect(h.buildCalls).toEqual([417, 999]);
    });

    it('(strand) each held deferral keeps its OWN bound: A bound elapses and releases A even though a deferral for B was armed after it [RED AT f4d32f1b9: arming B clearTimeout()d A bound, so A never fired at all]', (done) => {
        // Both entries take the same injected bound, so arming B ~60 ms after A
        // staggers the two timers and the order of buildCalls is deterministic:
        // A's bound started first, so A fires first. The final assertion waits
        // well past both (400 ms vs bounds at ~100 ms and ~160 ms).
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 100
        });
        h.render(savedScenario());
        clickLive('.sv-scenario-action-build-run');
        expect(h.buildCalls).toEqual([]);

        const moved = movedTo999();
        setTimeout(() => step(done, () => {
            // Selection moves to 999, whose own commit is now on the wire, and
            // a second Build is clicked there (the OTHER button — see clickLive
            // above). Neither PATCH ever settles: the bounds are the only thing
            // that can release these two builds.
            h.render(savedScenario(), {
                ...moved,
                selectedScenarioCommitInFlight: true,
                commitsInFlight: {417: 1, 999: 1}
            });
            clickLive('.sv-scenario-action-build');
        }), 60);

        setTimeout(() => settle(done, () => {
            expect(h.buildCalls).toEqual([417, 999]);
            expect(h.saveCalls.length).toBe(0);
            // A's bound carried A's run intent; B was a plain Build.
            expect(h.armCalls.length).toBe(1);
            expect(h.armCalls[0].sid).toBe(417);
        }), 400);
    });

    it('(strand) componentWillUnmount FLUSHES EVERY held deferral, not just the most recent one [RED AT f4d32f1b9: only the last-armed survived to be flushed]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        clickLive('.sv-scenario-action-build-run');

        const moved = movedTo999();
        h.render(savedScenario(), {
            ...moved,
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1, 999: 1}
        });
        clickLive('.sv-scenario-action-build');
        expect(h.buildCalls).toEqual([]);

        // One Hydraulics-tab click (anugaContainer.js:283-290, :417-418).
        ReactDOM.unmountComponentAtNode(container);

        expect(h.buildCalls).toEqual([417, 999]);
        // 417's run is handed to runAfterBuildEpic WITHOUT localOwned — no
        // local machine survives the unmount to resolve it. (The Redux mirror
        // is itself keyed per scenario, scenariosReducer.js
        // ARM_RUN_AFTER_BUILD :471-491, so concurrent flushed runs would not
        // overwrite one another.) 999 was a plain Build and arms nothing.
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        expect(h.armCalls[0].opts).toBe(undefined);
        expect(h.saveCalls.length).toBe(0);
    });

    it('(strand) a SECOND Build click on a scenario that ALREADY has a deferral held folds into that entry: one build on release, and a plain Build cannot downgrade a pending run [NO-REGRESSION: green at f4d32f1b9 by design — the single slot already OR-ed the run for the same scenario; it guards the fold the map has to keep]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        clickLive('.sv-scenario-action-build-run');
        // An impatient second click, on the plain Build — the other debounce
        // key, so it lands immediately (see clickLive above).
        clickLive('.sv-scenario-action-build');
        expect(h.buildCalls).toEqual([]);

        h.render(savedScenario(), {selectedScenarioCommitInFlight: false, commitsInFlight: {}});

        // ONE build, not two…
        expect(h.buildCalls).toEqual([417]);
        // …and the run intent from the FIRST click survived the plain Build.
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        expect(h.armCalls[0].opts).toEqual({localOwned: true});
        expect(h.saveCalls.length).toBe(0);
    });

    it('(strand) …and that second click does NOT restart the entry bound: the bound is measured from the FIRST held click, so re-clicking cannot extend the wait [RED AT f4d32f1b9: the bound was re-armed from the second click]', (done) => {
        // Deliberately generous margins for a timing spec: the bound is 400 ms
        // and the second click lands at ~250 ms, so the correct behaviour fires
        // at ~400 ms and the f4d32f1b9 behaviour at ~650 ms. The assertion at
        // 560 ms sits 160 ms after the first and 90 ms before the second.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 400
        });
        h.render(savedScenario());
        clickLive('.sv-scenario-action-build-run');
        expect(h.buildCalls).toEqual([]);

        setTimeout(() => step(done, () => {
            // The plain Build — the other debounce key, so it lands (250 ms is
            // well inside ACTION_DEBOUNCE_MS; see clickLive above).
            clickLive('.sv-scenario-action-build');
            expect(h.buildCalls).toEqual([]);
        }), 250);

        setTimeout(() => settle(done, () => {
            expect(h.buildCalls).toEqual([417]);
            expect(h.armCalls.length).toBe(1);
            expect(h.armCalls[0].sid).toBe(417);
            expect(h.saveCalls.length).toBe(0);
        }), 560);
    });

    it('(release) the BOUND still fires AFTER the selection has moved off the deferred scenario, whose PATCH never settles [NO-REGRESSION: green at f4d32f1b9 by design — a no-regression guard cannot be made red without faking it]', (done) => {
        // The combination f4d32f1b9's note-2 fix created and never specced:
        // held across a selection move AND released by nothing but the bound.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 40
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();

        h.render(savedScenario(), {
            ...movedTo999(),
            selectedScenarioCommitInFlight: false,
            // 417's PATCH is hung: its bucket is never emptied.
            commitsInFlight: {417: 1}
        });
        expect(h.buildCalls).toEqual([]);

        setTimeout(() => settle(done, () => {
            expect(h.buildCalls).toEqual([417]);
            expect(h.armCalls.length).toBe(1);
            expect(h.armCalls[0].sid).toBe(417);
            expect(h.saveCalls.length).toBe(0);
        }), 200);
    });

    it('(release) an UNMOUNT while holding a build for a scenario that is no longer the selected one still flushes it [NO-REGRESSION: green at f4d32f1b9 by design]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build-run').click();
        h.render(savedScenario(), {
            ...movedTo999(),
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {417: 1}
        });
        expect(h.buildCalls).toEqual([]);

        ReactDOM.unmountComponentAtNode(container);

        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0].sid).toBe(417);
        expect(h.armCalls[0].opts).toBe(undefined);
        expect(h.saveCalls.length).toBe(0);
    });

    it('(release) the DEFERRED scenario being DELETED from the store mid-deferral still releases its build exactly once — the click is not silently swallowed [NO-REGRESSION: green at f4d32f1b9 by design]', () => {
        // deleteAnugaScenarioEpic (crudEpics.js:188) has no reducer case; the
        // scenario simply stops appearing in `scenarios` on the next refresh
        // and the selection moves off it, while its own settle empties its
        // commitsInFlight bucket. DECISION (unchanged by the map): the held
        // build is RELEASED, not dropped. A POST for a scenario the server no
        // longer has fails visibly through the normal build-error path, which
        // is the outcome AC5 asks for — never a swallowed click.
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        container.querySelector('.sv-scenario-action-build').click();
        expect(h.buildCalls).toEqual([]);

        // 417 is gone from the list entirely and 999 is selected.
        const deleted = {
            scenarios: [otherScenario()],
            selectedScenario: otherScenario(),
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {}
        };
        h.render(savedScenario(), deleted);

        expect(h.buildCalls).toEqual([417]);
        expect(h.saveCalls.length).toBe(0);
        // A plain Build arms no run, and the vanished scenario arms none either.
        expect(h.armCalls.length).toBe(0);

        // Later ticks cannot re-dispatch it.
        h.render(savedScenario(), deleted);
        expect(h.buildCalls).toEqual([417]);
    });

    // ---- TASK-3038 — this.state.runAfterBuild is a SINGLE slot -------------
    //
    // armAndDispatchBuildAndRun (:1241) does `this.setState({runAfterBuild:
    // {scenarioId, phase}})` with no guard on an existing slot — there is ONE
    // slot for the whole component. The Redux mirror (scenariosReducer.js
    // ARM_RUN_AFTER_BUILD :471-491) is already per-scenario, so arming a
    // second Build-and-Run on a DIFFERENT scenario overwrites the first's
    // local machine while its Redux mirror still says localOwned:true —
    // runAfterBuildEpic (pollingEpics.js) then defers to a local resolver
    // that no longer describes that scenario, and the first run never fires.
    // Converted to a Map keyed by scenarioId, mirroring the shape
    // this.pendingDeferredBuilds already uses (:586) — a DIFFERENT map (that
    // one holds builds deferred for an in-flight commit; this one holds runs
    // awaiting a build's completion).
    const withStatus = (scenario, status) => ({...scenario, status, computed_status: status});

    it('(3038/AC2) two Build-and-Runs on DIFFERENT scenarios: BOTH runs fire exactly once [RED AT HEAD: the first run never fires — the single slot is overwritten by the second arm]', () => {
        const h = makeUnconnected();
        const a0 = savedScenario();
        const b0 = otherScenario();
        // A armed first, via a REAL click — the production gesture.
        h.render(a0, {scenarios: [a0, b0], selectedScenario: a0});
        clickLive('.sv-scenario-action-build-run');
        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls.length).toBe(1);
        expect(h.armCalls[0]).toEqual({sid: 417, opts: {localOwned: true}});

        // B armed second, on a DIFFERENT scenario, driven through the SAME
        // handler the real button dispatches to (handleBuildAndRunClick) via
        // the mounted instance — sidesteps ScenarioHeaderActions' unrelated
        // 2s ACTION_DEBOUNCE_MS on the SAME button (clicking it a second
        // time this soon would be silently swallowed and prove nothing —
        // T4/H4). The assertions immediately below prove this second click
        // actually landed (a real second buildCalls entry, a real second
        // armCalls entry) rather than having silently no-op'd.
        h.render(a0, {scenarios: [a0, b0], selectedScenario: b0});
        h.getInstance().handleBuildAndRunClick(b0);
        expect(h.buildCalls).toEqual([417, 999]);
        expect(h.armCalls.length).toBe(2);
        expect(h.armCalls[1]).toEqual({sid: 999, opts: {localOwned: true}});

        // Both builds go in flight, then A alone reaches 'built'. With a
        // single slot, arming B above would have already discarded A's
        // intent — THIS is where AT HEAD A's run never fires.
        h.render(a0, {
            scenarios: [withStatus(a0, 'building'), withStatus(b0, 'building')],
            selectedScenario: b0
        });
        h.render(a0, {
            scenarios: [withStatus(a0, 'built'), withStatus(b0, 'building')],
            selectedScenario: b0
        });
        expect(h.runCalls.length).toBe(1);
        expect(h.runCalls[0].scenario.id).toBe(417);
        // AC3 (mounted direction) — the component resolved A's arm itself
        // and cleared A's OWN Redux mirror; B's arm is untouched.
        expect(h.clearCalls).toEqual([417]);

        // B then reaches 'built' too — its run fires as well, exactly once,
        // and A is not re-dispatched.
        h.render(a0, {
            scenarios: [withStatus(a0, 'built'), withStatus(b0, 'built')],
            selectedScenario: b0
        });
        expect(h.runCalls.length).toBe(2);
        expect(h.runCalls.map((c) => c.scenario.id).sort()).toEqual([417, 999]);
        expect(h.clearCalls).toEqual([417, 999]);
    });

    it('(3038/AC4) a scenario armed twice (Build-and-Run re-dispatched before the first resolves) still fires exactly ONE run', () => {
        const h = makeUnconnected();
        const a0 = savedScenario();
        h.render(a0, {scenarios: [a0], selectedScenario: a0});
        clickLive('.sv-scenario-action-build-run');
        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls.length).toBe(1);

        // A second Build-and-Run on the SAME scenario before the first build
        // is even observed in flight — driven via the instance to sidestep
        // the unrelated 2s button debounce (T4), which is not what this spec
        // targets. Both are real dispatches: "always build" semantics are
        // unchanged by this fix (the RUN half is what AC1 makes per-scenario,
        // not the build half).
        h.getInstance().handleBuildAndRunClick(a0);
        expect(h.buildCalls).toEqual([417, 417]);
        // The Map has ONE entry keyed on scenarioId 417 either way —
        // re-arming overwrites that entry, it does not accumulate a second.
        expect(h.armCalls.length).toBe(2);

        h.render(a0, {scenarios: [withStatus(a0, 'building')], selectedScenario: a0});
        h.render(a0, {scenarios: [withStatus(a0, 'built')], selectedScenario: a0});
        expect(h.runCalls.length).toBe(1);
        expect(h.runCalls[0].scenario.id).toBe(417);

        // A further unrelated update must not re-fire.
        h.render(a0, {scenarios: [withStatus(a0, 'built')], selectedScenario: a0});
        expect(h.runCalls.length).toBe(1);
    });

    it('(3038/AC3) unmount still hands a HELD deferral to Redux WITHOUT localOwned, even while a DIFFERENT scenario already has an immediate (mounted-owned, localOwned:true) run armed — the two maps do not interfere', () => {
        const h = makeUnconnected({deferredBuildMaxWaitMs: 60000});
        const a0 = savedScenario();
        const b0 = otherScenario();
        // A: NO commit of its own in flight, so its Build-and-Run dispatches
        // immediately and is armed locally (localOwned:true) — the mounted
        // component resolves it itself.
        h.render(a0, {
            scenarios: [a0, b0], selectedScenario: a0,
            selectedScenarioCommitInFlight: false, commitsInFlight: {}
        });
        clickLive('.sv-scenario-action-build-run');
        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls[0]).toEqual({sid: 417, opts: {localOwned: true}});

        // B: its OWN field commit is on the wire (selectedScenarioCommitInFlight
        // describes whichever scenario is currently selected), so its
        // Build-and-Run is HELD (pendingDeferredBuilds), not armed yet.
        // Driven via the instance (not a real second DOM click) to sidestep
        // ScenarioHeaderActions' unrelated 2s ACTION_DEBOUNCE_MS on the SAME
        // button, left over from A's click above (T4) — orthogonal to what
        // this spec targets.
        h.render(a0, {
            scenarios: [a0, b0], selectedScenario: b0,
            selectedScenarioCommitInFlight: true, commitsInFlight: {999: 1}
        });
        h.getInstance().handleBuildAndRunClick(b0);
        expect(h.buildCalls).toEqual([417]);
        expect(h.armCalls.length).toBe(1);

        // Unmount: componentWillUnmount flushes EVERY held deferral (B) —
        // handing its run off to Redux WITHOUT localOwned, since there is no
        // longer a mounted component to resolve it locally — while A's
        // ALREADY-ARMED entry in the (separate) runAfterBuild map is left
        // untouched (pre-existing behaviour, unrelated to this Map
        // conversion — H6).
        ReactDOM.unmountComponentAtNode(container);
        expect(h.buildCalls).toEqual([417, 999]);
        expect(h.armCalls.length).toBe(2);
        expect(h.armCalls[1].sid).toBe(999);
        expect(h.armCalls[1].opts).toBe(undefined);
    });

    // ---- TASK-3038 (folded TASK-3039) — AC7/AC8: fireDeferredBuild must not
    // arm a run it cannot build -----------------------------------------
    //
    // Today the dispatch at :699-701 is guarded on this.props.
    // buildScenarioExplicit, but the arming block at :704-711 sits OUTSIDE
    // that guard and runs regardless — contradicting dispatchBuild's own
    // branch (d) comment (:1098-1110), which this spec matches exactly: no
    // dispatch, no arm, the SAME 'anuga-scenario-menu-build-unavailable'
    // trackEvent. AC7 is unreachable in production today (mapDispatchToProps
    // always wires buildScenarioExplicit, ~:1984) — a latent-footgun fix,
    // kept to one guard and one spec (T2).
    it('(3038/AC7,AC8) fireDeferredBuild dispatches no build and arms no run when buildScenarioExplicit is absent at fire time [RED AT HEAD: the run IS armed even though nothing is dispatched]', () => {
        const h = makeUnconnected({
            selectedScenarioCommitInFlight: true,
            commitsInFlight: {417: 1},
            deferredBuildMaxWaitMs: 60000
        });
        h.render(savedScenario());
        // Arm a deferral for Build-and-Run WHILE buildScenarioExplicit is
        // still present — a real arm, holding a real runAfterBuild intent.
        container.querySelector('.sv-scenario-action-build-run').click();
        expect(h.buildCalls).toEqual([]);

        // The prop is ABSENT by the time the deferral releases (the commit
        // settles on a re-render that also drops buildScenarioExplicit).
        // buildScenarioExplicit is PropTypes.func, optional (:455), so an
        // unconnected render can express this legally; mapDispatchToProps
        // wires it unconditionally in production (T2), so this path is
        // reachable only from a hand-built unconnected render — exactly this
        // harness.
        h.render(savedScenario(), {
            buildScenarioExplicit: undefined,
            selectedScenarioCommitInFlight: false,
            commitsInFlight: {}
        });

        expect(h.buildCalls).toEqual([]);
        expect(h.armCalls.length).toBe(0);
        expect(h.runCalls.length).toBe(0);
    });
});
