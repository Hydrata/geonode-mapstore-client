import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

/**
 * TASK-1005 W1 — structural assertions for the Miller-columns rail+pane
 * activation contract in simpleViewMenuRows.js. Verifies:
 *   - AC#1 rail+pane structure renders at >=2 subheadings
 *   - AC#3 selectedSubHeading defaults to the first subheading on mount
 *   - AC#5 tri-state visibility glyph reuses the exact existing classes
 *     (glyphicon-ok sv-glyph-active / glyphicon-remove sv-glyph-inactive /
 *     glyphicon-minus sv-glyph-partial)
 *   - AC#6 zoom glyph removed from rail items (no glyphicon-zoom-to / sv-glyph-zoom)
 *   - AC#7 basemaps short-circuit and empty fallback preserved
 *   - AC#8 single-subheading legacy accordion preserved (.sv-subheading-row
 *     + collapse-chevron glyph)
 *   - AC#10 rail is data-driven (one rail item per distinct subheading
 *     from props.layerSubheadings)
 *
 * Comprehensive Miller-specific tests (action-log parity, narrow viewport,
 * pane-swap interaction, primitive contracts) land in W4 per the EPIC's
 * test plan. This file covers the W1 rail+pane scaffold contract only.
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
    return {
        getState: () => merged,
        subscribe: () => {},
        dispatch: () => {}
    };
}

function makeLayer(id, visibility, group) {
    return {
        id,
        visibility,
        group: group || 'testGroup.sub1',
        type: 'wms',
        title: `Layer ${id}`,
        name: `layer_${id}`,
        opacity: 1
    };
}

describe('SimpleView Miller-columns rail+pane layout (TASK-1005 W1)', () => {

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

    describe('Rail+pane activation at >=2 subheadings (AC#1, AC#3, AC#10)', () => {
        it('renders sv-rail-pane-shell + sv-category-rail + sv-menu-rows-pane', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries'),
                makeLayer('b2', false, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-rail-pane-shell')).toExist();
                    expect(container.querySelector('.sv-category-rail')).toExist();
                    expect(container.querySelector('.sv-menu-rows-pane')).toExist();
                    // AC#7: existing .sv-menu-rows-container still wraps the shell
                    expect(container.querySelector('.sv-menu-rows-container')).toExist();
                    done();
                }
            );
        });

        it('rail item count matches distinct subheading count (data-driven AC#10)', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries'),
                makeLayer('i1', true, 'grp.Inflows')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    expect(railItems.length).toBe(3);
                    const labels = Array.from(railItems).map(i => i.querySelector('.sv-category-rail-item-label').textContent);
                    expect(labels).toInclude('Terrain');
                    expect(labels).toInclude('Boundaries');
                    expect(labels).toInclude('Inflows');
                    done();
                }
            );
        });

        it('first rail item has is-active class by default (AC#3 selectedSubHeading default)', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const railItems = container.querySelectorAll('.sv-category-rail-item');
                    expect(railItems.length).toBe(2);
                    expect(railItems[0].className).toInclude('is-active');
                    expect(railItems[1].className).toNotInclude('is-active');
                    done();
                }
            );
        });
    });

    describe('Tri-state visibility glyph in rail items (AC#5)', () => {
        it('renders sv-glyph-active when all rail-group layers are visible', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('t2', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const firstRailItem = container.querySelector('.sv-category-rail-item');
                    const tristateGlyph = firstRailItem.querySelector('.sv-category-rail-item-tristate');
                    expect(tristateGlyph).toExist();
                    expect(tristateGlyph.className).toInclude('sv-glyph-active');
                    expect(tristateGlyph.className).toInclude('glyphicon-ok');
                    done();
                }
            );
        });

        it('renders sv-glyph-inactive when no rail-group layers are visible', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', false, 'grp.Terrain'),
                makeLayer('t2', false, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const firstRailItem = container.querySelector('.sv-category-rail-item');
                    const tristateGlyph = firstRailItem.querySelector('.sv-category-rail-item-tristate');
                    expect(tristateGlyph.className).toInclude('sv-glyph-inactive');
                    expect(tristateGlyph.className).toInclude('glyphicon-remove');
                    done();
                }
            );
        });

        it('renders sv-glyph-partial when rail-group layers have mixed visibility', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('t2', false, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const firstRailItem = container.querySelector('.sv-category-rail-item');
                    const tristateGlyph = firstRailItem.querySelector('.sv-category-rail-item-tristate');
                    expect(tristateGlyph.className).toInclude('sv-glyph-partial');
                    expect(tristateGlyph.className).toInclude('glyphicon-minus');
                    done();
                }
            );
        });
    });

    describe('Zoom glyph removed from rail items (AC#6)', () => {
        it('does NOT render a zoom glyph (sv-category-rail-item-zoom) in any rail item', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('b1', true, 'grp.Boundaries')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    expect(container.querySelectorAll('.sv-category-rail-item').length).toBe(2);
                    expect(container.querySelectorAll('.sv-category-rail-item .sv-category-rail-item-zoom').length).toBe(0);
                    expect(container.querySelectorAll('.sv-category-rail-item .glyphicon-zoom-to').length).toBe(0);
                    done();
                }
            );
        });
    });

    describe('Basemaps short-circuit + empty fallback preserved (AC#7)', () => {
        it('basemaps openMenuGroupId returns legacy flat .sv-menu-rows-container with no rail', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const baseMapLayer = { ...makeLayer('bm1', true, 'background'), group: 'background' };
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'basemaps', config: {}, selectedCategory: null },
                layers: { flat: [baseMapLayer], groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-menu-rows-container')).toExist();
                    expect(container.querySelector('.sv-rail-pane-shell')).toNotExist();
                    expect(container.querySelector('.sv-category-rail')).toNotExist();
                    done();
                }
            );
        });

        it('empty layerList returns legacy flat fallback with no rail', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: [], groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-menu-rows-container')).toExist();
                    expect(container.querySelector('.sv-rail-pane-shell')).toNotExist();
                    done();
                }
            );
        });
    });

    describe('Single-subheading legacy accordion preserved (AC#8)', () => {
        it('renders .sv-subheading-row + collapse-chevron when exactly 1 subheading', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('t1', true, 'grp.Terrain'),
                makeLayer('t2', true, 'grp.Terrain')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {}, selectedCategory: null },
                layers: { flat: layers, groups: [] }
            });
            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    expect(container.querySelector('.sv-subheading-row')).toExist();
                    expect(container.querySelector('.sv-glyph-collapse')).toExist();
                    expect(container.querySelector('.sv-rail-pane-shell')).toNotExist();
                    expect(container.querySelector('.sv-category-rail-item')).toNotExist();
                    done();
                }
            );
        });
    });
});
