/*
 * TASK-813 (W1.2) — VectorDraw translate registry tests.
 *
 * Three layers of coverage:
 *
 *   1. Unit tests against translateRegistry directly (registerTranslate /
 *      getTranslate / getAllTranslate / cleanTranslate). These use a private
 *      fake key ('fake-translate-xyz-task813') so they don't perturb the
 *      'bdy' default registered by boundaryTranslate.js at module load.
 *
 *   2. deriveTranslateKey() pure string transform — namespace-prefixed and
 *      bare typeNames, null/undefined/empty, no-underscore strings.
 *
 *   3. Integration: wfstInsert routes through the registry. Register a spy
 *      translator under a fake prefix, fire wfstInsert against a layer with
 *      that prefix, and assert spy.translateOut was called with the form
 *      properties (proving the dispatch path is wired end-to-end).
 *
 * CROSS-TEST POLLUTION GUARDRAIL: the registry is process-global across
 * Karma. The unit-test `cleanTranslate()` test would otherwise strip the
 * 'bdy' default and break downstream tests
 * (wfstApiTimeBoundary-test.js / VectorDrawPopupShowWhenIntegration-test.js /
 * VectorDrawNitsBundle-test.js / epicsVectorDraw-test.js) that depend on
 * boundaryTranslate. We explicitly re-register the 'bdy' defaults in
 * afterEach to keep the suite stable regardless of test ordering.
 */
import expect from 'expect';
import MockAdapter from 'axios-mock-adapter';
import {
    registerTranslate,
    getTranslate,
    getAllTranslate,
    cleanTranslate,
    deriveTranslateKey
} from '../translateRegistry';
// Importing this triggers the side-effect registerTranslate('bdy', ...)
// once per Karma process. The named exports are used to restore the
// default registration after cleanTranslate() tests.
import { translateOut as boundaryTranslateOut, synthesizeIn as boundarySynthesizeIn } from '../boundaryTranslate';

const axios = require('../../../../../MapStore2/web/client/libs/ajax').default;
const { wfstInsert } = require('../wfstApi');

// Unique key so unit tests don't collide with the 'bdy' default or a future
// W2 'inf' registration.
const FAKE_KEY = 'fake-translate-xyz-task813';

// Helper: restore the boundary translator. The translateRegistry side-effect
// import (boundaryTranslate.js) fires ONCE per process. After cleanTranslate()
// strips the registry, subsequent tests would see identity for 'bdy' — which
// silently changes the Time-boundary wire contract. Always restore explicitly.
const restoreBoundary = () => {
    registerTranslate('bdy', { translateOut: boundaryTranslateOut, synthesizeIn: boundarySynthesizeIn });
};

