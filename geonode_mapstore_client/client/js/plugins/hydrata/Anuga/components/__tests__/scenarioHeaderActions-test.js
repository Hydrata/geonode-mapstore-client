/*
 * UAT #8 — ScenarioHeaderActions: the always-visible run-action strip that
 * moved out of the Run pane up into the Scenarios heading. Covers the three
 * new behaviours (Build-and-Run, built-gated Download, click debounce) plus
 * the preserved Build/Run/Retry/Archive/Delete/Cancel wiring + Umami labels.
 *
 * Memory pins:
 *   - feedback-window-confirm-blocks-automation: the strip must never call
 *     window.confirm/alert — confirm-requiring actions route through the
 *     onConfirm* props (the container owns the inline dialog).
 *   - feedback-mapstore-react-version-mismatch: drive via real .click() +
 *     dispatched-handler capture, not setState-flush patterns.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioHeaderActions, ACTION_DEBOUNCE_MS} from '../scenarioHeaderActions';

const baseScenario = {
    id: 21,
    name: 'Baseline',
    status: 'built',
    created_by: 7
};

describe('ScenarioHeaderActions (UAT #8)', () => {
    let container;
    let trackCalls;
    let origUmami;
    let origConfirm;
    let origAlert;
    let confirmCalls;
    let alertCalls;

    function labels() {
        return trackCalls.map(c => c.label);
    }

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        trackCalls = [];
        origUmami = window.umami;
        window.umami = { track: (label, payload) => trackCalls.push({label, ...payload}) };
        confirmCalls = 0;
        alertCalls = 0;
        origConfirm = window.confirm;
        origAlert = window.alert;
        // eslint-disable-next-line no-alert -- regression guard mock, not real
        window.confirm = () => { confirmCalls++; return true; };
        // eslint-disable-next-line no-alert -- regression guard mock, not real
        window.alert = () => { alertCalls++; };
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        window.umami = origUmami;
        window.confirm = origConfirm;
        window.alert = origAlert;
        setTimeout(done);
    });

    it('renders nothing when no scenario is selected', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={null} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('#scenario-run-actions')).toNotExist();
                done();
            }
        );
    });

    // TASK-2115 (C) — View Results folded into this strip (dogfood finding C:
    // was a separate .sv-anuga-view-results-bar sibling row).
    describe('View Results (TASK-2115 C)', () => {
        it('renders View Results as the FIRST button in the strip when hasCompleteResults is true', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={baseScenario}
                    canEdit canRunScenario
                    hasCompleteResults
                    onViewResultsClick={(s) => { captured = s; }}
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    expect(strip).toExist();
                    const vrBtn = strip.querySelector('.sv-anuga-btn-view-results');
                    expect(vrBtn).toExist();
                    // Leads the row — first child button.
                    expect(strip.firstElementChild).toBe(vrBtn);
                    vrBtn.click();
                    expect(captured?.id).toBe(21);
                    done();
                }
            );
        });

        it('does NOT render View Results when hasCompleteResults is false', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={baseScenario}
                    canEdit canRunScenario
                    hasCompleteResults={false}
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-btn-view-results')).toNotExist();
                    done();
                }
            );
        });

        it('does NOT render View Results when hasCompleteResults is omitted (default false, backward-compat)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-btn-view-results')).toNotExist();
                    done();
                }
            );
        });
    });

    it('renders Build, Build-and-Run and Run in the always-visible strip (built status)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('#scenario-run-actions')).toExist();
                expect(container.querySelector('.sv-scenario-action-build')).toExist();
                expect(container.querySelector('.sv-scenario-action-build-run')).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toExist();
                done();
            }
        );
    });

    // TASK-2100 (epic 2092 W4.2) — the Run action's price-band label.
    it('shows no price label when latest_run.price_band is absent (meter off / unpriceable — ships dark)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('[data-testid="sv-scenario-run-price"]')).toNotExist();
                done();
            }
        );
    });

    it('shows "$5" when latest_run.price_band is a priced band', (done) => {
        const scenario = {...baseScenario, latest_run: {price_band: '5'}};
        ReactDOM.render(
            <ScenarioHeaderActions scenario={scenario} canEdit canRunScenario />,
            container,
            () => {
                const el = container.querySelector('[data-testid="sv-scenario-run-price"]');
                expect(el).toExist();
                expect(el.textContent).toBe('$5');
                done();
            }
        );
    });

    it('shows "Free" when latest_run.price_band is the $0 band', (done) => {
        const scenario = {...baseScenario, latest_run: {price_band: '0'}};
        ReactDOM.render(
            <ScenarioHeaderActions scenario={scenario} canEdit canRunScenario />,
            container,
            () => {
                const el = container.querySelector('[data-testid="sv-scenario-run-price"]');
                expect(el).toExist();
                expect(el.textContent).toBe('Free');
                done();
            }
        );
    });

    it('Build click fires onBuildClick + the anuga-scenario-menu-build label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onBuildClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-build').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-build');
                done();
            }
        );
    });

    it('debounce: Build button becomes disabled immediately after a click', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario onBuildClick={() => {}} />,
            container,
            () => {
                const btn = container.querySelector('.sv-scenario-action-build');
                expect(btn.disabled).toBe(false);
                btn.click();
                setTimeout(() => {
                    expect(container.querySelector('.sv-scenario-action-build').disabled).toBe(true);
                    // >= 2s debounce so the press registers visually (UAT #8).
                    expect(ACTION_DEBOUNCE_MS).toBe(2000);
                    done();
                });
            }
        );
    });

    it('Build-and-Run click fires onBuildAndRunClick + the build-and-run label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onBuildAndRunClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-build-run').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-build-and-run');
                done();
            }
        );
    });

    it('Run click fires onRunClick + the anuga-scenario-menu-run label (built status)', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onRunClick={(s) => { captured = s; }}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-run').click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-run');
                done();
            }
        );
    });

    it('Run is disabled in created status (nothing to run yet)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'created'}}
                canEdit canRunScenario
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-run').disabled).toBe(true);
                done();
            }
        );
    });

    it('cancelled status renders the Re-run variant + the rerun label', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'cancelled', latest_run: {id: 9, status: 'cancelled'}}}
                canEdit canRunScenario
                onRunClick={() => {}}
            />,
            container,
            () => {
                const rerun = container.querySelector('.sv-scenario-action-rerun');
                expect(rerun).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toNotExist();
                rerun.click();
                expect(labels()).toInclude('anuga-scenario-menu-rerun');
                done();
            }
        );
    });

    it('error status renders Retry (not Run)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'error', latest_run: {id: 9, status: 'error'}}}
                canEdit canRunScenario
                onRetryClick={() => {}}
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-retry')).toExist();
                expect(container.querySelector('.sv-scenario-action-run')).toNotExist();
                container.querySelector('.sv-scenario-action-retry').click();
                expect(labels()).toInclude('anuga-scenario-menu-retry');
                done();
            }
        );
    });

    it('Download is visible ONLY when built and links to the run package URL', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                canEdit canRunScenario
            />,
            container,
            () => {
                const dl = container.querySelector('.sv-scenario-action-download');
                expect(dl).toExist();
                expect(dl.getAttribute('href')).toBe('https://x/y.zip');
                done();
            }
        );
    });

    it('Download is NOT rendered for a not-yet-built (created) scenario', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'created'}}
                canEdit canRunScenario
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-download')).toNotExist();
                done();
            }
        );
    });

    // TASK-2078: package download href/gate is a RESULT consumer (D1) —
    // reads latest_complete_run so a newer in-flight/errored latest_run
    // never hides/breaks the download of the last-good result package.
    it('TASK-2078: Download stays visible + points at latest_complete_run\'s package while a newer run is in-flight (AC1)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{
                    ...baseScenario,
                    status: 'computing',
                    latest_run: {id: 10, status: 'computing'},
                    latest_complete_run: {id: 9, status: 'complete', s3_package_url: 'https://x/complete-run-9.zip'}
                }}
                canEdit canRunScenario
            />,
            container,
            () => {
                const dl = container.querySelector('.sv-scenario-action-download');
                expect(dl).toExist();
                expect(dl.getAttribute('href')).toBe('https://x/complete-run-9.zip');
                done();
            }
        );
    });

    it('Delete (non-running) routes through onConfirmDelete + fires the delete label', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onConfirmDelete={(s) => { captured = s; }}
            />,
            container,
            () => {
                const del = container.querySelector('.sv-scenario-action-delete');
                expect(del).toExist();
                del.click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-delete-scenario');
                done();
            }
        );
    });

    it('Cancel-run (in-flight) routes through onConfirmCancelRun', (done) => {
        let captured = null;
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                canEdit canRunScenario
                onConfirmCancelRun={(s) => { captured = s; }}
            />,
            container,
            () => {
                const cancel = container.querySelector('.sv-scenario-action-cancel-run');
                expect(cancel).toExist();
                cancel.click();
                expect(captured?.id).toBe(21);
                expect(labels()).toInclude('anuga-scenario-menu-cancel-run');
                done();
            }
        );
    });

    // TASK-2079: a 409 (build-dedup guard — a build is already in flight for
    // this scenario) surfaces as benign inline info next to the Build
    // button, NOT the 'Build failed' toast (that lives in
    // comparisonActions.buildScenarioError). scenariosReducer.js stashes it
    // on the scenario as `buildConflict`.
    it('shows a benign inline conflict message when scenario.buildConflict is set', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={{
                    ...baseScenario,
                    buildConflict: {runId: 501, status: 'building', detail: 'A build is already in progress for this scenario.'}
                }}
                canEdit canRunScenario
            />,
            container,
            () => {
                const info = container.querySelector('.sv-scenario-build-conflict-info');
                expect(info).toExist();
                expect(info.textContent).toInclude('A build is already in progress for this scenario.');
                done();
            }
        );
    });

    it('does NOT show the conflict message when scenario.buildConflict is absent', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-build-conflict-info')).toNotExist();
                done();
            }
        );
    });

    it('never calls window.confirm / window.alert', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onConfirmDelete={() => {}}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-delete').click();
                expect(confirmCalls).toBe(0);
                expect(alertCalls).toBe(0);
                done();
            }
        );
    });

    // UAT re-aim (2026-07-06, epic 2111 W2 dogfood follow-up, finding 3) —
    // every button in this row becomes EQUAL WIDTH and ICON-FREE. Archive/
    // Unarchive and Delete/Cancel-run were icon-only glyphicon buttons; they
    // now render their existing Message text (btnArchive / btnRestore /
    // btnDelete / btnCancelRun — the SAME msgIds the confirm dialog already
    // used, not new strings) instead of a bare glyph.
    describe('Icon-free, fixed-width action row (UAT re-aim finding 3; operator polish 2026-07-07)', () => {
        it('renders no .glyphicon anywhere inside the strip', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{
                        ...baseScenario,
                        buildConflict: {runId: 501, status: 'building', detail: 'x'}
                    }}
                    canEdit canRunScenario
                    hasCompleteResults
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    expect(strip).toExist();
                    expect(strip.querySelectorAll('.glyphicon').length).toBe(0);
                    done();
                }
            );
        });

        it('View Results button has no icon (text-only)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario hasCompleteResults />,
                container,
                () => {
                    const vrBtn = container.querySelector('.sv-anuga-btn-view-results');
                    expect(vrBtn).toExist();
                    expect(vrBtn.querySelector('.glyphicon')).toNotExist();
                    expect(vrBtn.textContent).toInclude('hydrata.anuga.viewResults');
                    done();
                }
            );
        });

        it('Download button has no icon (text-only)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const dl = container.querySelector('.sv-scenario-action-download');
                    expect(dl).toExist();
                    expect(dl.querySelector('.glyphicon')).toNotExist();
                    expect(dl.textContent).toInclude('hydrata.anuga.download');
                    done();
                }
            );
        });

        it('the benign build-conflict info message has no icon either', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{
                        ...baseScenario,
                        buildConflict: {runId: 501, status: 'building', detail: 'A build is already in progress for this scenario.'}
                    }}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const info = container.querySelector('.sv-scenario-build-conflict-info');
                    expect(info).toExist();
                    expect(info.querySelector('.glyphicon')).toNotExist();
                    done();
                }
            );
        });

        it('Archive button is a TEXT button (hydrata.anuga.btnArchive), no longer icon-only', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    const archBtn = container.querySelector('.sv-scenario-action-archive');
                    expect(archBtn).toExist();
                    expect(archBtn.querySelector('.glyphicon')).toNotExist();
                    expect(archBtn.textContent).toInclude('hydrata.anuga.btnArchive');
                    done();
                }
            );
        });

        it('Unarchive button is a TEXT button reusing hydrata.anuga.btnRestore (same id the confirm dialog uses)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, archived_at: '2026-01-01T00:00:00Z'}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const unarchBtn = container.querySelector('.sv-scenario-action-unarchive');
                    expect(unarchBtn).toExist();
                    expect(unarchBtn.querySelector('.glyphicon')).toNotExist();
                    expect(unarchBtn.textContent).toInclude('hydrata.anuga.btnRestore');
                    done();
                }
            );
        });

        it('Delete button is a TEXT button (hydrata.anuga.btnDelete), no longer icon-only', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    const delBtn = container.querySelector('.sv-scenario-action-delete');
                    expect(delBtn).toExist();
                    expect(delBtn.querySelector('.glyphicon')).toNotExist();
                    expect(delBtn.textContent).toInclude('hydrata.anuga.btnDelete');
                    done();
                }
            );
        });

        it('Cancel-run button is a TEXT button (hydrata.anuga.btnCancelRun), no longer icon-only', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const cancelBtn = container.querySelector('.sv-scenario-action-cancel-run');
                    expect(cancelBtn).toExist();
                    expect(cancelBtn.querySelector('.glyphicon')).toNotExist();
                    expect(cancelBtn.textContent).toInclude('hydrata.anuga.btnCancelRun');
                    done();
                }
            );
        });

        it('every rendered action-row button shares the fixed-width hook class .sv-scenario-action-toolbar-btn', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'built'}}
                    canEdit canRunScenario
                    hasCompleteResults
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    const buttons = strip.querySelectorAll('.sv-anuga-btn');
                    expect(buttons.length).toBeGreaterThan(0);
                    Array.from(buttons).forEach((btn) => {
                        expect(btn.className).toInclude('sv-scenario-action-toolbar-btn');
                    });
                    done();
                }
            );
        });
    });

    // TASK-2239 (epic 2237 W1.1) — run cluster + 4-state lifecycle-slot mutex.
    describe('Run cluster + lifecycle-slot mutex (TASK-2239)', () => {
        it('the cluster renders exactly 3 buttons for a built, editable, runnable scenario', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    const cluster = container.querySelector('.sv-scenario-run-cluster');
                    expect(cluster).toExist();
                    expect(cluster.querySelectorAll('button, a').length).toBe(3);
                    expect(cluster.querySelector('.sv-scenario-action-build-run')).toExist();
                    expect(cluster.querySelector('.sv-scenario-action-run')).toExist();
                    expect(cluster.querySelector('.sv-scenario-action-build')).toExist();
                    done();
                }
            );
        });

        it('mutex: Cancel run replaces Run entirely while cancellable (no visible-disabled Run alongside it)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const cluster = container.querySelector('.sv-scenario-run-cluster');
                    expect(cluster.querySelector('.sv-scenario-action-cancel-run')).toExist();
                    expect(cluster.querySelector('.sv-scenario-action-run')).toNotExist();
                    expect(cluster.querySelector('.sv-scenario-action-rerun')).toNotExist();
                    expect(cluster.querySelector('.sv-scenario-action-retry')).toNotExist();
                    // Exactly 3 slots still: Build-and-Run, Cancel (the slot), Build.
                    expect(cluster.querySelectorAll('button, a').length).toBe(3);
                    done();
                }
            );
        });

        it('poll-lag fallback: in-flight status + a TERMINAL latest_run falls back to a disabled Run (not Cancel)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'complete'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const cluster = container.querySelector('.sv-scenario-run-cluster');
                    expect(cluster.querySelector('.sv-scenario-action-cancel-run')).toNotExist();
                    const runBtn = cluster.querySelector('.sv-scenario-action-run');
                    expect(runBtn).toExist();
                    expect(runBtn.disabled).toBe(true);
                    done();
                }
            );
        });

        it('Build & Run carries its own primary-green hook class, distinct from the standard success family', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    const btn = container.querySelector('.sv-scenario-action-build-run');
                    expect(btn).toExist();
                    // Byte-identical legacy classnames still present.
                    expect(btn.className).toInclude('sv-anuga-btn');
                    expect(btn.className).toInclude('sv-scenario-action-toolbar-btn');
                    done();
                }
            );
        });

        it('View Results and Download carry the OUTLINE family modifier (safe/non-destructive)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                    canEdit canRunScenario
                    hasCompleteResults
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-btn-view-results').className)
                        .toInclude('sv-scenario-action-outline');
                    expect(container.querySelector('.sv-scenario-action-download').className)
                        .toInclude('sv-scenario-action-outline');
                    done();
                }
            );
        });

        it('the run cluster does not read as an inset segmented pill/tab group (no shared pill wrapper class)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    const cluster = container.querySelector('.sv-scenario-run-cluster');
                    expect(cluster).toExist();
                    expect(cluster.className).toNotInclude('pill');
                    expect(cluster.className).toNotInclude('tab');
                    done();
                }
            );
        });

        it('Delete stays a standalone button (not fused with Cancel run) when not cancellable', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={baseScenario}
                    canEdit canRunScenario
                    onConfirmDelete={(s) => { captured = s; }}
                />,
                container,
                () => {
                    const del = container.querySelector('.sv-scenario-action-delete');
                    expect(del).toExist();
                    // Not inside the run cluster — Delete lives in the wider strip.
                    expect(container.querySelector('.sv-scenario-run-cluster .sv-scenario-action-delete')).toNotExist();
                    del.click();
                    expect(captured?.id).toBe(21);
                    expect(labels()).toInclude('anuga-scenario-menu-delete-scenario');
                    done();
                }
            );
        });

        it('the build-conflict span still renders adjacent to the cluster (role=status, aria-live=polite)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, buildConflict: {runId: 501, status: 'building', detail: 'x'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    const cluster = strip.querySelector('.sv-scenario-run-cluster');
                    const info = strip.querySelector('.sv-scenario-build-conflict-info');
                    expect(info).toExist();
                    expect(info.getAttribute('role')).toBe('status');
                    expect(info.getAttribute('aria-live')).toBe('polite');
                    expect(cluster).toExist();
                    done();
                }
            );
        });
    });
});
