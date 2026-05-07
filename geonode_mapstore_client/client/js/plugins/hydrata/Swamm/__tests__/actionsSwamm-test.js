import expect from 'expect';
import {
    INIT_SWAMM, initSwamm,
    SET_SWAMM_PROJECT_DATA, setSwammProjectData,
    UPDATE_BMP_TYPE_GROUPS, updateBmpTypeGroups,
    FETCH_SWAMM_BMPTYPES_SUCCESS, fetchSwammBmpTypesSuccess,
    fetchSwammBmpTypesError,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS, fetchProjectManagerConfigSuccess,
    FETCH_PROJECT_MANAGER_CONFIG_ERROR, fetchProjectManagerConfigError,
    FETCH_GROUP_PROFILES_SUCCESS, fetchGroupProfilesSuccess,
    fetchGroupProfilesError,
    FETCH_SWAMM_ALL_BMPS_SUCCESS, fetchSwammAllBmpsSuccess,
    fetchSwammAllBmpsError,
    FETCH_SWAMM_BMP_STATUSES_SUCCESS, fetchSwammBmpStatusesSuccess,
    fetchSwammBmpStatusesError,
    FETCH_SWAMM_TARGETS_SUCCESS, fetchSwammTargetsSuccess,
    SELECT_SWAMM_TARGET_ID, selectSwammTargetId,
    SHOW_BMP_FORM, showBmpForm,
    HIDE_BMP_FORM, hideBmpForm,
    SHOW_LOADING_BMP, showLoadingBmp,
    HIDE_LOADING_BMP, hideLoadingBmp,
    SHOW_SWAMM_DATA_GRID, showSwammDataGrid,
    HIDE_SWAMM_DATA_GRID, hideSwammDataGrid,
    SHOW_SWAMM_FEATURE_GRID, showSwammFeatureGrid,
    SHOW_SWAMM_BMP_CHART, showSwammBmpChart,
    HIDE_SWAMM_BMP_CHART, hideSwammBmpChart,
    SHOW_BMP_MANAGER, showBmpManager,
    HIDE_BMP_MANAGER, hideBmpManager,
    TOGGLE_BMP_MANAGER, toggleBmpManager,
    MAKE_BMP_FORM, makeBmpForm,
    MAKE_DEFAULTS_BMP_FORM, makeDefaultsBmpForm,
    MAKE_EXISTING_BMP_FORM, makeExistingBmpForm,
    CLEAR_BMP_FORM, clearBmpForm,
    UPDATE_BMP_FORM, updateBmpForm,
    SET_UPDATING_BMP, setUpdatingBmp,
    SET_EXPANDED_BMP_TYPE_GROUP_NAME, setExpandedBmpTypeGroupName,
    TOGGLE_BMP_TYPE_GROUP, toggleBmpTypeGroup,
    SET_CHANGING_BMP_TYPE, setChangingBmpType,
    SET_COMPLEX_BMP_FORM, setComplexBmpForm,
    SET_EXPANDED_FILTER, setExpandedFilter,
    SET_BMP_LAYERS, setBmpLayers,
    START_DRAWING_BMP, startDrawingBmp,
    SET_DRAWING_BMP_LAYER_NAME, setDrawingBmpLayerName,
    CLEAR_DRAWING_BMP_LAYER_NAME, clearDrawingBmpLayerName,
    REGISTER_MISSING_BMP_FEATURE_ID, registerMissingBmpFeatureId,
    SET_EDITING_BMP_FEATURE_ID, setEditingBmpFeatureId,
    CLEAR_EDITING_BMP_FEATURE_ID, clearEditingBmpFeatureId,
    TOGGLE_BMP_TYPE_VISIBILITY, toggleBmpTypeVisibility,
    TOGGLE_BMP_PRIORITY_VISIBILITY, toggleBmpPriorityVisibility,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY, toggleBmpGroupProfileVisibility,
    TOGGLE_BMP_STATUS_VISIBILITY, toggleBmpStatusVisibility,
    SET_ALL_BMP_TYPES_VISIBILITY, setAllBmpTypesVisibility,
    SET_STATUS_FILTER, setStatusFilter,
    SET_MENU_GROUP, setMenuGroup,
    SET_BMP_FILTER_MODE, setBmpFilterMode,
    SHOW_TARGET_FORM, showTargetForm,
    HIDE_TARGET_FORM, hideTargetForm,
    UPDATE_TARGET_FORM, updateTargetForm,
    CLEAR_TARGET_FORM, clearTargetForm,
    DOWNLOAD_BMP_REPORT, downloadBmpReport,
    SET_SWAMM_INPUT_MENU, setSwammInputMenu,
    SET_SWAMM_EROSION_DATA, setSwammErosionData,
    FETCH_SWAMM_ENGINES_SUCCESS, fetchSwammEnginesSuccess
} from '../actionsSwamm';


