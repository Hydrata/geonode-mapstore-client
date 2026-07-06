import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import Localized from '@mapstore/framework/components/I18N/Localized';
import {ScenarioPane, formatBuildLog} from '../scenarioPane';
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
 *   - Run section: resolution + duration + compute-backend select + status
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
    // Category rail (Pane 2)
    // ------------------------------------------------------------------
    describe('Category rail', () => {
        // TASK-1416: merged 'run' category → rail now has 3 items (inputs/advanced/run).
        it('renders the vertical category rail with 3 items (TASK-1416: runConfig+statusActions merged)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const rail = container.querySelector('.sv-anuga-scenario-category-rail');
                    expect(rail).toExist();
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    expect(items.length).toBe(3);
                    done();
                }
            );
        });

        // TASK-1416: now 2 sections (inputs + run), not 3. No subhead labels.
        it('renders 2 section group wrappers and zero subhead labels (TASK-1416)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const sections = container.querySelectorAll('.sv-anuga-scenario-category-section');
                    expect(sections.length).toBe(2);
                    const labels = container.querySelectorAll('.sv-anuga-scenario-category-section-label');
                    expect(labels.length).toBe(0);
                    done();
                }
            );
        });

        it('flips is-active on the selected category', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'run'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    const active = Array.from(items).filter(t => t.className.includes('is-active'));
                    expect(active.length).toBe(1);
                    done();
                }
            );
        });

        it('clicking a category invokes onSelectCategory', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'inputs'}
                    onSelectCategory={(id) => { captured = id; }}
                />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    // TASK-1416: 3 items: inputs (0), advanced (1), run (2).
                    items[2].click();
                    expect(captured).toBe('run');
                    done();
                }
            );
        });

        it('Inputs item shows 3/3 tag when terrain + boundary + (inflow OR rainfall) all assigned', (done) => {
            // Inputs slot count is 3 (terrain + boundary + water-source), with
            // inflow/rainfall sharing the same slot per validateCategoryProgress.
            // baseScenario already assigns terrain (3), boundary (4), inflow (5).
            const s = {...baseScenario, rainfall: 8};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    const inputsTag = items[0].querySelector('.sv-anuga-scenario-category-item-tag');
                    expect(inputsTag.textContent).toBe('3/3');
                    expect(inputsTag.className).toInclude('is-ok');
                    done();
                }
            );
        });

        it('Inputs item shows 0/3 tag with is-err severity when no inputs assigned', (done) => {
            const s = {id: 1, name: 'empty'};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    const inputsTag = items[0].querySelector('.sv-anuga-scenario-category-item-tag');
                    expect(inputsTag.textContent).toBe('0/3');
                    expect(inputsTag.className).toInclude('is-err');
                    done();
                }
            );
        });

        // TASK-1416: 'run' is now index 2 (statusActions was index 3 before merge).
        it('Run item shows err tag when scenario.status === error (TASK-1416)', (done) => {
            const s = {...baseScenario, status: 'error', latest_run: {status: 'error'}};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    // run is index 2 (was statusActions at index 3).
                    const runTag = items[2].querySelector('.sv-anuga-scenario-category-item-tag');
                    expect(runTag.textContent).toBe('err');
                    expect(runTag.className).toInclude('is-err');
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
                    isSuperuser
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
                    // Run
                    expect(container.querySelector('#resolution')).toExist();
                    expect(container.querySelector('#duration-hours')).toExist();
                    expect(container.querySelector('#duration-minutes')).toExist();
                    expect(container.querySelector('#compute_backend')).toExist();
                    done();
                }
            );
        });

        it('renders the 3 section headings (Required/Optional/Run) in document order', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} canEdit />,
                container,
                () => {
                    const heads = container.querySelectorAll('.sv-anuga-scenario-pane-detail-head-title');
                    expect(heads.length).toBe(3);
                    expect(heads[0].textContent).toInclude('hydrata.anuga.requiredInputs');
                    expect(heads[1].textContent).toInclude('hydrata.anuga.optionalInputs');
                    expect(heads[2].textContent).toInclude('hydrata.anuga.run');
                    done();
                }
            );
        });

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

            it('tags Run config wrappers with .is-readonly when canEdit=false (superuser sees 3, non-su sees 2)', (done) => {
                // TASK-1415: compute_backend only rendered for superusers.
                // Non-superuser: resolution + duration = 2 wrappers.
                // TASK-2114 — scoped to the Run-config rows wrapper so Inputs'
                // and Advanced's now-coexisting .is-readonly wrappers don't
                // inflate the count.
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        isSuperuser={false}
                    />,
                    container,
                    () => {
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-rows-run-config .sv-anuga-scenario-pane-field.is-readonly'
                        );
                        // resolution + duration = 2 wrappers (compute_backend hidden for non-superuser).
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
    });

    // ------------------------------------------------------------------
    // Run config pane (Pane 3) — NEW
    // ------------------------------------------------------------------
    describe('Run config pane', () => {
        it('renders resolution + duration; compute_backend hidden for non-superusers (TASK-1415)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isSuperuser={false}
                />,
                container,
                () => {
                    expect(container.querySelector('#resolution')).toExist();
                    expect(container.querySelector('#duration-hours')).toExist();
                    expect(container.querySelector('#duration-minutes')).toExist();
                    expect(container.querySelector('#compute_backend')).toNotExist();
                    done();
                }
            );
        });

        it('renders compute_backend for superusers (TASK-1415)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isSuperuser
                />,
                container,
                () => {
                    expect(container.querySelector('#compute_backend')).toExist();
                    // Only Local and Cloud options (no ec2)
                    const opts = Array.from(container.querySelectorAll('#compute_backend option'));
                    const vals = opts.map(o => o.value);
                    expect(vals).toNotInclude('ec2');
                    expect(vals).toInclude('local');
                    expect(vals).toInclude('batch');
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

        // TASK-1415: compute_backend visible only for superusers; pass isSuperuser
        it('compute_backend select dispatches onUpdateScenario (superuser)', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                    isSuperuser
                    onUpdateScenario={(s, kv) => { captured = kv; }}
                />,
                container,
                () => {
                    const sel = container.querySelector('#compute_backend');
                    Simulate.change(sel, {target: {value: 'batch'}});
                    expect(captured.compute_backend).toBe('batch');
                    done();
                }
            );
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
                    // Pill renders inside the status card; container also has compact
                    // pill in the toolbar.
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

        it('renders the error strip when status === error', (done) => {
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
                    expect(container.querySelector('.sv-anuga-scenario-error-strip')).toExist();
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

        // TASK-1416: merged 'run' category → 3 items now.
        it('still renders the category rail when scenario is null (so user can browse)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.sv-anuga-scenario-category-item');
                    expect(items.length).toBe(3);
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

