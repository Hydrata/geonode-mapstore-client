import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import {ScenarioPane} from '../scenarioPane';

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

const terrainOpts = [{id: 3, title: 'Default Terrain'}, {id: 4, title: 'Other Terrain'}];
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
        it('renders the vertical category rail with 4 items', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const rail = container.querySelector('.anuga-scenario-category-rail');
                    expect(rail).toExist();
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    expect(items.length).toBe(4);
                    done();
                }
            );
        });

        // Section subhead labels have been removed per UX (Wave 3C) — the
        // category items still group into 3 .anuga-scenario-category-section
        // wrappers (for spacing/visual grouping), but no
        // .anuga-scenario-category-section-label divs render anymore.
        // Regression guard so a future re-add to scenarioCategoryRail.js
        // surfaces here.
        it('renders 3 section group wrappers and zero subhead labels (subheadings removed)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const sections = container.querySelectorAll('.anuga-scenario-category-section');
                    expect(sections.length).toBe(3);
                    const labels = container.querySelectorAll('.anuga-scenario-category-section-label');
                    expect(labels.length).toBe(0);
                    done();
                }
            );
        });

        it('flips is-active on the selected category', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={baseScenario} selectedCategoryId={'runConfig'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
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
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    // Order matches CATEGORIES in scenarioCategoryRail.js (4 items):
                    // inputs (idx 0), advanced (1), runConfig (2), statusActions (3).
                    items[2].click();
                    expect(captured).toBe('runConfig');
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
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    const inputsTag = items[0].querySelector('.anuga-scenario-category-item-tag');
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
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    const inputsTag = items[0].querySelector('.anuga-scenario-category-item-tag');
                    expect(inputsTag.textContent).toBe('0/3');
                    expect(inputsTag.className).toInclude('is-err');
                    done();
                }
            );
        });

        it('Status and actions item shows err tag when scenario.status === error', (done) => {
            const s = {...baseScenario, status: 'error', latest_run: {status: 'error'}};
            ReactDOM.render(
                <ScenarioPane scenario={s} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    // statusActions is index 3.
                    const statusTag = items[3].querySelector('.anuga-scenario-category-item-tag');
                    expect(statusTag.textContent).toBe('err');
                    expect(statusTag.className).toInclude('is-err');
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
                    const cards = container.querySelectorAll('.anuga-scenario-resource-summary');
                    expect(cards.length).toBe(4);
                    expect(cards[3].className).toInclude('is-empty');
                    const placeholder = cards[3].querySelector('.anuga-scenario-resource-summary-placeholder');
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
                            '.anuga-scenario-pane-field.is-readonly'
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
                            '.anuga-scenario-pane-field.is-readonly'
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
                        expect(container.querySelector('.anuga-scenario-pane-readonly-hint')).toExist();
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
                        expect(container.querySelector('.anuga-scenario-pane-readonly-hint')).toNotExist();
                        done();
                    }
                );
            });

            it('does NOT render the read-only hint on the empty pane (no scenario)', (done) => {
                ReactDOM.render(
                    <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                    container,
                    () => {
                        expect(container.querySelector('.anuga-scenario-pane-readonly-hint')).toNotExist();
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

            it('tags Run config wrappers with .is-readonly when canEdit=false', (done) => {
                ReactDOM.render(
                    <ScenarioPane
                        scenario={baseScenario}
                        selectedCategoryId={'runConfig'}
                    />,
                    container,
                    () => {
                        const readonlyWrappers = container.querySelectorAll(
                            '.anuga-scenario-pane-field.is-readonly'
                        );
                        // resolution + duration + compute_backend = 3 wrappers.
                        expect(readonlyWrappers.length).toBe(3);
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
        it('renders 4 dropdowns', (done) => {
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
                    expect(container.querySelector('#network')).toExist();
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
                    expect(container.querySelector('#duration')).toNotExist();
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Run config pane (Pane 3) — NEW
    // ------------------------------------------------------------------
    describe('Run config pane', () => {
        it('renders resolution + duration + compute_backend', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('#resolution')).toExist();
                    expect(container.querySelector('#duration')).toExist();
                    expect(container.querySelector('#compute_backend')).toExist();
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

        it('duration HH:MM rendering for 1800 seconds', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'runConfig'}
                    canEdit
                />,
                container,
                () => {
                    const input = container.querySelector('#duration');
                    expect(input.value).toBeTruthy();
                    done();
                }
            );
        });

        it('duration blur converts HH:MM back to seconds via getSecondsFromHHMM', (done) => {
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
                    const input = container.querySelector('#duration');
                    Simulate.blur(input, {target: {value: '1:00', id: 'duration'}});
                    expect(captured.duration).toBe(3600);
                    done();
                }
            );
        });

        it('compute_backend select dispatches onUpdateScenario', (done) => {
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
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.anuga-scenario-status-card')).toExist();
                    // Pill renders inside the status card; container also has compact
                    // pill in the toolbar.
                    const pills = container.querySelectorAll('.scenario-status-pill');
                    expect(pills.length).toBeGreaterThan(0);
                    done();
                }
            );
        });

        it('renders the action toolbar', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    expect(container.querySelector('.scenario-action-toolbar')).toExist();
                    done();
                }
            );
        });

        it('Build click flows through to onBuildClick callback', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'created', unsaved: true}}
                    selectedCategoryId={'statusActions'}
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

        it('Delete click invokes onConfirmDelete callback', (done) => {
            let captured = null;
            ReactDOM.render(
                <ScenarioPane
                    scenario={baseScenario}
                    selectedCategoryId={'statusActions'}
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

        it('renders the error strip when status === error', (done) => {
            const s = {
                ...baseScenario,
                status: 'error',
                latest_run: {status: 'error', error_message: 'mesh validation failed'}
            };
            ReactDOM.render(
                <ScenarioPane
                    scenario={s}
                    selectedCategoryId={'statusActions'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('.anuga-scenario-error-strip')).toExist();
                    done();
                }
            );
        });

        it('does NOT render the error strip when status is not error', (done) => {
            ReactDOM.render(
                <ScenarioPane
                    scenario={{...baseScenario, status: 'built'}}
                    selectedCategoryId={'statusActions'}
                    canEdit
                />,
                container,
                () => {
                    expect(container.querySelector('.anuga-scenario-error-strip')).toNotExist();
                    done();
                }
            );
        });
    });

    // ------------------------------------------------------------------
    // Inline ScenarioRunLog (rendered at bottom of Status-and-actions pane)
    // ------------------------------------------------------------------
    // The legacy `runLog` standalone pane was removed (along with the
    // .scenario-action-open-task-monitor button). The log is now rendered
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
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const block = container.querySelector('.anuga-scenario-pane-log');
                    expect(block).toExist();
                    const title = container.querySelector('.anuga-scenario-pane-log-title');
                    // <Message> renders the msgId text in the test environment; the
                    // line count is appended in-component as ` (2)`.
                    expect(title.textContent).toInclude('(2)');
                    const pre = container.querySelector('pre.anuga-scenario-pane-log-viewer');
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
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.anuga-scenario-pane-log-viewer');
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
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.anuga-scenario-pane-log-viewer');
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
                    selectedCategoryId={'statusActions'}
                    canEdit canRunScenario
                />,
                container,
                () => {
                    const pre = container.querySelector('pre.anuga-scenario-pane-log-viewer');
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
                            selectedCategoryId={'statusActions'}
                            canEdit canRunScenario
                        />,
                        container,
                        () => {
                            const preAfter = container.querySelector('pre.anuga-scenario-pane-log-viewer');
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
                    expect(container.querySelector('.anuga-scenario-empty-pane')).toExist();
                    // No input fields render.
                    expect(container.querySelector('#name')).toNotExist();
                    done();
                }
            );
        });

        it('still renders the category rail when scenario is null (so user can browse)', (done) => {
            ReactDOM.render(
                <ScenarioPane scenario={null} selectedCategoryId={'inputs'} />,
                container,
                () => {
                    const items = container.querySelectorAll('.anuga-scenario-category-item');
                    expect(items.length).toBe(4);
                    done();
                }
            );
        });
    });
});