describe('SWAMM Action Creators', () => {

    // ──────────────────────────────────────────────────────────────────
    // Simple action creators (return plain objects)
    // ──────────────────────────────────────────────────────────────────

    describe('Init and Project', () => {
        it('initSwamm returns INIT_SWAMM action', () => {
            const action = initSwamm();
            expect(action.type).toBe(INIT_SWAMM);
        });

        it('setSwammProjectData returns correct type and payload', () => {
            const data = { id: 42, name: 'Test Project', code: 'TST' };
            const action = setSwammProjectData(data);
            expect(action.type).toBe(SET_SWAMM_PROJECT_DATA);
            expect(action.projectData).toEqual(data);
        });

        it('setSwammInputMenu returns correct type and visible flag', () => {
            const action = setSwammInputMenu(true);
            expect(action.type).toBe(SET_SWAMM_INPUT_MENU);
            expect(action.visible).toBe(true);
        });

        it('setSwammInputMenu handles false', () => {
            const action = setSwammInputMenu(false);
            expect(action.visible).toBe(false);
        });
    });

    describe('BMP Form Actions', () => {
        it('showBmpForm returns SHOW_BMP_FORM', () => {
            expect(showBmpForm().type).toBe(SHOW_BMP_FORM);
        });

        it('hideBmpForm returns HIDE_BMP_FORM', () => {
            expect(hideBmpForm().type).toBe(HIDE_BMP_FORM);
        });

        it('showLoadingBmp returns SHOW_LOADING_BMP', () => {
            expect(showLoadingBmp().type).toBe(SHOW_LOADING_BMP);
        });

        it('hideLoadingBmp returns HIDE_LOADING_BMP', () => {
            expect(hideLoadingBmp().type).toBe(HIDE_LOADING_BMP);
        });

        it('makeBmpForm includes groupProfile', () => {
            const gp = { pk: 5, title: 'Group A' };
            const action = makeBmpForm(gp);
            expect(action.type).toBe(MAKE_BMP_FORM);
            expect(action.groupProfile).toEqual(gp);
        });

        it('makeDefaultsBmpForm includes bmpType', () => {
            const bmpType = { id: 1, name: 'Rain Garden', cost_base: 100 };
            const action = makeDefaultsBmpForm(bmpType);
            expect(action.type).toBe(MAKE_DEFAULTS_BMP_FORM);
            expect(action.bmpType).toEqual(bmpType);
        });

        it('makeExistingBmpForm includes bmp data', () => {
            const bmp = { id: 99, name: 'Existing BMP', status: 'Operational' };
            const action = makeExistingBmpForm(bmp);
            expect(action.type).toBe(MAKE_EXISTING_BMP_FORM);
            expect(action.bmp).toEqual(bmp);
        });

        it('clearBmpForm returns CLEAR_BMP_FORM', () => {
            expect(clearBmpForm().type).toBe(CLEAR_BMP_FORM);
        });

        it('updateBmpForm includes key-value pair', () => {
            const kv = { name: 'Updated Name', notes: 'Some notes' };
            const action = updateBmpForm(kv);
            expect(action.type).toBe(UPDATE_BMP_FORM);
            expect(action.kv).toEqual(kv);
        });

        it('setUpdatingBmp includes bmp data', () => {
            const bmp = { id: 1 };
            const action = setUpdatingBmp(bmp);
            expect(action.type).toBe(SET_UPDATING_BMP);
            expect(action.updatingBmp).toEqual(bmp);
        });

        it('setChangingBmpType sets flag', () => {
            const action = setChangingBmpType(true);
            expect(action.type).toBe(SET_CHANGING_BMP_TYPE);
            expect(action.changingBmpType).toBe(true);
        });

        it('setComplexBmpForm sets form data', () => {
            const action = setComplexBmpForm(true);
            expect(action.type).toBe(SET_COMPLEX_BMP_FORM);
            expect(action.complexBmpForm).toBe(true);
        });

        it('startDrawingBmp returns START_DRAWING_BMP', () => {
            expect(startDrawingBmp().type).toBe(START_DRAWING_BMP);
        });

        it('downloadBmpReport includes bmpId', () => {
            const action = downloadBmpReport(42);
            expect(action.type).toBe(DOWNLOAD_BMP_REPORT);
            expect(action.bmpId).toBe(42);
        });
    });

    describe('Drawing and Feature ID Actions', () => {
        it('setDrawingBmpLayerName includes layer name', () => {
            const action = setDrawingBmpLayerName('tst_bmp_outlet');
            expect(action.type).toBe(SET_DRAWING_BMP_LAYER_NAME);
            expect(action.drawingBmpLayerName).toBe('tst_bmp_outlet');
        });

        it('clearDrawingBmpLayerName returns correct type', () => {
            expect(clearDrawingBmpLayerName().type).toBe(CLEAR_DRAWING_BMP_LAYER_NAME);
        });

        it('setEditingBmpFeatureId includes feature ID', () => {
            const action = setEditingBmpFeatureId('tst_bmp_outlet.123');
            expect(action.type).toBe(SET_EDITING_BMP_FEATURE_ID);
            expect(action.editingBmpFeatureId).toBe('tst_bmp_outlet.123');
        });

        it('clearEditingBmpFeatureId returns correct type', () => {
            expect(clearEditingBmpFeatureId().type).toBe(CLEAR_EDITING_BMP_FEATURE_ID);
        });

        it('registerMissingBmpFeatureId includes ID', () => {
            const action = registerMissingBmpFeatureId('tst_bmp_footprint');
            expect(action.type).toBe(REGISTER_MISSING_BMP_FEATURE_ID);
            expect(action.missingBmpFeatureId).toBe('tst_bmp_footprint');
        });

        it('registerMissingBmpFeatureId handles false', () => {
            const action = registerMissingBmpFeatureId(false);
            expect(action.missingBmpFeatureId).toBe(false);
        });
    });

    describe('BMP Manager and UI Actions', () => {
        it('showBmpManager returns SHOW_BMP_MANAGER', () => {
            expect(showBmpManager().type).toBe(SHOW_BMP_MANAGER);
        });

        it('hideBmpManager returns HIDE_BMP_MANAGER', () => {
            expect(hideBmpManager().type).toBe(HIDE_BMP_MANAGER);
        });

        it('toggleBmpManager returns TOGGLE_BMP_MANAGER', () => {
            expect(toggleBmpManager().type).toBe(TOGGLE_BMP_MANAGER);
        });

        it('showSwammDataGrid returns SHOW_SWAMM_DATA_GRID', () => {
            expect(showSwammDataGrid().type).toBe(SHOW_SWAMM_DATA_GRID);
        });

        it('hideSwammDataGrid returns HIDE_SWAMM_DATA_GRID', () => {
            expect(hideSwammDataGrid().type).toBe(HIDE_SWAMM_DATA_GRID);
        });

        it('showSwammFeatureGrid includes layer', () => {
            const layer = { id: 'layer1', name: 'test_layer' };
            const action = showSwammFeatureGrid(layer);
            expect(action.type).toBe(SHOW_SWAMM_FEATURE_GRID);
            expect(action.layer).toEqual(layer);
        });

        it('showSwammBmpChart returns SHOW_SWAMM_BMP_CHART', () => {
            expect(showSwammBmpChart().type).toBe(SHOW_SWAMM_BMP_CHART);
        });

        it('hideSwammBmpChart returns HIDE_SWAMM_BMP_CHART', () => {
            expect(hideSwammBmpChart().type).toBe(HIDE_SWAMM_BMP_CHART);
        });
    });

    describe('Filter and Visibility Actions', () => {
        it('toggleBmpTypeVisibility includes bmpType', () => {
            const bmpType = { id: 1, name: 'Rain Garden', visibility: true };
            const action = toggleBmpTypeVisibility(bmpType);
            expect(action.type).toBe(TOGGLE_BMP_TYPE_VISIBILITY);
            expect(action.bmpType).toEqual(bmpType);
        });

        it('toggleBmpPriorityVisibility includes priority', () => {
            const priority = { id: 1, label: 'Critical', visibility: true };
            const action = toggleBmpPriorityVisibility(priority);
            expect(action.type).toBe(TOGGLE_BMP_PRIORITY_VISIBILITY);
            expect(action.priority).toEqual(priority);
        });

        it('toggleBmpGroupProfileVisibility includes groupProfile', () => {
            const gp = { id: 1, title: 'Group A', visibility: true };
            const action = toggleBmpGroupProfileVisibility(gp);
            expect(action.type).toBe(TOGGLE_BMP_GROUP_PROFILE_VISIBILITY);
            expect(action.groupProfile).toEqual(gp);
        });

        it('toggleBmpStatusVisibility includes status', () => {
            const status = { id: 1, name: 'Operational', visibility: true };
            const action = toggleBmpStatusVisibility(status);
            expect(action.type).toBe(TOGGLE_BMP_STATUS_VISIBILITY);
            expect(action.status).toEqual(status);
        });

        it('setAllBmpTypesVisibility sets boolean', () => {
            const action = setAllBmpTypesVisibility(false);
            expect(action.type).toBe(SET_ALL_BMP_TYPES_VISIBILITY);
            expect(action.boolValue).toBe(false);
        });

        it('setBmpFilterMode sets mode', () => {
            const action = setBmpFilterMode('status');
            expect(action.type).toBe(SET_BMP_FILTER_MODE);
            expect(action.bmpFilterMode).toBe('status');
        });

        it('setExpandedFilter sets filter', () => {
            const action = setExpandedFilter('types');
            expect(action.type).toBe(SET_EXPANDED_FILTER);
            expect(action.expandedFilter).toBe('types');
        });

        it('setStatusFilter includes statuses', () => {
            const statuses = ['Operational', 'Proposed'];
            const action = setStatusFilter(statuses);
            expect(action.type).toBe(SET_STATUS_FILTER);
            expect(action.statuses).toEqual(statuses);
        });

        it('setMenuGroup includes payload', () => {
            const action = setMenuGroup('swamm');
            expect(action.type).toBe(SET_MENU_GROUP);
            expect(action.payload).toBe('swamm');
        });

        it('setExpandedBmpTypeGroupName sets name', () => {
            const action = setExpandedBmpTypeGroupName('Structural');
            expect(action.type).toBe(SET_EXPANDED_BMP_TYPE_GROUP_NAME);
            expect(action.expandedBmpTypeGroupName).toBe('Structural');
        });

        it('toggleBmpTypeGroup includes group', () => {
            const group = ['Structural', [1, 2, 3]];
            const action = toggleBmpTypeGroup(group);
            expect(action.type).toBe(TOGGLE_BMP_TYPE_GROUP);
            expect(action.bmpTypeGroup).toEqual(group);
        });
    });

    describe('BMP Layers', () => {
        it('setBmpLayers sets all three layers', () => {
            const outlet = { id: 'o1', name: 'bmp_outlet' };
            const footprint = { id: 'f1', name: 'bmp_footprint' };
            const watershed = { id: 'w1', name: 'bmp_watershed' };
            const action = setBmpLayers(outlet, footprint, watershed);
            expect(action.type).toBe(SET_BMP_LAYERS);
            expect(action.bmpOutletLayer).toEqual(outlet);
            expect(action.bmpFootprintLayer).toEqual(footprint);
            expect(action.bmpWatershedLayer).toEqual(watershed);
        });
    });

    describe('Target Form Actions', () => {
        it('showTargetForm includes target and visible flag', () => {
            const target = { id: 1, name: 'Target 1' };
            const action = showTargetForm(target);
            expect(action.type).toBe(SHOW_TARGET_FORM);
            expect(action.visibleTargetForm).toBe(true);
            expect(action.target).toEqual(target);
        });

        it('hideTargetForm sets visible to false', () => {
            const action = hideTargetForm();
            expect(action.type).toBe(HIDE_TARGET_FORM);
            expect(action.visibleTargetForm).toBe(false);
        });

        it('updateTargetForm includes key-value pair', () => {
            const kv = { name: 'Updated Target' };
            const action = updateTargetForm(kv);
            expect(action.type).toBe(UPDATE_TARGET_FORM);
            expect(action.kv).toEqual(kv);
        });

        it('clearTargetForm sets targetForm to null', () => {
            const action = clearTargetForm();
            expect(action.type).toBe(CLEAR_TARGET_FORM);
            expect(action.targetForm).toBe(null);
        });

        it('selectSwammTargetId includes target ID', () => {
            const action = selectSwammTargetId(42);
            expect(action.type).toBe(SELECT_SWAMM_TARGET_ID);
            expect(action.selectedTargetId).toBe(42);
        });
    });

    describe('BMP Type Groups', () => {
        it('updateBmpTypeGroups includes groups data', () => {
            const groups = [['Structural', [1, 2]], ['Non-Structural', [3]]];
            const action = updateBmpTypeGroups(groups);
            expect(action.type).toBe(UPDATE_BMP_TYPE_GROUPS);
            expect(action.bmpTypeGroups).toEqual(groups);
        });
    });

    describe('Loading Data Actions', () => {
        it('setSwammErosionData includes data', () => {
            const data = [{ id: 1, name: 'erosion1' }];
            const action = setSwammErosionData(data);
            expect(action.type).toBe(SET_SWAMM_EROSION_DATA);
            expect(action.data).toEqual(data);
        });

        it('fetchSwammEnginesSuccess wraps engines', () => {
            const engines = [{ id: 1, name: 'Engine A' }, { id: 2, name: 'Engine B' }];
            const action = fetchSwammEnginesSuccess(engines);
            expect(action.type).toBe(FETCH_SWAMM_ENGINES_SUCCESS);
            expect(action.swammEngines).toEqual(engines);
        });

    });

    // ──────────────────────────────────────────────────────────────────
    // Success action creators that transform data
    // ──────────────────────────────────────────────────────────────────

    describe('Success Action Creators with Data Transformation', () => {
        it('fetchSwammBmpTypesSuccess adds visibility to each type', () => {
            const bmpTypes = [
                { id: 1, name: 'Rain Garden' },
                { id: 2, name: 'Wetland' }
            ];
            const action = fetchSwammBmpTypesSuccess(bmpTypes);
            expect(action.type).toBe(FETCH_SWAMM_BMPTYPES_SUCCESS);
            expect(action.bmpTypes[0].visibility).toBe(true);
            expect(action.bmpTypes[1].visibility).toBe(true);
        });

        it('fetchGroupProfilesSuccess adds visibility and id from pk', () => {
            const profiles = [
                { pk: 10, title: 'Group A' },
                { pk: 20, title: 'Watershed Management Plan' }
            ];
            const action = fetchGroupProfilesSuccess(profiles);
            expect(action.type).toBe(FETCH_GROUP_PROFILES_SUCCESS);
            // id should be set from pk
            expect(action.groupProfiles[0].id).toBe(10);
            expect(action.groupProfiles[1].id).toBe(20);
            // All groups get visibility true except "Watershed Management Plan"
            expect(action.groupProfiles[0].visibility).toBe(true);
            expect(action.groupProfiles[1].visibility).toBe(false);
        });

        it('fetchSwammAllBmpsSuccess wraps allBmps', () => {
            const bmps = [{ id: 1 }, { id: 2 }];
            const action = fetchSwammAllBmpsSuccess(bmps);
            expect(action.type).toBe(FETCH_SWAMM_ALL_BMPS_SUCCESS);
            expect(action.allBmps).toEqual(bmps);
        });

        it('fetchSwammBmpStatusesSuccess wraps statuses', () => {
            const statuses = [{ id: 1, name: 'Unknown' }];
            const action = fetchSwammBmpStatusesSuccess(statuses);
            expect(action.type).toBe(FETCH_SWAMM_BMP_STATUSES_SUCCESS);
            expect(action.statuses).toEqual(statuses);
        });

        it('fetchProjectManagerConfigSuccess wraps config', () => {
            const config = { id: 1, base_map: 42 };
            const action = fetchProjectManagerConfigSuccess(config);
            expect(action.type).toBe(FETCH_PROJECT_MANAGER_CONFIG_SUCCESS);
            expect(action.payload).toEqual(config);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Error action creators (return notification actions)
    // ──────────────────────────────────────────────────────────────────

    describe('Error Action Creators', () => {
        it('fetchSwammBmpTypesError returns notification action', () => {
            const error = { data: 'Server error' };
            const action = fetchSwammBmpTypesError(error);
            expect(action.type).toBe('SHOW_NOTIFICATION');
            expect(action.level).toBe('error');
            expect(action.title).toInclude('Bmp Types Error');
        });

        it('fetchGroupProfilesError returns notification action', () => {
            const error = { data: 'Server error' };
            const action = fetchGroupProfilesError(error);
            expect(action.type).toBe('SHOW_NOTIFICATION');
            expect(action.level).toBe('error');
        });

        it('fetchSwammAllBmpsError returns notification action', () => {
            const error = { data: 'Timeout' };
            const action = fetchSwammAllBmpsError(error);
            expect(action.type).toBe('SHOW_NOTIFICATION');
            expect(action.level).toBe('error');
            expect(action.title).toInclude('All Bmps Error');
        });

        it('fetchSwammBmpStatusesError returns notification action', () => {
            const error = { data: 'Error' };
            const action = fetchSwammBmpStatusesError(error);
            expect(action.type).toBe('SHOW_NOTIFICATION');
            expect(action.level).toBe('error');
        });

        it('fetchProjectManagerConfigError returns error action', () => {
            const error = { data: 'Not found' };
            const action = fetchProjectManagerConfigError(error);
            expect(action.type).toBe(FETCH_PROJECT_MANAGER_CONFIG_ERROR);
            expect(action.error).toEqual(error);
        });

        it('submitBmpFormError returns notification action', () => {
            const error = { data: { errors: ['Validation failed'] } };
            const action = require('../actionsSwamm').submitBmpFormError(error);
            expect(action.type).toBe('SHOW_NOTIFICATION');
            expect(action.level).toBe('error');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Thunk action creators (return functions)
    // ──────────────────────────────────────────────────────────────────

    describe('Thunk Action Creators', () => {
        it('fetchSwammBmpTypes returns a function', () => {
            const thunk = require('../actionsSwamm').fetchSwammBmpTypes(42);
            expect(typeof thunk).toBe('function');
        });

        it('fetchGroupProfiles returns a function', () => {
            const thunk = require('../actionsSwamm').fetchGroupProfiles();
            expect(typeof thunk).toBe('function');
        });

        it('fetchSwammAllBmps returns a function', () => {
            const thunk = require('../actionsSwamm').fetchSwammAllBmps(42);
            expect(typeof thunk).toBe('function');
        });

        it('fetchSwammBmpStatuses returns a function', () => {
            const thunk = require('../actionsSwamm').fetchSwammBmpStatuses(42);
            expect(typeof thunk).toBe('function');
        });

        it('fetchSwammTargets returns a function', () => {
            const thunk = require('../actionsSwamm').fetchSwammTargets(42);
            expect(typeof thunk).toBe('function');
        });

        it('fetchSwammTargetsSuccess returns a function (dispatches)', () => {
            const thunk = fetchSwammTargetsSuccess([{ id: 1 }]);
            expect(typeof thunk).toBe('function');
        });

        it('submitBmpForm with id returns update thunk', () => {
            const thunk = require('../actionsSwamm').submitBmpForm({ id: 1, name: 'Test' }, 42);
            expect(typeof thunk).toBe('function');
        });

        it('submitBmpForm without id returns create thunk', () => {
            const thunk = require('../actionsSwamm').submitBmpForm({ name: 'New BMP' }, 42);
            expect(typeof thunk).toBe('function');
        });

        it('deleteBmp returns a function', () => {
            const thunk = require('../actionsSwamm').deleteBmp(42, 1);
            expect(typeof thunk).toBe('function');
        });

        it('submitTargetForm with id returns update thunk', () => {
            const thunk = require('../actionsSwamm').submitTargetForm({ id: 1, name: 'Target' }, 42);
            expect(typeof thunk).toBe('function');
        });

        it('submitTargetForm without id returns create thunk', () => {
            const thunk = require('../actionsSwamm').submitTargetForm({ name: 'New Target' }, 42);
            expect(typeof thunk).toBe('function');
        });

        it('deleteTarget returns a function', () => {
            const thunk = require('../actionsSwamm').deleteTarget(42, 1);
            expect(typeof thunk).toBe('function');
        });

        it('downloadTargetData returns a function', () => {
            const thunk = require('../actionsSwamm').downloadTargetData(42, 1);
            expect(typeof thunk).toBe('function');
        });

        it('toggleBmpType returns a function', () => {
            const thunk = require('../actionsSwamm').toggleBmpType({ id: 1 });
            expect(typeof thunk).toBe('function');
        });

        it('setBmpType returns a function', () => {
            const thunk = require('../actionsSwamm').setBmpType({ id: 1 }, true);
            expect(typeof thunk).toBe('function');
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // Constant exports verification
    // ──────────────────────────────────────────────────────────────────

    describe('Action Type Constants', () => {
        it('all action type constants are strings', () => {
            const constants = [
                INIT_SWAMM, SET_SWAMM_PROJECT_DATA,
                FETCH_SWAMM_BMPTYPES_SUCCESS,
                FETCH_GROUP_PROFILES_SUCCESS,
                FETCH_SWAMM_ALL_BMPS_SUCCESS,
                FETCH_SWAMM_BMP_STATUSES_SUCCESS,
                FETCH_SWAMM_TARGETS_SUCCESS,
                SELECT_SWAMM_TARGET_ID,
                SHOW_BMP_FORM, HIDE_BMP_FORM,
                SHOW_LOADING_BMP, HIDE_LOADING_BMP,
                SHOW_BMP_MANAGER, HIDE_BMP_MANAGER, TOGGLE_BMP_MANAGER,
                SHOW_SWAMM_DATA_GRID, HIDE_SWAMM_DATA_GRID,
                SHOW_SWAMM_BMP_CHART, HIDE_SWAMM_BMP_CHART,
                MAKE_BMP_FORM, CLEAR_BMP_FORM,
                MAKE_DEFAULTS_BMP_FORM, MAKE_EXISTING_BMP_FORM,
                UPDATE_BMP_FORM,
                SET_DRAWING_BMP_LAYER_NAME, CLEAR_DRAWING_BMP_LAYER_NAME,
                SET_EDITING_BMP_FEATURE_ID, CLEAR_EDITING_BMP_FEATURE_ID,
                REGISTER_MISSING_BMP_FEATURE_ID,
                TOGGLE_BMP_TYPE_VISIBILITY, TOGGLE_BMP_PRIORITY_VISIBILITY,
                TOGGLE_BMP_GROUP_PROFILE_VISIBILITY, TOGGLE_BMP_STATUS_VISIBILITY,
                SET_ALL_BMP_TYPES_VISIBILITY,
                SET_BMP_FILTER_MODE, SET_EXPANDED_FILTER,
                SET_BMP_LAYERS, SET_CHANGING_BMP_TYPE,
                SET_COMPLEX_BMP_FORM, SET_MENU_GROUP,
                UPDATE_BMP_TYPE_GROUPS,
                SHOW_TARGET_FORM, HIDE_TARGET_FORM,
                UPDATE_TARGET_FORM, CLEAR_TARGET_FORM,
                SET_SWAMM_INPUT_MENU,
                SET_SWAMM_EROSION_DATA,
                DOWNLOAD_BMP_REPORT, START_DRAWING_BMP,
                FETCH_SWAMM_ENGINES_SUCCESS
            ];
            constants.forEach((c) => {
                expect(typeof c).toBe('string');
            });
        });

        it('action type constants are unique', () => {
            const constants = [
                INIT_SWAMM, SET_SWAMM_PROJECT_DATA,
                FETCH_SWAMM_BMPTYPES_SUCCESS,
                FETCH_GROUP_PROFILES_SUCCESS,
                FETCH_SWAMM_ALL_BMPS_SUCCESS,
                FETCH_SWAMM_BMP_STATUSES_SUCCESS,
                FETCH_SWAMM_TARGETS_SUCCESS,
                SELECT_SWAMM_TARGET_ID,
                SHOW_BMP_FORM, HIDE_BMP_FORM,
                SHOW_LOADING_BMP, HIDE_LOADING_BMP,
                SHOW_BMP_MANAGER, HIDE_BMP_MANAGER, TOGGLE_BMP_MANAGER,
                SHOW_SWAMM_DATA_GRID, HIDE_SWAMM_DATA_GRID,
                SHOW_SWAMM_BMP_CHART, HIDE_SWAMM_BMP_CHART,
                MAKE_BMP_FORM, CLEAR_BMP_FORM,
                UPDATE_BMP_FORM,
                SET_BMP_FILTER_MODE, SET_EXPANDED_FILTER,
                SET_BMP_LAYERS, SET_CHANGING_BMP_TYPE,
                SET_COMPLEX_BMP_FORM, SET_MENU_GROUP,
                TOGGLE_BMP_TYPE_VISIBILITY, TOGGLE_BMP_PRIORITY_VISIBILITY,
                TOGGLE_BMP_GROUP_PROFILE_VISIBILITY, TOGGLE_BMP_STATUS_VISIBILITY,
                SET_ALL_BMP_TYPES_VISIBILITY,
                SET_SWAMM_INPUT_MENU,
                FETCH_SWAMM_ENGINES_SUCCESS
            ];
            const unique = new Set(constants);
            expect(unique.size).toBe(constants.length);
        });
    });
});
