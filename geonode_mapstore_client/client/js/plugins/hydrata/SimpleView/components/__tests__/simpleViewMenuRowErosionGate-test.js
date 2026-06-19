/*
 * Tests for simpleViewMenuRow.js — TASK-602 erosion upload button JOB_NAME gating.
 *
 * Bug: the upload glyph next to each layer was hardcoded to dispatch
 *   setVisibleUploaderPanel(true, "erosion", layer?.importerTargetObjectId)
 * which is a SWAMM-only flow. On hydratabase (hydrata.com), AnugaProjects only
 * have a "terrain" entry in their simple_view_config.importer_config, so the
 * click resolved to an undefined config and produced /undefined/api/.../erosion/...
 * URLs in production (TASK-599 added the /undefined/ guard; this test verifies
 * the orphan button is no longer rendered in the first place).
 *
 * Gating: state.gnsettings.jobName is exposed via the hydrata-only
 * `jobName: '{{ job_name }}'` line in _geonode_config.html. The MenuRow renders
 * the upload glyph only when jobName === 'swamm'.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

function createMockStore(overrides = {}) {
    const defaults = {
        simpleView: { openMenuGroupId: null, config: {} },
        layers: { flat: [], groups: [] },
        gnresource: { initialResource: { perms: ['change_resourcebase', 'download_resourcebase'] } },
        gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
        controls: {},
        localConfig: { plugins: { map_viewer: [] } }
    };
    const merged = {
        ...defaults,
        ...overrides,
        gnsettings: { ...defaults.gnsettings, ...(overrides.gnsettings || {}) },
        gnresource: { ...defaults.gnresource, ...(overrides.gnresource || {}) }
    };
    return {
        getState: () => merged,
        subscribe: () => {},
        dispatch: () => {}
    };
}

function makeDownloadableLayer() {
    return {
        id: 'l1',
        visibility: true,
        group: 'grp.sub',
        type: 'wms',
        title: 'A Layer',
        name: 'layer_l1',
        opacity: 1,
        // canExportLayer requires download_resourcebase on the LAYER, not the resource
        perms: ['download_resourcebase'],
        importerTargetObjectId: 9999
    };
}

describe('simpleViewMenuRow erosion upload gating (TASK-602)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('test_erosion_upload_glyph_hidden_on_hydratabase', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            gnsettings: { geonodeUrl: 'https://hydrata.com', jobName: 'hydratabase' }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={makeDownloadableLayer()} />
            </Provider>,
            container,
            () => {
                // Download glyph (always present when canExportLayer)
                const download = container.querySelector('.glyphicon-download');
                expect(download).toExist();
                // Upload glyph (erosion-only) — must NOT be rendered on hydratabase
                const upload = container.querySelector('.glyphicon-upload');
                expect(upload).toBe(null);
                done();
            }
        );
    });

    it('test_erosion_upload_glyph_visible_on_swamm', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            gnsettings: { geonodeUrl: 'https://theswamm.com', jobName: 'swamm' }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={makeDownloadableLayer()} />
            </Provider>,
            container,
            () => {
                const upload = container.querySelector('.glyphicon-upload');
                expect(upload).toExist();
                expect(upload.className).toInclude('sv-glyph-active');
                done();
            }
        );
    });

    it('test_erosion_upload_glyph_hidden_on_nicp', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            gnsettings: { geonodeUrl: 'https://nicaraguahydroportal.com', jobName: 'nicp' }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={makeDownloadableLayer()} />
            </Provider>,
            container,
            () => {
                const upload = container.querySelector('.glyphicon-upload');
                expect(upload).toBe(null);
                done();
            }
        );
    });

    it('test_erosion_upload_glyph_hidden_on_sararaportal', (done) => {
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            gnsettings: { geonodeUrl: 'https://sararaportal.com', jobName: 'sararaportal' }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={makeDownloadableLayer()} />
            </Provider>,
            container,
            () => {
                const upload = container.querySelector('.glyphicon-upload');
                expect(upload).toBe(null);
                done();
            }
        );
    });

    it('test_erosion_upload_glyph_hidden_when_jobname_missing', (done) => {
        // Defensive: if jobName isn't injected (older deploys, dev shells), default
        // to NOT showing the orphan button rather than reverting to broken behaviour.
        const { MenuRow } = require('../simpleViewMenuRow');
        const store = createMockStore({
            gnsettings: { geonodeUrl: 'https://hydrata.com' /* no jobName */ }
        });
        ReactDOM.render(
            <Provider store={store}>
                <MenuRow layer={makeDownloadableLayer()} />
            </Provider>,
            container,
            () => {
                const upload = container.querySelector('.glyphicon-upload');
                expect(upload).toBe(null);
                done();
            }
        );
    });
});
