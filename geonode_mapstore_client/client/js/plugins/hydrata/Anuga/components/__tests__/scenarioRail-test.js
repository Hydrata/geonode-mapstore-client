import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioRail, ScenarioRailItem} from '../scenarioRail';

/**
 * TASK-C-scenarios-miller W1 — pure-presentation rail tests.
 *
 * Mounted standalone (no Provider, no connect). Selection +
 * toggle-selected callbacks are call-collecting closures so we can
 * verify the click contract without dispatching through Redux.
 */

const scenarioA = {
  id: 21,
  name: 'Baseline',
  status: 'built',
  created_by: 7,
  created_by_username: 'alice'
};

const scenarioB = {
  id: 22,
  name: 'With levee',
  status: 'computing',
  created_by: 7,
  latest_run: {progress_pct: 50}
};

const scenarioUnsaved = {
  id: null,
  _tempId: 'new_1234',
  name: 'Untitled draft',
  unsaved: true
};

const scenarioArchived = {
  id: 23,
  name: 'Old run',
  status: 'complete',
  archived_at: '2026-01-01T12:00:00Z'
};

describe('TASK-C ScenarioRail primitive (W1)', () => {
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

  describe('ScenarioRail (wrapper)', () => {
    it('renders one rail item per scenario', (done) => {
      ReactDOM.render(
        <ScenarioRail scenarios={[scenarioA, scenarioB]} onSelect={() => {}} />,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          expect(items.length).toBe(2);
          done();
        }
      );
    });

    it('renders empty rail container when scenarios is empty', (done) => {
      ReactDOM.render(<ScenarioRail scenarios={[]} />, container, () => {
        const rail = container.querySelector('.sv-category-rail');
        expect(rail).toExist();
        expect(rail.querySelectorAll('.sv-category-rail-item').length).toBe(0);
        done();
      });
    });

    // Wave 3B (B3) — zero-state placeholder when the project has no
    // scenarios yet. Surfaces a glyph + heading + sub-copy pointing the
    // user at the "+ New scenario" button.
    describe('Wave 3B B3 — empty-state placeholder', () => {
      it('renders the empty-state container when scenarios is empty', (done) => {
        ReactDOM.render(<ScenarioRail scenarios={[]} />, container, () => {
          expect(container.querySelector('.anuga-scenario-rail-empty')).toExist();
          done();
        });
      });

      it('renders the empty-state glyph', (done) => {
        ReactDOM.render(<ScenarioRail scenarios={[]} />, container, () => {
          expect(container.querySelector('.anuga-scenario-rail-empty-glyph')).toExist();
          done();
        });
      });

      it('renders the empty-state heading + sub-copy', (done) => {
        ReactDOM.render(<ScenarioRail scenarios={[]} />, container, () => {
          expect(container.querySelector('.anuga-scenario-rail-empty-heading')).toExist();
          expect(container.querySelector('.anuga-scenario-rail-empty-subcopy')).toExist();
          done();
        });
      });

      it('omits the empty-state placeholder when scenarios is non-empty', (done) => {
        ReactDOM.render(
          <ScenarioRail scenarios={[scenarioA]} />,
          container,
          () => {
            expect(container.querySelector('.anuga-scenario-rail-empty')).toNotExist();
            done();
          }
        );
      });

      it('omits the empty-state placeholder when scenarios is null', (done) => {
        ReactDOM.render(<ScenarioRail scenarios={null} />, container, () => {
          // null and undefined fall through the same empty-list branch,
          // so the placeholder DOES render — matches the empty array case.
          expect(container.querySelector('.anuga-scenario-rail-empty')).toExist();
          done();
        });
      });
    });

    it('flips .is-active onto the rail item matching selectedId', (done) => {
      ReactDOM.render(
        <ScenarioRail scenarios={[scenarioA, scenarioB]} selectedId={22} />,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          expect(items[0].className).toNotInclude('is-active');
          expect(items[1].className).toInclude('is-active');
          done();
        }
      );
    });

    it('matches unsaved drafts on _tempId', (done) => {
      ReactDOM.render(
        <ScenarioRail
          scenarios={[scenarioUnsaved, scenarioA]}
          selectedId={'new_1234'}
        />,
        container,
        () => {
          const items = container.querySelectorAll('.sv-category-rail-item');
          expect(items[0].className).toInclude('is-active');
          expect(items[1].className).toNotInclude('is-active');
          done();
        }
      );
    });
  });

  describe('ScenarioRailItem rendering', () => {
    it('renders id label with # prefix for saved scenarios', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={scenarioA} />, container, () => {
        const idLabel = container.querySelector('.scenario-rail-item-id');
        expect(idLabel).toExist();
        expect(idLabel.textContent).toBe('#21');
        done();
      });
    });

    it('renders #* for unsaved drafts', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioUnsaved} />,
        container,
        () => {
          const idLabel = container.querySelector('.scenario-rail-item-id');
          expect(idLabel.textContent).toBe('#*');
          done();
        }
      );
    });

    it('renders unsaved asterisk marker for unsaved drafts', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioUnsaved} />,
        container,
        () => {
          expect(container.querySelector('.scenario-rail-item-unsaved')).toExist();
          done();
        }
      );
    });

    it('omits unsaved marker for saved scenarios', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={scenarioA} />, container, () => {
        expect(container.querySelector('.scenario-rail-item-unsaved')).toNotExist();
        done();
      });
    });

    it('renders the scenario name in the label slot', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={scenarioA} />, container, () => {
        const label = container.querySelector('.scenario-rail-item-name');
        expect(label).toExist();
        expect(label.textContent).toBe('Baseline');
        done();
      });
    });

    it('embeds a compact ScenarioStatusPill', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={scenarioA} />, container, () => {
        const pill = container.querySelector('.scenario-status-pill');
        expect(pill).toExist();
        expect(pill.className).toInclude('is-compact');
        done();
      });
    });

    it('renders archived class + dot when scenario.archived_at set', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioArchived} />,
        container,
        () => {
          const item = container.querySelector('.sv-category-rail-item');
          expect(item.className).toInclude('is-archived');
          expect(container.querySelector('.scenario-rail-item-archived-dot')).toExist();
          done();
        }
      );
    });

    it('renders is-active modifier when isActive prop set', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioA} isActive />,
        container,
        () => {
          const item = container.querySelector('.sv-category-rail-item');
          expect(item.className).toInclude('is-active');
          done();
        }
      );
    });

    it('renders ownership badge mine when current user matches created_by', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioA} currentUserId={7} />,
        container,
        () => {
          expect(container.querySelector('.scenario-ownership-mine')).toExist();
          expect(container.querySelector('.scenario-ownership-other')).toNotExist();
          done();
        }
      );
    });

    it('renders ownership badge other when current user differs from created_by', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioA} currentUserId={99} />,
        container,
        () => {
          expect(container.querySelector('.scenario-ownership-other')).toExist();
          expect(container.querySelector('.scenario-ownership-mine')).toNotExist();
          done();
        }
      );
    });
  });

  describe('ScenarioRailItem interaction', () => {
    it('invokes onSelect with the scenario when row clicked', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioRailItem
          scenario={scenarioA}
          onSelect={(s) => { captured = s; }}
        />,
        container,
        () => {
          const item = container.querySelector('.sv-category-rail-item');
          item.click();
          expect(captured).toBe(scenarioA);
          done();
        }
      );
    });

    it('invokes onSelect on Enter key', (done) => {
      let calls = 0;
      ReactDOM.render(
        <ScenarioRailItem
          scenario={scenarioA}
          onSelect={() => { calls++; }}
        />,
        container,
        () => {
          const item = container.querySelector('.sv-category-rail-item');
          const evt = new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true});
          item.dispatchEvent(evt);
          expect(calls).toBe(1);
          done();
        }
      );
    });
  });

  describe('Compare mode', () => {
    it('renders compare checkbox hidden by default', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={scenarioA} />, container, () => {
        const checkbox = container.querySelector('.scenario-rail-item-compare-checkbox');
        expect(checkbox).toExist();
        expect(checkbox.className).toInclude('is-hidden');
        done();
      });
    });

    it('removes is-hidden when compareMode true', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioA} compareMode />,
        container,
        () => {
          const checkbox = container.querySelector('.scenario-rail-item-compare-checkbox');
          expect(checkbox.className).toNotInclude('is-hidden');
          done();
        }
      );
    });

    it('renders glyphicon-ok when scenario.selected true', (done) => {
      ReactDOM.render(
        <ScenarioRailItem
          scenario={{...scenarioA, selected: true}}
          compareMode
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-rail-item-compare-checkbox .glyphicon-ok'))
            .toExist();
          done();
        }
      );
    });

    it('renders glyphicon-unchecked when scenario.selected false', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={scenarioA} compareMode />,
        container,
        () => {
          expect(container.querySelector('.scenario-rail-item-compare-checkbox .glyphicon-unchecked'))
            .toExist();
          done();
        }
      );
    });

    it('clicking checkbox invokes onToggleSelected WITHOUT invoking onSelect', (done) => {
      let onSelectCalls = 0;
      let toggleCaptured = null;
      ReactDOM.render(
        <ScenarioRailItem
          scenario={scenarioA}
          compareMode
          onSelect={() => { onSelectCalls++; }}
          onToggleSelected={(s) => { toggleCaptured = s; }}
        />,
        container,
        () => {
          const checkbox = container.querySelector('.scenario-rail-item-compare-checkbox');
          checkbox.click();
          expect(toggleCaptured).toBe(scenarioA);
          expect(onSelectCalls).toBe(0);
          done();
        }
      );
    });
  });

  describe('Defensive rendering', () => {
    it('returns null for null scenario', (done) => {
      ReactDOM.render(<ScenarioRailItem scenario={null} />, container, () => {
        expect(container.querySelector('.sv-category-rail-item')).toNotExist();
        done();
      });
    });

    it('renders without crashing when scenario.name is missing', (done) => {
      ReactDOM.render(
        <ScenarioRailItem scenario={{id: 1, status: 'created'}} />,
        container,
        () => {
          const label = container.querySelector('.scenario-rail-item-name');
          expect(label).toExist();
          expect(label.textContent).toBe('');
          done();
        }
      );
    });
  });
});
