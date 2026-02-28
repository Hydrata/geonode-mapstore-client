import expect from 'expect';
import reducer from '../reducersSwamm';
import {
    SET_SWAMM_PROJECT_DATA,
    FETCH_SWAMM_BMPTYPES,
    FETCH_SWAMM_BMPTYPES_SUCCESS,
    FETCH_GROUP_PROFILES,
    FETCH_GROUP_PROFILES_SUCCESS,
    FETCH_PROJECT_MANAGER_CONFIG,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    FETCH_SWAMM_ALL_BMPS_SUCCESS,
    FETCH_SWAMM_BMP_STATUSES,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS,
    FETCH_SWAMM_TARGETS_SUCCESS,
    SELECT_SWAMM_TARGET_ID,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_PRIORITY_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    TOGGLE_BMP_TYPE_GROUP,
    SET_ALL_BMP_TYPES_VISIBILITY,
    SET_BMP_TYPE,
    SET_MENU_GROUP,
    SHOW_BMP_FORM,
    HIDE_BMP_FORM,
    SHOW_LOADING_BMP,
    HIDE_LOADING_BMP,
    SHOW_BMP_MANAGER,
    HIDE_BMP_MANAGER,
    TOGGLE_BMP_MANAGER,
    SHOW_SWAMM_DATA_GRID,
    HIDE_SWAMM_DATA_GRID,
    SHOW_SWAMM_BMP_CHART,
    HIDE_SWAMM_BMP_CHART,
    SHOW_TARGET_FORM,
    HIDE_TARGET_FORM,
    UPDATE_TARGET_FORM,
    MAKE_BMP_FORM,
    MAKE_DEFAULTS_BMP_FORM,
    MAKE_EXISTING_BMP_FORM,
    CLEAR_BMP_FORM,
    UPDATE_BMP_FORM,
    SUBMIT_BMP_FORM_SUCCESS,
    SUBMIT_BMP_FORM_ERROR,
    SET_DRAWING_BMP_LAYER_NAME,
    CLEAR_DRAWING_BMP_LAYER_NAME,
    SET_EXPANDED_BMP_TYPE_GROUP_NAME,
    REGISTER_MISSING_BMP_FEATURE_ID,
    SET_COMPLEX_BMP_FORM,
    SET_BMP_LAYERS,
    SET_CHANGING_BMP_TYPE,
    SET_EDITING_BMP_FEATURE_ID,
    CLEAR_EDITING_BMP_FEATURE_ID,
    SET_BMP_FILTER_MODE,
    SET_EXPANDED_FILTER,
    SET_SWAMM_INPUT_MENU,
    UPDATE_BMP_TYPE_GROUPS,
    SET_SWAMM_EROSION_DATA,
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

        // ──────────────────────────────────────────────────────────────
        // Phase 0D: Additional reducer cases covering all 42 switch cases
        // ──────────────────────────────────────────────────────────────

        it('should handle FETCH_GROUP_PROFILES (loading state)', () => {
            const state = reducer(initialState, {
                type: FETCH_GROUP_PROFILES,
                groupProfiles: 'loading'
            });
            expect(state.fetchingGroupProfiles).toBe('loading');
        });

        it('should handle FETCH_GROUP_PROFILES_SUCCESS clears fetching', () => {
            const stateLoading = { ...initialState, fetchingGroupProfiles: true };
            const state = reducer(stateLoading, {
                type: FETCH_GROUP_PROFILES_SUCCESS,
                groupProfiles: [{ id: 1, title: 'Group A' }]
            });
            expect(state.fetchingGroupProfiles).toBe(false);
            expect(state.groupProfiles.length).toBe(1);
        });

        it('should handle FETCH_PROJECT_MANAGER_CONFIG (loading state)', () => {
            const state = reducer(initialState, {
                type: FETCH_PROJECT_MANAGER_CONFIG,
                mapId: 42
            });
            expect(state.fetching).toBe(42);
        });

        it('should handle FETCH_PROJECT_MANAGER_CONFIG_SUCCESS', () => {
            const stateLoading = { ...initialState, fetching: 42 };
            const config = { id: 1, base_map: 42, code: 'TST' };
            const state = reducer(stateLoading, {
                type: FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
                payload: config
            });
            expect(state.fetching).toBe(null);
            expect(state.data).toEqual(config);
        });

        it('should handle FETCH_SWAMM_BMPTYPES (loading state)', () => {
            const state = reducer(initialState, {
                type: FETCH_SWAMM_BMPTYPES,
                mapId: 42
            });
            expect(state.fetching).toBe(42);
        });

        it('should handle FETCH_SWAMM_BMP_STATUSES (loading state)', () => {
            const state = reducer(initialState, {
                type: FETCH_SWAMM_BMP_STATUSES
            });
            expect(state.fetchingStatuses).toBe(true);
        });

        it('should handle SHOW_LOADING_BMP', () => {
            const state = reducer(initialState, { type: SHOW_LOADING_BMP });
            expect(state.loadingBmp).toBe(true);
        });

        it('should handle HIDE_LOADING_BMP', () => {
            const stateLoading = { ...initialState, loadingBmp: true };
            const state = reducer(stateLoading, { type: HIDE_LOADING_BMP });
            expect(state.loadingBmp).toBe(false);
        });

        it('should handle TOGGLE_BMP_GROUP_PROFILE_VISIBILITY', () => {
            const stateWithProfiles = {
                ...initialState,
                groupProfiles: [
                    { id: 1, title: 'Group A', visibility: true },
                    { id: 2, title: 'Group B', visibility: true }
                ]
            };
            const state = reducer(stateWithProfiles, {
                type: TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
                groupProfile: { id: 1, title: 'Group A', visibility: true }
            });
            expect(state.groupProfiles[0].visibility).toBe(false);
            expect(state.groupProfiles[1].visibility).toBe(true);
        });

        it('should handle TOGGLE_BMP_STATUS_VISIBILITY', () => {
            const stateWithStatuses = {
                ...initialState,
                statuses: [
                    { id: 1, name: 'Operational', visibility: true },
                    { id: 2, name: 'Proposed', visibility: true }
                ]
            };
            const state = reducer(stateWithStatuses, {
                type: TOGGLE_BMP_STATUS_VISIBILITY,
                status: { id: 1, name: 'Operational', visibility: true }
            });
            expect(state.statuses[0].visibility).toBe(false);
            expect(state.statuses[1].visibility).toBe(true);
        });

        it('should handle SET_BMP_TYPE', () => {
            const stateWithTypes = {
                ...initialState,
                bmpTypes: [
                    { id: 1, name: 'Rain Garden', visibility: true },
                    { id: 2, name: 'Wetland', visibility: true }
                ]
            };
            const state = reducer(stateWithTypes, {
                type: SET_BMP_TYPE,
                bmpType: { id: 1, name: 'Rain Garden' },
                isVisible: false
            });
            expect(state.bmpTypes[0].visibility).toBe(false);
            expect(state.bmpTypes[1].visibility).toBe(true);
        });

        it('should handle SET_MENU_GROUP with truthy payload hides BMP manager', () => {
            const stateWithManager = { ...initialState, visibleBmpManager: true };
            const state = reducer(stateWithManager, {
                type: SET_MENU_GROUP,
                payload: 'some_group'
            });
            expect(state.visibleBmpManager).toBe(false);
        });

        it('should handle SET_MENU_GROUP with falsy payload keeps state', () => {
            const stateWithManager = { ...initialState, visibleBmpManager: true };
            const state = reducer(stateWithManager, {
                type: SET_MENU_GROUP,
                payload: null
            });
            expect(state.visibleBmpManager).toBe(true);
        });

        it('should handle MAKE_DEFAULTS_BMP_FORM', () => {
            const stateWithForm = {
                ...initialState,
                storedBmpForm: { group_profile_id: 1 }
            };
            const bmpType = {
                id: 5,
                name: 'Bio Swale',
                project: { id: 42 },
                n_surface_red_percent: 45,
                p_surface_red_percent: 30,
                s_surface_red_percent: 25,
                n_tiled_red_percent: 10,
                p_tiled_red_percent: 8,
                n_erosion_red_percent: 50,
                p_erosion_red_percent: 40,
                s_erosion_red_percent: 35,
                cost_base: 5000,
                cost_rate_per_watershed_area: 100,
                cost_rate_per_footprint_area: 200
            };
            const state = reducer(stateWithForm, {
                type: MAKE_DEFAULTS_BMP_FORM,
                bmpType: bmpType
            });
            expect(state.storedBmpForm.bmpName).toBe('Bio Swale');
            expect(state.storedBmpForm.type).toBe(5);
            expect(state.storedBmpForm.type_data).toEqual(bmpType);
            expect(state.storedBmpForm.override_n_surface_red_percent).toBe(45);
            expect(state.storedBmpForm.override_cost_base).toBe(5000);
            // Preserves existing form fields (group_profile_id)
            expect(state.storedBmpForm.group_profile_id).toBe(1);
        });

        it('should handle MAKE_EXISTING_BMP_FORM', () => {
            const bmp = {
                id: 99,
                type_data: { id: 5, name: 'Bio Swale' },
                project: 42,
                group_profile: { id: 1, title: 'Group A' },
                override_n_surface_red_percent: 45,
                override_p_surface_red_percent: 30,
                override_s_surface_red_percent: 25,
                override_n_tiled_red_percent: 10,
                override_p_tiled_red_percent: 8,
                override_n_erosion_red_percent: 50,
                override_p_erosion_red_percent: 40,
                override_s_erosion_red_percent: 35,
                override_cost_base: 5000,
                override_cost_rate_per_watershed_area: 100,
                override_cost_rate_per_footprint_area: 200,
                notes: 'Test notes',
                owner_identifier: 'owner1',
                field_identifier: 'field1',
                outlet_fid: 10,
                footprint_fid: 20,
                watershed_fid: 30
            };
            const state = reducer(initialState, {
                type: MAKE_EXISTING_BMP_FORM,
                bmp: bmp
            });
            expect(state.storedBmpForm.id).toBe(99);
            expect(state.storedBmpForm.bmpName).toBe('Bio Swale');
            expect(state.storedBmpForm.type).toBe(5);
            expect(state.storedBmpForm.outlet_fid).toBe(10);
            expect(state.storedBmpForm.footprint_fid).toBe(20);
            expect(state.storedBmpForm.watershed_fid).toBe(30);
            expect(state.updatingBmp).toBe(null);
        });

        it('should handle MAKE_EXISTING_BMP_FORM preserves storedBmpForm FIDs', () => {
            const stateWithFids = {
                ...initialState,
                storedBmpForm: { outlet_fid: 100, footprint_fid: 200, watershed_fid: 300 }
            };
            const bmp = {
                id: 99,
                type_data: { id: 5, name: 'Bio Swale' },
                outlet_fid: 10,
                footprint_fid: 20,
                watershed_fid: 30
            };
            const state = reducer(stateWithFids, {
                type: MAKE_EXISTING_BMP_FORM,
                bmp: bmp
            });
            // When storedBmpForm already has FIDs, they take precedence
            expect(state.storedBmpForm.outlet_fid).toBe(100);
            expect(state.storedBmpForm.footprint_fid).toBe(200);
            expect(state.storedBmpForm.watershed_fid).toBe(300);
        });

        it('should handle SUBMIT_BMP_FORM_SUCCESS for new BMP', () => {
            const stateWithBmps = {
                ...initialState,
                allBmps: [{ id: 1, name: 'BMP 1' }]
            };
            const newBmp = { id: 2, name: 'BMP 2' };
            const state = reducer(stateWithBmps, {
                type: SUBMIT_BMP_FORM_SUCCESS,
                bmp: newBmp
            });
            expect(state.allBmps.length).toBe(2);
            expect(state.allBmps[1]).toEqual(newBmp);
        });

        it('should handle SUBMIT_BMP_FORM_SUCCESS for existing BMP (update)', () => {
            const stateWithBmps = {
                ...initialState,
                allBmps: [
                    { id: 1, name: 'BMP 1' },
                    { id: 2, name: 'BMP 2' }
                ]
            };
            const updatedBmp = { id: 1, name: 'Updated BMP 1' };
            const state = reducer(stateWithBmps, {
                type: SUBMIT_BMP_FORM_SUCCESS,
                bmp: updatedBmp
            });
            expect(state.allBmps.length).toBe(2);
            expect(state.allBmps[0].name).toBe('Updated BMP 1');
            expect(state.allBmps[1].name).toBe('BMP 2');
        });

        it('should handle SUBMIT_BMP_FORM_ERROR', () => {
            const state = reducer(initialState, { type: SUBMIT_BMP_FORM_ERROR });
            expect(state.showSubmitBmpFormError).toBe(true);
        });

        it('should handle UPDATE_BMP_FORM with type_data sets BmpFormBmpTypeId', () => {
            const stateWithForm = {
                ...initialState,
                storedBmpForm: { name: 'Test' }
            };
            const state = reducer(stateWithForm, {
                type: UPDATE_BMP_FORM,
                kv: { type_data: { id: 5, name: 'Bio Swale' } }
            });
            expect(state.BmpFormBmpTypeId).toBe(5);
        });

        it('should handle UPDATE_BMP_FORM with group_profile', () => {
            const stateWithForm = {
                ...initialState,
                storedBmpForm: { name: 'Test' }
            };
            const groupProfile = { pk: 10, title: 'Group A' };
            const state = reducer(stateWithForm, {
                type: UPDATE_BMP_FORM,
                kv: { group_profile: groupProfile }
            });
            expect(state.storedBmpForm.group_profile).toEqual(groupProfile);
            expect(state.storedBmpForm.group_profile_id).toBe(10);
        });

        it('should handle SET_DRAWING_BMP_LAYER_NAME sets name', () => {
            const state = reducer(initialState, {
                type: SET_DRAWING_BMP_LAYER_NAME,
                drawingBmpLayerName: 'tst_bmp_outlet'
            });
            expect(state.drawingBmpLayerName).toBe('tst_bmp_outlet');
        });

        it('should handle SET_DRAWING_BMP_LAYER_NAME toggles off when same name', () => {
            const stateDrawing = { ...initialState, drawingBmpLayerName: 'tst_bmp_outlet' };
            const state = reducer(stateDrawing, {
                type: SET_DRAWING_BMP_LAYER_NAME,
                drawingBmpLayerName: 'tst_bmp_outlet'
            });
            expect(state.drawingBmpLayerName).toBe(false);
        });

        it('should handle CLEAR_DRAWING_BMP_LAYER_NAME', () => {
            const stateDrawing = { ...initialState, drawingBmpLayerName: 'tst_bmp_outlet' };
            const state = reducer(stateDrawing, { type: CLEAR_DRAWING_BMP_LAYER_NAME });
            expect(state.drawingBmpLayerName).toBe(null);
        });

        it('should handle SET_EXPANDED_BMP_TYPE_GROUP_NAME', () => {
            const state = reducer(initialState, {
                type: SET_EXPANDED_BMP_TYPE_GROUP_NAME,
                expandedBmpTypeGroupName: 'Structural'
            });
            expect(state.expandedBmpTypeGroupName).toBe('Structural');
        });

        it('should handle REGISTER_MISSING_BMP_FEATURE_ID', () => {
            const state = reducer(initialState, {
                type: REGISTER_MISSING_BMP_FEATURE_ID,
                missingBmpFeatureId: 'tst_bmp_footprint'
            });
            expect(state.missingBmpFeatureId).toBe('tst_bmp_footprint');
        });

        it('should handle REGISTER_MISSING_BMP_FEATURE_ID with false', () => {
            const stateWith = { ...initialState, missingBmpFeatureId: 'tst_bmp_footprint' };
            const state = reducer(stateWith, {
                type: REGISTER_MISSING_BMP_FEATURE_ID,
                missingBmpFeatureId: false
            });
            expect(state.missingBmpFeatureId).toBe(false);
        });

        it('should handle SET_COMPLEX_BMP_FORM', () => {
            const state = reducer(initialState, {
                type: SET_COMPLEX_BMP_FORM,
                complexBmpForm: true
            });
            expect(state.complexBmpForm).toBe(true);
        });

        it('should handle SET_BMP_LAYERS', () => {
            const outlet = { id: 'o1', name: 'bmp_outlet' };
            const footprint = { id: 'f1', name: 'bmp_footprint' };
            const watershed = { id: 'w1', name: 'bmp_watershed' };
            const state = reducer(initialState, {
                type: SET_BMP_LAYERS,
                bmpOutletLayer: outlet,
                bmpFootprintLayer: footprint,
                bmpWatershedLayer: watershed
            });
            expect(state.bmpOutletLayer).toEqual(outlet);
            expect(state.bmpFootprintLayer).toEqual(footprint);
            expect(state.bmpWatershedLayer).toEqual(watershed);
        });

        it('should handle SET_CHANGING_BMP_TYPE', () => {
            const state = reducer(initialState, {
                type: SET_CHANGING_BMP_TYPE,
                changingBmpType: true
            });
            expect(state.changingBmpType).toBe(true);
        });

        it('should handle SET_EDITING_BMP_FEATURE_ID', () => {
            const state = reducer(initialState, {
                type: SET_EDITING_BMP_FEATURE_ID,
                editingBmpFeatureId: 'tst_bmp_outlet.123'
            });
            expect(state.editingBmpFeatureId).toBe('tst_bmp_outlet.123');
        });

        it('should handle CLEAR_EDITING_BMP_FEATURE_ID', () => {
            const stateWithEditing = { ...initialState, editingBmpFeatureId: 'tst_bmp_outlet.123' };
            const state = reducer(stateWithEditing, { type: CLEAR_EDITING_BMP_FEATURE_ID });
            expect(state.editingBmpFeatureId).toBe(null);
        });

        it('should handle SHOW_TARGET_FORM', () => {
            const target = { id: 1, name: 'Target 1' };
            const state = reducer(initialState, {
                type: SHOW_TARGET_FORM,
                visibleTargetForm: true,
                target: target
            });
            expect(state.visibleTargetForm).toBe(true);
            expect(state.targetForm).toEqual(target);
        });

        it('should handle HIDE_TARGET_FORM', () => {
            const stateWithForm = { ...initialState, visibleTargetForm: true };
            const state = reducer(stateWithForm, {
                type: HIDE_TARGET_FORM,
                visibleTargetForm: false
            });
            expect(state.visibleTargetForm).toBe(false);
        });

        it('should handle UPDATE_TARGET_FORM', () => {
            const stateWithForm = {
                ...initialState,
                targetForm: { name: 'Target 1' }
            };
            const state = reducer(stateWithForm, {
                type: UPDATE_TARGET_FORM,
                kv: { target_percent_n_reduction: 0.45 }
            });
            expect(state.targetForm.name).toBe('Target 1');
            expect(state.targetForm.target_percent_n_reduction).toBe(0.45);
        });

        it('should handle UPDATE_BMP_TYPE_GROUPS adds visibility flag', () => {
            const groups = [
                ['Structural', [1, 2]],
                ['Non-Structural', [3, 4]]
            ];
            const state = reducer(initialState, {
                type: UPDATE_BMP_TYPE_GROUPS,
                bmpTypeGroups: groups
            });
            expect(state.bmpTypeGroups.length).toBe(2);
            // Each group should have a third element (true) added
            expect(state.bmpTypeGroups[0][2]).toBe(true);
            expect(state.bmpTypeGroups[1][2]).toBe(true);
        });

        it('should handle UPDATE_BMP_TYPE_GROUPS preserves existing visibility', () => {
            const groups = [
                ['Structural', [1, 2], false],
                ['Non-Structural', [3, 4]]
            ];
            const state = reducer(initialState, {
                type: UPDATE_BMP_TYPE_GROUPS,
                bmpTypeGroups: groups
            });
            // First group already had [2], so preserved
            expect(state.bmpTypeGroups[0][2]).toBe(false);
            // Second group gets true added
            expect(state.bmpTypeGroups[1][2]).toBe(true);
        });

        it('should handle TOGGLE_BMP_TYPE_GROUP toggles group and types', () => {
            const stateWithGroups = {
                ...initialState,
                bmpTypeGroups: [
                    ['Structural', [1, 2], true],
                    ['Non-Structural', [3, 4], true]
                ],
                bmpTypes: [
                    { id: 1, name: 'Rain Garden', group_name: 'Structural', visibility: true },
                    { id: 2, name: 'Wetland', group_name: 'Structural', visibility: true },
                    { id: 3, name: 'Cover Crop', group_name: 'Non-Structural', visibility: true }
                ]
            };
            const state = reducer(stateWithGroups, {
                type: TOGGLE_BMP_TYPE_GROUP,
                bmpTypeGroup: ['Structural', [1, 2], true]
            });
            // Group should have visibility toggled off (element [2] removed by splice)
            expect(state.bmpTypeGroups[0].length).toBe(2);
            // BMP types in that group should get visibility from action's [2] value
            expect(state.bmpTypes[0].visibility).toBe(true);
            // Non-Structural types should be unchanged
            expect(state.bmpTypes[2].visibility).toBe(true);
        });

        it('should handle SET_SWAMM_EROSION_DATA', () => {
            const data = [{ id: 1, name: 'Erosion Zone 1' }];
            const state = reducer(initialState, {
                type: SET_SWAMM_EROSION_DATA,
                data: data
            });
            expect(state.erosions).toEqual(data);
        });

        // ──────────────────────────────────────────────────────────────
        // State shape snapshot test
        // ──────────────────────────────────────────────────────────────

        it('state shape after full init sequence matches snapshot', () => {
            // Simulate the complete SWAMM initialization sequence
            let state = reducer(undefined, { type: 'UNKNOWN' });

            // Project data
            state = reducer(state, {
                type: SET_SWAMM_PROJECT_DATA,
                projectData: { id: 42, code: 'TST', name: 'Test Project' }
            });

            // BMP types
            state = reducer(state, {
                type: FETCH_SWAMM_BMPTYPES_SUCCESS,
                bmpTypes: [
                    { id: 1, name: 'Bio Swale', visibility: true, group_name: 'Structural' },
                    { id: 2, name: 'Rain Garden', visibility: true, group_name: 'Structural' }
                ]
            });

            // Group profiles
            state = reducer(state, {
                type: FETCH_GROUP_PROFILES_SUCCESS,
                groupProfiles: [{ id: 10, title: 'Test Group', visibility: true }]
            });

            // BMP statuses
            state = reducer(state, {
                type: FETCH_SWAMM_BMP_STATUSES_SUCCESS,
                statuses: [
                    { id: 1, name: 'Unknown', visibility: true },
                    { id: 2, name: 'Proposed', visibility: true }
                ]
            });

            // All BMPs
            state = reducer(state, {
                type: FETCH_SWAMM_ALL_BMPS_SUCCESS,
                allBmps: [{ id: 1, name: 'BMP 1', type: 1, status: 'Unknown' }]
            });

            // Targets
            state = reducer(state, {
                type: FETCH_SWAMM_TARGETS_SUCCESS,
                targets: [{ id: 1, name: 'Target 1' }]
            });

            // BMP type groups
            state = reducer(state, {
                type: UPDATE_BMP_TYPE_GROUPS,
                bmpTypeGroups: [['Structural', [1, 2]]]
            });

            // Verify essential state shape properties exist
            expect(state.projectData).toExist();
            expect(state.bmpTypes).toExist();
            expect(state.bmpTypes.length).toBe(2);
            expect(state.groupProfiles).toExist();
            expect(state.statuses).toExist();
            expect(state.allBmps).toExist();
            expect(state.targets).toExist();
            expect(state.bmpTypeGroups).toExist();
            expect(state.priorities).toExist();
            expect(state.priorities.length).toBe(4);
            expect(state.visibleBmpForm).toBe(false);
            expect(state.visibleTargetForm).toBe(false);
            expect(state.creatingNewBmp).toBe(false);
            expect(state.bmpFilterMode).toBe('type');
            expect(state.expandedFilter).toBe(null);
            expect(state.drawingBmpLayerName).toBe(false);

            // Verify BMP types are sorted by name
            expect(state.bmpTypes[0].name).toBe('Bio Swale');
            expect(state.bmpTypes[1].name).toBe('Rain Garden');

            // Verify type groups have visibility flag
            expect(state.bmpTypeGroups[0][2]).toBe(true);
        });
    });
});
