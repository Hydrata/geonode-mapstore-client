import React from "react";
import {connect} from "react-redux";
import {debounce} from 'lodash';
const PropTypes = require('prop-types');

import {
    changeLayerProperties,
    refreshLayers,
    browseData,
    removeNode,
    removeLayer
} from "../../../../../MapStore2/web/client/actions/layers";
import {zoomToExtent} from "../../../../../MapStore2/web/client/actions/map";
import '../simpleView.css';
import {
    svSelectLayer,
    setOpenMenuGroupId,
    updateDatasetTitle,
    svDownloadLayer,
    setVisibleUploaderPanel
} from '../actionsSimpleView';
import {featureTypeSelected} from "../../../../../MapStore2/web/client/actions/wfsquery";
import {closeFeatureGrid, selectFeatures, setPermission} from "../../../../../MapStore2/web/client/actions/featuregrid";
import {show} from "../../../../../MapStore2/web/client/actions/notifications";
import axios from "../../../../../MapStore2/web/client/libs/ajax";
import {trackEvent} from "@js/utils/analytics";
// Persist FE layer-tree mutations to base_resourcebase.blob. The typed
// cascade-delete epics (makeDeleteEpic) already call this; the legacy
// redux-only fallback in performDelete did NOT, so removing an orphan
// terrain layer (no matching resources.terrain row) vanished from the live
// tree but was restored from the blob on the next load — the "deleted
// terrain re-appears" bug.
import {saveDirectContent} from "@js/actions/gnsave";
import Message from '@mapstore/framework/components/I18N/Message';
import {
    canEditLayer as canEditLayerSelector,
    canDeleteLayer as canDeleteLayerSelector,
    canDownloadLayer as canDownloadLayerSelector,
    getProjectMyRole,
    getProjectId
} from '../../Anuga/selectorsAnuga';
import {
    deleteTerrain,
    deleteBoundary,
    deleteFriction,
    deleteInflow,
    // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
    deleteRainfall,
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    deleteStructure,
    deleteMeshRegion,
    deleteCatchment,
    deleteNodes,
    deleteLinks,
    // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster sibling to Terrain)
    deleteFrictionRaster,
    setAnugaInputMenu
} from '../../Anuga/actionsAnuga';
import { startVectorDraw } from '../../VectorDraw/actionsVectorDraw';
// TASK-2016 (epic-1970 W7) — registry-KIND vocabulary single source of truth.
// The `kind` stays a plain serializable STRING in the formConfig (the
// DISCRIMINATOR_KIND.* members ARE strings) so startVectorDraw remains
// structured-clone-safe.
import { DISCRIMINATOR_KIND } from '../../VectorDraw/discriminatorRegistry';
// TASK-826 (W3.3) — Inline `discriminator-picker` choices for Boundary +
// Inflow `data` fields.
//
// DataCloneError fix (2026-06-23): these choice descriptors are embedded in
// the `formConfig` carried by the startVectorDraw Redux action. They must NOT
// carry function values (render component / fetch loader) — OpenReplay's
// tracker-redux Worker.postMessage structured-clones every action on prod and
// throws DataCloneError on a function, silently breaking the edit pencil. So
// each choice now declares ONLY a serializable `kind` string; DiscriminatorPicker
// resolves the ConstantInput / TimeSeriesSelect render component + fetchTimeSeries
// loader from the kind-keyed discriminatorRegistry (registered in FormField.js)
// at render time. DOM + value shape stay byte-identical to the pre-migration
// `time-data-picker` wrapper.
// Presentational primitives — toolbar + slider; VectorDraw 6-action
// onClick body stays in the container and is passed in as `onEdit`.
import {LayerActionToolbar, OpacitySlider} from './primitives';

// V2P-714 + TASK-723 — derive the AnugaModel dataset type from layer.group.
// Group names are set by the BE (gn_anuga/utils.py::INPUT_DATA_GROUP_MAP +
// anuga_map_config.json). Returns one of:
//   'terrain' | 'boundary' | 'friction' | 'inflow' |
//   'structure' | 'mesh_region' | 'catchment' | 'nodes' | 'links' | null
// V2P-714 shipped the first 4 types; TASK-723 fans the same pattern out to
// structure/mesh_region/catchment/nodes/links. NETWORK intentionally excluded
// (no gn_layer + no menu UI — separate lifecycle).
// Full Mesh (fms_) is also excluded because it is a computed artefact, not a
// user-edited input dataset.
const _GROUP_TO_DELETE_TYPE = {
    'Input Data.Terrain': 'terrain',
    'Input Data.Boundaries': 'boundary',
    'Input Data.Friction': 'friction',
    // TASK-829 (W4.2b) — FrictionRaster (raster sibling to polygon Friction).
    // Placed adjacent to 'Input Data.Friction' for ordering coherence. BE
    // INPUT_DATA_GROUP_MAP entry for the raster prefix ships in the
    // follow-up task; this FE-side group→type mapping is harmless until
    // then (no layer.group will match 'Input Data.Friction Rasters').
    'Input Data.Friction Rasters': 'friction_raster',
    'Input Data.Inflows': 'inflow',
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow). Pluralised
    // to match Boundaries/Inflows/Structures; BE INPUT_DATA_GROUP_MAP maps
    // the 'rai' prefix to 'Rainfalls'.
    'Input Data.Rainfalls': 'rainfall',
    // TASK-723 — 5 more types added 2026-05-13 (Network deferred: no gn_layer,
    // no menu UI). Group names from gn_anuga/utils.py INPUT_DATA_GROUP_MAP.
    'Input Data.Structures': 'structure',
    'Input Data.Mesh Regions': 'mesh_region',
    'Input Data.Catchments': 'catchment',
    'Input Data.Nodes': 'nodes',
    'Input Data.Links': 'links',
    // TASK-1271 W4.3 — Breaklines (BE INPUT_DATA_GROUP_MAP maps 'brk_' to 'Breaklines').
    'Input Data.Breaklines': 'breakline'
};
const getDeleteDatasetType = (layer) => _GROUP_TO_DELETE_TYPE[layer?.group] || null;

// TASK-2823 — how many blocking scenarios the refusal names before it switches
// to "and N more". Mirrors BLOCKER_NAMES_IN_MESSAGE in
// /opt/hydrata/apps/gn_anuga/api_v2.py; the full list is rendered underneath
// the sentence either way.
const BLOCKER_NAMES_IN_MESSAGE = 5;

/**
 * TASK-2823 — local twin of gn_anuga/api_v2.py `blocked_delete_message`.
 *
 * The API ALWAYS sends a `message` on its 409, and the reducer stamps it onto
 * `row.blockingError.message`, so this composer only runs when the body
 * reached us without one — an older backend, a proxy that ate the body, or
 * crudEpics' `data.message || ''`. Before 2823 that path printed the
 * pre-TASK-2855 claim ("N active scenarios reference this dataset"), which is
 * both wrong (an IDLE scenario blocks too, since 2855) and useless (no names,
 * no instruction). Keep the wording in step with the Python.
 *
 * @param {Array} blocking blocking[] from the 409 body: {type,id,name,state}
 * @param {string} datasetType e.g. 'terrain' | 'mesh_region' | null
 * @return {string} the refusal, naming the scenarios and the way out
 */
export const composeBlockedDeleteMessage = (blocking, datasetType) => {
    const rows = Array.isArray(blocking) ? blocking : [];
    const label = (datasetType || 'dataset').replace(/_/g, ' ');
    if (rows.length === 0) {
        return `Cannot delete: this ${label} is referenced by one or more scenarios. `
            + 'Detach it from those scenarios first.';
    }
    const shown = rows.slice(0, BLOCKER_NAMES_IN_MESSAGE).map((b) => {
        const name = String(b?.name || '').trim();
        // Same fallback label the backend uses for a nameless scenario, so the
        // sentence and the list underneath it name the same thing.
        return name ? `"${name}"` : `Scenario ${b?.id}`;
    });
    const remainder = rows.length - shown.length;
    const listed = remainder > 0
        ? `${shown.join(', ')} and ${remainder} more`
        : shown.join(', ');
    const tail = rows.length === 1
        ? 'Detach it from that scenario first.'
        : 'Detach it from those scenarios first.';
    return `Cannot delete: this ${label} is referenced by ${listed}. ${tail}`;
};

