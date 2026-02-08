import expect from 'expect';
import reducer from '../reducersSwamm';
import {
    SET_SWAMM_PROJECT_DATA,
    FETCH_SWAMM_BMPTYPES_SUCCESS,
    FETCH_GROUP_PROFILES_SUCCESS,
    FETCH_SWAMM_ALL_BMPS_SUCCESS,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS,
    FETCH_SWAMM_TARGETS_SUCCESS,
    SELECT_SWAMM_TARGET_ID,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_PRIORITY_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    SHOW_BMP_FORM,
    HIDE_BMP_FORM,
    SHOW_BMP_MANAGER,
    HIDE_BMP_MANAGER,
    TOGGLE_BMP_MANAGER,
    SHOW_SWAMM_DATA_GRID,
    HIDE_SWAMM_DATA_GRID,
    SHOW_SWAMM_BMP_CHART,
    HIDE_SWAMM_BMP_CHART,
    MAKE_BMP_FORM,
    CLEAR_BMP_FORM,
    UPDATE_BMP_FORM,
    SET_BMP_FILTER_MODE,
    SET_EXPANDED_FILTER,
    SET_SWAMM_INPUT_MENU,
    DELETE_BMP_SUCCESS,
    setSwammProjectData,
    initSwamm,
    showBmpForm,
    hideBmpForm,
    showBmpManager,
    hideBmpManager,
    toggleBmpManager,
    showSwammDataGrid,
    hideSwammDataGrid,
    showSwammBmpChart,
    hideSwammBmpChart,
    makeBmpForm,
    clearBmpForm,
    updateBmpForm,
    setBmpFilterMode,
    setExpandedFilter,
    selectSwammTargetId,
    toggleBmpTypeVisibility,
    toggleBmpPriorityVisibility,
    setAllBmpTypesVisibility,
    setSwammInputMenu
} from '../actionsSwamm';

