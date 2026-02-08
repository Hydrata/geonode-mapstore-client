import expect from 'expect';
import reducer, { hydrologyKeyMap } from '../reducersHydrology';
import {
    INIT_HYDROLOGY,
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE,
    SET_ACTIVE_HYDROLOGY_ITEM,
    CREATE_HYDROLOGY_FORM,
    DELETE_HYDROLOGY_ITEM_SUCCESS,
    initHydrology,
    initHydrologyFulfilled,
    initHydrologyRejected,
    setHydrologyMainMenu,
    setHydrologyIdfTableData,
    setHydrologyTemporalPatternData,
    setHydrologyTimeSeriesData,
    setActiveHydrologyPage,
    setActiveHydrologyItem,
    createHydrologyForm,
    saveHydrologyItem,
    deleteHydrologyItem
} from '../actionsHydrology';

describe('Hydrology Plugin', () => {
    describe('hydrologyKeyMap', () => {
        it('should map page names to state keys', () => {
            expect(hydrologyKeyMap['idf-table']).toBe('idfTables');
            expect(hydrologyKeyMap['temporal-pattern']).toBe('temporalPatterns');
            expect(hydrologyKeyMap['time-series']).toBe('timeSeriess');
            expect(hydrologyKeyMap.inflow).toBe('inflows');
        });
    });

    describe('Action Creators', () => {
        it('initHydrology creates correct action', () => {
            const action = initHydrology();
            expect(action.type).toBe(INIT_HYDROLOGY);
        });

        it('initHydrologyFulfilled creates correct action', () => {
            const action = initHydrologyFulfilled(123);
            expect(action.type).toBe(INIT_HYDROLOGY_FULFILLED);
            expect(action.projectId).toBe(123);
        });

        it('initHydrologyRejected creates correct action', () => {
            const action = initHydrologyRejected('Error message');
            expect(action.type).toBe('INIT_HYDROLOGY_REJECTED');
            expect(action.payload).toBe('Error message');
        });

        it('setHydrologyMainMenu creates correct action', () => {
            const action = setHydrologyMainMenu(true);
            expect(action.type).toBe(SET_HYDROLOGY_MAIN_MENU);
            expect(action.visible).toBe(true);
        });

        it('setHydrologyIdfTableData creates correct action', () => {
            const data = [{ id: 1, name: 'IDF Table 1' }];
            const action = setHydrologyIdfTableData(data);
            expect(action.type).toBe(SET_HYDROLOGY_IDF_TABLE_DATA);
            expect(action.payload).toEqual(data);
        });

        it('setHydrologyTemporalPatternData creates correct action', () => {
            const data = [{ id: 1, name: 'Pattern 1' }];
            const action = setHydrologyTemporalPatternData(data);
            expect(action.type).toBe(SET_HYDROLOGY_TEMPORAL_PATTERN_DATA);
            expect(action.payload).toEqual(data);
        });

        it('setHydrologyTimeSeriesData creates correct action', () => {
            const data = [{ id: 1, name: 'Series 1' }];
            const action = setHydrologyTimeSeriesData(data);
            expect(action.type).toBe(SET_HYDROLOGY_TIME_SERIES_DATA);
            expect(action.payload).toEqual(data);
        });

        it('setActiveHydrologyPage creates correct action', () => {
            const action = setActiveHydrologyPage('temporal-pattern');
            expect(action.type).toBe(SET_ACTIVE_HYDROLOGY_PAGE);
            expect(action.pageName).toBe('temporal-pattern');
        });

        it('setActiveHydrologyItem creates correct action', () => {
            const item = { id: 1, name: 'Test Item' };
            const action = setActiveHydrologyItem(item);
            expect(action.type).toBe(SET_ACTIVE_HYDROLOGY_ITEM);
            expect(action.item).toEqual(item);
        });

        it('createHydrologyForm creates correct action', () => {
            const action = createHydrologyForm('idf-table');
            expect(action.type).toBe(CREATE_HYDROLOGY_FORM);
            expect(action.activeHydrologyPage).toBe('idf-table');
        });

        it('saveHydrologyItem creates correct action', () => {
            const item = { id: 1, name: 'Test Item' };
            const action = saveHydrologyItem('idf-table', item);
            expect(action.type).toBe('SAVE_HYDROLOGY_ITEM');
            expect(action.activeHydrologyPage).toBe('idf-table');
            expect(action.item).toEqual(item);
        });

        it('deleteHydrologyItem creates correct action', () => {
            const item = { id: 1, name: 'Test Item' };
            const action = deleteHydrologyItem('idf-table', item);
            expect(action.type).toBe('DELETE_HYDROLOGY_ITEM');
            expect(action.activeHydrologyPage).toBe('idf-table');
            expect(action.item).toEqual(item);
        });
    });

    describe('Reducer', () => {
        const initialState = {
            isHydrologyProject: false,
            showHydrologyMainMenu: false,
            activeHydrologyPage: 'idf-table'
        };

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should handle INIT_HYDROLOGY_FULFILLED', () => {
            const state = reducer(initialState, {
                type: INIT_HYDROLOGY_FULFILLED,
                projectId: 123
            });
            expect(state.projectId).toBe(123);
        });

        it('should handle SET_HYDROLOGY_MAIN_MENU - show', () => {
            const state = reducer(initialState, {
                type: SET_HYDROLOGY_MAIN_MENU,
                visible: true
            });
            expect(state.showHydrologyMainMenu).toBe(true);
        });

        it('should handle SET_HYDROLOGY_MAIN_MENU - hide', () => {
            const stateWithMenu = { ...initialState, showHydrologyMainMenu: true };
            const state = reducer(stateWithMenu, {
                type: SET_HYDROLOGY_MAIN_MENU,
                visible: false
            });
            expect(state.showHydrologyMainMenu).toBe(false);
        });

        it('should handle SET_ACTIVE_HYDROLOGY_PAGE', () => {
            const state = reducer(initialState, {
                type: SET_ACTIVE_HYDROLOGY_PAGE,
                pageName: 'temporal-pattern'
            });
            expect(state.activeHydrologyPage).toBe('temporal-pattern');
        });

        it('should handle SET_ACTIVE_HYDROLOGY_ITEM', () => {
            const item = { id: 1, name: 'Test Item' };
            const state = reducer(initialState, {
                type: SET_ACTIVE_HYDROLOGY_ITEM,
                item: item
            });
            expect(state.activeHydrologyItem).toEqual(item);
        });

        it('should handle SET_HYDROLOGY_IDF_TABLE_DATA', () => {
            const idfTableData = [
                { id: 1, name: 'IDF Table 1', data: [] }
            ];
            const state = reducer(initialState, {
                type: SET_HYDROLOGY_IDF_TABLE_DATA,
                payload: idfTableData
            });
            expect(state.idfTables.length).toBe(1);
            expect(state.idfTables[0].name).toBe('IDF Table 1');
        });

        it('should handle SET_HYDROLOGY_TEMPORAL_PATTERN_DATA', () => {
            const patternData = [
                { id: 1, name: 'Pattern 1', data: [] }
            ];
            const state = reducer(initialState, {
                type: SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
                payload: patternData
            });
            expect(state.temporalPatterns.length).toBe(1);
            expect(state.temporalPatterns[0].name).toBe('Pattern 1');
        });

        it('should handle SET_HYDROLOGY_TIME_SERIES_DATA', () => {
            const seriesData = [
                { id: 1, name: 'Series 1', data: [] }
            ];
            const state = reducer(initialState, {
                type: SET_HYDROLOGY_TIME_SERIES_DATA,
                payload: seriesData
            });
            expect(state.timeSeriess.length).toBe(1);
            expect(state.timeSeriess[0].name).toBe('Series 1');
        });

        it('should handle DELETE_HYDROLOGY_ITEM_SUCCESS for idf-table', () => {
            const stateWithItems = {
                ...initialState,
                idfTables: [
                    { id: 1, name: 'Table 1' },
                    { id: 2, name: 'Table 2' }
                ],
                activeHydrologyItem: { id: 1 }
            };
            const state = reducer(stateWithItems, {
                type: DELETE_HYDROLOGY_ITEM_SUCCESS,
                activeHydrologyPage: 'idf-table',
                item: { id: 1 }
            });
            expect(state.idfTables.length).toBe(1);
            expect(state.idfTables[0].id).toBe(2);
            expect(state.activeHydrologyItem).toBe(null);
        });
    });
});
