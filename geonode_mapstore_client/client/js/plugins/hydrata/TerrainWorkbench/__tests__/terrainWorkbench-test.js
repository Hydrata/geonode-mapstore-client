/**
 * TASK-1599 / TASK-1600 (W1) — TerrainWorkbench unit tests.
 *
 * Tests cover:
 *  1. Reducer: default state, SET_SECTION, SET_VISIBLE actions (shell).
 *  2. Reducer: recipe state — TW_LOAD_DATA, TW_LOAD_DATA_SUCCESS,
 *     TW_CREATE_SURFACE_SUCCESS, TW_UPDATE_SURFACE_SUCCESS,
 *     TW_DELETE_SURFACE_SUCCESS, TW_DERIVE / TW_DERIVE_SUCCESS /
 *     TW_DERIVE_COMPLETE.
 *  3. Action creators: setTerrainWorkbenchSection, setTerrainWorkbenchVisible,
 *     twCreateSurface, twDerive, twDeriveSuccess, twDeriveComplete.
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

import reducer from '../reducersTerrainWorkbench';
import {
    TERRAIN_WORKBENCH_SET_SECTION,
    TERRAIN_WORKBENCH_SET_VISIBLE,
    setTerrainWorkbenchSection,
    setTerrainWorkbenchVisible,
    TW_LOAD_DATA,
    TW_LOAD_DATA_SUCCESS,
    TW_LOAD_DATA_ERROR,
    TW_SELECT_SURFACE,
    TW_CREATE_SURFACE,
    TW_CREATE_SURFACE_SUCCESS,
    TW_UPDATE_SURFACE_SUCCESS,
    TW_DELETE_SURFACE_SUCCESS,
    TW_SET_DESIGN_INPUTS_SUCCESS,
    TW_DERIVE,
    TW_DERIVE_SUCCESS,
    TW_DERIVE_ERROR,
    TW_DERIVE_COMPLETE,
    twLoadDataSuccess,
    twCreateSurface,
    twDerive,
    twDeriveSuccess,
    twDeriveComplete,
} from '../actionsTerrainWorkbench';
import { TerrainWorkbenchPanel } from '../components/TerrainWorkbenchPanel';

// ---------------------------------------------------------------------------
// Reducer — shell tests (TASK-1599)
// ---------------------------------------------------------------------------

describe('TerrainWorkbench reducer — shell', () => {
    it('returns default state', () => {
        const state = reducer(undefined, {});
        expect(state.activeSection).toEqual('terrain');
        expect(state.visible).toEqual(false);
    });

    it('handles SET_SECTION', () => {
        const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_SECTION, section: 'delineation' });
        expect(state.activeSection).toEqual('delineation');
    });

    it('handles SET_VISIBLE', () => {
        const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible: true });
        expect(state.visible).toEqual(true);
    });

    it('switches to each valid section', () => {
        const sections = ['terrain', 'delineation', 'catchments'];
        sections.forEach((section) => {
            const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_SECTION, section });
            expect(state.activeSection).toEqual(section);
        });
    });

    it('preserves other state on SET_SECTION', () => {
        const initial = { activeSection: 'terrain', visible: true, extra: 'preserved' };
        const next = reducer(initial, { type: TERRAIN_WORKBENCH_SET_SECTION, section: 'catchments' });
        expect(next.visible).toEqual(true);
        expect(next.extra).toEqual('preserved');
    });
});

// ---------------------------------------------------------------------------
// Reducer — recipe state (TASK-1600)
// ---------------------------------------------------------------------------

describe('TerrainWorkbench reducer — recipe state', () => {
    it('TW_LOAD_DATA sets loading=true', () => {
        const state = reducer(undefined, { type: TW_LOAD_DATA });
        expect(state.loading).toEqual(true);
        expect(state.error).toEqual(null);
    });

    it('TW_LOAD_DATA_SUCCESS stores terrains + surfaces, clears loading', () => {
        const terrains = [{ id: 1, title: 'DEM A' }];
        const surfaces = [{ id: 10, title: 'Surface 1', is_stale: false }];
        const state = reducer(undefined, { type: TW_LOAD_DATA_SUCCESS, terrains, surfaces });
        expect(state.loading).toEqual(false);
        expect(state.terrains).toEqual(terrains);
        expect(state.surfaces).toEqual(surfaces);
    });

    it('TW_LOAD_DATA_ERROR stores error, clears loading', () => {
        const state = reducer(undefined, { type: TW_LOAD_DATA_ERROR, error: 'Network error' });
        expect(state.loading).toEqual(false);
        expect(state.error).toEqual('Network error');
    });

    it('TW_SELECT_SURFACE stores selectedSurfaceId', () => {
        const state = reducer(undefined, { type: TW_SELECT_SURFACE, surfaceId: 42 });
        expect(state.selectedSurfaceId).toEqual(42);
    });

    it('TW_CREATE_SURFACE sets saving=true', () => {
        const state = reducer(undefined, { type: TW_CREATE_SURFACE, payload: {} });
        expect(state.saving).toEqual(true);
    });

    it('TW_CREATE_SURFACE_SUCCESS adds surface + selects it', () => {
        const surface = { id: 5, title: 'New', is_stale: true };
        const initial = { ...reducer(undefined, {}), surfaces: [] };
        const state = reducer(initial, { type: TW_CREATE_SURFACE_SUCCESS, surface });
        expect(state.surfaces.length).toEqual(1);
        expect(state.surfaces[0].id).toEqual(5);
        expect(state.selectedSurfaceId).toEqual(5);
        expect(state.saving).toEqual(false);
    });

    it('TW_UPDATE_SURFACE_SUCCESS merges surface by id', () => {
        const surfaces = [
            { id: 1, title: 'Old', feather_width_m: 50 },
            { id: 2, title: 'Other' },
        ];
        const initial = { ...reducer(undefined, {}), surfaces };
        const updated = { id: 1, title: 'Updated', feather_width_m: 100 };
        const state = reducer(initial, { type: TW_UPDATE_SURFACE_SUCCESS, surface: updated });
        expect(state.surfaces[0].feather_width_m).toEqual(100);
        expect(state.surfaces[0].title).toEqual('Updated');
        expect(state.surfaces[1].id).toEqual(2); // unchanged
    });

    it('TW_DELETE_SURFACE_SUCCESS removes surface + clears selection', () => {
        const surfaces = [{ id: 1 }, { id: 2 }];
        const initial = { ...reducer(undefined, {}), surfaces, selectedSurfaceId: 1 };
        const state = reducer(initial, { type: TW_DELETE_SURFACE_SUCCESS, surfaceId: 1 });
        expect(state.surfaces.length).toEqual(1);
        expect(state.surfaces[0].id).toEqual(2);
        expect(state.selectedSurfaceId).toEqual(null);
    });

    it('TW_DELETE_SURFACE_SUCCESS preserves selection if different surface deleted', () => {
        const surfaces = [{ id: 1 }, { id: 2 }];
        const initial = { ...reducer(undefined, {}), surfaces, selectedSurfaceId: 2 };
        const state = reducer(initial, { type: TW_DELETE_SURFACE_SUCCESS, surfaceId: 1 });
        expect(state.selectedSurfaceId).toEqual(2);
    });

    it('TW_SET_DESIGN_INPUTS_SUCCESS merges surface', () => {
        const surfaces = [{ id: 3, design_inputs_ordered: [] }];
        const initial = { ...reducer(undefined, {}), surfaces };
        const updated = { id: 3, design_inputs_ordered: [{ terrain: 5, priority: 0 }] };
        const state = reducer(initial, { type: TW_SET_DESIGN_INPUTS_SUCCESS, surface: updated });
        expect(state.surfaces[0].design_inputs_ordered.length).toEqual(1);
    });

    it('TW_DERIVE sets deriving=true, clears errors', () => {
        const state = reducer(undefined, { type: TW_DERIVE, surfaceId: 7 });
        expect(state.deriving).toEqual(true);
        expect(state.deriveError).toEqual(null);
        expect(state.derivingProcessId).toEqual(null);
    });

    it('TW_DERIVE_SUCCESS stores processId, stays deriving=true', () => {
        const initial = { ...reducer(undefined, {}), deriving: true };
        const state = reducer(initial, { type: TW_DERIVE_SUCCESS, surfaceId: 7, processId: 99 });
        expect(state.derivingProcessId).toEqual(99);
        expect(state.deriving).toEqual(true);
    });

    it('TW_DERIVE_ERROR clears deriving, stores error', () => {
        const initial = { ...reducer(undefined, {}), deriving: true };
        const state = reducer(initial, { type: TW_DERIVE_ERROR, error: 'failed' });
        expect(state.deriving).toEqual(false);
        expect(state.deriveError).toEqual('failed');
    });

    it('TW_DERIVE_COMPLETE merges surface, clears deriving', () => {
        const surfaces = [{ id: 7, is_stale: true }];
        const initial = {
            ...reducer(undefined, {}),
            surfaces,
            deriving: true,
            derivingProcessId: 99,
        };
        const completed = { id: 7, is_stale: false, enforcement_log: { max_seam_step_m: 0.05 } };
        const state = reducer(initial, { type: TW_DERIVE_COMPLETE, surface: completed });
        expect(state.deriving).toEqual(false);
        expect(state.derivingProcessId).toEqual(null);
        expect(state.surfaces[0].is_stale).toEqual(false);
        expect(state.surfaces[0].enforcement_log.max_seam_step_m).toEqual(0.05);
    });
});

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

describe('TerrainWorkbench action creators', () => {
    it('setTerrainWorkbenchSection returns correct type + payload', () => {
        const action = setTerrainWorkbenchSection('delineation');
        expect(action.type).toEqual(TERRAIN_WORKBENCH_SET_SECTION);
        expect(action.section).toEqual('delineation');
    });

    it('setTerrainWorkbenchVisible returns correct type + payload', () => {
        const action = setTerrainWorkbenchVisible(true);
        expect(action.type).toEqual(TERRAIN_WORKBENCH_SET_VISIBLE);
        expect(action.visible).toEqual(true);
    });

    it('twCreateSurface returns correct type + payload', () => {
        const payload = { title: 'Test', feather_width_m: 50 };
        const action = twCreateSurface(payload);
        expect(action.type).toEqual(TW_CREATE_SURFACE);
        expect(action.payload).toEqual(payload);
    });

    it('twDerive returns surfaceId', () => {
        const action = twDerive(11);
        expect(action.type).toEqual(TW_DERIVE);
        expect(action.surfaceId).toEqual(11);
    });

    it('twDeriveSuccess returns surfaceId + processId', () => {
        const action = twDeriveSuccess(11, 77);
        expect(action.type).toEqual(TW_DERIVE_SUCCESS);
        expect(action.surfaceId).toEqual(11);
        expect(action.processId).toEqual(77);
    });

    it('twLoadDataSuccess returns terrains + surfaces', () => {
        const terrains = [{ id: 1 }];
        const surfaces = [{ id: 2 }];
        const action = twLoadDataSuccess(terrains, surfaces);
        expect(action.type).toEqual(TW_LOAD_DATA_SUCCESS);
        expect(action.terrains).toEqual(terrains);
        expect(action.surfaces).toEqual(surfaces);
    });

    it('twDeriveComplete returns surface', () => {
        const surface = { id: 5, is_stale: false };
        const action = twDeriveComplete(surface);
        expect(action.type).toEqual(TW_DERIVE_COMPLETE);
        expect(action.surface).toEqual(surface);
    });
});

// ---------------------------------------------------------------------------
// TerrainWorkbenchPanel — visible-gating (TASK-1599 fix)
// ---------------------------------------------------------------------------

describe('TerrainWorkbenchPanel visible gating', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        container = null;
    });

    it('renders null when visible=false even if isAnugaProject=true', () => {
        ReactDOM.render(
            <TerrainWorkbenchPanel
                isAnugaProject
                visible={false}
                activeSection="terrain"
                onSetSection={() => {}}
            />,
            container
        );
        expect(container.querySelector('.terrain-workbench-panel')).toNotExist();
    });

    it('renders null when isAnugaProject=false even if visible=true', () => {
        ReactDOM.render(
            <TerrainWorkbenchPanel
                isAnugaProject={false}
                visible
                activeSection="terrain"
                onSetSection={() => {}}
            />,
            container
        );
        expect(container.querySelector('.terrain-workbench-panel')).toNotExist();
    });

    it('renders the panel when both isAnugaProject=true and visible=true', () => {
        ReactDOM.render(
            <TerrainWorkbenchPanel
                isAnugaProject
                visible
                activeSection="terrain"
                onSetSection={() => {}}
            />,
            container
        );
        expect(container.querySelector('.terrain-workbench-panel')).toExist();
    });

    it('SET_VISIBLE true drives panel visible via reducer state', () => {
        // Reducer produces visible=true after SET_VISIBLE action.
        const state = reducer(undefined, { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible: true });
        expect(state.visible).toEqual(true);
        // And the panel renders given that state.
        ReactDOM.render(
            <TerrainWorkbenchPanel
                isAnugaProject
                visible={state.visible}
                activeSection="terrain"
                onSetSection={() => {}}
            />,
            container
        );
        expect(container.querySelector('.terrain-workbench-panel')).toExist();
    });

    it('SET_VISIBLE false hides panel via reducer state', () => {
        const state = reducer(
            { ...reducer(undefined, {}), visible: true },
            { type: TERRAIN_WORKBENCH_SET_VISIBLE, visible: false }
        );
        expect(state.visible).toEqual(false);
        ReactDOM.render(
            <TerrainWorkbenchPanel
                isAnugaProject
                visible={state.visible}
                activeSection="terrain"
                onSetSection={() => {}}
            />,
            container
        );
        expect(container.querySelector('.terrain-workbench-panel')).toNotExist();
    });
});
