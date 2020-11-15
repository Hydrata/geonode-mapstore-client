/**
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
// geonode specific epics
const epics = require("@js/epics");
const { extendPluginsDefinition } = require("@extend/jsapi/plugins");

const pluginsDefinition = {
    plugins: {
        AddGroupPlugin: require('@mapstore/framework/plugins/AddGroup').default,
        IdentifyPlugin: require('@mapstore/framework/plugins/Identify'),
        TOCPlugin: require('@mapstore/framework/plugins/TOC'),
        MapPlugin: require('@mapstore/framework/plugins/Map').default,
        ToolbarPlugin: require('@mapstore/framework/plugins/Toolbar'),
        DrawerMenuPlugin: require('@mapstore/framework/plugins/DrawerMenu'),
        ZoomAllPlugin: require('@mapstore/framework/plugins/ZoomAll'),
        MapLoadingPlugin: require('@mapstore/framework/plugins/MapLoading'),
        OmniBarPlugin: require('@mapstore/framework/plugins/OmniBar'),
        BackgroundSelectorPlugin: require('@mapstore/framework/plugins/BackgroundSelector').default,
        FullScreenPlugin: require('@mapstore/framework/plugins/FullScreen'),
        ZoomInPlugin: require('@mapstore/framework/plugins/ZoomIn'),
        ZoomOutPlugin: require('@mapstore/framework/plugins/ZoomOut'),
        ExpanderPlugin: require('@mapstore/framework/plugins/Expander'),
        BurgerMenuPlugin: require('@mapstore/framework/plugins/BurgerMenu'),
        UndoPlugin: require('@mapstore/framework/plugins/History'),
        RedoPlugin: require('@mapstore/framework/plugins/History'),
        ScaleBoxPlugin: require('@mapstore/framework/plugins/ScaleBox'),
        MapFooterPlugin: require('@mapstore/framework/plugins/MapFooter'),
        PrintPlugin: require('@mapstore/framework/plugins/Print'),
        MeasurePlugin: require('@mapstore/framework/plugins/Measure'),
        FilterLayerPlugin: require('@mapstore/framework/plugins/FilterLayer').default,
        TOCItemsSettingsPlugin: require('@mapstore/framework/plugins/TOCItemsSettings').default,
        WidgetsPlugin: require('@mapstore/framework/plugins/Widgets').default,
        WidgetsBuilderPlugin: require('@mapstore/framework/plugins/WidgetsBuilder').default,
        WidgetsTrayPlugin: require('@mapstore/framework/plugins/WidgetsTray').default,
        NotificationsPlugin: require('@mapstore/framework/plugins/Notifications'),
        FeatureEditorPlugin: require('@mapstore/framework/plugins/FeatureEditor').default,
        QueryPanelPlugin: require('@mapstore/framework/plugins/QueryPanel'),
        SavePlugin: require('@js/plugins/Save').default,
        SaveAsPlugin: require('@js/plugins/SaveAs').default,
        MetadataExplorerPlugin: require('@mapstore/framework/plugins/MetadataExplorer'),
        GridContainerPlugin: require('@mapstore/framework/plugins/GridContainer'),
        StyleEditorPlugin: require('@mapstore/framework/plugins/StyleEditor'),
        TimelinePlugin: require('@mapstore/framework/plugins/Timeline'),
        PlaybackPlugin: require('@mapstore/framework/plugins/Playback'),
        MousePositionPlugin: require('@mapstore/framework/plugins/MousePosition'),
        SearchPlugin: require('@mapstore/framework/plugins/Search'),
        SearchServicesConfigPlugin: require('@mapstore/framework/plugins/SearchServicesConfig'),
        SwipePlugin: require('@mapstore/framework/plugins/Swipe').default,
        LocatePlugin: require('@mapstore/framework/plugins/Locate').default,
        ProjectManagerPlugin: require('@mapstore/framework/plugins/ProjectManager').default,
        SwammPlugin: require('@mapstore/framework/plugins/Swamm').default,
        // BmwhiPlugin: require('../MapStore2/web/client/hydrata/Bmwhi/Bmwhi').default,
        // HaitiBiblioPlugin: require('../MapStore2/web/client/hydrata/HaitiBiblio/HaitiBiblio').default,
        AddReducersAndEpics: {
            reducers: {
                security: require('@mapstore/framework/reducers/security').default,
                maps: require('@mapstore/framework/reducers/maps').default,
                maplayout: require('@mapstore/framework/reducers/maplayout').default
            },
            epics
        }
    },
    requires: {
        ReactSwipe: require('react-swipeable-views').default,
        SwipeHeader: require('@mapstore/framework/components/data/identify/SwipeHeader')
    }
};

const extendedPluginsDefinition = extendPluginsDefinition
    ? extendPluginsDefinition(pluginsDefinition)
    : pluginsDefinition;

module.exports = extendedPluginsDefinition;
