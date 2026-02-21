import expect from 'expect';

const enData = require('../../../../../static/mapstore/hydrata-translations/data.en-US.json');
const frData = require('../../../../../static/mapstore/hydrata-translations/data.fr-FR.json');
const esData = require('../../../../../static/mapstore/hydrata-translations/data.es-ES.json');
const htData = require('../../../../../static/mapstore/hydrata-translations/data.ht-HT.json');

const LOCALES = ['en-US', 'fr-FR', 'es-ES', 'ht-HT'];
const PLUGINS = ['simpleView', 'swamm', 'anuga', 'hydrology', 'hgeval', 'scenarios', 'swamps'];

const localeData = {
    'en-US': enData,
    'fr-FR': frData,
    'es-ES': esData,
    'ht-HT': htData
};

function flattenKeys(obj, prefix) {
    let keys = [];
    Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    });
    return keys;
}

describe('Hydrata Translation Integrity', () => {
    describe('File structure', () => {
        LOCALES.forEach(locale => {
            it(`data.${locale}.json should parse as valid JSON`, () => {
                expect(localeData[locale]).toExist();
                expect(typeof localeData[locale]).toBe('object');
            });

            it(`data.${locale}.json should have correct locale field`, () => {
                expect(localeData[locale].locale).toBe(locale);
            });

            it(`data.${locale}.json should have messages.hydrata namespace`, () => {
                expect(localeData[locale].messages).toExist();
                expect(localeData[locale].messages.hydrata).toExist();
            });
        });
    });

    describe('Plugin namespaces', () => {
        LOCALES.forEach(locale => {
            it(`data.${locale}.json should have all plugin namespaces`, () => {
                const hydrata = localeData[locale].messages.hydrata;
                PLUGINS.forEach(plugin => {
                    expect(hydrata[plugin]).toExist(`Missing namespace '${plugin}' in ${locale}`);
                });
            });
        });
    });

    describe('Key completeness', () => {
        it('all locales should have the same set of keys as en-US', () => {
            const enKeys = flattenKeys(localeData['en-US'].messages).sort();

            LOCALES.filter(l => l !== 'en-US').forEach(locale => {
                const localeKeys = flattenKeys(localeData[locale].messages).sort();
                const missingKeys = enKeys.filter(k => localeKeys.indexOf(k) === -1);
                const extraKeys = localeKeys.filter(k => enKeys.indexOf(k) === -1);

                expect(missingKeys.length).toBe(0,
                    `${locale} is missing keys: ${missingKeys.join(', ')}`);
                expect(extraKeys.length).toBe(0,
                    `${locale} has extra keys: ${extraKeys.join(', ')}`);
            });
        });
    });

    describe('No empty values', () => {
        LOCALES.forEach(locale => {
            it(`data.${locale}.json should have no empty string values`, () => {
                const keys = flattenKeys(localeData[locale].messages);
                const emptyKeys = [];

                keys.forEach(key => {
                    const parts = key.split('.');
                    let value = localeData[locale].messages;
                    parts.forEach(part => {
                        value = value[part];
                    });
                    if (typeof value === 'string' && value.trim() === '') {
                        emptyKeys.push(key);
                    }
                });

                expect(emptyKeys.length).toBe(0,
                    `${locale} has empty values for: ${emptyKeys.join(', ')}`);
            });
        });
    });

    describe('Key count sanity', () => {
        it('en-US should have at least 250 keys', () => {
            const keys = flattenKeys(localeData['en-US'].messages);
            expect(keys.length).toBeGreaterThanOrEqualTo(250);
        });

        it('each plugin should have at least 1 key', () => {
            PLUGINS.forEach(plugin => {
                const pluginKeys = flattenKeys(localeData['en-US'].messages.hydrata[plugin]);
                expect(pluginKeys.length).toBeGreaterThan(0,
                    `Plugin '${plugin}' has no keys`);
            });
        });
    });
});
