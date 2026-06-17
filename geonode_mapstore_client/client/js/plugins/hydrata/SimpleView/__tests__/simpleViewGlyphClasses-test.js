import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

/**
 * TASK-427: Render tests for CSS glyph classes on SimpleView components.
 *
 * Verifies the visibility-toggle glyphs use the correct classes:
 *   - MenuRow:  sv-glyph-active / sv-glyph-inactive
 *   - MenuRows: sv-glyph-active / sv-glyph-inactive / sv-glyph-partial (group toggle)
 */

// ── Helpers ──

function createMockStore(overrides = {}) {
    const defaults = {
        simpleView: { openMenuGroupId: null, config: {} },
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

// ── MenuRow glyph class tests ──

describe('SimpleView Glyph Classes', () => {

    describe('MenuRow visibility toggle glyph', () => {
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

        it('applies sv-glyph-active class when layer is visible', (done) => {
            const { MenuRow } = require('../components/simpleViewMenuRow');
            const store = createMockStore();
            const layer = makeLayer('vis1', true);

            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const glyph = container.querySelector('.sv-menu-row-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude('sv-glyph-active');
                    expect(glyph.className).toNotInclude('sv-glyph-inactive');
                    expect(glyph.className).toInclude('glyphicon-ok');
                    done();
                }
            );
        });

        it('applies sv-glyph-inactive class when layer is not visible', (done) => {
            const { MenuRow } = require('../components/simpleViewMenuRow');
            const store = createMockStore();
            const layer = makeLayer('hid1', false);

            ReactDOM.render(
                <Provider store={store}>
                    <MenuRow layer={layer} />
                </Provider>,
                container,
                () => {
                    const glyph = container.querySelector('.sv-menu-row-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude('sv-glyph-inactive');
                    expect(glyph.className).toNotInclude('sv-glyph-active');
                    expect(glyph.className).toInclude('glyphicon-remove');
                    done();
                }
            );
        });
    });

    // ── MenuRows group glyph class tests ──

    describe('MenuRows group visibility toggle glyph', () => {
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

        it('applies sv-glyph-active when all group layers are visible', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('a1', true, 'grp.sub'),
                makeLayer('a2', true, 'grp.sub')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {} },
                layers: { flat: layers, groups: [] }
            });

            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const subheadingRow = container.querySelector('.sv-subheading-row');
                    expect(subheadingRow).toExist();
                    const glyph = subheadingRow.querySelector('.sv-menu-row-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude('sv-glyph-active');
                    expect(glyph.className).toNotInclude('sv-glyph-inactive');
                    expect(glyph.className).toNotInclude('sv-glyph-partial');
                    expect(glyph.className).toInclude('glyphicon-ok');
                    done();
                }
            );
        });

        it('applies sv-glyph-inactive when no group layers are visible', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('b1', false, 'grp.sub'),
                makeLayer('b2', false, 'grp.sub')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {} },
                layers: { flat: layers, groups: [] }
            });

            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const subheadingRow = container.querySelector('.sv-subheading-row');
                    expect(subheadingRow).toExist();
                    const glyph = subheadingRow.querySelector('.sv-menu-row-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude('sv-glyph-inactive');
                    expect(glyph.className).toNotInclude('sv-glyph-active');
                    expect(glyph.className).toNotInclude('sv-glyph-partial');
                    expect(glyph.className).toInclude('glyphicon-remove');
                    done();
                }
            );
        });

        it('applies sv-glyph-partial when group layers have mixed visibility', (done) => {
            const { MenuRows } = require('../components/simpleViewMenuRows');
            const layers = [
                makeLayer('c1', true, 'grp.sub'),
                makeLayer('c2', false, 'grp.sub')
            ];
            const store = createMockStore({
                simpleView: { openMenuGroupId: 'grp', config: {} },
                layers: { flat: layers, groups: [] }
            });

            ReactDOM.render(
                <Provider store={store}>
                    <MenuRows />
                </Provider>,
                container,
                () => {
                    const subheadingRow = container.querySelector('.sv-subheading-row');
                    expect(subheadingRow).toExist();
                    const glyph = subheadingRow.querySelector('.sv-menu-row-glyph');
                    expect(glyph).toExist();
                    expect(glyph.className).toInclude('sv-glyph-partial');
                    expect(glyph.className).toNotInclude('sv-glyph-active');
                    expect(glyph.className).toNotInclude('sv-glyph-inactive');
                    expect(glyph.className).toInclude('glyphicon-minus');
                    done();
                }
            );
        });
    });
});
