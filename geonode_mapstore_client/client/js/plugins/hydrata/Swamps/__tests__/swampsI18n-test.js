import expect from 'expect';

const { enMessages } = require('../../../../__tests__/fixtures/translations');

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