// STRUCTURE_METHODS — keep in sync with /opt/hydrata/apps/gn_anuga/models/scenario.py:STRUCTURE_METHODS
// ADR-4 (2026-05-29, TASK-1269): three-method taxonomy.
//   Reflective — interior void hole; building obstructs/reflects flow.
//   Mannings   — high-roughness friction zone; building adds drag, not void.
//   Raised     — per-structure adjustable post-mesh elevation correction (m).
// run_utils.make_interior_holes_and_tags routes 'Reflective' (interior-hole path);
// make_frictions routes 'Mannings'; post-mesh elevation routes 'Raised'.
// Default is 'Reflective' (safest for flood modelling — void obstructs flow).
const STRUCTURE_METHODS = ['Reflective', 'Mannings', 'Raised'];

// Default raised height (m) — mirrors BE DEFAULT_RAISED_HEIGHT_M = 5.0.
// Shown only when method == 'Raised'; user can override per-structure.
const DEFAULT_RAISED_HEIGHT_M = 5.0;

// TASK-793 — VectorDraw routing config for the 5 migrated Anuga feature
// types.
//
// FIELD-NAME CASING (TASK-794 fix): All `name` keys must be LOWERCASE to
// match what GeoServer's DescribeFeatureType actually returns. The Python
// BE `attributes_template` constants (gn_anuga/models/scenario.py — Boundary
// line 53-58, Friction 361-364, Structure 371-374, Inflow 381-385,
// MeshRegion 414-417) are passed as JSON to GeoServer at coverage-creation
// time, but PostGIS lower-cases unquoted column identifiers and GeoServer's
// WFS DescribeFeatureType reflects those lowercase column names back. Curl
// proof (2026-05-09):
//   bdy_..._boundary_01 → fid, the_geom, boundary, data       (lowercase)
//   fri_..._friction_01 → fid, the_geom, mannings             (lowercase)
//   inf_..._inflow_01   → fid, the_geom, type, data           (lowercase)
//   mes_..._meshregion_01 → fid, the_geom, resolution         (lowercase)
//   str_..._structure_01  → fid, the_geom, method             (lowercase)
// (`description` / `location` exist as columns in PostGIS but some older
//  GeoServer FeatureType caches don't expose them — the lowercase name is
//  the only one that even has a chance of round-tripping.)
//
// What `name` controls vs `label`: `name` is the WFS-T property key sent
// over the wire (FormField.js → onChange(field.name, val) → state →
// builder.insert filters on Object.keys(properties).filter(getPropertyDescriptor)).
// `label` is the user-visible text rendered by FormField.js. They are
// independent. Lowercasing `name` does NOT change the displayed label.
//
// Bug history: pre-TASK-794, the 4 non-inflow prefixes used Title-case
// `Description / Boundary / Location / Data / Mannings / Method / Resolution`
// — these did NOT match the GeoServer schema's lowercase column names, so
// MapStore's WFS-T RequestBuilder silently filtered them all out and the
// POST body contained ONLY `<the_geom>...</the_geom>`. PostGIS rows landed
// with NULL attribute columns, the picker had nothing to display, and rows
// fell through to the feature-id fallback. Inflow happened to be
// lowercase already (matched its BE template) so its values DID survive —
// but only by accident.
//
// Pre-flight audit (TASK-793): confirmed there are NO consumers of
// state.simpleView.selectedLayer outside the simpleView reducer/actions/
// selectors, and NO Hydrata-side consumers of featuregrid.canEdit. The
// migrated branch therefore safely DROPS setPermission({canEdit:true})
// and svSelectLayer(layer) — the FeatureGrid we're abandoning was the
// only reader.
const ANUGA_FEATURE_CONFIG = {
    // TASK-784 polish: relabel "Description" → "Title" (first field) so
    // users have a short human name per feature, distinct from the longer
    // attribute set. Underlying BE WFS column name is `description`
    // (lowercase, per TASK-794 fix). Picker label fallback chain in
    // VectorDrawPopup reads both casings for back-compat with legacy rows.
    'bdy_': {
        geomType: 'LineString',
        formConfig: {
            title: 'Boundary',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                {name: 'boundary', type: 'select', label: 'Boundary type', "default": 'Dirichlet',
                    options: [
                        {value: 'Dirichlet', label: 'Dirichlet'},
                        {value: 'Reflective', label: 'Reflective'},
                        {value: 'Transmissive', label: 'Transmissive'},
                        {value: 'Time', label: 'Time'}
                    ]},
                {name: 'location', type: 'select', label: 'Location', "default": 'External',
                    options: [
                        {value: 'External', label: 'External'},
                        {value: 'Internal', label: 'Internal'}
                    ]},
                // TASK-795 — Time-boundary value picker. Conditionally rendered
                // (showWhen) only when boundary === 'Time'. Compound widget owns
                // an internal radio (Constant | TimeSeries) and emits exactly
                // one of two WFS-T property names (`data_constant` FLOAT or
                // `data_timeseries_id` INTEGER) — never both, never the legacy
                // bare `data` key. The legacy `data` text column stays in the
                // BE schema for back-compat reads of historical rows but new
                // FE writes no longer populate it. The save epic
                // (vectorDrawSaveEpic in epicsVectorDraw.js) reads the
                // structured formValues.data shape — `{kind:'constant',
                // constant:Number}` or `{kind:'timeseries', timeseries_id:
                // Number}` — and translates to the wire properties dict
                // before calling wfstInsert/Update. EDIT-mode seeding (in
                // VectorDrawPopup.synthesizeTimeData) reverse-maps existing
                // row's `data_constant`/`data_timeseries_id` columns back
                // into the structured shape so the picker re-renders the
                // row's last value.
                //
                // TASK-826 (W3.3) — Migrated from `type: 'time-data-picker'` to
                // the generalized `type: 'discriminator-picker'` with inline
                // `choices`. The `time-data-picker` registry alias stays in
                // place (FormField.js still registers it) but new formConfigs
                // should declare discriminator-picker explicitly. DOM, CSS
                // classes (`.time-data-picker-constant` / `.time-data-picker-
                // timeseries`), and value shape are byte-identical to the
                // pre-W3.3 widget — DiscriminatorPicker resolves to the same
                // ConstantInput / TimeSeriesSelect render components imported
                // from FormField.js.
                // `defaultValue` per choice canonicalizes the kind-switch reset
                // payload to the same `{kind, constant: null}` / `{kind,
                // timeseries_id: null}` shape the legacy TimeDataPicker emitted —
                // so the BE CHECK constraint sees "exactly one of" on every save.
                {name: 'data', type: 'discriminator-picker', label: 'Boundary value',
                    showWhen: {field: 'boundary', equals: 'Time'},
                    choices: [
                        {kind: 'constant', label: 'Constant',
                            defaultValue: {constant: null}},
                        {kind: DISCRIMINATOR_KIND.TIMESERIES, label: 'TimeSeries',
                            defaultValue: {timeseries_id: null}}
                    ]}
            ]
        }
    },
    'inf_': {
        geomType: 'LineString',
        formConfig: {
            title: 'Inflow',
            // TASK-2083 (epic 2077) — optional formConfig-driven hint rendered
            // by the SHARED VectorDrawPopup picker (PickerView, VectorDraw/
            // components/VectorDrawPopup.js) next to its "+ Add new" row.
            // VectorDrawPopup itself carries no inflow-specific copy — it just
            // renders `formConfig.addAnotherHint` (an i18n msgId) when present,
            // so only formConfigs that declare this key show a hint; a
            // boundary/friction/etc. picker (no `addAnotherHint`) renders
            // nothing extra. Clarifies the two distinct '+' decision points:
            // this picker's "+ Add new" adds another inflow location to the
            // SAME Inflow, whereas the top-level '+' in the Inflows rail
            // section (InputSection.js / anugaInputMenu.js renderCreateControls)
            // creates a separate Inflow layer that a scenario cannot combine
            // with this one (a scenario has a single `inflow` FK).
            addAnotherHint: 'hydrata.anuga.inflowAddAnotherHint',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                // why: TASK-955 promoted Rainfall to a top-level `'rai_'` model
                // with its own polygon geometry + dedicated form. The Inflow
                // `type` Rainfall/Surface discriminator is dead-FE — every new
                // inflow is implicitly Surface (LineString hydrograph). The
                // PostGIS `type` column remains for back-compat reads of older
                // rows; new WFS-T writes omit it (PostGIS fills NULL) which
                // run_anuga's legacy `rainfall_filter` already drops.
                //
                // TASK-1984: timeseries-family kind split. 'hydrograph' is the
                // Inflow-specific kind; its discriminatorRegistry entry uses
                // fetchTimeSeries(pid, 'hydrograph') so only hydrograph-type
                // TimeSeries rows appear in the dropdown (AC1). Value shape is
                // identical to the former 'timeseries' kind: {timeseries_id: null}.
                // The generic 'timeseries' kind is kept for bdy_ (AC3 / show-all).
                {name: 'data', type: 'discriminator-picker', label: 'Data',
                    choices: [
                        {kind: 'constant', label: 'Constant',
                            defaultValue: {constant: null}, unit: 'm³/s'},
                        {kind: DISCRIMINATOR_KIND.HYDROGRAPH, label: 'Hydrograph',
                            defaultValue: {timeseries_id: null}}
                    ]}
            ]
        }
    },
    'fri_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Friction',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                {name: 'mannings', type: 'number', label: 'Mannings n', "default": 0.035, step: 0.001}
            ]
        }
    },
    // TASK-955 (W2.2 FE) — Rainfall (polygon sibling to Inflow). BE Rainfall
    // model in /opt/hydrata/apps/gn_anuga/models/scenario.py uses
    // FeatureDataMixin (TASK-820) just like Inflow — same discriminator-picker
    // emits `data_constant` FLOAT or `data_timeseries_id` INTEGER. No `type`
    // discriminator field (rainfall doesn't choose between Rainfall/Surface).
    // geomType is Polygon (vs Inflow's LineString) — VectorDraw will route to
    // the Polygon drawing tool automatically via this entry; no extra wiring
    // required (per TASK-955 spec verification).
    'rai_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Rainfall',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                // TASK-1419 (W5/ISSUE 12): unit='mm/hr' mirrors inf_'s unit='m³/s' pattern.
                // run_anuga converts mm/hr → m/s via RAINFALL_FACTOR=1e-6. The label is
                // rendered as a non-interactive suffix by ConstantInput when unit is set.
                //
                // TASK-1984: timeseries-family kind split. 'hyetograph' is the
                // Rainfall-specific kind; its discriminatorRegistry entry uses
                // fetchTimeSeries(pid, 'hyetograph') so only hyetograph-type
                // TimeSeries rows appear in the dropdown (AC2). Value shape is
                // identical to the former 'timeseries' kind: {timeseries_id: null}.
                {name: 'data', type: 'discriminator-picker', label: 'Data',
                    choices: [
                        {kind: 'constant', label: 'Constant',
                            defaultValue: {constant: null}, unit: 'mm/hr'},
                        {kind: DISCRIMINATOR_KIND.HYETOGRAPH, label: 'Hyetograph / Design Storm',
                            defaultValue: {timeseries_id: null}}
                    ]}
            ]
        }
    },
    'mes_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Mesh Region',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                // TASK-1273 W5.1: label updated from 'Resolution (m²)' to clarify the field is a
                // target EDGE LENGTH (metres), not an area.  The stored value is unchanged — the
                // backend computes max_area = resolution² / 2.  No migration, no mesh change.
                //
                // TASK-2210 (W3.1, epic 2204, od-2): relabeled AGAIN — this is the per-feature
                // REFINEMENT lever glossary's "Mesh resolution" entry describes (it already
                // existed, dogfood found it invisible): each MeshRegion meshes finer than the
                // scenario's base mesh size wherever it's drawn. The scenario-level field
                // (scenarioPane.js) is relabeled "Base mesh size" for the SAME honest framing —
                // the two labels must never drift apart on what "base" vs "refines" means.
                {name: 'resolution', type: 'number', label: 'Resolution (m) — refines the mesh finer here than the scenario base mesh size', "default": 10, step: 1, min: 0.1}
            ]
        }
    },
    'str_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Structure',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                // ADR-4 (TASK-1269): three methods — Reflective / Mannings / Raised.
                // Default is 'Reflective' (replaces old 'Holes' default).
                {name: 'method', type: 'select', label: 'Method', "default": 'Reflective',
                    options: STRUCTURE_METHODS.map(v => ({value: v, label: v}))},
                // 'Raised height (m)' input — visible only when method == 'Raised'.
                // Defaults to DEFAULT_RAISED_HEIGHT_M (5.0); user can override
                // per-structure. The WFS-T property name is 'raised_height' (lowercase,
                // matching the PostGIS column from Structure.raised_height FloatField).
                {name: 'raised_height', type: 'number', label: 'Raised height (m)',
                    "default": DEFAULT_RAISED_HEIGHT_M, step: 0.5, min: 0.0,
                    showWhen: {field: 'method', equals: 'Raised'}}
            ]
        }
    },
    // TASK-1594 (W1) — Culvert: LineString drainage structure for hydro-enforcement.
    // Full D13 hydraulic schema per §9 D13. DEM burning consumes geometry +
    // invert/height/diameter subset; full schema captured here for future ANUGA use.
    'cul_': {
        geomType: 'LineString',
        formConfig: {
            title: 'Culvert',
            fields: [
                {name: 'description', type: 'text', label: 'Description'},
                {name: 'shape', type: 'select', label: 'Shape',
                    options: ['box', 'pipe', 'arch'], "default": null},
                {name: 'width_m', type: 'number', label: 'Width (m)',
                    "default": null, step: 0.1, min: 0.0,
                    showWhen: {field: 'shape', "in": ['box', 'arch']}},
                {name: 'height_m', type: 'number', label: 'Height (m)',
                    "default": null, step: 0.1, min: 0.0,
                    showWhen: {field: 'shape', "in": ['box', 'arch']}},
                {name: 'diameter_m', type: 'number', label: 'Diameter (m)',
                    "default": null, step: 0.1, min: 0.0,
                    showWhen: {field: 'shape', equals: 'pipe'}},
                {name: 'upstream_invert_m', type: 'number', label: 'Upstream invert (m)',
                    "default": null, step: 0.01},
                {name: 'downstream_invert_m', type: 'number', label: 'Downstream invert (m)',
                    "default": null, step: 0.01},
                {name: 'barrels', type: 'number', label: 'Barrels',
                    "default": 1, step: 1, min: 1}
            ]
        }
    },
    // TASK-1271 (W4.3) — Breakline: LineString geometry for mesh edge conformance.
    // Near spacing (m) controls mesh density in the first buffer ring.
    // null near_spacing inherits Scenario.default_near_spacing (= 2.0m).
    'brk_': {
        geomType: 'LineString',
        formConfig: {
            title: 'Breakline',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                // per-line near-mesh spacing; empty = use scenario default (2m).
                {name: 'near_spacing', type: 'number', label: 'Near spacing (m)',
                    "default": null, step: 0.5, min: 0.1}
            ]
        }
    },
    // TASK-829 (W4.2b) — Raster-type entry. FrictionRaster has no VectorDraw
    // editing (it's a raster, not a vector geometry). The `geomType: 'Raster'`
    // sentinel signals the edit-pencil click handler to no-op rather than
    // route to startVectorDraw (which would crash with no geometry) or fall
    // through to the legacy FeatureGrid (would WFS-query a raster → 400).
    // `formConfig: null` because rasters have no per-feature attribute form;
    // per-raster metadata edits live on the FrictionRaster model wrapper UX
    // (not in this picker). Upload UX is launched via setVisibleUploaderPanel
    // from anugaInputMenu.js, NOT from this menu row (which only renders for
    // existing layers). See TASK-829 implementation_notes for the BE
    // follow-up gating end-to-end upload (importer_create not yet shipped).
    'fri_raster_': {
        geomType: 'Raster',
        formConfig: null
    }
};

