import {
    INIT_HYDROLOGY_FULFILLED,
    SET_HYDROLOGY_MAIN_MENU,
    SET_HYDROLOGY_TIME_SERIES_DATA,
    SET_HYDROLOGY_TEMPORAL_PATTERN_DATA,
    SET_HYDROLOGY_IDF_TABLE_DATA,
    SET_ACTIVE_HYDROLOGY_PAGE,
    SET_ACTIVE_HYDROLOGY_ITEM,
    UPDATE_ACTIVE_HYDROLOGY_ITEM,
    CREATE_HYDROLOGY_FORM,
    SAVE_HYDROLOGY_ITEM_SUCCESS,
    CREATE_HYDROLOGY_ITEM_SUCCESS,
    DELETE_HYDROLOGY_ITEM_SUCCESS,
    UPDATE_IDF_ROW_DATA,
    UPDATE_TEMPORAL_PATTERN_ROW_DATA,
    UPDATE_TIME_SERIES_ROW_DATA, REPLACE_TIME_SERIES_ROW_DATA,
    REPLACE_TEMPORAL_PATTERN_ROW_DATA,
    SET_TEMPORAL_PATTERN_PRESET,
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
    DERIVE_DESIGN_STORM_REQUEST,
    DERIVE_DESIGN_STORM_SUCCESS,
    DERIVE_DESIGN_STORM_FAILURE,
    SET_DESIGN_STORM_FORM,
    // TASK-1501 (W4b) — projection browser
    SET_PROJECTION_SPEC,
    PREVIEW_DESIGN_STORMS_REQUEST,
    PREVIEW_DESIGN_STORMS_SUCCESS,
    PREVIEW_DESIGN_STORMS_FAILURE,
    SET_PROJECTION_VIEW_FILTER,
    SET_FOCUSED_PREVIEW,
    ATTACH_DESIGN_STORM_REQUEST,
    ATTACH_DESIGN_STORM_SUCCESS,
    ATTACH_DESIGN_STORM_FAILURE,
    MARK_PROJECTION_STALE
} from "@js/plugins/hydrata/Hydrology/actionsHydrology";

import {IdfTable, TemporalPattern, TimeSeries} from "./classesHydrology";
import {CUSTOM, ALTERNATING_BLOCK} from "./temporalPatternPresets";

// TASK-934 — IDF Derive default form values. ERA5-Land hourly data does
// not improve below ~1h, so 60min is the smallest meaningful duration.
// W3 (TASK-1500): defaults match the matrix axes in hydrologyDetailIdfDerive.js.
// Sub-hourly durations excluded from the default (ERA5-Land hourly res) but still
// selectable in the matrix. Durations stored in minutes (canonical).
const IDF_DERIVE_DEFAULT_DURATIONS = '60, 120, 180, 240, 300, 360, 540, 720, 900, 1080, 1440, 2880, 4320';
const IDF_DERIVE_DEFAULT_RPS = '2, 5, 10, 20, 50, 100';

// TASK-1451 (W4) — Design-storm combine form defaults.
// The user picks an IDF table + pattern + AEP/ARI + duration; the form
// starts empty so the user must make explicit selections before deriving.
const initialDesignStorm = {
    // Form inputs
    idfTableId: null,       // selected IDF table pk
    patternKey: 'alternating_block',  // selected pattern key (FE/BE unified)
    aep: '',                // Annual Exceedance Probability % (e.g. '1' = 1-in-100)
    ari: '',                // Average Recurrence Interval years (alternative to AEP)
    durationMin: 60,        // storm duration minutes
    timestepMin: 6,         // output timestep minutes
    peakPosition: 0.5,      // peak position fraction for alternating-block
    name: '',               // optional user-supplied name
    // State
    inFlight: false,
    error: null,
    result: null            // the derived TimeSeries response object
};

