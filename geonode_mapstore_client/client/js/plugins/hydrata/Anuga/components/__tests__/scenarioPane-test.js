import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import Localized from '@mapstore/framework/components/I18N/Localized';
import {ScenarioPane, formatBuildLog, meshRegionIsUnattached, rainfallIsUnattached, rainfallAttachedButEmpty} from '../scenarioPane';
const {enData} = require('../../../../../__tests__/fixtures/translations');

/**
 * TASK-C-scenarios-miller Wave 3A — per-category pane assertions.
 *
 * TASK-2114 (epic 2111 W2, dogfood findings A+B) — Required/Optional/Run no
 * longer gate three separate panes behind a tab click: ALL THREE sections
 * (Inputs, Advanced, Run) now render TOGETHER in one scrollable Pane-3 body,
 * regardless of `selectedCategoryId` (that prop still drives only which
 * rail item shows `.is-active` in Pane 2 — see the 'Category rail' block).
 * Per-selector "selected layer" resource-summary cards are gone entirely
 * (dogfood finding B) — a dedicated block asserts none render anywhere.
 *
 * Tests cover:
 *   - Category rail: 3 items render across 2 sections (no subhead labels),
 *     click flips selection (rail is unchanged by the merge)
 *   - Merged single-panel body: all 3 sections' fields present simultaneously,
 *     no resource-summary cards anywhere
 *   - Inputs section: 4 dropdowns + name input
 *   - Advanced section: 3 dropdowns (network removed)
 *   - Run section: resolution + duration + staff compute-target select + status
 *     card + (error strip) + inline ScenarioRunLog with auto-scroll (no
 *     in-pane action toolbar — that lives in the heading, UAT #8)
 *   - Empty pane: renders "Select or create a scenario" placeholder
 *   - Field update dispatch contract via onUpdateScenario
 *
 * Read-only-wrapper counts (Wave 3B B4) are scoped to each section's own
 * `.sv-anuga-scenario-pane-rows-*` wrapper rather than counted document-wide,
 * since all three sections' fields now coexist in the DOM at once.
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

// status: 'ready' — the scenario terrain picker now filters to runnable
// (status === 'ready') terrains, mirroring the BE Terrain.objects.filter(status='ready')
// gate (TASK-1587 W1.9 UAT, gmc d7595f750). A fixture without it is excluded.
const terrainOpts = [{id: 3, title: 'Default Terrain', status: 'ready'}, {id: 4, title: 'Other Terrain', status: 'ready'}];
const boundaryOpts = [{id: 4, title: 'Default Boundary'}];
const inflowOpts = [{id: 5, title: 'Default Inflow'}];
const rainfallOpts = [{id: 6, title: 'Default Rainfall'}];
const frictionOpts = [{id: 7, title: 'Default Friction'}];
const structureOpts = [{id: 8, title: 'Default Structure'}];
const meshRegionOpts = [{id: 9, title: 'Default Mesh Region'}];
const networkOpts = [{id: 10, title: 'Default Network'}];

describe('TASK-C ScenarioPane primitive (Wave 3A)', () => {
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

    // ------------------------------------------------------------------
    // Category rail (Pane 2) — REMOVED (UAT re-aim 2026-07-06, finding 1,
    // epic 2111 W2 dogfood follow-up). The vertical glance-nav rail is
    // obsolete now that the pane is one scroll; the form pane (Pane 3)
    // expands to occupy the freed width. The completeness counts the rail
    // used to show move into each section's own heading badge instead —
    // see 'Section-heading completeness badges' below, which reuses
    // validateCategoryProgress verbatim (finding 2) rather than the rail's
    // now-deleted derivation copy.
    // ------------------------------------------------------------------
    describe('Category rail removed (UAT re-aim, finding 1)', () => {
        it('does NOT render the vertical category rail or any category-item', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-category-rail')).toNotExist();
                    expect(container.querySelectorAll('.sv-anuga-scenario-category-item').length).toBe(0);
                    expect(container.querySelectorAll('.sv-anuga-scenario-category-section').length).toBe(0);
                    done();
                }
            );
        });

        it('still renders the merged detail body directly (Pane 3 alone occupies the freed width)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} canEdit />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-pane-detail')).toExist();
                    expect(container.querySelector('#name')).toExist();
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Section-heading completeness badges (UAT re-aim, finding 2) — the
    // rail's per-category "N/M" / "built" / "100%" tags now render
    // right-aligned inside each merged-pane section heading, reusing
    // validateCategoryProgress (scenarioHelpers.js) with the EXACT same
    // arguments the rail used to pass (including the TASK-2045
    // boundaryHasFeatures gate) — never re-derived.
    // ------------------------------------------------------------------
    describe('Section-heading completeness badges (finding 2)', () => {
        it('renders the 3 section headings in document order with right-aligned badges', (done) => {
            // baseScenario: terrain(3)+boundary(4)+inflow(5) all set → Required
            // 3/3 (is-ok). No friction/structure/mesh_region → Optional 0/3
            // (advanced never errs, so is-ok too). status 'built' → Run 'built'.
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} canEdit />,
                container,
                () => {
                    const heads = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-title');
                    expect(heads.length).toBe(3);
                    expect(heads[0].textContent).toInclude('hydrata.anuga.requiredInputs');
                    expect(heads[1].textContent).toInclude('hydrata.anuga.optionalInputs');
                    expect(heads[2].textContent).toInclude('hydrata.anuga.run');

                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    expect(badges.length).toBe(3);
                    expect(badges[0].textContent).toBe('3/3');
                    expect(badges[0].className).toInclude('is-ok');
                    expect(badges[1].textContent).toBe('0/3');
                    expect(badges[2].textContent).toBe('built');
                    done();
                }
            );
        });

        it('Run badge shows 100% for a complete scenario (operator UAT example)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={{...baseScenario, status: 'complete'}} selectedCategoryId={'inputs'} canEdit />,
                container,
                () => {
                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    expect(badges[2].textContent).toBe('100%');
                    expect(badges[2].className).toInclude('is-ok');
                    done();
                }
            );
        });

        it('Required badge reads 0/3 with is-err severity for an empty scenario', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={{id: 1, name: 'empty'}} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    expect(badges[0].textContent).toBe('0/3');
                    expect(badges[0].className).toInclude('is-err');
                    done();
                }
            );
        });

        // TASK-2244 (epic 2237 W2.2) — the run-category 'err' badge is now
        // suppressed at RENDER level (validateCategoryProgress itself still
        // computes severity:'err' underneath — pinned, untouched; see
        // scenarioHelpers-test.js). The title pill (toolbar) + the
        // Run-failed notice are the sole error indicators now — see
        // 'Error consolidation (TASK-2244)' below for both.
        it('suppresses the Run badge (no "err" pill) when scenario.status === error', (done) => {
            const s = {...baseScenario, status: 'error', latest_run: {status: 'error'}};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    // Required + Optional badges still render (2); the 3rd
                    // (Run) badge is gone, not merely relabelled.
                    expect(badges.length).toBe(2);
                    expect(container.querySelector('.sv-anuga-scenario-pane-detail-head-badge.is-err')).toNotExist();
                    done();
                }
            );
        });

        // TASK-2045 (moved from the now-deleted scenarioCategoryRail-test.js) —
        // a boundary must be SELECTED *and* have at least one feature; the
        // badge must reuse the same boundaryHasFeatures gate the rail did.
        it('Required badge reads 2/3 (not ready) when the selected boundary has has_features=false (TASK-2045)', (done) => {
            const s = {...baseScenario, boundary: 42};
            ReactDOM.render(
                <ScenarioPane
                    scenario={s}
                    selectedCategoryId={'inputs'}
                    boundaries={[{id: 42, title: 'Empty scaffold boundary', has_features: false}]}
                />,
                container,
                () => {
                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    expect(badges[0].textContent).toBe('2/3');
                    done();
                }
            );
        });

        it('Required badge reads 3/3 (backward-safe default) when the boundaries list has not loaded yet', (done) => {
            const s = {...baseScenario, boundary: 42};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const badges = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-badge');
                    expect(badges[0].textContent).toBe('3/3');
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // TASK-2114 (A+B) — merged single-panel body
    // ------------------------------------------------------------------
    describe('Merged single-panel body (TASK-2114)', () => {
        it('renders Inputs, Advanced and Run fields simultaneously regardless of selectedCategoryId', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    // Deliberately 'advanced' — under the OLD tab-gated pane this
                    // would have hidden #terrain and #resolution. The merge means
                    // every field renders no matter which rail item is "selected".
                    selectedCategoryId={'advanced'}
                    canEdit
                    terrain={terrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    rainfalls={rainfallOpts}
                    frictions={frictionOpts}
                    structures={structureOpts}
                    meshRegions={meshRegionOpts}
                    isStaff
                    availableComputeTargets={['local', 'batch-x32']}
                    defaultComputeTarget={'batch-x32'}
                />,
                container,
                () => {
                    // Inputs
                    expect(container.querySelector('#name')).toExist();
                    expect(container.querySelector('#terrain')).toExist();
                    expect(container.querySelector('#boundary')).toExist();
                    expect(container.querySelector('#inflow')).toExist();
                    expect(container.querySelector('#rainfall')).toExist();
                    // Advanced
                    expect(container.querySelector('#friction')).toExist();
                    expect(container.querySelector('#structure')).toExist();
                    expect(container.querySelector('#mesh_region')).toExist();
                    // Run (TASK-2194: staff compute-target selector)
                    expect(container.querySelector('#resolution')).toExist();
                    expect(container.querySelector('#duration-hours')).toExist();
                    expect(container.querySelector('#duration-minutes')).toExist();
                    expect(container.querySelector('#compute_target')).toExist();
                    done();
                }
            );
        });

        // The 3-heading document-order assertion (+ its badges) now lives in
        // 'Section-heading completeness badges (finding 2)' above, next to
        // the rest of the badge coverage it was split off to avoid.

        // Dogfood finding B — the per-selector "selected layer" confirmation
        // card is removed; the native <select>'s own displayed value is the
        // only indication of what's chosen.
        it('does NOT render any .sv-anuga-scenario-resource-summary card anywhere in the pane', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'inputs'}
                    canEdit
                    terrain={terrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    rainfalls={rainfallOpts}
                    frictions={frictionOpts}
                    structures={structureOpts}
                    meshRegions={meshRegionOpts}
                />,
                container,
                () => {
                    expect(container.querySelectorAll('.sv-anuga-scenario-resource-summary').length).toBe(0);
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Inputs pane (Pane 3)
    // ------------------------------------------------------------------
    describe('Inputs pane', () => {
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

        // TASK-2114 (dogfood finding B) — the per-selector resource-summary card
        // is removed; coverage that NO such card renders anywhere lives in the
        // 'Merged single-panel body' block above (it's no longer an Inputs-only
        // concern once Advanced's friction/structure/mesh_region also drop theirs).

        // TASK-2083 (epic 2077) — inflow-row empty-state helper. Explains that
        // an Inflow (the layer) can hold multiple inflow locations (features
        // inside it), each with its own hydrograph.
        describe('Inflow row multi-location helper (TASK-2083)', () => {
            it('renders the helper when the scenario has no inflow assigned', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, inflow: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        // TASK-2114 — scoped to the Inputs rows wrapper: the Run
                        // section's runConfigHelp text (always present now that
                        // sections no longer gate on selectedCategoryId) shares
                        // the same generic .sv-anuga-scenario-pane-help class.
                        const help = container.querySelector(
                            '.sv-anuga-scenario-pane-rows-inputs .sv-anuga-scenario-pane-help'
                        );
                        expect(help).toExist();
                        expect(help.textContent).toInclude('hydrata.anuga.inflowMultiLocationHelp');
                        done();
                    }
                );
            });

            it('omits the helper once the scenario has an inflow assigned', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario /* inflow: 5, assigned */}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        // TASK-2114 — scoped to Inputs; the Run section's own
                        // (unrelated) help text still renders elsewhere in the
                        // merged panel.
                        const help = container.querySelector(
                            '.sv-anuga-scenario-pane-rows-inputs .sv-anuga-scenario-pane-help'
                        );
                        expect(help).toNotExist();
                        done();
                    }
                );
            });
        });

        // TASK-2160 (epic 2147 W4) — drawn-but-unattached Rainfall hint, the
        // direct MeshRegion analog (renders near the Rainfall select in the
        // Inputs section). 3 states: unattached→hint, none-drawn→no hint,
        // attached→no hint.
        describe('Rainfall unattached hint (TASK-2160)', () => {
            it('renders the hint naming the rainfall when ≥1 drawn rainfall exists and rainfall is null', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        const hint = container.querySelector('.sv-anuga-scenario-rainfall-unattached-hint');
                        expect(hint).toExist();
                        expect(hint.getAttribute('role')).toBe('status');
                        expect(hint.textContent).toInclude('hydrata.anuga.rainfallUnattachedHint');
                        done();
                    }
                );
            });

            it('omits the hint when no rainfalls are drawn in the project', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={[]}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-unattached-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the hint once a drawn rainfall is attached to the scenario', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: 6}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-unattached-hint')).toNotExist();
                        done();
                    }
                );
            });
        });

        // TASK-2189 (epic 2147 W6) — attached-but-empty Rainfall hint, the
        // complement of TASK-2160's unattached hint: a rainfall IS attached
        // but RainfallSerializerV2.has_feature_data reports no feature on the
        // resource carries data_constant/data_timeseries_id.
        describe('Rainfall attached-but-empty hint (TASK-2189)', () => {
            const emptyRainfallOpts = [{id: 6, title: 'Default Rainfall', has_feature_data: false}];
            const dataRainfallOpts = [{id: 6, title: 'Default Rainfall', has_feature_data: true}];

            it('renders the distinct hint when the attached rainfall has no feature data', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: 6}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={emptyRainfallOpts}
                    />,
                    container,
                    () => {
                        const hint = container.querySelector('.sv-anuga-scenario-rainfall-attached-empty-hint');
                        expect(hint).toExist();
                        expect(hint.getAttribute('role')).toBe('status');
                        expect(hint.textContent).toInclude('hydrata.anuga.rainfallAttachedEmptyHint');
                        // Distinct from the unattached hint — both must never
                        // render at once (mutually exclusive: this fires only
                        // when a rainfall IS attached).
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-unattached-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the hint when the attached rainfall has feature data', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: 6}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={dataRainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-attached-empty-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the hint when no rainfall is attached (even if the drawn one is empty)', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={emptyRainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-attached-empty-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the hint when has_feature_data is undefined (never fabricate from missing data)', (done) => {
                const staleRainfallOpts = [{id: 6, title: 'Default Rainfall'}];
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, rainfall: 6}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={staleRainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-rainfall-attached-empty-hint')).toNotExist();
                        done();
                    }
                );
            });
        });

        // TASK-2085 (epic-2077, part (b)) — pre-build warning when the
        // scenario's inflow-location series have mismatched first-timestamp
        // anchors (scenario.inflow_anchor_mismatch, BE-computed).
        describe('Inflow anchor-mismatch warning (TASK-2085)', () => {
            const mismatchedScenario = {
                ...baseScenario,
                inflow_anchor_mismatch: {
                    series: [
                        {timeseries_id: 101, name: 'Hydrograph A', first_timestamp: '2000-01-01T00:00:00.000'},
                        {timeseries_id: 102, name: 'Hydrograph B', first_timestamp: '2000-01-01T01:00:00.000'}
                    ]
                }
            };

            it('AC2 (mismatched): renders a visible warning (bare render, no intl — raw msgId fallback)', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={mismatchedScenario}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        const warning = container.querySelector('.sv-anuga-scenario-anchor-mismatch-warning');
                        expect(warning).toExist();
                        expect(warning.getAttribute('role')).toBe('alert');
                        expect(warning.textContent).toInclude('hydrata.anuga.inflowAnchorMismatchWarning');
                        done();
                    }
                );
            });

            // Mounts through the real Localized wrapper (IntlProvider), seeded with
            // the REAL en-US translation file (mirrors terrainUploadCrsPanel-test.js's
            // mountLocalized pattern) — proves the {names} msgParam actually threads
            // through to FormattedMessage and interpolates BOTH series names, not
            // just that the msgId was passed. The plain bare-render test above
            // cannot prove this (Message.jsx's no-intl fallback ignores msgParams).
            it('AC2 (mismatched, localized): interpolated copy names BOTH series', (done) => {
                ReactDOM.render(
                    <Localized locale="en-US" messages={enData.messages}>
                        <ScenarioPane
                            scenario={mismatchedScenario}
                            selectedCategoryId={'inputs'}
                            canEdit
                            terrain={terrainOpts}
                            boundaries={boundaryOpts}
                            inflows={inflowOpts}
                            rainfalls={rainfallOpts}
                        />
                    </Localized>,
                    container,
                    () => {
                        const warning = container.querySelector('.sv-anuga-scenario-anchor-mismatch-warning');
                        expect(warning).toExist();
                        // No raw msgId leaking into the rendered copy.
                        expect(warning.textContent).toNotMatch(/inflowAnchorMismatchWarning/);
                        expect(warning.textContent).toInclude('Hydrograph A');
                        expect(warning.textContent).toInclude('Hydrograph B');
                        done();
                    }
                );
            });

            it('AC2 (matched): omits the warning when inflow_anchor_mismatch is null', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, inflow_anchor_mismatch: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-anchor-mismatch-warning')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the warning when the field is simply absent (legacy/older scenario payload)', (done) => {
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
                        expect(container.querySelector('.sv-anuga-scenario-anchor-mismatch-warning')).toNotExist();
                        done();
                    }
                );
            });
        });

        // TASK-2205 (W0.2 epic 2204) — a fine survey with declared coverage
        // gaps (has_coverage_gaps: true, TerrainSerializerV2) suggests the
        // existing Combined-surface merge instead of leaving the user to
        // discover the gap ~2 hours later at build (dogfood run 1283).
        describe('Terrain coverage gap suggestion (TASK-2205)', () => {
            const gappyTerrainOpts = [
                {id: 3, title: 'Gappy Survey', status: 'ready', has_coverage_gaps: true},
                {id: 4, title: 'Other Terrain', status: 'ready', has_coverage_gaps: false}
            ];

            it('renders the suggestion + merge link when the selected terrain has coverage gaps', (done) => {
                let opened = false;
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={gappyTerrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                        onOpenMergeTerrainsPanel={() => { opened = true; }}
                    />,
                    container,
                    () => {
                        const suggestion = container.querySelector('.sv-anuga-scenario-terrain-gap-suggestion');
                        expect(suggestion).toExist();
                        expect(suggestion.getAttribute('role')).toBe('alert');
                        const link = container.querySelector('[data-testid="anuga-terrain-gap-suggestion-merge-link"]');
                        expect(link).toExist();
                        Simulate.click(link);
                        expect(opened).toBe(true, 'clicking the suggestion link opens the Combined-surface merge panel');
                        done();
                    }
                );
            });

            it('omits the suggestion when the selected terrain has no coverage gaps', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, terrain: 4}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={gappyTerrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-terrain-gap-suggestion')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the suggestion when no terrain is selected yet', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, terrain: null}}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={gappyTerrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-terrain-gap-suggestion')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the suggestion when has_coverage_gaps is null (legacy/unstamped terrain)', (done) => {
                const legacyTerrainOpts = [{id: 3, title: 'Legacy Survey', status: 'ready', has_coverage_gaps: null}];
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={legacyTerrainOpts}
                        boundaries={boundaryOpts}
                        inflows={inflowOpts}
                        rainfalls={rainfallOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-terrain-gap-suggestion')).toNotExist();
                        done();
                    }
                );
            });
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

        // Wave 3B (B4) — read-only visual: each field wrapper gets
        // .is-readonly when canEdit=false, plus a top-of-pane lock hint.
        describe('Wave 3B B4 — read-only visual', () => {
            it('tags every Inputs field wrapper with .is-readonly when canEdit=false', (done) => {
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
                        // TASK-2114 — scoped to the Inputs section's own rows
                        // wrapper: Advanced + Run now coexist in the DOM (their
                        // fields are ALSO .is-readonly when canEdit=false), so a
                        // document-wide count would no longer isolate Inputs alone.
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-rows-inputs .sv-anuga-scenario-pane-field.is-readonly'
                        );
                        // name + terrain + boundary + inflow + rainfall = 5 wrappers.
                        expect(readonlyWrappers.length).toBe(5);
                        done();
                    }
                );
            });

            it('omits .is-readonly from field wrappers when canEdit=true', (done) => {
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
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-field.is-readonly'
                        );
                        expect(readonlyWrappers.length).toBe(0);
                        done();
                    }
                );
            });

            it('renders the read-only hint at the top of the pane when canEdit=false', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'inputs'}
                        terrain={terrainOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-pane-readonly-hint')).toExist();
                        done();
                    }
                );
            });

            it('omits the read-only hint when canEdit=true', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'inputs'}
                        canEdit
                        terrain={terrainOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-pane-readonly-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('does NOT render the read-only hint on the empty pane (no scenario)', (done) => {
                ReactDOM.render(
                    <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-pane-readonly-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('disables the terrain select when canEdit=false', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'inputs'}
                        terrain={terrainOpts}
                    />,
                    container,
                    () => {
                        const sel = container.querySelector('#terrain');
                        expect(sel.disabled).toBe(true);
                        done();
                    }
                );
            });

            it('tags Run config wrappers with .is-readonly when canEdit=false (staff sees 3, non-staff sees 2)', (done) => {
                // TASK-2194: compute_target only rendered for staff (with a
                // non-empty allowlist). Non-staff: resolution + duration = 2
                // wrappers.
                // TASK-2114 — scoped to the Run-config rows wrapper so Inputs'
                // and Advanced's now-coexisting .is-readonly wrappers don't
                // inflate the count.
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        isStaff={false}
                    />,
                    container,
                    () => {
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-rows-run-config .sv-anuga-scenario-pane-field.is-readonly'
                        );
                        // resolution + duration = 2 wrappers (compute_target hidden for non-staff).
                        expect(readonlyWrappers.length).toBe(2);
                        done();
                    }
                );
            });
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

    // ------------------------------------------------------------------
    // Advanced pane (Pane 3)
    // ------------------------------------------------------------------
    describe('Advanced pane', () => {
        // TASK-1412 (ISSUE 20.3): network row removed; 3 dropdowns remain.
        it('renders 3 dropdowns (network removed per ISSUE 20.3)', (done) => {
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
                    expect(container.querySelector('#network')).toNotExist();
                    done();
                }
            );
        });

        // TASK-2114 — resolution/duration now DO render on the page (the merge
        // stacks every section), but they still structurally belong to Run,
        // not Advanced: scope the query to Advanced's own rows wrapper.
        it('does NOT render resolution or duration inside the Advanced section (they live in Run config)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'advanced'}
                    canEdit
                />,
                container,
                () => {
                    const advanced = container.querySelector('.sv-anuga-scenario-pane-rows-advanced');
                    expect(advanced).toExist();
                    expect(advanced.querySelector('#resolution')).toNotExist();
                    expect(advanced.querySelector('#duration-hours')).toNotExist();
                    expect(advanced.querySelector('#duration-minutes')).toNotExist();
                    // ...but the merged panel as a whole does render them (Run section).
                    expect(container.querySelector('#resolution')).toExist();
                    done();
                }
            );
        });

        // TASK-2116 (F4) — drawn-but-unattached MeshRegion hint. 3 states per AC4.
        describe('MeshRegion unattached hint (TASK-2116)', () => {
            it('renders the hint naming the region when ≥1 drawn region exists and mesh_region is null', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, mesh_region: null}}
                        selectedCategoryId={'advanced'}
                        canEdit
                        meshRegions={meshRegionOpts}
                    />,
                    container,
                    () => {
                        const hint = container.querySelector('.sv-anuga-scenario-mesh-region-unattached-hint');
                        expect(hint).toExist();
                        expect(hint.getAttribute('role')).toBe('status');
                        expect(hint.textContent).toInclude('hydrata.anuga.meshRegionUnattachedHint');
                        done();
                    }
                );
            });

            it('omits the hint when no mesh regions are drawn in the project', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, mesh_region: null}}
                        selectedCategoryId={'advanced'}
                        canEdit
                        meshRegions={[]}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-mesh-region-unattached-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('omits the hint once a drawn mesh region is attached to the scenario', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, mesh_region: 9}}
                        selectedCategoryId={'advanced'}
                        canEdit
                        meshRegions={meshRegionOpts}
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-mesh-region-unattached-hint')).toNotExist();
                        done();
                    }
                );
            });
        });
    });

    // ------------------------------------------------------------------
    // Run config pane (Pane 3) — NEW
    // ------------------------------------------------------------------
    describe('Run config pane', () => {
        // TASK-2194 (epic 2190 W2) — staff-gated compute-target selector.
        // Non-staff DOM must contain NO selector at all (epic invariant),
        // even when the site allowlist is populated.
        it('non-staff DOM contains no compute-target selector (TASK-2194)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff={false}
                    availableComputeTargets={['local', 'batch-x32', 'batch-gpu-a10g']}
                    defaultComputeTarget={'batch-x32'}
                />,
                container,
                () => {
                    expect(container.querySelector('#resolution')).toExist();
                    expect(container.querySelector('#duration-hours')).toExist();
                    expect(container.querySelector('#duration-minutes')).toExist();
                    expect(container.querySelector('#compute_target')).toNotExist();
                    // the retired superuser local/batch selector must be gone too
                    expect(container.querySelector('#compute_backend')).toNotExist();
                    done();
                }
            );
        });

        it('renders the allowlist verbatim for staff, default marked "(site default)" (TASK-2194)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff
                    availableComputeTargets={['local', 'batch-x32', 'batch-gpu-a10g']}
                    defaultComputeTarget={'batch-x32'}
                />,
                container,
                () => {
                    const sel = container.querySelector('#compute_target');
                    expect(sel).toExist();
                    const opts = Array.from(container.querySelectorAll('#compute_target option'));
                    // option VALUES are the allowlist targets verbatim, in order
                    expect(opts.map(o => o.value)).toEqual(['local', 'batch-x32', 'batch-gpu-a10g']);
                    // plain descriptive labels; the site default is marked; NO
                    // cost/duration estimates anywhere in the labels
                    expect(opts.map(o => o.textContent)).toEqual([
                        'Local box',
                        'AWS Batch — 32 vCPU (site default)',
                        'AWS Batch — GPU A10G'
                    ]);
                    // nothing chosen -> the select shows the site default
                    expect(sel.value).toBe('batch-x32');
                    done();
                }
            );
        });

        it('hides the selector entirely for staff when the allowlist is EMPTY or unloaded (TASK-2194)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff
                    availableComputeTargets={[]}
                    defaultComputeTarget={null}
                />,
                container,
                () => {
                    expect(container.querySelector('#compute_target')).toNotExist();
                    // unloaded config (null allowlist) hides it too
                    ReactDOM.render(
                        <ScenarioPane
                            scenario={baseScenario}
                            selectedCategoryId={'runConfig'}
                            canEdit
                            isStaff
                            availableComputeTargets={null}
                        />,
                        container,
                        () => {
                            expect(container.querySelector('#compute_target')).toNotExist();
                            done();
                        }
                    );
                }
            );
        });

        it('an unknown target renders its raw name (never fabricated labels) (TASK-2194)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff
                    availableComputeTargets={['batch-x64-future']}
                    defaultComputeTarget={'batch-x64-future'}
                />,
                container,
                () => {
                    const opts = Array.from(container.querySelectorAll('#compute_target option'));
                    expect(opts.map(o => o.textContent)).toEqual(['batch-x64-future (site default)']);
                    done();
                }
            );
        });

        // TASK-2093 (epic 2092 W1.1) — the "$5237" bug: compute_cost_estimate
        // used to be raw vCPU-hours mislabeled as a cost, printed as
        // '~$X.XX vCPU-h' (both units on one number). BE now returns a
        // genuine dollar figure; the pane must render ONE consistent dollar
        // amount with no 'vCPU-h' unit suffix.
        it('TASK-2093: renders one dollar figure for compute_cost_estimate, no vCPU-h suffix', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, mesh_triangle_count_estimate: 123456, compute_cost_estimate: 5237.42}}
                    selectedCategoryId={'runConfig'}
                    canEdit
                />,
                container,
                () => {
                    const label = container.querySelector('.sv-anuga-scenario-estimate-label');
                    expect(label).toBeTruthy();
                    expect(label.textContent).toContain('$5237.42');
                    expect(label.textContent.includes('vCPU-h')).toBe(false);
                    done();
                }
            );
        });

        it('resolution value matches scenario.resolution', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
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

        // TASK-2210 (W3.1, epic 2204, od-2) — honest relabel (AC#1): the
        // field must stop implying a global uniform size. Mounted through
        // the real Localized wrapper (real en-US translations) so this
        // proves the RENDERED copy, not just that a msgId was passed.
        it('TASK-2210: Resolution field is honestly relabeled "Base mesh size"', (done) => {
            ReactDOM.render(
                <Localized locale="en-US" messages={enData.messages}>
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />
                </Localized>,
                container,
                () => {
                    const label = container.querySelector('label[for="resolution"]');
                    expect(label).toExist();
                    expect(label.textContent).toInclude('Base mesh size');
                    // TASK-2242 (epic 2237 W1.4) — the run-config help caption that
                    // used to explain WHY here (refinement inputs mesh finer than
                    // this) is REMOVED from the pane; that honesty story now lives
                    // in the Build / Build-and-Run executable tooltips (header
                    // strip) instead, which additionally echo the live estimate.
                    done();
                }
            );
        });

        // TASK-2242 (epic 2237 W1.4) — regression guard: the removed runConfigHelp
        // paragraph must not silently come back in this pane.
        it('TASK-2242: does not render the removed run-config help caption in the Run section', (done) => {
            ReactDOM.render(
                <Localized locale="en-US" messages={enData.messages}>
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />
                </Localized>,
                container,
                () => {
                    const runSection = container.querySelector('.sv-anuga-scenario-pane-rows-run');
                    expect(runSection).toExist();
                    expect(runSection.querySelector('.sv-anuga-scenario-pane-section--help')).toNotExist();
                    expect((runSection.textContent || '').toLowerCase()).toNotInclude('mesh finer wherever');
                    done();
                }
            );
        });

        // TASK-2210 (W3.1, AC#2) — pre-build cost-driver hint.
        describe('TASK-2210 mesh cost-driver hint', () => {
            it('renders the amber hint when mesh regions dominate the estimate', (done) => {
                ReactDOM.render(
                    <Localized locale="en-US" messages={enData.messages}>
                        <ScenarioPane
                            scenario={{
                                ...baseScenario,
                                mesh_triangle_count_estimate_breakdown: {
                                    base: 150, regions: 850, hole_perimeter: 0, breaklines: 0, total: 1000
                                }
                            }}
                            selectedCategoryId={'runConfig'}
                            canEdit
                        />
                    </Localized>,
                    container,
                    () => {
                        const hint = container.querySelector('.sv-anuga-scenario-mesh-cost-driver-hint');
                        expect(hint).toExist();
                        expect(hint.textContent).toInclude('85%');
                        expect(hint.textContent.toLowerCase()).toInclude('mesh regions');
                        done();
                    }
                );
            });

            it('does not render when the base term dominates (the expected/unsurprising case)', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{
                            ...baseScenario,
                            mesh_triangle_count_estimate_breakdown: {
                                base: 900, regions: 100, hole_perimeter: 0, breaklines: 0, total: 1000
                            }
                        }}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-mesh-cost-driver-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('does not render when there is no breakdown (resolution unset / legacy row)', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{...baseScenario, mesh_triangle_count_estimate_breakdown: null}}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-mesh-cost-driver-hint')).toNotExist();
                        done();
                    }
                );
            });
        });

        // TASK-2210 (W3.1, AC#3) — post-build actual-vs-estimate comparison.
        describe('TASK-2210 post-build mesh comparison', () => {
            it('renders actual vs estimate + re-priced cost once a run has built', (done) => {
                ReactDOM.render(
                    <Localized locale="en-US" messages={enData.messages}>
                        <ScenarioPane
                            scenario={{
                                ...baseScenario,
                                latest_run: {
                                    mesh_triangle_count: 250000,
                                    mesh_provenance: {pre_build_triangle_estimate: 100000},
                                    mesh_actual_cost_estimate: 45.2
                                }
                            }}
                            selectedCategoryId={'runConfig'}
                            canEdit
                        />
                    </Localized>,
                    container,
                    () => {
                        const comparison = container.querySelector('.anuga-scenario-mesh-comparison-section');
                        expect(comparison).toExist();
                        expect(comparison.textContent).toInclude('250,000');
                        expect(comparison.textContent).toInclude('100,000');
                        expect(comparison.textContent).toInclude('$45.20');
                        done();
                    }
                );
            });

            it('degrades gracefully (renders nothing) when mesh_provenance is an empty object (failed build)', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={{
                            ...baseScenario,
                            latest_run: {mesh_triangle_count: 0, mesh_provenance: {}}
                        }}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.anuga-scenario-mesh-comparison-section')).toNotExist();
                        done();
                    }
                );
            });

            it('degrades gracefully (renders nothing) when there is no latest_run at all', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        canEdit
                    />,
                    container,
                    () => {
                        expect(container.querySelector('.anuga-scenario-mesh-comparison-section')).toNotExist();
                        done();
                    }
                );
            });
        });

        it('changing resolution dispatches onUpdateScenario with parsed float', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
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

        it('K4: empty resolution input does not dispatch (preserves last value)', (done) => {
            let dispatched = false;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    onUpdateScenario={() => { dispatched = true; }}
                />,
                container,
                () => {
                    const input = container.querySelector('#resolution');
                    Simulate.change(input, {target: {value: ''}});
                    expect(dispatched).toBe(false);
                    done();
                }
            );
        });

        it('K4: non-numeric resolution input does not dispatch NaN', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    const input = container.querySelector('#resolution');
                    Simulate.change(input, {target: {value: 'abc'}});
                    expect(captured).toBe(null);
                    done();
                }
            );
        });

        // UAT #9 — duration is now two dropdowns (Hours + Minutes). The stored
        // field is still scenario.duration in SECONDS; 1800s → 0h 30m.
        it('duration dropdowns reflect scenario.duration (1800s → 0h / 30m)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('#duration-hours').value).toBe('0');
                    expect(container.querySelector('#duration-minutes').value).toBe('30');
                    done();
                }
            );
        });

        it('changing the hours dropdown dispatches duration in seconds (1h + 30m = 5400s)', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    const hours = container.querySelector('#duration-hours');
                    Simulate.change(hours, {target: {value: '1'}});
                    expect(captured.duration).toBe(5400);
                    done();
                }
            );
        });

        it('changing the minutes dropdown dispatches duration in seconds (0h + 45m = 2700s)', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    const minutes = container.querySelector('#duration-minutes');
                    Simulate.change(minutes, {target: {value: '45'}});
                    expect(captured.duration).toBe(2700);
                    done();
                }
            );
        });

        // TASK-2194 (review fix): choosing a target dispatches the SESSION
        // slot setter (onSetSessionComputeTarget) and must NEVER go through
        // onUpdateScenario — UPDATE_ANUGA_SCENARIO unconditionally flips
        // scenario.unsaved, which detoured the next Build-and-Run into
        // dispatchBuild's save-only branch (no build, no run) and the save
        // round-trip then wiped the choice.
        it('compute_target select dispatches onSetSessionComputeTarget and NOT onUpdateScenario (staff)', (done) => {
            const sessionCalls = [];
            const updateCalls = [];
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff
                    availableComputeTargets={['local', 'batch-x32', 'batch-gpu-a10g']}
                    defaultComputeTarget={'batch-x32'}
                    onSetSessionComputeTarget={(s, target) => sessionCalls.push({scenario: s, target})}
                    onUpdateScenario={(s, kv) => updateCalls.push(kv)}
                />,
                container,
                () => {
                    const sel = container.querySelector('#compute_target');
                    Simulate.change(sel, {target: {value: 'batch-gpu-a10g'}});
                    expect(sessionCalls.length).toBe(1);
                    expect(sessionCalls[0].target).toBe('batch-gpu-a10g');
                    expect(sessionCalls[0].scenario.id).toBe(baseScenario.id);
                    // the scenario-object update contract is NOT used
                    expect(updateCalls.length).toBe(0);
                    done();
                }
            );
        });

        // TASK-2194 (review fix): the select's VALUE rides the ui slot
        // (sessionComputeTarget prop), not scenario.compute_target — so a
        // save/refresh replacing the scenario object cannot snap the select
        // back to the site default.
        it('select shows the session choice when set, independent of the scenario object', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isStaff
                    availableComputeTargets={['local', 'batch-x32', 'batch-gpu-a10g']}
                    defaultComputeTarget={'batch-x32'}
                    sessionComputeTarget={'local'}
                />,
                container,
                () => {
                    expect(container.querySelector('#compute_target').value).toBe('local');
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // TASK-2243 (epic 2237 W2.1) — the notices panel: single collapsible
    // amber advisory surface between the toolbar and the Required-inputs
    // section. Drives all 7 member notices individually + shell mechanics
    // (count string, N=0 hidden, default-open, collapse toggle aria) +
    // regression coverage that the explicit NON-members (mesh cost-driver
    // hint, post-build actual-vs-estimate comparison, read-only pane hint)
    // still render field-adjacent in their current homes, NOT inside the
    // panel.
    // ------------------------------------------------------------------
    describe('Notices panel (TASK-2243)', () => {
        it('is hidden entirely (N=0) when the scenario has nothing to advise on', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} canEdit />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-notices-panel')).toNotExist();
                    done();
                }
            );
        });

        it('shows the "{N} notices" header, defaults open, and toggles collapse via aria-expanded', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, mesh_region: null}}
                    canEdit
                    meshRegions={meshRegionOpts}
                />,
                container,
                () => {
                    const panel = container.querySelector('.sv-anuga-notices-panel');
                    expect(panel).toExist();
                    expect(panel.className).toInclude('is-open');
                    const header = panel.querySelector('.sv-anuga-notices-panel-header');
                    expect(header.getAttribute('aria-expanded')).toBe('true');
                    // Bare render (no intl context) — Message.jsx falls back
                    // to the raw msgId; see the localized test below for the
                    // actual "{count} notices" interpolation proof.
                    expect(header.textContent).toInclude('hydrata.anuga.noticesPanelHeader');

                    // The click + its assertions run in a SEPARATE tick: this
                    // callback is itself invoked from inside React's mount
                    // commit call stack (commitLayoutEffects), and a state
                    // update dispatched from THERE is applied once that
                    // commit unwinds — not synchronously within this same
                    // callback. setTimeout(0) gets us outside of it, matching
                    // how the rest of the suite drives click-then-assert
                    // (e.g. anugaScenarioMenu-test.js's openKebab helper,
                    // which clicks from plain top-level test code, never
                    // nested inside a render callback).
                    setTimeout(() => {
                        header.click();
                        setTimeout(() => {
                            expect(panel.className).toNotInclude('is-open');
                            expect(header.getAttribute('aria-expanded')).toBe('false');
                            // Always-render + .is-open CSS-collapse
                            // convention — the notice itself stays mounted
                            // (queryable) through the collapse; only the
                            // wrapper's class flips.
                            expect(panel.querySelector('.sv-anuga-scenario-mesh-region-unattached-hint')).toExist();

                            header.click();
                            setTimeout(() => {
                                expect(panel.className).toInclude('is-open');
                                done();
                            }, 0);
                        }, 0);
                    }, 0);
                }
            );
        });

        // Mounts through the real Localized wrapper (IntlProvider), seeded
        // with the REAL en-US translation file (mirrors the anchor-mismatch
        // warning's own localized test above) — proves the {count} msgParam
        // actually threads through and grows as more notices activate,
        // which the bare-render fallback (raw msgId) cannot show.
        it('the header count grows (localized) as more member notices become active', (done) => {
            const oneNoticeScenario = {...baseScenario, mesh_region: null};
            const twoNoticeScenario = {
                ...baseScenario,
                mesh_region: null,
                inflow_anchor_mismatch: {
                    series: [
                        {timeseries_id: 101, name: 'Hydrograph A', first_timestamp: '2000-01-01T00:00:00.000'},
                        {timeseries_id: 102, name: 'Hydrograph B', first_timestamp: '2000-01-01T01:00:00.000'}
                    ]
                }
            };
            ReactDOM.render(
                <Localized locale="en-US" messages={enData.messages}>
                    <ScenarioPane
                        scenario={oneNoticeScenario}
                        canEdit
                        meshRegions={meshRegionOpts}
                    />
                </Localized>,
                container,
                () => {
                    const headerOne = container.querySelector('.sv-anuga-notices-panel-header');
                    expect(headerOne.textContent).toInclude('1 notices');
                    ReactDOM.render(
                        <Localized locale="en-US" messages={enData.messages}>
                            <ScenarioPane
                                scenario={twoNoticeScenario}
                                canEdit
                                meshRegions={meshRegionOpts}
                            />
                        </Localized>,
                        container,
                        () => {
                            const headerTwo = container.querySelector('.sv-anuga-notices-panel-header');
                            expect(headerTwo.textContent).toInclude('2 notices');
                            done();
                        }
                    );
                }
            );
        });

        // The 7-item inventory, each driven individually against the
        // notices panel (rather than their old field-adjacent homes, which
        // the earlier per-hint describes above now cover as pure-predicate
        // + msgId/role regressions on the RELOCATED markup).
        describe('7-item inventory — one member at a time', () => {
            it('results-freshness FAILED', (done) => {
                const s = {
                    ...baseScenario,
                    latest_run: {id: 2, status: 'error'},
                    latest_complete_run: {id: 1, status: 'complete'}
                };
                ReactDOM.render(
                    <ScenarioPane scenario={s} canEdit />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-results-freshness-failed-hint')).toExist();
                        done();
                    }
                );
            });

            it('results-freshness BUILDING', (done) => {
                const s = {
                    ...baseScenario,
                    latest_run: {id: 2, status: 'computing'},
                    latest_complete_run: {id: 1, status: 'complete'}
                };
                ReactDOM.render(
                    <ScenarioPane scenario={s} canEdit />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-results-freshness-building-hint')).toExist();
                        done();
                    }
                );
            });

            it('rainfall-unattached', (done) => {
                ReactDOM.render(
                    <ScenarioPane scenario={{...baseScenario, rainfall: null}} canEdit rainfalls={rainfallOpts} />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-rainfall-unattached-hint')).toExist();
                        done();
                    }
                );
            });

            it('rainfall-attached-empty', (done) => {
                const emptyRainfallOpts = [{id: 6, title: 'Default Rainfall', has_feature_data: false}];
                ReactDOM.render(
                    <ScenarioPane scenario={{...baseScenario, rainfall: 6}} canEdit rainfalls={emptyRainfallOpts} />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-rainfall-attached-empty-hint')).toExist();
                        done();
                    }
                );
            });

            it('meshregion-unattached', (done) => {
                ReactDOM.render(
                    <ScenarioPane scenario={{...baseScenario, mesh_region: null}} canEdit meshRegions={meshRegionOpts} />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-mesh-region-unattached-hint')).toExist();
                        done();
                    }
                );
            });

            it('inflow-anchor-mismatch', (done) => {
                const s = {
                    ...baseScenario,
                    inflow_anchor_mismatch: {
                        series: [
                            {timeseries_id: 101, name: 'Hydrograph A', first_timestamp: '2000-01-01T00:00:00.000'},
                            {timeseries_id: 102, name: 'Hydrograph B', first_timestamp: '2000-01-01T01:00:00.000'}
                        ]
                    }
                };
                ReactDOM.render(
                    <ScenarioPane scenario={s} canEdit />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        expect(panel.querySelector('.sv-anuga-scenario-anchor-mismatch-warning')).toExist();
                        done();
                    }
                );
            });

            it('terrain-coverage-gap (with its suggestion link)', (done) => {
                const gappyTerrainOpts = [{id: 3, title: 'Gappy Survey', status: 'ready', has_coverage_gaps: true}];
                let opened = false;
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        canEdit
                        terrain={gappyTerrainOpts}
                        onOpenMergeTerrainsPanel={() => { opened = true; }}
                    />,
                    container,
                    () => {
                        const panel = container.querySelector('.sv-anuga-notices-panel');
                        const suggestion = panel.querySelector('.sv-anuga-scenario-terrain-gap-suggestion');
                        expect(suggestion).toExist();
                        const link = panel.querySelector('[data-testid="anuga-terrain-gap-suggestion-merge-link"]');
                        expect(link).toExist();
                        Simulate.click(link);
                        expect(opened).toBe(true);
                        done();
                    }
                );
            });
        });

        // Non-members (design-pinned): explicit regression that these three
        // still render field-adjacent in their existing homes, NOT inside
        // the notices panel. (The 4th non-member, the build-conflict inline
        // span, lives in anugaScenarioMenu.js/anugaScenarioMenu-test.js, not
        // here.)
        describe('Non-members stay field-adjacent (regression)', () => {
            it('mesh cost-driver hint renders in the Run section, not the notices panel', (done) => {
                const s = {
                    ...baseScenario,
                    resolution: 500,
                    mesh_triangle_count_estimate_breakdown: {base: 10, regions: 90, hole_perimeter: 0, breaklines: 0, total: 100}
                };
                ReactDOM.render(
                    <ScenarioPane scenario={s} canEdit />,
                    container,
                    () => {
                        const hint = container.querySelector('.sv-anuga-scenario-mesh-cost-driver-hint');
                        expect(hint).toExist();
                        expect(container.querySelector('.sv-anuga-notices-panel')).toNotExist();
                        done();
                    }
                );
            });

            it('post-build actual-vs-estimate comparison renders in the Run section, not the notices panel', (done) => {
                const s = {
                    ...baseScenario,
                    latest_run: {
                        mesh_provenance: {pre_build_triangle_estimate: 1000},
                        mesh_triangle_count: 1200
                    }
                };
                ReactDOM.render(
                    <ScenarioPane scenario={s} canEdit />,
                    container,
                    () => {
                        expect(container.querySelector('.anuga-scenario-mesh-comparison-section')).toExist();
                        expect(container.querySelector('.sv-anuga-notices-panel')).toNotExist();
                        done();
                    }
                );
            });

            it('the read-only pane hint renders in its own place, not the notices panel', (done) => {
                ReactDOM.render(
                    <ScenarioPane scenario={baseScenario} canEdit={false} />,
                    container,
                    () => {
                        expect(container.querySelector('.sv-anuga-scenario-pane-readonly-hint')).toExist();
                        expect(container.querySelector('.sv-anuga-notices-panel')).toNotExist();
                        done();
                    }
                );
            });
        });
    });

    // ------------------------------------------------------------------
    // Status and actions pane (Pane 3)
    // ------------------------------------------------------------------
    describe('Status and actions pane', () => {
        it('renders the status card with the full status pill', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'built'}}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-status-card')).toExist();
                    // Pill renders inside the status card. TASK-2244
                    // (epic 2237 W2.2) — the toolbar's compact pill is now
                    // error-only (the title pill), so for a non-error status
                    // like 'built' the status card's pill is the ONLY one.
                    const pills = container.querySelectorAll('.sv-scenario-status-pill');
                    expect(pills.length).toBeGreaterThan(0);
                    done();
                }
            );
        });

        // UAT #8 — the Build/Run/Retry/Download/Archive/Delete action strip
        // moved UP to the Scenarios heading (ScenarioHeaderActions), so the Run
        // pane no longer renders the in-pane toolbar. Behaviour for those
        // buttons is covered by scenarioHeaderActions-test.js and the
        // analytics-parity suite (which drives them through the connected menu).
        it('does NOT render the in-pane action toolbar (moved to the heading, UAT #8)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-scenario-action-toolbar')).toNotExist();
                    expect(container.querySelector('.sv-scenario-action-build')).toNotExist();
                    expect(container.querySelector('.sv-scenario-action-delete')).toNotExist();
                    done();
                }
            );
        });

        // TASK-2244 (epic 2237 W2.2) — re-pointed: the error strip is no
        // longer a standalone render at the bottom of the Run pane; it's now
        // embedded (unmodified) as the Run-failed notice's body inside the
        // notices panel. Scoping the query to `.sv-anuga-notices-panel`
        // proves the relocation, not just that the strip exists SOMEWHERE.
        it('renders the error strip inside the notices panel when status === error', (done) => {
            const s = {
                ...baseScenario,
                status: 'error',
                latest_run: {status: 'error', error_message: 'mesh validation failed'}
            };
            ReactDOM.render(
                <ScenarioPane
                    scenario={s}
                    selectedCategoryId={'run'}
                    canEdit
                />,
                container,
                () => {
                    const panel = container.querySelector('.sv-anuga-notices-panel');
                    expect(panel).toExist();
                    expect(panel.querySelector('.sv-anuga-scenario-error-strip')).toExist();
                    done();
                }
            );
        });

        it('does NOT render the error strip when status is not error', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'built'}}
                    selectedCategoryId={'run'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // TASK-2244 (epic 2237 W2.2) — error consolidation: title pill + the
    // Run-failed notice. Exactly one standing indicator (the title pill)
    // plus the one notice for errored scenarios; neither for anything else.
    // ------------------------------------------------------------------
    describe('Error consolidation (TASK-2244)', () => {
        const erroredScenario = {
            ...baseScenario,
            status: 'error',
            latest_run: {status: 'error', error_message: 'mesh validation failed'}
        };

        it('renders the title pill (toolbar, compact, error-styled) only when the latest run errored', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={erroredScenario} selectedCategoryId={'run'} canEdit />,
                container,
                () => {
                    const pill = container.querySelector('.sv-anuga-pane-head-actions .sv-scenario-status-pill');
                    expect(pill).toExist();
                    expect(pill.className).toInclude('sv-status-error');
                    done();
                }
            );
        });

        it('renders no toolbar pill for a non-error status', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'built'}}
                    selectedCategoryId={'run'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-pane-head-actions')).toNotExist();
                    done();
                }
            );
        });

        it('renders the Run-failed notice hosting the error strip inside the notices panel', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={erroredScenario} selectedCategoryId={'run'} canEdit />,
                container,
                () => {
                    const panel = container.querySelector('.sv-anuga-notices-panel');
                    expect(panel).toExist();
                    const strip = panel.querySelector('.sv-anuga-scenario-error-strip');
                    expect(strip).toExist();
                    expect(strip.textContent).toInclude('mesh validation failed');
                    done();
                }
            );
        });

        it('renders no Run-failed notice for a non-error status', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'built'}}
                    selectedCategoryId={'run'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
                    done();
                }
            );
        });

        it('suppresses the Run-heading "err" badge for an errored scenario (render-level only)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={erroredScenario} selectedCategoryId={'run'} canEdit />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-pane-detail-head-badge.is-err')).toNotExist();
                    done();
                }
            );
        });

        // TASK-2221 (W5, epic 2204) — ScenarioErrorStrip resets logTailOpen
        // when the (scenario id, latest_run id) identity changes, not on
        // every re-render. Collapsing/expanding the notices panel does NOT
        // change that identity, so the always-render + .is-open CSS-collapse
        // convention (the panel body never unmounts) must let logTailOpen
        // survive a toggle — the whole point of embedding the strip rather
        // than re-implementing it.
        it('logTailOpen survives a notices-panel collapse/expand toggle', (done) => {
            const s = {
                ...erroredScenario,
                id: 21,
                latest_run: {id: 99, status: 'error', log: 'line1\nline2\nline3'}
            };
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'run'} canEdit />,
                container,
                () => {
                    const toggleLogTail = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
                    expect(toggleLogTail).toExist();

                    // Every click here is deferred a tick — see the comment
                    // in 'shows the "{N} notices" header...' above: a click
                    // dispatched from inside this mount-commit callback
                    // doesn't flush its state update until the callback's
                    // own call stack unwinds.
                    setTimeout(() => {
                        toggleLogTail.click();
                        setTimeout(() => {
                            expect(container.querySelector('.sv-log-viewer')).toExist();

                            // Collapse the notices panel, then re-expand it.
                            const panelHeader = container.querySelector('.sv-anuga-notices-panel-header');
                            panelHeader.click();
                            setTimeout(() => {
                                expect(container.querySelector('.sv-anuga-notices-panel').className).toNotInclude('is-open');
                                panelHeader.click();
                                setTimeout(() => {
                                    expect(container.querySelector('.sv-anuga-notices-panel').className).toInclude('is-open');
                                    // The log tail is still expanded — its own
                                    // state was never touched by the panel's
                                    // collapse/expand.
                                    expect(container.querySelector('.sv-log-viewer')).toExist();
                                    done();
                                }, 0);
                            }, 0);
                        }, 0);
                    }, 0);
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Inline ScenarioRunLog (rendered at bottom of Status-and-actions pane)
    // ------------------------------------------------------------------
    // The legacy `runLog` standalone pane was removed (along with the
    // .sv-scenario-action-open-task-monitor button). The log is now rendered
    // inline at the bottom of the Status-and-actions pane via a small
    // ScenarioRunLog component (<pre> auto-scrolled to bottom on log diff).
    describe('Inline ScenarioRunLog in Status-and-actions pane', () => {
        it('renders the log block with title + line count + <pre> textContent', (done) => {
            const s = {
                ...baseScenario,
                latest_run: {id: 99, log: 'hello\nworld', log_line_count: 2}
            };
            ReactDOM.render(
                <ScenarioPane
                    scenario={s}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const block = container.querySelector('.sv-anuga-scenario-pane-log');
                    expect(block).toExist();
                    const title = container.querySelector('.sv-anuga-scenario-pane-log-title');
                    // <Message> renders the msgId text in the test environment; the
                    // line count is appended in-component as ` (2)`.
                    expect(title.textContent).toInclude('(2)');
                    const pre = container.querySelector('pre.sv-anuga-scenario-pane-log-viewer');
                    expect(pre).toExist();
                    expect(pre.textContent).toBe('hello\nworld');
                    done();
                }
            );
        });

        it('renders an empty <pre> when latest_run is null', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, latest_run: null}}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.sv-anuga-scenario-pane-log-viewer');
                    expect(pre).toExist();
                    // The CSS :empty::before pseudo handles the placeholder copy;
                    // DOM textContent stays empty.
                    expect(pre.textContent).toBe('');
                    done();
                }
            );
        });

        it('renders an empty <pre> when latest_run.log is missing', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, latest_run: {id: 99, log_line_count: 0}}}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.sv-anuga-scenario-pane-log-viewer');
                    expect(pre).toExist();
                    expect(pre.textContent).toBe('');
                    done();
                }
            );
        });

        it('auto-scrolls <pre> to scrollHeight when log prop changes', (done) => {
            // jsdom does not lay out the <pre>, so scrollHeight is always 0 and
            // assigning to scrollTop gets clamped to (scrollHeight - clientHeight)
            // = 0. To verify the componentDidUpdate path actually fires, we
            // override BOTH properties on the DOM node with a mutable backing
            // store, then assert that scrollTop ended up at the synthetic
            // scrollHeight after the log prop changed.
            const initial = {
                ...baseScenario,
                latest_run: {id: 99, log: 'line1\nline2\nline3', log_line_count: 3}
            };
            ReactDOM.render(
                <ScenarioPane
                    scenario={initial}
                    selectedCategoryId={'run'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.sv-anuga-scenario-pane-log-viewer');
                    expect(pre).toExist();
                    // Backing store + getter/setter pair lets us record what
                    // componentDidUpdate wrote to scrollTop, sidestepping jsdom's
                    // layout-aware clamp.
                    let scrollTopStore = 0;
                    Object.defineProperty(pre, 'scrollHeight', {value: 4242, configurable: true});
                    Object.defineProperty(pre, 'scrollTop', {
                        configurable: true,
                        get() { return scrollTopStore; },
                        set(v) { scrollTopStore = v; }
                    });
                    const next = {
                        ...baseScenario,
                        latest_run: {id: 99, log: 'line1\nline2\nline3\nline4', log_line_count: 4}
                    };
                    ReactDOM.render(
                        <ScenarioPane
                            scenario={next}
                            selectedCategoryId={'run'}
                            canEdit canRunScenario
                        />,
                        container,
                        () => {
                            const preAfter = container.querySelector('pre.sv-anuga-scenario-pane-log-viewer');
                            // Same DOM node — getter/setter overrides survive.
                            expect(preAfter.scrollTop).toBe(4242);
                            expect(preAfter.scrollTop).toBe(preAfter.scrollHeight);
                            done();
                        }
                    );
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Empty / null scenario
    // ------------------------------------------------------------------
    describe('Empty / null scenario', () => {
        it('renders empty pane when scenario is null', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    expect(container.querySelector('.sv-anuga-scenario-empty-pane')).toExist();
                    // No input fields render.
                    expect(container.querySelector('#name')).toNotExist();
                    done();
                }
            );
        });

        // UAT re-aim finding 1 — the rail is gone entirely now, including
        // when no scenario is selected (there is nothing left to browse a
        // category of).
        it('does NOT render a category rail when scenario is null (rail removed)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    expect(container.querySelectorAll('.sv-anuga-scenario-category-item').length).toBe(0);
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // TASK-1410 (ISSUE 20.1): auto-populate Required dropdowns for new scenarios
    // ------------------------------------------------------------------
    describe('auto-populate defaults for new scenarios (TASK-1410)', () => {
        it('dispatches onUpdateScenario with first terrain + boundary + inflow for a new scenario', (done) => {
            // A new scenario has id===null (not yet saved).
            const newScenario = {
                id: null, _tempId: 'new_1', name: '', status: 'new', computed_status: 'created',
                terrain: null, boundary: null, inflow: null, rainfall: null,
                resolution: 1000, duration: null, unsaved: false
            };
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={newScenario}
                    selectedCategoryId={'inputs'}
                    canEdit
                    terrain={terrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    rainfalls={rainfallOpts}
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    setTimeout(() => {
                        // The hook fires asynchronously via useEffect; captured
                        // should contain the three required defaults.
                        expect(captured).toExist();
                        expect(captured.terrain).toBe(3);
                        expect(captured.boundary).toBe(4);
                        expect(captured.inflow).toBe(5);
                        done();
                    }, 20);
                }
            );
        });

        // TASK-2205 (W0.2 epic 2204) — prefer a full-coverage ready terrain over
        // a gappy fine survey when auto-defaulting a new scenario, so the
        // scenario is never silently seeded with a terrain that will fail the
        // build-time boundary check (dogfood run 1283 class).
        it('AC#2 (TASK-2205): prefers a full-coverage ready terrain over an earlier-listed gappy one', (done) => {
            const newScenario = {
                id: null, _tempId: 'new_2', name: '', status: 'new', computed_status: 'created',
                terrain: null, boundary: null, inflow: null, rainfall: null,
                resolution: 1000, duration: null, unsaved: false
            };
            // Gappy terrain listed FIRST (id 3) — a naive "first ready" pick
            // would choose it; the full-coverage terrain (id 4) must win.
            const mixedCoverageTerrainOpts = [
                {id: 3, title: 'Gappy Survey', status: 'ready', has_coverage_gaps: true},
                {id: 4, title: 'Full Coverage Base', status: 'ready', has_coverage_gaps: false}
            ];
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={newScenario}
                    selectedCategoryId={'inputs'}
                    canEdit
                    terrain={mixedCoverageTerrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    rainfalls={rainfallOpts}
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    setTimeout(() => {
                        expect(captured).toExist();
                        expect(captured.terrain).toBe(4, 'must default to the full-coverage terrain, not the earlier-listed gappy one');
                        done();
                    }, 20);
                }
            );
        });

        it('AC#2 (TASK-2205): falls back to the first ready terrain when ALL ready terrains are gappy', (done) => {
            const newScenario = {
                id: null, _tempId: 'new_3', name: '', status: 'new', computed_status: 'created',
                terrain: null, boundary: null, inflow: null, rainfall: null,
                resolution: 1000, duration: null, unsaved: false
            };
            const allGappyTerrainOpts = [
                {id: 3, title: 'Gappy Survey A', status: 'ready', has_coverage_gaps: true},
                {id: 4, title: 'Gappy Survey B', status: 'ready', has_coverage_gaps: true}
            ];
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={newScenario}
                    selectedCategoryId={'inputs'}
                    canEdit
                    terrain={allGappyTerrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    rainfalls={rainfallOpts}
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    setTimeout(() => {
                        expect(captured).toExist();
                        expect(captured.terrain).toBe(3, 'an all-gappy project still gets a usable default (first ready)');
                        done();
                    }, 20);
                }
            );
        });

        it('does NOT auto-populate for an existing saved scenario (preserves intentionally-empty fields)', (done) => {
            // A saved scenario (id !== null) should not be auto-populated —
            // the user may have intentionally cleared the fields or it may
            // have been saved before optional fields were available.
            const savedScenario = {
                id: 99, name: 'Saved', status: 'built',
                terrain: null, boundary: null, inflow: null, rainfall: null,
                resolution: 1000, duration: 1800, unsaved: false
            };
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={savedScenario}
                    selectedCategoryId={'inputs'}
                    canEdit
                    terrain={terrainOpts}
                    boundaries={boundaryOpts}
                    inflows={inflowOpts}
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    setTimeout(() => {
                        expect(captured).toNotExist();
                        done();
                    }, 20);
                }
            );
        });
    });
});

