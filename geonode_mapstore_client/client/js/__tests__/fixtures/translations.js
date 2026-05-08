/**
 * Shared translation fixtures for *I18n-test.js suites.
 *
 * Each test file used to require `data.<locale>.json` (~225 KB each)
 * independently; webpack parsed them up to 8 times. This module loads each
 * once.
 *
 * Filename intentionally lacks the `-test.js` suffix so it does not match
 * the `js/**\/*-test.jsx?` glob in @mapstore/project tests-travis.webpack.js.
 *
 * Relative path note: the static/ dir is at geonode_mapstore_client/static/,
 * NOT under client/, so we need 4 `../` to climb from
 * client/js/__tests__/fixtures/ up to geonode_mapstore_client/.
 */
const enData = require('../../../../static/mapstore/hydrata-translations/data.en-US.json');
const frData = require('../../../../static/mapstore/hydrata-translations/data.fr-FR.json');
const esData = require('../../../../static/mapstore/hydrata-translations/data.es-ES.json');
const htData = require('../../../../static/mapstore/hydrata-translations/data.ht-HT.json');

function flattenMessages(obj, prefix) {
    const result = {};
    Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenMessages(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    });
    return result;
}

const enMessages = flattenMessages(enData.messages);
const frMessages = flattenMessages(frData.messages);
const esMessages = flattenMessages(esData.messages);
const htMessages = flattenMessages(htData.messages);

module.exports = {
    enData, frData, esData, htData,
    enMessages, frMessages, esMessages, htMessages,
    flattenMessages
};
