import expect from 'expect';

const { enMessages, frData, esData, htData, flattenMessages } = require('../../../../__tests__/fixtures/translations');

describe('Swamm i18n', () => {
    it('all swamm msgIds exist in en-US translation file', () => {
        const swammKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.swamm.'));
        expect(swammKeys.length).toBeGreaterThan(50);
        swammKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('notification msgIds from epicsSwamm exist in translations', () => {
        const epicMsgIds = [
            'hydrata.swamm.bmpLayersAdded',
            'hydrata.swamm.layersAdded'
        ];
        epicMsgIds.forEach(msgId => {
            expect(enMessages[msgId]).toExist(`Missing epic msgId: ${msgId}`);
        });
    });

    it('swamm keys should be same in en-US across all locales (English-only site)', () => {
        const locales = { 'fr-FR': frData, 'es-ES': esData, 'ht-HT': htData };
        Object.keys(locales).forEach(locale => {
            const localeMessages = flattenMessages(locales[locale].messages);
            const swammKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.swamm.'));
            swammKeys.forEach(key => {
                expect(localeMessages[key]).toBe(enMessages[key],
                    `Swamm key '${key}' should be English in ${locale} (got: "${localeMessages[key]}")`);
            });
        });
    });

    it('key form labels exist', () => {
        const requiredKeys = [
            'hydrata.swamm.bmpType',
            'hydrata.swamm.bmpStatus',
            'hydrata.swamm.bmpPriority',
            'hydrata.swamm.organization',
            'hydrata.swamm.description',
            'hydrata.swamm.notes',
            'hydrata.swamm.footprint',
            'hydrata.swamm.watershed',
            'hydrata.swamm.outletPoint'
        ];
        requiredKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing required key: ${key}`);
        });
    });
});
