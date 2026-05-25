import React from "react";
import {connect} from "react-redux";
import {createSelector} from 'reselect';
const PropTypes = require('prop-types');

import {MenuRow} from "./simpleViewMenuRow";
// Miller-columns rail primitive + shared tri-state glyph formula used by
// both the rail and the single-subheading legacy accordion fallback.
import {CategoryRail, tristateGlyph} from './primitives';
import '../simpleView.css';
import {changeLayerProperties} from "../../../../../MapStore2/web/client/actions/layers";
import {zoomToExtent} from "../../../../../MapStore2/web/client/actions/map";
import {show} from "../../../../../MapStore2/web/client/actions/notifications";
import axios from "../../../../../MapStore2/web/client/libs/ajax";
import {trackEvent} from "@js/utils/analytics";

const isGlobalExtent = (bounds) =>
    bounds.minx <= -180 && bounds.miny <= -90 && bounds.maxx >= 180 && bounds.maxy >= 90;

const EMPTY_ARRAY = [];

// TASK-1010 B7 — memoized rail-item derivation. `state.layers.flat` is a
// long array (50-150 layers) and `buildRailItems` previously filtered it
// once per subheading per render = O(N×S) work on every connected
// component re-render — even when neither `layers.flat` nor the
// openMenuGroupId changed. Hoisting the derivation into a reselect
// selector keyed on the two real inputs short-circuits all that work on
// unrelated state-shape changes (controls, security, gnresource, etc.).
//
// Output shape mirrors the previous `buildRailItems(subHeadings)` return
// so the component's rail + pane render paths can read straight from the
// prop. `groupLayers` is precomputed per subHeading (replaces the inner
// `getGroupLayers(subHeading)` filter).
const _selectLayerList = createSelector(
    [(state) => state?.layers?.flat || EMPTY_ARRAY,
        (state) => state?.simpleView?.openMenuGroupId],
    (flat, openMenuGroupId) =>
        flat.filter((layer) => layer?.group?.split('.')[0] === openMenuGroupId)
);

const _selectLayerSubheadings = createSelector(
    [_selectLayerList],
    (layerList) => [...new Set(layerList.map(layer => layer.group.split('.')[1]))]
);

const _selectRailItems = createSelector(
    [_selectLayerList, _selectLayerSubheadings],
    (layerList, subHeadings) =>
        subHeadings.map((subHeading) => {
            const groupLayers = layerList.filter(
                (layer) => layer.group.split('.')[1] === subHeading
            );
            const allVisible = groupLayers.length > 0 && groupLayers.every(l => l.visibility);
            const noneVisible = groupLayers.every(l => !l.visibility);
            return {subHeading, groupLayers, allVisible, noneVisible};
        })
);

const _selectBaseMapLayers = createSelector(
    [(state) => state?.layers?.flat || EMPTY_ARRAY],
    (flat) => flat.filter((layer) => layer?.group === 'background')
);

const COLLAPSE_STORAGE_PREFIX = 'simpleview-subgroup-collapsed';

const collapseStorageKey = (menuId, subHeading) =>
    `${COLLAPSE_STORAGE_PREFIX}:${menuId || ''}:${subHeading || ''}`;

const readCollapsed = (menuId, subHeading) => {
    try {
        return window.localStorage.getItem(collapseStorageKey(menuId, subHeading)) === '1';
    } catch (e) {
        return false;
    }
};

const writeCollapsed = (menuId, subHeading, collapsed) => {
    try {
        const key = collapseStorageKey(menuId, subHeading);
        if (collapsed) {
            window.localStorage.setItem(key, '1');
        } else {
            window.localStorage.removeItem(key);
        }
    } catch (e) {
        // localStorage unavailable (privacy mode, etc.); fall back to in-memory only
    }
};

class MenuRowsClass extends React.Component {
    static propTypes = {
        menuGroups: PropTypes.array,
        flatLayers: PropTypes.array,
        layerList: PropTypes.array,
        layerSubheadings: PropTypes.array,
        // TASK-1010 B7 — memoized per-subHeading rail payload from a
        // reselect selector. `[{subHeading, groupLayers, allVisible,
        // noneVisible}]`. Read in renderRail (build CategoryRail items),
        // renderPane (rows for the selected pane), and the legacy
        // single-subHeading accordion fallback.
        railItems: PropTypes.array,
        menuDatasets: PropTypes.array,
        openMenuGroupId: PropTypes.string,
        baseMapLayers: PropTypes.array,
        toggleGroupVisibility: PropTypes.func,
        zoomToGroup: PropTypes.func
    };

    constructor(props) {
        super(props);
        const subHeadings = props.layerSubheadings || [];
        this.state = {
            // Per-(menuId, subHeading) collapsed booleans, hydrated lazily on first render
            collapsed: {},
            // Miller-columns selected subheading — local component state, NOT
            // redux. Defaults to first subheading on mount; resets when
            // openMenuGroupId changes. The reducer field `selectedCategory`
            // exists for R12 hydration safety only and is intentionally never
            // read at runtime (R05).
            selectedSubHeading: subHeadings[0] || null
        };
    }

