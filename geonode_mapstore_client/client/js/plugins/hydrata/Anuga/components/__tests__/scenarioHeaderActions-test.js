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

    /*
     * TASK-2438 (epic 2425 W3.1) — the price beside Run, sourced from the
     * PRE-BUILD estimate when no run exists yet.
     *
     * The defect these pin: the label above is sourced from
     * `scenario.latest_run.price_band`, which is null until a run EXISTS —
     * so a priced scenario that has never been run structurally cannot show
     * a price, which is the one moment the customer most needs it. The
     * built run's price_band stays authoritative wherever it exists (it is
     * frozen off the built mesh; the estimate is not).
     */
    describe('TASK-2438 — price + shortfall from the pre-build estimate', () => {
        // The local band table (ansible/inventories/localhost.yaml) and the
        // shape the account summary reducer hands down: a $0.50 free edge,
        // then (0.50, 2] -> $1, (2, 5] -> $2, (5, 20] -> $5.
        const FREE_BAND = {cap: 3, usedToday: 0, edge: '0.50', table: [[2, '1'], [5, '2'], [20, '5']]};
        // $3.00 clears the free edge and lands in the (2, 5] -> $2 band.
        const priced = {...baseScenario, compute_cost_estimate: 3, mesh_triangle_count_estimate: 42000, latest_run: null};

        const priceEl = () => container.querySelector('[data-testid="sv-scenario-run-price"]');

        it('a never-run priced scenario shows its band price beside Run', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                />,
                container,
                () => {
                    const el = priceEl();
                    expect(el).toExist();
                    expect(el.textContent).toBe('$2');
                    done();
                }
            );
        });

        it('a built run\'s price_band stays authoritative over the estimate', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...priced, latest_run: {price_band: '5'}}}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                />,
                container,
                () => {
                    // $5 (what the built mesh will actually be charged), never
                    // the $2 the pre-build estimate buckets into.
                    expect(priceEl().textContent).toBe('$5');
                    done();
                }
            );
        });

        it('renders NOTHING, not "$NaN", before the band table has loaded', (done) => {
            // The account summary reducer's initialState is
            // {edge: '0', table: []} — every map load renders at least once
            // in this state, before GET /commerce/account/ returns.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={{cap: 0, usedToday: 0, edge: '0', table: []}}
                />,
                container,
                () => {
                    expect(priceEl()).toNotExist();
                    done();
                }
            );
        });

        it('renders nothing when the paywall ships dark', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled={false}
                    freeBand={FREE_BAND}
                />,
                container,
                () => {
                    expect(priceEl()).toNotExist();
                    done();
                }
            );
        });

        it('an estimate inside the free edge reads "Free" through the same element', (done) => {
            // 0.10 <= the 0.50 free edge -> band 0. formatCostEstimate would
            // render this "~$0.10 est."; the BAND is what gets charged, and
            // it is free.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...priced, compute_cost_estimate: 0.1}}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="0.00"
                />,
                container,
                () => {
                    expect(priceEl().textContent).toBe('Free');
                    done();
                }
            );
        });

        it('an estimate above the dispatch ceiling shows no price at all', (done) => {
            // bandForEstimate returns Infinity past the table's last finite
            // bound — the BE refuses these outright, so there is no price to
            // state. "$Infinity" would be worse than silence.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...priced, compute_cost_estimate: 999}}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                />,
                container,
                () => {
                    expect(priceEl()).toNotExist();
                    done();
                }
            );
        });

        it('states the shortfall and opens Billing when the price exceeds the balance', (done) => {
            let opened = 0;
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="0.00"
                    onOpenAccountBilling={() => { opened++; }}
                />,
                container,
                () => {
                    const el = priceEl();
                    expect(el).toExist();
                    expect(el.textContent).toBe('Costs $2 · balance $0.00 · add at least $2 to run');
                    expect(el.tagName).toBe('BUTTON');
                    Simulate.click(el);
                    expect(opened).toBe(1);
                    done();
                }
            );
        });

        it('shortfall arithmetic is the gap, not the price (partial balance)', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="1.50"
                    onOpenAccountBilling={() => {}}
                />,
                container,
                () => {
                    expect(priceEl().textContent).toBe('Costs $2 · balance $1.50 · add at least $0.50 to run');
                    done();
                }
            );
        });

        it('a covered balance shows the bare price, no shortfall and no CTA', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="10.00"
                    onOpenAccountBilling={() => {}}
                />,
                container,
                () => {
                    const el = priceEl();
                    expect(el.textContent).toBe('$2');
                    expect(el.tagName).toBe('SPAN');
                    done();
                }
            );
        });

        it('a BUILT run over balance states the shortfall too', (done) => {
            // A built run's $5 charge against a $0 balance will be refused on
            // dispatch exactly like an estimated one — same warning.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...priced, latest_run: {price_band: '5'}}}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="0.00"
                    onOpenAccountBilling={() => {}}
                />,
                container,
                () => {
                    expect(priceEl().textContent).toBe('Costs $5 · balance $0.00 · add $5 to run');
                    done();
                }
            );
        });

        it('Run / Build / Build-and-Run stay ENABLED at insufficient balance', (done) => {
            // Epic decision 4: the server is the single source of truth; a
            // button disabled from a stale client-side estimate produces
            // FALSE refusals, which are worse than caught ones.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="0.00"
                    onOpenAccountBilling={() => {}}
                />,
                container,
                () => {
                    ['.sv-scenario-action-run', '.sv-scenario-action-build', '.sv-scenario-action-build-run']
                        .forEach((selector) => {
                            const btn = container.querySelector(selector);
                            expect(btn).toExist();
                            expect(btn.disabled).toBe(false);
                        });
                    done();
                }
            );
        });

        // ── W3c adversarial: two claims the chip made that the server refuses ──
        describe('the chip stops promising what the server will refuse (W3c)', () => {
            const free = {...priced, compute_cost_estimate: 0.25};

            it('says plain "Free" while free dispatches remain', (done) => {
                ReactDOM.render(
                    <ScenarioHeaderActions
                        scenario={free} canEdit canRunScenario paywallEnabled
                        freeBand={{...FREE_BAND, cap: 3, usedToday: 1}}
                    />,
                    container,
                    () => {
                        expect(priceEl().textContent).toBe('Free');
                        done();
                    }
                );
            });

            it('stops saying plain "Free" once today\'s free dispatches are used', (done) => {
                // The dispatch gate refuses exactly these runs with `free_cap`
                // (apps/gn_anuga/api_v2.py), counting the same query the summary
                // reports as used_today — so the promise is refutable server-side
                // before the customer ever clicks. Before TASK-2438 this chip
                // rendered nothing at all for a never-run scenario, so the
                // promise is newly introduced.
                ReactDOM.render(
                    <ScenarioHeaderActions
                        scenario={free} canEdit canRunScenario paywallEnabled
                        freeBand={{...FREE_BAND, cap: 3, usedToday: 3}}
                    />,
                    container,
                    () => {
                        const el = priceEl();
                        expect(el.textContent).toNotBe(
                            'Free',
                            'the chip guaranteed a free run the server refuses with free_cap'
                        );
                        expect(el.textContent).toInclude('daily limit reached');
                        expect(el.getAttribute('title')).toInclude('refused');
                        done();
                    }
                );
            });

            it('an UNLOADED free band (cap 0) under-warns rather than inventing a refusal', (done) => {
                // The account reducer's initialState is {cap: 0, usedToday: 0},
                // and 0 >= 0 would stamp "limit reached" on every render before
                // GET /commerce/account/ lands.
                ReactDOM.render(
                    <ScenarioHeaderActions
                        scenario={{...free, latest_run: {price_band: '0'}}}
                        canEdit canRunScenario paywallEnabled
                        freeBand={{cap: 0, usedToday: 0, edge: '0.50', table: []}}
                    />,
                    container,
                    () => {
                        expect(priceEl().textContent).toBe('Free');
                        done();
                    }
                );
            });

            it('the shortfall on an ESTIMATE keeps the hedge in both the sentence and the tooltip', (done) => {
                // The over-balance title used to REPLACE the estimate caveat, so
                // "add $2 to run" read as a precise instruction in the one state
                // where the number is one. A larger built mesh can price higher,
                // and then the customer is refused having done exactly what the
                // chip told them.
                ReactDOM.render(
                    <ScenarioHeaderActions
                        scenario={priced} canEdit canRunScenario paywallEnabled
                        freeBand={FREE_BAND} accountBalance="0.00"
                        onOpenAccountBilling={() => {}}
                    />,
                    container,
                    () => {
                        const el = priceEl();
                        expect(el.textContent).toInclude('at least');
                        expect(el.getAttribute('title')).toInclude('confirmed when it builds');
                        done();
                    }
                );
            });

            it('a BUILT run\'s shortfall carries NO hedge — its price is frozen off the real mesh', (done) => {
                ReactDOM.render(
                    <ScenarioHeaderActions
                        scenario={{...priced, latest_run: {price_band: '5'}}}
                        canEdit canRunScenario paywallEnabled
                        freeBand={FREE_BAND} accountBalance="0.00"
                        onOpenAccountBilling={() => {}}
                    />,
                    container,
                    () => {
                        const el = priceEl();
                        expect(el.textContent).toBe('Costs $5 · balance $0.00 · add $5 to run');
                        expect(el.getAttribute('title')).toNotInclude('estimate');
                        done();
                    }
                );
            });
        });

        it('no customer-visible string anywhere in the strip says "band"', (done) => {
            // COPY RULE (glossary.md:609) — "band" collides with Analysis
            // band, a raster concept. Covers title/aria text, not just the
            // rendered copy: a tooltip is customer-visible.
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={priced}
                    canEdit canRunScenario
                    paywallEnabled
                    freeBand={FREE_BAND}
                    accountBalance="0.00"
                    onOpenAccountBilling={() => {}}
                />,
                container,
                () => {
                    const bare = /\bbands?\b/i;
                    expect(bare.test(container.textContent)).toBe(false);
                    Array.from(container.querySelectorAll('[title], [aria-label]')).forEach((el) => {
                        expect(bare.test(el.getAttribute('title') || '')).toBe(false);
                        expect(bare.test(el.getAttribute('aria-label') || '')).toBe(false);
                    });
                    done();
                }
            );
        });
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

        // TASK-2400 (dogfood F1 #2a) — a free-band ($0) pre-build estimate
        // must read 'Free', never a bare '$0.00'.
        it('Build tooltip echo renders "Free" (never "$0.00") for a free-band ($0) estimate', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, mesh_triangle_count_estimate: 200, compute_cost_estimate: 0}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build', () => {
                        const tooltip = document.getElementById('sv-scenario-build-tooltip');
                        expect(tooltip.textContent).toInclude('Free');
                        expect(tooltip.textContent).toNotInclude('$0.00');
                        done();
                    });
                }
            );
        });

        // TASK-2400 (dogfood F1 #1) — when the scenario has unsaved local
        // edits (scenario.unsaved), the tooltip echo must flag the estimate
        // as stale rather than presenting the last-saved figure as current.
        it('Build tooltip echo flags the estimate as outdated when scenario.unsaved is true', (done) => {
            ReactDOM.render(
                <ScenarioHeaderActions
                    scenario={{...baseScenario, mesh_triangle_count_estimate: 500, compute_cost_estimate: 0.5, unsaved: true}}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    hoverTooltipWrapOf('.sv-scenario-action-build', () => {
                        const tooltip = document.getElementById('sv-scenario-build-tooltip');
                        expect(tooltip.textContent).toInclude('outdated');
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
