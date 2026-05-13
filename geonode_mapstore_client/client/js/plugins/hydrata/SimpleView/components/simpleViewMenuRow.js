import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');

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
    // TASK-723 — cascade-delete fan-out (structure/mesh_region/catchment/nodes/links)
    deleteStructure,
    deleteMeshRegion,
    deleteCatchment,
    deleteNodes,
    deleteLinks,
    setAnugaInputMenu
} from '../../Anuga/actionsAnuga';
import { startVectorDraw } from '../../VectorDraw/actionsVectorDraw';
// TASK-826 (W3.3) — Inline `discriminator-picker` choices for Boundary +
// Inflow `data` fields. Render components live in FormField.js (the
// generalized DiscriminatorPicker dispatches to them); we reuse them here
// rather than reimplementing so DOM + value shape stay byte-identical to
// the pre-migration `time-data-picker` wrapper. fetchTimeSeries is the
// per-mount loader for the 'timeseries' kind.
import { ConstantInput, TimeSeriesSelect, fetchTimeSeries } from '../../VectorDraw/components/FormField';

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
    'Input Data.Inflows': 'inflow',
    // TASK-723 — 5 more types added 2026-05-13 (Network deferred: no gn_layer,
    // no menu UI). Group names from gn_anuga/utils.py INPUT_DATA_GROUP_MAP.
    'Input Data.Structures': 'structure',
    'Input Data.Mesh Regions': 'mesh_region',
    'Input Data.Catchments': 'catchment',
    'Input Data.Nodes': 'nodes',
    'Input Data.Links': 'links'
};
const getDeleteDatasetType = (layer) => _GROUP_TO_DELETE_TYPE[layer?.group] || null;

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
                        {kind: 'constant', label: 'Constant', render: ConstantInput,
                            defaultValue: {constant: null}},
                        {kind: 'timeseries', label: 'TimeSeries', fetch: fetchTimeSeries,
                            render: TimeSeriesSelect, defaultValue: {timeseries_id: null}}
                    ]}
            ]
        }
    },
    'inf_': {
        geomType: 'LineString',
        formConfig: {
            title: 'Inflow',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                {name: 'type', type: 'select', label: 'Type', "default": 'Rainfall',
                    options: [
                        {value: 'Rainfall', label: 'Rainfall'},
                        {value: 'Surface', label: 'Surface'}
                    ]},
                // TASK-850 (W2.3-FE) — Compound Constant/TimeSeries picker. Mirrors
                // the Boundary Time-data-picker pattern (above) but always renders —
                // Inflow has no discriminator. Inflow.make_file consumes the resolved
                // value via FeatureDataMixin (TASK-820) so the picker emits one of
                // `data_constant` FLOAT or `data_timeseries_id` INTEGER, never the
                // legacy bare `data` text. EDIT-mode seeding goes through
                // inflowTranslate.synthesizeIn via the registry (epicsVectorDraw.js).
                //
                // TASK-826 (W3.3) — Migrated from `type: 'time-data-picker'` to
                // the generalized `type: 'discriminator-picker'` with inline
                // `choices`. Same migration as the Boundary field above; DOM,
                // CSS, and value shape unchanged. The `time-data-picker` alias
                // remains registered in FormField.js for external consumers.
                {name: 'data', type: 'discriminator-picker', label: 'Data',
                    choices: [
                        {kind: 'constant', label: 'Constant', render: ConstantInput,
                            defaultValue: {constant: null}},
                        {kind: 'timeseries', label: 'TimeSeries', fetch: fetchTimeSeries,
                            render: TimeSeriesSelect, defaultValue: {timeseries_id: null}}
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
    'mes_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Mesh Region',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                {name: 'resolution', type: 'number', label: 'Resolution (m²)', "default": 10, step: 1, min: 0.1}
            ]
        }
    },
    'str_': {
        geomType: 'Polygon',
        formConfig: {
            title: 'Structure',
            fields: [
                {name: 'description', type: 'text', label: 'Title'},
                {name: 'method', type: 'select', label: 'Method', "default": 'Holes',
                    options: [
                        {value: 'Holes', label: 'Holes'},
                        {value: 'Mannings', label: 'Mannings'},
                        {value: 'Reflective', label: 'Reflective'}
                    ]}
            ]
        }
    }
};

