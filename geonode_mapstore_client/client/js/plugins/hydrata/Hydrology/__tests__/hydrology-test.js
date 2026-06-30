import expect from 'expect';
import reducer, { hydrologyKeyMap } from '../reducersHydrology';
import { CATEGORIES, CATEGORY_TO_PAGE, pageToCategory } from '../components/hydrologyCategoryRail';
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
            expect(hydrologyKeyMap['sv-idf-table']).toBe('idfTables');
            expect(hydrologyKeyMap['temporal-pattern']).toBe('temporalPatterns');
            expect(hydrologyKeyMap['time-series']).toBe('timeSeriess');
            // TASK-1448 (W1): inflow removed from the UI; keyMap no longer has it.
            expect(hydrologyKeyMap.inflow).toBe(undefined);
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
            const action = createHydrologyForm('sv-idf-table');
            expect(action.type).toBe(CREATE_HYDROLOGY_FORM);
            expect(action.activeHydrologyPage).toBe('sv-idf-table');
        });

        it('saveHydrologyItem creates correct action', () => {
            const item = { id: 1, name: 'Test Item' };
            const action = saveHydrologyItem('sv-idf-table', item);
            expect(action.type).toBe('SAVE_HYDROLOGY_ITEM');
            expect(action.activeHydrologyPage).toBe('sv-idf-table');
            expect(action.item).toEqual(item);
        });

        it('deleteHydrologyItem creates correct action', () => {
            const item = { id: 1, name: 'Test Item' };
            const action = deleteHydrologyItem('sv-idf-table', item);
            expect(action.type).toBe('DELETE_HYDROLOGY_ITEM');
            expect(action.activeHydrologyPage).toBe('sv-idf-table');
            expect(action.item).toEqual(item);
        });
    });

    describe('Reducer', () => {
        const initialState = {
            isHydrologyProject: false,
            showHydrologyMainMenu: false,
            activeHydrologyPage: 'sv-idf-table'
        };

        it('should return initial state (with TASK-934 idfDerive slice present)', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            // Existing fields preserved verbatim.
            expect(state.isHydrologyProject).toBe(false);
            expect(state.showHydrologyMainMenu).toBe(false);
            // TASK-1452 (W5) opened on Derive; UAT 2026-06-23 reverted to Input-first.
            expect(state.activeHydrologyPage).toBe('sv-idf-table');
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

        // Regression: a persisted IDF table can be serialized without a `data`
        // object (the V2 list serializer omits it). The IdfTable `data` setter
        // throws on a non-object, and because this reducer runs inside an
        // epic-dispatched action, an in-reducer throw tears down the whole
        // redux-observable epic stream (map-pick, identify, etc. all go silent).
        // The deserializer must tolerate missing/non-object `data`.
        it('should handle SET_HYDROLOGY_IDF_TABLE_DATA when data is absent or non-object', () => {
            const idfTableData = [
                { id: 1, name: 'No data key' },           // data === undefined
                { id: 2, name: 'Null data', data: null }, // typeof null === 'object'
                { id: 3, name: 'String data', data: 'x' }  // non-object
            ];
            let state;
            expect(() => {
                state = reducer(initialState, {
                    type: SET_HYDROLOGY_IDF_TABLE_DATA,
                    payload: idfTableData
                });
            }).toNotThrow();
            expect(state.idfTables.length).toBe(3);
            expect(state.idfTables[0].name).toBe('No data key');
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

        // TASK-1532 — CREATE_HYDROLOGY_FORM assigns an auto-numbered,
        // zero-padded default name per type ('IDF Table 01' / 'Temporal
        // Pattern 01' / 'Design Storm 01'), incrementing over the existing
        // in-project list. The name MUST be computed once here so the optimistic
        // POST body matches the CREATE_HYDROLOGY_ITEM_SUCCESS reconcile (which
        // matches on item.name), else the create round-trip duplicates the row.
        describe('TASK-1532 CREATE_HYDROLOGY_FORM auto-numbered default names', () => {
            it('sv-idf-table on empty tab → "IDF Table 01"', () => {
                const state = reducer(
                    { ...initialState, idfTables: [] },
                    createHydrologyForm('sv-idf-table')
                );
                expect(state.idfTables.length).toBe(1);
                expect(state.idfTables[0].name).toBe('IDF Table 01');
                expect(state.activeHydrologyItem.name).toBe('IDF Table 01');
            });

            it('temporal-pattern on empty tab → "Temporal Pattern 01"', () => {
                const state = reducer(
                    { ...initialState, temporalPatterns: [] },
                    createHydrologyForm('temporal-pattern')
                );
                expect(state.temporalPatterns.length).toBe(1);
                expect(state.temporalPatterns[0].name).toBe('Temporal Pattern 01');
                expect(state.activeHydrologyItem.name).toBe('Temporal Pattern 01');
            });

            // TASK-2002 (epic-2001 W1a): the Design-Storms (time-series) draft no
            // longer lands in the rail list (state.timeSeriess) — it goes to the
            // dedicated state.draftTimeSeries slice. The auto-name is still
            // computed off the persisted list, so the FIRST draft is 'Design Storm 01'.
            it('time-series on empty tab → "Design Storm 01" in the draft slice (rail unchanged)', () => {
                const state = reducer(
                    { ...initialState, timeSeriess: [] },
                    createHydrologyForm('time-series')
                );
                expect(state.timeSeriess.length).toBe(0);
                expect(state.draftTimeSeries).toExist();
                expect(state.draftTimeSeries.name).toBe('Design Storm 01');
                expect(state.activeHydrologyItem.name).toBe('Design Storm 01');
            });

            it('sv-idf-table with existing ...01/...02 → "IDF Table 03"', () => {
                const state = reducer(
                    {
                        ...initialState,
                        idfTables: [
                            { id: 1, name: 'IDF Table 01' },
                            { id: 2, name: 'IDF Table 02' }
                        ]
                    },
                    createHydrologyForm('sv-idf-table')
                );
                expect(state.idfTables.length).toBe(3);
                expect(state.idfTables[2].name).toBe('IDF Table 03');
            });

            it('temporal-pattern with existing ...01/...02 → "Temporal Pattern 03"', () => {
                const state = reducer(
                    {
                        ...initialState,
                        temporalPatterns: [
                            { id: 1, name: 'Temporal Pattern 01' },
                            { id: 2, name: 'Temporal Pattern 02' }
                        ]
                    },
                    createHydrologyForm('temporal-pattern')
                );
                expect(state.temporalPatterns.length).toBe(3);
                expect(state.temporalPatterns[2].name).toBe('Temporal Pattern 03');
            });

            // TASK-2002 (epic-2001 W1a): auto-name still indexes off the persisted
            // rail list (timeSeriess), but the new draft lands in draftTimeSeries —
            // the rail length is UNCHANGED (no phantom row).
            it('time-series with existing ...01/...02 → "Design Storm 03" draft (rail stays at 2)', () => {
                const state = reducer(
                    {
                        ...initialState,
                        timeSeriess: [
                            { id: 1, name: 'Design Storm 01' },
                            { id: 2, name: 'Design Storm 02' }
                        ]
                    },
                    createHydrologyForm('time-series')
                );
                expect(state.timeSeriess.length).toBe(2);
                expect(state.draftTimeSeries.name).toBe('Design Storm 03');
                expect(state.activeHydrologyItem.name).toBe('Design Storm 03');
            });

            // Numbering keys off the MAX trailing int, not the count: a gap
            // (01, 05) must yield 06, and user-renamed/foreign rows are ignored.
            it('sv-idf-table indexes off the max trailing int, skipping gaps and foreign names', () => {
                const state = reducer(
                    {
                        ...initialState,
                        idfTables: [
                            { id: 1, name: 'IDF Table 01' },
                            { id: 2, name: 'IDF Table 05' },
                            { id: 3, name: 'My custom curve' }
                        ]
                    },
                    createHydrologyForm('sv-idf-table')
                );
                expect(state.idfTables[3].name).toBe('IDF Table 06');
            });

            // Keystone: the optimistic CREATE_HYDROLOGY_FORM name must survive
            // the create round-trip. CREATE_HYDROLOGY_ITEM_SUCCESS reconciles on
            // item.name, so the server echo (same name) must REPLACE the temp
            // row in place — not append a duplicate.
            it('no duplicate list row after the create round-trip (name matches reconcile)', () => {
                const created = reducer(
                    { ...initialState, idfTables: [] },
                    createHydrologyForm('sv-idf-table')
                );
                const tempItem = created.idfTables[0];
                expect(tempItem.name).toBe('IDF Table 01');
                expect(typeof tempItem.id).toBe('string');
                expect(tempItem.id.includes('temp')).toBe(true);

                // Server responds with the same name + a real numeric id.
                const reconciled = reducer(created, {
                    type: 'CREATE_HYDROLOGY_ITEM_SUCCESS',
                    activeHydrologyPage: 'sv-idf-table',
                    item: { id: 42, name: 'IDF Table 01', data: { columnDefs: [], rowData: [] } }
                });
                expect(reconciled.idfTables.length).toBe(1);
                expect(reconciled.idfTables[0].id).toBe(42);
                expect(reconciled.idfTables[0].name).toBe('IDF Table 01');
            });
        });

        // TASK-2002 (epic-2001 W1a) — the Design Storms (time-series) Create flow
        // must NOT insert an optimistic phantom row into the rail (state.timeSeriess).
        // The new TimeSeries() draft lives in a dedicated state.draftTimeSeries slice;
        // the rail renders only persisted rows; Save persists + surfaces the real row;
        // Exit discards the draft. The Hydrographs create flow (separate slice) is
        // unchanged — it still appends to state.hydrographs.
        describe('TASK-2002 dedicated draftTimeSeries slice (no phantom rail row)', () => {
            it('AC1+AC2: createHydrologyForm("time-series") leaves timeSeriess unchanged and fills draftTimeSeries', () => {
                const start = { ...initialState, timeSeriess: [{ id: 1, name: 'Design Storm 01' }] };
                const state = reducer(start, createHydrologyForm('time-series'));
                // rail length unchanged (AC1)
                expect(state.timeSeriess.length).toBe(1);
                expect(state.timeSeriess[0].id).toBe(1);
                // draft lives in its own slice (AC2)
                expect(state.draftTimeSeries).toExist();
                expect(state.draftTimeSeries.name).toBe('Design Storm 02');
                expect(typeof state.draftTimeSeries.id).toBe('string');
                expect(state.draftTimeSeries.id.includes('temp')).toBe(true);
                // the draft is the active item (so the editor renders it)
                expect(state.activeHydrologyItem).toBe(state.draftTimeSeries);
            });

            it('AC3: exit (setActiveHydrologyItem(null)) discards the draft and leaves timeSeriess unchanged', () => {
                const created = reducer(
                    { ...initialState, timeSeriess: [{ id: 1, name: 'Design Storm 01' }] },
                    createHydrologyForm('time-series')
                );
                expect(created.draftTimeSeries).toExist();
                const exited = reducer(created, setActiveHydrologyItem(null));
                expect(exited.draftTimeSeries).toBe(null);
                expect(exited.timeSeriess.length).toBe(1);
                expect(exited.activeHydrologyItem).toBe(null);
            });

            it('exit by selecting a saved row also clears the draft (no residue)', () => {
                const created = reducer(
                    { ...initialState, timeSeriess: [{ id: 1, name: 'Design Storm 01' }] },
                    createHydrologyForm('time-series')
                );
                const saved = { id: 1, name: 'Design Storm 01' };
                const exited = reducer(created, setActiveHydrologyItem(saved));
                expect(exited.draftTimeSeries).toBe(null);
                expect(exited.activeHydrologyItem).toBe(saved);
                expect(exited.timeSeriess.length).toBe(1);
            });

            it('AC4: CREATE_HYDROLOGY_ITEM_SUCCESS surfaces the real row in the rail and clears the draft', () => {
                const created = reducer(
                    { ...initialState, timeSeriess: [] },
                    createHydrologyForm('time-series')
                );
                expect(created.timeSeriess.length).toBe(0);
                expect(created.draftTimeSeries.name).toBe('Design Storm 01');
                const reconciled = reducer(created, {
                    type: 'CREATE_HYDROLOGY_ITEM_SUCCESS',
                    activeHydrologyPage: 'time-series',
                    item: { id: 77, name: 'Design Storm 01', data: { columnDefs: [], rowData: [] } }
                });
                expect(reconciled.timeSeriess.length).toBe(1);
                expect(reconciled.timeSeriess[0].id).toBe(77);
                expect(reconciled.timeSeriess[0].name).toBe('Design Storm 01');
                expect(reconciled.draftTimeSeries).toBe(null);
                expect(reconciled.activeHydrologyItem.id).toBe(77);
            });

            it('CREATE_HYDROLOGY_ITEM_SUCCESS does not duplicate the row on the persisted list', () => {
                const start = {
                    ...initialState,
                    timeSeriess: [{ id: 1, name: 'Design Storm 01' }]
                };
                const created = reducer(start, createHydrologyForm('time-series'));
                const reconciled = reducer(created, {
                    type: 'CREATE_HYDROLOGY_ITEM_SUCCESS',
                    activeHydrologyPage: 'time-series',
                    item: { id: 2, name: 'Design Storm 02', data: { columnDefs: [], rowData: [] } }
                });
                expect(reconciled.timeSeriess.length).toBe(2);
                expect(reconciled.timeSeriess.map(t => t.id)).toEqual([1, 2]);
            });

            it('edits route to the draft: UPDATE_ACTIVE_HYDROLOGY_ITEM renames the draft (not the rail)', () => {
                const created = reducer(
                    { ...initialState, timeSeriess: [{ id: 1, name: 'Design Storm 01' }] },
                    createHydrologyForm('time-series')
                );
                const draftId = created.draftTimeSeries.id;
                const renamed = reducer(created, {
                    type: 'UPDATE_ACTIVE_HYDROLOGY_ITEM',
                    activeHydrologyPage: 'time-series',
                    item: { id: draftId },
                    kv: { name: 'My storm' }
                });
                expect(renamed.draftTimeSeries.name).toBe('My storm');
                expect(renamed.draftTimeSeries.unsaved).toBe(true);
                expect(renamed.activeHydrologyItem.name).toBe('My storm');
                // rail untouched
                expect(renamed.timeSeriess[0].name).toBe('Design Storm 01');
            });

            it('grid edits route to the draft: UPDATE_TIME_SERIES_ROW_DATA mutates the draft rowData', () => {
                const created = reducer(
                    { ...initialState, timeSeriess: [] },
                    createHydrologyForm('time-series')
                );
                const draftId = created.draftTimeSeries.id;
                const edited = reducer(created, {
                    type: 'UPDATE_TIME_SERIES_ROW_DATA',
                    timeSeriesId: draftId,
                    rowIndex: 1,
                    columnId: 'value',
                    value: 42
                });
                expect(edited.draftTimeSeries.rowData[1].value).toBe(42);
                expect(edited.activeHydrologyItem.rowData[1].value).toBe(42);
            });

            it('Hydrographs create flow is unchanged: still appends to state.hydrographs (no draft slice)', () => {
                const state = reducer(
                    { ...initialState, hydrographs: [] },
                    createHydrologyForm('hydrographs')
                );
                expect(state.hydrographs.length).toBe(1);
                expect(state.hydrographs[0].series_type).toBe('hydrograph');
                expect(state.hydrographs[0].name).toBe('Hydrograph 01');
                // A hydrographs create must NOT seat a time-series draft (this
                // minimal fixture doesn't seed draftTimeSeries, so it stays unset).
                expect(state.draftTimeSeries).toNotExist();
                expect(state.activeHydrologyItem).toBe(state.hydrographs[0]);
            });
        });

        // TASK-2004 (epic-2001 W1c) — a freshly-created Design Storm (time-series)
        // draft seeds an ALL-ZERO short grid (a few hourly timestamps, every value
        // 0) so Create opens an empty editable hyetograph rather than a fake
        // 0/10/30/0 sample storm the user has to clear first. The grid keeps a few
        // rows so the chart/grid still render with a visible time axis.
        describe('TASK-2004 new Design Storm seeds an all-zero short grid', () => {
            it('AC: the time-series draft rowData is non-empty and EVERY value is 0', () => {
                const state = reducer(
                    { ...initialState, timeSeriess: [] },
                    createHydrologyForm('time-series')
                );
                const draft = state.draftTimeSeries;
                expect(draft).toExist();
                const rowData = draft.rowData;
                // A short grid (keeps the time axis visible) — non-empty...
                expect(Array.isArray(rowData)).toBe(true);
                expect(rowData.length).toBeGreaterThan(0);
                // ...and EVERY seeded value is 0 (no fake sample storm).
                expect(rowData.every(r => Number(r.value) === 0)).toBe(true);
                // each row still carries a timestamp (the visible time axis).
                expect(rowData.every(r => typeof r.timestamp === 'string' && r.timestamp.length > 0)).toBe(true);
            });

            it('AC: a brand-new TimeSeries() instance is seeded all-zero (the class default)', () => {
                const { TimeSeries } = require('../classesHydrology');
                const ts = new TimeSeries();
                expect(ts.rowData.length).toBeGreaterThan(0);
                expect(ts.rowData.every(r => Number(r.value) === 0)).toBe(true);
            });
        });

        it('should handle DELETE_HYDROLOGY_ITEM_SUCCESS for sv-idf-table', () => {
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
                activeHydrologyPage: 'sv-idf-table',
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

    // TASK-1985 — hydrologyCategoryRail: Hydrographs rail item at index 3 + page wiring.
    describe('hydrologyCategoryRail', () => {
        it('CATEGORIES has hydrographs at index 3 (between time-series and networks)', () => {
            // Index 0=idf, 1=temporal-pattern, 2=time-series, 3=hydrographs, 4=networks
            expect(CATEGORIES[3].id).toBe('hydrographs');
            expect(CATEGORIES[3].msgId).toBe('hydrata.hydrology.hydrographs');
            // Networks must still be last (index 4) — not displaced to index 3.
            expect(CATEGORIES[4].id).toBe('networks');
        });

        it('CATEGORY_TO_PAGE maps hydrographs category id to hydrographs page id', () => {
            expect(CATEGORY_TO_PAGE && CATEGORY_TO_PAGE['hydrographs']).toBe('hydrographs');
        });

        it('pageToCategory round-trips the hydrographs activeHydrologyPage', () => {
            // pageToCategory('hydrographs') must return 'hydrographs' so the rail
            // item is highlighted when the Redux page is 'hydrographs'.
            expect(pageToCategory('hydrographs')).toBe('hydrographs');
        });
    });

    describe('activeHydrologyPage accepts hydrographs (TASK-1985)', () => {
        it('SET_ACTIVE_HYDROLOGY_PAGE with hydrographs stores it in reducer', () => {
            const initialState = {
                isHydrologyProject: false,
                showHydrologyMainMenu: false,
                activeHydrologyPage: 'sv-idf-table'
            };
            const s = reducer(initialState, setActiveHydrologyPage('hydrographs'));
            expect(s.activeHydrologyPage).toBe('hydrographs');
        });
    });

    // TASK-2023 (W5.1) — Hydrographs rail icon: inline-SVG, not glyphicon-tint.
    describe('TASK-2023 hydrologyCategoryRail hydrographs icon', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const TestUtils = require('react-dom/test-utils');
        const { HydrologyCategoryRail } = require('../components/hydrologyCategoryRail');

        it('hydrographs rail item renders an <svg>, NOT a .glyphicon-tint span', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyCategoryRail, {
                    activeHydrologyPage: 'hydrographs',
                    onSelectCategory: () => {}
                }),
                container
            );
            // No glyphicon-tint span anywhere in the rail
            const tintSpans = container.querySelectorAll('.glyphicon-tint');
            expect(tintSpans.length).toBe(0);
            // Exactly one svg element exists (the HydrographIcon)
            const svgs = container.querySelectorAll('svg');
            // Networks also has an svg — but when hydrographs is active, total >= 1
            // We need the hydrographs item's glyph span to contain an svg
            const items = container.querySelectorAll('.sv-hydrology-category-item');
            const hydrographsItem = Array.from(items).find(el =>
                el.getAttribute('aria-selected') === 'true'
            );
            expect(hydrographsItem).toExist();
            const itemSvgs = hydrographsItem.querySelectorAll('svg');
            expect(itemSvgs.length).toBe(1);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('networks and other rail items are unchanged (no regression)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyCategoryRail, {
                    activeHydrologyPage: 'networks',
                    onSelectCategory: () => {}
                }),
                container
            );
            // networks item still has an svg
            const items = container.querySelectorAll('.sv-hydrology-category-item');
            const networksItem = Array.from(items).find(el =>
                el.getAttribute('aria-selected') === 'true'
            );
            expect(networksItem).toExist();
            const networksSvgs = networksItem.querySelectorAll('svg');
            expect(networksSvgs.length).toBe(1);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });
    });

    // TASK-2025 (W5.3) — page-aware labels: Hydrograph vs Design Storm.
    // Message component without intl context renders <span>{msgId}</span>,
    // so we check innerHTML/textContent for the msgId string.
    describe('TASK-2025 HydrologyTimeSeries page-aware labels', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { HydrologyTimeSeriesClass } = require('../components/hydrologyDetailTimeSeries');

        it('hydrographs page: empty-state contains noHydrographData msgId text', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyTimeSeriesClass, {
                    activeHydrologyItem: {id: 1, name: 'Test', rowData: []},
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            const text = container.innerHTML;
            expect(text.includes('hydrata.hydrology.noHydrographData')).toBe(true);
            expect(text.includes('hydrata.hydrology.noTimeSeriesData')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('time-series page: empty-state contains noTimeSeriesData msgId (Design Storms unchanged)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyTimeSeriesClass, {
                    activeHydrologyItem: {id: 1, name: 'Test', rowData: []},
                    activeHydrologyPage: 'time-series'
                }),
                container
            );
            const text = container.innerHTML;
            expect(text.includes('hydrata.hydrology.noTimeSeriesData')).toBe(true);
            expect(text.includes('hydrata.hydrology.noHydrographData')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });
    });

    // TASK-2027/2028/2030 (W5.5/W5.6/W5.8) — HyetographChart cluster: animation/line/volume.
    describe('HyetographChart cluster (TASK-2027/2028/2030)', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { HyetographChart } = require('../components/hydrologyDetailTimeSeries');

        // Synthetic rowData with timestamps + values for a 3-point series.
        const rowData = [
            {timestamp: '2025-01-01T00:00:00', value: 10},
            {timestamp: '2025-01-01T00:06:00', value: 20},
            {timestamp: '2025-01-01T00:12:00', value: 5}
        ];

        // TASK-2028: hydrograph -> LineChart rendered, no BarChart
        it('TASK-2028: activeHydrologyPage=hydrographs renders a line chart (.recharts-line-curve or svg), not bar', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6,
                    title: 'Test Hydrograph',
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            // Line chart renders recharts-line elements; Bar chart renders recharts-bar-rectangle
            const barRects = container.querySelectorAll('.recharts-bar-rectangle');
            expect(barRects.length).toBe(0);
            // Chart wrapper should still exist
            const chartWrapper = container.querySelector('#design-storm-hyetograph');
            expect(chartWrapper).toExist();
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('TASK-2028: no activeHydrologyPage (Design Storms) renders bar chart', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6,
                    title: 'Design Storm'
                }),
                container
            );
            // BarChart renders recharts-bar elements
            const barLayer = container.querySelector('.recharts-bar');
            expect(barLayer).toExist();
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // TASK-2028: Y-axis label and tooltip units
        it('TASK-2028: hydrograph Y-axis label reads Flow (m3/s), not Intensity (mm/hr)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6,
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            const html = container.innerHTML;
            expect(html.includes('Flow (m3/s)')).toBe(true);
            expect(html.includes('Intensity (mm/hr)')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('TASK-2028: Design Storms Y-axis label reads Intensity (mm/hr) (unchanged)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6
                }),
                container
            );
            const html = container.innerHTML;
            expect(html.includes('Intensity (mm/hr)')).toBe(true);
            expect(html.includes('Flow (m3/s)')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // TASK-2030: volume stat
        it('TASK-2030: hydrograph stat reads "Estimated Total Flow Volume (m3)" with m3 value', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6,
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            const html = container.innerHTML;
            expect(html.includes('Flow Volume')).toBe(true);
            expect(html.includes('m3')).toBe(true);
            // Must NOT contain depth-based labels
            expect(html.includes('total depth')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('TASK-2030: Design Storms stat reads "Estimated total depth ... mm" (unchanged)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6
                }),
                container
            );
            const html = container.innerHTML;
            expect(html.includes('total depth')).toBe(true);
            expect(html.includes('mm')).toBe(true);
            expect(html.includes('Flow Volume')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // TASK-2030: volume integral math check
        // 3 points at 10, 20, 5 m3/s, timestep=6min -> 6*60=360s each
        // totalVolume = (10 + 20 + 5) * 360 = 12600 m3
        it('TASK-2030: volume integral = sum(flow * timestep_seconds)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 6,
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            const html = container.innerHTML;
            // 35 * 360 = 12600
            expect(html.includes('12600')).toBe(true);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });
    });

    // TASK-2024 (W5.2) — Hydrographs create panel: hideDerive removes Derive button + body.
    describe('TASK-2024 DesignStormCreatePanel hideDerive', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { DesignStormCreatePanel } = require('../components/hydrologyDetailTimeSeries');

        const baseProps = {
            activeHydrologyItem: {id: 'temp-1', name: 'Hydrograph 01', rowData: [], columnDefs: []},
            idfTables: [],
            temporalPatterns: [],
            activeTab: 'input',
            onTabChange: () => {},
            previews: [],
            previewInFlight: false,
            saveInFlight: false,
            lastSavedCount: null,
            previewDesignStorms: () => {},
            saveDesignStorms: () => {},
            updateTimeSeriesRowData: () => {},
            replaceTimeSeriesRowData: () => {}
        };

        it('with hideDerive=true: no #ds-create-tab-derive button and DesignStormDerive not mounted', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(DesignStormCreatePanel, {...baseProps, hideDerive: true}),
                container
            );
            const deriveBtn = container.querySelector('#ds-create-tab-derive');
            expect(deriveBtn).toBe(null);
            // Even if a stale tab='derive' is passed, no DesignStormDerive panel renders
            ReactDOM.unmountComponentAtNode(container);
            ReactDOM.render(
                React.createElement(DesignStormCreatePanel, {...baseProps, hideDerive: true, activeTab: 'derive'}),
                container
            );
            const deriveBtnStale = container.querySelector('#ds-create-tab-derive');
            expect(deriveBtnStale).toBe(null);
            // ManualPasteGrid should still render (Input path present)
            const createPanel = container.querySelector('#design-storm-create-panel');
            expect(createPanel).toExist();
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        it('without hideDerive: both Input and Derive buttons present (Design Storms unchanged)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(DesignStormCreatePanel, {...baseProps, hideDerive: false}),
                container
            );
            const inputBtn = container.querySelector('#ds-create-tab-input');
            const deriveBtn = container.querySelector('#ds-create-tab-derive');
            expect(inputBtn).toExist();
            expect(deriveBtn).toExist();
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });
    });

    // TASK-2003 (epic-2001 W1b) — the Input|Derive create-mode control is a
    // semantic RADIO group (role=radiogroup with two role=radio inputs), not a
    // pair of segmented <button>s, and uses its own i18n keys (createModeInput /
    // createModeDerive) instead of reusing the IDF idfModeManual/idfModeDerive.
    describe('TASK-2003 DesignStormCreatePanel Input|Derive radio group', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { DesignStormCreatePanel } = require('../components/hydrologyDetailTimeSeries');

        const baseProps = {
            activeHydrologyItem: {id: 'temp-1', name: 'Design Storm 01', rowData: [], columnDefs: []},
            idfTables: [],
            temporalPatterns: [],
            activeTab: 'input',
            onTabChange: () => {},
            previews: [],
            previewInFlight: false,
            saveInFlight: false,
            lastSavedCount: null,
            previewDesignStorms: () => {},
            saveDesignStorms: () => {},
            updateTimeSeriesRowData: () => {},
            replaceTimeSeriesRowData: () => {}
        };

        const render = (props) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(DesignStormCreatePanel, {...baseProps, ...props}),
                container
            );
            return container;
        };
        const cleanup = (container) => {
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        };

        it('renders a role=radiogroup containing two role=radio inputs', () => {
            const container = render({hideDerive: false});
            const group = container.querySelector('[role="radiogroup"]');
            expect(group).toExist();
            const radios = container.querySelectorAll('[role="radio"]');
            expect(radios.length).toBe(2);
            cleanup(container);
        });

        it('the two radios keep the ds-create-tab-input / ds-create-tab-derive ids', () => {
            const container = render({hideDerive: false});
            expect(container.querySelector('#ds-create-tab-input')).toExist();
            expect(container.querySelector('#ds-create-tab-derive')).toExist();
            cleanup(container);
        });

        it('default selection (activeTab=input) checks Input, not Derive', () => {
            const container = render({hideDerive: false, activeTab: 'input'});
            const inputRadio = container.querySelector('#ds-create-tab-input');
            const deriveRadio = container.querySelector('#ds-create-tab-derive');
            expect(inputRadio.getAttribute('aria-checked')).toBe('true');
            expect(deriveRadio.getAttribute('aria-checked')).toBe('false');
            cleanup(container);
        });

        it('selecting the Derive radio fires onTabChange("derive")', () => {
            let called = null;
            const container = render({hideDerive: false, onTabChange: (t) => { called = t; }});
            const deriveRadio = container.querySelector('#ds-create-tab-derive');
            deriveRadio.click();
            expect(called).toBe('derive');
            cleanup(container);
        });

        it('hideDerive=true: no radiogroup rendered (Hydrographs page unchanged)', () => {
            const container = render({hideDerive: true});
            expect(container.querySelector('[role="radiogroup"]')).toBe(null);
            expect(container.querySelector('#ds-create-tab-derive')).toBe(null);
            cleanup(container);
        });
    });

    // TASK-2031 (W5.9) — Hydrographs saved-detail: editable ManualPasteGrid for selected hydrograph.
    describe('TASK-2031 HydrologyTimeSeries editable grid for saved hydrograph', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { HydrologyTimeSeriesClass } = require('../components/hydrologyDetailTimeSeries');

        const rowData = [
            {timestamp: '2025-01-01T00:00:00', value: 5},
            {timestamp: '2025-01-01T00:10:00', value: 10}
        ];

        const savedHydrograph = {
            id: 42,
            name: 'River Q',
            series_type: 'hydrograph',
            rowData,
            columnDefs: []
        };

        const savedDesignStorm = {
            id: 7,
            name: 'ARI 100',
            series_type: 'time-series',
            rowData,
            columnDefs: []
        };

        const noop = () => {};

        // AC1 + AC4: hydrographs page -> ManualPasteGrid editable input present.
        it('AC1: hydrographs page + saved item renders editable input (ManualPasteGrid), not read-only chart only', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyTimeSeriesClass, {
                    activeHydrologyItem: savedHydrograph,
                    activeHydrologyPage: 'hydrographs',
                    dispatchUpdateRowData: noop,
                    dispatchReplaceRowData: noop
                }),
                container
            );
            // ManualPasteGrid renders an editable <input> for each value cell
            const inputs = container.querySelectorAll('input');
            expect(inputs.length).toBeGreaterThan(0);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // AC3: time-series (Design Storms) page -> NO editable input, read-only chart only.
        it('AC3: time-series page + saved item does NOT render editable input (read-only chart only)', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HydrologyTimeSeriesClass, {
                    activeHydrologyItem: savedDesignStorm,
                    activeHydrologyPage: 'time-series',
                    dispatchUpdateRowData: noop,
                    dispatchReplaceRowData: noop
                }),
                container
            );
            // No editable inputs — only the read-only hyetograph chart
            const inputs = container.querySelectorAll('input');
            expect(inputs.length).toBe(0);
            // Chart wrapper present
            const chart = container.querySelector('#design-storm-hyetograph');
            expect(chart).toExist();
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });
    });

    // TASK-2032 (W5.10) — Hydrograph X-axis extends one tick past the final data point.
    describe('TASK-2032 HyetographChart hydrograph X-axis extension', () => {
        const { niceTimeTicks } = require('../components/hydrologyDetailTimeSeries');
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { HyetographChart } = require('../components/hydrologyDetailTimeSeries');

        const rowData = [
            {timestamp: '2025-01-01T00:00:00', value: 5},
            {timestamp: '2025-01-01T00:10:00', value: 10},
            {timestamp: '2025-01-01T00:20:00', value: 3}
        ];
        // durationMin = 20; niceTimeTicks(20) -> interval=10; xDomainMax=30

        // AC1 + AC4: hydrograph XAxis domain max > durationMin, extended tick rendered.
        it('AC1/AC4: hydrograph chart renders an x-axis tick beyond durationMin', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 10,
                    activeHydrologyPage: 'hydrographs'
                }),
                container
            );
            // niceTimeTicks(20) -> ticks=[0,10,20], interval=10 -> extended ticks=[0,10,20,30]
            // The chart wrapper must exist
            const chart = container.querySelector('#design-storm-hyetograph');
            expect(chart).toExist();
            // Verify extended tick labels render — recharts emits tick text "0:30"
            const html = container.innerHTML;
            expect(html.includes('0:30')).toBe(true);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // AC3: Design Storms BarChart XAxis stays at durationMin (no extended tick).
        it('AC3: design-storm chart does NOT render an x-axis tick beyond durationMin', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            ReactDOM.render(
                React.createElement(HyetographChart, {
                    rowData,
                    timestepMin: 10
                    // no activeHydrologyPage -> Design Storms path
                }),
                container
            );
            const html = container.innerHTML;
            // durationMin=20, niceTimeTicks(20) -> ticks=[0,10,20] -> "0:20" is the last tick
            // For design-storms the domain stays [0,20] and ticks=[0,10,20] -> no "0:30"
            expect(html.includes('0:30')).toBe(false);
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        });

        // niceTimeTicks sanity: interval is returned correctly.
        it('niceTimeTicks returns interval as well as ticks', () => {
            const result = niceTimeTicks(20);
            expect(result.interval).toBe(10);
            expect(result.ticks).toEqual([0, 10, 20]);
        });
    });

    // TASK-2007 (epic-2001 W2a) — the Derive pattern dropdown is sourced
    // STRICTLY from the project's own Temporal Pattern items (NOT the hardcoded
    // PRESET_FAMILIES); an empty project shows an empty-state nudge; a selected
    // item maps to the correct BE pattern (preset_key / alternating_block /
    // custom + custom_curve).
    describe('TASK-2007 DesignStormDerive strict project Temporal Pattern dropdown', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { act } = require('react-dom/test-utils');
        const { DesignStormDerive, resolveDerivePattern } = require('../components/hydrologyDetailTimeSeries');

        const baseProps = {
            idfTables: [],
            selectedIdfTableId: null,
            selectedPattern: null,
            onChange: () => {},
            previews: [],
            previewInFlight: false,
            saveInFlight: false,
            lastSavedCount: null,
            onPreview: () => {},
            onSave: () => {}
        };

        const render = (props) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            // act() flushes useEffect (the auto-preview dispatch) synchronously.
            act(() => {
                ReactDOM.render(
                    React.createElement(DesignStormDerive, {...baseProps, ...props}),
                    container
                );
            });
            return container;
        };
        const cleanup = (container) => {
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        };

        // AC1: options come from temporalPatterns, NOT PRESET_FAMILIES.
        it('AC1: dropdown options are the project Temporal Pattern items only', () => {
            const temporalPatterns = [
                {id: 11, name: 'Project SCS II', pattern_type: 'preset', pattern_key: 'SCS_TYPE_II'},
                {id: 12, name: 'Project AltBlock', pattern_type: 'alternating_block'}
            ];
            const container = render({temporalPatterns});
            const select = container.querySelector('#ds-derive-pattern');
            expect(select).toExist();
            const optionLabels = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
            // placeholder + the two project items, and NO PRESET_FAMILIES labels.
            expect(optionLabels).toContain('Project SCS II');
            expect(optionLabels).toContain('Project AltBlock');
            expect(optionLabels.some(l => /SCS \/ NRCS/.test(l))).toBe(false);
            expect(optionLabels.some(l => /Alternating Block \(Default\)/.test(l))).toBe(false);
            // option values are the TemporalPattern ids.
            const optionValues = Array.from(select.querySelectorAll('option')).map(o => o.value);
            expect(optionValues).toContain('11');
            expect(optionValues).toContain('12');
            cleanup(container);
        });

        // AC2: a custom-curve item appears and is selectable.
        it('AC2: a custom-curve Temporal Pattern item appears as an option', () => {
            const temporalPatterns = [
                {id: 21, name: 'My Custom Curve', pattern_type: 'custom',
                    data: {rowData: [{t: 0, cum: 0}, {t: 1, cum: 100}]}}
            ];
            const container = render({temporalPatterns});
            const select = container.querySelector('#ds-derive-pattern');
            const optionLabels = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
            expect(optionLabels).toContain('My Custom Curve');
            cleanup(container);
        });

        // AC3: empty project -> empty-state nudge, no <select>.
        it('AC3: empty project shows the empty-state nudge and no dropdown', () => {
            const container = render({temporalPatterns: []});
            expect(container.querySelector('#ds-derive-pattern')).toBe(null);
            expect(container.querySelector('#ds-derive-no-patterns')).toExist();
            cleanup(container);
        });

        // AC4: resolver maps each pattern_type to the right BE pattern params.
        it('AC4: resolveDerivePattern maps preset -> pattern_key', () => {
            const r = resolveDerivePattern({id: 1, pattern_type: 'preset', pattern_key: 'SCS_TYPE_II'});
            expect(r.patternKey).toBe('SCS_TYPE_II');
            expect(r.customCurve).toBe(null);
        });
        it('AC4: resolveDerivePattern maps alternating_block -> alternating_block', () => {
            const r = resolveDerivePattern({id: 2, pattern_type: 'alternating_block'});
            expect(r.patternKey).toBe('alternating_block');
            expect(r.customCurve).toBe(null);
        });
        it('AC4: resolveDerivePattern maps custom -> custom + data.rowData curve', () => {
            const curve = [{t: 0, cum: 0}, {t: 1, cum: 100}];
            const r = resolveDerivePattern({id: 3, pattern_type: 'custom', data: {rowData: curve}});
            expect(r.patternKey).toBe('custom');
            expect(r.customCurve).toEqual(curve);
        });

        // AC4 (integration): selecting a custom item builds preview cells that
        // carry pattern='custom' + the custom_curve threaded into the W2c batch.
        it('AC4: selecting a custom item dispatches preview cells with custom_curve', () => {
            const curve = [{t: 0, cum: 0}, {t: 0.5, cum: 60}, {t: 1, cum: 100}];
            const temporalPatterns = [
                {id: 31, name: 'Custom', pattern_type: 'custom', data: {rowData: curve}}
            ];
            const idfTables = [{
                id: 7,
                name: 'IDF 7',
                columnDefs: [
                    {accessorKey: 'duration', header: 'Duration'},
                    {accessorKey: 'rp100', header: '100yr ARI'}
                ],
                rowData: [{duration: 360, rp100: 12.5}]
            }];
            let previewArgs = null;
            const container = render({
                temporalPatterns,
                idfTables,
                selectedIdfTableId: 7,
                selectedPattern: '31',
                onPreview: (cells, idfId) => { previewArgs = {cells, idfId}; }
            });
            expect(previewArgs).toExist();
            expect(previewArgs.cells.length).toBeGreaterThan(0);
            const cell = previewArgs.cells[0];
            expect(cell.pattern).toBe('custom');
            expect(cell.custom_curve).toEqual(curve);
            cleanup(container);
        });
    });

    // TASK-2008 (epic-2001 W2b) — the Derive preview is a shared MatrixGrid
    // primitive: a RP (columns) x duration (rows) tick/cross grid for the single
    // selected Temporal Pattern. Derivable cells (a preview exists) are tick
    // toggles; non-derivable cells render a disabled cross.
    describe('TASK-2008 MatrixGrid RP x duration derive matrix', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { act } = require('react-dom/test-utils');
        const MatrixGrid = require('../components/MatrixGrid').default;
        const { DesignStormDerive } = require('../components/hydrologyDetailTimeSeries');

        const renderEl = (el) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            act(() => { ReactDOM.render(el, container); });
            return container;
        };
        const cleanup = (container) => {
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        };

        // AC4 (primitive): MatrixGrid renders corner + col headers + row headers
        // + a cell per (row, col) via renderCell, with no IDF-edit coupling.
        it('AC4: MatrixGrid renders a corner, column headers, row headers and cells', () => {
            const rows = [{key: '60', label: '60 min'}, {key: '360', label: '6.0 hr'}];
            const cols = [{key: '10', label: '10yr'}, {key: '100', label: '100yr'}];
            const container = renderEl(React.createElement(MatrixGrid, {
                tableId: 'test-matrix',
                cornerLabel: 'Duration',
                rows,
                cols,
                renderCell: (row, col) => `${row.key}:${col.key}`
            }));
            const table = container.querySelector('#test-matrix');
            expect(table).toExist();
            const headerCells = table.querySelectorAll('thead th');
            // corner + 2 col headers
            expect(headerCells.length).toBe(3);
            const bodyRows = table.querySelectorAll('tbody tr');
            expect(bodyRows.length).toBe(2);
            // each body row: 1 row-header + 2 cells
            expect(bodyRows[0].querySelectorAll('td').length).toBe(3);
            // no IDF intensity-edit input leaked into the primitive
            expect(table.querySelector('.sv-idf-matrix-input')).toBe(null);
            cleanup(container);
        });

        const idfTables = [{
            id: 7,
            name: 'IDF 7',
            columnDefs: [
                {accessorKey: 'duration', header: 'Duration'},
                {accessorKey: 'rp10', header: '10yr ARI'},
                {accessorKey: 'rp100', header: '100yr ARI'}
            ],
            rowData: [
                {duration: 60, rp10: 8.0, rp100: 18.0},
                {duration: 360, rp10: 3.0, rp100: 7.0}
            ]
        }];
        const temporalPatterns = [
            {id: 51, name: 'SCS II', pattern_type: 'preset', pattern_key: 'SCS_TYPE_II'}
        ];
        // Previews echo the BE pattern key + ari/duration_min/total_depth_mm.
        const previews = [
            {pattern: 'SCS_TYPE_II', ari: 10, duration_min: 60, timestep_min: 5, total_depth_mm: 8.0},
            {pattern: 'SCS_TYPE_II', ari: 100, duration_min: 60, timestep_min: 5, total_depth_mm: 18.0},
            {pattern: 'SCS_TYPE_II', ari: 10, duration_min: 360, timestep_min: 15, total_depth_mm: 18.0}
            // (100yr / 360min intentionally MISSING -> non-derivable cell)
        ];
        const deriveProps = {
            idfTables,
            temporalPatterns,
            selectedIdfTableId: 7,
            selectedPattern: '51',
            onChange: () => {},
            previews,
            previewInFlight: false,
            saveInFlight: false,
            lastSavedCount: null,
            onPreview: () => {},
            onSave: () => {}
        };
        const renderDerive = (props) => renderEl(
            React.createElement(DesignStormDerive, {...deriveProps, ...props})
        );

        // AC1: the matrix renders for the selected pattern.
        it('AC1: a RP x duration matrix renders in the derive panel', () => {
            const container = renderDerive();
            const matrix = container.querySelector('#ds-derive-matrix');
            expect(matrix).toExist();
            // 2 durations -> 2 body rows; 2 RP cols.
            expect(matrix.querySelectorAll('tbody tr').length).toBe(2);
            expect(matrix.querySelectorAll('thead th').length).toBe(3); // corner + 2 RP
            cleanup(container);
        });

        // AC3: the missing (100yr / 360min) cell renders a disabled cross.
        it('AC3: a non-derivable cell renders a disabled cross', () => {
            const container = renderDerive();
            const disabled = container.querySelectorAll('.sv-ds-derive-cell--disabled');
            expect(disabled.length).toBe(1);
            expect(disabled[0].textContent).toBe('✕');
            cleanup(container);
        });

        // AC2: ticking a derivable cell selects it (maps to the right preview).
        it('AC2: ticking a derivable cell toggles its tick state', () => {
            const container = renderDerive();
            // previewKey for (SCS_TYPE_II, 10, 60)
            const tickBtn = container.querySelector('[id="ds-derive-tick-SCS_TYPE_II|10|60"]');
            expect(tickBtn).toExist();
            expect(tickBtn.getAttribute('aria-pressed')).toBe('false');
            act(() => { tickBtn.click(); });
            const after = container.querySelector('[id="ds-derive-tick-SCS_TYPE_II|10|60"]');
            expect(after.getAttribute('aria-pressed')).toBe('true');
            cleanup(container);
        });

        // AC5: a ticked cell saved via handleSave maps to the right BE cell.
        it('AC2/AC5: saving a ticked cell dispatches the right {pattern, ari, duration_min}', () => {
            let saveArgs = null;
            const container = renderDerive({onSave: (cells, idfId) => { saveArgs = {cells, idfId}; }});
            act(() => { container.querySelector('[id="ds-derive-tick-SCS_TYPE_II|100|60"]').click(); });
            act(() => { container.querySelector('#sv-ds-derive-save-btn').click(); });
            expect(saveArgs).toExist();
            expect(saveArgs.idfId).toBe(7);
            expect(saveArgs.cells.length).toBe(1);
            expect(saveArgs.cells[0].pattern).toBe('SCS_TYPE_II');
            expect(saveArgs.cells[0].ari).toBe(100);
            expect(saveArgs.cells[0].duration_min).toBe(60);
            cleanup(container);
        });

        // TASK-2011 (W3b): the saved cell carries the Temporal Pattern item id
        // so the BE can re-key the REPLACE per item (two SCS-II presets no longer
        // clobber each other). selectedPattern='51' -> temporal_pattern_id 51.
        it('TASK-2011: saving a ticked cell includes temporal_pattern_id', () => {
            let saveArgs = null;
            const container = renderDerive({onSave: (cells, idfId) => { saveArgs = {cells, idfId}; }});
            act(() => { container.querySelector('[id="ds-derive-tick-SCS_TYPE_II|100|60"]').click(); });
            act(() => { container.querySelector('#sv-ds-derive-save-btn').click(); });
            expect(saveArgs).toExist();
            expect(saveArgs.cells.length).toBe(1);
            expect(saveArgs.cells[0].temporal_pattern_id).toBe(51);
            cleanup(container);
        });
    });

    // TASK-2009 (epic-2001 W2d) — the action button reads 'Derive' (new i18n
    // key deriveActionButton) and still dispatches the existing save flow
    // (handleSave -> onSave -> mode='save'); no endpoint change.
    describe('TASK-2009 DesignStormDerive action button relabel', () => {
        const React = require('react');
        const ReactDOM = require('react-dom');
        const { act } = require('react-dom/test-utils');
        const { DesignStormDerive } = require('../components/hydrologyDetailTimeSeries');

        const baseProps = {
            idfTables: [{
                id: 7, name: 'IDF 7',
                columnDefs: [
                    {accessorKey: 'duration', header: 'Duration'},
                    {accessorKey: 'rp100', header: '100yr ARI'}
                ],
                rowData: [{duration: 60, rp100: 18.0}]
            }],
            temporalPatterns: [{id: 51, name: 'SCS II', pattern_type: 'preset', pattern_key: 'SCS_TYPE_II'}],
            selectedIdfTableId: 7,
            selectedPattern: '51',
            onChange: () => {},
            previews: [{pattern: 'SCS_TYPE_II', ari: 100, duration_min: 60, timestep_min: 5, total_depth_mm: 18.0}],
            previewInFlight: false,
            saveInFlight: false,
            lastSavedCount: null,
            onPreview: () => {},
            onSave: () => {}
        };
        const render = (props) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            act(() => {
                ReactDOM.render(React.createElement(DesignStormDerive, {...baseProps, ...props}), container);
            });
            return container;
        };
        const cleanup = (container) => {
            ReactDOM.unmountComponentAtNode(container);
            document.body.removeChild(container);
        };

        // AC1: the button reads the new 'Derive' i18n key, not the old one.
        it('AC1: action button uses the deriveActionButton i18n key (not deriveSaveTheseN)', () => {
            const container = render();
            const btn = container.querySelector('#sv-ds-derive-save-btn');
            expect(btn).toExist();
            // Message without intl context renders the msgId string.
            expect(btn.textContent).toContain('deriveActionButton');
            expect(btn.textContent).toNotContain('deriveSaveTheseN');
            cleanup(container);
        });

        // AC2/AC3: clicking still dispatches the existing save flow, unchanged.
        it('AC2: clicking dispatches onSave (mode=save) with the ticked cell', () => {
            let saveArgs = null;
            const container = render({onSave: (cells, idfId) => { saveArgs = {cells, idfId}; }});
            act(() => { container.querySelector('[id="ds-derive-tick-SCS_TYPE_II|100|60"]').click(); });
            act(() => { container.querySelector('#sv-ds-derive-save-btn').click(); });
            expect(saveArgs).toExist();
            expect(saveArgs.idfId).toBe(7);
            expect(saveArgs.cells.length).toBe(1);
            expect(saveArgs.cells[0].pattern).toBe('SCS_TYPE_II');
            cleanup(container);
        });
    });
});
