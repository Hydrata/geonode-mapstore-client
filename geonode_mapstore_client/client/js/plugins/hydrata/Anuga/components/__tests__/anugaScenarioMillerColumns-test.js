import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {AnugaScenarioMenu, AnugaScenarioMenuClass} from '../anugaScenarioMenu';

/**
 * TASK-C-scenarios-miller — wave-level integration test for the new
 * Miller-columns scenarios container. Re-cut after the Option A header
 * refactor + 4-category rail (no runLog).
 *
 *   A. Rail+pane composition (mount, count rail items = scenarios.length,
 *      first is `.is-active` after auto-select).
 *   B. Pane swap on rail click (clicking a rail item flips `.is-active`
 *      and dispatches SELECT_ANUGA_SCENARIO).
 *   C. Category subtab switching (4 items, Inputs / Advanced / Run config
 *      / Status & actions; clicking flips the in-pane content; the
 *      Status & actions pane now bundles the inline ScenarioRunLog block).
 *   D. Field-update dispatches (typing in the name field or changing a
 *      dropdown dispatches UPDATE_ANUGA_SCENARIO).
 *   E. Empty-scenarios fallback (rail empty + pane "no scenario"
 *      placeholder; container does not crash).
 *   F. Compare-mode (Option A header): clicking `.anuga-btn-compare`
 *      flips local state + shows checkboxes; `.anuga-btn-run-compare`
 *      renders only when readyToCompare; click dispatches
 *      COMPARE_SCENARIOS.
 *   G. Cross-plugin no-leak smoke (mount alongside another panel,
 *      no state collision; mount/unmount cycle is clean).
 *
 * window.confirm regression guard: `beforeEach` reassigns window.confirm
 * to a throw-on-call mock so any accidental synchronous-dialog code path
 * fails fast (memory pin feedback-window-confirm-blocks-automation).
 *
 * Tests use plain `connect`-resolved store (no real redux/thunk) so we
 * can inspect dispatched action types directly via __actions().
 */

function createMockStore(overrides = {}) {
  const defaults = {
    anuga: {
      scenarios: {byId: {}, allIds: [], archiveFilter: 'none', selectedId: null},
      resources: {
        terrain: [], boundaries: [], inflows: [], rainfalls: [],
        frictions: [], structures: [], meshRegions: [], networks: []
      },
      projects: {data: {id: 1, my_role: 'editor'}}
    },
    security: {user: {pk: 9999}}
  };
  const merged = {
    ...defaults,
    ...overrides,
    anuga: {
      ...defaults.anuga,
      ...(overrides.anuga || {}),
      scenarios: {...defaults.anuga.scenarios, ...(overrides.anuga?.scenarios || {})},
      resources: {...defaults.anuga.resources, ...(overrides.anuga?.resources || {})},
      projects: {...defaults.anuga.projects, ...(overrides.anuga?.projects || {})}
    },
    security: {...defaults.security, ...(overrides.security || {})}
  };
  let actions = [];
  return {
    getState: () => merged,
    subscribe: () => () => {},
    dispatch: (a) => { actions.push(a); return a; },
    __actions: () => actions
  };
}

function makeScenario(id, name, extra = {}) {
  return {
    id,
    name,
    status: 'created',
    created_by: 7,
    created_by_username: 'alice',
    terrain: null,
    boundary: null,
    inflow: null,
    rainfall: null,
    friction: null,
    structure: null,
    mesh_region: null,
    network: null,
    resolution: 1000,
    duration: 1800,
    ...extra
  };
}

