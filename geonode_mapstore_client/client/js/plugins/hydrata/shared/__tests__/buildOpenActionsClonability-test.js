/*
 * TASK-1999 (W4.1) — buildOpenActions structured-clone safety across ALL click-target kinds.
 *
 * THE BUG IT GUARDS
 * -----------------
 * On PRODUCTION, OpenReplay's tracker-redux middleware does Worker.postMessage(action)
 * for every dispatched action. postMessage uses the structured-clone algorithm, which
 * CANNOT serialize a function, throwing an uncaught synchronous DataCloneError that
 * silently aborts the action's effect. Localhost has no OpenReplay key, so it never
 * fires there — hence prod-only. The sibling startVectorDrawClonability-test.js
 * documents the identical trap for the startVectorDraw pencil opener.
 *
 * THIS TEST extends the coverage to EVERY action produced by EVERY registered
 * buildOpenActions: the 8 ANUGA vector EDIT openers, the 7 legacy read-only openers,
 * and the 6 raster read-only openers (TASK-2040, epic 2037 W2, added
 * terrain_hillshade + depth_max/velocity_max/depth_integrated_velocity_max
 * to the original fri_raster_/terrain_raster pair). D6 INVARIANT: no function
 * may ride in any dispatched action or Redux state.
 *
 * HARNESS cloned from VectorDraw/__tests__/startVectorDrawClonability-test.js.
 * Three checks per kind:
 *   (a) deep function-walk — zero function values anywhere in the payload
 *   (b) structuredClone(action) does not throw DataCloneError
 *   (c) MessageChannel.port.postMessage(action) does not throw (the EXACT prod mechanism)
 *
 * FAIL MODES:
 *   - A kind's buildOpenActions returns [] (false pass): caught by the non-empty assertion.
 *   - A future opener added outside the three registrars leaks a function: caught by the
 *     live-registry-walk 'it' that enumerates getAllClickTargets() at test run time.
 */
import expect from 'expect';
import {
    registerAnugaClickTargets,
    ANUGA_VECTOR_PREFIXES
} from '../../Anuga/anugaClickTargets';
import {
    registerLegacyClickTargets,
    LEGACY_PREFIXES
} from '../../Anuga/legacyClickTargets';
import { registerRasterClickTargets } from '../../Anuga/rasterClickTargets';
import {
    getAllClickTargets,
    getClickTarget,
    cleanClickTargets
} from '../clickTargetRegistry';

// Deep walk collecting "path = name()" for every function value found.
// Cloned verbatim from startVectorDrawClonability-test.js.
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

// Register all three registrars in one call (mirrors Anuga.js module load).
const registerAll = () => {
    registerAnugaClickTargets();
    registerLegacyClickTargets();
    registerRasterClickTargets();
};

// The known raster kind strings (static; rasterClickTargets.js registers all
// of these). TASK-2040 (F7, epic 2037 W2) added terrain_hillshade (split out
// of terrain_raster's over-permissive match — see rasterClickTargets.js) and
// the 3 ANUGA result rasters (depth_max / velocity_max /
// depth_integrated_velocity_max). All are read-only value-readouts whose
// buildOpenActions is unconditionally [] — same D6/C2 no-op contract as the
// original 2.
const RASTER_KINDS = [
    'fri_raster_', 'terrain_raster', 'terrain_hillshade',
    'depth_max', 'velocity_max', 'depth_integrated_velocity_max'
];

/**
 * Build a plausible {feature, getState} for each kind so buildOpenActions actually
 * emits a non-empty action list. An opener that early-returns [] because the
 * feature/state is wrong gives a FALSE PASS — we assert non-empty per kind below.
 *
 * ANUGA EDIT: feature needs a dotted GFI id; getState is unused by startVectorDraw.
 * LEGACY read-only: feature needs a dotted id + matching layer in state.layers.flat.
 * RASTER read-only: feature needs properties.GRAY_INDEX; getState is a fallback only.
 */
const buildTestInput = (kind) => {
    if (ANUGA_VECTOR_PREFIXES.indexOf(kind) !== -1) {
        // EDIT vector opener: parseFeatureId needs <layerName>.<fid>
        return {
            feature: { id: `${kind}123_example.5`, properties: { description: 'Test' } },
            getState: () => ({})
        };
    }
    if (LEGACY_PREFIXES.indexOf(kind) !== -1) {
        // LEGACY read-only: findLayer needs the bare name in layers.flat
        const layerName = `geonode:${kind}5_x`;
        return {
            feature: { id: `geonode:${kind}5_x.1`, properties: { description: 'x' } },
            getState: () => ({
                layers: { flat: [{ name: layerName, visibility: true }] }
            })
        };
    }
    // RASTER: fri_raster_ / terrain_raster — GRAY_INDEX drives value extraction.
    const isTerrainRaster = kind === 'terrain_raster';
    return {
        feature: {
            id: '',
            properties: { GRAY_INDEX: isTerrainRaster ? 12.34 : 0.04 },
            _anugaLayerName: isTerrainRaster ? 'geonode:ele_5_dem_cog' : 'geonode:fri_raster_5'
        },
        getState: () => ({
            anuga: { resources: { cursorElevation: 12.34 } }
        })
    };
};

