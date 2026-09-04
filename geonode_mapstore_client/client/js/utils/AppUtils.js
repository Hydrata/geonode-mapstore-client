/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    setConfigProp,
    getConfigProp,
    setLocalConfigurationFile
} from '@mapstore/framework/utils/ConfigUtils';
import {
    getSupportedLocales,
    setSupportedLocales
} from '@mapstore/framework/utils/LocaleUtils';
import { getState, getStore } from '@mapstore/framework/utils/StateUtils';
import { userSelector } from '@mapstore/framework/selectors/security';
import { error as errorNotification } from '@mapstore/framework/actions/notifications';
import { generateActionTrigger } from '@mapstore/framework/epics/jsapi';
import { LOCATION_CHANGE } from 'connected-react-router';
import { setRegGeoserverRule } from '@mapstore/framework/utils/LayersUtils';
import { mapSelector } from '@mapstore/framework/selectors/map';

import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';

import url from 'url';
import axios from '@mapstore/framework/libs/ajax';
import moment from 'moment';
import { addLocaleData } from 'react-intl';
import { setViewer } from '@mapstore/framework/utils/MapInfoUtils';

// we need this configuration set for specific components that use recompose/rxjs streams
import { setObservableConfig } from 'recompose';
import rxjsConfig from 'recompose/rxjsObservableConfig';
import { getGeoNodeConfig, getGeoNodeLocalConfig } from "@js/utils/APIUtils";
import { bootstrapAuthkeyWarmup, shouldAwaitAuthkeyWarmup } from "@js/utils/AuthkeyWarmupProbe";
setObservableConfig(rxjsConfig);

let actionListeners = {};
// Target url here to fix proxy issue
let targetURL = '';
const getTargetUrl = () => {
    if (!__DEVTOOLS__) {
        return '';
    }
    if (targetURL) {
        return targetURL;
    }
    const geonodeUrl = getConfigProp('geoNodeSettings')?.geonodeUrl || '';
    if (!geonodeUrl) {
        return '';
    }
    const { host, protocol } = url.parse(geonodeUrl);
    targetURL = `${protocol}//${host}/`;
    return targetURL;
};

export function getVersion() {
    if (!__DEVTOOLS__) {
        return __MAPSTORE_PROJECT_CONFIG__.version;
    }
    return 'dev';
}

// TASK-1587 W1.9 / TASK-1801: global session-expiry guard.
//
// When a LOGGED-IN user's session lapses (e.g. an overnight tab), every API
// call starts returning 401 with user_id=None. The FE had no global handler,
// so a terrain "combine" (and any other call) failed silently while the app
// kept polling 401s forever with no sign the user had been logged out.
//
// This is an axios RESPONSE interceptor rejection handler. It must NOT hijack
// the EXPECTED anonymous-user 401s — anonymous visitors get 401 on protected
// project endpoints BY DESIGN (the TASK-1700 paywall). The discriminator is
// "is there a currently-authenticated user in security state?": if there is no
// user, a 401 is expected and we pass it through byte-equivalent to today.
//
// Login is triggered with the app's existing mechanism: a redirect to
// /account/login/?next=<current-location> (same pattern as Router.jsx and
// gnresource.js), so the user lands back where they were after re-auth.

// Endpoints we must never treat as a session-expiry 401, to avoid redirect
// loops (a 401 from the login/token/refresh flow itself is part of normal auth
// negotiation, not a lapsed session).
const AUTH_ENDPOINT_RE = /(\/account\/login|\/o\/token|\/o\/authorize|\/api\/o\/|\/refresh|\/account\/logout)/;

// Debounce flag so a burst of parallel 401s (the terrain poller fires several
// at once) shows ONE prompt + ONE redirect, not dozens. Module-level: the
// first 401 wins and latches; the page is navigating away anyway.
let sessionExpiryHandled = false;

