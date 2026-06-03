import expect from 'expect';
import {
    MVT_FORMAT,
    BMP_MVT_FEATURE_THRESHOLD,
    shouldUseServerSideCql,
    buildBmpShowFilter,
    buildBmpVectorStyle
} from '../swammMvtPaint';

/**
 * TASK-1192 (W7c) — client-side MVT cosmetic-paint contract.
 *
 * The BMP working layers (outlet/footprint/watershed) are served as a single
 * per-project MVT over WMS GetMap. The type/priority/group-profile/status
 * checkboxes filter features CLIENT-SIDE via a geostyler `vectorStyle` whose
 * rule `filter` is a show predicate — NOT a per-user CQL_FILTER (which would
 * defeat the shared cache / authz-boundary single render path).
 *
 * UX-PARITY with the old CQL path (filterBmpEpic): when ALL values in a
 * dimension are selected, that dimension is OMITTED from the predicate (a
 * fully-checked group shows everything); when NONE are selected, the layer
 * shows nothing.
 */
describe('swammMvtPaint', () => {
    describe('constants', () => {
        it('MVT_FORMAT is the mapbox-vector-tile mime', () => {
            expect(MVT_FORMAT).toBe('application/vnd.mapbox-vector-tile');
        });
        it('BMP_MVT_FEATURE_THRESHOLD is a positive number', () => {
            expect(typeof BMP_MVT_FEATURE_THRESHOLD).toBe('number');
            expect(BMP_MVT_FEATURE_THRESHOLD).toBeGreaterThan(0);
        });
    });

    describe('shouldUseServerSideCql (AC#5 tradeoff fallback)', () => {
        it('returns false (use client paint) when feature count is unknown', () => {
            expect(shouldUseServerSideCql(undefined)).toBe(false);
            expect(shouldUseServerSideCql(null)).toBe(false);
        });
        it('returns false when below the threshold', () => {
            expect(shouldUseServerSideCql(BMP_MVT_FEATURE_THRESHOLD - 1)).toBe(false);
        });
        it('returns true (fall back to CQL) when above the threshold', () => {
            expect(shouldUseServerSideCql(BMP_MVT_FEATURE_THRESHOLD + 1)).toBe(true);
        });
    });

    describe('buildBmpShowFilter', () => {
        const sel = (types, priorities, groupProfiles, statuses) => ({
            bmpTypes: types,
            priorities,
            groupProfiles,
            statuses
        });

        it('returns null when every dimension is fully selected (show everything)', () => {
            const filter = buildBmpShowFilter(sel(
                [{ id: 1, visibility: true }, { id: 2, visibility: true }],
                [{ id: 1, visibility: true }],
                [{ id: 10, visibility: true }],
                [{ id: 1, name: 'Active', visibility: true }]
            ));
            expect(filter).toBe(null);
        });

        it('omits a fully-selected dimension but includes a partial one', () => {
            const filter = buildBmpShowFilter(sel(
                [{ id: 1, visibility: true }, { id: 2, visibility: false }], // partial -> include
                [{ id: 1, visibility: true }], // full -> omit
                [], // empty list -> omit
                [] // empty list -> omit
            ));
            // ['&&', ['||', ['==','type',1]]]
            expect(Array.isArray(filter)).toBe(true);
            expect(filter[0]).toBe('&&');
            const flat = JSON.stringify(filter);
            expect(flat).toContain('"type"');
            expect(flat).toContain('1');
            expect(flat).toNotContain('"priority"');
            expect(flat).toNotContain('"group_profile"');
            expect(flat).toNotContain('"status"');
        });

        it('builds an OR clause over each visible value in a partial dimension', () => {
            const filter = buildBmpShowFilter(sel(
                [{ id: 1, visibility: true }, { id: 2, visibility: true }, { id: 3, visibility: false }],
                [], [], []
            ));
            // type clause must be ['||', ['==','type',1], ['==','type',2]]
            const typeClause = filter[1];
            expect(typeClause[0]).toBe('||');
            const values = typeClause.slice(1).map(c => c[2]);
            expect(values).toContain(1);
            expect(values).toContain(2);
            expect(values).toNotContain(3);
        });

        it('hides everything when a dimension has zero visible values (impossible predicate)', () => {
            const filter = buildBmpShowFilter(sel(
                [{ id: 1, visibility: false }, { id: 2, visibility: false }],
                [], [], []
            ));
            // type dimension is partial (not all selected) AND has no visible -> impossible match
            const typeClause = filter[1];
            expect(typeClause[0]).toBe('||');
            // a single ['==','type', <sentinel that never matches>]
            expect(typeClause.length).toBe(2);
            expect(typeClause[1][1]).toBe('type');
        });

        it('filters status by name (not id), matching the server attribute', () => {
            const filter = buildBmpShowFilter(sel(
                [], [],
                [],
                [{ id: 1, name: 'Active', visibility: true }, { id: 2, name: 'Retired', visibility: false }]
            ));
            const flat = JSON.stringify(filter);
            expect(flat).toContain('"status"');
            expect(flat).toContain('"Active"');
        });
    });

    describe('buildBmpVectorStyle', () => {
        const fullySelected = {
            bmpTypes: [{ id: 1, visibility: true }],
            priorities: [{ id: 1, visibility: true }],
            groupProfiles: [{ id: 10, visibility: true }],
            statuses: [{ id: 1, name: 'Active', visibility: true }]
        };

        it('returns a geostyler-format vectorStyle', () => {
            const vs = buildBmpVectorStyle('footprint', fullySelected);
            expect(vs.format).toBe('geostyler');
            expect(vs.styleObj).toBeTruthy();
            expect(Array.isArray(vs.styleObj.rules)).toBe(true);
            expect(vs.styleObj.rules.length).toBeGreaterThanOrEqualTo(1);
        });

        it('omits the rule filter when everything is selected (renders all features)', () => {
            const vs = buildBmpVectorStyle('footprint', fullySelected);
            expect(vs.styleObj.rules[0].filter).toBe(undefined);
        });

        it('attaches the show predicate as the rule filter when partial', () => {
            const partial = {
                ...fullySelected,
                bmpTypes: [{ id: 1, visibility: true }, { id: 2, visibility: false }]
            };
            const vs = buildBmpVectorStyle('footprint', partial);
            expect(Array.isArray(vs.styleObj.rules[0].filter)).toBe(true);
            expect(vs.styleObj.rules[0].filter[0]).toBe('&&');
        });

        it('uses a Mark symbolizer for the point outlet role', () => {
            const vs = buildBmpVectorStyle('outlet', fullySelected);
            const kinds = vs.styleObj.rules[0].symbolizers.map(s => s.kind);
            expect(kinds).toContain('Mark');
        });

        it('uses a Fill symbolizer for the polygon footprint/watershed roles', () => {
            const fp = buildBmpVectorStyle('footprint', fullySelected);
            const ws = buildBmpVectorStyle('watershed', fullySelected);
            expect(fp.styleObj.rules[0].symbolizers.map(s => s.kind)).toContain('Fill');
            expect(ws.styleObj.rules[0].symbolizers.map(s => s.kind)).toContain('Fill');
        });
    });
});
