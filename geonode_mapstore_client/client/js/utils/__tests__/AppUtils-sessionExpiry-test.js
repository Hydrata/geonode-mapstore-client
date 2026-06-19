/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { handleApiError, _resetSessionExpiryLatch } from '../AppUtils';

// TASK-1587 W1.9 / TASK-1801 — global session-expiry guard.
//
// These tests drive the interceptor's rejection handler (handleApiError) in
// isolation: the store/user accessor, dispatch and redirect are injected as
// plain spies, so NOTHING bootstraps the app. The two load-bearing cases:
//   (a) authenticated user + 401 -> ONE re-login (debounced), error rejected;
//   (b) anonymous (no user)   + 401 -> pass-through, NO re-login, error rejected.
describe('AppUtils handleApiError (session-expiry guard)', () => {

    beforeEach(() => {
        // The production latch is intentionally sticky; reset it per test.
        _resetSessionExpiryLatch();
    });

    const make401 = (extra = {}) => ({
        response: { status: 401 },
        config: { url: '/api/v2/anuga/projects/123/analysis-surfaces/' },
        ...extra
    });

    const spies = () => {
        const calls = { dispatch: [], redirect: [] };
        return {
            calls,
            dispatch: (action) => calls.dispatch.push(action),
            redirect: (loginUrl) => calls.redirect.push(loginUrl)
        };
    };

    it('(a) authenticated user + 401 -> triggers re-login exactly once and still rejects', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => ({ name: 'alice', id: 7 }), dispatch, redirect };

        handleApiError(make401(), deps)
            .then(() => done(new Error('expected the promise to reject')))
            .catch((err) => {
                // error is rejected UNCHANGED (original error object).
                expect(err?.response?.status).toBe(401);
                // exactly one user-visible notification...
                expect(calls.dispatch.length).toBe(1);
                expect(calls.dispatch[0].type).toBe('SHOW_NOTIFICATION');
                expect(calls.dispatch[0].level).toBe('error');
                expect(calls.dispatch[0].message).toBe('Your session has expired — please log in again.');
                // ...and exactly one redirect to the login URL, preserving location.
                expect(calls.redirect.length).toBe(1);
                expect(calls.redirect[0]).toContain('/account/login/?next=');
                done();
            })
            .catch(done);
    });

    it('(a) debounces a burst of parallel 401s into ONE prompt + ONE redirect', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => ({ name: 'alice', id: 7 }), dispatch, redirect };

        // Five parallel 401s, as the terrain poller fires several at once.
        Promise.all([
            handleApiError(make401(), deps).catch((e) => e),
            handleApiError(make401(), deps).catch((e) => e),
            handleApiError(make401(), deps).catch((e) => e),
            handleApiError(make401(), deps).catch((e) => e),
            handleApiError(make401(), deps).catch((e) => e)
        ]).then((errors) => {
            // every call still rejected
            expect(errors.length).toBe(5);
            errors.forEach((err) => expect(err?.response?.status).toBe(401));
            // but only ONE notification and ONE redirect across the burst
            expect(calls.dispatch.length).toBe(1);
            expect(calls.redirect.length).toBe(1);
            done();
        }).catch(done);
    });

    it('(b) anonymous (no user) + 401 -> pass-through, NO re-login, rejects unchanged', (done) => {
        const { calls, dispatch, redirect } = spies();
        // Anonymous: the user accessor returns undefined (TASK-1700 paywall 401).
        const deps = { getUser: () => undefined, dispatch, redirect };
        const original = make401();

        handleApiError(original, deps)
            .then(() => done(new Error('expected the promise to reject')))
            .catch((err) => {
                // SAME object back, untouched
                expect(err).toBe(original);
                // and CRUCIALLY: no notification, no redirect for anonymous users
                expect(calls.dispatch.length).toBe(0);
                expect(calls.redirect.length).toBe(0);
                done();
            })
            .catch(done);
    });

    it('(b) anonymous + 401 with null user -> pass-through', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => null, dispatch, redirect };
        handleApiError(make401(), deps)
            .catch(() => {
                expect(calls.dispatch.length).toBe(0);
                expect(calls.redirect.length).toBe(0);
                done();
            })
            .catch(done);
    });

    it('does not act on a non-401 status (403 left alone) even for a logged-in user', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => ({ name: 'alice' }), dispatch, redirect };
        const err403 = make401({ response: { status: 403 } });
        handleApiError(err403, deps)
            .catch((err) => {
                expect(err).toBe(err403);
                expect(calls.dispatch.length).toBe(0);
                expect(calls.redirect.length).toBe(0);
                done();
            })
            .catch(done);
    });

    it('does not redirect on a 401 from the login/token endpoints (no redirect loop)', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => ({ name: 'alice' }), dispatch, redirect };
        const authErr = make401({ config: { url: '/o/token/' } });
        handleApiError(authErr, deps)
            .catch((err) => {
                expect(err).toBe(authErr);
                expect(calls.dispatch.length).toBe(0);
                expect(calls.redirect.length).toBe(0);
                done();
            })
            .catch(done);
    });

    it('reads status from the MapStore-reshaped error shape (top-level status)', (done) => {
        const { calls, dispatch, redirect } = spies();
        const deps = { getUser: () => ({ name: 'alice' }), dispatch, redirect };
        // MapStore ajax.js reshapes a 401 to {...error.response, originalError}:
        // status is top-level, not under .response.
        const reshaped = { status: 401, config: { url: '/api/v2/anuga/projects/9/' }, originalError: {} };
        handleApiError(reshaped, deps)
            .catch((err) => {
                expect(err).toBe(reshaped);
                expect(calls.dispatch.length).toBe(1);
                expect(calls.redirect.length).toBe(1);
                done();
            })
            .catch(done);
    });
});
