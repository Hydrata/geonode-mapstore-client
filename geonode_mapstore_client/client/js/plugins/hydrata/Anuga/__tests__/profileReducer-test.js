/**
 * TASK-1861 (epic 1814 W4.4) — profile slice of the anuga `ui` reducer.
 *
 * The line-profile tool state lives on the existing ui slice (mirrors the
 * terrainBbox cluster). These tests pin the transitions the panel/epic rely on.
 */
import expect from 'expect';
import uiReducer from '../reducers/uiReducer';
import {
    setProfilePanelVisible,
    setProfileDrawing,
    setProfileLoading,
    setProfileSamples,
    setProfileError,
    clearProfile
} from '../actionsAnuga';

describe('uiReducer — profile slice (TASK-1861)', () => {
    it('opening the panel sets profilePanelVisible=true', () => {
        const s = uiReducer(undefined, setProfilePanelVisible(true));
        expect(s.profilePanelVisible).toBe(true);
    });

    it('closing the panel resets ALL transient profile state', () => {
        let s = uiReducer(undefined, setProfilePanelVisible(true));
        s = uiReducer(s, setProfileSamples([{ distance_m: 0, dem: 1 }], [{ key: 'dem', label: 'Elevation' }]));
        s = uiReducer(s, setProfileError('x'));
        s = uiReducer(s, setProfilePanelVisible(false));
        expect(s.profilePanelVisible).toBe(false);
        expect(s.profileDrawingActive).toBe(false);
        expect(s.profileLoading).toBe(false);
        expect(s.profileSamples).toBe(null);
        expect(s.profileTraces).toBe(null);
        expect(s.profileError).toBe(null);
    });

    it('SET_PROFILE_DRAWING toggles the drawing flag', () => {
        const s = uiReducer(undefined, setProfileDrawing(true));
        expect(s.profileDrawingActive).toBe(true);
    });

    it('SET_PROFILE_LOADING toggles the loading flag', () => {
        const s = uiReducer(undefined, setProfileLoading(true));
        expect(s.profileLoading).toBe(true);
    });

    it('SET_PROFILE_SAMPLES stores samples+traces and clears loading/drawing/error', () => {
        let s = uiReducer(undefined, setProfileLoading(true));
        s = uiReducer(s, setProfileDrawing(true));
        s = uiReducer(s, setProfileError('old'));
        const samples = [{ distance_m: 0, dem: 10 }];
        const traces = [{ key: 'dem', label: 'Elevation' }];
        s = uiReducer(s, setProfileSamples(samples, traces));
        expect(s.profileSamples).toEqual(samples);
        expect(s.profileTraces).toEqual(traces);
        expect(s.profileLoading).toBe(false);
        expect(s.profileDrawingActive).toBe(false);
        expect(s.profileError).toBe(null);
    });

    it('SET_PROFILE_ERROR stores the error and clears loading/drawing', () => {
        let s = uiReducer(undefined, setProfileLoading(true));
        s = uiReducer(s, setProfileError('hydrata.anuga.profileFailed'));
        expect(s.profileError).toBe('hydrata.anuga.profileFailed');
        expect(s.profileLoading).toBe(false);
        expect(s.profileDrawingActive).toBe(false);
    });

    it('CLEAR_PROFILE drops samples/traces/error but leaves panel visibility', () => {
        let s = uiReducer(undefined, setProfilePanelVisible(true));
        s = uiReducer(s, setProfileSamples([{ distance_m: 0, dem: 1 }], [{ key: 'dem', label: 'Elevation' }]));
        s = uiReducer(s, clearProfile());
        expect(s.profileSamples).toBe(null);
        expect(s.profileTraces).toBe(null);
        expect(s.profileError).toBe(null);
        expect(s.profilePanelVisible).toBe(true);
    });

    // TASK-2272 (epic 2249 W5) — the "Clear" button leans on CLEAR_PROFILE for a
    // FULL reset: drawing + loading flags also drop so the panel returns to the
    // empty "Draw profile line" state. Picker checked-ids are intentionally kept.
    it('CLEAR_PROFILE also resets drawing + loading flags (full reset for Clear)', () => {
        let s = uiReducer(undefined, setProfileLoading(true));
        s = uiReducer(s, setProfileDrawing(true));
        s = uiReducer(s, clearProfile());
        expect(s.profileDrawingActive).toBe(false);
        expect(s.profileLoading).toBe(false);
    });
});
