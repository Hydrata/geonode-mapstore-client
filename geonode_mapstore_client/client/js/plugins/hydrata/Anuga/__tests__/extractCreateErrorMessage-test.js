/**
 * Regression tests for extractCreateErrorMessage (terrainBboxEpic).
 *
 * The terrain create-from-bbox flow surfaces a BE rejection as a toast. The
 * message string is pulled out of the rejected error by extractCreateErrorMessage.
 * Two things make this subtle and regression-prone:
 *
 *   1. SHAPE OF THE ERROR OBJECT. MapStore's axios response interceptor
 *      (libs/ajax.js) rejects with a SPREAD of the response —
 *      `{ ...error.response, originalError }` — so in the LIVE app the body is
 *      at `err.data`, NOT `err.response.data`, and there is no `err.message`.
 *      An earlier version only read `err.response.data` + `err.message`, so a
 *      real 403 fell through to the 'create failed' fallback and the user saw
 *      no useful reason. These tests pin BOTH the interceptor shape and the
 *      raw-axios shape.
 *
 *   2. SHAPE OF THE BODY. permission/validation guards return the ANUGA wrapper
 *      { success:false, errors:[...], code }, while DRF defaults return
 *      { error_code, detail }. Both must resolve to a clean string.
 */
import expect from 'expect';
import { extractCreateErrorMessage } from '../epics/terrainBboxEpic';

describe('extractCreateErrorMessage', () => {
    const ANUGA_403 = { success: false, errors: ['You do not have access to this project.'], code: 'permission_denied' };

    it('reads the ANUGA errors[] body from the MapStore interceptor shape (err.data)', () => {
        // What the LIVE app actually rejects with: {...error.response, originalError}
        const err = { data: ANUGA_403, status: 403, statusText: 'Forbidden', originalError: new Error('Request failed with status code 403') };
        expect(extractCreateErrorMessage(err)).toBe('You do not have access to this project.');
    });

    it('reads the ANUGA errors[] body from the raw axios shape (err.response.data)', () => {
        const err = { response: { data: ANUGA_403, status: 403 }, message: 'Request failed with status code 403' };
        expect(extractCreateErrorMessage(err)).toBe('You do not have access to this project.');
    });

    it('prefers DRF detail over everything else', () => {
        const err = { data: { error_code: 'bad', detail: 'Bounding box too large.', errors: ['ignored'] } };
        expect(extractCreateErrorMessage(err)).toBe('Bounding box too large.');
    });

    it('falls back to a plain-string body', () => {
        const err = { data: 'CSRF verification failed' };
        expect(extractCreateErrorMessage(err)).toBe('CSRF verification failed');
    });

    it('falls back to the axios message when there is no usable body', () => {
        expect(extractCreateErrorMessage({ message: 'Network Error' })).toBe('Network Error');
    });

    it('falls back to originalError.message for the interceptor shape with no body', () => {
        const err = { status: 0, originalError: { message: 'Network Error' } };
        expect(extractCreateErrorMessage(err)).toBe('Network Error');
    });

    it('returns the generic fallback for an unrecognised error', () => {
        expect(extractCreateErrorMessage({})).toBe('create failed');
        expect(extractCreateErrorMessage(undefined)).toBe('create failed');
    });
});
