import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioStatusPill} from '../scenarioStatusPill';

/**
 * TASK-C-scenarios-miller W1 — 9-state status pill assertions. One pass per
 * known scenario status: created | building | queued | computing |
 * processing | complete | error | cancelled | built. Plus a few
 * cross-cutting assertions (compact mode hides ETA + error detail).
 *
 * Pure-presentation test; no redux, no connect, no Provider. Status string
 * comes from findScenarioStatus(scenario) — preferring
 * scenario.computed_status, falling back to scenario.status, defaulting to
 * 'created'.
 */

describe('TASK-C ScenarioStatusPill primitive (W1)', () => {
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

  describe('Status renders', () => {
    it('renders status-created class for default (no status field)', (done) => {
      ReactDOM.render(<ScenarioStatusPill scenario={{}} />, container, () => {
        const pill = container.querySelector('.scenario-status-pill');
        expect(pill).toExist();
        expect(pill.className).toInclude('status-created');
        done();
      });
    });

    it('renders status-building with spinner glyph', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'building'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-building');
          expect(container.querySelector('.glyphicon-spin')).toExist();
          done();
        }
      );
    });

    it('renders status-queued with spinner glyph', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'queued'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-queued');
          expect(container.querySelector('.glyphicon-spin')).toExist();
          done();
        }
      );
    });

    it('renders status-computing with progress bar and pct', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{
          status: 'computing',
          latest_run: {progress_pct: 38, eta_seconds: 120}
        }} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-computing');
          const fill = container.querySelector('.scenario-status-progress-fill');
          expect(fill).toExist();
          expect(fill.style.width).toBe('38%');
          const pct = container.querySelector('.scenario-status-progress-pct');
          expect(pct.textContent).toBe('38%');
          const eta = container.querySelector('.scenario-status-progress-eta');
          expect(eta).toExist();
          expect(eta.textContent).toBe('2m');
          done();
        }
      );
    });

    it('renders status-computing with zero pct + no eta when latest_run absent', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'computing'}} />,
        container,
        () => {
          const fill = container.querySelector('.scenario-status-progress-fill');
          expect(fill.style.width).toBe('0%');
          const eta = container.querySelector('.scenario-status-progress-eta');
          expect(eta).toNotExist();
          done();
        }
      );
    });

    it('renders status-processing with spinner glyph', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'processing'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-processing');
          expect(container.querySelector('.glyphicon-spin')).toExist();
          done();
        }
      );
    });

    it('renders status-complete with green check', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'complete'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-complete');
          expect(container.querySelector('.glyphicon-ok')).toExist();
          done();
        }
      );
    });

    it('renders status-error with truncated error_message tooltip', (done) => {
      const longMsg = 'a'.repeat(50);
      ReactDOM.render(
        <ScenarioStatusPill scenario={{
          status: 'error',
          latest_run: {error_message: longMsg}
        }} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-error');
          const detail = container.querySelector('.scenario-status-error-detail');
          expect(detail).toExist();
          expect(detail.getAttribute('title')).toBe(longMsg);
          // 30 chars + ellipsis.
          expect(detail.textContent.endsWith('...')).toBe(true);
          expect(detail.textContent.length).toBe(33);
          done();
        }
      );
    });

    it('renders status-error without detail span when error_message absent', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'error'}} />,
        container,
        () => {
          expect(container.querySelector('.scenario-status-error-detail')).toNotExist();
          done();
        }
      );
    });

    it('renders status-cancelled', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'cancelled'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-cancelled');
          done();
        }
      );
    });

    it('renders status-built', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'built'}} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-built');
          done();
        }
      );
    });
  });

  describe('computed_status takes precedence over status', () => {
    it('uses computed_status when both fields are set', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{
          status: 'created',
          computed_status: 'building'
        }} />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('status-building');
          done();
        }
      );
    });
  });

  describe('compact mode', () => {
    it('adds is-compact modifier class', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill scenario={{status: 'built'}} compact />,
        container,
        () => {
          const pill = container.querySelector('.scenario-status-pill');
          expect(pill.className).toInclude('is-compact');
          done();
        }
      );
    });

    it('hides ETA span in computing state', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill
          scenario={{status: 'computing', latest_run: {progress_pct: 50, eta_seconds: 600}}}
          compact
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-status-progress-eta')).toNotExist();
          done();
        }
      );
    });

    it('hides truncated error_message detail in error state', (done) => {
      ReactDOM.render(
        <ScenarioStatusPill
          scenario={{status: 'error', latest_run: {error_message: 'bad'}}}
          compact
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-status-error-detail')).toNotExist();
          done();
        }
      );
    });
  });
});
