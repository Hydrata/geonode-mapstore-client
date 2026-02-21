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

describe('Scenarios i18n', () => {
    it('all scenarios msgIds exist in en-US translation file', () => {
        const scenariosKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.scenarios.'));
        expect(scenariosKeys.length).toBeGreaterThanOrEqualTo(6);
        scenariosKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('button keys exist', () => {
        const buttonKeys = [
            'hydrata.scenarios.select',
            'hydrata.scenarios.save',
            'hydrata.scenarios.run',
            'hydrata.scenarios.delete',
            'hydrata.scenarios.new'
        ];
        buttonKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing button key: ${key}`);
        });
    });

    it('button keys are translated in Spanish', () => {
        const buttonKeys = [
            'hydrata.scenarios.select',
            'hydrata.scenarios.save',
            'hydrata.scenarios.run',
            'hydrata.scenarios.delete',
            'hydrata.scenarios.new'
        ];
        buttonKeys.forEach(key => {
            expect(esMessages[key]).toExist(`Missing Spanish translation for: ${key}`);
            expect(esMessages[key].length).toBeGreaterThan(0);
        });
    });
});
