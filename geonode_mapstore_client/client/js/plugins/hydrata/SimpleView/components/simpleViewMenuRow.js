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
    getProjectMyRole
} from '../../Anuga/selectorsAnuga';

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
        currentUserId: PropTypes.number
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
                                    // only contains "elevation"). On hydratabase this button always
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
                                        this.props.closeFeatureGrid();
                                        this.props.selectFeatures([]);
                                        this.props.setOpenMenuGroupId(null);
                                        this.props.setPermission({canEdit: true});
                                        this.props.svSelectLayer(this.props.layer);
                                        this.props.browseData(this.props.layer);
                                        trackEvent('button', `click`, `simpleview-menu-row-edit-${this.props.layer.title}`);
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
                                className={"btn glyphicon menu-row-glyph glyphicon-trash glyph-delete"}
                                onClick={() => {
                                    this.props.removeNode(this.props.layer.id, 'layers');
                                    this.props.removeLayer(this.props.layer.id);
                                    this.props.refreshlayerVersion(this.props.layer.id);
                                    trackEvent('button', `click`, `simpleview-menu-row-delete-${this.props.layer.title}`);
                                }}
                            /> : null
                    }
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

const mapStateToProps = (state) => {
    // TODO: move this check to within localConfig.json
    const excludedSites = ["placeholder.com"];
    const isExcludedSite = excludedSites.map(site => !state?.gnsettings?.geonodeUrl.includes(site)).includes(false);
    // TASK-602: erosion upload is a SWAMM-only feature. Gate on JOB_NAME so that
    // hydrata.com (jobName='hydratabase') and other non-swamm sites don't render
    // the orphan upload glyph. jobName is injected into geoNodeSettings by the
    // hydrata `_geonode_config.html` template (see hydrata.context_processors.job_name).
    const jobName = state?.gnsettings?.jobName;
    return {
        canEditMap: !isExcludedSite && state?.gnresource?.initialResource?.perms?.includes('change_resourcebase'),
        canUploadErosion: jobName === 'swamm',
        // V2P-02 — wire role + currentUserId through to the per-layer
        // permission helpers so contributors see Edit on their own layers
        // and editors+ see it on all layers, even when layer.perms is sparse
        // (e.g. lazy-fetched datasets pre-V2P-21).
        myRole: getProjectMyRole(state),
        currentUserId: state?.security?.user?.pk
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
        }, "warning"))
    };
};

const MenuRow = connect(mapStateToProps, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow
};
