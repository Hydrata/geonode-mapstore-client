/*
 * OpenReplay privacy redaction tests (epic 1511 W3, TASK-1516).
 *
 * These lock in the two CRITICAL token-leak fixes the wave-review surfaced
 * (access_token in tile/API URLs; userDetails token payloads in REFRESH_SUCCESS/
 * SESSION_VALID redux actions) plus the email-as-username guard. The masking is
 * LOAD-BEARING — a silent regression here would ship live tokens to the replay
 * store — so these assertions are deliberately concrete.
 */

import expect from 'expect';
import { scrubUrlCredentials, sanitizeReduxAction, extractUsername } from '../openReplayPrivacy';

describe('openReplayPrivacy', () => {
    describe('scrubUrlCredentials', () => {
        it('redacts the access_token query param on GeoServer/GWC tile URLs', () => {
            const url = '/geoserver/gwc/service/wmts?layer=x&access_token=abc123SECRET&format=image/png';
            const out = scrubUrlCredentials(url);
            expect(out).toBe('/geoserver/gwc/service/wmts?layer=x&access_token=REDACTED&format=image/png');
            expect(out.indexOf('abc123SECRET')).toBe(-1);
        });
        it('redacts access_token when it is the first param', () => {
            expect(scrubUrlCredentials('https://h.com/api?access_token=TT&page=1'))
                .toBe('https://h.com/api?access_token=REDACTED&page=1');
        });
        it('redacts the other credential keys (token, refresh_token, jwt, id_token, code, api_key, apikey)', () => {
            ['token', 'refresh_token', 'jwt', 'id_token', 'code', 'api_key', 'apikey'].forEach((k) => {
                expect(scrubUrlCredentials(`/x?${k}=SECRET`)).toBe(`/x?${k}=REDACTED`);
            });
        });
        it('is case-insensitive on the key', () => {
            expect(scrubUrlCredentials('/x?Access_Token=SECRET')).toBe('/x?Access_Token=REDACTED');
        });
        it('leaves non-credential params untouched', () => {
            const url = '/x?layer=roads&bbox=1,2,3,4&width=256';
            expect(scrubUrlCredentials(url)).toBe(url);
        });
        it('handles urls with no query, empty, null and non-strings', () => {
            expect(scrubUrlCredentials('/x/y/z')).toBe('/x/y/z');
            expect(scrubUrlCredentials('')).toBe('');
            expect(scrubUrlCredentials(null)).toBe(null);
            expect(scrubUrlCredentials(undefined)).toBe(undefined);
        });
    });

    describe('sanitizeReduxAction', () => {
        it('redacts userDetails on REFRESH_SUCCESS (the periodic token-leak action)', () => {
            const action = { type: 'REFRESH_SUCCESS', userDetails: { access_token: 'LIVE', refresh_token: 'RT' } };
            const out = sanitizeReduxAction(action);
            expect(out.userDetails).toBe('[REDACTED]');
            expect(out.type).toBe('REFRESH_SUCCESS');
        });
        it('does not mutate the original action (returns a clone)', () => {
            const action = { type: 'SESSION_VALID', userDetails: { access_token: 'LIVE' } };
            const out = sanitizeReduxAction(action);
            expect(out).toNotBe(action);
            expect(action.userDetails.access_token).toBe('LIVE'); // original intact
        });
        it('redacts top-level credential keys', () => {
            const out = sanitizeReduxAction({ type: 'X', access_token: 'a', refresh_token: 'b', token: 'c', authHeader: 'd', password: 'e', apikey: 'f', api_key: 'g' });
            ['access_token', 'refresh_token', 'token', 'authHeader', 'password', 'apikey', 'api_key'].forEach((k) => {
                expect(out[k]).toBe('[REDACTED]');
            });
        });
        it('returns the SAME reference for an action with nothing sensitive', () => {
            const action = { type: 'MAP_CONFIG_LOADED', config: { a: 1 } };
            expect(sanitizeReduxAction(action)).toBe(action);
        });
        it('handles null / non-object', () => {
            expect(sanitizeReduxAction(null)).toBe(null);
            expect(sanitizeReduxAction(undefined)).toBe(undefined);
            expect(sanitizeReduxAction('x')).toBe('x');
        });
    });

    describe('extractUsername', () => {
        it('returns the username handle', () => {
            expect(extractUsername({ username: 'jdoe' })).toBe('jdoe');
        });
        it('returns "" when the candidate looks like an email (email-as-username guard)', () => {
            expect(extractUsername({ username: 'jdoe@example.com' })).toBe('');
            expect(extractUsername({ name: 'a.b@hydrata.com' })).toBe('');
        });
        it('falls back name -> preferred_username -> info.username', () => {
            expect(extractUsername({ name: 'Jane' })).toBe('Jane');
            expect(extractUsername({ info: { preferred_username: 'jpref' } })).toBe('jpref');
            expect(extractUsername({ info: { username: 'juser' } })).toBe('juser');
        });
        it('returns "" for null / empty user', () => {
            expect(extractUsername(null)).toBe('');
            expect(extractUsername({})).toBe('');
        });
    });
});
