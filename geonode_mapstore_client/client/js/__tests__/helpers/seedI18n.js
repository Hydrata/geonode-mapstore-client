/*
 * Test helper: seedI18n
 *
 * Wraps the `flattenMessages` pattern (a nested locale messages object turned
 * into a flat `{ "a.b.c": value }` map suitable for react-intl's IntlProvider
 * in tests). The logic mirrors js/__tests__/fixtures/translations.js so callers
 * can flatten an arbitrary messages object without re-implementing it.
 *
 * `seedI18n(messages)` flattens a raw nested object.
 * `seedI18n.flattenMessages` is exposed for parity with the fixture's export.
 *
 * No `-test` suffix → excluded from the karma collection glob.
 * Standalone module: depends on nothing.
 */

/**
 * Recursively flatten a nested messages object into dot-delimited keys.
 *
 * @param {object} obj    the nested messages object (e.g. data.messages).
 * @param {string} [prefix] internal recursion prefix.
 * @returns {object} flat map of `dot.delimited.key -> string`.
 */
export function flattenMessages(obj, prefix) {
    const result = {};
    Object.keys(obj || {}).forEach((key) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenMessages(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    });
    return result;
}

/**
 * Load/flatten i18n messages for tests. Accepts either a raw messages object
 * or a locale-data object shaped `{ messages: {...} }` (the data.<locale>.json
 * shape), returning the flattened map either way.
 *
 * @param {object} source nested messages, or `{ messages }`.
 * @returns {object} flattened messages map.
 */
export default function seedI18n(source = {}) {
    const messages = source && source.messages ? source.messages : source;
    return flattenMessages(messages);
}

seedI18n.flattenMessages = flattenMessages;