// TASK-1501 (W4b) — Design-storm projection browser initial state.
// The projection slice holds the "selection spec" (which IDF variants ×
// patterns are selected), the view filters (RP / duration), the loaded
// previews (rowless, persists=false), and transient attach/stale state.
const initialProjection = {
    // Selection spec — user-driven (what to show in the gallery)
    selectedIdfTableId: null,   // single IDF-variant pk; null = no table selected
    selectedPatterns: [],       // [] → show all available patterns

    // View filters (narrow the displayed gallery; never create/delete rows)
    viewFilter: {
        ari: null,              // null = all return periods
        durationMin: null       // null = all durations
    },

    // Timestep shared for the gallery previews (user-adjustable)
    timestepMin: 60,

    // Loaded previews from mode='preview' batch call
    previews: [],               // [{pattern, ari, duration_min, total_depth_mm, name, source, rowData, persisted}]
    inFlight: false,
    error: null,
    stale: false,               // true after an IDF/pattern save that affects current spec

    // Focused entry (user clicked a gallery card to see its hyetograph)
    focusedKey: null,           // "pattern|ari|duration_min" composite key

    // Attach flow
    attachInFlight: false,
    attachError: null
};

const initialIdfDerive = {
    lat: null,
    lon: null,
    durationsText: IDF_DERIVE_DEFAULT_DURATIONS,
    rpsText: IDF_DERIVE_DEFAULT_RPS,
    mapPickActive: false,
    processId: null,
    taskId: null,
    error: null,
    result: null,
    // Optimistic default — overridden once /api/v2/anuga/config/ resolves.
    // Sites with celery_anuga_enabled=false hit the 503 branch in the epic.
    celeryAnugaEnabled: true,
    inFlight: false
};

const initialState = {
    isHydrologyProject: false,
    showHydrologyMainMenu: false,
    // TASK-1452 (W5): open on Derive (the common path) per D5 resolution.
    activeHydrologyPage: "idf-derive",
    idfDerive: initialIdfDerive,
    designStorm: initialDesignStorm,
    projection: initialProjection
};

export const hydrologyKeyMap = {
    "idf-table": "idfTables",
    "temporal-pattern": "temporalPatterns",
    "time-series": "timeSeriess"
};

// TASK-1532 — user-facing base labels for each hydrology page. 'Design Storm'
// is the label for the timeseries type (see TASK-1533). Used to build the
// auto-numbered default name in CREATE_HYDROLOGY_FORM.
const hydrologyAutoNameLabel = {
    "idf-table": "IDF Table",
    "temporal-pattern": "Temporal Pattern",
    "time-series": "Design Storm"
};

