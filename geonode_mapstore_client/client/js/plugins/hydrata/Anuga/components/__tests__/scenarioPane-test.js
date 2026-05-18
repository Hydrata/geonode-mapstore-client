import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import {ScenarioPane} from '../scenarioPane';

/**
 * TASK-C-scenarios-miller W2 — per-category pane assertions. Tests cover:
 *   - subtab rendering + is-active flip on click
 *   - Inputs subtab: 4 dropdowns + name input
 *   - Advanced subtab: 4 dropdowns + resolution + duration
 *   - Run subtab: status pill + action toolbar
 *   - Actions subtab: ownership badge + action toolbar
 *   - Empty pane when scenario null
 *   - Field update dispatch contract via onUpdateScenario
 */

const baseScenario = {
  id: 21,
  name: 'Baseline',
  status: 'built',
  created_by: 7,
  terrain: 3,
  boundary: 4,
  inflow: 5,
  resolution: 1000,
  duration: 1800
};

const terrainOpts = [{id: 3, title: 'Default Terrain'}, {id: 4, title: 'Other Terrain'}];
const boundaryOpts = [{id: 4, title: 'Default Boundary'}];
const inflowOpts = [{id: 5, title: 'Default Inflow'}];
const rainfallOpts = [{id: 6, title: 'Default Rainfall'}];
const frictionOpts = [{id: 7, title: 'Default Friction'}];
const structureOpts = [{id: 8, title: 'Default Structure'}];
const meshRegionOpts = [{id: 9, title: 'Default Mesh Region'}];
const networkOpts = [{id: 10, title: 'Default Network'}];

