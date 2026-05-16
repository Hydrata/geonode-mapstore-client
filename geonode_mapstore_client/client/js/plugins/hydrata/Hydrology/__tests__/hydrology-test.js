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
    SET_IDF_DERIVE_LAT,
    SET_IDF_DERIVE_LON,
    SET_IDF_DERIVE_DURATIONS,
    SET_IDF_DERIVE_RPS,
    SET_IDF_DERIVE_MAP_PICK_ACTIVE,
    DERIVE_IDF_REQUEST,
    SET_IDF_DERIVE_PROCESS_ID,
    SET_IDF_DERIVE_ERROR,
    SET_IDF_DERIVE_RESULT,
    SET_CELERY_ANUGA_ENABLED,
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
    deleteHydrologyItem,
    setIdfDeriveLat,
    setIdfDeriveLon,
    setIdfDeriveDurations,
    setIdfDeriveRPs,
    setIdfDeriveMapPickActive,
    deriveIdfRequest,
    setIdfDeriveProcessId,
    setIdfDeriveError,
    setIdfDeriveResult,
    setCeleryAnugaEnabled
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

        it('should return initial state (with TASK-934 idfDerive slice present)', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            // Existing fields preserved verbatim.
            expect(state.isHydrologyProject).toBe(false);
            expect(state.showHydrologyMainMenu).toBe(false);
            expect(state.activeHydrologyPage).toBe('idf-table');
            // TASK-934: new slice present but doesn't disturb the older keys.
            expect(state.idfDerive).toExist();
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

    // TASK-934 — IDF Derive action creators + reducer slice.
    describe('TASK-934 IDF Derive actions', () => {
        it('setIdfDeriveLat', () => {
            const a = setIdfDeriveLat(-37.8);
            expect(a.type).toBe(SET_IDF_DERIVE_LAT);
            expect(a.lat).toBe(-37.8);
        });
        it('setIdfDeriveLon', () => {
            const a = setIdfDeriveLon(144.9);
            expect(a.type).toBe(SET_IDF_DERIVE_LON);
            expect(a.lon).toBe(144.9);
        });
        it('setIdfDeriveDurations', () => {
            const a = setIdfDeriveDurations('60, 1440');
            expect(a.type).toBe(SET_IDF_DERIVE_DURATIONS);
            expect(a.text).toBe('60, 1440');
        });
        it('setIdfDeriveRPs', () => {
            const a = setIdfDeriveRPs('2, 100');
            expect(a.type).toBe(SET_IDF_DERIVE_RPS);
            expect(a.text).toBe('2, 100');
        });
        it('setIdfDeriveMapPickActive', () => {
            const a = setIdfDeriveMapPickActive(true);
            expect(a.type).toBe(SET_IDF_DERIVE_MAP_PICK_ACTIVE);
            expect(a.active).toBe(true);
        });
        it('deriveIdfRequest', () => {
            const a = deriveIdfRequest();
            expect(a.type).toBe(DERIVE_IDF_REQUEST);
        });
        it('setIdfDeriveProcessId', () => {
            const a = setIdfDeriveProcessId('celery-uuid', 77);
            expect(a.type).toBe(SET_IDF_DERIVE_PROCESS_ID);
            expect(a.processId).toBe(77);
            expect(a.taskId).toBe('celery-uuid');
        });
        it('setIdfDeriveError', () => {
            const a = setIdfDeriveError('bad input');
            expect(a.type).toBe(SET_IDF_DERIVE_ERROR);
            expect(a.message).toBe('bad input');
        });
        it('setIdfDeriveResult', () => {
            const a = setIdfDeriveResult({id: 7});
            expect(a.type).toBe(SET_IDF_DERIVE_RESULT);
            expect(a.idfTable.id).toBe(7);
        });
        it('setCeleryAnugaEnabled', () => {
            const a = setCeleryAnugaEnabled(false);
            expect(a.type).toBe(SET_CELERY_ANUGA_ENABLED);
            expect(a.enabled).toBe(false);
        });
    });

    describe('TASK-934 IDF Derive reducer slice', () => {
        it('initial state includes idfDerive defaults', () => {
            const s = reducer(undefined, {type: 'UNKNOWN'});
            expect(s.idfDerive).toExist();
            expect(s.idfDerive.celeryAnugaEnabled).toBe(true);
            expect(s.idfDerive.lat).toBe(null);
            expect(s.idfDerive.lon).toBe(null);
            expect(s.idfDerive.durationsText.length).toBeGreaterThan(0);
            expect(s.idfDerive.rpsText.length).toBeGreaterThan(0);
        });
        it('SET_IDF_DERIVE_LAT updates lat', () => {
            const s = reducer(undefined, setIdfDeriveLat(-37.8));
            expect(s.idfDerive.lat).toBe(-37.8);
        });
        it('SET_IDF_DERIVE_LON updates lon', () => {
            const s = reducer(undefined, setIdfDeriveLon(144.9));
            expect(s.idfDerive.lon).toBe(144.9);
        });
        it('SET_IDF_DERIVE_DURATIONS updates durationsText', () => {
            const s = reducer(undefined, setIdfDeriveDurations('60, 1440'));
            expect(s.idfDerive.durationsText).toBe('60, 1440');
        });
        it('SET_IDF_DERIVE_RPS updates rpsText', () => {
            const s = reducer(undefined, setIdfDeriveRPs('2, 100'));
            expect(s.idfDerive.rpsText).toBe('2, 100');
        });
        it('SET_IDF_DERIVE_MAP_PICK_ACTIVE updates mapPickActive', () => {
            const s = reducer(undefined, setIdfDeriveMapPickActive(true));
            expect(s.idfDerive.mapPickActive).toBe(true);
        });
        it('DERIVE_IDF_REQUEST clears error+result, sets inFlight=true', () => {
            const pre = reducer(undefined, setIdfDeriveError('old error'));
            expect(pre.idfDerive.error).toBe('old error');
            const s = reducer(pre, deriveIdfRequest());
            expect(s.idfDerive.error).toBe(null);
            expect(s.idfDerive.result).toBe(null);
            expect(s.idfDerive.inFlight).toBe(true);
        });
        it('SET_IDF_DERIVE_PROCESS_ID stores processId+taskId', () => {
            const s = reducer(undefined, setIdfDeriveProcessId('celery-uuid', 77));
            expect(s.idfDerive.processId).toBe(77);
            expect(s.idfDerive.taskId).toBe('celery-uuid');
        });
        it('SET_IDF_DERIVE_ERROR stores message + clears inFlight', () => {
            const pre = reducer(undefined, deriveIdfRequest());
            const s = reducer(pre, setIdfDeriveError('boom'));
            expect(s.idfDerive.error).toBe('boom');
            expect(s.idfDerive.inFlight).toBe(false);
        });
        it('SET_IDF_DERIVE_RESULT stores result + clears inFlight', () => {
            const pre = reducer(undefined, deriveIdfRequest());
            const s = reducer(pre, setIdfDeriveResult({id: 7}));
            expect(s.idfDerive.result.id).toBe(7);
            expect(s.idfDerive.inFlight).toBe(false);
        });
        it('SET_CELERY_ANUGA_ENABLED flips celeryAnugaEnabled', () => {
            const s = reducer(undefined, setCeleryAnugaEnabled(false));
            expect(s.idfDerive.celeryAnugaEnabled).toBe(false);
        });
    });
});