// TASK-1532 — compute the next zero-padded auto-name (e.g. 'IDF Table 03') by
// taking the MAX trailing integer across the existing in-project items whose
// name matches `${baseLabel} NN`, then +1 and padStart(2,'0'). Basing on the
// loaded list (not a running counter) keeps the FE in step with the IDF
// unique-name-per-project constraint and tolerates gaps / user-renamed rows.
// The name is computed ONCE here so the optimistic row's name matches the
// CREATE_HYDROLOGY_ITEM_SUCCESS reconcile (which matches on item.name); a name
// recomputed later would diverge and append a duplicate list row.
const nextAutoName = (baseLabel, items = []) => {
    // Escape any regex metacharacters in the label (defensive; current labels
    // are plain words + spaces).
    const escaped = baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped} (\\d+)$`);
    const maxIndex = items.reduce((max, item) => {
        const match = typeof item?.name === 'string' ? item.name.match(pattern) : null;
        if (match) {
            const n = parseInt(match[1], 10);
            return n > max ? n : max;
        }
        return max;
    }, 0);
    return `${baseLabel} ${String(maxIndex + 1).padStart(2, '0')}`;
};

const createIdfTableFromJson = (idfTableJson) => {
    const idfTableInstance = new IdfTable();
    idfTableInstance.id = idfTableJson?.id;
    idfTableInstance.project = idfTableJson?.project;
    idfTableInstance.name = idfTableJson?.name;
    idfTableInstance.description = idfTableJson?.description;
    idfTableInstance.source = idfTableJson?.source;
    idfTableInstance.owner = idfTableJson?.owner;
    // Only assign when the API actually supplies a `data` object. A persisted
    // IDF table (e.g. one serialized without the columnDefs/rowData blob) can
    // arrive with `data` undefined/null; the IdfTable `data` setter throws on a
    // non-object, and because this runs inside a reducer dispatched by an epic,
    // that throw tears down the entire redux-observable epic stream (every epic
    // — map-pick, identify, etc. — goes silent). Skip the assignment and keep
    // the constructor defaults instead. (Mirrors SWAMM's defensive `r?.data`
    // handling in catchBmpFeatureClick.)
    if (idfTableJson?.data && typeof idfTableJson.data === 'object') {
        idfTableInstance.data = idfTableJson.data;
    }
    return idfTableInstance;
};

const createTemporalPatternFromJson = (temporalPatternJson) => {
    const temporalPatternInstance = new TemporalPattern();
    temporalPatternInstance.id = temporalPatternJson?.id;
    temporalPatternInstance.project = temporalPatternJson?.project;
    temporalPatternInstance.name = temporalPatternJson?.name;
    temporalPatternInstance.description = temporalPatternJson?.description;
    temporalPatternInstance.source = temporalPatternJson?.source;
    temporalPatternInstance.owner = temporalPatternJson?.owner;
    // See createIdfTableFromJson: guard against a non-object `data` so a single
    // malformed record can't throw in-reducer and kill the epic stream.
    if (temporalPatternJson?.data && typeof temporalPatternJson.data === 'object') {
        temporalPatternInstance.data = temporalPatternJson.data;
    }
    // TASK-1502 (W5): preserve pattern_type discriminator from API response.
    // pattern_type='custom' signals the FE to render the custom curve editor.
    temporalPatternInstance.pattern_type = temporalPatternJson?.pattern_type || 'preset';
    // TASK-1531 (keystone): read pattern_key back from the API and derive the
    // picker's selectedPreset. Without this every reload (fetch / SAVE_SUCCESS,
    // both route through here) dropped the chosen preset and the component
    // useEffect snapped selectedKey back to ALTERNATING_BLOCK. selectedPreset is
    // what hydrologyDetailTemporalPattern reads to seat the picker:
    //   - preset row  → its pattern_key (e.g. 'SCS_TYPE_II')
    //   - custom row  → CUSTOM (no pattern_key persisted)
    //   - legacy/none → ALTERNATING_BLOCK (the pre-existing default)
    // UAT2 Phase-1.7: `|| null` (not `?? null`) so a BE empty-string '' is also
    // normalised to null and can't seat a stale preset in the picker.
    temporalPatternInstance.pattern_key = temporalPatternJson?.pattern_key || null;
    temporalPatternInstance.selectedPreset =
        temporalPatternInstance.pattern_key
        || (temporalPatternInstance.pattern_type === 'custom' ? CUSTOM : ALTERNATING_BLOCK);
    return temporalPatternInstance;
};

const createTimeSeriesFromJson = (timeSeriesJson) => {
    const timeSeriesInstance = new TimeSeries();
    timeSeriesInstance.id = timeSeriesJson?.id;
    timeSeriesInstance.project = timeSeriesJson?.project;
    timeSeriesInstance.name = timeSeriesJson?.name;
    timeSeriesInstance.description = timeSeriesJson?.description;
    timeSeriesInstance.source = timeSeriesJson?.source;
    timeSeriesInstance.owner = timeSeriesJson?.owner;
    // See createIdfTableFromJson: guard against a non-object `data` so a single
    // malformed record can't throw in-reducer and kill the epic stream.
    if (timeSeriesJson?.data && typeof timeSeriesJson.data === 'object') {
        timeSeriesInstance.data = timeSeriesJson.data;
    }
    return timeSeriesInstance;
};


export default ( state = initialState, action) => {
    switch (action.type) {
    case INIT_HYDROLOGY_FULFILLED:
        return {
            ...state,
            projectId: action.projectId
        };
    case SET_HYDROLOGY_IDF_TABLE_DATA:
        const idfTables = action.payload.map(idfTableJson => createIdfTableFromJson(idfTableJson));
        return {
            ...state,
            idfTables: idfTables
        };
    case SET_HYDROLOGY_TEMPORAL_PATTERN_DATA:
        const temporalPatterns = action.payload.map(temporalPatternJson => createTemporalPatternFromJson(temporalPatternJson));
        return {
            ...state,
            temporalPatterns: temporalPatterns
        };
    case SET_HYDROLOGY_TIME_SERIES_DATA:
        const timeSeriess = action.payload.map(timeSeriesJson => createTimeSeriesFromJson(timeSeriesJson));
        return {
            ...state,
            timeSeriess: timeSeriess
        };
    case SET_HYDROLOGY_MAIN_MENU:
        return {
            ...state,
            showHydrologyMainMenu: action.visible
        };
    case SET_ACTIVE_HYDROLOGY_PAGE:
        return {
            ...state,
            activeHydrologyPage: action.pageName
        };
    case SET_ACTIVE_HYDROLOGY_ITEM:
        return {
            ...state,
            activeHydrologyItem: action.item
        };
    case UPDATE_ACTIVE_HYDROLOGY_ITEM: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let updatedActiveHydrologyItem;
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (item.id === action.item.id) {
                    item.updateProperties(action.kv);
                    item.unsaved = true;
                    updatedActiveHydrologyItem = item;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case CREATE_HYDROLOGY_FORM: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let newHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            newHydrologyItem = new IdfTable();
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            newHydrologyItem = new TemporalPattern();
        } else if (action.activeHydrologyPage === 'time-series') {
            newHydrologyItem = new TimeSeries();
        }
        newHydrologyItem.unsaved = true;
        // TASK-1532 — overwrite the constructor's static 'New ...' default with
        // an auto-numbered, zero-padded name. Computed ONCE here (we have both
        // the new item and the existing state[pageName] list) so the optimistic
        // POST body's name matches the CREATE_HYDROLOGY_ITEM_SUCCESS reconcile
        // (item.name) — avoiding a duplicate list row. The constructor defaults
        // remain as a fallback for any page without a label mapping.
        const autoNameLabel = hydrologyAutoNameLabel[action.activeHydrologyPage];
        if (autoNameLabel) {
            newHydrologyItem.name = nextAutoName(autoNameLabel, state[pageName] || []);
        }
        return {
            ...state,
            [pageName]: [...state[pageName], newHydrologyItem],
            activeHydrologyItem: newHydrologyItem
        };
    }
    case SAVE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let updatedActiveHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            updatedActiveHydrologyItem = createTemporalPatternFromJson(action.item);
        } else if (action.activeHydrologyPage === 'time-series') {
            updatedActiveHydrologyItem = createTimeSeriesFromJson(action.item);
        }
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (item.id === action.item.id) {
                    updatedActiveHydrologyItem.unsaved = false;
                    return updatedActiveHydrologyItem;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case CREATE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        let updatedActiveHydrologyItem;
        if (action.activeHydrologyPage === 'idf-table') {
            updatedActiveHydrologyItem = createIdfTableFromJson(action.item);
        } else if (action.activeHydrologyPage === 'temporal-pattern') {
            updatedActiveHydrologyItem = createTemporalPatternFromJson(action.item);
        } else if (action.activeHydrologyPage === 'time-series') {
            updatedActiveHydrologyItem = createTimeSeriesFromJson(action.item);
        }
        return {
            ...state,
            [pageName]: state[pageName].map((item) => {
                if (typeof item.id === 'string' && item.id.includes('temp') && item.name === action.item.name) {
                    updatedActiveHydrologyItem.unsaved = false;
                    return updatedActiveHydrologyItem;
                }
                return item;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case DELETE_HYDROLOGY_ITEM_SUCCESS: {
        const pageName = hydrologyKeyMap[action.activeHydrologyPage];
        return {
            ...state,
            [pageName]: state[pageName].filter((item) => item.id !== action.item.id),
            activeHydrologyItem: null
        };
    }
    case UPDATE_IDF_ROW_DATA: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            idfTables: state.idfTables.map((idfTable) => {
                if (idfTable.id === action.idfTableId) {
                    idfTable.updateIntensityValues(action.rowIndex, action.columnId, action.value);
                    idfTable.unsaved = true;
                    updatedActiveHydrologyItem = idfTable;
                }
                return idfTable;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case UPDATE_TEMPORAL_PATTERN_ROW_DATA: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            temporalPatterns: state.temporalPatterns.map((temporalPattern) => {
                if (temporalPattern.id === action.temporalPatternId) {
                    temporalPattern.updatePercentageValues(action.rowIndex, action.columnId, action.value);
                    temporalPattern.unsaved = true;
                    updatedActiveHydrologyItem = temporalPattern;
                }
                return temporalPattern;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    // TASK-1450 (W3) — store the selected preset key on the TemporalPattern item.
    case SET_TEMPORAL_PATTERN_PRESET: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            temporalPatterns: state.temporalPatterns.map((temporalPattern) => {
                if (temporalPattern.id === action.temporalPatternId) {
                    temporalPattern.selectedPreset = action.patternKey;
                    // TASK-1509/1536: keep pattern_type in sync with the selected
                    // key, writing the model's 3-way discriminator (models.py
                    // PatternType: preset / alternating_block / custom) instead of
                    // collapsing Alternating Block into 'preset'. Switching from an
                    // edited custom curve back to a preset left pattern_type='custom',
                    // so the container's Save-disable (gated on pattern_type==='custom')
                    // kept Save wrongly disabled on a valid preset. Custom card → 'custom';
                    // the algorithmic Alternating Block → 'alternating_block'; any other
                    // named preset key → 'preset'.
                    temporalPattern.pattern_type = action.patternKey === CUSTOM
                        ? 'custom'
                        : (action.patternKey === ALTERNATING_BLOCK ? 'alternating_block' : 'preset');
                    // TASK-1531/1536: persist the chosen preset key on the item so the
                    // save epic's {...item} spread sends it in the PATCH/POST body
                    // (was always omitted → row stayed NULL → picker reverted to
                    // Alternating Block on reload). Neither CUSTOM (curve identified by
                    // pattern_type='custom') nor ALTERNATING_BLOCK (algorithmic; models.py
                    // docstring: "Null for alternating_block rows") persists a pattern_key
                    // — null both so the stored row matches the discriminator. On reload
                    // selectedPreset falls back to ALTERNATING_BLOCK for a null key, so
                    // the picker still seats correctly.
                    temporalPattern.pattern_key = (action.patternKey === CUSTOM || action.patternKey === ALTERNATING_BLOCK)
                        ? null
                        : action.patternKey;
                    // UAT2 Phase-1.7: a pure preset change is a real mutation, so
                    // mark it unsaved to visually enable Save (every other mutating
                    // temporal-pattern case already sets this; this one didn't).
                    temporalPattern.unsaved = true;
                    updatedActiveHydrologyItem = temporalPattern;
                }
                return temporalPattern;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    // TASK-1508 (W5 follow-up) — the custom curve editor commits its whole
    // rowData through the reducer (mirrors REPLACE_TIME_SERIES_ROW_DATA),
    // marking the pattern as a project-scoped custom pattern. Replaces the
    // previous direct mutation of activeHydrologyItem in the component, so the
    // save flow reads reducer-managed state. In-place mutation of the pattern
    // instance combined with returning a new {...state} hydrology slice is
    // deliberate: react-redux re-runs mapStateToProps on the new slice (so the
    // container's customCurveError + Save-disable update), while the stable
    // activeHydrologyItem reference avoids retriggering the W5
    // useEffect([activeHydrologyItem]) item-switch reset on every keystroke.
    case REPLACE_TEMPORAL_PATTERN_ROW_DATA: {
        let updatedActiveHydrologyItem;
        return {
            ...state,
            temporalPatterns: state.temporalPatterns.map((temporalPattern) => {
                if (temporalPattern.id === action.temporalPatternId) {
                    temporalPattern.rowData = action.newRowData;
                    temporalPattern.pattern_type = 'custom';
                    // UAT2 Phase-1.7: defensive — the custom path must never carry
                    // a stale preset key (pattern_type='custom' identifies the curve).
                    temporalPattern.pattern_key = null;
                    temporalPattern.unsaved = true;
                    updatedActiveHydrologyItem = temporalPattern;
                }
                return temporalPattern;
            }),
            activeHydrologyItem: updatedActiveHydrologyItem || state.activeHydrologyItem
        };
    }
    case UPDATE_TIME_SERIES_ROW_DATA: {
        let updatedTimeSeries;

        let updatedTimeSeriess = state.timeSeriess.map((timeSeries) => {
            if (timeSeries.id === action.timeSeriesId) {
                timeSeries.updateRowValues(action.rowIndex, action.columnId, action.value);
                timeSeries.unsaved = true;
                updatedTimeSeries = timeSeries;
            }
            return timeSeries;
        });

        return {
            ...state,
            timeSeriess: updatedTimeSeriess,
            activeHydrologyItem: updatedTimeSeries || state.activeHydrologyItem
        };
    }
    case REPLACE_TIME_SERIES_ROW_DATA: {
        let updatedTimeSeries;

        let updatedTimeSeriess = state.timeSeriess.map((timeSeries) => {
            if (timeSeries.id === action.timeSeriesId) {
                timeSeries.setRowData(action.newRowData);
                timeSeries.unsaved = true;
                updatedTimeSeries = timeSeries;
            }
            return timeSeries;
        });

        return {
            ...state,
            timeSeriess: updatedTimeSeriess,
            activeHydrologyItem: updatedTimeSeries || state.activeHydrologyItem
        };
    }
    case SET_IDF_DERIVE_LAT:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), lat: action.lat}
        };
    case SET_IDF_DERIVE_LON:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), lon: action.lon}
        };
    case SET_IDF_DERIVE_DURATIONS:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), durationsText: action.text}
        };
    case SET_IDF_DERIVE_RPS:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), rpsText: action.text}
        };
    case SET_IDF_DERIVE_MAP_PICK_ACTIVE:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), mapPickActive: action.active}
        };
    case DERIVE_IDF_REQUEST:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                error: null,
                result: null,
                processId: null,
                taskId: null,
                inFlight: true
            }
        };
    case SET_IDF_DERIVE_PROCESS_ID:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                processId: action.processId,
                taskId: action.taskId,
                error: null
            }
        };
    case SET_IDF_DERIVE_ERROR:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                error: action.message,
                inFlight: false
            }
        };
    case SET_IDF_DERIVE_RESULT:
        return {
            ...state,
            idfDerive: {
                ...(state.idfDerive || initialIdfDerive),
                result: action.idfTable,
                inFlight: false
            }
        };
    case SET_CELERY_ANUGA_ENABLED:
        return {
            ...state,
            idfDerive: {...(state.idfDerive || initialIdfDerive), celeryAnugaEnabled: action.enabled}
        };
    // TASK-1501 (W4b) — Projection browser slice.
    case SET_PROJECTION_SPEC:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                ...action.spec,
                stale: false,
                previews: [],
                error: null,
                focusedKey: null
            }
        };
    case PREVIEW_DESIGN_STORMS_REQUEST:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                inFlight: true,
                error: null,
                stale: false
            }
        };
    case PREVIEW_DESIGN_STORMS_SUCCESS:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                inFlight: false,
                error: null,
                previews: action.previews,
                stale: false
            }
        };
    case PREVIEW_DESIGN_STORMS_FAILURE:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                inFlight: false,
                error: action.error
            }
        };
    case SET_PROJECTION_VIEW_FILTER:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                viewFilter: {
                    ...(state.projection?.viewFilter || {}),
                    ...action.filter
                }
            }
        };
    case SET_FOCUSED_PREVIEW:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                focusedKey: action.key
            }
        };
    case ATTACH_DESIGN_STORM_REQUEST:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                attachInFlight: true,
                attachError: null
            }
        };
    case ATTACH_DESIGN_STORM_SUCCESS:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                attachInFlight: false,
                attachError: null
            }
        };
    case ATTACH_DESIGN_STORM_FAILURE:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                attachInFlight: false,
                attachError: action.error
            }
        };
    case MARK_PROJECTION_STALE:
        return {
            ...state,
            projection: {
                ...(state.projection || initialProjection),
                stale: true
            }
        };
    // TASK-1451 (W4) — Design-storm combine slice.
    case SET_DESIGN_STORM_FORM:
        return {
            ...state,
            designStorm: {
                ...(state.designStorm || initialDesignStorm),
                ...action.patch
            }
        };
    case DERIVE_DESIGN_STORM_REQUEST:
        return {
            ...state,
            designStorm: {
                ...(state.designStorm || initialDesignStorm),
                inFlight: true,
                error: null,
                result: null
            }
        };
    case DERIVE_DESIGN_STORM_SUCCESS:
        return {
            ...state,
            designStorm: {
                ...(state.designStorm || initialDesignStorm),
                inFlight: false,
                error: null,
                result: action.timeSeries
            }
        };
    case DERIVE_DESIGN_STORM_FAILURE:
        return {
            ...state,
            designStorm: {
                ...(state.designStorm || initialDesignStorm),
                inFlight: false,
                error: action.error
            }
        };
    default:
        return state;
    }
};
