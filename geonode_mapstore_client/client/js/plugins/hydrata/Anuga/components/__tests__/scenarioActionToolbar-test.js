import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioActionToolbar} from '../scenarioActionToolbar';

/**
 * TASK-C-scenarios-miller W2 — per-button-per-status assertion matrix for
 * the action toolbar. Mirrors today's ScenarioTableRow per-role/per-status
 * matrix without the table wrapping. Pure presentation — onXClick props are
 * call-collecting closures so we can assert dispatch contracts.
 *
 * Includes the regression guard for the no-window.confirm/alert pin
 * (feedback-window-confirm-blocks-automation). The toolbar must never
 * invoke window.confirm directly — Delete + Cancel-Run now route through
 * onConfirmDelete + onConfirmCancelRun props.
 */

const baseScenario = {
  id: 21,
  name: 'Baseline',
  status: 'built',
  created_by: 7
};

describe('TASK-C ScenarioActionToolbar primitive (W2)', () => {
  let container;
  let confirmCalls;
  let alertCalls;
  let originalConfirm;
  let originalAlert;

  beforeEach((done) => {
    document.body.innerHTML = '<div id="container"></div>';
    container = document.getElementById('container');
    confirmCalls = 0;
    alertCalls = 0;
    originalConfirm = window.confirm;
    originalAlert = window.alert;
    // eslint-disable-next-line no-alert -- regression guard, mock not real
    window.confirm = () => { confirmCalls++; return true; };
    // eslint-disable-next-line no-alert -- regression guard, mock not real
    window.alert = () => { alertCalls++; };
    setTimeout(done);
  });

  afterEach((done) => {
    ReactDOM.unmountComponentAtNode(container);
    document.body.innerHTML = '';
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    setTimeout(done);
  });

  describe('Status-conditional Run/Build control', () => {
    it('renders Build button for created status (canRunScenario only)', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'created', unsaved: true}}
          canEdit
          canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-build')).toExist();
          done();
        }
      );
    });

    it('omits Build button when canRunScenario is false in created status', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'created', unsaved: true}}
          canEdit
        />,
        container,
        () => {
          // There can be a separate Build button (showBuildBtn path), so
          // we explicitly check no .scenario-action-build is rendered
          // in created status without canRun.
          expect(container.querySelector('.scenario-action-build')).toNotExist();
          done();
        }
      );
    });

    it('renders Run button for built status', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'built'}}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-run')).toExist();
          done();
        }
      );
    });

    it('renders Download anchor for complete status', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{
            ...baseScenario,
            status: 'complete',
            latest_run: {s3_package_url: 'https://x/y.zip'}
          }}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-download')).toExist();
          done();
        }
      );
    });

    it('renders Retry button for error status', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'error', latest_run: {id: 5}}}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-retry')).toExist();
          done();
        }
      );
    });

    it('renders Re-run for cancelled status', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'cancelled'}}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-rerun')).toExist();
          done();
        }
      );
    });

    it('renders disabled spinner for queued/computing/processing/building', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'computing'}}
          canEdit canRunScenario
        />,
        container,
        () => {
          const run = container.querySelector('.scenario-action-run');
          expect(run).toExist();
          expect(run.className).toInclude('disabled');
          expect(container.querySelector('.glyphicon-spin')).toExist();
          done();
        }
      );
    });
  });

  describe('Log / Duplicate / Archive / Delete visibility', () => {
    it('always renders Log button', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-log')).toExist();
          done();
        }
      );
    });

    it('renders Duplicate button visible when canDuplicateScenario + scenario.id', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          const dup = container.querySelector('.scenario-action-duplicate');
          expect(dup).toExist();
          expect(dup.className).toNotInclude('is-hidden');
          done();
        }
      );
    });

    it('hides Duplicate when canDuplicateScenario false', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
        />,
        container,
        () => {
          const dup = container.querySelector('.scenario-action-duplicate');
          expect(dup).toExist();
          expect(dup.className).toInclude('is-hidden');
          done();
        }
      );
    });

    it('hides Duplicate when scenario.id missing (unsaved draft)', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, id: null}}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          const dup = container.querySelector('.scenario-action-duplicate');
          expect(dup.className).toInclude('is-hidden');
          done();
        }
      );
    });

    it('renders Archive button visible when canEdit + scenario.id, not isCancellable', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          const arch = container.querySelector('.scenario-action-archive');
          expect(arch).toExist();
          expect(arch.className).toNotInclude('is-hidden');
          done();
        }
      );
    });

    it('renders Unarchive instead of Archive when archived_at is set', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, archived_at: '2026-01-01'}}
          canEdit canRunScenario canDuplicateScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-unarchive')).toExist();
          expect(container.querySelector('.scenario-action-archive')).toNotExist();
          done();
        }
      );
    });

    it('renders Delete button when canEdit + not cancellable', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
        />,
        container,
        () => {
          const del = container.querySelector('.scenario-action-delete');
          expect(del).toExist();
          expect(del.className).toNotInclude('is-hidden');
          done();
        }
      );
    });

    it('renders Cancel-Run instead of Delete when isCancellable', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'computing'}}
          canEdit canRunScenario
        />,
        container,
        () => {
          expect(container.querySelector('.scenario-action-cancel-run')).toExist();
          expect(container.querySelector('.scenario-action-delete')).toNotExist();
          done();
        }
      );
    });
  });

  describe('Click contracts', () => {
    it('Build click invokes onBuildClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'created', unsaved: true}}
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

    it('Run click invokes onRunClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
          onRunClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-run').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Retry click invokes onRetryClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'error', latest_run: {id: 5}}}
          canEdit canRunScenario
          onRetryClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-retry').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Log click invokes onLogClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
          onLogClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-log').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Duplicate click invokes onDuplicateClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario canDuplicateScenario
          onDuplicateClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-duplicate').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Archive click invokes onArchiveClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario
          onArchiveClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-archive').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Unarchive click invokes onUnarchiveClick with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, archived_at: '2026-01-01'}}
          canEdit canRunScenario
          onUnarchiveClick={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-unarchive').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });

    it('Delete click invokes onConfirmDelete with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
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

    it('Cancel-Run click invokes onConfirmCancelRun with the scenario', (done) => {
      let captured = null;
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={{...baseScenario, status: 'computing'}}
          canEdit canRunScenario
          onConfirmCancelRun={(s) => { captured = s; }}
        />,
        container,
        () => {
          container.querySelector('.scenario-action-cancel-run').click();
          expect(captured?.id).toBe(21);
          done();
        }
      );
    });
  });

  describe('window.confirm / window.alert regression guard', () => {
    it('exercising every button does not call window.confirm or window.alert', (done) => {
      ReactDOM.render(
        <ScenarioActionToolbar
          scenario={baseScenario}
          canEdit canRunScenario canDuplicateScenario
          onBuildClick={() => {}}
          onRunClick={() => {}}
          onRetryClick={() => {}}
          onLogClick={() => {}}
          onDuplicateClick={() => {}}
          onArchiveClick={() => {}}
          onUnarchiveClick={() => {}}
          onConfirmDelete={() => {}}
          onConfirmCancelRun={() => {}}
        />,
        container,
        () => {
          const buttons = container.querySelectorAll('button:not(.is-hidden), a:not(.is-hidden)');
          buttons.forEach((btn) => {
            try { btn.click(); } catch (e) { /* ignore href anchors */ }
          });
          expect(confirmCalls).toBe(0);
          expect(alertCalls).toBe(0);
          done();
        }
      );
    });
  });

  describe('Defensive rendering', () => {
    it('returns null when scenario is null', (done) => {
      ReactDOM.render(<ScenarioActionToolbar scenario={null} />, container, () => {
        expect(container.querySelector('.scenario-action-toolbar')).toNotExist();
        done();
      });
    });
  });
});
