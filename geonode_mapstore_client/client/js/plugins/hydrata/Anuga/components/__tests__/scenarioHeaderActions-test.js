/*
 * UAT #8 — ScenarioHeaderActions: the always-visible run-action strip that
 * moved out of the Run pane up into the Scenarios heading. Covers the three
 * new behaviours (Build-and-Run, built-gated Download, click debounce) plus
 * the preserved Build/Run/Retry/Cancel wiring + Umami labels. TASK-2239 adds
 * the run-cluster + lifecycle-slot mutex; TASK-2240 moves Archive/Unarchive/
 * Delete out of this strip into the overflow (kebab) menu — see the
 * regression guards below and anugaScenarioOverflowMenu-test.js.
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
import {Simulate} from 'react-dom/test-utils';
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
    // was a separate .sv-anuga-view-results-bar sibling row). TASK-2266
    // (epic 2237 W5, UAT re-aim finding 1) repositioned it: 2nd-from-right,
    // immediately left of Download, not leading the row — see the DOM-order
    // assertion below and 'Toolbar order (TASK-2266)' further down.
    describe('View Results (TASK-2115 C, repositioned TASK-2266)', () => {
        it('renders View Results immediately before Download in the DOM (2nd-from-right, TASK-2266)', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                    canEdit canRunScenario
                    hasCompleteResults
                    onViewResultsClick={(s) => { captured = s; }}
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    expect(strip).toExist();
                    const vrBtn = strip.querySelector('.sv-anuga-btn-view-results');
                    const dlBtn = strip.querySelector('.sv-scenario-action-download');
                    expect(vrBtn).toExist();
                    expect(dlBtn).toExist();
                    // Download is rightmost; View Results is its immediate
                    // predecessor sibling — 2nd-from-right in the RENDERED strip.
                    expect(strip.lastElementChild).toBe(dlBtn);
                    expect(dlBtn.previousElementSibling).toBe(vrBtn);
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

    // TASK-2240 — Delete moved OUT of this strip into the overflow (kebab)
    // menu; see anugaScenarioOverflowMenu-test.js for its coverage. This
    // strip no longer accepts onConfirmDelete / renders .sv-scenario-action-
    // delete at all (regression guard below).
    it('does NOT render a Delete button or accept onConfirmDelete (moved to the overflow menu, TASK-2240)', (done) => {
        ReactDOM.render(
            <ScenarioHeaderActions
                scenario={baseScenario}
                canEdit canRunScenario
                onConfirmDelete={() => {}}
            />,
            container,
            () => {
                expect(container.querySelector('.sv-scenario-action-delete')).toNotExist();
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
                scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                canEdit canRunScenario
                onConfirmCancelRun={() => {}}
            />,
            container,
            () => {
                container.querySelector('.sv-scenario-action-cancel-run').click();
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

        // TASK-2240 — Archive/Unarchive/Delete moved OUT of this strip into
        // the overflow (kebab) menu; see anugaScenarioOverflowMenu-test.js
        // for their (still icon-free, text-button) coverage there.
        it('does NOT render Archive/Unarchive/Delete anywhere in this strip (moved to the overflow menu, TASK-2240)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, archived_at: '2026-01-01T00:00:00Z'}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-scenario-action-archive')).toNotExist();
                    expect(container.querySelector('.sv-scenario-action-unarchive')).toNotExist();
                    expect(container.querySelector('.sv-scenario-action-delete')).toNotExist();
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

    // TASK-2266 (epic 2237 W5, UAT re-aim finding 1) — the operator's dogfood
    // UAT read the RENDERED strip as [Build and Run][Run][Build][Download];
    // this asserts the actual final DOM order (not the JSX source order,
    // which reads run-cluster-first) with every optional slot populated, so
    // a future reshuffle of the JSX can't silently drift the visual order
    // this finding was about.
    describe('Toolbar order (TASK-2266)', () => {
        it('final DOM order is: run cluster (Build-and-Run, lifecycle slot, Build), View Results, Download', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'built', latest_run: {id: 9, s3_package_url: 'https://x/y.zip'}}}
                    canEdit canRunScenario
                    hasCompleteResults
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    // Query the top-level action nodes in DOM order: the run
                    // cluster wrapper div, then the two trailing buttons.
                    const topLevelNodes = Array.from(strip.children);
                    const cluster = strip.querySelector('.sv-scenario-run-cluster');
                    expect(topLevelNodes[0]).toBe(cluster);
                    // Inside the cluster: Build-and-Run, Run (lifecycle slot,
                    // 'created' is false here so Run, not Retry/Cancel), Build.
                    const clusterButtons = Array.from(cluster.querySelectorAll('.sv-scenario-action-toolbar-btn'));
                    expect(clusterButtons[0].className).toInclude('sv-scenario-action-build-run');
                    expect(clusterButtons[1].className).toInclude('sv-scenario-action-run');
                    expect(clusterButtons[2].className).toInclude('sv-scenario-action-build');
                    // Trailing pair: View Results immediately before Download.
                    expect(topLevelNodes[topLevelNodes.length - 2].className).toInclude('sv-anuga-btn-view-results');
                    expect(topLevelNodes[topLevelNodes.length - 1].className).toInclude('sv-scenario-action-download');
                    done();
                }
            );
        });

        it('still holds when the build-conflict info span also renders between the cluster and the trailing pair', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{
                        ...baseScenario, status: 'built',
                        latest_run: {id: 9, s3_package_url: 'https://x/y.zip'},
                        buildConflict: {runId: 501, status: 'building', detail: 'x'}
                    }}
                    canEdit canRunScenario
                    hasCompleteResults
                />,
                container,
                () => {
                    const strip = container.querySelector('#scenario-run-actions');
                    const vrBtn = strip.querySelector('.sv-anuga-btn-view-results');
                    const dlBtn = strip.querySelector('.sv-scenario-action-download');
                    expect(strip.lastElementChild).toBe(dlBtn);
                    expect(dlBtn.previousElementSibling).toBe(vrBtn);
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

        // TASK-2240 — superseded: Delete moved OUT of this strip entirely
        // into the overflow menu (see the regression guard in the
        // Icon-free/fixed-width describe block above, and
        // anugaScenarioOverflowMenu-test.js for Delete's own coverage).

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

    // TASK-2242 (epic 2237 W1.4) — executable tooltips: helper text + the
    // live estimate echo (Build / Build-and-Run only), disabled-button
    // wrapper, z-index fix. react-bootstrap's OverlayTrigger mounts its
    // Tooltip (portaled to document.body) asynchronously after the
    // triggering mouseOver — the DOM node is NOT there on the same tick, so
    // every assertion here waits one short macrotask before reading it.
    describe('Executable tooltips (TASK-2242)', () => {
        // Simulate.mouseOver dispatches straight to whatever element
        // OverlayTrigger attached its handler to (the wrapper SPAN, not the
        // button) — this is exactly the mechanism the disabled-button fix
        // depends on: a real browser's disabled <button> never dispatches
        // hover at all, so the wrapper having its OWN box/handler is what
        // makes the tooltip fire regardless of the button's disabled state.
        function hoverTooltipWrapOf(btnSelector, cb) {
            const btn = container.querySelector(btnSelector);
            const wrap = btn.parentElement;
            expect(wrap.className).toInclude('sv-scenario-tooltip-wrap');
            Simulate.mouseOver(wrap);
            setTimeout(cb, 50);
        }

        it('Build & Run shows its helper-text tooltip, z-index-lifted above the page wrapper', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build-run', () => {
                        const tooltip = document.getElementById('sv-scenario-build-and-run-tooltip');
                        expect(tooltip).toExist();
                        expect(tooltip.getAttribute('role')).toBe('tooltip');
                        expect(tooltip.textContent).toInclude('hydrata.anuga.buildAndRunTooltip');
                        expect(tooltip.style.zIndex).toBe('100000');
                        done();
                    });
                }
            );
        });

        it('Build shows its helper-text tooltip', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build', () => {
                        const tooltip = document.getElementById('sv-scenario-build-tooltip');
                        expect(tooltip).toExist();
                        expect(tooltip.textContent).toInclude('hydrata.anuga.buildTooltip');
                        expect(tooltip.style.zIndex).toBe('100000');
                        done();
                    });
                }
            );
        });

        it('Build & Run tooltip echoes the live estimate when the scenario carries one', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, mesh_triangle_count_estimate: 12345, compute_cost_estimate: 3.2}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build-run', () => {
                        const tooltip = document.getElementById('sv-scenario-build-and-run-tooltip');
                        expect(tooltip.textContent).toInclude('12,345 triangles');
                        expect(tooltip.textContent).toInclude('$3.20');
                        done();
                    });
                }
            );
        });

        it('Build tooltip echoes the live estimate when the scenario carries one', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, mesh_triangle_count_estimate: 500, compute_cost_estimate: 0.5}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build', () => {
                        const tooltip = document.getElementById('sv-scenario-build-tooltip');
                        expect(tooltip.textContent).toInclude('500 triangles');
                        expect(tooltip.textContent).toInclude('$0.50');
                        done();
                    });
                }
            );
        });

        it('omits the estimate echo cleanly when the scenario carries neither value', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={baseScenario} canEdit canRunScenario />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build-run', () => {
                        const tooltip = document.getElementById('sv-scenario-build-and-run-tooltip');
                        expect(tooltip.textContent).toNotInclude('triangles');
                        expect(tooltip.textContent).toNotInclude('$');
                        done();
                    });
                }
            );
        });

        it('the Build & Run tooltip still renders while the button is disabled mid-flight (in-flight status)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const btn = container.querySelector('.sv-scenario-action-build-run');
                    expect(btn.disabled).toBe(true);
                    hoverTooltipWrapOf('.sv-scenario-action-build-run', () => {
                        const tooltip = document.getElementById('sv-scenario-build-and-run-tooltip');
                        expect(tooltip).toExist();
                        done();
                    });
                }
            );
        });

        it('the Build tooltip still renders while disabled mid-flight', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const btn = container.querySelector('.sv-scenario-action-build');
                    expect(btn.disabled).toBe(true);
                    hoverTooltipWrapOf('.sv-scenario-action-build', () => {
                        const tooltip = document.getElementById('sv-scenario-build-tooltip');
                        expect(tooltip).toExist();
                        done();
                    });
                }
            );
        });

        it('the lifecycle-slot Run tooltip still renders while disabled (created status)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions scenario={{...baseScenario, status: 'created'}} canEdit canRunScenario />,
                container,
                () => {
                    const btn = container.querySelector('.sv-scenario-action-run');
                    expect(btn.disabled).toBe(true);
                    hoverTooltipWrapOf('.sv-scenario-action-run', () => {
                        const tooltip = document.getElementById('sv-scenario-run-tooltip');
                        expect(tooltip).toExist();
                        expect(tooltip.textContent).toInclude('hydrata.anuga.runTooltip');
                        done();
                    });
                }
            );
        });

        it('the lifecycle-slot Re-run tooltip is slot-state-appropriate (cancelled status)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'cancelled', latest_run: {id: 9, status: 'cancelled'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-rerun', () => {
                        const tooltip = document.getElementById('sv-scenario-run-tooltip');
                        expect(tooltip.textContent).toInclude('hydrata.anuga.rerunTooltip');
                        done();
                    });
                }
            );
        });

        it('the lifecycle-slot Retry tooltip is slot-state-appropriate (error status)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'error', latest_run: {id: 9, status: 'error'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-retry', () => {
                        const tooltip = document.getElementById('sv-scenario-retry-tooltip');
                        expect(tooltip.textContent).toInclude('hydrata.anuga.retryTooltip');
                        done();
                    });
                }
            );
        });

        it('the lifecycle-slot Cancel-run tooltip is slot-state-appropriate (computing status)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, status: 'computing', latest_run: {id: 9, status: 'computing'}}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-cancel-run', () => {
                        const tooltip = document.getElementById('sv-scenario-cancel-run-tooltip');
                        expect(tooltip.textContent).toInclude('hydrata.anuga.cancelRunTooltip');
                        done();
                    });
                }
            );
        });
    });
});
