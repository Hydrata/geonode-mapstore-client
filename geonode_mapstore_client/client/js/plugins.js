/**
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
// geonode specific epics
const epics = require("./epics");

module.exports = {
    plugins: {
        AddGroupPlugin: require('../MapStore2/web/client/plugins/AddGroup').default,
        IdentifyPlugin: require('../MapStore2/web/client/plugins/Identify'),
        TOCPlugin: require('../MapStore2/web/client/plugins/TOC'),
        MapPlugin: require('../MapStore2/web/client/plugins/Map'),
        ToolbarPlugin: require('../MapStore2/web/client/plugins/Toolbar'),
        DrawerMenuPlugin: require('../MapStore2/web/client/plugins/DrawerMenu'),
        ZoomAllPlugin: require('../MapStore2/web/client/plugins/ZoomAll'),
        MapLoadingPlugin: require('../MapStore2/web/client/plugins/MapLoading'),
        OmniBarPlugin: require('../MapStore2/web/client/plugins/OmniBar'),
        BackgroundSelectorPlugin: require('../MapStore2/web/client/plugins/BackgroundSelector'),
        FullScreenPlugin: require('../MapStore2/web/client/plugins/FullScreen'),
        ZoomInPlugin: require('../MapStore2/web/client/plugins/ZoomIn'),
        ZoomOutPlugin: require('../MapStore2/web/client/plugins/ZoomOut'),
        ExpanderPlugin: require('../MapStore2/web/client/plugins/Expander'),
        BurgerMenuPlugin: require('../MapStore2/web/client/plugins/BurgerMenu'),
        UndoPlugin: require('../MapStore2/web/client/plugins/History'),
        RedoPlugin: require('../MapStore2/web/client/plugins/History'),
        ScaleBoxPlugin: require('../MapStore2/web/client/plugins/ScaleBox'),
        MapFooterPlugin: require('../MapStore2/web/client/plugins/MapFooter'),
        PrintPlugin: require('../MapStore2/web/client/plugins/Print'),
        MeasurePlugin: require('../MapStore2/web/client/plugins/Measure'),
        FilterLayerPlugin: require('../MapStore2/web/client/plugins/FilterLayer').default,
        TOCItemsSettingsPlugin: require('../MapStore2/web/client/plugins/TOCItemsSettings').default,
        WidgetsPlugin: require('../MapStore2/web/client/plugins/Widgets').default,
        WidgetsBuilderPlugin: require('../MapStore2/web/client/plugins/WidgetsBuilder').default,
        WidgetsTrayPlugin: require('../MapStore2/web/client/plugins/WidgetsTray').default,
        NotificationsPlugin: require('../MapStore2/web/client/plugins/Notifications'),
        FeatureEditorPlugin: require('../MapStore2/web/client/plugins/FeatureEditor').default,
        QueryPanelPlugin: require('../MapStore2/web/client/plugins/QueryPanel'),
        SavePlugin: require('../MapStore2/web/client/plugins/Save').default,
        SaveAsPlugin: require('../MapStore2/web/client/plugins/SaveAs').default,
        MetadataExplorerPlugin: require('../MapStore2/web/client/plugins/MetadataExplorer'),
        GridContainerPlugin: require('../MapStore2/web/client/plugins/GridContainer'),
        StyleEditorPlugin: require('../MapStore2/web/client/plugins/StyleEditor'),
        TimelinePlugin: require('../MapStore2/web/client/plugins/Timeline'),
        PlaybackPlugin: require('../MapStore2/web/client/plugins/Playback'),
        MousePositionPlugin: require('../MapStore2/web/client/plugins/MousePosition'),
        SearchPlugin: require('../MapStore2/web/client/plugins/Search'),
        SearchServicesConfigPlugin: require('../MapStore2/web/client/plugins/SearchServicesConfig'),
        AddReducersAndEpics: {
            reducers: {
                security: require('../MapStore2/web/client/reducers/security'),
                maps: require('../MapStore2/web/client/reducers/maps'),
                currentMap: require('../MapStore2/web/client/reducers/currentMap'),
                maplayout: require('../MapStore2/web/client/reducers/maplayout')
            },
            epics
        },
        ProjectManagerPlugin: require('../MapStore2/web/client/plugins/ProjectManager').default
    },
    requires: {
        ReactSwipe: require('react-swipeable-views').default,
        SwipeHeader: require('../MapStore2/web/client/components/data/identify/SwipeHeader')
    }
};
