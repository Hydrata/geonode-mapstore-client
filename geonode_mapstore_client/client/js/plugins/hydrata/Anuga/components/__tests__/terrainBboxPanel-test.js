/**
 * TASK-930 (W2-FE) — Karma tests for the Global Copernicus GLO-30 DEM
 * bbox-picker panel. Mounts the connected component against a stub store
 * and asserts:
 *   - Panel hidden vs visible per state.anuga.ui.terrainBboxPanelVisible
 *   - Title input updates internal state
 *   - "Draw bbox" button dispatches a CHANGE_DRAWING_STATUS action with
 *     owner='terrain-bbox'
 *   - Confirm-dialog Accept button disabled when the geodesic area exceeds
 *     MAX_AREA_KM2 (the too-large message shows), enabled otherwise
 *   - Inline error renders when state.anuga.ui.terrainBboxError is set
 *   - Confirm-dialog Accept dispatches CREATE_TERRAIN_FROM_BBOX with
 *     (title, bbox) and closes the panel via SET_VISIBLE_TERRAIN_BBOX_PANEL=false
 *   - Cancel button hides the panel via SET_VISIBLE_TERRAIN_BBOX_PANEL=false
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import TestUtils from 'react-dom/test-utils';

function createMockStore(uiOverrides = {}) {
    const dispatched = [];
    const state = {
        anuga: {
            ui: {
                terrainBboxPanelVisible: false,
                terrainBboxDrawingActive: false,
                terrainBbox: null,
                terrainBboxError: null,
                ...uiOverrides
            },
            projects: { data: { id: 42 } }
        }
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

describe('TASK-930 TerrainBboxPanel', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function mount(uiOverrides) {
        const { TerrainBboxPanel } = require('../terrainBboxPanel');
        const store = createMockStore(uiOverrides);
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store}><TerrainBboxPanel /></Provider>,
                container,
                () => resolve({ store, container })
            );
        });
    }

    it('does NOT render when terrainBboxPanelVisible=false', () => {
        return mount({ terrainBboxPanelVisible: false }).then(() => {
            const panel = container.querySelector('[data-testid="terrain-bbox-panel"]');
            expect(panel).toBe(null);
        });
    });

    it('renders when terrainBboxPanelVisible=true', () => {
        return mount({ terrainBboxPanelVisible: true }).then(() => {
            const panel = container.querySelector('[data-testid="terrain-bbox-panel"]');
            expect(panel).toExist();
            // Title input has the default text seeded
            const titleInput = container.querySelector('[data-testid="terrain-bbox-title-input"]');
            expect(titleInput).toExist();
            expect(titleInput.value).toBe('Copernicus GLO-30 DEM');
        });
    });

    it('shows "no bbox drawn yet" placeholder when terrainBbox=null', () => {
        return mount({ terrainBboxPanelVisible: true }).then(() => {
            const summary = container.querySelector('[data-testid="terrain-bbox-summary"]');
            expect(summary).toExist();
            // Inner text is the raw i18n key at test time.
            expect(summary.textContent).toMatch(/terrainBboxNoBbox|No bbox/);
        });
    });

    it('renders the drawn bbox extent when terrainBbox is populated', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6]
        }).then(() => {
            const summary = container.querySelector('[data-testid="terrain-bbox-summary"]');
            expect(summary).toExist();
            expect(summary.textContent).toMatch(/115\.7/);
            expect(summary.textContent).toMatch(/-32\.1/);
            expect(summary.textContent).toMatch(/116\.2/);
            expect(summary.textContent).toMatch(/-31\.6/);
        });
    });

    // TASK-1647 dissolved the separate confirm popup (.terrain-bbox-confirm-dialog
    // / is-open) into an INLINE review section that appears in the panel body once
    // a bbox is drawn (presence-gated on terrainBbox, not on a confirmVisible flag).
    // This test was pre-existing-RED against the popup DOM that no longer exists;
    // it now asserts the inline-review reality.
    it('Inline review + Accept button render once a bbox is drawn', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6],
            terrainBboxAreaKm2: 1752
        }).then(() => {
            const review = container.querySelector('[data-testid="terrain-bbox-inline-review"]');
            expect(review).toExist();
            const accept = container.querySelector('[data-testid="terrain-bbox-confirm-accept"]');
            expect(accept).toExist();
        });
    });

    it('Confirm-dialog Accept is DISABLED and the too-large message shows when areaKm2 > 40000', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBboxConfirmVisible: true,
            terrainBbox: [110, -30, 120, -20],
            terrainBboxAreaKm2: 50000
        }).then(() => {
            const accept = container.querySelector('[data-testid="terrain-bbox-confirm-accept"]');
            expect(accept).toExist();
            expect(accept.disabled).toBe(true);
            // The too-large warning replaces the area/cells/time stats.
            const tooLarge = container.querySelector('[data-testid="terrain-bbox-confirm-toolarge"]');
            expect(tooLarge).toExist();
        });
    });

    it('Inline error block renders when terrainBboxError is set', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [110, -30, 120, -20],
            terrainBboxError: 'hydrata.anuga.terrainBboxInvalid'
        }).then(() => {
            const errorBlock = container.querySelector('[data-testid="terrain-bbox-error"]');
            expect(errorBlock).toExist();
            // .alert.alert-danger uses Bootstrap classes; inline (not toast).
            expect(errorBlock.className).toMatch(/alert/);
            expect(errorBlock.className).toMatch(/alert-danger/);
        });
    });

    it('Confirm-dialog Accept is ENABLED when bbox + title set and areaKm2 <= 40000', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBboxConfirmVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6],
            terrainBboxAreaKm2: 1752
        }).then(() => {
            // Default title is seeded; bbox present; area under the cap.
            const accept = container.querySelector('[data-testid="terrain-bbox-confirm-accept"]');
            expect(accept).toExist();
            expect(accept.disabled).toBe(false);
            const titleInput = container.querySelector('[data-testid="terrain-bbox-title-input"]');
            expect(titleInput.value).toBe('Copernicus GLO-30 DEM');
        });
    });

    it('Draw button click dispatches CHANGE_DRAWING_STATUS with owner=terrain-bbox', () => {
        return mount({ terrainBboxPanelVisible: true }).then(({ store }) => {
            const drawBtn = container.querySelector('[data-testid="terrain-bbox-draw-button"]');
            TestUtils.Simulate.click(drawBtn);
            const drawAction = store.dispatched.find(a => a.type === 'CHANGE_DRAWING_STATUS');
            expect(drawAction).toExist();
            expect(drawAction.method).toBe('BBOX');
            expect(drawAction.owner).toBe('terrain-bbox');
        });
    });

    it('Confirm-dialog Accept click dispatches CREATE_TERRAIN_FROM_BBOX with (title, bbox) and closes the panel', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBboxConfirmVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6],
            terrainBboxAreaKm2: 1752
        }).then(({ store }) => {
            const accept = container.querySelector('[data-testid="terrain-bbox-confirm-accept"]');
            TestUtils.Simulate.click(accept);
            const createAction = store.dispatched.find(a => a.type === 'ANUGA:CREATE_TERRAIN_FROM_BBOX');
            expect(createAction).toExist();
            expect(createAction.title).toBe('Copernicus GLO-30 DEM');
            expect(createAction.bbox).toEqual([115.7, -32.1, 116.2, -31.6]);
            // And closes the panel.
            const closeAction = store.dispatched.find(a =>
                a.type === 'SET_VISIBLE_TERRAIN_BBOX_PANEL' && a.visible === false
            );
            expect(closeAction).toExist();
        });
    });

    it('Cancel button click dispatches SET_VISIBLE_TERRAIN_BBOX_PANEL=false', () => {
        return mount({ terrainBboxPanelVisible: true }).then(({ store }) => {
            const cancel = container.querySelector('[data-testid="terrain-bbox-cancel"]');
            TestUtils.Simulate.click(cancel);
            const closeAction = store.dispatched.find(a =>
                a.type === 'SET_VISIBLE_TERRAIN_BBOX_PANEL' && a.visible === false
            );
            expect(closeAction).toExist();
        });
    });
});

describe('TASK-930 terrainBboxEpic.extractBboxFromDrawAction', () => {
    it('extracts bbox from a Polygon geometry in EPSG:4326', () => {
        const { extractBboxFromDrawAction } = require('../../epics/terrainBboxEpic');
        const action = {
            owner: 'terrain-bbox',
            geometry: {
                type: 'Polygon',
                projection: 'EPSG:4326',
                coordinates: [[
                    [115.7, -32.1], [116.2, -32.1], [116.2, -31.6], [115.7, -31.6], [115.7, -32.1]
                ]]
            }
        };
        const bbox = extractBboxFromDrawAction(action);
        expect(bbox).toEqual([115.7, -32.1, 116.2, -31.6]);
    });

    it('returns null for an unrecognised geometry shape', () => {
        const { extractBboxFromDrawAction } = require('../../epics/terrainBboxEpic');
        expect(extractBboxFromDrawAction({ owner: 'terrain-bbox', geometry: null })).toBe(null);
        expect(extractBboxFromDrawAction({})).toBe(null);
    });
});

// UAT regression (TASK-1648 mount-gating freeze):
//
// "Define import area" closes the Inputs menu (setAnugaInputMenu(false)) to clear
// the map for drawing. The Inputs menu is mounted by AnugaContainer only when
// showAnugaInputMenu===true (anugaContainer:206). The bbox panel USED to be a
// child of AnugaInputMenu, so closing the menu unmounted the bbox panel mid-draw —
// the map was left in BBOX draw mode with no panel to return to (the "freeze"; the
// bbox was never captured and the Import Terrain panel never came back).
//
// Fix: TerrainBboxPanel is now mounted at the CONTAINER level, independent of
// showAnugaInputMenu. This test renders the bare AnugaContainer with the Inputs
// menu CLOSED (showAnugaInputMenu=false) but the bbox panel OPEN
// (terrainBboxPanelVisible=true) and asserts the panel is present — i.e. it
// survives the menu close.
describe('TASK-1648 GLO-30 bbox panel survives Inputs-menu close (UAT freeze regression)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    function store(uiOverrides) {
        const state = {
            anuga: {
                projects: { data: { id: 42 } },
                ui: {
                    showAnugaInputMenu: false,
                    terrainBboxPanelVisible: false,
                    terrainBboxDrawingActive: false,
                    terrainBbox: null,
                    terrainBboxError: null,
                    ...uiOverrides
                }
            }
        };
        return { getState: () => state, subscribe: () => () => {}, dispatch: (a) => a };
    }

    function renderContainer(uiOverrides) {
        const { AnugaContainer } = require('../anugaContainer');
        return new Promise((resolve) => {
            ReactDOM.render(
                <Provider store={store(uiOverrides)}>
                    {/* Bare class: pass the props the connected wrapper would supply.
                        showAnugaInputMenu=false ⇒ AnugaInputMenu (the old bbox-panel
                        host) is NOT mounted, exactly the post-"Define import area" state. */}
                    <AnugaContainer
                        isAnugaProject={42}
                        showAnugaInputMenu={false}
                        canViewAnugaMap={false}
                        canEditAnugaMap={false}
                        hasEPSGset
                        initAnuga={() => {}}
                    />
                </Provider>,
                container,
                () => resolve()
            );
        });
    }

    it('does NOT mount the Inputs menu when showAnugaInputMenu=false', () => {
        return renderContainer({ showAnugaInputMenu: false, terrainBboxPanelVisible: true }).then(() => {
            expect(container.querySelector('#anuga-input-menu')).toBe(null);
        });
    });

    it('STILL renders the bbox panel after the Inputs menu is closed (no freeze)', () => {
        return renderContainer({ showAnugaInputMenu: false, terrainBboxPanelVisible: true }).then(() => {
            const panel = container.querySelector('[data-testid="terrain-bbox-panel"]');
            expect(panel).toExist();
        });
    });

    it('the captured bbox + inline review survive the menu close', () => {
        return renderContainer({
            showAnugaInputMenu: false,
            terrainBboxPanelVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6],
            terrainBboxAreaKm2: 1752
        }).then(() => {
            const summary = container.querySelector('[data-testid="terrain-bbox-summary"]');
            expect(summary).toExist();
            expect(summary.textContent).toMatch(/115\.7/);
            const review = container.querySelector('[data-testid="terrain-bbox-inline-review"]');
            expect(review).toExist();
        });
    });
});
