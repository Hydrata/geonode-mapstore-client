import expect from 'expect';

const enData = require('../../../../../../static/mapstore/hydrata-translations/data.en-US.json');

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

describe('Swamps i18n', () => {
    it('swamps msgIds exist in en-US translation file', () => {
        const swampsKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.swamps.'));
        expect(swampsKeys.length).toBeGreaterThanOrEqualTo(1);
        swampsKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('refreshMonitoringData key exists', () => {
        expect(enMessages['hydrata.swamps.refreshMonitoringData']).toBe('Refresh Monitoring Data');
    });
});
