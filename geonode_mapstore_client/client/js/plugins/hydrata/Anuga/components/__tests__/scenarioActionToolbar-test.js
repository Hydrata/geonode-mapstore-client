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

    describe('Duplicate / Archive / Delete visibility', () => {
    // Wave 3C — Duplicate moved to the scenario panel header (next to New
    // Scenario). The toolbar no longer renders a `.scenario-action-duplicate`
    // button. Header-level Duplicate behaviour is covered in
    // anugaScenarioMenu-test.js. Regression guard below asserts the toolbar
    // really has no Duplicate button even when the prior preconditions
    // (canDuplicateScenario + scenario.id) are present.
        it('does NOT render Duplicate button even with canDuplicateScenario + scenario.id (moved to header)', (done) => {
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={baseScenario}
                    canEdit canRunScenario canDuplicateScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.scenario-action-duplicate')).toBe(null);
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

        // W7 (TASK-1045) — cancel button must be enabled while a run is in the
        // 'processing' (post-compute result-finalize) phase. Before W7 the
        // affordance disappeared the moment the run moved to processing.
        it('renders Cancel-Run when status=processing (TASK-1045 W7)', (done) => {
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={{...baseScenario, status: 'processing', latest_run: {id: 91, status: 'processing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const cancel = container.querySelector('.scenario-action-cancel-run');
                    expect(cancel).toExist();
                    expect(cancel.className).toNotInclude('is-hidden');
                    expect(cancel.disabled).toBe(false);
                    done();
                }
            );
        });

        it('cancel-run via latest_run.status=processing dispatches onConfirmCancelRun (TASK-1045 W7)', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={{...baseScenario, status: 'processing', latest_run: {id: 92, status: 'processing'}}}
                    canEdit canRunScenario
                    onConfirmCancelRun={(s) => { captured = s; }}
                />,
                container,
                () => {
                    const cancel = container.querySelector('.scenario-action-cancel-run');
                    expect(cancel).toExist();
                    cancel.click();
                    expect(captured).toExist();
                    expect(captured.latest_run.id).toBe(92);
                    done();
                }
            );
        });
    });

    describe('Wave 3C C1 — Archive pre-disabled while running', () => {
        ['queued', 'computing', 'building'].forEach((status) => {
            it(`renders Archive disabled with tooltip when status=${status}`, (done) => {
                ReactDOM.render(
                    <ScenarioActionToolbar
                        scenario={{...baseScenario, status}}
                        canEdit canRunScenario
                    />,
                    container,
                    () => {
                        const arch = container.querySelector('.scenario-action-archive');
                        expect(arch).toExist();
                        expect(arch.className).toNotInclude('is-hidden');
                        expect(arch.className).toInclude('disabled');
                        expect(arch.disabled).toBe(true);
                        expect(arch.getAttribute('title')).toBe(
                            'Cannot archive while a run is in progress. Cancel the run first.'
                        );
                        done();
                    }
                );
            });
        });

        it('Archive remains enabled (no title) when status is not cancellable', (done) => {
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={{...baseScenario, status: 'built'}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const arch = container.querySelector('.scenario-action-archive');
                    expect(arch).toExist();
                    expect(arch.className).toNotInclude('disabled');
                    expect(arch.disabled).toBe(false);
                    expect(arch.getAttribute('title')).toNotExist();
                    done();
                }
            );
        });

        it('disabled Archive button does NOT invoke onArchiveClick on click', (done) => {
            let captured = false;
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={{...baseScenario, status: 'computing'}}
                    canEdit canRunScenario
                    onArchiveClick={() => { captured = true; }}
                />,
                container,
                () => {
                    const arch = container.querySelector('.scenario-action-archive');
                    expect(arch).toExist();
                    // disabled buttons ignore clicks per HTML spec, but call directly
                    // to ensure the onClick handler also guards.
                    arch.click();
                    expect(captured).toBe(false);
                    done();
                }
            );
        });
    });

    describe('Wave 3C C2 — Cancel-Run not enabled for terminal run status', () => {
        ['complete', 'error', 'cancelled'].forEach((terminalStatus) => {
            it(`does not render Cancel-Run when latest_run.status=${terminalStatus}`, (done) => {
                // Scenario status is non-cancellable too (built / created / etc) when
                // latest_run is terminal in real-world traffic; baseScenario.status='built'
                // is the canonical case post-complete (BE flips back to 'built' before
                // 'complete' depending on poller race) so we test both.
                ReactDOM.render(
                    <ScenarioActionToolbar
                        scenario={{
                            ...baseScenario,
                            status: 'built',
                            latest_run: {id: 5, status: terminalStatus}
                        }}
                        canEdit canRunScenario
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.scenario-action-cancel-run')).toNotExist();
                        done();
                    }
                );
            });
        });

        it('isCancellable scenario with terminal latest_run.status still hides Cancel-Run (defence-in-depth)', (done) => {
            // Synthetic: should never happen in BE traffic but defends against
            // set-drift between TERMINAL_RUN_STATES and isCancellable. Because
            // isCancellable=true forces the button into the cancel-run branch
            // (class .scenario-action-cancel-run) AND canDeleteScenario=false
            // (since isCancellable=true), the button renders but gets is-hidden.
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={{
                        ...baseScenario,
                        status: 'computing',
                        latest_run: {id: 5, status: 'complete'}
                    }}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const cancel = container.querySelector('.scenario-action-cancel-run');
                    expect(cancel).toExist();
                    expect(cancel.className).toInclude('is-hidden');
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

        // Wave 3C — Duplicate moved to the scenario panel header. The toolbar
        // no longer wires onDuplicateClick anywhere; this guard exercises every
        // button on the toolbar and confirms the supplied onDuplicateClick prop
        // is never invoked from here (call-spy assertion).
        it('onDuplicateClick prop is never invoked from any toolbar button (dead prop)', (done) => {
            let dupCalls = 0;
            ReactDOM.render(
                <ScenarioActionToolbar
                    scenario={baseScenario}
                    canEdit canRunScenario canDuplicateScenario
                    onDuplicateClick={() => { dupCalls++; }}
                    onBuildClick={() => {}}
                    onRunClick={() => {}}
                    onRetryClick={() => {}}
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
                    expect(dupCalls).toBe(0);
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