    trackGroupToggle(subHeading, isOn) {
        trackEvent('button', 'click', `simpleview-group-toggle-${subHeading}-${isOn ? 'on' : 'off'}`);
    }

    trackGroupZoom(subHeading) {
        trackEvent('button', 'click', `simpleview-group-zoom-${subHeading}`);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.openMenuGroupId !== this.props.openMenuGroupId) {
            const subHeadings = this.props.layerSubheadings || [];
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({selectedSubHeading: subHeadings[0] || null});
            return;
        }
        const subHeadings = this.props.layerSubheadings || [];
        if (this.state.selectedSubHeading && !subHeadings.includes(this.state.selectedSubHeading)) {
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({selectedSubHeading: subHeadings[0] || null});
        }
    }

    isCollapsed(subHeading) {
        const key = collapseStorageKey(this.props.openMenuGroupId, subHeading);
        if (Object.prototype.hasOwnProperty.call(this.state.collapsed, key)) {
            return this.state.collapsed[key];
        }
        return readCollapsed(this.props.openMenuGroupId, subHeading);
    }

    toggleCollapsed = (subHeading) => {
        const key = collapseStorageKey(this.props.openMenuGroupId, subHeading);
        const next = !this.isCollapsed(subHeading);
        writeCollapsed(this.props.openMenuGroupId, subHeading, next);
        this.setState((prev) => ({
            collapsed: {...prev.collapsed, [key]: next}
        }));
        trackEvent('button', 'click', `simpleview-group-collapse-${subHeading}-${next ? 'on' : 'off'}`);
    };

    handleSelectSubHeading = (subHeading) => {
        this.setState({selectedSubHeading: subHeading});
        trackEvent('button', 'click', `simpleview-rail-select-${subHeading}`);
    };

    // TASK-1010 B5 — rail callbacks as arrow class fields so refs stay
    // stable across renders. Prerequisite for CategoryRail React.memo
    // eligibility in a later polish task. Bodies match the pre-polish
    // inline arrows byte-identical.
    onToggleGroupVisibility = (groupLayers, nextVisible, subHeading) => {
        this.props.toggleGroupVisibility(groupLayers, nextVisible);
        this.trackGroupToggle(subHeading, nextVisible);
    };

    onZoomToGroup = (groupLayers, subHeading) => {
        this.props.zoomToGroup(groupLayers);
        this.trackGroupZoom(subHeading);
    };

    // TASK-1010 B7 — read from the memoized `railItems` prop instead of
    // re-filtering `layerList` on every render. Falls back to the previous
    // filter for safety if a test renders the class unconnected (no
    // railItems prop) — the unwrapped MenuRowsClass is also exported for
    // tests that bypass the Provider tree.
    getRailItem(subHeading) {
        const items = this.props.railItems;
        if (items && items.length > 0) {
            const item = items.find(i => i.subHeading === subHeading);
            if (item) return item;
        }
        const groupLayers = this.props.layerList?.filter(
            layer => layer.group.split('.')[1] === subHeading
        ) || [];
        const allVisible = groupLayers.length > 0 && groupLayers.every(l => l.visibility);
        const noneVisible = groupLayers.every(l => !l.visibility);
        return {subHeading, groupLayers, allVisible, noneVisible};
    }

    getGroupLayers(subHeading) {
        return this.getRailItem(subHeading).groupLayers;
    }

    renderRail(subHeadings) {
        // Iterate `subHeadings` (already ordered for the UI) and look up
        // each rail item via the memoized selector. Keeps rail order
        // deterministic regardless of the upstream sort order of
        // `state.layers.flat`.
        const items = subHeadings.map(sh => this.getRailItem(sh));
        return (
            <CategoryRail
                items={items}
                selectedSubHeading={this.state.selectedSubHeading}
                onSelect={this.handleSelectSubHeading}
                onToggleGroupVisibility={this.onToggleGroupVisibility}
                onZoomToGroup={this.onZoomToGroup}
            />
        );
    }

    renderPane() {
        const subHeading = this.state.selectedSubHeading;
        if (!subHeading) {
            return (
                <div className="menu-rows-pane">
                    <MenuRow layer={null}/>
                </div>
            );
        }
        const groupLayers = this.getGroupLayers(subHeading);
        return (
            <div className="menu-rows-pane">
                {groupLayers.map(layer =>
                    <MenuRow key={layer.id} layer={layer}/>
                )}
            </div>
        );
    }

    renderSingleSubHeadingFallback(subHeading) {
        // Legacy accordion path used when there's exactly 1 subheading.
        // Keeps the original .subheading-row markup verbatim so
        // simpleViewGlyphClasses-test.js continues to pass and the
        // localStorage collapse helpers stay exercised. Miller rail+pane
        // activates at 2+ subheadings where a 1-button rail would be a
        // strictly worse UX than the accordion.
        const {groupLayers, allVisible, noneVisible} = this.getRailItem(subHeading);
        const collapsed = this.isCollapsed(subHeading);
        const chevronGlyph = collapsed ? 'glyphicon-chevron-right' : 'glyphicon-chevron-down';
        return (
            <React.Fragment key={subHeading}>
                <div className="subheading-row">
                    <span
                        className={"btn glyphicon menu-row-glyph " + tristateGlyph(allVisible, noneVisible)}
                        onClick={() => {
                            this.props.toggleGroupVisibility(groupLayers, !allVisible);
                            this.trackGroupToggle(subHeading, !allVisible);
                        }}
                    />
                    <span
                        className={"btn glyphicon menu-row-glyph glyphicon-zoom-to glyph-zoom"}
                        onClick={() => {
                            this.props.zoomToGroup(groupLayers);
                            this.trackGroupZoom(subHeading);
                        }}
                    />
                    <h5
                        className={"subheading-text subheading-text-clickable"}
                        onClick={() => this.toggleCollapsed(subHeading)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                this.toggleCollapsed(subHeading);
                            }
                        }}
                        aria-expanded={!collapsed}
                    >
                        {subHeading}
                    </h5>
                    <span
                        className={"btn glyphicon menu-row-glyph glyph-collapse " + chevronGlyph}
                        onClick={() => this.toggleCollapsed(subHeading)}
                        aria-label={collapsed ? "Expand group" : "Collapse group"}
                    />
                </div>
                {!collapsed && groupLayers.map(layer =>
                    <MenuRow key={layer.id} layer={layer}/>
                )}
            </React.Fragment>
        );
    }

    render() {
        if (this.props.openMenuGroupId === 'basemaps') {
            return (
                <div className={'menu-rows-container'}>
                    {this.props.baseMapLayers.map((layer) => (
                        <MenuRow key={layer.id} layer={layer}/>
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
        const subHeadings = this.props.layerSubheadings || [];
        if (subHeadings.length < 2) {
            return (
                <div className={'menu-rows-container'}>
                    {subHeadings.map(subHeading => this.renderSingleSubHeadingFallback(subHeading))}
                </div>
            );
        }
        return (
            <div className={'menu-rows-container'}>
                <div className={'sv-rail-pane-shell'}>
                    {this.renderRail(subHeadings)}
                    {this.renderPane()}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // TASK-1010 B7 — `layerList`, `layerSubheadings`, `railItems`, and
    // `baseMapLayers` are memoized via reselect selectors. The previous
    // inline-filter implementation rebuilt all four arrays on every
    // mapStateToProps invocation; with `state.layers.flat` ~50-150 long
    // and the rail iterating once per subheading per render, this
    // dominated CPU on unrelated state changes (controls, security, etc.).
    return {
        openMenuGroupId: state?.simpleView?.openMenuGroupId,
        menuGroups: state?.layers?.groups,
        flatLayers: state?.layers?.flat,
        layerList: _selectLayerList(state),
        layerSubheadings: _selectLayerSubheadings(state),
        railItems: _selectRailItems(state),
        baseMapLayers: _selectBaseMapLayers(state)
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
            const showZoomUnavailable = () => dispatch(show({
                message: "Layer extents are not available for this group.",
                title: "Zoom unavailable",
                uid: "zoom-extent-unavailable",
                position: "tc",
                autoDismiss: 6
            }, "warning"));

            const layersWithBbox = layers.filter(l => l.bbox?.bounds && !isGlobalExtent(l.bbox.bounds));
            if (layersWithBbox.length > 0) {
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
                return;
            }
            const layerNames = layers.map(l => l.name?.replace('geonode:', '')).filter(Boolean);
            if (layerNames.length === 0) return;
            Promise.all(layerNames.map(name =>
                axios.get(`/api/v2/datasets/?filter{name}=${name}`).then(r => r?.data?.datasets?.[0]?.extent).catch(() => null)
            )).then(extents => {
                const valid = extents.filter(e => e?.coords && e.coords.length === 4);
                if (valid.length === 0) {
                    showZoomUnavailable();
                    return;
                }
                const combined = valid.reduce((acc, e) => ({
                    minx: Math.min(acc.minx, e.coords[0]),
                    miny: Math.min(acc.miny, e.coords[1]),
                    maxx: Math.max(acc.maxx, e.coords[2]),
                    maxy: Math.max(acc.maxy, e.coords[3])
                }), {minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity});
                dispatch(zoomToExtent([combined.minx, combined.miny, combined.maxx, combined.maxy], valid[0].srid || "EPSG:4326"));
            }).catch(showZoomUnavailable);
        }
    };
};

const MenuRows = connect(mapStateToProps, mapDispatchToProps)(MenuRowsClass);


export {
    MenuRows,
    MenuRowsClass
};
