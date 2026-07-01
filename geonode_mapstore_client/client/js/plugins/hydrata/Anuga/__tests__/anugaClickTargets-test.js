/*
 * TASK-1992 (W1.3) — ANUGA clickTargetRegistry registration tests.
 *
 * (Describe name includes "clickTargetRegistry" to honour the spec's
 *  `--grep clickTargetRegistry` test command.)
 *
 * Proof points:
 *   (a) registerAnugaClickTargets registers EXACTLY the 8 editable vector
 *       prefixes via a single loop over ANUGA_FEATURE_CONFIG — 'fri_raster_'
 *       (Raster, formConfig:null) is excluded.
 *   (b) the shared opener's buildOpenActions returns a startVectorDraw action
 *       with featureId set + allowPick:false + the per-prefix formConfig (EDIT).
 *   (c) the action is a plain object: structuredClone-safe + no function values
 *       (the W4.1 clonability gate, anticipated here).
 *   (d) match() delegates longest-prefix resolution: a 'fri_' vector matches
 *       the fri_ target; a 'fri_raster_' layer matches NO registered target.
 */
import expect from 'expect';
import {
    registerAnugaClickTargets,
    ANUGA_VECTOR_PREFIXES
} from '../anugaClickTargets';
import {
    getAllClickTargets,
    getClickTarget,
    cleanClickTargets
} from '../../shared/clickTargetRegistry';
import { START_VECTOR_DRAW } from '../../VectorDraw/actionsVectorDraw';
import { ANUGA_FEATURE_CONFIG } from '../../SimpleView/components/simpleViewMenuRow';

const EXPECTED_PREFIXES = ['bdy_', 'inf_', 'fri_', 'rai_', 'mes_', 'str_', 'cul_', 'brk_'];

// Deep walk collecting function paths (D6 / W4.1 clonability guard).
const collectFunctionPaths = (obj, path = 'action', acc = []) => {
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

const featureFor = (prefix) => ({
    type: 'Feature',
    id: `${prefix}123_example.5`,
    properties: { description: 'My Feature' }
});

describe('ANUGA clickTargetRegistry registration (TASK-1992 W1.3)', () => {

    beforeEach(() => {
        cleanClickTargets();
        registerAnugaClickTargets();
    });
    afterEach(() => cleanClickTargets());

    it('ANUGA_VECTOR_PREFIXES is exactly the 8 editable vector prefixes (no fri_raster_)', () => {
        expect(ANUGA_VECTOR_PREFIXES.slice().sort()).toEqual(EXPECTED_PREFIXES.slice().sort());
        expect(ANUGA_VECTOR_PREFIXES.indexOf('fri_raster_')).toBe(-1);
    });

    it('registers exactly the 8 vector prefixes via a single loop', () => {
        const keys = Object.keys(getAllClickTargets()).sort();
        expect(keys).toEqual(EXPECTED_PREFIXES.slice().sort());
    });

    EXPECTED_PREFIXES.forEach((prefix) => {
        describe(`prefix "${prefix}" (${ANUGA_FEATURE_CONFIG[prefix].formConfig.title})`, () => {

            it('buildOpenActions returns a startVectorDraw EDIT action (featureId set, allowPick:false, per-prefix formConfig)', () => {
                const actions = getClickTarget(prefix).buildOpenActions(featureFor(prefix));
                expect(actions.length).toBe(1);
                const action = actions[0];
                expect(action.type).toBe(START_VECTOR_DRAW);
                expect(action.config.featureId).toBe(`${prefix}123_example.5`);
                expect(action.config.allowPick).toBe(false);
                expect(action.config.geomType).toBe(ANUGA_FEATURE_CONFIG[prefix].geomType);
                expect(action.config.formConfig).toBe(ANUGA_FEATURE_CONFIG[prefix].formConfig);
                expect(action.config.layerName).toBe(`geonode:${prefix}123_example`);
                expect(action.config.owner).toBe('anuga');
                expect(action.config.meta.prefix).toBe(prefix);
            });

            it('the action is structuredClone-safe with NO function values (W4.1 gate)', () => {
                const action = getClickTarget(prefix).buildOpenActions(featureFor(prefix))[0];
                expect(collectFunctionPaths(action)).toEqual([]);
                expect(() => structuredClone(action)).toNotThrow();
            });

            it('label() resolves to a plain {title, subtitle, icon}', () => {
                const label = getClickTarget(prefix).label(featureFor(prefix));
                expect(label).toEqual({
                    title: ANUGA_FEATURE_CONFIG[prefix].formConfig.title,
                    subtitle: 'My Feature',
                    icon: 'pencil'
                });
            });

            it('match() is true for its own prefix layer', () => {
                const layerName = `${prefix}123_example`;
                expect(getClickTarget(prefix).match(`${layerName}.5`, layerName)).toBe(true);
            });

            it('buildOpenActions returns [] for an empty / un-parseable feature id', () => {
                expect(getClickTarget(prefix).buildOpenActions({ id: '' })).toEqual([]);
                expect(getClickTarget(prefix).buildOpenActions({ id: 'no_dot' })).toEqual([]);
            });
        });
    });

    it('longest-prefix: a fri_raster_ layer matches NO registered vector target', () => {
        const rasterLayer = 'fri_raster_4_friction';
        const anyMatch = Object.keys(getAllClickTargets())
            .some((kind) => getClickTarget(kind).match(`${rasterLayer}.0`, rasterLayer) === true);
        expect(anyMatch).toBe(false);
    });

    it('longest-prefix: a fri_ vector layer matches ONLY the fri_ target', () => {
        const friLayer = 'fri_4_friction_zone';
        const matches = Object.keys(getAllClickTargets())
            .filter((kind) => getClickTarget(kind).match(`${friLayer}.1`, friLayer) === true);
        expect(matches).toEqual(['fri_']);
    });

    // TASK-1995 (W2.3 carry-forward) — GeoServer GeoJSON GetFeatureInfo ids are
    // bare today, but the opener must stay robust if a workspace namespace ever
    // appears on the feature id.
    it('namespace-tolerant: a workspace-qualified GFI id resolves the EDIT opener with a bare WFS featureID and a single geonode: typeName', () => {
        const nsFeature = {
            type: 'Feature',
            id: 'geonode:bdy_123_example.5',
            properties: { description: 'NS Boundary' }
        };
        // match() delegates to getAnugaPrefix, which strips the namespace.
        expect(getClickTarget('bdy_').match(nsFeature.id, 'geonode:bdy_123_example')).toBe(true);
        const action = getClickTarget('bdy_').buildOpenActions(nsFeature)[0];
        expect(action.type).toBe(START_VECTOR_DRAW);
        // typeName re-prefixed exactly once (not 'geonode:geonode:...').
        expect(action.config.layerName).toBe('geonode:bdy_123_example');
        // WFS featureID is bare (namespace stripped), matching the pick->edit path.
        expect(action.config.featureId).toBe('bdy_123_example.5');
    });
});
