import expect from 'expect';

const { enMessages, esMessages, frMessages, htMessages } = require('../../../../__tests__/fixtures/translations');

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

    // TASK-934 — IDF Derive panel translation keys parity across all 4 locales.
    it('IDF Derive keys exist in all 4 locales (en/es/fr/ht)', () => {
        const idfDeriveKeys = [
            'hydrata.hydrology.idfDerive',
            'hydrata.hydrology.idfDeriveLat',
            'hydrata.hydrology.idfDeriveLon',
            'hydrata.hydrology.idfDerivePickOnMap',
            'hydrata.hydrology.idfDeriveDurations',
            'hydrata.hydrology.idfDeriveRPs',
            'hydrata.hydrology.idfDeriveDeriveButton',
            'hydrata.hydrology.idfDeriveSubDailyBanner',
            'hydrata.hydrology.idfDeriveUnavailable',
            'hydrata.hydrology.idfDeriveDownloadJson',
            'hydrata.hydrology.idfDeriveDownloadCsv',
            'hydrata.hydrology.idfDeriveProvenance'
        ];
        [['en', enMessages], ['es', esMessages], ['fr', frMessages], ['ht', htMessages]].forEach(([locale, msgs]) => {
            idfDeriveKeys.forEach(key => {
                expect(msgs[key]).toExist(`Missing ${locale} translation for: ${key}`);
                expect(msgs[key].length).toBeGreaterThan(0);
            });
        });
    });
});