// Reset hook for tests only — the latch is intentionally sticky in production.
export function _resetSessionExpiryLatch() {
    sessionExpiryHandled = false;
}

/**
 * Rejection handler for the global axios response interceptor.
 *
 * Dependencies are injected so the handler can be driven in isolation by a
 * karma test without bootstrapping the whole app (mock the user accessor, the
 * dispatch, and the redirect). In production initializeApp wires the real
 * MapStore singletons.
 *
 * @param {object} error the axios rejection (raw `{response:{status}}` or the
 *   MapStore-reshaped `{...response, originalError}` — we read both shapes,
 *   matching js/epics/gnresource.js).
 * @param {object} deps
 * @param {function} deps.getUser  returns the current security user (falsy = anonymous)
 * @param {function} deps.dispatch redux dispatch for the user-visible notification
 * @param {function} deps.redirect navigates the browser to the login URL
 * @returns {Promise} always a rejected promise with the ORIGINAL error, so
 *   existing per-call error handling is unchanged.
 */
export function handleApiError(error, { getUser, dispatch, redirect } = {}) {
    // Read status defensively from both error shapes (see gnresource.js:239).
    const status = error?.response?.status ?? error?.status;
    // Scope strictly to 401. Leave 403 (and everything else) alone.
    if (status !== 401) {
        return Promise.reject(error);
    }
    // Never act on the auth flow itself, or we loop the login redirect.
    const requestUrl = error?.config?.url || error?.response?.config?.url || '';
    if (AUTH_ENDPOINT_RE.test(requestUrl)) {
        return Promise.reject(error);
    }
    // The crux: only a LOGGED-IN user hitting a 401 is a lapsed session.
    // Anonymous (no user) 401s are the expected paywall — pass through
    // byte-equivalent to pre-TASK-1801 behaviour.
    const user = typeof getUser === 'function' ? getUser() : undefined;
    if (!user) {
        return Promise.reject(error);
    }
    // Authenticated user + 401 = session expired. Debounce: first one latches.
    if (!sessionExpiryHandled) {
        sessionExpiryHandled = true;
        if (typeof dispatch === 'function') {
            dispatch(errorNotification({
                title: 'Session expired',
                message: 'Your session has expired — please log in again.',
                autoDismiss: 0,
                position: 'tc'
            }));
        }
        if (typeof redirect === 'function') {
            const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            redirect(`/account/login/?next=${encodeURIComponent(nextUrl)}`);
        }
    }
    // Always still reject with the original error so existing per-call error
    // handling (epics, catch blocks) is completely unchanged.
    return Promise.reject(error);
}

