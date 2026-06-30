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

            it('time-series on empty tab → "Design Storm 01"', () => {
                const state = reducer(
                    { ...initialState, timeSeriess: [] },
                    createHydrologyForm('time-series')
                );
                expect(state.timeSeriess.length).toBe(1);
                expect(state.timeSeriess[0].name).toBe('Design Storm 01');
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

            it('time-series with existing ...01/...02 → "Design Storm 03"', () => {
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
                expect(state.timeSeriess.length).toBe(3);
                expect(state.timeSeriess[2].name).toBe('Design Storm 03');
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
});