// ------------------------------------------------------------------
// TASK-2116 (F4) — meshRegionIsUnattached pure-predicate unit tests
// ------------------------------------------------------------------
describe('meshRegionIsUnattached (TASK-2116)', () => {
    const regions = [{id: 9, title: 'Corridor 10m'}];

    it('is false when no mesh regions are drawn (empty array)', () => {
        expect(meshRegionIsUnattached({mesh_region: null}, [])).toBe(false);
    });

    it('is false when meshRegions is undefined/absent', () => {
        expect(meshRegionIsUnattached({mesh_region: null}, undefined)).toBe(false);
    });

    it('is true when regions are drawn and mesh_region is null', () => {
        expect(meshRegionIsUnattached({mesh_region: null}, regions)).toBe(true);
    });

    it('is true when regions are drawn and mesh_region is absent entirely', () => {
        expect(meshRegionIsUnattached({}, regions)).toBe(true);
    });

    it('is false once mesh_region is attached', () => {
        expect(meshRegionIsUnattached({mesh_region: 9}, regions)).toBe(false);
    });
});

// ------------------------------------------------------------------
// TASK-2160 (epic 2147 W4) — rainfallIsUnattached pure-predicate unit tests
// (direct MeshRegion analog)
// ------------------------------------------------------------------
describe('rainfallIsUnattached (TASK-2160)', () => {
    const rainfalls = [{id: 6, title: 'Design Storm 1%'}];

    it('is false when no rainfalls are drawn (empty array)', () => {
        expect(rainfallIsUnattached({rainfall: null}, [])).toBe(false);
    });

    it('is false when rainfalls is undefined/absent', () => {
        expect(rainfallIsUnattached({rainfall: null}, undefined)).toBe(false);
    });

    it('is true when rainfalls are drawn and rainfall is null', () => {
        expect(rainfallIsUnattached({rainfall: null}, rainfalls)).toBe(true);
    });

    it('is true when rainfalls are drawn and rainfall is absent entirely', () => {
        expect(rainfallIsUnattached({}, rainfalls)).toBe(true);
    });

    it('is false once rainfall is attached', () => {
        expect(rainfallIsUnattached({rainfall: 6}, rainfalls)).toBe(false);
    });
});