describe('VectorDraw translateRegistry (TASK-813 W1.2)', () => {

    describe('registry primitives', () => {

        afterEach(() => {
            // Strip the fake key + restore the boundary default. Using the
            // clean+restore round-trip is cheap and keeps the registry in
            // the same state we found it.
            cleanTranslate();
            restoreBoundary();
        });

        it('registerTranslate(key, translator) adds an entry; getTranslate(key) returns it', () => {
            const fakeOut = (x) => ({ ...x, fake: 'out' });
            const fakeIn = (x) => ({ ...x, fake: 'in' });
            registerTranslate(FAKE_KEY, { translateOut: fakeOut, synthesizeIn: fakeIn });
            const got = getTranslate(FAKE_KEY);
            expect(got.translateOut).toBe(fakeOut);
            expect(got.synthesizeIn).toBe(fakeIn);
        });

        it('registerTranslate overwrites an existing entry (last-write-wins)', () => {
            const firstOut = (x) => ({ ...x, first: true });
            const secondOut = (x) => ({ ...x, second: true });
            registerTranslate(FAKE_KEY, { translateOut: firstOut, synthesizeIn: (x) => x });
            expect(getTranslate(FAKE_KEY).translateOut).toBe(firstOut);
            registerTranslate(FAKE_KEY, { translateOut: secondOut, synthesizeIn: (x) => x });
            expect(getTranslate(FAKE_KEY).translateOut).toBe(secondOut);
        });

        it('registerTranslate ignores empty key (defensive)', () => {
            const before = { ...getAllTranslate() };
            registerTranslate('', { translateOut: (x) => x, synthesizeIn: (x) => x });
            expect(getAllTranslate()).toEqual(before);
        });

        it('registerTranslate ignores null translator (defensive)', () => {
            const before = { ...getAllTranslate() };
            registerTranslate(FAKE_KEY, null);
            expect(getAllTranslate()).toEqual(before);
        });

        it('registerTranslate silently falls back to identity for a non-function field', () => {
            // Bad translateOut, good synthesizeIn → translateOut becomes
            // identity but synthesizeIn is preserved as-given.
            const goodIn = (x) => ({ ...x, custom: true });
            registerTranslate(FAKE_KEY, { translateOut: 'not-a-function', synthesizeIn: goodIn });
            const got = getTranslate(FAKE_KEY);
            const sample = { a: 1 };
            // translateOut fell back to identity — input is returned unchanged.
            expect(got.translateOut(sample)).toBe(sample);
            // synthesizeIn was kept.
            expect(got.synthesizeIn).toBe(goodIn);
        });

        it('getTranslate(unknownKey) returns the identity pair (no-op)', () => {
            const got = getTranslate('no-such-prefix-zzz');
            const sample = { a: 1, b: 2 };
            // Same reference returned — identity, not a clone.
            expect(got.translateOut(sample)).toBe(sample);
            expect(got.synthesizeIn(sample)).toBe(sample);
        });

        it('getTranslate(null) and getTranslate(undefined) return the identity pair', () => {
            const samp = { x: 1 };
            expect(getTranslate(null).translateOut(samp)).toBe(samp);
            expect(getTranslate(undefined).synthesizeIn(samp)).toBe(samp);
        });

        it('getAllTranslate() returns the full registry map including the bdy default', () => {
            const all = getAllTranslate();
            expect(all.bdy).toExist();
            expect(all.bdy.translateOut).toBe(boundaryTranslateOut);
            expect(all.bdy.synthesizeIn).toBe(boundarySynthesizeIn);
        });

        it('cleanTranslate() empties the registry; afterEach restores the bdy default', () => {
            registerTranslate(FAKE_KEY, { translateOut: (x) => x, synthesizeIn: (x) => x });
            expect(getAllTranslate()[FAKE_KEY]).toExist();
            cleanTranslate();
            expect(getAllTranslate()).toEqual({});
            // After clean, getTranslate('bdy') falls back to identity until
            // we restore. The afterEach guarantees restoreBoundary().
            const sample = { boundary: 'Time', data: { kind: 'constant', constant: 5 } };
            expect(getTranslate('bdy').translateOut(sample)).toBe(sample); // identity post-clean
        });
    });

    describe('deriveTranslateKey()', () => {

        it('extracts the prefix from a namespace-qualified typeName', () => {
            expect(deriveTranslateKey('geonode:bdy_4_boundary_southsection')).toBe('bdy');
            expect(deriveTranslateKey('geonode:inf_3_inflow_north')).toBe('inf');
            expect(deriveTranslateKey('geonode:fri_5_friction_main')).toBe('fri');
        });

        it('extracts the prefix from a bare (no-namespace) typeName', () => {
            expect(deriveTranslateKey('bdy_1_boundary_west')).toBe('bdy');
            expect(deriveTranslateKey('inf_2_inflow_a')).toBe('inf');
        });

        it('returns null for null / undefined / empty / non-string inputs', () => {
            expect(deriveTranslateKey(null)).toBe(null);
            expect(deriveTranslateKey(undefined)).toBe(null);
            expect(deriveTranslateKey('')).toBe(null);
            expect(deriveTranslateKey(42)).toBe(null);
            expect(deriveTranslateKey({})).toBe(null);
        });

        it('returns null for typeNames without an underscore in the local part', () => {
            // No underscore at all
            expect(deriveTranslateKey('layer')).toBe(null);
            expect(deriveTranslateKey('geonode:layer')).toBe(null);
        });

        it('returns null when the typeName starts with an underscore (no real prefix)', () => {
            // underscore at position 0 → underscore <= 0 → null
            expect(deriveTranslateKey('_leading')).toBe(null);
            expect(deriveTranslateKey('geonode:_leading')).toBe(null);
        });

        it('handles multiple underscores: only the FIRST segment is the key', () => {
            expect(deriveTranslateKey('bdy_4_lots_of_underscores')).toBe('bdy');
            expect(deriveTranslateKey('geonode:abc_def_ghi')).toBe('abc');
        });

        it('preserves the prefix verbatim when key is for an unregistered prefix', () => {
            // 'mes' is unregistered today — derive still returns the
            // string; getTranslate falls back to identity.
            expect(deriveTranslateKey('geonode:mes_5_mesh')).toBe('mes');
            expect(getTranslate('mes').translateOut({ a: 1 })).toEqual({ a: 1 });
        });
    });

    describe('boundary translator registration', () => {
        // No cleanTranslate() here — we only inspect the registry state
        // that was set up by the side-effect import at the top of this file.

        it('boundaryTranslate.js side-effect registers under "bdy" on module import', () => {
            const bdy = getTranslate('bdy');
            // NOT the frozen IDENTITY_TRANSLATOR — has the real wire
            // contract attached.
            expect(bdy.translateOut).toBe(boundaryTranslateOut);
            expect(bdy.synthesizeIn).toBe(boundarySynthesizeIn);
        });

        it('"bdy" translateOut strips data_constant/data_timeseries_id for non-Time boundary', () => {
            // Behavioural sanity check — same contract pinned by
            // wfstApiTimeBoundary-test.js, but exercised THROUGH the
            // registry to prove the wiring works.
            const out = getTranslate('bdy').translateOut({
                boundary: 'Reflective',
                description: 'X',
                data_constant: 5
            });
            expect(out.data_constant).toBe(undefined);
            expect(out.boundary).toBe('Reflective');
            expect(out.description).toBe('X');
        });

        it('"bdy" synthesizeIn promotes data_constant into structured form', () => {
            const out = getTranslate('bdy').synthesizeIn({
                boundary: 'Time',
                data_constant: 7
            });
            expect(out.data).toEqual({ kind: 'constant', constant: 7 });
            // Per-column keys stripped.
            expect(out.data_constant).toBe(undefined);
        });
    });

    describe('wfstInsert dispatches through the registry', () => {
        // AC #5 — wfstInsert MUST route properties through
        // getTranslate(deriveTranslateKey(typeName)).translateOut. We register
        // a spy translator under a fake prefix and verify it was called.

        let mock;
        let translateOutCalls;
        // Use a unique prefix so we don't collide with future W2 'inf' or the
        // existing 'bdy' default. The prefix must be a valid identifier
        // string that deriveTranslateKey will extract verbatim from a
        // typeName like 'geonode:<prefix>_5_something'.
        const SPY_PREFIX = 'spyx';

        beforeEach(() => {
            translateOutCalls = [];
            // Spy translator that records every translateOut invocation
            // verbatim, then returns the same props (no transformation).
            registerTranslate(SPY_PREFIX, {
                translateOut: (props) => {
                    translateOutCalls.push(props);
                    return { ...props, _spied: true };
                },
                synthesizeIn: (p) => p
            });

            // Mock the WFS endpoint for DescribeFeatureType + Transaction.
            mock = new MockAdapter(axios);
            mock.onGet(/\/geoserver\/wfs/).reply(200, {
                targetPrefix: 'geonode',
                targetNamespace: 'http://geonode.org',
                featureTypes: [{
                    typeName: 'spyx_5_test',
                    properties: [
                        { name: 'the_geom', type: 'gml:Point', localType: 'Point' },
                        { name: 'description', type: 'xsd:string', localType: 'string' }
                    ]
                }]
            });
            mock.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse fid="spyx_5_test.42"/>');
        });

        afterEach(() => {
            if (mock) { mock.restore(); mock = null; }
            // Strip both the spy key and any unit-test leftovers, then
            // restore the boundary default to keep downstream tests stable.
            cleanTranslate();
            restoreBoundary();
        });

        it('wfstInsert calls the registered translator translateOut with the input properties', (done) => {
            const props = { description: 'TestFeature' };
            const geometry = { type: 'Point', coordinates: [0, 0] };
            wfstInsert(
                'http://localhost:8080/geoserver/wfs',
                'geonode:spyx_5_test',
                geometry,
                props
            ).then((fid) => {
                expect(translateOutCalls.length).toBe(1);
                // The spy received the original properties unchanged.
                expect(translateOutCalls[0]).toEqual({ description: 'TestFeature' });
                // FID was parsed from the mocked response.
                expect(fid).toBe('spyx_5_test.42');
                done();
            }).catch(done);
        });

        it('wfstInsert uses the identity fallback for an unregistered prefix', (done) => {
            // Unregistered prefix — getTranslate returns IDENTITY_TRANSLATOR
            // so wireProperties === properties (no transformation, no spy
            // invocation either). Use a prefix that's NOT 'spyx' / 'bdy'.
            // We re-mock the WFS endpoint for this typeName.
            mock.restore();
            mock = new MockAdapter(axios);
            mock.onGet(/\/geoserver\/wfs/).reply(200, {
                targetPrefix: 'geonode',
                targetNamespace: 'http://geonode.org',
                featureTypes: [{
                    typeName: 'zzz_5_test',
                    properties: [
                        { name: 'the_geom', type: 'gml:Point', localType: 'Point' },
                        { name: 'description', type: 'xsd:string', localType: 'string' }
                    ]
                }]
            });
            mock.onPost(/\/geoserver\/wfs/).reply(200, '<wfs:TransactionResponse fid="zzz_5_test.99"/>');
            wfstInsert(
                'http://localhost:8080/geoserver/wfs',
                'geonode:zzz_5_test',
                { type: 'Point', coordinates: [0, 0] },
                { description: 'Identity' }
            ).then((fid) => {
                // Spy was NOT called (unregistered prefix → identity).
                expect(translateOutCalls.length).toBe(0);
                expect(fid).toBe('zzz_5_test.99');
                done();
            }).catch(done);
        });
    });
});
