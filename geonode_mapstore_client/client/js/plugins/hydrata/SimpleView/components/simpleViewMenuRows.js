import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');

import {MenuRow} from "./simpleViewMenuRow";
import '../simpleView.css';
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import {zoomToExtent} from "../../../../../MapStore2/web/client/actions/map";
import {trackEvent} from "@js/utils/analytics";

const isGlobalExtent = (bounds) =>
    bounds.minx <= -180 && bounds.miny <= -90 && bounds.maxx >= 180 && bounds.maxy >= 90;

class MenuRowsClass extends React.Component {
    static propTypes = {
        menuGroups: PropTypes.array,
        flatLayers: PropTypes.array,
        layerList: PropTypes.array,
        layerSubheadings: PropTypes.array,
        menuDatasets: PropTypes.array,
        openMenuGroupId: PropTypes.string,
        baseMapLayers: PropTypes.array,
        toggleGroupVisibility: PropTypes.func,
        zoomToGroup: PropTypes.func
    };

    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.openMenuGroupId === 'basemaps') {
            return (
                <div className={'menu-rows-container'}>
                    {this.props.baseMapLayers.map((layer) => (
                        <MenuRow layer={layer}/>
                    ))}
                </div>
            );
        }
        if (this.props.layerList?.length === 0) {
            return (
                <div className={'menu-rows-container'}>
                    <MenuRow layer={null}/>
                </div>
            );
        }
        return (
            <div className={'menu-rows-container'}>
                {this.props.layerSubheadings.map(subHeading => {
                    const groupLayers = this.props.layerList?.filter(layer => layer.group.split('.')[1] === subHeading) || [];
                    const allVisible = groupLayers.length > 0 && groupLayers.every(l => l.visibility);
                    const noneVisible = groupLayers.every(l => !l.visibility);
                    return (
                        <React.Fragment key={subHeading}>
                            <div className="subheading-row">
                                <span
                                    className={"btn glyphicon menu-row-glyph " + (allVisible ? "glyphicon-ok" : noneVisible ? "glyphicon-remove" : "glyphicon-minus")}
                                    style={{"color": allVisible ? "limegreen" : noneVisible ? "red" : "orange"}}
                                    onClick={() => {
                                        this.props.toggleGroupVisibility(groupLayers, !allVisible);
                                        trackEvent('button', 'click', `simpleview-group-toggle-${subHeading}-${allVisible ? 'off' : 'on'}`);
                                    }}
                                />
                                <span
                                    className={"btn glyphicon menu-row-glyph glyphicon-zoom-to"}
                                    style={{"color": "#4dabf7"}}
                                    onClick={() => {
                                        this.props.zoomToGroup(groupLayers);
                                        trackEvent('button', 'click', `simpleview-group-zoom-${subHeading}`);
                                    }}
                                />
                                <h5 className="subheading-text">{subHeading}</h5>
                            </div>
                            {groupLayers.map(layer =>
                                <MenuRow key={layer.id} layer={layer}/>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // console.log('state simpleView:', state);
    // debugger;
    return {
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        menuGroups: state?.layers?.groups,
        flatLayers: state?.layers?.flat,
        layerList: state?.layers?.flat?.filter((layer) => layer?.group?.split('.')[0] === state?.simpleView?.openMenuGroupId),
        layerSubheadings: [...new Set(state?.layers?.flat?.filter((layer) => layer?.group?.split('.')[0] === state?.simpleView?.openMenuGroupId).map(layer => layer.group.split('.')[1]))],
        baseMapLayers: state?.layers?.flat.filter((layer) => layer?.group === 'background')
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        toggleGroupVisibility: (layers, visible) => {
            layers.forEach(layer => {
                dispatch(changeLayerProperties(layer.id, {visibility: visible}));
            });
        },
        zoomToGroup: (layers) => {
            const layersWithBbox = layers.filter(l => l.bbox?.bounds && !isGlobalExtent(l.bbox.bounds));
            if (layersWithBbox.length === 0) return;
            const combined = layersWithBbox.reduce((acc, l) => {
                const b = l.bbox.bounds;
                return {
                    minx: Math.min(acc.minx, b.minx),
                    miny: Math.min(acc.miny, b.miny),
                    maxx: Math.max(acc.maxx, b.maxx),
                    maxy: Math.max(acc.maxy, b.maxy)
                };
            }, {minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity});
            const crs = layersWithBbox[0].bbox.crs || "EPSG:4326";
            dispatch(zoomToExtent([combined.minx, combined.miny, combined.maxx, combined.maxy], crs));
        }
    };
};

const MenuRows = connect(mapStateToProps, mapDispatchToProps)(MenuRowsClass);


export {
    MenuRows
};
