/*
 * TASK-1996 (W3.1) — legacyClickTargets tests.
 *
 * Proof points:
 *   (a) LEGACY_PREFIXES matches the expected 7 prefixes.
 *   (b) registerLegacyClickTargets() registers all 7 with readOnly:true.
 *   (c) match() returns true for non-empty featureIds on the right layer prefix,
 *       and false for empty featureId (raster path) and mismatched prefixes.
 *   (d) buildOpenActions() returns PLAIN actions (D6, C2, C3) including browseData.
 *   (e) structuredClone-safe (W4.1 AC3 pre-gate).
 */
import expect from 'expect';
import {
    getClickTarget,
    cleanClickTargets
} from '../../shared/clickTargetRegistry';
import {
    LEGACY_PREFIXES,
    registerLegacyClickTargets
} from '../legacyClickTargets';

const collectFunctionPaths = (obj, path = 'root', acc = []) => {
    if (!obj || typeof obj !== 'object') { return acc; }
    Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'function') {
            acc.push(`${path}.${k} = ${v.name || 'anon'}()`);
        } else if (v && typeof v === 'object') {
            collectFunctionPaths(v, `${path}.${k}`, acc);
        }
    });
    return acc;
};

// Minimal fake state with a visible layer in state.layers.flat.
const stateWith = (layerName) => ({
    layers: { flat: [{ name: `geonode:${layerName}` }] }
});

const feature = (id, props = {}) => ({ type: 'Feature', id, properties: props });

describe('legacyClickTargets (TASK-1996 W3.1)', () => {

    beforeEach(() => {
        cleanClickTargets();
        registerLegacyClickTargets();
    });
    afterEach(() => cleanClickTargets());

    describe('LEGACY_PREFIXES', () => {
        it('contains exactly the 7 expected prefixes', () => {
            expect(LEGACY_PREFIXES.sort()).toEqual(
                ['cat_', 'ele_', 'full_mesh_', 'lin_', 'network_', 'nod_', 'terrain_']
            );
        });
    });

    describe('registration', () => {

        it('registers all 7 legacy prefixes with readOnly:true', () => {
            LEGACY_PREFIXES.forEach((prefix) => {
                const t = getClickTarget(prefix);
                expect(t).toExist(`expected '${prefix}' to be registered`);
                expect(t.readOnly).toBe(true);
            });
        });

        it('each target has a match function', () => {
            LEGACY_PREFIXES.forEach((prefix) => {
                expect(typeof getClickTarget(prefix).match).toBe('function');
            });
        });
    });

    describe('match()', () => {

        it('returns true for a non-empty featureId on the right prefix', () => {
            expect(getClickTarget('nod_').match('nod_1_nodes.5', 'nod_1_nodes')).toBe(true);
            expect(getClickTarget('cat_').match('cat_2_cats.3', 'cat_2_cats')).toBe(true);
            expect(getClickTarget('lin_').match('lin_3_links.1', 'lin_3_links')).toBe(true);
            expect(getClickTarget('full_mesh_').match('full_mesh_4_x.1', 'full_mesh_4_x')).toBe(true);
            expect(getClickTarget('network_').match('network_5_y.1', 'network_5_y')).toBe(true);
            expect(getClickTarget('terrain_').match('terrain_6_t.2', 'terrain_6_t')).toBe(true);
            expect(getClickTarget('ele_').match('ele_7_u.3', 'ele_7_u')).toBe(true);
        });

        it('returns false for an EMPTY featureId (raster path guard)', () => {
            // empty featureId means raster — W3.2 handles that separately
            LEGACY_PREFIXES.forEach((prefix) => {
                expect(getClickTarget(prefix).match('', `${prefix}1_x`)).toBe(false);
            });
        });

        it('returns false for a mismatched layer prefix', () => {
            expect(getClickTarget('nod_').match('bdy_1_b.5', 'bdy_1_b')).toBe(false);
            expect(getClickTarget('ele_').match('fri_raster_4_f.1', 'fri_raster_4_f')).toBe(false);
        });

        it('honours geonode: workspace prefix in layer name', () => {
            expect(getClickTarget('nod_').match('nod_1_nodes.5', 'geonode:nod_1_nodes')).toBe(true);
        });
    });

    describe('label()', () => {

        it('returns a plain {title, subtitle, icon} object', () => {
            const t = getClickTarget('nod_');
            const lbl = t.label(feature('nod_1_nodes.5', { description: 'Inlet nodes' }));
            expect(lbl).toEqual({ title: 'Node', subtitle: 'Inlet nodes', icon: 'list' });
        });

        it('falls back to empty subtitle when properties are absent', () => {
            const lbl = getClickTarget('terrain_').label(feature('terrain_1_t.1'));
            expect(lbl.subtitle).toBe('');
        });

        it('resolved label contains no function values (D6)', () => {
            const lbl = getClickTarget('lin_').label(feature('lin_1_l.1', { name: 'Main drain' }));
            expect(collectFunctionPaths(lbl)).toEqual([]);
        });
    });

    describe('buildOpenActions()', () => {

        it('returns plain actions including browseData and setup actions (C2/C3)', () => {
            const state = stateWith('nod_1_nodes');
            const actions = getClickTarget('nod_').buildOpenActions(
                feature('nod_1_nodes.5'),
                () => state
            );
            expect(Array.isArray(actions)).toBe(true);
            expect(actions.length).toBeGreaterThan(0);
            // All must be plain objects
            actions.forEach((a) => {
                expect(typeof a).toBe('object');
                expect(typeof a.type).toBe('string');
            });
            // browseData action type must be present (MapStore type constant: LAYERS:BROWSE_DATA)
            const hasBrowse = actions.some((a) => a.type === 'LAYERS:BROWSE_DATA');
            expect(hasBrowse).toBe(true);
        });

        it('all returned actions are structuredClone-safe (D6, W4.1 AC3)', () => {
            const state = stateWith('nod_1_nodes');
            const actions = getClickTarget('nod_').buildOpenActions(
                feature('nod_1_nodes.5'),
                () => state
            );
            expect(collectFunctionPaths(actions)).toEqual([]);
            expect(() => structuredClone(actions)).toNotThrow();
        });

        it('returns [] when the layer is not found in state.layers.flat (fail-closed)', () => {
            const actions = getClickTarget('nod_').buildOpenActions(
                feature('nod_1_nodes.5'),
                () => ({ layers: { flat: [] } })
            );
            expect(actions).toEqual([]);
        });

        it('returns [] for an un-parseable featureId', () => {
            const state = stateWith('nod_1_nodes');
            const actions = getClickTarget('nod_').buildOpenActions(
                feature('no_dot_id'),
                () => state
            );
            expect(actions).toEqual([]);
        });
    });
});
