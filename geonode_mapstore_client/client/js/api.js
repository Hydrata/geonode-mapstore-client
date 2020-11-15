/**
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
require('react-widgets/dist/css/react-widgets.css');
const assign = require("object-assign");
const ConfigUtils = require('@mapstore/framework/utils/ConfigUtils');
const LocaleUtils = require('@mapstore/framework/utils/LocaleUtils');
const LayersUtils = require('@mapstore/framework/utils/LayersUtils');
LayersUtils.setRegGeoserverRule(/\/[\w- ]*geoserver[\w- ]*\/|\/[\w- ]*gs[\w- ]*\//);
const {keyBy, values} = require('lodash');

require('react-select/dist/react-select.css');
/**
 * Add custom (overriding) translations with:
 *
 * ConfigUtils.setConfigProp('translationsPath', ['./MapStore2/web/client/translations', './translations']);
 */
ConfigUtils.setConfigProp('themePrefix', 'msgapi');
const Persistence = require("@mapstore/framework/api/persistence");
Persistence.addApi("geonode", require("./api/geonode"));
Persistence.setApi("geonode");

/**
 * Use a custom plugins configuration file with:
 *
 * ConfigUtils.setLocalConfigurationFile('localConfig.json');
 */
// ConfigUtils.setLocalConfigurationFile('MapStore2/web/client/localConfig.json');

/**
 * Use a custom application configuration file with:
 *
 * const appConfig = require('./appConfig');
 *
 * Or override the application configuration file with (e.g. only one page with a mapviewer):
 *
 * const appConfig = assign({}, require('../MapStore2/web/client/product/appConfig'), {
 *     pages: [{
 *         name: "mapviewer",
 *         path: "/",
 *         component: require('../MapStore2/web/client/product/pages/MapViewer')
 *     }]
 * });
 */
// const appConfig = require('../MapStore2/web/client/product/appConfig');


const getScriptPath = function() {
    const scriptEl = document.getElementById('ms2-api');
    return scriptEl && scriptEl.src && scriptEl.src.substring(0, scriptEl.src.lastIndexOf('/')) || '';
};

const translationsPath = __GEONODE_PROJECT_CONFIG__.translationsPath || getScriptPath() + '/../ms-translations';

// Set X-CSRFToken in axios;
const axios = require('@mapstore/framework/libs/ajax');
axios.defaults.xsrfHeaderName = "X-CSRFToken";
axios.defaults.xsrfCookieName = "csrftoken";

const createMapStore2Api = function(plugins) {
    const MapStore2 = require('@mapstore/framework/jsapi/MapStore2').withPlugins(plugins, {
        theme: {
            path: getScriptPath() + '/themes'
        },
        noLocalConfig: true,
        translations: translationsPath
    });
    // window.MapStore2 = MapStore2;
    return assign({}, MapStore2, { create: function(container, opts) {
        if (opts && opts.localConfig) {
            Object.keys(opts.localConfig).map(function(c) {ConfigUtils.setConfigProp(c, opts.localConfig[c]); });
        }
        return MapStore2.create(container, opts);
    }
    });
};
// Can be used to define more compact plugins bundle
window.initMapstore2Api = function(config, resolve) {

    // force supported locales to the selected one
    const setLocale = (localeKey) => {
        const supportedLocales = LocaleUtils.getSupportedLocales();
        const locale = supportedLocales[localeKey]
            ? { [localeKey]: supportedLocales[localeKey] }
            : { en: supportedLocales.en };
        LocaleUtils.setSupportedLocales(locale);
    };

    require(`./components/${maptype}/ArcGisMapServer`);// eslint-disable-line
    if (config === 'preview') {
        require.ensure('./previewPlugins', function() {
            resolve(createMapStore2Api(require('./previewPlugins')), { setLocale });
        });
    } else {
        require.ensure('./plugins', function() {
            resolve(createMapStore2Api(require('./plugins')), { setLocale });
        });
    }
};
const createConfigObj = (cfg = []) => keyBy(cfg, (o) => o.name || o);

window.squashMS2PlugCfg = function(...args) {
    const config = args.reduce((cfg, arg) => {
        return Object.keys(arg).reduce((c, k) => ({ ...c, [k]: assign({}, cfg[k], (createConfigObj(arg[k])) )}), {});
    }, {});
    return Object.keys(config).reduce((c, k) => ({...c, [k]: values(config[k])}), {});
};
window.excludeMS2Plugins = function(config, exclude = []) {
    return Object.keys(config).reduce((c, k) => ({...c, [k]: config[k].filter((p) => {
        const n = p.name || p;
        return exclude.indexOf(n) === -1;
    })}), {});
};
