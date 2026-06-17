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
 *   - Category rail regression: 4 items, no `.sv-anuga-scenario-category-section-label`.
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

import { AnugaScenarioMenu } from '../anugaScenarioMenu';

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
            const hiddenBefore = container.querySelectorAll('.scenario-rail-item-compare-checkbox.is-hidden');
            expect(hiddenBefore.length).toBe(2);
            compareBtn.click();
            setTimeout(() => {
                const visibleAfter = container.querySelectorAll(
                    '.scenario-rail-item-compare-checkbox:not(.is-hidden)'
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
    // Category rail composition (regression guards)
    // ----------------------------------------------------------------
    describe('Category rail composition', () => {
        it('renders 4 category items (no runLog)', () => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
            expect(items.length).toBe(3); // TASK-1416: merged run (was 4)
        });

        it('does NOT render .sv-anuga-scenario-category-section-label anywhere', () => {
            const s1 = makeScenario(21, 'Baseline');
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const labels = container.querySelectorAll('.sv-anuga-scenario-category-section-label');
            expect(labels.length).toBe(0);
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
    const toolbarRawResult = require(
        '!!raw-loader!../scenarioActionToolbar.js'
    );
    const menuSrc = stripComments(
        typeof menuRawResult === 'string' ? menuRawResult : (menuRawResult && menuRawResult.default)
    );
    const toolbarSrc = stripComments(
        typeof toolbarRawResult === 'string' ? toolbarRawResult : (toolbarRawResult && toolbarRawResult.default)
    );

    it('anugaScenarioMenu.js (code) does not call window.confirm', () => {
        expect(menuSrc).toExist();
        expect(menuSrc).toNotInclude('window.confirm');
    });

    it('anugaScenarioMenu.js (code) does not call window.alert', () => {
        expect(menuSrc).toNotInclude('window.alert');
    });

    it('scenarioActionToolbar.js (code) does not call window.confirm', () => {
        expect(toolbarSrc).toExist();
        expect(toolbarSrc).toNotInclude('window.confirm');
    });

    it('scenarioActionToolbar.js (code) does not call window.alert', () => {
        expect(toolbarSrc).toNotInclude('window.alert');
    });
});
