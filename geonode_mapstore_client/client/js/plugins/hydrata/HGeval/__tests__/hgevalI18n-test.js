import expect from 'expect';

const enData = require('../../../../../../static/mapstore/hydrata-translations/data.en-US.json');
const frData = require('../../../../../../static/mapstore/hydrata-translations/data.fr-FR.json');

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
const frMessages = flattenMessages(frData.messages);

describe('HGeval i18n', () => {
    it('all hgeval msgIds exist in en-US translation file', () => {
        const hgevalKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.hgeval.'));
        expect(hgevalKeys.length).toBeGreaterThan(30);
        hgevalKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('report section keys exist', () => {
        const reportKeys = [
            'hydrata.hgeval.evaluationReport',
            'hydrata.hgeval.groundwaterAssessment',
            'hydrata.hgeval.hydrogeologicalEnvironment',
            'hydrata.hgeval.geology',
            'hydrata.hgeval.landform',
            'hydrata.hgeval.elevation',
            'hydrata.hgeval.rainfall',
            'hydrata.hgeval.permeability',
            'hydrata.hgeval.aquiferType',
            'hydrata.hgeval.groundwaterPotential'
        ];
        reportKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing report key: ${key}`);
        });
    });

    it('form labels are translated in French', () => {
        const formKeys = [
            'hydrata.hgeval.generateReport',
            'hydrata.hgeval.cancel',
            'hydrata.hgeval.back',
            'hydrata.hgeval.download',
            'hydrata.hgeval.saveAndDownload',
            'hydrata.hgeval.newEvaluation'
        ];
        formKeys.forEach(key => {
            expect(frMessages[key]).toExist(`Missing French translation for: ${key}`);
            expect(frMessages[key].length).toBeGreaterThan(0);
        });
    });

    it('disclaimer text exists in all locales', () => {
        expect(enMessages['hydrata.hgeval.disclaimerText']).toExist();
        expect(enMessages['hydrata.hgeval.disclaimerText'].length).toBeGreaterThan(50);
        expect(frMessages['hydrata.hgeval.disclaimerText']).toExist();
        expect(frMessages['hydrata.hgeval.disclaimerText'].length).toBeGreaterThan(50);
    });
});
