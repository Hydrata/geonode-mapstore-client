/*
 * Container-level wiring + header-strip behaviour test for the new
 * Miller-columns anugaScenarioMenu. Rewritten for TASK-C-scenarios-miller
 * W4 after the W3 cutover replaced the table-driven implementation with
 * the rail+pane container.
 *
 * Anchors:
 *   - Archive-filter chip (3 tests, behaviour preserved from W2 menu).
 *   - + New Scenario dispatches addAnugaScenario.
 *   - Compare-mode toggle flips local state + reveals checkboxes.
 *   - In compare mode + 2 scenarios `selected`, Execute Compare
 *     dispatches compareScenarios.
 *   - Wave 3C C3: Close X removed per operator decision D3 — top-tab
 *     switch on anugaContainer.js handles panel close + polling stop. The
 *     panel header MUST NOT render a .legend-close element.
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

// Import the connected default to ensure the redux wire still resolves the
// chip props (archiveFilter + setAnugaScenarioArchiveFilter).
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

describe('anugaScenarioMenu W4 — header strip wiring', () => {
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
    // Archive-filter chip (TASK-880 carry-over)
    // ----------------------------------------------------------------
    describe('Archive-filter chip', () => {
        it('renders the chip without .active class when archiveFilter is "none"', () => {
            const store = makeStore({archiveFilter: 'none'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const group = container.querySelector('#scenario-tab-button-group');
            expect(group).toExist();
            // New header has 2 chip buttons: archive-chip + compare-toggle.
            const buttons = Array.from(group.querySelectorAll('button.scenario-tab'));
            expect(buttons.length).toBe(2);
            const chip = buttons[0]; // archive-filter chip
            expect(chip.className).toNotContain('active');
        });

        it('renders the chip with .active class when archiveFilter is "only"', () => {
            const store = makeStore({archiveFilter: 'only'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const group = container.querySelector('#scenario-tab-button-group');
            const buttons = Array.from(group.querySelectorAll('button.scenario-tab'));
            expect(buttons.length).toBe(2);
            const chip = buttons[0];
            expect(chip.className).toContain('active');
        });

        it('dispatches SET_ANUGA_SCENARIO_ARCHIVE_FILTER on chip click', () => {
            const store = makeStore({archiveFilter: 'none'});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            const chip = buttons[0];
            chip.click();
            const setFilter = store.__actions().find(a => a?.type === 'SET_ANUGA_SCENARIO_ARCHIVE_FILTER');
            expect(setFilter).toExist();
            expect(setFilter.mode).toBe('only');
        });

        it('Wave 3A — shows the Active count next to the chip label', () => {
            const s1 = makeScenario(21, 'Baseline'); // not archived
            const s2 = makeScenario(22, 'With levee'); // not archived
            const s3 = makeScenario(23, 'Old', {archived_at: '2026-01-01T00:00:00Z'});
            const store = makeStore({archiveFilter: 'none', scenariosArr: [s1, s2, s3]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const chip = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab')[0];
            const count = chip.querySelector('.scenario-tab-count');
            expect(count).toExist();
            // 2 active, 1 archived; in "Active" mode the chip shows the active count.
            expect(count.textContent.trim()).toBe('(2)');
        });

        it('Wave 3A — shows the Archived count when archiveFilter is "only"', () => {
            const s1 = makeScenario(21, 'Baseline');
            const s2 = makeScenario(22, 'With levee');
            const s3 = makeScenario(23, 'Old', {archived_at: '2026-01-01T00:00:00Z'});
            const store = makeStore({archiveFilter: 'only', scenariosArr: [s1, s2, s3]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const chip = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab')[0];
            const count = chip.querySelector('.scenario-tab-count');
            expect(count).toExist();
            expect(count.textContent.trim()).toBe('(1)');
        });
    });

    // ----------------------------------------------------------------
    // + New Scenario button
    // ----------------------------------------------------------------
    describe('+ New Scenario button', () => {
        it('renders inside #new-scenario-button when canCreateScenario is true', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // editor role from store has canCreateScenario; the button should render.
            expect(container.querySelector('#new-scenario-button')).toExist();
        });

        it('dispatches ADD_ANUGA_SCENARIO when clicked', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const btn = container.querySelector('#new-scenario-button .anuga-btn');
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
        it('clicking the Compare tab flips compareMode + reveals rail checkboxes', (done) => {
            const s1 = makeScenario(21, 'Baseline');
            const s2 = makeScenario(22, 'With levee');
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            const compareToggle = buttons[1];
            // Before click: rail checkboxes hidden.
            const hiddenBefore = container.querySelectorAll('.scenario-rail-item-compare-checkbox.is-hidden');
            expect(hiddenBefore.length).toBe(2);
            compareToggle.click();
            setTimeout(() => {
                const visibleAfter = container.querySelectorAll(
                    '.scenario-rail-item-compare-checkbox:not(.is-hidden)'
                );
                expect(visibleAfter.length).toBe(2);
                done();
            });
        });

        it('toggling Compare twice clears any `selected` flags via toggleScenarioSelected', (done) => {
            // Simulate two scenarios already marked selected in the store
            // (e.g. user checked them in compare mode earlier).
            const s1 = makeScenario(21, 'Baseline', {selected: true});
            const s2 = makeScenario(22, 'With levee', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            const compareToggle = buttons[1];
            compareToggle.click(); // enter compare
            setTimeout(() => {
                compareToggle.click(); // leave compare → should clear flags
                setTimeout(() => {
                    const toggles = store.__actions().filter(a => a?.type === 'TOGGLE_SCENARIO_SELECTED');
                    expect(toggles.length).toBe(2);
                    done();
                });
            });
        });
    });

    // ----------------------------------------------------------------
    // Execute Compare button
    // ----------------------------------------------------------------
    describe('Execute Compare button', () => {
        it('is hidden by default and visible only in compare mode', (done) => {
            const store = makeStore({scenariosArr: [makeScenario(21, 'A'), makeScenario(22, 'B')]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            expect(container.querySelector('#depth-difference-button')).toNotExist();
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            buttons[1].click();
            setTimeout(() => {
                expect(container.querySelector('#depth-difference-button')).toExist();
                done();
            });
        });

        it('is disabled when fewer than 2 scenarios are selected', (done) => {
            const s1 = makeScenario(21, 'A'); // not selected
            const store = makeStore({scenariosArr: [s1]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            buttons[1].click();
            setTimeout(() => {
                const execBtn = container.querySelector('#depth-difference-button .anuga-btn');
                expect(execBtn).toExist();
                expect(execBtn.className).toInclude('disabled');
                done();
            });
        });

        it('dispatches COMPARE_SCENARIOS when exactly 2 scenarios are selected', (done) => {
            const s1 = makeScenario(21, 'A', {selected: true});
            const s2 = makeScenario(22, 'B', {selected: true});
            const store = makeStore({scenariosArr: [s1, s2]});
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
            buttons[1].click();
            setTimeout(() => {
                const execBtn = container.querySelector('#depth-difference-button .anuga-btn');
                expect(execBtn.className).toNotInclude('disabled');
                execBtn.click();
                const compareDispatched = store.__actions().filter(a => a?.type === 'COMPARE_SCENARIOS');
                expect(compareDispatched.length).toBe(1);
                done();
            });
        });
    });

    // ----------------------------------------------------------------
    // Close X removed (Wave 3C C3) — regression guard
    // ----------------------------------------------------------------
    describe('Close X regression (Wave 3C C3)', () => {
        it('does NOT render a .legend-close element in the panel header', () => {
            const store = makeStore();
            ReactDOM.render(
                <Provider store={store}><AnugaScenarioMenu /></Provider>,
                container
            );
            // Operator decision D3: panel exits via top-tab switch on
            // anugaContainer.js, which already toggles
            // setAnugaScenarioMenu + start/stopAnugaScenarioPolling.
            const closeBtn = container.querySelector('.legend-close');
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
