/*
 * TASK-1880 (epic 1884 W2 — THE HEADLINE) — Karma DOM tests for the in-app
 * terrain-upload CRS picker. Mounts the connected TerrainUploadCrsPanel against a
 * stub store (the File rides redux) and asserts the three detection paths (D2/D3)
 * plus the crs_override contract thread through the real presign→PUT→finalize
 * chain (AC #7):
 *
 *   detected CRS (hasCrs===true)  → read-only "Detected CRS" display, NO picker,
 *                                   Confirm ENABLED, finalize carries NO crs_override.
 *   missing CRS (hasCrs===false)  → picker REQUIRED, Confirm DISABLED until a CRS is
 *                                   actively picked, then Confirm runs the upload and
 *                                   finalize carries crs_override = the picked CRS.
 *   inconclusive (hasCrs===null)  → optional source-CRS field, Confirm ENABLED even
 *                                   with nothing picked (NEVER block on a parse fail).
 *
 * detectGeotiffCrs is injected as a prop so no geotiff.js / real file is needed.
 * The upload chain is driven through the shared axios (MockAdapter, mirroring the
 * anugaApi orchestrator tests) + a stubbed XMLHttpRequest for the S3 PUT.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import TestUtils from 'react-dom/test-utils';
import MockAdapter from 'axios-mock-adapter';
import axios from '@mapstore/framework/libs/ajax';

const SET_PANEL = 'ANUGA:SET_TERRAIN_UPLOAD_CRS_PANEL';

function createMockStore(uiOverrides = {}, resourceOverrides = {}) {
    const dispatched = [];
    const state = {
        anuga: {
            ui: {
                terrainUploadCrsPanelVisible: true,
                terrainUploadCrsFile: { name: 'dem.tif', type: 'image/tiff', size: 10 },
                terrainUploadCrsTitle: 'dem',
                terrainUploadCrsError: null,
                ...uiOverrides
            },
            projects: { data: { id: 42, projection: 'EPSG:32756' } },
            resources: { terrain: [], ...resourceOverrides }
        },
        layers: { flat: [] },
        gnsettings: { geonodeUrl: 'http://localhost', jobName: 'hydratabase' },
        security: { user: { pk: 9999 } },
        controls: {},
        localConfig: { plugins: {} }
    };
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (action) => {
            dispatched.push(action);
            return action;
        },
        dispatched
    };
}

// Wait for the injected detectGeotiffCrs Promise to resolve and React to settle.
function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TASK-1880 TerrainUploadCrsPanel', () => {
    let container;
    let mockAxios;
    let realXHR;
    let lastXhr;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        mockAxios = new MockAdapter(axios);
        realXHR = global.XMLHttpRequest;
        global.XMLHttpRequest = function() {
            lastXhr = {
                upload: {},
                open() {},
                setRequestHeader() {},
                getResponseHeader() { return '"etag"'; },
                send() {}
            };
            return lastXhr;
        };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        mockAxios.restore();
        global.XMLHttpRequest = realXHR;
    });

    function mount(detectResult, uiOverrides = {}, resourceOverrides = {}) {
        const { TerrainUploadCrsPanel } = require('../terrainUploadCrsPanel');
        const store = createMockStore(uiOverrides, resourceOverrides);
        const detectGeotiffCrs = () => Promise.resolve(detectResult);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><TerrainUploadCrsPanel detectGeotiffCrs={detectGeotiffCrs} /></Provider>,
                container,
                () => resolve({ store })
            );
        }).then((ctx) => flush().then(() => ctx));
    }

    it('does NOT render when terrainUploadCrsPanelVisible=false', () => {
        return mount({ hasCrs: false }, { terrainUploadCrsPanelVisible: false }).then(() => {
            expect(container.querySelector('[data-testid="terrain-crs-panel"]')).toBe(null);
        });
    });

    // ── D2: detected CRS path ─────────────────────────────────────────────
    it('detected CRS → shows read-only Detected CRS, NO picker, Confirm enabled', () => {
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            expect(container.querySelector('[data-testid="terrain-crs-detected"]')).toExist();
            // No picker select when a CRS was detected.
            expect(container.querySelector('[data-testid="terrain-crs-select"]')).toBe(null);
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            expect(confirm.disabled).toBe(false);
        });
    });

    it('detected CRS → Confirm runs the upload and finalize carries NO crs_override', () => {
        mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
            process_id: 'proc-1', staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
        });
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 7, status: 'creating' });
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            TestUtils.Simulate.click(confirm);
            // Drive the stubbed S3 PUT once presign resolves.
            const tick = () => {
                if (lastXhr && lastXhr.onload) { lastXhr.status = 200; lastXhr.onload(); } else { setTimeout(tick, 5); }
            };
            setTimeout(tick, 5);
            return new Promise((resolve) => {
                const poll = () => {
                    const fin = mockAxios.history.post.find(r => /finalize/.test(r.url));
                    if (fin) resolve(fin); else setTimeout(poll, 5);
                };
                poll();
            }).then((fin) => {
                const body = JSON.parse(fin.data);
                expect('crs_override' in body).toBe(false);
            });
        });
    });

    // ── D2 + D3: missing CRS path ─────────────────────────────────────────
    it('missing CRS → picker REQUIRED, Confirm DISABLED until a CRS is actively picked', () => {
        return mount({ hasCrs: false, epsg: null, label: null }).then(() => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            expect(select).toExist();
            // Nothing pre-selected (D3).
            expect(select.value).toBe('');
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            expect(confirm.disabled).toBe(true);
            // Actively pick a CRS → Confirm enables.
            select.value = 'EPSG:32756';
            TestUtils.Simulate.change(select, { target: { value: 'EPSG:32756' } });
            expect(container.querySelector('[data-testid="terrain-crs-confirm"]').disabled).toBe(false);
        });
    });

    it('missing CRS → Confirm runs upload and finalize carries crs_override = the picked CRS', () => {
        mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
            process_id: 'proc-2', staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
        });
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 8, status: 'creating' });
        return mount({ hasCrs: false, epsg: null, label: null }).then(() => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            TestUtils.Simulate.change(select, { target: { value: 'EPSG:32756' } });
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            TestUtils.Simulate.click(confirm);
            const tick = () => {
                if (lastXhr && lastXhr.onload) { lastXhr.status = 200; lastXhr.onload(); } else { setTimeout(tick, 5); }
            };
            setTimeout(tick, 5);
            return new Promise((resolve) => {
                const poll = () => {
                    const fin = mockAxios.history.post.find(r => /finalize/.test(r.url));
                    if (fin) resolve(fin); else setTimeout(poll, 5);
                };
                poll();
            }).then((fin) => {
                const body = JSON.parse(fin.data);
                expect(body.crs_override).toBe('EPSG:32756');
            });
        });
    });

    it('missing CRS + free-text → Confirm disabled until a non-empty EPSG is typed', () => {
        return mount({ hasCrs: false, epsg: null, label: null }).then(() => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            TestUtils.Simulate.change(select, { target: { value: '__freeform__' } });
            // Free-text input appears; still disabled until typed.
            const input = container.querySelector('[data-testid="terrain-crs-freeform-input"]');
            expect(input).toExist();
            expect(container.querySelector('[data-testid="terrain-crs-confirm"]').disabled).toBe(true);
            TestUtils.Simulate.change(input, { target: { value: 'EPSG:2193' } });
            expect(container.querySelector('[data-testid="terrain-crs-confirm"]').disabled).toBe(false);
        });
    });

    // ── D2: inconclusive path ─────────────────────────────────────────────
    it('inconclusive detection → optional field, Confirm enabled with nothing picked', () => {
        return mount({ hasCrs: null, epsg: null, label: null }).then(() => {
            // Picker shown (optional) but not required.
            expect(container.querySelector('[data-testid="terrain-crs-select"]')).toExist();
            expect(container.querySelector('[data-testid="terrain-crs-detected"]')).toBe(null);
            // Never block on a parse failure → Confirm enabled even with no pick.
            expect(container.querySelector('[data-testid="terrain-crs-confirm"]').disabled).toBe(false);
        });
    });

    // ── Cancel ────────────────────────────────────────────────────────────
    it('Cancel closes the panel (SET_TERRAIN_UPLOAD_CRS_PANEL false) without uploading', () => {
        return mount({ hasCrs: false }).then(({ store }) => {
            const cancel = container.querySelector('[data-testid="terrain-crs-cancel"]');
            TestUtils.Simulate.click(cancel);
            const closeAction = store.dispatched.find(a => a.type === SET_PANEL && a.visible === false);
            expect(closeAction).toExist();
            // No presign / finalize fired.
            expect(mockAxios.history.post.length).toBe(0);
        });
    });

    // ── BE 400 surfaced via err.data ──────────────────────────────────────
    it('surfaces the BE finalize 400 in the ErrorStrip (err.data) and keeps the panel open', () => {
        mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
            process_id: 'proc-3', staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
        });
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(400, { detail: 'Unknown CRS code', code: 'VALIDATION_ERROR' });
        return mount({ hasCrs: false }).then(({ store }) => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            TestUtils.Simulate.change(select, { target: { value: 'EPSG:99999' } });
            TestUtils.Simulate.click(container.querySelector('[data-testid="terrain-crs-confirm"]'));
            const tick = () => {
                if (lastXhr && lastXhr.onload) { lastXhr.status = 200; lastXhr.onload(); } else { setTimeout(tick, 5); }
            };
            setTimeout(tick, 5);
            return new Promise((resolve) => {
                const poll = () => {
                    const errAction = store.dispatched.find(a => a.type === 'ANUGA:SET_TERRAIN_UPLOAD_CRS_ERROR' && a.error);
                    if (errAction) resolve(errAction); else setTimeout(poll, 5);
                };
                poll();
            }).then((errAction) => {
                expect(errAction.error).toMatch(/Unknown CRS code/);
                // No panel-close dispatched on failure (modeller can fix + retry).
                const closeAction = store.dispatched.find(a => a.type === SET_PANEL && a.visible === false);
                expect(closeAction).toBe(undefined);
            });
        });
    });
});
