/*
 * TASK-1990 (W1.1) — clickTargetRegistry unit tests.
 *
 * Covers the register/get/getAll/clean primitives (mirrors widgetRegistry-test)
 * plus the parseFeatureId helper and the D6 serialization invariant: a
 * target's buildOpenActions must return ONLY plain action objects (deep
 * function-walk), and the resolved functions live module-side, never inside a
 * dispatched action.
 *
 * This registry ships NO defaults, so each test cleans() freely without having
 * to restore anything (unlike widgetRegistry which has 5 module-load defaults).
 */
import expect from 'expect';
import {
    registerClickTarget,
    getClickTarget,
    getAllClickTargets,
    cleanClickTargets,
    parseFeatureId
} from '../clickTargetRegistry';

// Deep walk collecting "path = name()" for every function value found.
const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') {
            acc.push(`${path}.${k} = ${v.name || 'anonymous'}()`);
        } else if (v && typeof v === 'object') {
            collectFunctionPaths(v, `${path}.${k}`, acc);
        }
    });
    return acc;
};

describe('clickTargetRegistry (TASK-1990 W1.1)', () => {

    beforeEach(() => cleanClickTargets());
    afterEach(() => cleanClickTargets());

    describe('registry primitives', () => {

        const fakeTarget = () => ({
            match: (featureId, layerName) => String(layerName).startsWith('foo_'),
            label: () => ({ title: 'Foo', subtitle: 's', icon: 'i' }),
            buildOpenActions: () => [{ type: 'FOO:OPEN' }]
        });

        it('register(kind, target) adds an entry; getClickTarget(kind) returns it', () => {
            const t = fakeTarget();
            registerClickTarget('foo', t);
            const got = getClickTarget('foo');
            expect(got).toExist();
            expect(got.match).toBe(t.match);
            expect(got.label).toBe(t.label);
            expect(got.buildOpenActions).toBe(t.buildOpenActions);
        });

        it('register overwrites an existing entry (last-write-wins)', () => {
            const first = fakeTarget();
            const second = fakeTarget();
            registerClickTarget('foo', first);
            expect(getClickTarget('foo').match).toBe(first.match);
            registerClickTarget('foo', second);
            expect(getClickTarget('foo').match).toBe(second.match);
        });

        it('register ignores entries missing kind or match (defensive)', () => {
            registerClickTarget('', fakeTarget());
            registerClickTarget('nomatch', { label: () => ({}), buildOpenActions: () => [] });
            registerClickTarget('nullt', null);
            expect(getClickTarget('')).toBe(undefined);
            expect(getClickTarget('nomatch')).toBe(undefined);
            expect(getClickTarget('nullt')).toBe(undefined);
        });

        it('defaults label/buildOpenActions when omitted (partial target never crashes)', () => {
            registerClickTarget('bare', { match: () => true });
            const got = getClickTarget('bare');
            expect(typeof got.label).toBe('function');
            expect(typeof got.buildOpenActions).toBe('function');
            expect(got.label({})).toEqual({ title: 'bare', subtitle: '', icon: '' });
            expect(got.buildOpenActions({})).toEqual([]);
        });

        it('getClickTarget returns undefined for an unknown kind (unknown kind -> no match)', () => {
            expect(getClickTarget('no-such-kind')).toBe(undefined);
        });

        it('getAllClickTargets returns the full keyed map', () => {
            registerClickTarget('a', fakeTarget());
            registerClickTarget('b', fakeTarget());
            expect(Object.keys(getAllClickTargets()).sort()).toEqual(['a', 'b']);
        });

        it('cleanClickTargets empties the registry', () => {
            registerClickTarget('foo', fakeTarget());
            expect(getClickTarget('foo')).toExist();
            cleanClickTargets();
            expect(getClickTarget('foo')).toBe(undefined);
            expect(getAllClickTargets()).toEqual({});
        });
    });

    describe('D6 serialization invariant', () => {

        it('buildOpenActions returns ONLY plain action objects (no functions, structuredClone-safe)', () => {
            registerClickTarget('plain', {
                match: () => true,
                label: () => ({ title: 'P', subtitle: 'x', icon: 'y' }),
                buildOpenActions: (feature) => [
                    { type: 'PLAIN:OPEN', payload: { id: feature.id, nested: { ok: true } } }
                ]
            });
            const actions = getClickTarget('plain').buildOpenActions({ id: 'plain_1_x.7' });
            expect(Array.isArray(actions)).toBe(true);
            actions.forEach((a) => {
                expect(collectFunctionPaths(a)).toEqual([]);
                expect(() => structuredClone(a)).toNotThrow();
            });
        });

        it('the resolved label result is a plain {title,subtitle,icon} object (no functions)', () => {
            registerClickTarget('lbl', {
                match: () => true,
                label: () => ({ title: 'T', subtitle: 'S', icon: 'I' })
            });
            const resolved = getClickTarget('lbl').label({});
            expect(collectFunctionPaths(resolved)).toEqual([]);
            expect(resolved).toEqual({ title: 'T', subtitle: 'S', icon: 'I' });
        });
    });

    describe('readOnly field (W3)', () => {

        it('stores readOnly:true on a target registered with readOnly:true', () => {
            registerClickTarget('ro_', {
                match: () => true,
                label: () => ({ title: 'RO', subtitle: '', icon: 'list' }),
                buildOpenActions: () => [],
                readOnly: true
            });
            expect(getClickTarget('ro_').readOnly).toBe(true);
        });

        it('readOnly defaults to false when not specified', () => {
            registerClickTarget('rw_', {
                match: () => true,
                buildOpenActions: () => [{ type: 'RW:OPEN' }]
            });
            expect(getClickTarget('rw_').readOnly).toBe(false);
        });

        it('readOnly:false stays false', () => {
            registerClickTarget('rw2_', {
                match: () => true,
                readOnly: false
            });
            expect(getClickTarget('rw2_').readOnly).toBe(false);
        });

        it('readOnly does not affect match / label / buildOpenActions behaviour', () => {
            registerClickTarget('ro2_', {
                match: (id) => id === 'ro2_test.1',
                label: () => ({ title: 'T', subtitle: 'S', icon: 'I' }),
                buildOpenActions: () => [{ type: 'RO2:OPEN' }],
                readOnly: true
            });
            const t = getClickTarget('ro2_');
            expect(t.readOnly).toBe(true);
            expect(t.match('ro2_test.1', 'ro2_test')).toBe(true);
            expect(t.label({})).toEqual({ title: 'T', subtitle: 'S', icon: 'I' });
            expect(t.buildOpenActions({})).toEqual([{ type: 'RO2:OPEN' }]);
        });
    });

    describe('parseFeatureId', () => {

        it('splits "<layerName>.<fid>" on the LAST dot', () => {
            expect(parseFeatureId('bdy_659_boundary_01.5'))
                .toEqual({ layerName: 'bdy_659_boundary_01', fid: '5' });
        });

        it('uses the LAST dot even when the slug has none but the fid is multi-char', () => {
            expect(parseFeatureId('inf_3_inflow_north.42'))
                .toEqual({ layerName: 'inf_3_inflow_north', fid: '42' });
        });

        it('returns null for an empty id (raster GFI feature)', () => {
            expect(parseFeatureId('')).toBe(null);
        });

        it('returns null for a non-string id', () => {
            expect(parseFeatureId(null)).toBe(null);
            expect(parseFeatureId(undefined)).toBe(null);
            expect(parseFeatureId(123)).toBe(null);
        });

        it('returns null for a dotless id', () => {
            expect(parseFeatureId('no_dot_here')).toBe(null);
        });

        it('returns null for a leading-dot or trailing-dot id', () => {
            expect(parseFeatureId('.5')).toBe(null);
            expect(parseFeatureId('layer.')).toBe(null);
        });
    });
});
