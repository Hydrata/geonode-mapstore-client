import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {MenuRows} from '../components/simpleViewMenuRows';

/**
 * TASK-1008 W4 — wave-level integration test for the Miller-columns
 * rail+pane composition shipped across W1+W2+W3. The per-primitive tests
 * (CategoryRail, LayerActionToolbar, OpacitySlider, SectionHeader) cover
 * presentational contracts in isolation; this file covers the connected
 * `MenuRows` container wiring them together end-to-end:
 *
 *   - Rail+pane composition: rail click -> pane swap (selectedSubHeading
 *     local state) -> rows in the pane match the clicked subheading.
 *   - Locked-toolbar order (vis | zoom | edit | delete) renders per row
 *     across multiple subheading categories.
 *   - OpacitySlider lifted as a SIBLING of the row body (not inside the
 *     toolbar) — R04 always-mounted, CSS-toggle hidden state.
 *   - Single-subheading legacy accordion fallback still triggers at
 *     subHeadings.length < 2 (W1 contract preserved).
 *   - Empty-layer fallback is non-crashing.
 *   - Cross-plugin no-leak smoke (R01 CSS cascade) — sibling-container
 *     mount/unmount cycle is clean.
 *
 * Redux action-log parity is the responsibility of
 * simpleViewActionLogParity-test.js; this file asserts DOM structure +
 * interaction outcomes only.
 */

function createMockStore(overrides = {}) {
    const defaults = {
        simpleView: { openMenuGroupId: null, config: {}, selectedCategory: null },
        layers: { flat: [], groups: [] },
        gnresource: { initialResource: { perms: [] } },
        gnsettings: { geonodeUrl: 'http://localhost' },
        controls: {},
        localConfig: { plugins: { map_viewer: [] } }
    };
    const merged = {
        ...defaults,
        ...overrides,
        simpleView: { ...defaults.simpleView, ...(overrides.simpleView || {}) },
        layers: { ...defaults.layers, ...(overrides.layers || {}) }
    };
    let actions = [];
    return {
        getState: () => merged,
        subscribe: () => () => {},
        dispatch: (a) => { actions.push(a); return a; },
        __actions: () => actions
    };
}

function makeLayer(id, visibility, group, extras = {}) {
    return {
        id,
        visibility,
        group: group || 'Input Data.Terrain',
        type: 'wms',
        title: `Layer ${id}`,
        name: `layer_${id}`,
        opacity: 1,
        ...extras
    };
}

