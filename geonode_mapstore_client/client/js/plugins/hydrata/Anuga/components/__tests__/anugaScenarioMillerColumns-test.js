import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {AnugaScenarioMenu, AnugaScenarioMenuClass} from '../anugaScenarioMenu';

/**
 * TASK-C-scenarios-miller W3 — wave-level integration test for the new
 * Miller-columns scenarios container. Mirrors the SimpleView Inputs
 * miller test structure (describe blocks A-G).
 *
 *   A. Rail+pane composition (mount, count rail items = scenarios.length,
 *      first is `.is-active` after auto-select).
 *   B. Pane swap on rail click (clicking a rail item flips `.is-active`
 *      and dispatches SELECT_ANUGA_SCENARIO).
 *   C. Category subtab switching (clicking Inputs/Advanced/Run/Actions
 *      flips the in-pane content).
 *   D. Field-update dispatches (typing in the name field or changing a
 *      dropdown dispatches UPDATE_ANUGA_SCENARIO).
 *   E. Empty-scenarios fallback (rail empty + pane "no scenario"
 *      placeholder; container does not crash).
 *   F. Compare-mode toggle (clicking the chip flips local state +
 *      shows checkboxes; Execute Compare gates on exactly 2 selected).
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

describe('ANUGA Scenarios Miller-columns integration (TASK-C W3)', () => {
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

    it('Wave 3A — renders the 3-column shell: scenario rail / category rail / detail', (done) => {
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
          // Pane 2 — vertical category rail (NEW Wave 3A).
          expect(container.querySelector('.anuga-scenario-category-rail')).toExist();
          // Pane 3 — detail body (NEW Wave 3A).
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
  // C. Category rail switching (Wave 3A — 5 categories in vertical rail)
  // ------------------------------------------------------------------
  describe('C. Category rail switching', () => {
    it('renders 5 category items in the vertical rail (Inputs/Advanced/Run config/Status and actions/Run log)', (done) => {
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
          expect(items.length).toBe(5);
          // Default: Inputs is active.
          expect(items[0].className).toInclude('is-active');
          expect(items[1].className).toNotInclude('is-active');
          done();
        }
      );
    });

    it('clicking Advanced flips is-active and renders the friction dropdown', (done) => {
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

    it('clicking Run config renders resolution + duration + compute_backend', (done) => {
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

    it('clicking Status and actions shows the status card + action toolbar', (done) => {
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

    it('clicking Run log shows the open-task-monitor button', (done) => {
      const s1 = makeScenario(21, 'Baseline', {
        status: 'built',
        latest_run: {id: 999, log_line_count: 42}
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
          items[4].click(); // runLog
          setTimeout(() => {
            expect(container.querySelector('.anuga-scenario-pane-rows-run-log')).toExist();
            expect(container.querySelector('.scenario-action-open-task-monitor')).toExist();
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
  // F. Compare-mode toggle
  // ------------------------------------------------------------------
  describe('F. Compare-mode toggle', () => {
    it('flips compareMode state and surfaces rail checkboxes', (done) => {
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
          // Find and click the Compare toggle (second button in the header tab group).
          const tabButtons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
          expect(tabButtons.length).toBe(2);
          tabButtons[1].click(); // compare-mode toggle
          setTimeout(() => {
            const visibleCheckboxes = container.querySelectorAll('.scenario-rail-item-compare-checkbox:not(.is-hidden)');
            expect(visibleCheckboxes.length).toBe(2);
            done();
          });
        }
      );
    });

    it('Execute Compare button is hidden by default and shown in compare mode', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          expect(container.querySelector('#depth-difference-button')).toNotExist();
          // Toggle compare.
          const tabButtons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
          tabButtons[1].click();
          setTimeout(() => {
            expect(container.querySelector('#depth-difference-button')).toExist();
            done();
          });
        }
      );
    });

    it('dispatches COMPARE_SCENARIOS only when exactly 2 scenarios are selected', (done) => {
      const s1 = makeScenario(21, 'Baseline', {selected: true});
      const s2 = makeScenario(22, 'With levee', {selected: true});
      const store = createMockStore({
        anuga: {
          scenarios: {byId: {21: s1, 22: s2}, allIds: [21, 22], archiveFilter: 'none', selectedId: 21}
        }
      });
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenu /></Provider>,
        container,
        () => {
          // Toggle compare on.
          const tabButtons = container.querySelectorAll('#scenario-tab-button-group button.scenario-tab');
          tabButtons[1].click();
          setTimeout(() => {
            const execBtn = container.querySelector('#depth-difference-button .anuga-btn');
            expect(execBtn).toExist();
            expect(execBtn.className).toNotInclude('disabled');
            execBtn.click();
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