// ===================================================================
// SHARED CHECK HELPERS (exercised per-kind in the describes + the live
// registry walk below)
// ===================================================================

const assertNoFunctions = (action, kindLabel) => {
    const fnPaths = collectFunctionPaths(action);
    if (fnPaths.length > 0) {
        throw new Error(`${kindLabel} action has function values: ${fnPaths.join(', ')}`);
    }
    expect(fnPaths).toEqual([]);
};

const assertStructuredClone = (action) => {
    expect(() => structuredClone(action)).toNotThrow();
};

const assertMessageChannel = (action) => {
    expect(() => {
        const ch = new MessageChannel();
        ch.port1.postMessage(action);
        ch.port1.close();
        ch.port2.close();
    }).toNotThrow();
};

// ===================================================================
// TESTS
// ===================================================================

describe('buildOpenActions structured-clone safety (TASK-1999 W4.1)', () => {

    beforeEach(() => {
        cleanClickTargets();
        registerAll();
    });
    afterEach(() => cleanClickTargets());

    // ------------------------------------------------------------------
    // Sanity / family coverage gate
    // ------------------------------------------------------------------
    it('registry has >= 21 kinds covering ANUGA EDIT + LEGACY + RASTER families', () => {
        const kinds = Object.keys(getAllClickTargets());
        expect(kinds.length).toBeGreaterThan(20);  // >= 21 (8 EDIT + 7 LEGACY + 6 RASTER)
        // ANUGA EDIT family (8)
        ANUGA_VECTOR_PREFIXES.forEach((p) => {
            expect(kinds.indexOf(p)).toNotBe(-1);
        });
        // LEGACY family (7)
        LEGACY_PREFIXES.forEach((p) => {
            expect(kinds.indexOf(p)).toNotBe(-1);
        });
        // RASTER family (6, TASK-2040)
        RASTER_KINDS.forEach((p) => {
            expect(kinds.indexOf(p)).toNotBe(-1);
        });
    });

    // ------------------------------------------------------------------
    // Live registry walk: FAILS if any EDIT or LEGACY opener leaks a function
    // or silently returns []. RASTER kinds are explicitly no-ops ([]) — the
    // value is shown in label.subtitle; clicking dispatches nothing. Only the
    // EDIT+LEGACY families MUST be non-empty (a broken edit/legacy opener that
    // silently returns [] still FAILS this walk — the original false-pass guard,
    // now scoped to the families that DO emit).
    // This is the load-bearing AC#3: walks getAllClickTargets() at test
    // run time, NOT a hardcoded list, so new registrations are automatically
    // covered.
    // ------------------------------------------------------------------
    it('LIVE REGISTRY WALK: EDIT+LEGACY are non-empty and clone-safe; RASTER openers return [] (no-op)', () => {
        const targets = getAllClickTargets();
        const kinds = Object.keys(targets);
        expect(kinds.length).toBeGreaterThan(16);

        kinds.forEach((kind) => {
            const { feature, getState } = buildTestInput(kind);
            const actions = targets[kind].buildOpenActions(feature, getState);

            // Non-empty guard for EDIT+LEGACY: a broken opener silently returning []
            // is a FALSE PASS (the leak never gets serialized), so we require at
            // least one action. RASTER kinds are exempt — they are read-only
            // value-readouts whose value is shown in the panel row, so [] is correct.
            const isRaster = RASTER_KINDS.indexOf(kind) !== -1;
            if (!isRaster && actions.length === 0) {
                throw new Error(`kind "${kind}" buildOpenActions returned [] — test input is wrong or opener is broken`);
            }

            // Clone-check every emitted action (RASTER [] → forEach is a no-op,
            // trivially safe; the guard is satisfied by the [] assertion below).
            actions.forEach((action, i) => {
                assertNoFunctions(action, `kind "${kind}" action[${i}]`);
                assertStructuredClone(action);
                assertMessageChannel(action);
            });
        });
    });

    // ------------------------------------------------------------------
    // ANUGA EDIT family (8 prefixes: bdy_ inf_ fri_ rai_ mes_ str_ cul_ brk_)
    // Per-kind describes give clear failure messages if one prefix regresses.
    // ------------------------------------------------------------------
    describe('ANUGA EDIT openers (8 prefixes → startVectorDraw EDIT)', () => {

        it('covers exactly the expected ANUGA_VECTOR_PREFIXES', () => {
            expect(ANUGA_VECTOR_PREFIXES.length).toBe(8);
            ['bdy_', 'inf_', 'fri_', 'rai_', 'mes_', 'str_', 'cul_', 'brk_'].forEach((p) => {
                expect(ANUGA_VECTOR_PREFIXES.indexOf(p)).toNotBe(-1);
            });
        });

        ANUGA_VECTOR_PREFIXES.forEach((kind) => {
            describe(`EDIT "${kind}"`, () => {

                it('buildOpenActions returns a non-empty list', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    expect(actions.length).toBeGreaterThan(0);
                });

                it('action carries NO function values (D6)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertNoFunctions(a, `EDIT "${kind}"`));
                });

                it('structuredClone(action) does not throw DataCloneError', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertStructuredClone(a));
                });

                it('MessageChannel (exact prod mechanism) does not throw', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertMessageChannel(a));
                });
            });
        });
    });

    // ------------------------------------------------------------------
    // LEGACY read-only family (7 prefixes: terrain_ ele_ cat_ nod_ lin_ full_mesh_ network_)
    // ------------------------------------------------------------------
    describe('LEGACY READ-ONLY openers (7 prefixes → 6-action browseData list)', () => {

        it('covers exactly the expected LEGACY_PREFIXES', () => {
            expect(LEGACY_PREFIXES.length).toBe(7);
            ['terrain_', 'ele_', 'cat_', 'nod_', 'lin_', 'full_mesh_', 'network_'].forEach((p) => {
                expect(LEGACY_PREFIXES.indexOf(p)).toNotBe(-1);
            });
        });

        LEGACY_PREFIXES.forEach((kind) => {
            describe(`LEGACY "${kind}"`, () => {

                it('buildOpenActions returns a non-empty list (6 actions)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    expect(actions.length).toBe(6);
                });

                it('action carries NO function values (D6, C2)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertNoFunctions(a, `LEGACY "${kind}"`));
                });

                it('structuredClone(action) does not throw DataCloneError', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertStructuredClone(a));
                });

                it('MessageChannel (exact prod mechanism) does not throw', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertMessageChannel(a));
                });
            });
        });
    });

    // ------------------------------------------------------------------
    // RASTER read-only family (6 kinds: fri_raster_ terrain_raster
    // terrain_hillshade depth_max velocity_max
    // depth_integrated_velocity_max — TASK-2040 added the last 4)
    // UAT 2026-06-30: value shown in label.subtitle (panel row); clicking
    // dispatches NO action. A lone raster click falls through to the default
    // Identify popup. [] is trivially D6-safe (nothing dispatched → no function
    // can ride an action).
    // ------------------------------------------------------------------
    describe('RASTER READ-ONLY openers (6 kinds → [] no-op, value shown in label.subtitle)', () => {

        it('covers exactly the 6 expected raster kinds', () => {
            expect(RASTER_KINDS.length).toBe(6);
            ['fri_raster_', 'terrain_raster', 'terrain_hillshade',
                'depth_max', 'velocity_max', 'depth_integrated_velocity_max'].forEach((k) => {
                expect(RASTER_KINDS.indexOf(k)).toNotBe(-1);
            });
        });

        RASTER_KINDS.forEach((kind) => {
            describe(`RASTER "${kind}"`, () => {

                it('buildOpenActions returns [] (read-only no-op: value in label.subtitle, D6)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    expect(actions).toEqual([]);
                });

                it('[] carries NO function values (D6, C2 — trivially true, documented)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    // [] → forEach is a no-op; the invariant is trivially satisfied.
                    actions.forEach((a) => assertNoFunctions(a, `RASTER "${kind}"`));
                    expect(actions).toEqual([]);
                });

                it('structuredClone([]) does not throw (D6 — trivially safe)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertStructuredClone(a));
                    expect(actions).toEqual([]);
                });

                it('MessageChannel([]) does not throw (D6 — trivially safe)', () => {
                    const { feature, getState } = buildTestInput(kind);
                    const actions = getClickTarget(kind).buildOpenActions(feature, getState);
                    actions.forEach((a) => assertMessageChannel(a));
                    expect(actions).toEqual([]);
                });
            });
        });
    });
});
