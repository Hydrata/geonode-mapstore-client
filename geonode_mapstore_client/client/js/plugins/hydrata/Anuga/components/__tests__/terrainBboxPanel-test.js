/**
 * TASK-930 (W2-FE) — Karma tests for the Global Copernicus GLO-30 DEM
 * bbox-picker panel. Mounts the connected component against a stub store
 * and asserts:
 *   - Panel hidden vs visible per state.anuga.ui.terrainBboxPanelVisible
 *   - Title input updates internal state
 *   - "Draw bbox" button dispatches a CHANGE_DRAWING_STATUS action with
 *     owner='terrain-bbox'
 *   - Create button disabled until bbox is set + validation passes + title
 *   - Inline error renders when state.anuga.ui.terrainBboxError is set
 *   - Create button dispatches CREATE_TERRAIN_FROM_BBOX with (title, bbox)
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

    it('Create button is DISABLED when terrainBbox is null', () => {
        return mount({ terrainBboxPanelVisible: true }).then(() => {
            const create = container.querySelector('[data-testid="terrain-bbox-create-submit"]');
            expect(create).toExist();
            expect(create.disabled).toBe(true);
        });
    });

    it('Create button is DISABLED when error is set (e.g. bbox > 5x5°)', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [110, -30, 120, -20],
            terrainBboxError: 'hydrata.anuga.terrainBboxTooLarge'
        }).then(() => {
            const create = container.querySelector('[data-testid="terrain-bbox-create-submit"]');
            expect(create.disabled).toBe(true);
        });
    });

    it('Inline error block renders when terrainBboxError is set', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [110, -30, 120, -20],
            terrainBboxError: 'hydrata.anuga.terrainBboxTooLarge'
        }).then(() => {
            const errorBlock = container.querySelector('[data-testid="terrain-bbox-error"]');
            expect(errorBlock).toExist();
            // .alert.alert-danger uses Bootstrap classes; inline (not toast).
            expect(errorBlock.className).toMatch(/alert/);
            expect(errorBlock.className).toMatch(/alert-danger/);
        });
    });

    it('Create button is ENABLED when bbox set, no error, title non-empty', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6]
        }).then(() => {
            const create = container.querySelector('[data-testid="terrain-bbox-create-submit"]');
            expect(create.disabled).toBe(false);
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

    it('Create button click dispatches CREATE_TERRAIN_FROM_BBOX with (title, bbox)', () => {
        return mount({
            terrainBboxPanelVisible: true,
            terrainBbox: [115.7, -32.1, 116.2, -31.6]
        }).then(({ store }) => {
            const create = container.querySelector('[data-testid="terrain-bbox-create-submit"]');
            TestUtils.Simulate.click(create);
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
