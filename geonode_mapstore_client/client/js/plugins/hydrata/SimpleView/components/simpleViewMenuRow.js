import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');

import {
    changeLayerProperties,
    refreshlayerVersion,
    refreshLayers,
    browseData,
    removeNode,
    removeLayer
} from "../../../../../MapStore2/web/client/actions/layers";
import '../simpleView.css';
import {svSelectLayer, setOpenMenuGroupId, updateDatasetTitle} from '../actionsSimpleView';
import {featureTypeSelected} from "../../../../../MapStore2/web/client/actions/wfsquery";
import {closeFeatureGrid, selectFeatures, setPermission} from "../../../../../MapStore2/web/client/actions/featuregrid";

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
        refreshLayers: PropTypes.func
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
                <div className={"row menu-row"}>
                    <div className={"inline pull-left .menu-row-button"}>
                        <div className="h5 menu-row-text">No datasets here yet...</div>
                    </div>
                </div>
            );
        }
        return (
            <div className={"row menu-row"}>
                <span className={"pull-left .menu-row-button"}>
                    <span
                        className={"btn glyphicon menu-row-glyph " + (this.props.layer?.visibility ? "glyphicon-ok" : "glyphicon-remove")}
                        style={{"color": this.props.layer?.visibility ? "limegreen" : "red"}}
                        onClick={() => {this.props.toggleLayer(this.props.layer?.id, this.props.layer?.visibility);}}
                    />
                    {
                        this.props.canEditMap && this.canEdit(this.props.layer) ?
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
                                    }}
                                />
                                <input
                                    id={`input-${this.props.layer.name}`}
                                    key={`input-key-${this.props.layer.name}`}
                                    className={'data-title-input'}
                                    style={{"width": "160px", "float": "none"}}
                                    type={'text'}
                                    value={this.state.newTitle}
                                    onChange={(e) => this.setState({newTitle: e.target.value})}
                                />
                                {this.props.layer?.title === this.state.newTitle ? null :
                                    <span
                                        className={"btn glyphicon menu-row-glyph glyphicon-floppy-disk"}
                                        style={{"color": "limegreen", "float": "right", "marginLeft": "8px"}}
                                        onClick={
                                            () => {
                                                this.props.updateDatasetTitle(this.props.layer.name, this.state.newTitle);
                                                this.props.updateLayerTitle(this.props.layer.id, this.state.newTitle);
                                            }
                                        }
                                    />
                                }
                            </React.Fragment>
                            : <span className="menu-row-text">{this.props.layer?.title}</span>
                    }
                </span>
                <span className={"pull-right .menu-row-button"}>
                    {
                        (this.props.canEditMap && this.canEdit(this.props.layer)) ?
                            <span
                                className={"btn glyphicon menu-row-glyph glyphicon-trash"}
                                style={{"color": "darkred", "float": "right"}}
                                onClick={() => {
                                    this.props.removeNode(this.props.layer.id, 'layers');
                                    this.props.removeLayer(this.props.layer.id);
                                    this.props.refreshlayerVersion(this.props.layer.id);
                                }}
                            /> : null
                    }
                    {
                        (this.props.layer.opacity === 0 || this.props.layer.opacity) ?
                            <div
                                className="mapstore-slider dataset-transparency with-tooltip"
                                onClick={(e) => { e.stopPropagation();}}
                                style={
                                    (this.props.canEditMap && this.canEdit(this.props.layer)) ?
                                        this.props.layer?.title === this.state.newTitle ? {
                                            "display": "inline-block",
                                            "float": "right",
                                            "width": "195px",
                                            "marginRight": "10px",
                                            "marginLeft": "10px",
                                            "marginBottom": "-10px",
                                            "marginTop": "2px"
                                        } : {
                                            "display": "inline-block",
                                            "float": "right",
                                            "width": "165px",
                                            "marginRight": "10px",
                                            "marginLeft": "10px",
                                            "marginBottom": "-10px",
                                            "marginTop": "2px"
                                        } : {
                                            "display": "inline-block",
                                            "float": "right",
                                            "width": "195px",
                                            "marginRight": "40px",
                                            "marginLeft": "10px",
                                            "marginBottom": "-10px",
                                            "marginTop": "2px"
                                        }
                                }
                            >
                                <Slider
                                    step={1}
                                    start={this.props.layer?.opacity * 100}
                                    range={{
                                        min: 0,
                                        max: 100
                                    }}
                                    onChange={(values) => {
                                        this.props.setOpacity(this.props.layer?.id, values);
                                    }}
                                />
                            </div> :
                            null
                    }
                </span>
            </div>
        );
    }
    canEdit = (layer) => {
        return (layer?.perms?.indexOf("change_dataset_data") > -1 && layer?.perms?.indexOf("change_resourcebase") > -1 );
    }
}

const mapStateToProps = (state) => {
    // TODO: move this check to within localConfig.json
    const excludedSites = ["theswamm.com"];
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
        refreshLayers: (layerArray) => dispatch(refreshLayers(layerArray))
    };
};

const MenuRow = connect(mapStateToProps, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow
};
