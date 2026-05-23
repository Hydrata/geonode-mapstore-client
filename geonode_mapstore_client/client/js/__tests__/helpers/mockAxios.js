/*
 * Test helper: mockAxios
 *
 * Wraps axios-mock-adapter's MockAdapter against the MapStore2 `libs/ajax`
 * axios instance (NOT bare axios — every Hydrata API call goes through that
 * instance, so mocking bare axios would not intercept anything). Registers an
 * `afterEach` hook that auto-restores the adapter, removing the boilerplate
 * `afterEach(() => mockAxios.restore())` repeated across ~13 test files.
 *
 * Usage (inside a describe block):
 *   let mock;
 *   beforeEach(() => { mock = mockAxios(); });
 *   it('...', () => { mock.onGet('/foo').reply(200, {}); ... });
 *
 * No `-test` suffix → excluded from the karma collection glob.
 * Standalone module: imports only axios-mock-adapter + the ajax instance.
 */
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../MapStore2/web/client/libs/ajax';

/**
 * Create a MockAdapter bound to the shared ajax instance and schedule its
 * automatic restore via `afterEach`.
 *
 * @param {object} [options] forwarded to the MockAdapter constructor
 *                           (e.g. `{ delayResponse: 50 }`).
 * @returns {MockAdapter} the live adapter; configure with `.onGet()` etc.
 */
export default function mockAxios(options) {
    const adapter = new MockAdapter(axios.default || axios, options);
    if (typeof afterEach === 'function') {
        afterEach(() => adapter.restore());
    }
    return adapter;
}