export function initializeApp() {

    // Set X-CSRFToken in axios;
    axios.defaults.xsrfHeaderName = "X-CSRFToken";
    axios.defaults.xsrfCookieName = "csrftoken";

    setLocalConfigurationFile('');
    setRegGeoserverRule(/\/[\w- ]*geoserver[\w- ]*\/|\/[\w- ]*gs[\w- ]*\//);
    const pathsNeedVersion = [
        'static/mapstore/',
        'print.json'
    ];
    axios.interceptors.request.use(
        config => {
            if (config.url && pathsNeedVersion.filter(pathNeedVersion => config.url.match(pathNeedVersion))[0]) {
                return {
                    ...config,
                    params: {
                        ...config.params,
                        v: getVersion()
                    }
                };
            }
            const tUrl = getTargetUrl();
            if (tUrl && config.url?.match(tUrl)?.[0]) {
                return {
                    ...config,
                    url: `/${config.url.replace(tUrl, '')}`
                };
            }
            return config;
        }
    );
    // TASK-1587 W1.9 / TASK-1801: global session-expiry guard. Wires the real
    // MapStore singletons into handleApiError (see its docblock above). Reads
    // the user from security state; dispatches via the persisted store;
    // redirects with window.location. Pass-through for anonymous 401s.
    axios.interceptors.response.use(
        response => response,
        error => handleApiError(error, {
            getUser: () => userSelector(getState()),
            dispatch: (action) => getStore()?.dispatch?.(action),
            redirect: (loginUrl) => { window.location.href = loginUrl; }
        })
    );
    // Set proxy and authentication from geonode config
    ['proxyUrl', 'useAuthenticationRules', 'authenticationRules'].forEach(key=> {
        setConfigProp(key, getGeoNodeLocalConfig(key));
    });
}

export function getPluginsConfiguration(pluginsConfig, key) {
    if (isArray(pluginsConfig)) {
        return pluginsConfig;
    }
    if (isObject(pluginsConfig)) {
        const pluginsConfigSection = pluginsConfig[key];
        if (pluginsConfigSection) {
            // use string to link duplicated configurations
            return isString(pluginsConfigSection)
                ? pluginsConfig[pluginsConfigSection]
                : pluginsConfigSection;
        }
        return pluginsConfig;
    }
    return [];
}

function getLanguageKey(languageCode) {
    const parts = languageCode.split('-');
    return parts[0];
}

function parseLanguageCode(languageCode) {
    const parts = languageCode.split('-');
    if (parts.length === 1) {
        return parts[0].toLowerCase();
    }
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

function languagesToSupportedLocales(languages) {
    if (!languages || languages.length === 0) {
        return null;
    }
    return languages.reduce((acc, [code, description]) => ({
        ...acc,
        [getLanguageKey(code)]: {
            code: parseLanguageCode(code),
            description
        }
    }), {});
}

// Map of locales missing from react-intl to their closest fallback
const localeDataFallbacks = {
    'ht': 'fr' // Haitian Creole falls back to French for number/date formatting
};

function setupLocale(locale) {
    const localeDataKey = localeDataFallbacks[locale] || locale;
    return import(`react-intl/locale-data/${localeDataKey}`)
        .then((localeDataMod) => {
            const localeData = localeDataMod.default;
            addLocaleData([...localeData]);
            // setup locale for moment (use fallback if moment also lacks the locale)
            moment.locale(locale);
            if (!moment.locale() || moment.locale() !== locale) {
                moment.locale(localeDataKey);
            }
            return locale;
        })
        .catch(() => {
            // If locale data is unavailable, fall back to English
            return import('react-intl/locale-data/en')
                .then((localeDataMod) => {
                    addLocaleData([...localeDataMod.default]);
                    moment.locale('en');
                    return locale;
                });
        });
}

let apiPluginsConfig;

export function setupConfiguration({
    localConfig,
    user,
    resourcesTotalCount
}) {
    const { query } = url.parse(window.location.href, true);
    // set the extensions path before get the localConfig
    // so it's possible to override in a custom project.
    //
    // TASK-673 D1.8 (B5 S1): pre-resolve the language code into the URL so we
    // skip Django's LocaleMiddleware 302 -> /en-us/client/extensions on every
    // cold load. Saved ~1.9s on the cold critical path (B1 #4, 2026-05-05;
    // 1559ms 302 + 307ms target = 1866ms × 10/10 trials). Falls back to the
    // unprefixed path when languageCode isn't exposed (older _geonode_config).
    const __geoNodeConfig = (typeof window !== 'undefined' && window.__GEONODE_CONFIG__) || {};
    const __langCode = (__geoNodeConfig.languageCode || '').replace('_', '-').toLowerCase();
    const __extensionsPath = __langCode
        ? `/${__langCode}/client/extensions`
        : '/client/extensions';
    setConfigProp('extensionsRegistry', __extensionsPath);
    const {
        supportedLocales: defaultSupportedLocales,
        ...config
    } = localConfig;
    const geoNodePageConfig = getGeoNodeConfig();
    Object.keys(config).forEach((key) => {
        setConfigProp(key, config[key]);
    });
    setConfigProp('translationsPath', geoNodePageConfig.translationsPath
        ? geoNodePageConfig.translationsPath
        : config.translationsPath
            ? config.translationsPath
            : ['/static/mapstore/ms-translations', '/static/mapstore/gn-translations', '/static/mapstore/hydrata-translations']
    );
    const supportedLocales = languagesToSupportedLocales(geoNodePageConfig.languages) || defaultSupportedLocales || getSupportedLocales();
    setSupportedLocales(supportedLocales);
    const locale = supportedLocales[getLanguageKey(geoNodePageConfig.languageCode)]?.code || 'en-US';
    setConfigProp('locale', locale);
    const geoNodeResourcesInfo = getConfigProp('geoNodeResourcesInfo') || {};
    setConfigProp('geoNodeResourcesInfo', { ...geoNodeResourcesInfo, ...resourcesTotalCount });
    const securityState = user?.info?.access_token
        ? {
            security: {
                user: user,
                token: user.info.access_token
            }
        }
        : undefined;

    // TASK-2659: warm GeoServer's authkey token->user cache BEFORE any OL tile
    // source can mount, so a post-idle map open doesn't pay the cold-auth path
    // on ~130 concurrent tile requests (the 15-20s "cold tiles" stampede).
    // Fired here for EVERY authenticated page (starts the keepalive, so an SPA
    // hop into a map minutes later is warm) but AWAITED at the tail only on
    // map-destined pages — homepage/search/document boots must not pay a
    // cold-auth wait for tiles they will never request. Fail-open and bounded
    // by its internal timeout, so it can never block boot.
    const authkeyWarmup = bootstrapAuthkeyWarmup(user?.info?.access_token);
    const awaitAuthkeyWarmup = shouldAwaitAuthkeyWarmup({
        hash: window.location.hash,
        pathname: window.location.pathname
    });

    // globlal window interface to interact with the django page
    const actionTrigger = generateActionTrigger(LOCATION_CHANGE);
    // similar implementation of MapStore2 API without the create part
    /**
     * @global
     * @property {function} getMapState return the map state if available
     * @property {function} triggerAction dispatch an action
     * @property {function} onAction add listener to an action
     * @property {function} offAction remove listener to an action
     * @example
     * <!--
     * access to mapstore api
     * -->
     * <script>
     *  window.addEventListener('mapstore:ready', function(event) {
     *      const msAPI = event.detail;
     *  });
     * </script>
     *
     * @example
     * <!--
     * use mapstore api onAction method to listen to an action
     * this example works only in a page with the map plugin (eg. dataset and map viewers)
     * -->
     * <script>
     *  window.addEventListener('mapstore:ready', function(event) {
     *      const msAPI = event.detail;
     *      function onChangeMapView(action) {
     *          // read parameters dispatched by the action
     *          const center = action.center;
     *          console.log(center);
     *          // get all the current stored map state
     *          const currentMapState = msAPI.getMapState();
     *          console.log(currentMapState);
     *      }
     *      // listen on map view changes
     *      msAPI.onAction('CHANGE_MAP_VIEW', onChangeMapView);
     *  });
     * </script>
     *
     * @example
     * <!--
     * use mapstore api offAction method to listen to an action only once
     * this example works only in a page with the map plugin (eg. dataset and map viewers)
     * -->
     * <script>
     *  window.addEventListener('mapstore:ready', function(event) {
     *      const msAPI = event.detail;
     *      function onChangeMapView(action) {
     *          // read parameters dispatched by the action
     *          const center = action.center;
     *          console.log(center);
     *          // ...
     *          // remove the same action
     *          msAPI.offAction('CHANGE_MAP_VIEW', onChangeMapView);
     *      }
     *      // listen on map view changes
     *      msAPI.onAction('CHANGE_MAP_VIEW', onChangeMapView);
     *  });
     * </script>
     *
     * @example
     * <!--
     * use mapstore api triggerAction method to dispatch an action
     * this example works only in a page with the map plugin (eg. dataset and map viewers)
     * -->
     * <button id="custom-zoom-button">Zoom to extent</button>
     * <script>
     *  window.addEventListener('mapstore:ready', function(event) {
     *      const msAPI = event.detail;
     *      const button = document.querySelector('#custom-zoom-button');
     *      button.addEventListener('click', function() {
     *          msAPI.triggerAction({
     *              type: 'ZOOM_TO_EXTENT',
     *              crs: 'EPSG:4326',
     *              extent: {
     *                  minx: -10,
     *                  miny: -10,
     *                  maxx: 10,
     *                  maxy: 10
     *              }
     *          });
     *      });
     *  });
     * </script>
     */
    window.MapStoreAPI = {
        ready: true,
        getMapState: function() {
            return mapSelector(getState());
        },
        triggerAction: actionTrigger.trigger,
        onAction: (type, listener) => {
            const listeners = actionListeners[type] || [];
            listeners.push(listener);
            actionListeners[type] = listeners;
        },
        offAction: (type, listener) => {
            const listeners = (actionListeners[type] || [])
                .filter((l) => l !== listener);
            actionListeners[type] = listeners;
        },
        setGetFeatureInfoViewer: setViewer,
        setPluginsConfig: (pluginsConfig) => { apiPluginsConfig = isFunction(pluginsConfig) ? pluginsConfig(localConfig) : pluginsConfig; }
    };
    const mapstoreReady = new CustomEvent('mapstore:ready', {
        detail: window.MapStoreAPI
    });
    window.dispatchEvent(mapstoreReady);
    if (window.onInitMapStoreAPI) {
        window.onInitMapStoreAPI(window.MapStoreAPI, geoNodePageConfig);
    }

    return setupLocale(getLanguageKey(geoNodePageConfig.languageCode))
        .then(() => (awaitAuthkeyWarmup ? authkeyWarmup : undefined))
        .then(() => ({
            query,
            securityState,
            geoNodeConfiguration: localConfig.geoNodeConfiguration,
            geoNodePageConfig,
            pluginsConfigKey: query.config || geoNodePageConfig.pluginsConfigKey,
            mapType: geoNodePageConfig.mapType,
            settings: localConfig.geoNodeSettings,
            MapStoreAPI: window.MapStoreAPI,
            onStoreInit: (store) => {
                store.addActionListener((action) => {
                    const act = action.type === 'PERFORM_ACTION' && action.action || action; // Needed to works also in debug
                    (actionListeners[act.type] || [])
                        .concat(actionListeners['*'] || [])
                        .forEach((listener) => {
                            listener.call(null, act);
                        });
                });
            },
            configEpics: {
                gnMapStoreApiEpic: actionTrigger.epic
            }
        }));
}

export const getPluginsConfigOverride = (pluginsConfig) => isFunction(apiPluginsConfig)
    ? apiPluginsConfig(pluginsConfig)
    : isObject(apiPluginsConfig)
        ? apiPluginsConfig
        : pluginsConfig;

/* this function adds plugin based on the current query, used mainly for embed pages*/
export const addQueryPlugins = (pluginsConfig, query) => {
    if (isArray(pluginsConfig)) {
        return [
            ...(query?.allowFullscreen === 'true'
                ? [{
                    mandatory: true, // needed for custom viewers
                    name: 'FullScreen',
                    cfg: {
                        showText: true
                    }
                },
                {
                    mandatory: true, // needed for custom viewers
                    name: 'ActionNavbar',
                    cfg: {
                        containerPosition: 'footer',
                        variant: 'default',
                        leftMenuItems: [{
                            type: 'placeholder'
                        }],
                        rightMenuItems: [
                            {
                                type: 'plugin',
                                name: 'FullScreen',
                                size: 'xs'
                            }
                        ]
                    }
                }] : []),
            ...pluginsConfig
        ];
    }
    return pluginsConfig;
};