describe('Swamm Plugin', () => {
    describe('Action Creators', () => {
        it('initSwamm creates correct action', () => {
            const action = initSwamm();
            expect(action.type).toBe('INIT_SWAMM');
        });

        it('setSwammProjectData creates correct action', () => {
            const data = { id: 1, name: 'Test Project' };
            const action = setSwammProjectData(data);
            expect(action.type).toBe(SET_SWAMM_PROJECT_DATA);
            expect(action.projectData).toEqual(data);
        });

        it('showBmpForm creates correct action', () => {
            const action = showBmpForm();
            expect(action.type).toBe(SHOW_BMP_FORM);
        });

        it('hideBmpForm creates correct action', () => {
            const action = hideBmpForm();
            expect(action.type).toBe(HIDE_BMP_FORM);
        });

        it('showBmpManager creates correct action', () => {
            const action = showBmpManager();
            expect(action.type).toBe(SHOW_BMP_MANAGER);
        });

        it('hideBmpManager creates correct action', () => {
            const action = hideBmpManager();
            expect(action.type).toBe(HIDE_BMP_MANAGER);
        });

        it('toggleBmpManager creates correct action', () => {
            const action = toggleBmpManager();
            expect(action.type).toBe(TOGGLE_BMP_MANAGER);
        });

        it('showSwammDataGrid creates correct action', () => {
            const action = showSwammDataGrid();
            expect(action.type).toBe(SHOW_SWAMM_DATA_GRID);
        });

        it('hideSwammDataGrid creates correct action', () => {
            const action = hideSwammDataGrid();
            expect(action.type).toBe(HIDE_SWAMM_DATA_GRID);
        });

        it('showSwammBmpChart creates correct action', () => {
            const action = showSwammBmpChart();
            expect(action.type).toBe(SHOW_SWAMM_BMP_CHART);
        });

        it('hideSwammBmpChart creates correct action', () => {
            const action = hideSwammBmpChart();
            expect(action.type).toBe(HIDE_SWAMM_BMP_CHART);
        });

        it('makeBmpForm creates correct action', () => {
            const groupProfile = { pk: 1, title: 'Test Group' };
            const action = makeBmpForm(groupProfile);
            expect(action.type).toBe(MAKE_BMP_FORM);
            expect(action.groupProfile).toEqual(groupProfile);
        });

        it('clearBmpForm creates correct action', () => {
            const action = clearBmpForm();
            expect(action.type).toBe(CLEAR_BMP_FORM);
        });

        it('updateBmpForm creates correct action', () => {
            const kv = { name: 'New Name' };
            const action = updateBmpForm(kv);
            expect(action.type).toBe(UPDATE_BMP_FORM);
            expect(action.kv).toEqual(kv);
        });

        it('setBmpFilterMode creates correct action', () => {
            const action = setBmpFilterMode('status');
            expect(action.type).toBe(SET_BMP_FILTER_MODE);
            expect(action.bmpFilterMode).toBe('status');
        });

        it('setExpandedFilter creates correct action', () => {
            const action = setExpandedFilter('types');
            expect(action.type).toBe(SET_EXPANDED_FILTER);
            expect(action.expandedFilter).toBe('types');
        });

        it('selectSwammTargetId creates correct action', () => {
            const action = selectSwammTargetId(123);
            expect(action.type).toBe(SELECT_SWAMM_TARGET_ID);
            expect(action.selectedTargetId).toBe(123);
        });

        it('toggleBmpTypeVisibility creates correct action', () => {
            const bmpType = { id: 1, name: 'Rain Garden' };
            const action = toggleBmpTypeVisibility(bmpType);
            expect(action.type).toBe(TOGGLE_BMP_TYPE_VISIBILITY);
            expect(action.bmpType).toEqual(bmpType);
        });

        it('toggleBmpPriorityVisibility creates correct action', () => {
            const priority = { id: 1, label: 'Critical' };
            const action = toggleBmpPriorityVisibility(priority);
            expect(action.type).toBe(TOGGLE_BMP_PRIORITY_VISIBILITY);
            expect(action.priority).toEqual(priority);
        });

        it('setAllBmpTypesVisibility creates correct action', () => {
            const action = setAllBmpTypesVisibility(true);
            expect(action.type).toBe(SET_ALL_BMP_TYPES_VISIBILITY);
            expect(action.boolValue).toBe(true);
        });

        it('setSwammInputMenu creates correct action', () => {
            const action = setSwammInputMenu(true);
            expect(action.type).toBe(SET_SWAMM_INPUT_MENU);
            expect(action.visible).toBe(true);
        });
    });

    describe('Reducer', () => {
        const initialState = {
            showOutlets: true,
            showFootprints: true,
            showWatersheds: true,
            bmpTypes: [],
            groupProfiles: [],
            allBmps: [],
            statuses: [],
            targets: [],
            visibleBmpForm: false,
            visibleTargetForm: false,
            creatingNewBmp: false,
            drawingBmpLayerName: false,
            bmpFilterMode: 'type',
            expandedFilter: null,
            priorities: [
                {id: 0, label: 'Not Assigned', value: 0, visibility: true},
                {id: 1, label: 'Critical', value: 1, visibility: true},
                {id: 2, label: 'Normal', value: 2, visibility: true},
                {id: 3, label: 'Low', value: 3, visibility: true}
            ]
        };

        it('should return initial state', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state).toEqual(initialState);
        });

        it('should handle SET_SWAMM_PROJECT_DATA', () => {
            const projectData = { id: 1, name: 'Test Project' };
            const state = reducer(initialState, {
                type: SET_SWAMM_PROJECT_DATA,
                projectData: projectData
            });
            expect(state.projectData).toEqual(projectData);
        });

        it('should handle FETCH_SWAMM_BMPTYPES_SUCCESS and sort by name', () => {
            const bmpTypes = [
                { id: 2, name: 'Wetland', visibility: true },
                { id: 1, name: 'Bio Swale', visibility: true }
            ];
            const state = reducer(initialState, {
                type: FETCH_SWAMM_BMPTYPES_SUCCESS,
                bmpTypes: bmpTypes
            });
            expect(state.bmpTypes[0].name).toBe('Bio Swale');
            expect(state.bmpTypes[1].name).toBe('Wetland');
        });

        it('should handle FETCH_GROUP_PROFILES_SUCCESS', () => {
            const groupProfiles = [{ id: 1, title: 'Test Group' }];
            const state = reducer(initialState, {
                type: FETCH_GROUP_PROFILES_SUCCESS,
                groupProfiles: groupProfiles
            });
            expect(state.groupProfiles).toEqual(groupProfiles);
        });

        it('should handle FETCH_SWAMM_ALL_BMPS_SUCCESS', () => {
            const allBmps = [{ id: 1, name: 'BMP 1' }];
            const state = reducer(initialState, {
                type: FETCH_SWAMM_ALL_BMPS_SUCCESS,
                allBmps: allBmps
            });
            expect(state.allBmps).toEqual(allBmps);
        });

        it('should handle FETCH_SWAMM_BMP_STATUSES_SUCCESS', () => {
            const statuses = [{ id: 1, name: 'Active' }];
            const state = reducer(initialState, {
                type: FETCH_SWAMM_BMP_STATUSES_SUCCESS,
                statuses: statuses
            });
            expect(state.statuses).toEqual(statuses);
        });

        it('should handle FETCH_SWAMM_TARGETS_SUCCESS', () => {
            const targets = [{ id: 1, name: 'Target 1' }];
            const state = reducer(initialState, {
                type: FETCH_SWAMM_TARGETS_SUCCESS,
                targets: targets
            });
            expect(state.targets).toEqual(targets);
        });

        it('should handle SELECT_SWAMM_TARGET_ID', () => {
            const state = reducer(initialState, {
                type: SELECT_SWAMM_TARGET_ID,
                selectedTargetId: 123
            });
            expect(state.selectedTargetId).toBe(123);
        });

        it('should handle TOGGLE_BMP_TYPE_VISIBILITY', () => {
            const stateWithTypes = {
                ...initialState,
                bmpTypes: [
                    { id: 1, name: 'Rain Garden', visibility: true },
                    { id: 2, name: 'Wetland', visibility: true }
                ]
            };
            const state = reducer(stateWithTypes, {
                type: TOGGLE_BMP_TYPE_VISIBILITY,
                bmpType: { id: 1, name: 'Rain Garden', visibility: true }
            });
            expect(state.bmpTypes[0].visibility).toBe(false);
            expect(state.bmpTypes[1].visibility).toBe(true);
        });

        it('should handle TOGGLE_BMP_PRIORITY_VISIBILITY', () => {
            const state = reducer(initialState, {
                type: TOGGLE_BMP_PRIORITY_VISIBILITY,
                priority: { id: 1, label: 'Critical', visibility: true }
            });
            expect(state.priorities[1].visibility).toBe(false);
        });

        it('should handle SET_ALL_BMP_TYPES_VISIBILITY', () => {
            const stateWithTypes = {
                ...initialState,
                bmpTypes: [
                    { id: 1, visibility: true },
                    { id: 2, visibility: true }
                ]
            };
            const state = reducer(stateWithTypes, {
                type: SET_ALL_BMP_TYPES_VISIBILITY,
                boolValue: false
            });
            expect(state.bmpTypes[0].visibility).toBe(false);
            expect(state.bmpTypes[1].visibility).toBe(false);
        });

        it('should handle SHOW_BMP_FORM', () => {
            const state = reducer(initialState, { type: SHOW_BMP_FORM });
            expect(state.visibleBmpForm).toBe(true);
        });

        it('should handle HIDE_BMP_FORM', () => {
            const stateWithForm = { ...initialState, visibleBmpForm: true };
            const state = reducer(stateWithForm, { type: HIDE_BMP_FORM });
            expect(state.visibleBmpForm).toBe(false);
        });

        it('should handle SHOW_BMP_MANAGER', () => {
            const state = reducer(initialState, { type: SHOW_BMP_MANAGER });
            expect(state.visibleBmpManager).toBe(true);
        });

        it('should handle HIDE_BMP_MANAGER', () => {
            const stateWithManager = { ...initialState, visibleBmpManager: true };
            const state = reducer(stateWithManager, { type: HIDE_BMP_MANAGER });
            expect(state.visibleBmpManager).toBe(false);
        });

        it('should handle TOGGLE_BMP_MANAGER', () => {
            const state1 = reducer(initialState, { type: TOGGLE_BMP_MANAGER });
            expect(state1.visibleBmpManager).toBe(true);
            const state2 = reducer(state1, { type: TOGGLE_BMP_MANAGER });
            expect(state2.visibleBmpManager).toBe(false);
        });

        it('should handle SHOW_SWAMM_DATA_GRID', () => {
            const state = reducer(initialState, { type: SHOW_SWAMM_DATA_GRID });
            expect(state.visibleSwammDataGrid).toBe(true);
        });

        it('should handle HIDE_SWAMM_DATA_GRID', () => {
            const stateWithGrid = { ...initialState, visibleSwammDataGrid: true };
            const state = reducer(stateWithGrid, { type: HIDE_SWAMM_DATA_GRID });
            expect(state.visibleSwammDataGrid).toBe(false);
        });

        it('should handle SHOW_SWAMM_BMP_CHART', () => {
            const state = reducer(initialState, { type: SHOW_SWAMM_BMP_CHART });
            expect(state.visibleSwammBmpChart).toBe(true);
        });

        it('should handle HIDE_SWAMM_BMP_CHART', () => {
            const stateWithChart = { ...initialState, visibleSwammBmpChart: true };
            const state = reducer(stateWithChart, { type: HIDE_SWAMM_BMP_CHART });
            expect(state.visibleSwammBmpChart).toBe(false);
        });

        it('should handle MAKE_BMP_FORM', () => {
            const groupProfile = { pk: 1, title: 'Test Group' };
            const state = reducer(initialState, {
                type: MAKE_BMP_FORM,
                groupProfile: groupProfile
            });
            expect(state.creatingNewBmp).toBe(true);
            expect(state.visibleBmpForm).toBe(true);
            expect(state.storedBmpForm.group_profile_id).toBe(1);
            expect(state.storedBmpForm.group_profile).toEqual(groupProfile);
        });

        it('should handle CLEAR_BMP_FORM', () => {
            const stateWithForm = {
                ...initialState,
                creatingNewBmp: true,
                storedBmpForm: { id: 1 },
                visibleBmpForm: true
            };
            const state = reducer(stateWithForm, { type: CLEAR_BMP_FORM });
            expect(state.creatingNewBmp).toBe(false);
            expect(state.storedBmpForm).toBe(null);
            expect(state.visibleBmpForm).toBe(false);
        });

        it('should handle UPDATE_BMP_FORM', () => {
            const stateWithForm = {
                ...initialState,
                storedBmpForm: { name: 'Old Name' }
            };
            const state = reducer(stateWithForm, {
                type: UPDATE_BMP_FORM,
                kv: { notes: 'New notes' }
            });
            expect(state.storedBmpForm.notes).toBe('New notes');
        });

        it('should handle SET_BMP_FILTER_MODE', () => {
            const state = reducer(initialState, {
                type: SET_BMP_FILTER_MODE,
                bmpFilterMode: 'status'
            });
            expect(state.bmpFilterMode).toBe('status');
        });

        it('should handle SET_EXPANDED_FILTER - toggle on', () => {
            const state = reducer(initialState, {
                type: SET_EXPANDED_FILTER,
                expandedFilter: 'types'
            });
            expect(state.expandedFilter).toBe('types');
        });

        it('should handle SET_EXPANDED_FILTER - toggle off', () => {
            const stateWithFilter = { ...initialState, expandedFilter: 'types' };
            const state = reducer(stateWithFilter, {
                type: SET_EXPANDED_FILTER,
                expandedFilter: 'types'
            });
            expect(state.expandedFilter).toBe(null);
        });

        it('should handle SET_SWAMM_INPUT_MENU', () => {
            const state = reducer(initialState, {
                type: SET_SWAMM_INPUT_MENU,
                visible: true
            });
            expect(state.showSwammInputMenu).toBe(true);
        });

        it('should handle DELETE_BMP_SUCCESS', () => {
            const stateWithBmps = {
                ...initialState,
                allBmps: [
                    { id: 1, name: 'BMP 1' },
                    { id: 2, name: 'BMP 2' }
                ]
            };
            const state = reducer(stateWithBmps, {
                type: DELETE_BMP_SUCCESS,
                bmpId: 1
            });
            expect(state.allBmps.length).toBe(1);
            expect(state.allBmps[0].id).toBe(2);
        });
    });
});
