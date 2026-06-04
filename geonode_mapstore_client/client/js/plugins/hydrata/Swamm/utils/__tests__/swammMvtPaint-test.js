import expect from 'expect';
import {
    MVT_FORMAT,
    BMP_MVT_FEATURE_THRESHOLD,
    shouldUseServerSideCql,
    buildBmpShowFilter,
    buildBmpVectorStyle
} from '../swammMvtPaint';

/**
 * TASK-1192 (W7c) + TASK-1463 (W7d) — client-side MVT cosmetic-paint contract.
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
 *
 * TASK-1463: footprint uses OPERATIONAL symbology — Fill keyed on status,
 * Line keyed on priority — rather than a flat green. The visibility filter
 * (show/hide by checkbox) composes as AND with each rule's symbolizer predicate.
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

        it('uses a Mark symbolizer for the point outlet role', () => {
            const vs = buildBmpVectorStyle('outlet', fullySelected);
            const kinds = vs.styleObj.rules[0].symbolizers.map(s => s.kind);
            expect(kinds).toContain('Mark');
        });

        it('uses a Fill symbolizer for the polygon footprint/watershed roles', () => {
            const fp = buildBmpVectorStyle('footprint', fullySelected);
            const ws = buildBmpVectorStyle('watershed', fullySelected);
            // At least one rule per role contains a Fill symbolizer
            const fpKinds = fp.styleObj.rules.flatMap(r => r.symbolizers.map(s => s.kind));
            const wsKinds = ws.styleObj.rules.flatMap(r => r.symbolizers.map(s => s.kind));
            expect(fpKinds).toContain('Fill');
            expect(wsKinds).toContain('Fill');
        });

        // --- TASK-1463: operational symbology for footprint ---

        describe('footprint operational symbology (TASK-1463)', () => {
            it('emits multiple rules (one per status) for the footprint role', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                // The operational style has per-status fill rules + per-priority line rules
                expect(vs.styleObj.rules.length).toBeGreaterThan(1);
            });

            it('Unknown status rule uses white fill #ffffff', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                const allRules = vs.styleObj.rules;
                // Find a Fill rule that applies to status=='Unknown'
                const unknownFillRule = allRules.find(r => {
                    const hasUnknownFilter = JSON.stringify(r.filter || []).includes('"Unknown"');
                    const hasFill = r.symbolizers.some(s => s.kind === 'Fill');
                    return hasUnknownFilter && hasFill;
                });
                expect(unknownFillRule).toBeTruthy();
                const fillSym = unknownFillRule.symbolizers.find(s => s.kind === 'Fill');
                expect(fillSym.color.toLowerCase()).toBe('#ffffff');
            });

            it('Proposed/Hypothetical/Pending/Approved status rules use grey-blue fill #9BABB8', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                const allRules = vs.styleObj.rules;
                const pendingStatuses = ['Proposed', 'Hypothetical', 'Pending', 'Approved'];
                pendingStatuses.forEach(statusName => {
                    const rule = allRules.find(r => {
                        const hasStatusFilter = JSON.stringify(r.filter || []).includes(`"${statusName}"`);
                        const hasFill = r.symbolizers.some(s => s.kind === 'Fill');
                        return hasStatusFilter && hasFill;
                    });
                    expect(rule).toBeTruthy();
                    const fillSym = rule.symbolizers.find(s => s.kind === 'Fill');
                    expect(fillSym.color.toLowerCase()).toBe('#9babb8');
                });
            });

            it('priority=1 (critical) line rule uses red stroke #ff0000', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                const allRules = vs.styleObj.rules;
                // Find a Line rule whose filter selects priority==1
                const criticalLineRule = allRules.find(r => {
                    const flat = JSON.stringify(r.filter || []);
                    const hasPrio1 = flat.includes('"priority"') && flat.includes(',1]');
                    const hasLine = r.symbolizers.some(s => s.kind === 'Line');
                    return hasPrio1 && hasLine;
                });
                expect(criticalLineRule).toBeTruthy();
                const lineSym = criticalLineRule.symbolizers.find(s => s.kind === 'Line');
                expect(lineSym.color.toLowerCase()).toBe('#ff0000');
            });

            it('priority=2 line rule uses amber stroke #ffbf00', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                const allRules = vs.styleObj.rules;
                const amberRule = allRules.find(r => {
                    const flat = JSON.stringify(r.filter || []);
                    const hasPrio2 = flat.includes('"priority"') && flat.includes(',2]');
                    const hasLine = r.symbolizers.some(s => s.kind === 'Line');
                    return hasPrio2 && hasLine;
                });
                expect(amberRule).toBeTruthy();
                const lineSym = amberRule.symbolizers.find(s => s.kind === 'Line');
                expect(lineSym.color.toLowerCase()).toBe('#ffbf00');
            });

            it('does NOT use flat green #34de34 for footprint (geostory style must not bleed in)', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                const allColors = JSON.stringify(vs.styleObj.rules);
                expect(allColors.toLowerCase()).toNotContain('#34de34');
            });

            it('composes show-filter with each rule filter when selections are partial', () => {
                const partial = {
                    ...fullySelected,
                    bmpTypes: [{ id: 1, visibility: true }, { id: 2, visibility: false }]
                };
                const vs = buildBmpVectorStyle('footprint', partial);
                // Every rule must incorporate the show-filter (type clause present)
                vs.styleObj.rules.forEach(rule => {
                    expect(Array.isArray(rule.filter)).toBe(true);
                    expect(rule.filter[0]).toBe('&&');
                    // The '&&' filter must include the type visibility clause
                    const flat = JSON.stringify(rule.filter);
                    expect(flat).toContain('"type"');
                });
            });

            it('omits the show-filter from each rule when all selections are fully checked', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                // When fully selected, the show-filter is null.
                // Each rule should NOT contain a 'type'/'priority'/'group_profile'/'status'
                // visibility clause — only the symbolizer-predicate (status/priority value match).
                // Rules that have a filter only use it for their symbolizer predicate.
                vs.styleObj.rules.forEach(rule => {
                    const flat = JSON.stringify(rule.filter || null);
                    // The show-filter dimensions must NOT appear (no type/group_profile clause)
                    expect(flat).toNotContain('"type"');
                    expect(flat).toNotContain('"group_profile"');
                });
            });
        });

        // --- TASK-1474: operational symbology for the outlet (point) role ---

        describe('outlet operational symbology (TASK-1474)', () => {
            // Find a Mark rule whose filter selects the given status and priority.
            const markFor = (rules, statusName, priorityVal) => rules.find(r => {
                const flat = JSON.stringify(r.filter || []);
                const hasStatus = flat.includes(`"${statusName}"`);
                const hasPrio = flat.includes('"priority"') && flat.includes(`,${priorityVal}]`);
                const hasMark = r.symbolizers.some(s => s.kind === 'Mark');
                return hasStatus && hasPrio && hasMark;
            });

            it('emits a Mark per status×priority combination (more than one rule)', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                expect(vs.styleObj.rules.length).toBeGreaterThan(1);
                // Every rule is a circle Mark
                vs.styleObj.rules.forEach(rule => {
                    const mark = rule.symbolizers.find(s => s.kind === 'Mark');
                    expect(mark).toBeTruthy();
                    expect(mark.wellKnownName).toBe('Circle');
                });
            });

            it('drives the Mark FILL by status: Unknown -> white #ffffff', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                const rule = markFor(vs.styleObj.rules, 'Unknown', 1);
                expect(rule).toBeTruthy();
                const mark = rule.symbolizers.find(s => s.kind === 'Mark');
                expect(mark.color.toLowerCase()).toBe('#ffffff');
            });

            it('drives the Mark FILL by status: Approved -> grey-blue #9babb8', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                const rule = markFor(vs.styleObj.rules, 'Approved', 2);
                expect(rule).toBeTruthy();
                const mark = rule.symbolizers.find(s => s.kind === 'Mark');
                expect(mark.color.toLowerCase()).toBe('#9babb8');
            });

            it('drives the Mark STROKE by priority: priority=1 (critical) -> red #ff0000 outline', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                const rule = markFor(vs.styleObj.rules, 'Proposed', 1);
                expect(rule).toBeTruthy();
                const mark = rule.symbolizers.find(s => s.kind === 'Mark');
                expect(mark.strokeColor.toLowerCase()).toBe('#ff0000');
            });

            it('drives the Mark STROKE by priority: priority=2 -> amber #ffbf00 outline', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                const rule = markFor(vs.styleObj.rules, 'Proposed', 2);
                expect(rule).toBeTruthy();
                const mark = rule.symbolizers.find(s => s.kind === 'Mark');
                expect(mark.strokeColor.toLowerCase()).toBe('#ffbf00');
            });

            it('does NOT use the flat cosmetic teal #54acd2 as the Mark fill', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                const fills = vs.styleObj.rules
                    .flatMap(r => r.symbolizers.filter(s => s.kind === 'Mark'))
                    .map(s => (s.color || '').toLowerCase());
                expect(fills).toNotContain('#54acd2');
            });

            it('composes the show-filter into every outlet rule when selections are partial', () => {
                const partial = {
                    ...fullySelected,
                    bmpTypes: [{ id: 1, visibility: true }, { id: 2, visibility: false }]
                };
                const vs = buildBmpVectorStyle('outlet', partial);
                vs.styleObj.rules.forEach(rule => {
                    expect(Array.isArray(rule.filter)).toBe(true);
                    expect(rule.filter[0]).toBe('&&');
                    expect(JSON.stringify(rule.filter)).toContain('"type"');
                });
            });
        });

        // --- TASK-1474: operational symbology for the watershed (polygon) role ---

        describe('watershed operational symbology (TASK-1474)', () => {
            const fillRuleFor = (rules, statusName) => rules.find(r => {
                const hasStatus = JSON.stringify(r.filter || []).includes(`"${statusName}"`);
                return hasStatus && r.symbolizers.some(s => s.kind === 'Fill');
            });

            it('emits multiple rules (Fill per status + Line per priority)', () => {
                const vs = buildBmpVectorStyle('watershed', fullySelected);
                expect(vs.styleObj.rules.length).toBeGreaterThan(1);
                const kinds = vs.styleObj.rules.flatMap(r => r.symbolizers.map(s => s.kind));
                expect(kinds).toContain('Fill');
                expect(kinds).toContain('Line');
            });

            it('drives the Fill by status (Unknown -> #ffffff, Approved -> #9babb8) at a low opacity', () => {
                const vs = buildBmpVectorStyle('watershed', fullySelected);
                const unknown = fillRuleFor(vs.styleObj.rules, 'Unknown').symbolizers.find(s => s.kind === 'Fill');
                const approved = fillRuleFor(vs.styleObj.rules, 'Approved').symbolizers.find(s => s.kind === 'Fill');
                expect(unknown.color.toLowerCase()).toBe('#ffffff');
                expect(approved.color.toLowerCase()).toBe('#9babb8');
                // Sits UNDER footprints/outlets — opacity well below the footprint's 0.5
                expect(unknown.fillOpacity).toBeLessThan(0.5);
            });

            it('drives the Line by priority: priority=1 (critical) -> red #ff0000', () => {
                const vs = buildBmpVectorStyle('watershed', fullySelected);
                const criticalLine = vs.styleObj.rules.find(r => {
                    const flat = JSON.stringify(r.filter || []);
                    return flat.includes('"priority"') && flat.includes(',1]')
                        && r.symbolizers.some(s => s.kind === 'Line');
                });
                expect(criticalLine).toBeTruthy();
                expect(criticalLine.symbolizers.find(s => s.kind === 'Line').color.toLowerCase()).toBe('#ff0000');
            });

            it('does NOT use the flat cosmetic teal #54acd2', () => {
                const vs = buildBmpVectorStyle('watershed', fullySelected);
                expect(JSON.stringify(vs.styleObj.rules).toLowerCase()).toNotContain('#54acd2');
            });

            it('composes the show-filter into every watershed rule when selections are partial', () => {
                const partial = {
                    ...fullySelected,
                    bmpTypes: [{ id: 1, visibility: true }, { id: 2, visibility: false }]
                };
                const vs = buildBmpVectorStyle('watershed', partial);
                vs.styleObj.rules.forEach(rule => {
                    expect(rule.filter[0]).toBe('&&');
                    expect(JSON.stringify(rule.filter)).toContain('"type"');
                });
            });
        });

        // --- TASK-1475: fallback fill for statuses outside STATUS_FILL (all roles) ---

        describe('status fallback fill (TASK-1475)', () => {
            // The fallback rule selects "status NOT in the known set" via De-Morgan
            // (AND of '!=' over each known status name), so its filter JSON carries
            // '!=' clauses rather than an '==' on a named status.
            const hasFallbackFill = (rules, kind, color) => rules.some(r => {
                const flat = JSON.stringify(r.filter || []);
                const isNegation = flat.includes('"!="') && flat.includes('"status"');
                const sym = r.symbolizers.find(s => s.kind === kind);
                return isNegation && sym && (sym.color || '').toLowerCase() === color;
            });

            it('footprint has a #cccccc Fill rule for unrecognised statuses', () => {
                const vs = buildBmpVectorStyle('footprint', fullySelected);
                expect(hasFallbackFill(vs.styleObj.rules, 'Fill', '#cccccc')).toBe(true);
            });

            it('watershed has a #cccccc Fill rule for unrecognised statuses', () => {
                const vs = buildBmpVectorStyle('watershed', fullySelected);
                expect(hasFallbackFill(vs.styleObj.rules, 'Fill', '#cccccc')).toBe(true);
            });

            it('outlet has a #cccccc Mark fill for unrecognised statuses', () => {
                const vs = buildBmpVectorStyle('outlet', fullySelected);
                expect(hasFallbackFill(vs.styleObj.rules, 'Mark', '#cccccc')).toBe(true);
            });
        });
    });
});
