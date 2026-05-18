import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {AnugaScenarioMenuMiller} from '../anugaScenarioMenuMiller';

/**
 * TASK-C-scenarios-miller W0 — Karma scaffold for the Miller-columns
 * scenarios container. W1 fills in rail-item assertions, W2 fills in the
 * pane subtab assertions, W3 fills out the seven describe blocks A-G that
 * mirror SimpleView simpleViewMillerColumns-test.js.
 *
 * Today's coverage: smoke-mounts the placeholder Miller shell and asserts
 * the chrome class chain that the live anugaScenarioMenu replacement will
 * inherit. Test names use plain text to keep the W1/W2 fills additive.
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

describe('ANUGA Scenarios Miller-columns integration (TASK-C W0 scaffold)', () => {

  let container;

  beforeEach((done) => {
    document.body.innerHTML = '<div id="container"></div>';
    container = document.getElementById('container');
    setTimeout(done);
  });

  afterEach((done) => {
    ReactDOM.unmountComponentAtNode(container);
    document.body.innerHTML = '';
    setTimeout(done);
  });

  describe('W0. Shell composition', () => {
    it('mounts the panel chrome with the Miller class chain', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenuMiller /></Provider>,
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
        <Provider store={store}><AnugaScenarioMenuMiller /></Provider>,
        container,
        () => {
          expect(container.querySelector('.sv-rail-pane-shell')).toExist();
          expect(container.querySelector('.sv-category-rail')).toExist();
          expect(container.querySelector('.menu-rows-pane')).toExist();
          done();
        }
      );
    });

    it('does not crash with an empty scenarios store', (done) => {
      const store = createMockStore();
      ReactDOM.render(
        <Provider store={store}><AnugaScenarioMenuMiller /></Provider>,
        container,
        () => {
          // Rail has zero items, pane is empty; no throws.
          const rail = container.querySelector('.sv-category-rail');
          expect(rail.querySelectorAll('.sv-category-rail-item').length).toBe(0);
          done();
        }
      );
    });
  });
});
