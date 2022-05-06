import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
const Slider = require('react-nouislider');

import {changeLayerProperties, browseData} from "../../../../../MapStore2/web/client/actions/layers";
import '../simpleView.css';
import {svSelectLayer, setOpenMenuGroupId} from '../actionsSimpleView';
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
        selectFeatures: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {};
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
                            : null
                    }
                    <span className="menu-row-text">{this.props.layer.title}</span>
                </span>
                {
                    (this.props.layer.opacity === 0 || this.props.layer.opacity) ?
                        <div className="mapstore-slider dataset-transparency with-tooltip" onClick={(e) => { e.stopPropagation(); }}>
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
            </div>
        );
    }
    canEdit = (layer) => layer?.perms?.includes("change_dataset_data") && layer?.perms?.includes("change_resourcebase")
}

const mapStateToProps = (state) => {
    // TODO: move this check to within localConfig.json
    const excludedSites = ["theswamm.com"];
    const isExcludedSite = excludedSites.map(site => !state?.gnsettings?.geonodeUrl.includes(site)).includes(false);
    console.log('state?.gnresource?.initialResource?.perms?.includes(\'change_resourcebase\'):', state?.gnresource?.initialResource?.perms?.includes('change_resourcebase'));
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
        selectFeatures: (features, append) => dispatch(selectFeatures(features, append))
    };
};

const MenuRow = connect(mapStateToProps, mapDispatchToProps)(MenuRowClass);


export {
    MenuRow
};