// TASK-793 helper — returns the config key matching layer.name, or null.
// Layer names look like "geonode:bdy_4_my_boundary"; we match on the
// prefix segment after `geonode:`.
//
// TASK-829 (W4.2b) — Sort keys by length descending so longer prefixes
// (e.g. 'fri_raster_') match before shorter ones ('fri_'). String prefix
// matching alone is ambiguous when one prefix is a strict prefix of
// another. Without this sort, 'fri_raster_4_x'.startsWith('fri_') wins
// and the raster is mis-classified as a polygon Friction → VectorDraw
// routes it to a Polygon-geometry editor, crashing on a raster layer.
const _ANUGA_PREFIXES_BY_LENGTH = Object.keys(ANUGA_FEATURE_CONFIG)
    .slice()
    .sort((a, b) => b.length - a.length);

const getAnugaPrefix = (layerName) => {
    if (!layerName) return null;
    const stripped = layerName.replace(/^geonode:/, '');
    return _ANUGA_PREFIXES_BY_LENGTH.find(p => stripped.startsWith(p)) || null;
};

const isGlobalExtent = (bounds) =>
    bounds.minx <= -180 && bounds.miny <= -90 && bounds.maxx >= 180 && bounds.maxy >= 90;

class MenuRowClass extends React.Component {
    static propTypes = {
        layer: PropTypes.object,
        svSelectLayer: PropTypes.func,
        toggleLayer: PropTypes.func,
        setOpacity: PropTypes.func,
        setOpenMenuGroupId: PropTypes.func,
        canEditMap: PropTypes.bool,
        canUploadErosion: PropTypes.bool,
        editLayer: PropTypes.func,
        featureTypeSelected: PropTypes.func,
        browseData: PropTypes.func,
        setPermission: PropTypes.func,
        closeFeatureGrid: PropTypes.func,
        selectFeatures: PropTypes.func,
        updateDatasetTitle: PropTypes.func,
        removeNode: PropTypes.func,
        removeLayer: PropTypes.func,
        // Persist the legacy redux-only orphan removal to the saved blob.
        saveDirectContent: PropTypes.func,
        updateLayerTitle: PropTypes.func,
        refreshLayers: PropTypes.func,
        svDownloadLayer: PropTypes.func,
        setVisibleUploaderPanel: PropTypes.func,
        selectNode: PropTypes.func,
        lineThrough: PropTypes.bool,
        importerTargetObjectId: PropTypes.number,
        zoomToLayer: PropTypes.func,
        showExtentUnavailable: PropTypes.func,
        // V2P-02 — wired from mapStateToProps via getProjectMyRole + state.security.user.pk
        myRole: PropTypes.string,
        currentUserId: PropTypes.number,
        // V2P-714 — cascade-delete plumbing
        projectId: PropTypes.number,
        deleteRow: PropTypes.object,  // {id, deleting, blockingError, deleteError}
        deleteSliceRows: PropTypes.array,
        allLayers: PropTypes.array,  // V2P-714 sibling-orphan: state.layers.flat
        deleteTerrain: PropTypes.func,
        deleteBoundary: PropTypes.func,
        deleteFriction: PropTypes.func,
        deleteInflow: PropTypes.func,
        // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
        deleteRainfall: PropTypes.func,
        // TASK-723 — cascade-delete fan-out
        deleteStructure: PropTypes.func,
        deleteMeshRegion: PropTypes.func,
        deleteCatchment: PropTypes.func,
        deleteNodes: PropTypes.func,
        deleteLinks: PropTypes.func,
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster lineage)
        deleteFrictionRaster: PropTypes.func,
        // TASK-793 — VectorDraw editor for migrated Anuga prefixes
        // (bdy_/inf_/fri_/mes_/str_).
        startVectorDraw: PropTypes.func,
        // TASK-784 polish — close the AnugaInputMenu side panel during
        // VectorDraw edit so the popup is the focus. The toolbar buttons
        // (rendered by AnugaContainer in a portal) stay visible.
        setAnugaInputMenu: PropTypes.func,
        // UAT 2026-06-17 (TASK-1587) — optional extra toolbar entries rendered to
        // the RIGHT of the per-layer controls (before the title). Each entry is
        // {key, render}; the terrain DEM row uses it for the Mode/Contours toggles.
        extraToolbarActions: PropTypes.array
    };

    constructor(props) {
        super(props);
        this.state = {
            newTitle: props.layer?.title,
            deleteConfirmVisible: false
        };
    }

    render() {
        if (!this.props.layer) {
            return (
                <div className={"sv-menu-row"}>
                    <div className={"sv-menu-row-left"}>
                        <div className="h5 sv-menu-row-text"><Message msgId="hydrata.simpleView.noDatasetsYet" /></div>
                    </div>
                </div>
            );
        }
        // TASK-1010 W6-polish — download and delete positions swapped.
        // Locked 4-icon toolbar order is now: vis | zoom | edit | download.
        // Trash + delete-confirm overlay moved to the secondary toolbar
        // (alongside upload). The delete-confirm overlay stays a sibling of
        // the trash glyph so `.sv-menu-row-delete-confirm .sv-save-confirm-btn.danger`
        // continues to resolve (R03).
        const canEdit = this.props.canEditMap && this.canEditLayer(this.props.layer);
        const canDelete = this.props.canEditMap && this.canDeleteLayer(this.props.layer);
        const canDownload = this.props.canEditMap && this.canExportLayer(this.props.layer);
        const deleting = !!this.props.deleteRow?.deleting;
        const onDownload = () => {
            this.props.svDownloadLayer(this.props.layer);
            trackEvent('button', `click`, `simpleview-menu-row-download-${this.props.layer.title}`);
        };
        // TASK-1010 B2 — secondary toolbar (delete glyph + always-mounted
        // confirm overlay + SWAMM-only upload) is now a `secondaryActions`
        // payload passed to LayerActionToolbar. The primitive owns the
        // `.sv-menu-row-toolbar-secondary` wrapper so the className contract
        // (R03) lives in one place. The confirm overlay is itself a `<span>`
        // (not a glyph) so it uses the primitive's `render` escape hatch.
        const secondaryActions = [];
        if (canDelete) {
            secondaryActions.push({
                key: 'delete',
                glyph: 'glyphicon-trash',
                className: 'sv-glyph-delete'
                    + (deleting ? ' sv-glyph-disabled' : '')
                    + (this.state.deleteConfirmVisible ? ' sv-glyph-hidden' : ''),
                onClick: deleting ? undefined : this.handleDeleteClick,
                ariaDisabled: !!deleting
            });
            secondaryActions.push({
                key: 'delete-confirm',
                render: () => (
                    <span
                        className={
                            "sv-menu-row-delete-confirm"
                            + (this.state.deleteConfirmVisible ? " is-open" : "")
                        }
                        role="alertdialog"
                        aria-label="Confirm delete"
                        aria-hidden={this.state.deleteConfirmVisible ? undefined : true}
                    >
                        <span className="btn glyphicon glyphicon-trash" style={{fontSize: 14}} aria-hidden="true"/>
                        <span className="sv-menu-row-delete-confirm-text">
                            <Message msgId="hydrata.simpleView.confirmDelete"/>
                            {' "'}{this.props.layer?.title}{'"?'}
                        </span>
                        <button
                            type="button"
                            className="sv-save-confirm-btn danger"
                            onClick={this.performDelete}
                        >
                            <Message msgId="hydrata.simpleView.delete"/>
                        </button>
                        <button
                            type="button"
                            className="sv-save-confirm-btn cancel"
                            onClick={this.cancelDelete}
                        >
                            <Message msgId="hydrata.simpleView.cancel"/>
                        </button>
                    </span>
                )
            });
        }
        // TASK-602: erosion is a SWAMM-only feature. Hide the upload
        // button on hydratabase (hydrata.com) — the hardcoded "erosion"
        // importerConfigKey has no matching entry in
        // AnugaProject.simple_view_config.importer_config (which only
        // contains "terrain") and the button used to dispatch a useless
        // action that confused users.
        if (this.props.canUploadErosion) {
            secondaryActions.push({
                key: 'upload',
                glyph: 'glyphicon-upload',
                className: 'sv-glyph-active',
                onClick: () => {
                    this.props.setVisibleUploaderPanel(true, "erosion", this.props.layer?.importerTargetObjectId);
                    trackEvent('button', `click`, `simpleview-menu-row-upload-${this.props.layer.title}`);
                }
            });
        }
        return (
            <div className={"sv-menu-row"}>
                <span className={"sv-menu-row-left"}>
                    <LayerActionToolbar
                        layer={this.props.layer}
                        canEdit={canEdit}
                        canDownload={canDownload}
                        onToggleVisibility={this.onToggleVisibility}
                        onZoom={this.onZoom}
                        onEdit={this.onEdit}
                        onDownload={onDownload}
                        secondaryActions={secondaryActions}
                    />

                    {/* UAT 2026-06-17 (TASK-1587): optional extra-toolbar slot rendered
                        immediately AFTER the per-layer controls and BEFORE the title, so a
                        caller (the terrain DEM row) can place row-specific toggles to the
                        RIGHT of tick/glass/delete. Additive + generic — each entry is
                        {key, render}; non-terrain rows pass nothing and nothing renders. */}
                    {(this.props.extraToolbarActions && this.props.extraToolbarActions.length > 0) ? (
                        <span className={"sv-menu-row-toolbar-extra"}>
                            {this.props.extraToolbarActions.map((a, i) => (
                                <React.Fragment key={a.key || `extra-${i}`}>
                                    {a.render ? a.render() : null}
                                </React.Fragment>
                            ))}
                        </span>
                    ) : null}

                    <div className={"sv-menu-row-title"}>
                        {canEdit ? (
                            <React.Fragment>
                                <input
                                    id={`input-${this.props.layer.name}`}
                                    key={`input-key-${this.props.layer.name}`}
                                    className={'sv-data-title-input'}
                                    style={{"width": "160px"}}
                                    type={'text'}
                                    value={this.state.newTitle}
                                    onChange={(e) => this.setState({newTitle: e.target.value})}
                                />
                                {this.props.layer?.title === this.state.newTitle ? null :
                                    <span
                                        className={"btn glyphicon sv-menu-row-glyph glyphicon-floppy-disk sv-glyph-save"}
                                        onClick={
                                            () => {
                                                this.props.updateDatasetTitle(this.props.layer.name, this.state.newTitle);
                                                this.props.updateLayerTitle(this.props.layer.id, this.state.newTitle);
                                                // TASK-2139 (c.ii/iii): dropped the stray 'tracking ' prefix and the
                                                // unbounded free-text title interpolation (layer name + arbitrary new
                                                // title) — layer.id keeps the label low-cardinality.
                                                trackEvent('button', `click`, `simpleview-menu-row-update-title-${this.props.layer.id}`);
                                            }
                                        }
                                    />
                                }
                            </React.Fragment>
                        ) : (
                            <span className="sv-menu-row-text" style={this.props.layer?.loadingError === "Error" ? {"textDecoration": "lineThrough"} : null}>{this.props.layer?.title}</span>
                        )}
                    </div>
                </span>
                {/* Transparency slider — last child of .sv-menu-row. Always-
                    mounted + CSS-toggled via `hidden` (R04) so the nouislider
                    instance survives delete-confirm overlay show/hide. */}
                <OpacitySlider
                    opacity={this.props.layer?.opacity}
                    hidden={this.state.deleteConfirmVisible}
                    onChange={this.onOpacityChange}
                />
                {this.renderDeleteFeedback()}
            </div>
        );
    }

    // TASK-1010 B6 — debounced analytics for opacity-slider drag. nouislider
    // can fire intermediate values 30+/sec while the user drags; we still
    // dispatch setOpacity on every tick so the visible layer transparency
    // tracks the handle in real time, but coalesce the trackEvent calls to
    // at most ~4/sec via lodash debounce. Trailing-edge so the captured
    // value matches the final handle position. Per-instance so each row
    // owns its own debounced fn (a shared module-level debounce would
    // squash drag events across rows).
    // TASK-2139 (c.ii/iii): dropped the stray 'tracking ' prefix and bucketed
    // the continuous 0-100 opacity value to the nearest 10% — an unbucketed
    // float (nouislider fires ~30/sec) would accrete unbounded Umami event
    // types. layer.id (not title) keeps the layer dimension bounded too.
    trackOpacityDebounced = debounce((layerId, values) => {
        const pct = Math.round((parseFloat(values && values[0]) || 0) / 10) * 10;
        trackEvent('button', `click`, `simpleview-menu-row-set-opacity-${layerId}-${pct}`);
    }, 250);

    onOpacityChange = (values) => {
        this.props.setOpacity(this.props.layer?.id, values);
        this.trackOpacityDebounced(this.props.layer?.id, values);
    };

    componentWillUnmount() {
        // Flush any pending trackEvent so the user's final drag value is
        // recorded even if the row unmounts immediately after release.
        if (this.trackOpacityDebounced) this.trackOpacityDebounced.flush();
    }

    // TASK-1010 B4 — primary toolbar callbacks as arrow class fields so refs
    // are stable across renders (prerequisite for LayerActionToolbar
    // React.memo eligibility in a follow-up task). Bodies preserve the
    // pre-polish behaviour byte-identical, including the ~85-line VectorDraw
    // 6-action onClick in onEdit (W2 R07 sealing).
    onToggleVisibility = () => {
        this.props.toggleLayer(this.props.layer?.id, this.props.layer?.visibility);
        trackEvent('button', `click`, `simpleview-menu-row-turn-${this.props.layer?.visibility ? "off" : "on"}-${this.props.layer.title}`);
    };

    onZoom = () => {
        const hasValidBbox = this.props.layer?.bbox?.bounds && !isGlobalExtent(this.props.layer.bbox.bounds);
        if (hasValidBbox) {
            const {bounds, crs} = this.props.layer.bbox;
            this.props.zoomToLayer([bounds.minx, bounds.miny, bounds.maxx, bounds.maxy], crs || "EPSG:4326");
            trackEvent('button', 'click', `simpleview-menu-row-zoom-to-${this.props.layer.title}`);
        } else {
            this.fetchAndZoomToLayer();
        }
    };

    onEdit = () => {
        const layer = this.props.layer;
        trackEvent('button', `click`, `simpleview-menu-row-edit-${layer.title}`);
        const prefix = getAnugaPrefix(layer.name);
        if (prefix) {
            const cfg = ANUGA_FEATURE_CONFIG[prefix];
            // Raster early-return: rasters have no VectorDraw editing AND
            // would crash the legacy FeatureGrid (no WFS features). Per-
            // raster replace-upload is launched from anugaInputMenu.js, not
            // from the sv-menu-row pencil. The pencil renders (canEditLayer
            // doesn't distinguish raster vs vector) but clicks are inert.
            if (cfg.geomType === 'Raster') {
                return;
            }
            // VectorDraw path — bdy_/inf_/fri_/mes_/str_. setPermission /
            // svSelectLayer omitted per pre-flight audit (TASK-793): no
            // downstream consumers outside the FeatureGrid we're abandoning.
            //
            // Panel hide: <AnugaInputMenu/> is gated by
            // state.anuga.ui.showAnugaInputMenu; state.simpleView.openMenuGroupId
            // controls a different panel rendered in simpleViewContainer.js
            // for non-Anuga maps. Anuga's uiReducer's SET_OPEN_MENU_GROUP_ID
            // case only acts when truthy — so dispatching setOpenMenuGroupId(null)
            // alone does NOT close the Anuga panel. We dispatch BOTH so each
            // panel closes via its own slice. Toolbar buttons portal'd into
            // .simple-view-left-toolbar by AnugaContainer stay visible.
            this.props.closeFeatureGrid();
            this.props.selectFeatures([]);
            this.props.setOpenMenuGroupId(null);
            this.props.setAnugaInputMenu(false);
            this.props.startVectorDraw({
                layerName: layer.name,
                geomType: cfg.geomType,
                featureId: null,
                allowPick: true,
                owner: 'anuga',
                formConfig: cfg.formConfig,
                onComplete: 'ANUGA:VECTOR_DRAW_COMPLETE',
                onCancel: 'ANUGA:VECTOR_DRAW_CANCELLED',
                // layerName: consumed by vectorDrawRecalcBboxEpic (TASK-2165)
                // to recalc the dataset bbox after the WFS-T save.
                meta: { prefix, layerId: layer.id, layerName: layer.name }
            });
        } else {
            // Legacy FeatureGrid path for non-migrated prefixes
            // (terrain_/ele_/cat_/nod_/lin_/full_mesh_/network_).
            this.props.closeFeatureGrid();
            this.props.selectFeatures([]);
            this.props.setOpenMenuGroupId(null);
            this.props.setPermission({canEdit: true});
            this.props.svSelectLayer(layer);
            this.props.browseData(layer);
        }
    };

    fetchAndZoomToLayer = () => {
        const layerName = this.props.layer?.name?.replace('geonode:', '');
        if (!layerName) {
            this.props.showExtentUnavailable(this.props.layer?.title);
            return;
        }
        axios.get(`/api/v2/datasets/?filter{name}=${layerName}`)
            .then(response => {
                const extent = response?.data?.datasets?.[0]?.extent;
                if (extent?.coords && extent.coords.length === 4) {
                    // TASK-2165 — re-apply the world-extent guard to the API
                    // coords. Drawn-from-scratch ANUGA layers keep the
                    // createlayer world placeholder in the Dataset extent
                    // (WFS-T bypasses Django), so without this the fallback
                    // "zooms" to the planet instead of degrading to the toast.
                    const [minx, miny, maxx, maxy] = extent.coords;
                    if (isGlobalExtent({minx, miny, maxx, maxy})) {
                        this.props.showExtentUnavailable(this.props.layer?.title);
                        return;
                    }
                    this.props.zoomToLayer(extent.coords, extent.srid || "EPSG:4326");
                    trackEvent('button', 'click', `simpleview-menu-row-zoom-to-fallback-${this.props.layer.title}`);
                } else {
                    this.props.showExtentUnavailable(this.props.layer?.title);
                }
            })
            .catch(() => {
                this.props.showExtentUnavailable(this.props.layer?.title);
            });
    };

    // V2P-714 + TASK-723 — open the inline confirm overlay. The actual
    // dispatch is in performDelete; this just flips the row into confirm mode
    // so the user sees a React-styled prompt (matching the SimpleView save
    // overlay) instead of the blocking `window.confirm()` we used previously.
    handleDeleteClick = () => {
        if (!this.props.layer) return;
        this.setState({deleteConfirmVisible: true});
    };

    // V2P-714 + TASK-723 — dispatch the right cascade-delete action based on
    // layer.group. The 9 typed datasets (terrain/boundary/friction/inflow +
    // structure/mesh_region/catchment/nodes/links) hit the cascade path;
    // everything else (Network, Full Mesh, non-Anuga groups) falls back to
    // the legacy redux-only removal so this is a strict superset for typed
    // datasets and a no-op elsewhere.
    performDelete = () => {
        const layer = this.props.layer;
        if (!layer) return;
        this.setState({deleteConfirmVisible: false});
        const datasetType = getDeleteDatasetType(layer);
        const datasetId = this.getDatasetIdForLayer(layer);
        trackEvent('button', `click`, `simpleview-menu-row-delete-${layer.title}`);
        if (datasetType && datasetId !== null && this.props.projectId) {
            const dispatcher = {
                terrain: this.props.deleteTerrain,
                boundary: this.props.deleteBoundary,
                friction: this.props.deleteFriction,
                inflow: this.props.deleteInflow,
                // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
                rainfall: this.props.deleteRainfall,
                // TASK-723 — cascade-delete fan-out
                structure: this.props.deleteStructure,
                mesh_region: this.props.deleteMeshRegion,
                catchment: this.props.deleteCatchment,
                nodes: this.props.deleteNodes,
                links: this.props.deleteLinks,
                // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster lineage)
                friction_raster: this.props.deleteFrictionRaster
            }[datasetType];
            if (dispatcher) {
                // V2P-714 sibling-orphan fix — Terrain has TWO sibling layers
                // (gn_layer + gn_layer_hillshade) and the BE cascade deletes
                // both Datasets. Pass an array of all sibling layer ids so
                // the epic can remove each FE layer in lockstep — otherwise
                // the un-removed sibling stays as a ghost ref in the saved
                // map blob and re-renders broken (WMS 404) on next load.
                const layerIds = this.getSiblingLayerIds(datasetId, layer);
                dispatcher(this.props.projectId, datasetId, layerIds);
                return;
            }
        }
        // Legacy redux-only fallback for groups not in _GROUP_TO_DELETE_TYPE
        // (e.g. Network, Full Mesh, non-Anuga groups), AND for a typed-group
        // layer whose backing resource row could not be resolved — most
        // importantly an ORPHAN terrain layer left in the saved blob after its
        // Terrain row + Datasets were deleted server-side (e.g. a combined
        // surface that was re-derived). For that orphan, getDatasetIdForLayer
        // returns null so the cascade path above is skipped and we land here.
        // Unlike the cascade path, this fallback used to omit saveDirectContent,
        // so the removal was never persisted to base_resourcebase.blob and the
        // ghost layer re-appeared on the next load. Persist it so the delete
        // sticks. (Network cascade is deferred — qualitatively different: no
        // gn_layer, no menu UI as the primary delete surface.)
        this.props.removeNode(layer.id, 'layers');
        this.props.removeLayer(layer.id);
        this.props.saveDirectContent && this.props.saveDirectContent();
    };

    cancelDelete = () => {
        this.setState({deleteConfirmVisible: false});
        trackEvent('button', `click`, `simpleview-menu-row-delete-cancel-${this.props.layer?.title}`);
    };

    // V2P-714 sibling-orphan fix — Given the AnugaModel datasetId we just
    // resolved, find ALL MapStore layer ids that map to its sibling
    // Datasets. Terrain rows have gn_layer (utm) AND gn_layer_hillshade;
    // boundary/friction/inflow have only gn_layer. Match by name (the
    // FE-side layer.name is "geonode:<dataset.name>") and fall back to the
    // clicked layer.id if nothing in flat resolves.
    getSiblingLayerIds = (datasetId, clickedLayer) => {
        const rows = this.props.deleteSliceRows || [];
        const row = rows.find(r => r && r.id === datasetId);
        if (!row) return clickedLayer?.id ? [clickedLayer.id] : [];
        const targetNames = [row.gn_layer_name, row.gn_layer_hillshade_name]
            .filter(Boolean);
        if (targetNames.length === 0) {
            return clickedLayer?.id ? [clickedLayer.id] : [];
        }
        const allLayers = this.props.allLayers || [];
        const ids = [];
        for (const l of allLayers) {
            if (!l?.id || !l.name) continue;
            for (const tn of targetNames) {
                if (l.name.endsWith(tn)) {
                    ids.push(l.id);
                    break;
                }
            }
        }
        // Defensive: if name-match found nothing (e.g. row exposes no
        // *_name fields yet because BE hasn't been redeployed), fall back
        // to the clicked layer so deletion at least works on the visible
        // sibling.
        if (ids.length === 0 && clickedLayer?.id) ids.push(clickedLayer.id);
        return ids;
    };

    // V2P-714 — resolve the AnugaModel pk from a MapStore layer. The
    // `state.anuga.resources.<type>` rows carry the pk we need; we match by
    // gn_layer (matches DatasetSerializer.pk attached to the layer) or by
    // layer.id (when the row was stub-created via V2P-21 perms-merge).
    getDatasetIdForLayer = (layer) => {
        const datasetType = getDeleteDatasetType(layer);
        if (!datasetType) return null;
        const sliceKey = {
            terrain: 'terrain',
            boundary: 'boundaries',
            friction: 'frictions',
            inflow: 'inflows',
            // TASK-723 — cascade-delete fan-out. Slot names mirror
            // resourcesReducer.js initialState (structures/meshRegions/
            // catchments/nodes/links).
            structure: 'structures',
            mesh_region: 'meshRegions',
            catchment: 'catchments',
            nodes: 'nodes',
            links: 'links',
            // TASK-829 (W4.2b) — FrictionRaster slot. BE follow-up ships
            // state.anuga.resources.frictionRasters via setAnugaResources
            // payload from ProjectViewSetV2.retrieve; until then this key
            // resolves to undefined which the rows.length===1 fallback
            // below handles cleanly (no row to find → return null →
            // legacy redux-only removal path).
            friction_raster: 'frictionRasters'
        }[datasetType];
        const rows = this.props.deleteSliceRows || [];
        // Prefer matching on gn_layer (the AnugaModel.gn_layer FK to GeoNode
        // Dataset.pk, which is also the MapStore layer id once V2P-78
        // sync ran). Fall back to layer.extendedParams?.mapLayer?.dataset?.pk
        // and finally to a name-based search on layer.name.
        // V2P-714 sibling-orphan: also match on gn_layer_hillshade and its
        // name so clicking the hillshade row resolves to the same Terrain
        // pk as clicking the utm row.
        const layerPk = layer?.extendedParams?.mapLayer?.dataset?.pk
            ?? layer?.dataset?.pk
            ?? null;
        for (const row of rows) {
            if (!row) continue;
            if (layerPk !== null && row.gn_layer === layerPk) return row.id;
            if (layerPk !== null && row.gn_layer_id === layerPk) return row.id;
            if (layerPk !== null && row.gn_layer_hillshade === layerPk) return row.id;
            if (layerPk !== null && row.gn_layer_hillshade_id === layerPk) return row.id;
            // name-based fallback: layer.name="geonode:ele_xxxx" and
            // row.gn_layer_name / gn_layer_hillshade_name carry bare names.
            if (layer?.name && row.gn_layer_name && layer.name.endsWith(row.gn_layer_name)) return row.id;
            if (layer?.name && row.gn_layer_hillshade_name && layer.name.endsWith(row.gn_layer_hillshade_name)) return row.id;
        }
        // Last resort: if there's only one row in the slice and the type
        // matched, return that row's id. This protects against schema drift
        // where neither gn_layer nor gn_layer_name made it onto the row.
        if (rows.length === 1 && rows[0]?.id !== undefined) return rows[0].id;
        // Eslint avoidance — sliceKey is read for symbolic completeness; the
        // resolution above already used the correct slice via
        // mapStateToProps. Return null when nothing matched.
        void sliceKey;
        return null;
    };

    renderDeleteFeedback = () => {
        const row = this.props.deleteRow;
        if (!row) return null;
        if (row.blockingError) {
            const blocking = Array.isArray(row.blockingError.blocking) ? row.blockingError.blocking : [];
            const fallbackMsg = composeBlockedDeleteMessage(
                blocking, getDeleteDatasetType(this.props.layer)
            );
            return (
                <div className="sv-menu-row-delete-error" role="alert">
                    <div className="sv-menu-row-delete-error-message">
                        {row.blockingError.message || fallbackMsg}
                    </div>
                    {blocking.length > 0 ? (
                        <ul className="sv-menu-row-delete-error-list">
                            {blocking.map((b, i) => (
                                <li key={`${b?.type || 'scenario'}-${b?.id || i}`}>
                                    {b?.name || `Scenario ${b?.id}`}
                                    {b?.state ? ` (${b.state})` : ''}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            );
        }
        if (row.deleteError) {
            const status = row.deleteError?.status;
            let msg = 'Delete failed. Please try again.';
            if (status === 401 || status === 403) {
                msg = 'You do not have permission to delete this dataset.';
            }
            return (
                <div className="sv-menu-row-delete-error" role="alert">
                    <div className="sv-menu-row-delete-error-message">{msg}</div>
                </div>
            );
        }
        return null;
    };

    // V2P-02 — these delegate to the pure helpers in selectorsAnuga.js so the
    // role + ownership rules stay consistent with canEditScenarioByRole and
    // are exercised by selectorsAnuga-test.js. Two narrowing extras kept as
    // local AND-checks here:
    //  - canEditLayer also requires `change_dataset_data` (write to feature
    //    table) on top of `change_resourcebase`. This is the hard constraint
    //    for the Edit-glyph: WMS-only layers with no editable feature table
    //    must not show the pencil even if the user can rename the dataset.
    //  - canExportLayer is download-only and intentionally narrower than the
    //    selector's authenticated-can-download rule: SimpleView gates the
    //    glyph on the explicit download_resourcebase grant only.
    // Project my_role + currentUserId are wired in via mapStateToProps below.
    canEditLayer = (layer) => {
        // Selector enforces role + ownership; AND with change_dataset_data
        // because feature-table write is a separate Django-Guardian perm
        // that role-only callers shouldn't bypass on WMS-only layers.
        // V2P-22: switched .indexOf > -1 to .includes per AC#4 (no
        // perms.indexOf in component code; helpers in selectorsAnuga.js
        // remain on indexOf).
        //
        // FINDING 2 (UAT 2026-06-23): change_dataset_data over-blocked. The
        // pencil routes to VectorDraw geometry editing (onEdit), meaningful
        // ONLY on vector anuga layers (bdy_/inf_/fri_/mes_/str_/brk_); rasters
        // (terrain, fri_raster_) already early-return inert in onEdit. The
        // owner's my-perms batch grants change_resourcebase but NOT
        // change_dataset_data on anuga vectors, so requiring the latter hid the
        // pencil from a legitimate editor (e.g. the project owner could not edit
        // boundaries/inflows). Gate instead on the layer being a vector-editable
        // anuga type (capability) — the selector below still enforces role +
        // ownership (WHO may edit). Non-anuga layers (getAnugaPrefix === null,
        // e.g. Swamm) keep the legacy change_dataset_data requirement, so their
        // gating is unchanged.
        const anugaPrefix = getAnugaPrefix(layer?.name);
        const isVectorEditable = !!anugaPrefix
            && ANUGA_FEATURE_CONFIG[anugaPrefix]?.geomType !== 'Raster';
        if (!isVectorEditable && !layer?.perms?.includes("change_dataset_data")) return false;
        return canEditLayerSelector(layer, undefined, this.props.myRole, this.props.currentUserId);
    };

    canDeleteLayer = (layer) => {
        return canDeleteLayerSelector(layer, undefined, this.props.myRole, this.props.currentUserId);
    };

    canExportLayer = (layer) => {
        // Narrower than canDownloadLayerSelector's authenticated-default —
        // SimpleView only shows the download glyph when the explicit
        // download_resourcebase perm is on the layer (matches V2P-01 spread).
        // V2P-22: switched .indexOf > -1 to .includes per AC#4.
        return canDownloadLayerSelector(layer, undefined, this.props.myRole, this.props.currentUserId)
            && layer?.perms?.includes("download_resourcebase");
    };
}

const mapStateToProps = (state, ownProps) => {
    // TODO: move this check to within localConfig.json
    const excludedSites = ["placeholder.com"];
    const isExcludedSite = excludedSites.map(site => !state?.gnsettings?.geonodeUrl.includes(site)).includes(false);
    // TASK-602: erosion upload is a SWAMM-only feature. Gate on JOB_NAME so that
    // hydrata.com (jobName='hydratabase') and other non-swamm sites don't render
    // the orphan upload glyph. jobName is injected into geoNodeSettings by the
    // hydrata `_geonode_config.html` template (see hydrata.context_processors.job_name).
    const jobName = state?.gnsettings?.jobName;
    // V2P-714 — surface the matching anuga.resources slice and per-row
    // delete state for the trash button to consume.
    const layer = ownProps?.layer;
    const datasetType = layer ? getDeleteDatasetType(layer) : null;
    const sliceKey = {
        terrain: 'terrain',
        boundary: 'boundaries',
        friction: 'frictions',
        inflow: 'inflows',
        // TASK-723 — cascade-delete fan-out. Slot names mirror
        // resourcesReducer.js initialState.
        structure: 'structures',
        mesh_region: 'meshRegions',
        catchment: 'catchments',
        nodes: 'nodes',
        links: 'links',
        // TASK-829 (W4.2b) — FrictionRaster slot (BE follow-up wires up
        // state.anuga.resources.frictionRasters).
        friction_raster: 'frictionRasters'
    }[datasetType];
    const sliceRows = sliceKey ? (state?.anuga?.resources?.[sliceKey] || []) : [];
    // Match the row by gn_layer first, then by name fallback (mirrors the
    // logic in getDatasetIdForLayer so reducer-stamped state shows up here).
    // V2P-714 sibling-orphan: also try gn_layer_hillshade so clicking the
    // hillshade FE layer resolves to the same Terrain row as the utm one.
    let deleteRow = null;
    if (sliceRows.length > 0) {
        const layerPk = layer?.extendedParams?.mapLayer?.dataset?.pk
            ?? layer?.dataset?.pk
            ?? null;
        for (const row of sliceRows) {
            if (!row) continue;
            if (layerPk !== null && (
                row.gn_layer === layerPk
                || row.gn_layer_id === layerPk
                || row.gn_layer_hillshade === layerPk
                || row.gn_layer_hillshade_id === layerPk
            )) {
                deleteRow = row;
                break;
            }
            if (layer?.name && (
                (row.gn_layer_name && layer.name.endsWith(row.gn_layer_name))
                || (row.gn_layer_hillshade_name && layer.name.endsWith(row.gn_layer_hillshade_name))
            )) {
                deleteRow = row;
                break;
            }
        }
        if (!deleteRow && sliceRows.length === 1) deleteRow = sliceRows[0];
    }
    return {
        canEditMap: !isExcludedSite && state?.gnresource?.initialResource?.perms?.includes('change_resourcebase'),
        canUploadErosion: jobName === 'swamm',
        // V2P-02 — wire role + currentUserId through to the per-layer
        // permission helpers so contributors see Edit on their own layers
        // and editors+ see it on all layers, even when layer.perms is sparse
        // (e.g. lazy-fetched datasets pre-V2P-21).
        myRole: getProjectMyRole(state),
        currentUserId: state?.security?.user?.pk,
        // V2P-714 — cascade-delete plumbing
        projectId: getProjectId(state),
        deleteSliceRows: sliceRows,
        deleteRow,
        // V2P-714 sibling-orphan: handleDeleteClick walks layers.flat by
        // name to find every sibling MapStore layer for the AnugaModel
        // about to be deleted (Terrain has utm + hillshade siblings).
        allLayers: state?.layers?.flat || []
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        toggleLayer: (layer, isVisible) => dispatch(changeLayerProperties(layer, {visibility: !isVisible})),
        svSelectLayer: (layer) => dispatch(svSelectLayer(layer)),
        setOpacity: (layer, value) => dispatch(changeLayerProperties(layer, {opacity: parseFloat(value) * 0.01})),
        setOpenMenuGroupId: (openMenuGroupId) => dispatch(setOpenMenuGroupId(openMenuGroupId)),
        featureTypeSelected: (url, typeName) => dispatch(featureTypeSelected(url, typeName)),
        browseData: (layer) => dispatch(browseData(layer)),
        setPermission: (permission) => dispatch(setPermission(permission)),
        closeFeatureGrid: () => dispatch(closeFeatureGrid()),
        selectFeatures: (features, append) => dispatch(selectFeatures(features, append)),
        updateDatasetTitle: (datasetName, newTitle) => dispatch(updateDatasetTitle(datasetName, newTitle)),
        removeNode: (nodeId, type) => dispatch(removeNode(nodeId, type)),
        removeLayer: (layerId) => dispatch(removeLayer(layerId)),
        // Persist the orphan-layer removal in the legacy fallback so the
        // ghost does not re-appear from the blob on the next map load.
        saveDirectContent: () => dispatch(saveDirectContent()),
        updateLayerTitle: (layer, title) => dispatch(changeLayerProperties(layer, {title: title})),
        // TASK-2382 — explicit options are REQUIRED (bare dispatch killed the
        // root epic via unguarded Object.keys in the core refresh epic);
        // title: false so caps refresh never clobbers user-set titles.
        refreshLayers: (layerArray) => dispatch(refreshLayers(layerArray, { bbox: true, search: true, dimensions: true, title: false })),
        svDownloadLayer: (layer) => dispatch(svDownloadLayer(layer)),
        setVisibleUploaderPanel: (visible, importerConfigKey, importerTargetObjectId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, importerTargetObjectId)),
        zoomToLayer: (extent, crs) => dispatch(zoomToExtent(extent, crs)),
        showExtentUnavailable: (layerTitle) => dispatch(show({
            message: `Layer extent is not available for "${layerTitle}". The layer bounding box needs to be recalculated in GeoServer.`,
            title: "Zoom unavailable",
            uid: "zoom-extent-unavailable",
            position: "tc",
            autoDismiss: 6
        }, "warning")),
        // V2P-714 — cascade-delete dispatchers. layerIds is an array
        // (Terrain has utm + hillshade siblings; the others have one).
        deleteTerrain: (projectId, id, layerIds) => dispatch(deleteTerrain(projectId, id, layerIds)),
        deleteBoundary: (projectId, id, layerIds) => dispatch(deleteBoundary(projectId, id, layerIds)),
        deleteFriction: (projectId, id, layerIds) => dispatch(deleteFriction(projectId, id, layerIds)),
        deleteInflow: (projectId, id, layerIds) => dispatch(deleteInflow(projectId, id, layerIds)),
        // TASK-955 (W2.2 FE) — Rainfall cascade-delete (polygon sibling to Inflow).
        deleteRainfall: (projectId, id, layerIds) => dispatch(deleteRainfall(projectId, id, layerIds)),
        // TASK-723 — cascade-delete fan-out for structure/mesh_region/
        // catchment/nodes/links. Same signature as the V2P-714 four.
        deleteStructure: (projectId, id, layerIds) => dispatch(deleteStructure(projectId, id, layerIds)),
        deleteMeshRegion: (projectId, id, layerIds) => dispatch(deleteMeshRegion(projectId, id, layerIds)),
        deleteCatchment: (projectId, id, layerIds) => dispatch(deleteCatchment(projectId, id, layerIds)),
        deleteNodes: (projectId, id, layerIds) => dispatch(deleteNodes(projectId, id, layerIds)),
        deleteLinks: (projectId, id, layerIds) => dispatch(deleteLinks(projectId, id, layerIds)),
        // TASK-829 (W4.2b) — FrictionRaster cascade-delete (raster lineage)
        deleteFrictionRaster: (projectId, id, layerIds) => dispatch(deleteFrictionRaster(projectId, id, layerIds)),
        // TASK-793 — VectorDraw editor for migrated Anuga prefixes
        startVectorDraw: (config) => dispatch(startVectorDraw(config)),
        // TASK-784 polish — close the AnugaInputMenu side panel during
        // VectorDraw edit so the popup is the focus.
        setAnugaInputMenu: (visible) => dispatch(setAnugaInputMenu(visible))
    };
};

const MenuRow = connect(mapStateToProps, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow,
    // TASK-723 — unconnected inner class exposed for unit tests. The dialog
    // refactor moved the dispatch behind a React state-driven confirm step,
    // and react-redux's connect() wrapper interferes with setState→re-render
    // flushing in our Karma+JSDOM setup. Tests render the unwrapped class
    // directly to assert dialog behaviour deterministically.
    MenuRowClass,
    // V2P-714 — exposed for unit tests so the layer.group → dataset-type
    // mapping can be exercised without standing up a Provider tree.
    getDeleteDatasetType,
    // TASK-793 — exposed for unit tests so the migrated-prefix routing
    // logic can be exercised as a pure function.
    getAnugaPrefix,
    ANUGA_FEATURE_CONFIG,
    // TASK-1269 (W4.1) — canonical Method values for Structure; FE single
    // source of truth, mirrors BE gn_anuga.models.STRUCTURE_METHODS.
    // ADR-4: three methods {Reflective, Mannings, Raised}.
    STRUCTURE_METHODS
};
