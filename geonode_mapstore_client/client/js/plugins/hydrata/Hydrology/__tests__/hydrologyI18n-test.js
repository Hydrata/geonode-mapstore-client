import expect from 'expect';

const enData = require('../../../../../../static/mapstore/hydrata-translations/data.en-US.json');
const esData = require('../../../../../../static/mapstore/hydrata-translations/data.es-ES.json');

function flattenMessages(obj, prefix) {
    let result = {};
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
const esMessages = flattenMessages(esData.messages);

describe('Hydrology i18n', () => {
    it('all hydrology msgIds exist in en-US translation file', () => {
        const hydrologyKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.hydrology.'));
        expect(hydrologyKeys.length).toBeGreaterThan(20);
        hydrologyKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('notification msgIds from epicsHydrology exist in translations', () => {
        const epicMsgIds = [
            'hydrata.hydrology.success',
            'hydrata.hydrology.error'
        ];
        epicMsgIds.forEach(msgId => {
            expect(enMessages[msgId]).toExist(`Missing epic msgId: ${msgId}`);
        });
    });

    it('ARI period keys exist', () => {
        const ariKeys = [
            'hydrata.hydrology.ari05yr',
            'hydrata.hydrology.ari1yr',
            'hydrata.hydrology.ari2yr',
            'hydrata.hydrology.ari5yr',
            'hydrata.hydrology.ari10yr',
            'hydrata.hydrology.ari20yr',
            'hydrata.hydrology.ari50yr',
            'hydrata.hydrology.ari100yr',
            'hydrata.hydrology.ari500yr'
        ];
        ariKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing ARI key: ${key}`);
        });
    });

    it('menu navigation keys are translated in Spanish', () => {
        const navKeys = [
            'hydrata.hydrology.hydrology',
            'hydrata.hydrology.idfTables',
            'hydrata.hydrology.temporalPatterns',
            'hydrata.hydrology.timeseries',
            'hydrata.hydrology.inflows'
        ];
        navKeys.forEach(key => {
            expect(esMessages[key]).toExist(`Missing Spanish translation for: ${key}`);
            expect(esMessages[key].length).toBeGreaterThan(0);
        });
    });
});