// TASK-793 helper — returns the config key matching layer.name, or null.
// Layer names look like "geonode:bdy_4_my_boundary"; we match on the
// prefix segment after `geonode:`.
const getAnugaPrefix = (layerName) => {
    if (!layerName) return null;
    const stripped = layerName.replace(/^geonode:/, '');
    return Object.keys(ANUGA_FEATURE_CONFIG).find(p => stripped.startsWith(p)) || null;
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
        refreshlayerVersion: PropTypes.func,
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
        // TASK-723 — cascade-delete fan-out
        deleteStructure: PropTypes.func,
        deleteMeshRegion: PropTypes.func,
        deleteCatchment: PropTypes.func,
        deleteNodes: PropTypes.func,
        deleteLinks: PropTypes.func,
        // TASK-793 — VectorDraw editor for migrated Anuga prefixes
        // (bdy_/inf_/fri_/mes_/str_).
        startVectorDraw: PropTypes.func,
        // TASK-784 polish — close the AnugaInputMenu side panel during
        // VectorDraw edit so the popup is the focus. The toolbar buttons
        // (rendered by AnugaContainer in a portal) stay visible.
        setAnugaInputMenu: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {
            newTitle: props.layer?.title
        };
    }

    render() {
        if (!this.props.layer) {
            return (
                <div className={"menu-row"}>
                    <div className={"menu-row-left"}>
                        <div className="h5 menu-row-text"><Message msgId="hydrata.simpleView.noDatasetsYet" /></div>
                    </div>
                </div>
            );
        }
        const hasValidBbox = this.props.layer?.bbox?.bounds && !isGlobalExtent(this.props.layer.bbox.bounds);
        return (
            <div className={"menu-row"}>
                <span className={"menu-row-left"}>
                    <span
                        className={"btn glyphicon menu-row-glyph " + (this.props.layer?.visibility ? "glyphicon-ok glyph-active" : "glyphicon-remove glyph-inactive")}
                        onClick={() => {
                            this.props.toggleLayer(this.props.layer?.id, this.props.layer?.visibility);
                            trackEvent('button', `click`, `simpleview-menu-row-turn-${this.props.layer?.visibility ? "off" : "on"}-${this.props.layer.title}`);
                        }}
                    />
                    <span
                        className={"btn glyphicon menu-row-glyph glyphicon-zoom-to glyph-zoom"}
                        onClick={() => {
                            if (hasValidBbox) {
                                const {bounds, crs} = this.props.layer.bbox;
                                this.props.zoomToLayer([bounds.minx, bounds.miny, bounds.maxx, bounds.maxy], crs || "EPSG:4326");
                                trackEvent('button', 'click', `simpleview-menu-row-zoom-to-${this.props.layer.title}`);
                            } else {
                                this.fetchAndZoomToLayer();
                            }
                        }}
                    />
                    {
                        this.props.canEditMap && this.canExportLayer(this.props.layer) ?
                            <React.Fragment>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-download glyph-active"}
                                    onClick={() => {
                                        this.props.svDownloadLayer(this.props.layer);
                                        trackEvent('button', `click`, `simpleview-menu-row-download-${this.props.layer.title}`);
                                    }}
                                />
                                {
                                    // TASK-602: erosion is a SWAMM-only feature. Hide the upload
                                    // button when running on hydratabase (hydrata.com), where the
                                    // hardcoded "erosion" importerConfigKey has no matching entry
                                    // in the AnugaProject.simple_view_config.importer_config (which
                                    // only contains "terrain"). On hydratabase this button always
                                    // dispatched a useless action and confused users.
                                    this.props.canUploadErosion ? (
                                        <span
                                            className={"btn glyphicon menu-row-glyph glyphicon-upload glyph-active"}
                                            onClick={() => {
                                                this.props.setVisibleUploaderPanel(true, "erosion", this.props.layer?.importerTargetObjectId);
                                                trackEvent('button', `click`, `simpleview-menu-row-upload-${this.props.layer.title}`);
                                            }}
                                        />
                                    ) : null
                                }
                            </React.Fragment>
                            : null
                    }
                    {
                        this.props.canEditMap && this.canEditLayer(this.props.layer) ?
                            <React.Fragment>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-pencil glyph-edit"}
                                    onClick={() => {
                                        const layer = this.props.layer;
                                        trackEvent('button', `click`, `simpleview-menu-row-edit-${layer.title}`);
                                        const prefix = getAnugaPrefix(layer.name);
                                        if (prefix) {
                                            const cfg = ANUGA_FEATURE_CONFIG[prefix];
                                            // Migrated VectorDraw path — bdy_/inf_/fri_/mes_/str_.
                                            // setPermission/svSelectLayer omitted: pre-flight audit
                                            // (TASK-793) confirmed no downstream consumers outside the
                                            // FeatureGrid we're abandoning.
                                            //
                                            // Panel hide: the inputs side panel is <AnugaInputMenu/>,
                                            // gated by state.anuga.ui.showAnugaInputMenu (set by
                                            // setAnugaInputMenu). state.simpleView.openMenuGroupId
                                            // controls a DIFFERENT panel (the SimpleView menu-groups
                                            // panel rendered in simpleViewContainer.js for non-Anuga
                                            // maps), so dispatching setOpenMenuGroupId(null) alone
                                            // does NOT close the Anuga inputs panel — Anuga's
                                            // uiReducer's SET_OPEN_MENU_GROUP_ID case only acts when
                                            // the value is truthy. We dispatch BOTH so each panel
                                            // closes via its own slice. The toolbar buttons
                                            // (portal'd into .simple-view-left-toolbar by
                                            // AnugaContainer) are not gated by either slice and
                                            // stay visible.
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
                                                meta: { prefix, layerId: layer.id }
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
                                    }}
                                />
                                <input
                                    id={`input-${this.props.layer.name}`}
                                    key={`input-key-${this.props.layer.name}`}
                                    className={'data-title-input'}
                                    style={{"width": "160px"}}
                                    type={'text'}
                                    value={this.state.newTitle}
                                    onChange={(e) => this.setState({newTitle: e.target.value})}
                                />
                                {this.props.layer?.title === this.state.newTitle ? null :
                                    <span
                                        className={"btn glyphicon menu-row-glyph glyphicon-floppy-disk glyph-save"}
                                        onClick={
                                            () => {
                                                this.props.updateDatasetTitle(this.props.layer.name, this.state.newTitle);
                                                this.props.updateLayerTitle(this.props.layer.id, this.state.newTitle);
                                                trackEvent('button', `click`, `tracking simpleview-menu-row-update-title-${this.props.layer.name} -> ${this.state.newTitle}`);
                                            }
                                        }
                                    />
                                }
                            </React.Fragment>
                            : <span className="menu-row-text" style={this.props.layer?.loadingError === "Error" ? {"textDecoration": "lineThrough"} : null}>{this.props.layer?.title}</span>
                    }
                </span>
                <span className={"menu-row-right"}>
                    {
                        (this.props.canEditMap && this.canDeleteLayer(this.props.layer)) ?
                            <span
                                className={
                                    "btn glyphicon menu-row-glyph glyphicon-trash glyph-delete"
                                    + (this.props.deleteRow?.deleting ? " glyph-disabled" : "")
                                }
                                onClick={this.props.deleteRow?.deleting ? undefined : this.handleDeleteClick}
                                aria-disabled={this.props.deleteRow?.deleting ? true : undefined}
                            /> : null
                    }
                    {this.renderDeleteFeedback()}
                    {
                        <div
                            className="mapstore-slider dataset-transparency with-tooltip"
                            onClick={(e) => { e.stopPropagation();}}
                            style={{ width: "150px", marginBottom: "-10px", marginTop: "2px" }}
                        >
                            <Slider
                                step={1}
                                // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
                                start={this.props.layer?.opacity != null ? this.props.layer.opacity * 100 : 100}
                                range={{
                                    min: 0,
                                    max: 100
                                }}
                                onChange={(values) => {
                                    this.props.setOpacity(this.props.layer?.id, values);
                                    trackEvent('button', `click`, `tracking simpleview-menu-row-set-opacity-${this.props.layer.title} -> ${values}`);
                                }}
                            />
                        </div>
                    }
                </span>
            </div>
        );
    }
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

    // V2P-714 + TASK-723 — confirm + dispatch the right cascade-delete action
    // based on layer.group. The 9 typed datasets (terrain/boundary/friction/
    // inflow + structure/mesh_region/catchment/nodes/links) hit the cascade
    // path; everything else (Network, Full Mesh, non-Anuga groups) falls back
    // to the legacy redux-only removal so this change is a strict superset of
    // behaviour for the typed datasets and a no-op elsewhere.
    handleDeleteClick = () => {
        const layer = this.props.layer;
        if (!layer) return;
        const datasetType = getDeleteDatasetType(layer);
        const datasetId = this.getDatasetIdForLayer(layer);
        // eslint-disable-next-line no-alert -- intentional user confirmation, matches Hydrata house style (ScenarioTableRow / scenarioOverview)
        if (!confirm(`Delete "${layer.title}"? This cannot be undone.`)) {
            return;
        }
        trackEvent('button', `click`, `simpleview-menu-row-delete-${layer.title}`);
        if (datasetType && datasetId !== null && this.props.projectId) {
            const dispatcher = {
                terrain: this.props.deleteTerrain,
                boundary: this.props.deleteBoundary,
                friction: this.props.deleteFriction,
                inflow: this.props.deleteInflow,
                // TASK-723 — cascade-delete fan-out
                structure: this.props.deleteStructure,
                mesh_region: this.props.deleteMeshRegion,
                catchment: this.props.deleteCatchment,
                nodes: this.props.deleteNodes,
                links: this.props.deleteLinks
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
        // (e.g. Network, Full Mesh, non-Anuga groups). Network cascade is
        // deferred — qualitatively different (no gn_layer, no menu UI as the
        // primary delete surface).
        this.props.removeNode(layer.id, 'layers');
        this.props.removeLayer(layer.id);
        this.props.refreshlayerVersion(layer.id);
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
            links: 'links'
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
            const fallbackMsg = blocking.length > 0
                ? `Cannot delete: ${blocking.length} active scenario${blocking.length === 1 ? '' : 's'} reference${blocking.length === 1 ? 's' : ''} this dataset.`
                : 'Cannot delete: this dataset is referenced by active scenarios.';
            return (
                <div className="menu-row-delete-error" role="alert">
                    <div className="menu-row-delete-error-message">
                        {row.blockingError.message || fallbackMsg}
                    </div>
                    {blocking.length > 0 ? (
                        <ul className="menu-row-delete-error-list">
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
                <div className="menu-row-delete-error" role="alert">
                    <div className="menu-row-delete-error-message">{msg}</div>
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
        if (!layer?.perms?.includes("change_dataset_data")) return false;
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
        links: 'links'
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
        updateLayerTitle: (layer, title) => dispatch(changeLayerProperties(layer, {title: title})),
        refreshLayers: (layerArray) => dispatch(refreshLayers(layerArray)),
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
        // TASK-723 — cascade-delete fan-out for structure/mesh_region/
        // catchment/nodes/links. Same signature as the V2P-714 four.
        deleteStructure: (projectId, id, layerIds) => dispatch(deleteStructure(projectId, id, layerIds)),
        deleteMeshRegion: (projectId, id, layerIds) => dispatch(deleteMeshRegion(projectId, id, layerIds)),
        deleteCatchment: (projectId, id, layerIds) => dispatch(deleteCatchment(projectId, id, layerIds)),
        deleteNodes: (projectId, id, layerIds) => dispatch(deleteNodes(projectId, id, layerIds)),
        deleteLinks: (projectId, id, layerIds) => dispatch(deleteLinks(projectId, id, layerIds)),
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
    // V2P-714 — exposed for unit tests so the layer.group → dataset-type
    // mapping can be exercised without standing up a Provider tree.
    getDeleteDatasetType,
    // TASK-793 — exposed for unit tests so the migrated-prefix routing
    // logic can be exercised as a pure function.
    getAnugaPrefix,
    ANUGA_FEATURE_CONFIG
};
