import expect from 'expect';
import {
    getAnugaPrefix,
    ANUGA_FEATURE_CONFIG
} from '../components/simpleViewMenuRow';

/**
 * TASK-793 — Pure-function unit tests for the migrated-prefix routing
 * helper + ANUGA_FEATURE_CONFIG map shape. These exercise the routing
 * logic without standing up a connected-component / Provider tree.
 *
 * The routing decision is: layer.name → prefix (or null) → either the
 * VectorDraw path (5 migrated prefixes) or the legacy FeatureGrid path
 * (terrain_/ele_/cat_/nod_/lin_/full_mesh_/network_).
 *
 * BE-casing is load-bearing — the legacy prePopulate epic used wrong
 * casing (lowercase) for years which silently dropped values; the
 * VectorDraw migration is the moment that bug is fixed. We assert
 * field-name casing per BE here so future drift causes a CI failure.
 */
describe('TASK-793 SimpleView MenuRow routing', () => {

    describe('getAnugaPrefix', () => {
        // Migrated prefixes
        it('returns "bdy_" for geonode:bdy_4_my_boundary', () => {
            expect(getAnugaPrefix('geonode:bdy_4_my_boundary')).toBe('bdy_');
        });
        it('returns "inf_" for geonode:inf_4_test', () => {
            expect(getAnugaPrefix('geonode:inf_4_test')).toBe('inf_');
        });
        it('returns "fri_" for geonode:fri_4_x', () => {
            expect(getAnugaPrefix('geonode:fri_4_x')).toBe('fri_');
        });
        it('returns "mes_" for geonode:mes_4_x', () => {
            expect(getAnugaPrefix('geonode:mes_4_x')).toBe('mes_');
        });
        it('returns "str_" for geonode:str_4_x', () => {
            expect(getAnugaPrefix('geonode:str_4_x')).toBe('str_');
        });

        // Non-migrated prefixes — must return null so the legacy
        // FeatureGrid path is taken.
        it('returns null for geonode:cat_4_x (catchment, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:cat_4_x')).toBe(null);
        });
        it('returns null for geonode:nod_4_x (nodes, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:nod_4_x')).toBe(null);
        });
        it('returns null for geonode:lin_4_x (links, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:lin_4_x')).toBe(null);
        });
        it('returns null for geonode:ele_4_dem (terrain alias, NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:ele_4_dem')).toBe(null);
        });
        it('returns null for geonode:terrain_4_x (NOT migrated)', () => {
            expect(getAnugaPrefix('geonode:terrain_4_x')).toBe(null);
        });

        // Edge cases
        it('returns null for null', () => {
            expect(getAnugaPrefix(null)).toBe(null);
        });
        it('returns null for undefined', () => {
            expect(getAnugaPrefix(undefined)).toBe(null);
        });
        it('returns null for empty string', () => {
            expect(getAnugaPrefix('')).toBe(null);
        });
        it('returns "bdy_" for bdy_4_my_boundary (no geonode: prefix)', () => {
            expect(getAnugaPrefix('bdy_4_my_boundary')).toBe('bdy_');
        });
    });

    describe('ANUGA_FEATURE_CONFIG geomType', () => {
        it('bdy_ → LineString', () => {
            expect(ANUGA_FEATURE_CONFIG.bdy_.geomType).toBe('LineString');
        });
        it('inf_ → LineString', () => {
            expect(ANUGA_FEATURE_CONFIG.inf_.geomType).toBe('LineString');
        });
        it('fri_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.fri_.geomType).toBe('Polygon');
        });
        it('mes_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.mes_.geomType).toBe('Polygon');
        });
        it('str_ → Polygon', () => {
            expect(ANUGA_FEATURE_CONFIG.str_.geomType).toBe('Polygon');
        });
    });

    describe('ANUGA_FEATURE_CONFIG BE-casing (must match scenario.py)', () => {
        // Boundary — scenario.py:53-58 — Description, Boundary, Location, Data
        // (all Title-case)
        it('bdy_ field names are all Title-case (scenario.py:53-58)', () => {
            const fields = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields;
            fields.forEach(f => {
                expect(f.name[0]).toBe(f.name[0].toUpperCase());
            });
        });

        // Friction — scenario.py:361-364 — Mannings, Description (Title-case)
        it('fri_ field names are all Title-case (scenario.py:361-364)', () => {
            const fields = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields;
            fields.forEach(f => {
                expect(f.name[0]).toBe(f.name[0].toUpperCase());
            });
        });

        // Structure — scenario.py:371-374 — Description, Method (Title-case)
        it('str_ field names are all Title-case (scenario.py:371-374)', () => {
            const fields = ANUGA_FEATURE_CONFIG.str_.formConfig.fields;
            fields.forEach(f => {
                expect(f.name[0]).toBe(f.name[0].toUpperCase());
            });
        });

        // MeshRegion — scenario.py:414-417 — Description, Resolution (Title-case)
        it('mes_ field names are all Title-case (scenario.py:414-417)', () => {
            const fields = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields;
            fields.forEach(f => {
                expect(f.name[0]).toBe(f.name[0].toUpperCase());
            });
        });

        // Inflow — scenario.py:381-385 — type, data, description (lowercase)
        // The legacy prePopulate epic happened to use the right casing here
        // by accident; preserve it.
        it('inf_ field names are all lowercase (scenario.py:381-385)', () => {
            const fields = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields;
            fields.forEach(f => {
                expect(f.name[0]).toBe(f.name[0].toLowerCase());
            });
        });
    });

    describe('ANUGA_FEATURE_CONFIG "Title" relabel + first-field order (TASK-784 polish)', () => {
        // The user-visible label "Title" is the polish change. The BE column
        // name stays Description (or `description` for inf_) — only the FE
        // label changed. Assert: each prefix's FIRST form field is the
        // Description/description column AND its label is "Title". The
        // picker label fallback (VectorDrawPopup.featureLabel) reads both
        // casings so the same data shows up in the picker list.
        it('bdy_ first field is Description with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields;
            expect(fields[0].name).toBe('Description');
            expect(fields[0].label).toBe('Title');
        });
        it('fri_ first field is Description with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields;
            expect(fields[0].name).toBe('Description');
            expect(fields[0].label).toBe('Title');
        });
        it('mes_ first field is Description with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields;
            expect(fields[0].name).toBe('Description');
            expect(fields[0].label).toBe('Title');
        });
        it('str_ first field is Description with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.str_.formConfig.fields;
            expect(fields[0].name).toBe('Description');
            expect(fields[0].label).toBe('Title');
        });
        it('inf_ first field is description (lowercase) with label "Title"', () => {
            const fields = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields;
            expect(fields[0].name).toBe('description');
            expect(fields[0].label).toBe('Title');
        });
    });

    describe('ANUGA_FEATURE_CONFIG defaults', () => {
        it('bdy_ Boundary default is "Dirichlet"', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'Boundary');
            expect(f.default).toBe('Dirichlet');
        });
        it('bdy_ Location default is "External"', () => {
            const f = ANUGA_FEATURE_CONFIG.bdy_.formConfig.fields.find(x => x.name === 'Location');
            expect(f.default).toBe('External');
        });
        it('fri_ Mannings default is 0.035', () => {
            const f = ANUGA_FEATURE_CONFIG.fri_.formConfig.fields.find(x => x.name === 'Mannings');
            expect(f.default).toBe(0.035);
        });
        it('mes_ Resolution default is 10', () => {
            const f = ANUGA_FEATURE_CONFIG.mes_.formConfig.fields.find(x => x.name === 'Resolution');
            expect(f.default).toBe(10);
        });
        it('str_ Method default is "Holes"', () => {
            const f = ANUGA_FEATURE_CONFIG.str_.formConfig.fields.find(x => x.name === 'Method');
            expect(f.default).toBe('Holes');
        });
        it('inf_ type default is "Rainfall"', () => {
            const f = ANUGA_FEATURE_CONFIG.inf_.formConfig.fields.find(x => x.name === 'type');
            expect(f.default).toBe('Rainfall');
        });
    });
});
