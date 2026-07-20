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
import Localized from '@mapstore/framework/components/I18N/Localized';
const { enData } = require('../../../../../__tests__/fixtures/translations');

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

    let origUmami;
    let umamiCalls;

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
        // TASK-2139 (c.i) — spy so the folded override-vs-detected label can
        // be asserted (trackEvent is (category, action, label) only; a 4th
        // arg is silently dropped, so the distinction must live IN the label).
        umamiCalls = [];
        origUmami = window.umami;
        window.umami = { track: (label, payload) => umamiCalls.push({ label, ...payload }) };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        mockAxios.restore();
        global.XMLHttpRequest = realXHR;
        window.umami = origUmami;
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

    // TASK-2039 (F4) — mounts through the real Localized wrapper (IntlProvider +
    // legacy `messages` context) seeded with the REAL en-US translation file, so
    // <Message> resolves actual strings and tr() resolves real aria-label text —
    // the same wiring the app uses in production. The plain `mount()` helper
    // above renders WITHOUT an intl context (Message.jsx's raw-msgId fallback),
    // so it cannot prove the i18n bug is fixed; this one can.
    function mountLocalized(detectResult, uiOverrides = {}, resourceOverrides = {}) {
        const { TerrainUploadCrsPanel } = require('../terrainUploadCrsPanel');
        const store = createMockStore(uiOverrides, resourceOverrides);
        const detectGeotiffCrs = () => Promise.resolve(detectResult);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}>
                    <Localized locale="en-US" messages={enData.messages}>
                        <TerrainUploadCrsPanel detectGeotiffCrs={detectGeotiffCrs} />
                    </Localized>
                </Provider>,
                container,
                () => resolve({ store })
            );
        }).then((ctx) => flush().then(() => ctx));
    }

    // ── TASK-2039 (F4): i18n + detected-CRS + a11y ─────────────────────────
    describe('TASK-2039 i18n + detected CRS + a11y', () => {
        it('detected CRS → renders NO raw "terrainCrs" key text, and shows the interpolated CRS', () => {
            return mountLocalized({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
                const panel = container.querySelector('[data-testid="terrain-crs-panel"]');
                expect(panel).toExist();
                // No raw msgId fragment anywhere in the rendered panel (title, labels,
                // detected-CRS row, footer buttons).
                expect(container.textContent).toNotMatch(/terrainCrs/);
                // The detected-CRS row surfaces the ACTUAL CRS to the user (the
                // dogfood finding: "hides the detected CRS ... user CANNOT see which
                // CRS was detected").
                const detected = container.querySelector('[data-testid="terrain-crs-detected"]');
                expect(detected).toExist();
                expect(detected.textContent).toMatch(/EPSG:32756/);
            });
        });

        it('missing CRS (picker required) → renders NO raw "terrainCrs" key text', () => {
            return mountLocalized({ hasCrs: false, epsg: null, label: null }).then(() => {
                expect(container.textContent).toNotMatch(/terrainCrs/);
            });
        });

        it('footer buttons carry real accessible names (aria-label), not raw msgIds', () => {
            return mountLocalized({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
                const cancel = container.querySelector('[data-testid="terrain-crs-cancel"]');
                const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
                expect(cancel.getAttribute('aria-label')).toBe('Cancel');
                expect(confirm.getAttribute('aria-label')).toBe('Confirm');
            });
        });

        it('panel title and labels render real English text (not raw msgIds)', () => {
            return mountLocalized({ hasCrs: false, epsg: null, label: null }).then(() => {
                const panel = container.querySelector('[data-testid="terrain-crs-panel"]');
                expect(panel.textContent).toMatch(/Title/);
                expect(panel.textContent).toMatch(/coordinate system/i);
            });
        });
    });

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
            // TASK-2139 (c.i): 3-arg trackEvent, override-vs-detected folded
            // into the label (was a 4th arg, silently dropped).
            expect(umamiCalls.map(c => c.label)).toInclude('anuga-terrain-direct-upload-detected-crs');
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
            // TASK-2139 (c.i): override case gets the sibling label.
            expect(umamiCalls.map(c => c.label)).toInclude('anuga-terrain-direct-upload-with-crs-override');
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

    // ── Priority-1 shortcut: existing-terrain CRS (TASK-1880 review follow-up) ──
    // The product-owner-verbatim priority-1 shortcut reads each terrain row's
    // SOURCE CRS off `native_crs` (the field TerrainSerializerV2.get_native_crs
    // exposes), NOT a (non-existent) `crs` field. Feed real terrain rows and assert
    // their EPSG codes render as Suggested <option>s in the picker.
    it('existing-terrain CRS → priority-1 shortcut renders an option per native_crs', () => {
        return mount({ hasCrs: false, epsg: null, label: null }, {}, {
            terrain: [{ native_crs: 'EPSG:28356' }, { native_crs: 'EPSG:32756' }]
        }).then(() => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            expect(select).toExist();
            const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
            expect(optionValues).toContain('EPSG:28356');
            expect(optionValues).toContain('EPSG:32756');
            // Picking the shortcut threads through to Confirm (proves it is a real
            // selectable option, not a dead label).
            TestUtils.Simulate.change(select, { target: { value: 'EPSG:28356' } });
            expect(container.querySelector('[data-testid="terrain-crs-confirm"]').disabled).toBe(false);
        });
    });

    it('terrain row with a legacy `crs` key but no `native_crs` → NO shortcut option', () => {
        return mount({ hasCrs: false, epsg: null, label: null }, {}, {
            // A row carrying ONLY the wrong/legacy `crs` field must not produce a
            // shortcut — this pins the fix so it cannot silently regress to reading
            // `crs`. (projection EPSG:32756 still seeds the shortcut from the project,
            // so assert the `crs`-only EPSG:28356 specifically does NOT appear.)
            terrain: [{ crs: 'EPSG:28356' }]
        }).then(() => {
            const select = container.querySelector('[data-testid="terrain-crs-select"]');
            expect(select).toExist();
            const suggested = select.querySelector('optgroup[label="Suggested"]');
            const suggestedValues = suggested
                ? Array.from(suggested.querySelectorAll('option')).map((o) => o.value)
                : [];
            expect(suggestedValues).toNotContain('EPSG:28356');
        });
    });

    // ── TASK-1881: nav guard (beforeunload) ───────────────────────────────
    it('TASK-1881: registers a beforeunload handler on Confirm click and removes it on success', () => {
        mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
            process_id: 'proc-ng1', staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
        });
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 20 });

        const added = [];
        const removed = [];
        const realAdd = window.addEventListener.bind(window);
        const realRemove = window.removeEventListener.bind(window);
        window.addEventListener = (type, fn, ...rest) => { if (type === 'beforeunload') added.push(fn); realAdd(type, fn, ...rest); };
        window.removeEventListener = (type, fn, ...rest) => { if (type === 'beforeunload') removed.push(fn); realRemove(type, fn, ...rest); };

        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            TestUtils.Simulate.click(confirm);
            // Nav guard should be registered immediately (synchronous, before first await).
            expect(added.length).toBe(1);
            const tick = () => {
                if (lastXhr && lastXhr.onload) { lastXhr.status = 200; lastXhr.onload(); } else { setTimeout(tick, 5); }
            };
            setTimeout(tick, 5);
            return new Promise((resolve) => {
                const poll = () => {
                    const fin = mockAxios.history.post.find(r => /finalize/.test(r.url));
                    if (fin) resolve(); else setTimeout(poll, 5);
                };
                poll();
            }).then(() => new Promise((resolve) => setTimeout(resolve, 20))).then(() => {
                window.addEventListener = realAdd;
                window.removeEventListener = realRemove;
                // Guard removed after success.
                expect(removed.length).toBe(1);
                expect(removed[0]).toBe(added[0]);
            });
        });
    });

    it('TASK-1881: removes beforeunload handler on finalize failure (panel stays open for retry)', () => {
        mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
            process_id: 'proc-ng2', staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
        });
        // Use 400 (terminal 4xx) so the retry wrapper re-throws immediately
        // without a 1s delay — the nav-guard removal contract holds for all
        // failure types (4xx terminal just arrives faster in the test).
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(400, { detail: 'Unknown CRS code', code: 'VALIDATION_ERROR' });

        const added = [];
        const removed = [];
        const realAdd = window.addEventListener.bind(window);
        const realRemove = window.removeEventListener.bind(window);
        window.addEventListener = (type, fn, ...rest) => { if (type === 'beforeunload') added.push(fn); realAdd(type, fn, ...rest); };
        window.removeEventListener = (type, fn, ...rest) => { if (type === 'beforeunload') removed.push(fn); realRemove(type, fn, ...rest); };

        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(({ store }) => {
            const confirm = container.querySelector('[data-testid="terrain-crs-confirm"]');
            TestUtils.Simulate.click(confirm);
            expect(added.length).toBe(1);
            const tick = () => {
                if (lastXhr && lastXhr.onload) { lastXhr.status = 200; lastXhr.onload(); } else { setTimeout(tick, 5); }
            };
            setTimeout(tick, 5);
            return new Promise((resolve) => {
                const poll = () => {
                    const errAction = store.dispatched.find(a => a.type === 'ANUGA:SET_TERRAIN_UPLOAD_CRS_ERROR');
                    if (errAction) resolve(); else setTimeout(poll, 5);
                };
                poll();
            }).then(() => new Promise((resolve) => setTimeout(resolve, 20))).then(() => {
                window.addEventListener = realAdd;
                window.removeEventListener = realRemove;
                // Guard removed after failure too (panel stays open but upload is not in flight).
                expect(removed.length).toBe(1);
                expect(removed[0]).toBe(added[0]);
            });
        });
    });

    // ── epic 2323 / TASK-2327 (re-aim): vertical-datum declaration in the upload path ──
    const presignOk = (pid) => mockAxios.onPost(/terrain\/upload\/presign\/$/).reply(201, {
        process_id: pid, staging_key: 'k', upload_url: 'https://s3/u?sig=1', content_type: 'image/tiff'
    });
    const drivePutThenFinalize = () => {
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
        });
    };

    it('no embedded vertical CRS → shows the vertical-datum picker (3 options), default "not sure"', () => {
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            expect(container.querySelector('[data-testid="terrain-vdatum-picker"]')).toExist();
            expect(container.querySelector('[data-testid="terrain-vdatum-ellipsoid"]')).toExist();
            expect(container.querySelector('[data-testid="terrain-vdatum-orthometric_egm2008"]')).toExist();
            const unsure = container.querySelector('[data-testid="terrain-vdatum-unsure"]');
            expect(unsure).toExist();
            expect(unsure.checked).toBe(true);
            expect(container.querySelector('[data-testid="terrain-vdatum-detected"]')).toBe(null);
        });
    });

    it('declaring EGM2008 → finalize carries vertical_datum_declared', () => {
        presignOk('proc-vd1');
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 30, status: 'creating' });
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            const egm = container.querySelector('[data-testid="terrain-vdatum-orthometric_egm2008"]');
            TestUtils.Simulate.change(egm, { target: { checked: true } });
            TestUtils.Simulate.click(container.querySelector('[data-testid="terrain-crs-confirm"]'));
            return drivePutThenFinalize().then((fin) => {
                expect(JSON.parse(fin.data).vertical_datum_declared).toBe('orthometric_egm2008');
            });
        });
    });

    it('default "not sure" → finalize carries NO vertical_datum_declared', () => {
        presignOk('proc-vd2');
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 31, status: 'creating' });
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756' }).then(() => {
            TestUtils.Simulate.click(container.querySelector('[data-testid="terrain-crs-confirm"]'));
            return drivePutThenFinalize().then((fin) => {
                expect('vertical_datum_declared' in JSON.parse(fin.data)).toBe(false);
            });
        });
    });

    it('embedded vertical CRS (EGM2008) → read-only detected row, NO picker, finalize carries the detected datum', () => {
        presignOk('proc-vd3');
        mockAxios.onPost(/terrain\/upload\/finalize\/$/).reply(202, { id: 32, status: 'creating' });
        return mount({ hasCrs: true, epsg: 32756, label: 'EPSG:32756', verticalEpsg: 3855, verticalLabel: 'EPSG:3855', verticalDatumGuess: 'orthometric_egm2008' }).then(() => {
            expect(container.querySelector('[data-testid="terrain-vdatum-detected"]')).toExist();
            expect(container.querySelector('[data-testid="terrain-vdatum-picker"]')).toBe(null);
            TestUtils.Simulate.click(container.querySelector('[data-testid="terrain-crs-confirm"]'));
            return drivePutThenFinalize().then((fin) => {
                expect(JSON.parse(fin.data).vertical_datum_declared).toBe('orthometric_egm2008');
            });
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
