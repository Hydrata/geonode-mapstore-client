import Rx from "rxjs";
import * as swammApi from './api/swammApi';
import { isInt } from "../Utils/utils";
import {
    changeLayerProperties,
    addGroup,
    moveNode
} from "../../../../MapStore2/web/client/actions/layers";
import { SET_RESOURCE_ID } from '@js/actions/gnresource';
import {
    INIT_SWAMM,
    setSwammProjectData,
    FETCH_PROJECT_MANAGER_CONFIG_SUCCESS,
    DOWNLOAD_BMP_REPORT,
    hideLoadingBmp,
    submitBmpForm,
    MAKE_EXISTING_BMP_FORM,
    makeExistingBmpForm,
    updateBmpForm,
    getBmpFormSuccess,
    showBmpForm,
    setUpdatingBmp,
    showBmpChooser,
    updateBmpTypeGroups,
    TOGGLE_BMP_TYPE_VISIBILITY,
    TOGGLE_BMP_STATUS_VISIBILITY,
    TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
    SET_ALL_BMP_TYPES_VISIBILITY,
    setBmpLayers, TOGGLE_BMP_PRIORITY_VISIBILITY,
    fetchSwammBmpTypesSuccess,
    fetchGroupProfilesSuccess,
    fetchUserGroupMembershipsSuccess,
    fetchSwammBmpStatusesSuccess,
    fetchSwammTargetsSuccess,
    fetchSwammEnginesSuccess,
    setSwammErosionData,
    TOGGLE_BMP_TYPE_GROUP,
    APPLY_INITIAL_BMP_FILTER,
    applyInitialBmpFilter
} from "@js/plugins/hydrata/Swamm/actionsSwamm";

import {
    SET_OPEN_MENU_GROUP_ID,
    setSvConfig
} from "@js/plugins/hydrata/SimpleView/actionsSimpleView";

import {closeIdentify, LOAD_FEATURE_INFO} from "../../../../MapStore2/web/client/actions/mapInfo";
import {
    bmpOutletLayerSelector,
    bmpFootprintLayerSelector,
    bmpWatershedLayerSelector
} from "@js/plugins/hydrata/Swamm/selectorsSwamm";
import {
    MVT_FORMAT,
    shouldUseServerSideCql,
    buildBmpVectorStyle
} from "@js/plugins/hydrata/Swamm/utils/swammMvtPaint";


