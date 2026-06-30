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
});
