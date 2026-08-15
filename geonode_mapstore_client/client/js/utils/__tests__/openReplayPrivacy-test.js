/*
 * OpenReplay privacy redaction tests (epic 1511 W3, TASK-1516).
 *
 * These lock in the two CRITICAL token-leak fixes the wave-review surfaced
 * (access_token in tile/API URLs; userDetails token payloads in REFRESH_SUCCESS/
 * SESSION_VALID redux actions). The masking is LOAD-BEARING — a silent
 * regression here would ship live tokens to the replay store — so these
 * assertions are deliberately concrete. (The 1511-era email-as-username drop
 * was removed by TASK-2376: the username IS the identity key, emails included.)
 */

import expect from 'expect';
import { scrubUrlCredentials, sanitizeReduxAction, extractUsername, resolveOpenReplayUserId, stripHeavyStateForReplay } from '../openReplayPrivacy';

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
        it('passes email-shaped usernames through unchanged (TASK-2376 — most real users have email-as-username)', () => {
            expect(extractUsername({ username: 'jdoe@example.com' })).toBe('jdoe@example.com');
            expect(extractUsername({ name: 'a.b@hydrata.com' })).toBe('a.b@hydrata.com');
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

    // TASK-2129 W3 (F1): the setUserID decision — stamp once, on a non-anon,
    // non-PII user. Guards the anon-then-login case (session starts anonymous on
    // the homepage/login page, then a later login must stamp the userID so the
    // run->replay linkage can find the session by username).
    describe('resolveOpenReplayUserId', () => {
        it('returns the username on the first authenticated user', () => {
            expect(resolveOpenReplayUserId({ username: 'jdoe' }, false)).toBe('jdoe');
        });
        it('returns "" once already stamped (idempotent — set userID once)', () => {
            expect(resolveOpenReplayUserId({ username: 'jdoe' }, true)).toBe('');
        });
        it('returns "" while the user is still anonymous', () => {
            expect(resolveOpenReplayUserId(null, false)).toBe('');
            expect(resolveOpenReplayUserId({}, false)).toBe('');
        });
        it('stamps an email-shaped username as the userID (TASK-2376)', () => {
            expect(resolveOpenReplayUserId({ username: 'jdoe@example.com' }, false)).toBe('jdoe@example.com');
        });
    });

    // TASK-2794: the prod renderer OOM. tracker-redux structured-clones the FULL
    // redux state (and each action) into its encoder worker per captured action,
    // then string-encodes every element of every array. On a playback map the
    // state carries ~150 MB of mesh Float32/Int32Arrays plus uint16 chunk cache
    // — the clone+encode is the fatal allocation (2/2 local repro on the prod
    // bundle with the tracker enabled; 5/5 survival without). Large binary
    // payloads must therefore NEVER reach the middleware.
    describe('heavy binary stripping (TASK-2794)', () => {
        it('sanitizeReduxAction replaces a large typed array in an action payload with a descriptor string', () => {
            const nodeX = new Float32Array(100000); // 400 KB, over the 64 KiB threshold
            const action = { type: 'PLAYBACK:MESH_LOADED', mesh: { nodeX, label: 'm' } };
            const out = sanitizeReduxAction(action);
            expect(typeof out.mesh.nodeX).toBe('string');
            expect(out.mesh.nodeX.indexOf('Float32Array')).toNotBe(-1);
            expect(out.mesh.nodeX.indexOf('100000')).toNotBe(-1);
            expect(out.mesh.label).toBe('m');
            // never mutates the input
            expect(action.mesh.nodeX).toBe(nodeX);
        });
        it('sanitizeReduxAction replaces a large raw ArrayBuffer with a descriptor string', () => {
            const buf = new ArrayBuffer(1048576);
            const out = sanitizeReduxAction({ type: 'X', payload: { buf } });
            expect(typeof out.payload.buf).toBe('string');
            expect(out.payload.buf.indexOf('ArrayBuffer')).toNotBe(-1);
        });
        it('sanitizeReduxAction passes small typed arrays through by reference (colormaps etc.)', () => {
            const lut = new Uint8Array(64);
            const action = { type: 'X', lut };
            expect(sanitizeReduxAction(action)).toBe(action);
        });
        it('stripHeavyStateForReplay replaces any top-level slice carrying a large typed array and keeps light slices by reference', () => {
            const state = {
                anugaPlayback: { status: 'ready', mesh: { nodeX: new Float32Array(100000) } },
                map: { zoom: 5 }
            };
            const out = stripHeavyStateForReplay(state);
            expect(typeof out.anugaPlayback).toBe('string');
            expect(out.anugaPlayback.indexOf('anugaPlayback')).toNotBe(-1);
            expect(out.map).toBe(state.map);
            // never mutates the input
            expect(state.anugaPlayback.mesh.nodeX.length).toBe(100000);
        });
        it('stripHeavyStateForReplay finds large arrays held inside a Map', () => {
            const cache = new Map();
            cache.set('depth/0', new Uint16Array(3393075));
            const out = stripHeavyStateForReplay({ pb: { cache }, other: { a: 1 } });
            expect(typeof out.pb).toBe('string');
            expect(out.other.a).toBe(1);
        });
        it('stripHeavyStateForReplay returns the same reference for an all-light state', () => {
            const state = { a: { b: 1 }, c: [1, 2, 3] };
            expect(stripHeavyStateForReplay(state)).toBe(state);
        });
    });
});