// ------------------------------------------------------------------
// TASK-2189 (epic 2147 W6) — rainfallAttachedButEmpty pure-predicate unit
// tests (complement of rainfallIsUnattached above)
// ------------------------------------------------------------------
describe('rainfallAttachedButEmpty (TASK-2189)', () => {
    const emptyRainfalls = [{id: 6, title: 'Design Storm 1%', has_feature_data: false}];
    const dataRainfalls = [{id: 6, title: 'Design Storm 1%', has_feature_data: true}];

    it('is false when no rainfall is attached', () => {
        expect(rainfallAttachedButEmpty({rainfall: null}, emptyRainfalls)).toBe(false);
    });

    it('is false when rainfall is absent entirely', () => {
        expect(rainfallAttachedButEmpty({}, emptyRainfalls)).toBe(false);
    });

    it('is true when the attached rainfall has has_feature_data === false', () => {
        expect(rainfallAttachedButEmpty({rainfall: 6}, emptyRainfalls)).toBe(true);
    });

    it('is false when the attached rainfall has has_feature_data === true', () => {
        expect(rainfallAttachedButEmpty({rainfall: 6}, dataRainfalls)).toBe(false);
    });

    it('is false when has_feature_data is undefined (stale/pre-2189 API response — never fabricate)', () => {
        const staleRainfalls = [{id: 6, title: 'Design Storm 1%'}];
        expect(rainfallAttachedButEmpty({rainfall: 6}, staleRainfalls)).toBe(false);
    });

    it('is false when the attached id does not match any resource in the list', () => {
        expect(rainfallAttachedButEmpty({rainfall: 999}, emptyRainfalls)).toBe(false);
    });

    it('is false when rainfalls is undefined/absent', () => {
        expect(rainfallAttachedButEmpty({rainfall: 6}, undefined)).toBe(false);
    });
});