// Shared init logic — used by both primary and fallback triggers
const swammInitFlow = (mapId, store) =>
    Rx.Observable.from(
        swammApi.getProjectFromMapId(mapId)
            .catch(err => {
                console.error('initSwammEpic: failed to get project from map ID', err);
                return { status: 999 };
            })
    )
        .filter(response1 => response1?.status <= 400)
        .filter(() => !!store.getState()?.security?.user)
        .switchMap(response1 => {
            const projectId = response1.data.projectId;
            return Rx.Observable.merge(
            // Project details — runs in parallel with reference data
                Rx.Observable.from(swammApi.getProject(projectId))
                    .switchMap(response2 => Rx.Observable.of(
                        setSwammProjectData(response2.data),
                        setSvConfig(response2.data?.simple_view_config)
                    ))
                    .catch((err) => { console.warn('initSwammEpic: getProject failed', err); return Rx.Observable.empty(); }),
                // 8 reference data calls — only need projectId, not project response
                Rx.Observable.from(swammApi.getBmpTypes(projectId))
                    .switchMap((r) => Rx.Observable.of(fetchSwammBmpTypesSuccess(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getBmpTypes failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getGroupProfiles())
                    .switchMap((r) => Rx.Observable.of(fetchGroupProfilesSuccess(r.data?.group_profiles)))
                    .catch((err) => { console.warn('initSwammEpic: getGroupProfiles failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getUserGroupMemberships())
                    .switchMap((r) => Rx.Observable.of(fetchUserGroupMembershipsSuccess(r.data?.group_profile_slugs)))
                    .catch((err) => { console.warn('initSwammEpic: getUserGroupMemberships failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getBmpStatuses(projectId))
                    .switchMap((r) => Rx.Observable.of(fetchSwammBmpStatusesSuccess(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getBmpStatuses failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getTargets(projectId))
                    .switchMap((r) => Rx.Observable.of(fetchSwammTargetsSuccess(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getTargets failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getBmpTypeGroups(projectId))
                    .switchMap((r) => Rx.Observable.of(updateBmpTypeGroups(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getBmpTypeGroups failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getErosionData(projectId))
                    .switchMap((r) => Rx.Observable.of(setSwammErosionData(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getErosionData failed', err); return Rx.Observable.empty(); }),
                Rx.Observable.from(swammApi.getEngines(projectId))
                    .switchMap((r) => Rx.Observable.of(fetchSwammEnginesSuccess(r.data)))
                    .catch((err) => { console.warn('initSwammEpic: getEngines failed', err); return Rx.Observable.empty(); })
            ).concat(
                Rx.Observable.of(applyInitialBmpFilter())
            );
        });

// Primary trigger: fires early on SET_RESOURCE_ID (~3.3s instead of ~6.8s)
export const initSwammEpic = (action$, store) =>
    action$
        .ofType(SET_RESOURCE_ID)
        .filter((action) => !!action.id)
        .filter(() => !!store.getState()?.security?.user)
        .switchMap((action) => swammInitFlow(action.id, store));

// Fallback trigger: fires on componentDidMount if primary didn't run
export const initSwammFallbackEpic = (action$, store) =>
    action$
        .ofType(INIT_SWAMM)
        .filter(() => !store.getState()?.swamm?.projectData?.id)
        .filter(() => !!store.getState()?.gnresource?.id)
        .filter(() => !!store.getState()?.security?.user)
        .switchMap(() => swammInitFlow(store.getState().gnresource.id, store));


export const catchBmpFeatureClick = (action$, store) =>
    action$
        .ofType(LOAD_FEATURE_INFO)
        .filter((action) => {
            if (action?.data?.type !== 'FeatureCollection') {
                const text = action.data || '';
                return text.includes('fid = ') && text.includes('the_geom');
            }
            return (action?.data?.features || []).some(f =>
                /([a-zA-Z0-9]{3}_){2}(outlet|footprint|watershed)/.test(f.id)
            );
        })
        .switchMap((action) => {
            // Extract ALL unique BMP IDs from the feature info response
            const bmpIds = new Set();
            if (action?.data?.type === 'FeatureCollection') {
                (action?.data?.features || []).forEach(feature => {
                    if (/([a-zA-Z0-9]{3}_){2}(outlet|footprint|watershed)/.test(feature.id)) {
                        if (isInt(feature?.properties?.id)) {
                            bmpIds.add(feature.properties.id);
                        }
                    }
                });
            } else {
                const text = action.data || '';
                const featureIdNumber = text.substring(text.indexOf('fid = ') + 6, text.indexOf('the_geom') - 1);
                if (isInt(featureIdNumber)) bmpIds.add(parseInt(featureIdNumber, 10));
            }

            if (bmpIds.size === 0) return Rx.Observable.empty();

            const projectId = store.getState()?.swamm?.projectData?.id;
            const uniqueIds = Array.from(bmpIds);

            // Close Identify immediately
            return Rx.Observable.of(closeIdentify())
                .concat(
                    Rx.Observable.forkJoin(
                        uniqueIds.map(id => Rx.Observable.from(swammApi.getBmp(projectId, id)).catch(() => Rx.Observable.of(null)))
                    )
                        .switchMap((responses) => {
                            const bmps = responses.filter(r => r?.data).map(r => r.data);
                            if (bmps.length === 0) return Rx.Observable.empty();
                            if (bmps.length === 1) {
                                // Single BMP — open directly
                                return Rx.Observable.of(
                                    getBmpFormSuccess(bmps[0]),
                                    makeExistingBmpForm(bmps[0]),
                                    setUpdatingBmp(bmps[0]),
                                    showBmpForm()
                                );
                            }
                            // Multiple BMPs — show chooser
                            return Rx.Observable.of(showBmpChooser(bmps));
                        })
                        .catch(err => {
                            console.error('catchBmpFeatureClick: failed to load BMPs', err);
                            return Rx.Observable.empty();
                        })
                );
        });

// VectorDraw callback: handle successful feature save from VectorDraw plugin
export const vectorDrawSwammCompleteEpic = (action$, _store) =>
    action$.ofType('SWAMM:VECTOR_DRAW_COMPLETE')
        .switchMap((action) => {
            const { fid, meta } = action;
            const fidUpdate = { [meta.geomField]: fid };
            const updatedForm = { ...meta.storedBmpForm, ...fidUpdate };
            return Rx.Observable.of(
                updateBmpForm(fidUpdate),
                showBmpForm(),
                submitBmpForm(updatedForm, meta.projectId),
                hideLoadingBmp()
            );
        });

// VectorDraw callback: handle cancel from VectorDraw plugin
export const vectorDrawSwammCancelEpic = (action$) =>
    action$.ofType('SWAMM:VECTOR_DRAW_CANCELLED')
        .switchMap(() => Rx.Observable.of(
            showBmpForm(),
            hideLoadingBmp()
        ));

export const autoSaveBmpFormEpic = (action$, store) =>
    action$.ofType(MAKE_EXISTING_BMP_FORM)
        .filter(() =>
            (store.getState()?.swamm?.storedBmpForm?.footprint_fid && !store.getState()?.swamm?.storedBmpForm?.calculated_footprint_area) ||
            (store.getState()?.swamm?.storedBmpForm?.watershed_fid && !store.getState()?.swamm?.storedBmpForm?.calculated_watershed_area)
        )
        .flatMap(() => {
            return Rx.Observable.of(
                submitBmpForm(store.getState()?.swamm?.storedBmpForm, store.getState()?.swamm?.projectData?.id)
            );
        });


export const getBmpTypeGroups = (action$, store) =>
    action$.ofType(FETCH_PROJECT_MANAGER_CONFIG_SUCCESS)
        .mergeMap(() => {
            const mapId = store.getState()?.swamm?.data?.base_map;
            return Rx.Observable.from(
                swammApi.getBmpTypeGroups(mapId)
            );
        })
        .exhaustMap((response) => {
            const bmpOutletLayer = bmpOutletLayerSelector(store.getState());
            const bmpFootprintLayer = bmpFootprintLayerSelector(store.getState());
            const bmpWatershedLayer = bmpWatershedLayerSelector(store.getState());
            return Rx.Observable.of(
                updateBmpTypeGroups(response.data),
                setBmpLayers(bmpOutletLayer, bmpFootprintLayer, bmpWatershedLayer)
            );
        });

export const ensureBmpGeometriesGroupEpic = (action$, store) =>
    action$.ofType(SET_OPEN_MENU_GROUP_ID)
        .switchMap(() => {
            const state = store.getState();
            const viewBmpGroup = state?.layers?.groups?.find(g => g?.title === "View BMPs" || g?.name === "View BMPs");
            if (!viewBmpGroup || state?.simpleView?.openMenuGroupId !== viewBmpGroup.id) {
                return Rx.Observable.empty();
            }
            const subGroupId = `${viewBmpGroup.id}.BMP geometries`;
            const hasSubGroup = viewBmpGroup.nodes?.some(n => typeof n === 'object' && n.id === subGroupId);
            if (hasSubGroup) {
                return Rx.Observable.empty();
            }
            const bmpLayers = [
                bmpWatershedLayerSelector(state),
                bmpFootprintLayerSelector(state),
                bmpOutletLayerSelector(state)
            ].filter(Boolean);
            const actions = [
                addGroup("BMP geometries", viewBmpGroup.id, {
                    id: subGroupId,
                    name: "BMP geometries",
                    expanded: true
                }),
                ...bmpLayers.map((layer, i) => moveNode(layer.id, subGroupId, i))
            ];
            return Rx.Observable.from(actions);
        });


export const downloadBmpReportEpic = (action$) =>
    action$.ofType(DOWNLOAD_BMP_REPORT)
        .mergeMap((action) => {
            return Rx.Observable.from(
                window.open(`/swamm/print/${action.bmpId}/download/`, "_blank")
            );
        });

const createFilterField = (attribute, value) => ({
    "attribute": attribute,
    "rowId": 123456,
    "type": "number",
    "groupId": `${attribute}_1`,
    "operator": "=",
    "value": value
});

const wmsFilterTemplate = {
    "filterObj": {
        "featureTypeName": null,
        "filterType": "OGC",
        "ogcVersion": "1.1.0",
        "groupFields": [
            {
                "id": 123456,
                "index": 0,
                "logic": "AND"
            },
            {
                "id": "type_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "priority_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "group_profile_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            },
            {
                "id": "status_1",
                "groupId": 123456,
                "logic": "OR",
                "index": 1
            }
        ],
        "filterFields": [],
        "spatialField": [],
        "spatialFieldOperator": "AND"
    }
};

// LEGACY server-side CQL filter builder. Retained as the AC#5 tradeoff
// fallback: for projects whose BMP set exceeds BMP_MVT_FEATURE_THRESHOLD a
// whole-layer MVT is too large, so we serve smaller per-user CQL-filtered WMS
// tiles instead (accepting cache fragmentation). The MVT client-paint path
// (buildBmpVectorStyle) is the default for the common, smaller projects.
const buildCqlFilter = (state, featureTypeName) => {
    const newFilter = JSON.parse(JSON.stringify(wmsFilterTemplate));

    const bmpTypes = state?.swamm?.bmpTypes || [];
    const priorities = state?.swamm?.priorities || [];
    const groupProfiles = state?.swamm?.groupProfiles || [];
    const statuses = state?.swamm?.statuses || [];

    // When all values in a group are selected, omit that filter entirely
    // to avoid sending massive CQL_FILTER with 100+ OR clauses
    const visibleTypes = bmpTypes.filter(t => t?.visibility);
    if (visibleTypes.length !== bmpTypes.length) {
        if (visibleTypes.length === 0) {
            newFilter.filterObj.filterFields.push(createFilterField('type', -1));
        } else {
            visibleTypes.forEach(bmpType => {
                newFilter.filterObj.filterFields.push(createFilterField('type', bmpType.id));
            });
        }
    }

    const visiblePriorities = priorities.filter(p => p?.visibility);
    if (visiblePriorities.length !== priorities.length) {
        if (visiblePriorities.length === 0) {
            newFilter.filterObj.filterFields.push(createFilterField('priority', -1));
        } else {
            visiblePriorities.forEach(priority => {
                newFilter.filterObj.filterFields.push(createFilterField('priority', priority.id));
            });
        }
    }

    const visibleGroupProfiles = groupProfiles.filter(gp => gp?.visibility);
    if (visibleGroupProfiles.length !== groupProfiles.length) {
        visibleGroupProfiles.forEach(groupProfile => {
            newFilter.filterObj.filterFields.push(createFilterField('group_profile', groupProfile.id));
        });
    }

    const visibleStatuses = statuses.filter(s => s?.visibility);
    if (visibleStatuses.length !== statuses.length) {
        visibleStatuses.forEach(status => {
            newFilter.filterObj.filterFields.push(createFilterField('status', status?.name));
        });
    }

    // Remove groupFields that have no filterFields to avoid empty () in CQL
    // which GeoServer rejects as invalid syntax
    const usedGroupIds = new Set(newFilter.filterObj.filterFields.map(f => f.groupId));
    newFilter.filterObj.groupFields = newFilter.filterObj.groupFields.filter(
        gf => gf.index === 0 || usedGroupIds.has(gf.id)
    );
    newFilter.filterObj.featureTypeName = featureTypeName;
    return newFilter;
};

export const filterBmpEpic = (action$, store) =>
    action$.ofType(
        SET_OPEN_MENU_GROUP_ID,
        TOGGLE_BMP_TYPE_VISIBILITY,
        SET_ALL_BMP_TYPES_VISIBILITY,
        TOGGLE_BMP_TYPE_GROUP,
        TOGGLE_BMP_PRIORITY_VISIBILITY,
        TOGGLE_BMP_STATUS_VISIBILITY,
        TOGGLE_BMP_GROUP_PROFILE_VISIBILITY,
        APPLY_INITIAL_BMP_FILTER
    )
        .mergeMap(() => {
            const state = store.getState();
            const bmpOutletLayer = bmpOutletLayerSelector(state);
            const bmpFootprintLayer = bmpFootprintLayerSelector(state);
            const bmpWatershedLayer = bmpWatershedLayerSelector(state);

            // AC#5 tradeoff fallback: huge BMP sets stay on the server-side CQL
            // path (smaller tiles, per-user cache). Feature count unknown =>
            // default to the cheaper client-paint path.
            const footprintFeatureCount = state?.swamm?.projectData?.bmp_footprint?.feature_count;
            if (shouldUseServerSideCql(footprintFeatureCount)) {
                return Rx.Observable.of(
                    changeLayerProperties(bmpOutletLayer?.id, buildCqlFilter(state, bmpOutletLayer?.name)),
                    changeLayerProperties(bmpFootprintLayer?.id, buildCqlFilter(state, bmpFootprintLayer?.name)),
                    changeLayerProperties(bmpWatershedLayer?.id, buildCqlFilter(state, bmpWatershedLayer?.name))
                );
            }

            // Default: client-side cosmetic paint over DIRECT WMS-MVT. Each
            // toggle re-emits a fresh geostyler vectorStyle; the WMSLayer update
            // path re-applies it. No per-user CQL_FILTER => one shared render
            // path within the project authz boundary. NOT routed via GWC (W5
            // deletes BMP TileLayers; direct WMS-MVT only).
            const selections = {
                bmpTypes: state?.swamm?.bmpTypes || [],
                priorities: state?.swamm?.priorities || [],
                groupProfiles: state?.swamm?.groupProfiles || [],
                statuses: state?.swamm?.statuses || []
            };
            return Rx.Observable.of(
                changeLayerProperties(bmpOutletLayer?.id, {
                    format: MVT_FORMAT,
                    vectorStyle: buildBmpVectorStyle('outlet', selections)
                }),
                changeLayerProperties(bmpFootprintLayer?.id, {
                    format: MVT_FORMAT,
                    vectorStyle: buildBmpVectorStyle('footprint', selections)
                }),
                changeLayerProperties(bmpWatershedLayer?.id, {
                    format: MVT_FORMAT,
                    vectorStyle: buildBmpVectorStyle('watershed', selections)
                })
            );
        });
