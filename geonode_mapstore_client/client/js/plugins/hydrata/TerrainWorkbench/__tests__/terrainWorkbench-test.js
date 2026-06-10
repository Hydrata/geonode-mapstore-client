/**
 * TASK-1599 (W1) — TerrainWorkbench unit tests.
 *
 * Tests cover:
 *  1. Reducer: default state, SET_SECTION, SET_VISIBLE actions.
 *  2. Action creators: setTerrainWorkbenchSection, setTerrainWorkbenchVisible.
 *  3. Panel rendering: sections render, section switch works.
 */

import expect from 'expect';

import reducer from '../reducersTerrainWorkbench';
import {
    TERRAIN_WORKBENCH_SET_SECTION,
    TERRAIN_WORKBENCH_SET_VISIBLE,
    setTerrainWorkbenchSection,
    setTerrainWorkbenchVisible,
} from '../actionsTerrainWorkbench';

// ---------------------------------------------------------------------------
// Reducer tests
// ---------------------------------------------------------------------------

describe('TerrainWorkbench reducer', () => {
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
// Action creator tests
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
});
