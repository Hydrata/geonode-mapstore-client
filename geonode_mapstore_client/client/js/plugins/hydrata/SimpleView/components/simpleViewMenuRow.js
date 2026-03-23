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
import {
    getOpinionatedObjectIdFromLayerId
} from '../selectorsSimpleView';
import {featureTypeSelected} from "../../../../../MapStore2/web/client/actions/wfsquery";
import {closeFeatureGrid, selectFeatures, setPermission} from "../../../../../MapStore2/web/client/actions/featuregrid";
import {show} from "../../../../../MapStore2/web/client/actions/notifications";
import axios from "../../../../../MapStore2/web/client/libs/ajax";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

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
        showExtentUnavailable: PropTypes.func
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
                        className={"btn glyphicon menu-row-glyph " + (this.props.layer?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                        style={{"color": this.props.layer?.visibility ? "limegreen" : "red"}}
                        onClick={() => {
                            this.props.toggleLayer(this.props.layer?.id, this.props.layer?.visibility);
                            trackEvent('button', `click`, `simpleview-menu-row-turn-${this.props.layer?.visibility ? "off" : "on"}-${this.props.layer.title}`);
                        }}
                    />
                    <span
                        className={"btn glyphicon menu-row-glyph glyphicon-zoom-to"}
                        style={{"color": "#4dabf7"}}
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
                                    className={"btn glyphicon menu-row-glyph glyphicon-download"}
                                    style={{"color": "limegreen"}}
                                    onClick={() => {
                                        this.props.svDownloadLayer(this.props.layer);
                                        trackEvent('button', `click`, `simpleview-menu-row-download-${this.props.layer.title}`);
                                    }}
                                />
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-upload"}
                                    style={{"color": "limegreen"}}
                                    onClick={() => {
                                        this.props.setVisibleUploaderPanel(true, "erosion", this.props.layer?.importerTargetObjectId);
                                        trackEvent('button', `click`, `simpleview-menu-row-upload-${this.props.layer.title}`);
                                    }}
                                />
                            </React.Fragment>
                            : null
                    }
                    {
                        this.props.canEditMap && this.canEditLayer(this.props.layer) ?
                            <React.Fragment>
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-pencil"}
                                    style={{"color": "grey"}}
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
                                        className={"btn glyphicon menu-row-glyph glyphicon-floppy-disk"}
                                        style={{"color": "limegreen"}}
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
                                className={"btn glyphicon menu-row-glyph glyphicon-trash"}
                                style={{"color": "darkred"}}
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

    canEditLayer = (layer) => {
        return (layer?.perms?.indexOf("change_dataset_data") > -1 && layer?.perms?.indexOf("change_resourcebase") > -1 );
    };

    canDeleteLayer = (layer) => {
        return (layer?.perms?.indexOf("delete_resourcebase") > -1);
    };

    canExportLayer = (layer) => {
        return (layer?.perms?.indexOf("download_resourcebase") > -1);
    };
}

const mapStateToProps = (state) => {
    // TODO: move this check to within localConfig.json
    const excludedSites = ["placeholder.com"];
    const isExcludedSite = excludedSites.map(site => !state?.gnsettings?.geonodeUrl.includes(site)).includes(false);
    return {
        canEditMap: !isExcludedSite && state?.gnresource?.initialResource?.perms?.includes('change_resourcebase')
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
            position: "tc"
        }, "warning"))
    };
};

const MenuRow = connect(mapStateToProps, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow
};