describe('SimpleView Miller-columns rail+pane integration (TASK-1008 W4)', () => {

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

    // A. Rail+pane composition
    describe('A. Rail+pane composition', () => {
        it('mounts rail + pane shell with one rail item per distinct subheading', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary'),
                makeLayer('i1', true, 'grp.Inflow')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-category-rail')).toExist();
                    expect(container.querySelector('.sv-menu-rows-pane')).toExist();
                    done();
                }
            );
        });

        it('rail item count equals the number of distinct subheadings', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('t2', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary'),
                makeLayer('i1', true, 'grp.Inflow')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    expect(railItems.length).toBe(3);
                    done();
                }
            );
        });

        it('first rail item is .is-active on mount (selectedSubHeading default)', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary'),
                makeLayer('i1', true, 'grp.Inflow')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    expect(railItems[0].className).toInclude('is-active');
                    expect(railItems[1].className).toNotInclude('is-active');
                    expect(railItems[2].className).toNotInclude('is-active');
                    done();
                }
            );
        });
    });

    // B. Pane swap on rail click
    describe('B. Pane swap on rail click', () => {
        it('clicking the Boundary rail item swaps the pane to Boundary rows', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary'),
                makeLayer('b2', true, 'grp.Boundary'),
                makeLayer('i1', true, 'grp.Inflow')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    const boundaryItem = Array.from(railItems).find(i =>
                        i.querySelector('.sv-category-rail-item-label').textContent === 'Boundary'
                    );
                    expect(boundaryItem).toExist();
                    boundaryItem.click();
                    setTimeout(() => {
                        const pane = container.querySelector('.sv-menu-rows-pane');
                        const paneRows = pane.querySelectorAll('.sv-menu-row');
                        expect(paneRows.length).toBe(2);
                        done();
                    }, 0);
                }
            );
        });

        it('clicking a rail item moves .is-active to that item', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    const boundaryItem = Array.from(railItems).find(i =>
                        i.querySelector('.sv-category-rail-item-label').textContent === 'Boundary'
                    );
                    boundaryItem.click();
                    setTimeout(() => {
                        const refreshed = container.querySelectorAll('.sv-category-rail-item');
                        const terrainItem = Array.from(refreshed).find(i =>
                            i.querySelector('.sv-category-rail-item-label').textContent === 'Terrain'
                        );
                        const boundaryItemAfter = Array.from(refreshed).find(i =>
                            i.querySelector('.sv-category-rail-item-label').textContent === 'Boundary'
                        );
                        expect(boundaryItemAfter.className).toInclude('is-active');
                        expect(terrainItem.className).toNotInclude('is-active');
                        done();
                    }, 0);
                }
            );
        });

        it('clicking the same rail item twice is a no-op and stays .is-active', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const findBoundary = () => Array.from(
                        container.querySelectorAll('.sv-category-rail-item')
                    ).find(i => i.querySelector('.sv-category-rail-item-label').textContent === 'Boundary');
                    findBoundary().click();
                    setTimeout(() => {
                        findBoundary().click();
                        setTimeout(() => {
                            const boundaryItem = findBoundary();
                            expect(boundaryItem.className).toInclude('is-active');
                            done();
                        }, 0);
                    }, 0);
                }
            );
        });
    });

    // C. Locked-toolbar order across categories (sampled)
    describe('C. Locked-toolbar order across categories', () => {
        // Helper: render MenuRows with one layer in `subHeading` plus one
        // layer in a sibling subheading (so subHeadings.length >= 2 triggers
        // the rail+pane shell), then click into `subHeading` and assert the
        // pane-rendered row's toolbar has the locked order. The "always-
        // present" subset (vis @ 0, zoom @ 1) is the safest assertion: edit
        // / delete are perm-gated and Karma+JSDOM does not stand up the full
        // Guardian perm graph.
        const assertLockedToolbar = (subHeading, doneCb) => {
            const targetLayer = makeLayer('x1', true, `grp.${subHeading}`);
            const siblingLayer = makeLayer('s1', true, 'grp.OtherCategory');
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: [targetLayer, siblingLayer], groups: [] },
                gnresource: { initialResource: { perms: ['change_resourcebase'] } },
                security: { user: { pk: 1 } },
                anuga: {
                    projects: { data: { id: 99, my_role: 'editor' } },
                    resources: {}
                }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const targetRailItem = Array.from(
                        container.querySelectorAll('.sv-category-rail-item')
                    ).find(i => i.querySelector('.sv-category-rail-item-label').textContent === subHeading);
                    expect(targetRailItem).toExist();
                    targetRailItem.click();
                    setTimeout(() => {
                        const pane = container.querySelector('.sv-menu-rows-pane');
                        const row = pane.querySelector('.sv-menu-row');
                        expect(row).toExist();
                        const toolbar = row.querySelector('.sv-menu-row-toolbar');
                        expect(toolbar).toExist();
                        const glyphs = toolbar.querySelectorAll('.sv-menu-row-glyph');
                        expect(glyphs.length >= 2).toBe(true);
                        expect(glyphs[0].className).toInclude('sv-glyph-active');
                        expect(glyphs[1].className).toInclude('sv-glyph-zoom');
                        expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                        doneCb();
                    }, 0);
                }
            );
        };

        it('renders locked toolbar order for Terrain rows', (done) => {
            assertLockedToolbar('Terrain', done);
        });

        it('renders locked toolbar order for Boundary rows', (done) => {
            assertLockedToolbar('Boundary', done);
        });

        it('renders locked toolbar order for Inflow rows', (done) => {
            assertLockedToolbar('Inflow', done);
        });

        it('renders locked toolbar order for Friction rows', (done) => {
            assertLockedToolbar('Friction', done);
        });
    });

    // D. Slider sub-row lifted as a sibling of the row body
    describe('D. Slider sub-row lifted', () => {
        it('renders .sv-menu-row-slider-subrow as a direct child of .sv-menu-row (NOT inside the toolbar)', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain', {opacity: 0.5}),
                makeLayer('b1', true, 'grp.Boundary')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    const row = container.querySelector('.sv-menu-rows-pane .sv-menu-row');
                    expect(row).toExist();
                    // Slider must be a direct child of the row (sibling of
                    // .sv-menu-row-left / .sv-menu-row-toolbar), NOT nested inside
                    // the toolbar. Use direct-children iteration so we don't
                    // accidentally match a descendant.
                    const slider = Array.from(row.children).find(c =>
                        c.className && c.className.indexOf('sv-menu-row-slider-subrow') >= 0
                    );
                    expect(slider).toExist();
                    // Confirm it's NOT inside .sv-menu-row-toolbar.
                    const toolbar = row.querySelector('.sv-menu-row-toolbar');
                    if (toolbar) {
                        expect(toolbar.querySelector('.sv-menu-row-slider-subrow')).toNotExist();
                    }
                    done();
                }
            );
        });

        it('slider element exists in DOM for every layer row (R04 always-mounted, CSS-toggled)', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain', {opacity: 0.7}),
                makeLayer('t2', true, 'grp.Terrain', {opacity: 0.3})
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    // 1 subheading -> legacy accordion path; sliders still
                    // render on every row regardless of selection. We assert
                    // existence only — visibility is CSS-toggled and not
                    // testable via .style without a stylesheet load.
                    const sliders = container.querySelectorAll('.sv-menu-row-slider-subrow');
                    expect(sliders.length).toBe(2);
                    done();
                }
            );
        });
    });

    // E. Single-subheading fallback
    describe('E. Single-subheading legacy accordion fallback', () => {
        it('with 1 subheading renders .sv-subheading-row and NOT the rail', (done) => {
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('t2', true, 'grp.Terrain')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-subheading-row')).toExist();
                    expect(container.querySelector('.sv-category-rail')).toNotExist();
                    expect(container.querySelector('.sv-rail-pane-shell')).toNotExist();
                    done();
                }
            );
        });
    });

    // F. Empty fallback
    describe('F. Empty-layer fallback', () => {
        it('with 0 matching layers renders neither rail nor accordion rows, no crash', (done) => {
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: [], groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-menu-rows-container')).toExist();
                    expect(container.querySelector('.sv-category-rail')).toNotExist();
                    expect(container.querySelector('.sv-subheading-row')).toNotExist();
                    done();
                }
            );
        });
    });

    // G. Cross-plugin no-leak smoke (R01 CSS cascade)
    describe('G. Cross-plugin no-leak smoke', () => {
        it('mount+unmount of MenuRows beside a sibling node leaves no shared state', (done) => {
            document.body.innerHTML =
                '<div id="container"></div><div id="sibling"></div>';
            const localContainer = document.getElementById('container');
            const sibling = document.getElementById('sibling');
            // Render a foreign node into the sibling first to assert it
            // survives a MenuRows mount + unmount cycle untouched.
            ReactDOM.render(
                <span className="sv-anuga-section-header">test</span>,
                sibling
            );
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundary')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp' },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}><MenuRows /></Provider>,
                localContainer,
                () => {
                    expect(localContainer.querySelector('.sv-category-rail')).toExist();
                    expect(sibling.querySelector('.sv-anuga-section-header')).toExist();
                    expect(sibling.querySelector('.sv-category-rail')).toNotExist();
                    ReactDOM.unmountComponentAtNode(sibling);
                    container = localContainer;
                    done();
                }
            );
        });
    });
});