// ------------------------------------------------------------------
// TASK-1420 (ISSUE 30) — formatBuildLog pure-function unit tests
// ------------------------------------------------------------------
describe('formatBuildLog (TASK-1420)', () => {
    it('converts mesh area from m² to km² with 2 dp max', () => {
        const log = 'INFO build started\nmesh area: 1234567 m2\nINFO done';
        const out = formatBuildLog(log);
        expect(out).toInclude('mesh area: 1.23 km²');
        expect(out).toNotInclude('m2');
    });

    it('converts large mesh area (whole km²) without spurious decimals', () => {
        // 5,000,000 m² = 5 km² exactly → should not show "5.00"
        const log = 'mesh area: 5000000 m2';
        const out = formatBuildLog(log);
        expect(out).toInclude('mesh area: 5 km²');
    });

    it('converts average triangle area to comma-grouped integer', () => {
        const log = 'average triangle area: 1234.56 m2';
        const out = formatBuildLog(log);
        expect(out).toInclude('average triangle area: 1,235 m²');
        expect(out).toNotInclude('1234.56');
    });

    it('rounds average triangle area < 1000 without comma', () => {
        const log = 'average triangle area: 99.9 m2';
        const out = formatBuildLog(log);
        expect(out).toInclude('average triangle area: 100 m²');
    });

    it('handles both lines together', () => {
        const log = [
            'INFO build complete',
            'mesh area: 2500000 m2',
            'average triangle area: 500.0 m2',
            'mesh_qa: triangles=5000'
        ].join('\n');
        const out = formatBuildLog(log);
        expect(out).toInclude('mesh area: 2.5 km²');
        expect(out).toInclude('average triangle area: 500 m²');
        expect(out).toInclude('mesh_qa: triangles=5000');
    });

    it('leaves other log lines untouched', () => {
        const log = 'INFO CRITICAL Generating output rasters on 8 CPUs';
        expect(formatBuildLog(log)).toBe(log);
    });

    it('returns null/undefined/empty unchanged', () => {
        expect(formatBuildLog(null)).toBe(null);
        expect(formatBuildLog(undefined)).toBe(undefined);
        expect(formatBuildLog('')).toBe('');
    });

    it('also accepts the Unicode m² suffix from the BE', () => {
        const log = 'mesh area: 1000000 m²';
        const out = formatBuildLog(log);
        expect(out).toInclude('mesh area: 1 km²');
    });
});

