import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import {ScenarioPane, formatBuildLog} from '../scenarioPane';

/**
 * TASK-C-scenarios-miller Wave 3A — per-category pane assertions.
 * Restructured around the 4 panes (inputs / advanced / runConfig /
 * statusActions) plus the new vertical category rail (Pane 2). The legacy
 * `runLog` category has been folded into Status-and-actions: an inline
 * `ScenarioRunLog` (<pre> auto-scrolled to bottom) renders after the
 * action toolbar instead of a standalone Run log pane.
 *
 * Tests cover:
 *   - Category rail: 4 items render across 3 sections (no subhead labels),
 *     click flips selection
 *   - Inputs pane: 4 dropdowns + name input + ALWAYS-rendered resource-summary
 *     cards (empty assignments render an .is-empty placeholder card)
 *   - Advanced pane: 4 dropdowns + optional resource-summary cards
 *   - Run config pane: resolution + duration + compute-backend select
 *   - Status and actions pane: status card + (error strip) + action toolbar
 *     + inline ScenarioRunLog with auto-scroll
 *   - Empty pane: renders "Select or create a scenario" placeholder
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

        it('renders a resource-summary card under EVERY input dropdown (empty placeholders included)', (done) => {
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
                    // ScenarioPane now always renders a ScenarioResourceSummary card
                    // (even when unassigned) so the layout is stable while the user
                    // picks values. baseScenario assigns terrain/boundary/inflow but
                    // not rainfall → 4 cards total, last one .is-empty with a "—"
                    // placeholder body.
                    const cards = container.querySelectorAll('.sv-anuga-scenario-resource-summary');
                    expect(cards.length).toBe(4);
                    expect(cards[3].className).toInclude('is-empty');
                    const placeholder = cards[3].querySelector('.sv-anuga-scenario-resource-summary-placeholder');
                    expect(placeholder).toExist();
                    expect(placeholder.textContent).toBe('—');
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
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-field.is-readonly'
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
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                        isSuperuser={false}
                    />,
                    container,
                    () => {
                        const readonlyWrappers = container.querySelectorAll(
                            '.sv-anuga-scenario-pane-field.is-readonly'
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

        it('does NOT render resolution or duration (these moved to Run config)', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'advanced'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('#resolution')).toNotExist();
                    expect(container.querySelector('#duration-hours')).toNotExist();
                    expect(container.querySelector('#duration-minutes')).toNotExist();
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

