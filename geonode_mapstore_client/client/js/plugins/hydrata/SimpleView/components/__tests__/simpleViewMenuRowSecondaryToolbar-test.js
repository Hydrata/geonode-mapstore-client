/*
 * TASK-1010 W6-polish — download / delete position swap.
 *
 * Locked 4-icon primary toolbar order is now `vis | zoom | edit | download`
 * (download moved up from the secondary toolbar). Trash + the always-
 * mounted delete-confirm overlay moved DOWN into the secondary toolbar
 * (alongside the SWAMM-only upload glyph).
 *
 * This file pins the new secondary-toolbar layout so the swap can't
 * silently regress. The functional delete-flow (action dispatch, blocking-
 * error rendering, etc.) continues to live in simpleViewMenuRowDelete-test.js;
 * those generic selectors (`.glyphicon-trash`, `.menu-row-delete-confirm`)
 * resolve regardless of which toolbar slot the trash lives in.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

function createMockStore(overrides = {}) {
    const defaults = {
        simpleView: { openMenuGroupId: null, config: {} },
        layers: { flat: [], groups: [] },
        gnresource: {
            initialResource: {
                perms: ['change_resourcebase', 'delete_resourcebase', 'download_resourcebase']
            }
        },
        gnsettings: { geonodeUrl: 'https://hydrata.com', jobName: 'hydratabase' },
        controls: {},
        localConfig: { plugins: { map_viewer: [] } },
        anuga: {
            projects: { data: { id: 42, my_role: 'editor' } },
            resources: {
                terrain: [{ id: 99, gn_layer_name: 'ele_xxxxxx' }]
            }
        },
        security: { user: { pk: 1 } }
    };
    const merged = {
        ...defaults,
        ...overrides,
        gnsettings: { ...defaults.gnsettings, ...(overrides.gnsettings || {}) },
        gnresource: { ...defaults.gnresource, ...(overrides.gnresource || {}) },
        anuga: {
            ...defaults.anuga,
            ...(overrides.anuga || {}),
            resources: {
                ...defaults.anuga.resources,
                ...((overrides.anuga && overrides.anuga.resources) || {})
            }
        }
    };
    return {
        getState: () => merged,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

const baseLayer = (overrides = {}) => ({
    id: 'l1',
    visibility: true,
    group: 'Input Data.Terrain',
    type: 'wms',
    title: 'My Terrain',
    name: 'geonode:ele_xxxxxx',
    opacity: 1,
    // canEditLayer requires `change_dataset_data`; canExportLayer requires
    // `download_resourcebase`; canDeleteLayer requires `delete_resourcebase`.
    perms: ['change_dataset_data', 'delete_resourcebase', 'download_resourcebase'],
    ...overrides
});

describe('TASK-1010 simpleViewMenuRow — primary/secondary toolbar swap', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mount(layer) {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore();
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><MenuRow layer={layer} /></Provider>,
                container,
                () => resolve()
            );
        });
    }

    describe('Primary toolbar (.menu-row-toolbar) — vis | zoom | edit | download', () => {
        it('renders download as the 4th glyph in the primary toolbar', () => {
            return mount(baseLayer()).then(() => {
                const primary = container.querySelector('.menu-row-toolbar');
                expect(primary).toExist();
                const glyphs = primary.querySelectorAll('.menu-row-glyph');
                expect(glyphs.length).toBe(4);
                expect(glyphs[0].className).toInclude('glyphicon-ok');
                expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                expect(glyphs[2].className).toInclude('glyphicon-pencil');
                expect(glyphs[3].className).toInclude('glyphicon-download');
            });
        });

        it('does NOT render the trash glyph inside the primary toolbar', () => {
            return mount(baseLayer()).then(() => {
                const primary = container.querySelector('.menu-row-toolbar');
                expect(primary).toExist();
                expect(primary.querySelector('.glyphicon-trash')).toNotExist();
                expect(primary.querySelector('.glyph-delete')).toNotExist();
                expect(primary.querySelector('.menu-row-delete-confirm')).toNotExist();
            });
        });
    });

    describe('Secondary toolbar (.menu-row-toolbar-secondary) — delete + overlay (+ upload on swamm)', () => {
        it('renders the trash glyph inside the secondary toolbar', () => {
            return mount(baseLayer()).then(() => {
                const secondary = container.querySelector('.menu-row-toolbar-secondary');
                expect(secondary).toExist();
                const trash = secondary.querySelector('.menu-row-glyph.glyphicon-trash');
                expect(trash).toExist();
                expect(trash.className).toInclude('glyph-delete');
            });
        });

        it('renders the always-mounted delete-confirm overlay inside the secondary toolbar', () => {
            return mount(baseLayer()).then(() => {
                const secondary = container.querySelector('.menu-row-toolbar-secondary');
                expect(secondary).toExist();
                const overlay = secondary.querySelector('.menu-row-delete-confirm');
                expect(overlay).toExist();
                // Closed-by-default: no .is-open class and aria-hidden=true
                expect(overlay.className).toNotInclude('is-open');
                expect(overlay.getAttribute('aria-hidden')).toBe('true');
            });
        });

        it('overlay contains the danger + cancel buttons (always-in-DOM, R04)', () => {
            return mount(baseLayer()).then(() => {
                const secondary = container.querySelector('.menu-row-toolbar-secondary');
                const overlay = secondary.querySelector('.menu-row-delete-confirm');
                expect(overlay.querySelector('.save-confirm-btn.danger')).toExist();
                expect(overlay.querySelector('.save-confirm-btn.cancel')).toExist();
                expect(overlay.querySelector('.menu-row-delete-confirm-text')).toExist();
            });
        });

        it('does NOT render the download glyph inside the secondary toolbar (moved up to primary)', () => {
            return mount(baseLayer()).then(() => {
                const secondary = container.querySelector('.menu-row-toolbar-secondary');
                expect(secondary).toExist();
                expect(secondary.querySelector('.glyphicon-download')).toNotExist();
            });
        });

        it('renders the secondary toolbar when canDelete is true (delete perm present)', () => {
            return mount(baseLayer()).then(() => {
                const secondary = container.querySelector('.menu-row-toolbar-secondary');
                expect(secondary).toExist();
            });
        });
    });

    describe('Aggregate (primary + secondary) — order vis | zoom | edit | download | trash', () => {
        it('the visual reading order, top-to-bottom of the DOM, is vis -> zoom -> edit -> download -> trash', () => {
            return mount(baseLayer()).then(() => {
                const row = container.querySelector('.menu-row');
                expect(row).toExist();
                const glyphs = row.querySelectorAll('.menu-row-glyph');
                // 5 total: 4 in primary, 1 (trash) in secondary
                expect(glyphs.length).toBe(5);
                expect(glyphs[0].className).toInclude('glyphicon-ok');
                expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                expect(glyphs[2].className).toInclude('glyphicon-pencil');
                expect(glyphs[3].className).toInclude('glyphicon-download');
                expect(glyphs[4].className).toInclude('glyphicon-trash');
                expect(glyphs[4].className).toInclude('glyph-delete');
            });
        });
    });

    describe('Disabled state on trash propagates from layer.deleting (R03 invariant)', () => {
        it('adds glyph-disabled + aria-disabled when terrain resource.deleting=true', () => {
            const { MenuRow } = require('../simpleViewMenuRow');
            const store = createMockStore({
                anuga: {
                    projects: { data: { id: 42, my_role: 'editor' } },
                    resources: {
                        terrain: [{ id: 99, gn_layer_name: 'ele_xxxxxx', deleting: true }]
                    }
                }
            });
            return new Promise((resolve) => {
                ReactDOM.render(
                    <Provider store={store}><MenuRow layer={baseLayer()} /></Provider>,
                    container,
                    () => {
                        const trash = container.querySelector('.menu-row-toolbar-secondary .menu-row-glyph.glyphicon-trash');
                        expect(trash).toExist();
                        expect(trash.className).toInclude('glyph-disabled');
                        expect(trash.getAttribute('aria-disabled')).toBe('true');
                        resolve();
                    }
                );
            });
        });
    });
});