describe('ANUGA Scenarios Miller-columns integration', () => {
  let container;
  let origConfirm;

  beforeEach((done) => {
    document.body.innerHTML = '<div id="container"></div>';
    container = document.getElementById('container');
    origConfirm = window.confirm;
    window.confirm = () => { throw new Error('window.confirm was called inside the scenarios surface'); };
    setTimeout(done);
  });

  afterEach((done) => {
    ReactDOM.unmountComponentAtNode(container);
    document.body.innerHTML = '';
    window.confirm = origConfirm;
    setTimeout(done);
  });

  // ------------------------------------------------------------------
  // A. Rail+pane composition
  // ------------------------------------------------------------------
  describe('A. Rail+pane composition', () => {
    it('mounts the panel chrome with the Miller class chain', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const panel = container.querySelector('#anuga-scenario-menu');
          expect(panel).toExist();
          expect(panel.className).toInclude('simple-view-panel');
          expect(panel.className).toInclude('anuga-panel');
          expect(panel.className).toInclude('simple-view-panel--miller');
          expect(panel.className).toInclude('anuga-scenario-miller');
          done();
        }
      );
    });

    it('renders the rail+pane shell', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('.sv-rail-pane-shell')).toExist();
          expect(container.querySelector('.sv-category-rail')).toExist();
          expect(container.querySelector('.menu-rows-pane')).toExist();
          done();
        }
      );
    });

    it('renders the 3-column shell: scenario rail / category rail / detail', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          // Pane 1 — scenario list rail (existing sv-category-rail).
          expect(container.querySelector('.sv-category-rail')).toExist();
          // Pane 2 — vertical category rail.
          expect(container.querySelector('.anuga-scenario-category-rail')).toExist();
          // Pane 3 — detail body.
          expect(container.querySelector('.anuga-scenario-pane-detail')).toExist();
          done();
        }
      );
    });

    it('renders one rail item per scenario in the store', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const s2 = makeScenario(22, 'With levee');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          expect(items.length).toBe(2);
          done();
        }
      );
    });

    it('marks the selectedId scenario as .is-active in the rail', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const s2 = makeScenario(22, 'With levee');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 22}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          expect(items[0].className).toNotInclude('is-active');
          expect(items[1].className).toInclude('is-active');
          done();
        }
      );
    });

    it('renders the header strip with Scenarios title', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('.scenario-menu-header')).toExist();
          // Option A: header has #scenario-header-actions instead of
          // the legacy #scenario-tab-button-group.
          expect(container.querySelector('#scenario-header-actions')).toExist();
          expect(container.querySelector('#scenario-tab-button-group')).toNotExist();
          done();
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // B. Pane swap on rail click
  // ------------------------------------------------------------------
  describe('B. Rail click dispatches SELECT_ANUGA_SCENARIO', () => {
    it('clicking a non-active rail row dispatches selectAnugaScenario', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const s2 = makeScenario(22, 'With levee');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          items[1].click();
          const dispatched = store.__actions().filter(a => a?.type === 'SELECT_ANUGA_SCENARIO');
          expect(dispatched.length).toBeGreaterThanOrEqualTo(1);
          // The last SELECT_ANUGA_SCENARIO should target scenario id=22.
          const last = dispatched[dispatched.length - 1];
          expect(last.scenario.id).toBe(22);
          done();
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // C. Category rail switching (4 categories — no runLog)
  // ------------------------------------------------------------------
  describe('C. Category rail switching', () => {
    it('renders 4 category items in the vertical rail (Inputs/Advanced/Run config/Status and actions)', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          expect(items.length).toBe(4);
          // Default: Inputs is active.
          expect(items[0].className).toInclude('is-active');
          expect(items[1].className).toNotInclude('is-active');
          done();
        }
      );
    });

    it('does not render any .anuga-scenario-category-section-label inside the rail', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const labels = container.querySelectorAll('.anuga-scenario-category-section-label');
          expect(labels.length).toBe(0);
          done();
        }
      );
    });

    it('clicking Advanced (items[1]) flips is-active and renders the friction dropdown', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          items[1].click(); // advanced
          setTimeout(() => {
            const itemsAfter = container.querySelectorAll('.anuga-scenario-category-item');
            expect(itemsAfter[0].className).toNotInclude('is-active');
            expect(itemsAfter[1].className).toInclude('is-active');
            expect(container.querySelector('#friction')).toExist();
            done();
          });
        }
      );
    });

    it('clicking Run config (items[2]) renders resolution + duration + compute_backend', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          items[2].click(); // runConfig
          setTimeout(() => {
            expect(container.querySelector('#resolution')).toExist();
            expect(container.querySelector('#duration')).toExist();
            expect(container.querySelector('#compute_backend')).toExist();
            done();
          });
        }
      );
    });

    it('clicking Status and actions (items[3]) shows the status card + action toolbar', (done) => {
      const s1 = makeScenario(21, 'Baseline', {status: 'built'});
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          items[3].click(); // statusActions
          setTimeout(() => {
            expect(container.querySelector('.anuga-scenario-pane-rows-status-actions')).toExist();
            expect(container.querySelector('.anuga-scenario-status-card')).toExist();
            expect(container.querySelector('.scenario-action-toolbar')).toExist();
            done();
          });
        }
      );
    });

    it('Status and actions also renders the inline .anuga-scenario-pane-log block', (done) => {
      // No run yet → log is empty string, lineCount is undefined (so no
      // " (N)" suffix appears next to the title).
      const s1 = makeScenario(21, 'Baseline', {status: 'created'});
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          // Click the 4th category (Status and actions).
          items[3].click();
          setTimeout(() => {
            const log = container.querySelector('.anuga-scenario-pane-log');
            expect(log).toExist();
            const title = container.querySelector('.anuga-scenario-pane-log-title');
            expect(title).toExist();
            // No intl provider in this test, so <Message msgId="hydrata.anuga.log" />
            // renders the literal msgId string. Asserting the msgId substring
            // is the closest deterministic check for "the log header was
            // rendered using the right translation key".
            expect(title.textContent).toInclude('hydrata.anuga.log');
            // Without latest_run there is no " (N)" parenthetical suffix.
            expect(title.textContent).toNotInclude('(');
            const pre = container.querySelector('.anuga-scenario-pane-log-viewer');
            expect(pre).toExist();
            // No log text — CSS handles the placeholder via :empty::before.
            // textContent must be empty (no string interpolated).
            expect(pre.textContent.length).toBe(0);
            done();
          });
        }
      );
    });

    it('Status and actions log shows " (N)" line-count when latest_run.log_line_count is finite', (done) => {
      const s1 = makeScenario(21, 'Baseline', {
        status: 'built',
        latest_run: {id: 999, log: 'first line\nsecond line', log_line_count: 42}
      });
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const items = container.querySelectorAll('.anuga-scenario-category-item');
          items[3].click(); // statusActions
          setTimeout(() => {
            const title = container.querySelector('.anuga-scenario-pane-log-title');
            expect(title).toExist();
            expect(title.textContent).toInclude('(42)');
            const pre = container.querySelector('.anuga-scenario-pane-log-viewer');
            expect(pre.textContent).toInclude('first line');
            expect(pre.textContent).toInclude('second line');
            done();
          });
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // D. Field-update dispatches
  // ------------------------------------------------------------------
  describe('D. Field-update dispatches', () => {
    it('typing in the name field dispatches UPDATE_ANUGA_SCENARIO', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const nameInput = container.querySelector('#name');
          expect(nameInput).toExist();
          // React 16 maps onChange on text inputs to native input events; use
          // ReactDOM's nativeInputValueSetter pattern to fire a proper change.
          // Simpler path: set value + dispatch 'input' bubbling event.
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          setter.call(nameInput, 'Renamed');
          nameInput.dispatchEvent(new window.Event('input', {bubbles: true}));
          const updates = store.__actions().filter(a => a?.type === 'UPDATE_ANUGA_SCENARIO');
          expect(updates.length).toBeGreaterThanOrEqualTo(1);
          // Action shape: {type, scenario: {...orig, ...kv}}. So the new name
          // shows up on the merged scenario in the action payload.
          const last = updates[updates.length - 1];
          expect(last.scenario.name).toBe('Renamed');
          done();
        }
      );
    });

    it('changing a dropdown dispatches UPDATE_ANUGA_SCENARIO with merged scenario', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21},
          resources: {
            terrain: [{id: 5, title: 'Default Terrain'}],
            boundaries: [], inflows: [], rainfalls: [],
            frictions: [], structures: [], meshRegions: [], networks: []
          }
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const select = container.querySelector('#terrain');
          expect(select).toExist();
          // Same native-setter trick for select; React 16 forwards via input.
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype, 'value'
          ).set;
          setter.call(select, '5');
          select.dispatchEvent(new window.Event('change', {bubbles: true}));
          const updates = store.__actions().filter(a => a?.type === 'UPDATE_ANUGA_SCENARIO');
          expect(updates.length).toBeGreaterThanOrEqualTo(1);
          const last = updates[updates.length - 1];
          // updateAnugaScenario merges kv into scenario; the merged terrain
          // value is what lands on the action payload.
          expect(last.scenario.terrain).toBe(5);
          done();
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // E. Empty-scenarios fallback
  // ------------------------------------------------------------------
  describe('E. Empty-scenarios fallback', () => {
    it('does not crash when scenarios is empty', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const rail = container.querySelector('.sv-category-rail');
          expect(rail.querySelectorAll('.sv-category-rail-item').length).toBe(0);
          done();
        }
      );
    });

    it('renders the empty pane placeholder when no scenario selected', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('.anuga-scenario-empty-pane')).toExist();
          done();
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // F. Compare-mode (Option A header)
  // ------------------------------------------------------------------
  describe('F. Compare-mode toggle (Option A header)', () => {
    it('clicking .anuga-btn-compare flips compareMode and surfaces rail checkboxes', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const s2 = makeScenario(22, 'With levee');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          // Initially: checkboxes hidden.
          let checkboxes = container.querySelectorAll('.scenario-rail-item-compare-checkbox.is-hidden');
          expect(checkboxes.length).toBe(2);
          // Click the Compare button in the new action strip.
          const compareBtn = container.querySelector('.anuga-btn-compare');
          expect(compareBtn).toExist();
          compareBtn.click();
          setTimeout(() => {
            const visibleCheckboxes = container.querySelectorAll('.scenario-rail-item-compare-checkbox:not(.is-hidden)');
            expect(visibleCheckboxes.length).toBe(2);
            const compareBtnAfter = container.querySelector('.anuga-btn-compare');
            expect(compareBtnAfter.className).toInclude('is-active');
            done();
          });
        }
      );
    });

    it('.anuga-btn-run-compare absent until compareMode AND 2 scenarios are selected', (done) => {
      // No `selected: true` scenarios → readyToCompare is false.
      const s1 = makeScenario(21, 'A');
      const s2 = makeScenario(22, 'B');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
          // Toggle compare.
          const compareBtn = container.querySelector('.anuga-btn-compare');
          compareBtn.click();
          setTimeout(() => {
            // Still not rendered — no scenarios are .selected.
            expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
            done();
          });
        }
      );
    });

    it('.anuga-btn-run-compare renders when compareMode && readyToCompare', (done) => {
      const s1 = makeScenario(21, 'A', {selected: true});
      const s2 = makeScenario(22, 'B', {selected: true});
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          // Off-by-default check.
          expect(container.querySelector('.anuga-btn-run-compare')).toNotExist();
          // Toggle compare on.
          const compareBtn = container.querySelector('.anuga-btn-compare');
          compareBtn.click();
          setTimeout(() => {
            expect(container.querySelector('.anuga-btn-run-compare')).toExist();
            done();
          });
        }
      );
    });

    it('clicking .anuga-btn-run-compare dispatches COMPARE_SCENARIOS exactly once', (done) => {
      const s1 = makeScenario(21, 'A', {selected: true});
      const s2 = makeScenario(22, 'B', {selected: true});
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          const compareBtn = container.querySelector('.anuga-btn-compare');
          compareBtn.click();
          setTimeout(() => {
            const runCompare = container.querySelector('.anuga-btn-run-compare');
            expect(runCompare).toExist();
            runCompare.click();
            const dispatched = store.__actions().filter(a => a?.type === 'COMPARE_SCENARIOS');
            expect(dispatched.length).toBe(1);
            done();
          });
        }
      );
    });
  });

  // ------------------------------------------------------------------
  // G. Cross-plugin no-leak smoke
  // ------------------------------------------------------------------
  describe('G. Cross-plugin no-leak smoke', () => {
    it('survives an unmount/remount cycle with no stale DOM', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('#anuga-scenario-menu')).toExist();
          const unmounted = ReactDOM.unmountComponentAtNode(container);
          expect(unmounted).toBe(true);
          // Remount; should pick up the same store cleanly without leaking.
          ReactDOM.render(
            <Provider store={store}><AnugaScenarioMenu /></Provider>,
            container,
            () => {
              const panels = container.querySelectorAll('#anuga-scenario-menu');
              expect(panels.length).toBe(1);
              done();
            }
          );
        }
      );
    });

    it('survives mount alongside a sibling div without leaking class names', (done) => {
      const s1 = makeScenario(21, 'Baseline');
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1}, allIds: [21], archiveFilter: 'none', selectedId: 21}
        }
      });
      const sibling = document.createElement('div');
      sibling.id = 'sibling-panel';
      sibling.innerHTML = '<div class="sv-category-rail-item" data-foreign="true"></div>';
      document.body.appendChild(sibling);
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          // The panel + the sibling both render a rail item, but the panel
          // rail items are nested inside its own panel container.
          const panelRailItems = container.querySelectorAll('.sv-category-rail-item');
          expect(panelRailItems.length).toBe(1);
          // The sibling's class string should still mark it as foreign.
          expect(sibling.querySelector('[data-foreign="true"]')).toExist();
          document.body.removeChild(sibling);
          done();
        }
      );
    });

    it('AnugaScenarioMenuClass smoke renders without a Provider when given props directly', (done) => {
      // Defensive sanity: the unconnected class accepts a scenarios array
      // prop directly and renders the rail without exploding. This
      // protects against accidental store-dependence creeping in.
      const s1 = makeScenario(21, 'Baseline');
      ReactDOM.render(
        <AnugaScenarioMenuClass scenarios={[s1]} archiveFilter={'none'} />,
        container,
        () => {
          expect(container.querySelector('#anuga-scenario-menu')).toExist();
          done();
        }
      );
    });
  });
});
