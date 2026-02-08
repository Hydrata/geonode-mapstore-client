import expect from 'expect';
import reducer from '../reducersSwamps';
import {
    INIT_SWAMPS,
    SET_VISIBLE_SWAMPS_CHART,
    SET_SELECTED_SWAMP_ID,
    CLEAR_SELECTED_SWAMP,
    SAVE_SWAMP_QUERY_TO_STORE,
    PROCESS_SURVEY_SITES,
    TOGGLE_SELECTION_OF_SITE_ID,
    SET_SELECTED_X_KEY,
    SET_SELECTED_Y_KEY,
    REFRESH_SWAMPS,
    initSwamps,
    setVisibleSwampsChart,
    setSelectedSwampId,
    clearSelectedSwamp,
    saveSwampQueryToStore,
    processSurveySites,
    toggleSelectionOfSiteId,
    setSelectedXKey,
    setSelectedYKey,
    refreshSwamps
} from '../actionsSwamps';

describe('Swamps Plugin', () => {
    describe('Action Creators', () => {
        it('initSwamps creates correct action', () => {
            const action = initSwamps();
            expect(action.type).toBe(INIT_SWAMPS);
        });

        it('setVisibleSwampsChart creates correct action', () => {
            const action = setVisibleSwampsChart(true);
            expect(action.type).toBe(SET_VISIBLE_SWAMPS_CHART);
            expect(action.visible).toBe(true);
        });

        it('setSelectedSwampId creates correct action', () => {
            const action = setSelectedSwampId(123);
            expect(action.type).toBe(SET_SELECTED_SWAMP_ID);
            expect(action.selectedSwampId).toBe(123);
        });

        it('clearSelectedSwamp creates correct action', () => {
            const action = clearSelectedSwamp();
            expect(action.type).toBe(CLEAR_SELECTED_SWAMP);
        });

        it('saveSwampQueryToStore creates correct action', () => {
            const data = { swamp: 'data' };
            const action = saveSwampQueryToStore(data);
            expect(action.type).toBe(SAVE_SWAMP_QUERY_TO_STORE);
            expect(action.selectedSwampData).toEqual(data);
        });

        it('processSurveySites creates correct action', () => {
            const sites = [{ id: 1, name: 'Site 1' }];
            const action = processSurveySites(sites);
            expect(action.type).toBe(PROCESS_SURVEY_SITES);
            expect(action.surveySites).toEqual(sites);
        });

        it('toggleSelectionOfSiteId creates correct action', () => {
            const action = toggleSelectionOfSiteId('site1');
            expect(action.type).toBe(TOGGLE_SELECTION_OF_SITE_ID);
            expect(action.selectedSiteId).toBe('site1');
        });

        it('setSelectedXKey creates correct action', () => {
            const action = setSelectedXKey('date');
            expect(action.type).toBe(SET_SELECTED_X_KEY);
            expect(action.selectedXKey).toBe('date');
        });

        it('setSelectedYKey creates correct action', () => {
            const action = setSelectedYKey('value');
            expect(action.type).toBe(SET_SELECTED_Y_KEY);
            expect(action.selectedYKey).toBe('value');
        });

        it('refreshSwamps creates correct action', () => {
            const action = refreshSwamps();
            expect(action.type).toBe(REFRESH_SWAMPS);
        });
    });

    describe('Reducer', () => {
        const initialState = {
            selectedSwampId: null,
            selectedSwampData: null,
            availableSites: [],
            selectedSiteIds: [],
            selectedSurveyIds: [],
            availableSurveyTypeKeys: [],
            selectedSurveyTypeKeys: [],
            availableActivityFields: [],
            selectedActivityField: null
        };

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should handle SET_SELECTED_SWAMP_ID', () => {
            const state = reducer(initialState, {
                type: SET_SELECTED_SWAMP_ID,
                selectedSwampId: 123
            });
            expect(state.selectedSwampId).toBe(123);
        });

        it('should handle CLEAR_SELECTED_SWAMP', () => {
            const stateWithData = {
                ...initialState,
                selectedSwampId: 123,
                selectedSwampData: { data: 'test' },
                selectedSiteIds: [1, 2],
                availableSurveyTypeKeys: ['type1'],
                selectedSurveyTypeKeys: ['type1']
            };
            const state = reducer(stateWithData, { type: CLEAR_SELECTED_SWAMP });
            expect(state.selectedSwampId).toBe(null);
            expect(state.selectedSwampData).toBe(null);
            expect(state.selectedSiteIds).toEqual([]);
            expect(state.availableSurveyTypeKeys).toEqual([]);
            expect(state.selectedSurveyTypeKeys).toEqual([]);
        });

        it('should handle SAVE_SWAMP_QUERY_TO_STORE', () => {
            const swampData = { query: 'result' };
            const state = reducer(initialState, {
                type: SAVE_SWAMP_QUERY_TO_STORE,
                selectedSwampData: swampData
            });
            expect(state.selectedSwampData).toEqual(swampData);
        });

        it('should handle SET_VISIBLE_SWAMPS_CHART', () => {
            const state = reducer(initialState, {
                type: SET_VISIBLE_SWAMPS_CHART,
                visible: true
            });
            expect(state.visibleSwampsChart).toBe(true);
        });

        it('should handle PROCESS_SURVEY_SITES', () => {
            const sites = [
                { site_id: 1, name: 'Site 1' },
                { site_id: 2, name: 'Site 2' }
            ];
            const state = reducer(initialState, {
                type: PROCESS_SURVEY_SITES,
                surveySites: sites
            });
            expect(state.surveySites).toEqual(sites);
        });

        it('should handle SET_SELECTED_X_KEY', () => {
            const state = reducer(initialState, {
                type: SET_SELECTED_X_KEY,
                selectedXKey: 'date'
            });
            expect(state.selectedXKey).toBe('date');
        });

        it('should handle SET_SELECTED_Y_KEY', () => {
            const state = reducer(initialState, {
                type: SET_SELECTED_Y_KEY,
                selectedYKey: 'temperature'
            });
            expect(state.selectedYKey).toBe('temperature');
        });

        it('should handle REFRESH_SWAMPS - returns same state', () => {
            const state = reducer(initialState, { type: REFRESH_SWAMPS });
            expect(state).toEqual(initialState);
        });

        it('should handle TOGGLE_SELECTION_OF_SITE_ID - add site', () => {
            const stateWithSites = {
                ...initialState,
                selectedSiteIds: [],
                surveySites: [
                    { site_id: 'site1', activities: { survey1: [] } }
                ]
            };
            const state = reducer(stateWithSites, {
                type: TOGGLE_SELECTION_OF_SITE_ID,
                selectedSiteId: 'site1'
            });
            expect(state.selectedSiteIds).toContain('site1');
            expect(state.availableSurveyTypeKeys).toContain('survey1');
        });

        it('should handle TOGGLE_SELECTION_OF_SITE_ID - remove site', () => {
            const stateWithSites = {
                ...initialState,
                selectedSiteIds: ['site1', 'site2'],
                surveySites: [
                    { site_id: 'site1', activities: { survey1: [] } },
                    { site_id: 'site2', activities: { survey2: [] } }
                ]
            };
            const state = reducer(stateWithSites, {
                type: TOGGLE_SELECTION_OF_SITE_ID,
                selectedSiteId: 'site1'
            });
            expect(state.selectedSiteIds).toEqual(['site2']);
            expect(state.selectedSiteIds.includes('site1')).toBe(false);
        });
    });
});