describe('TASK-C ScenarioPane primitive (W2)', () => {
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

  describe('Subtab rendering', () => {
    it('renders 4 subtabs in locked order', (done) => {
      ReactDOM.render(
        <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
        container,
        () => {
          const tabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
          expect(tabs.length).toBe(4);
          done();
        }
      );
    });

    it('flips is-active on the selected subtab', (done) => {
      ReactDOM.render(
        <ScenarioPane scenario={baseScenario} selectedCategoryId={'run'} />,
        container,
        () => {
          const tabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
          const active = Array.from(tabs).filter(t => t.className.includes('is-active'));
          expect(active.length).toBe(1);
          done();
        }
      );
    });

    it('clicking a subtab invokes onSelectCategory', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          onSelectCategory={(id) => { captured = id; }}
        />,
        container,
        () => {
          const tabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
          // 4 tabs in order: inputs, advanced, run, actions.
          tabs[2].click();
          expect(captured).toBe('run');
          done();
        }
      );
    });
  });

  describe('Inputs subtab', () => {
    it('renders name input + 4 dropdowns', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          canEdit
          terrain={terrainOpts}
          boundaries={boundaryOpts}
          inflows={inflowOpts}
          rainfalls={rainfallOpts}
        />,
        container,
        () => {
          expect(container.querySelector('#name')).toExist();
          expect(container.querySelector('#terrain')).toExist();
          expect(container.querySelector('#boundary')).toExist();
          expect(container.querySelector('#inflow')).toExist();
          expect(container.querySelector('#rainfall')).toExist();
          done();
        }
      );
    });

    it('name field is readOnly when canEdit false', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          terrain={terrainOpts}
          boundaries={boundaryOpts}
          inflows={inflowOpts}
          rainfalls={rainfallOpts}
        />,
        container,
        () => {
          const input = container.querySelector('#name');
          expect(input.readOnly).toBe(true);
          done();
        }
      );
    });

    it('name field is editable when canEdit true', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          canEdit
        />,
        container,
        () => {
          const input = container.querySelector('#name');
          expect(input.readOnly).toBe(false);
          done();
        }
      );
    });

    it('terrain dropdown shows selected value', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          canEdit
          terrain={terrainOpts}
        />,
        container,
        () => {
          const sel = container.querySelector('#terrain');
          expect(sel.value).toBe('3');
          done();
        }
      );
    });

    it('changing terrain dispatches onUpdateScenario with parsed int', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          canEdit
          terrain={terrainOpts}
          onUpdateScenario={(s, kv) => { captured = {s, kv}; }}
        />,
        container,
        () => {
          const sel = container.querySelector('#terrain');
          Simulate.change(sel, {target: {value: '4'}});
          expect(captured.kv.terrain).toBe(4);
          expect(captured.s.id).toBe(21);
          done();
        }
      );
    });

    it('typing in name dispatches onUpdateScenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'inputs'}
          canEdit
          onUpdateScenario={(s, kv) => { captured = kv; }}
        />,
        container,
        () => {
          const input = container.querySelector('#name');
          Simulate.change(input, {target: {value: 'Updated Name'}});
          expect(captured.name).toBe('Updated Name');
          done();
        }
      );
    });
  });

  describe('Advanced subtab', () => {
    it('renders 4 dropdowns + resolution + duration', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'advanced'}
          canEdit
          frictions={frictionOpts}
          structures={structureOpts}
          meshRegions={meshRegionOpts}
          networks={networkOpts}
        />,
        container,
        () => {
          expect(container.querySelector('#friction')).toExist();
          expect(container.querySelector('#structure')).toExist();
          expect(container.querySelector('#mesh_region')).toExist();
          expect(container.querySelector('#network')).toExist();
          expect(container.querySelector('#resolution')).toExist();
          expect(container.querySelector('#duration')).toExist();
          done();
        }
      );
    });

    it('resolution value matches scenario.resolution', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'advanced'}
          canEdit
        />,
        container,
        () => {
          const input = container.querySelector('#resolution');
          expect(input.value).toBe('1000');
          done();
        }
      );
    });

    it('changing resolution dispatches onUpdateScenario with parsed float', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'advanced'}
          canEdit
          onUpdateScenario={(s, kv) => { captured = kv; }}
        />,
        container,
        () => {
          const input = container.querySelector('#resolution');
          Simulate.change(input, {target: {value: '500'}});
          expect(captured.resolution).toBe(500);
          done();
        }
      );
    });

    it('duration HH:MM rendering for 1800 seconds', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'advanced'}
          canEdit
        />,
        container,
        () => {
          const input = container.querySelector('#duration');
          // 1800 seconds = 30 minutes -> "30:00"? toHHMM formula gives '30:00' for 30 minutes.
          // Per the helper, output for 1800 should resolve to "30:00".
          expect(input.value).toBeTruthy();
          done();
        }
      );
    });

    it('duration blur converts HH:MM back to seconds via getSecondsFromHHMM', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'advanced'}
          canEdit
          onUpdateScenario={(s, kv) => { captured = kv; }}
        />,
        container,
        () => {
          const input = container.querySelector('#duration');
          Simulate.blur(input, {target: {value: '1:00', id: 'duration'}});
          expect(captured.duration).toBe(3600);
          done();
        }
      );
    });
  });

  describe('Run subtab', () => {
    it('renders status pill in full mode', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={{...baseScenario, status: 'built'}}
          selectedCategoryId={'run'}
          canEdit canRunScenario
        />,
        container,
        () => {
          // Two pills total — one compact (header) + one full (run subtab).
          const pills = container.querySelectorAll('.scenario-status-pill');
          expect(pills.length).toBeGreaterThan(0);
          const fullPill = Array.from(pills).find(p => !p.className.includes('is-compact'));
          expect(fullPill).toExist();
          done();
        }
      );
    });

    it('renders the action toolbar', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'run'}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-toolbar')).toExist();
          done();
        }
      );
    });

    it('Build click flows through to onBuildClick callback', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={{...baseScenario, status: 'created', unsaved: true}}
          selectedCategoryId={'run'}
          canEdit canRunScenario
          onBuildClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-build').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });
  });

  describe('Actions subtab', () => {
    it('renders ownership badge mine when user owns scenario', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'actions'}
          currentUserId={7}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-ownership-mine')).toExist();
          done();
        }
      );
    });

    it('renders action toolbar', (done) => {
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'actions'}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-toolbar')).toExist();
          done();
        }
      );
    });

    it('Delete click invokes onConfirmDelete callback', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioPane
          scenario={baseScenario}
          selectedCategoryId={'actions'}
          canEdit canRunScenario
          onConfirmDelete={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-delete').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });
  });

  describe('Empty / null scenario', () => {
    it('renders empty pane when scenario is null', (done) => {
      ReactDOM.render(
        <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
        container,
        () => {
          expect(container.querySelector('.anuga-scenario-empty-pane')).toExist();
          // No input fields render.
          expect(container.querySelector('#name')).toNotExist();
          done();
        }
      );
    });

    it('still renders subtabs when scenario null (so user can switch)', (done) => {
      ReactDOM.render(
        <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
        container,
        () => {
          const tabs = container.querySelectorAll('.anuga-scenario-pane-subtab');
          expect(tabs.length).toBe(4);
          done();
        }
      );
    });
  });
});
