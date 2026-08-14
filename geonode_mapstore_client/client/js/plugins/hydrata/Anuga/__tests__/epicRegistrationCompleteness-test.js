/*
 * TASK-2707 (epic 2706 W1.1) — REGISTRATION-COMPLETENESS GUARD.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * MapStore2 plugin epics/reducers are registered by EXPLICIT ENUMERATION inside
 * createPlugin()'s `epics: {}` / `reducers: {}` maps (Anuga.js). Adding an epic
 * to the epicsAnuga.js barrel does NOT register it — a barrel export alone is
 * DEAD CODE AT RUNTIME: the epic never subscribes to the action stream, so the
 * action it listens for is dispatched into a stream with no listener. There is
 * no error, no toast, no request. The feature is silently, invisibly dead.
 *
 * The rest of the karma suite is STRUCTURALLY BLIND to this class of defect,
 * because every epic spec imports the epic function directly (e.g.
 * `require('../epics/crudEpics')`) and drives it by hand. That proves the epic
 * WORKS; it cannot prove the epic RUNS. Both known instances shipped green:
 *
 *   TASK-2577 (2026-07-30, epic 2580) pruneSupersededCheckedTerrainsEpic —
 *       6 passing specs, never registered, never ran live. Fixed in gmc
 *       801639aa4 by adding it to Anuga.js's import block + epics map.
 *   TASK-2707 (2026-08-10, epic 2706) buildScenarioEpic — the Build /
 *       Build-and-Run button had been a no-op in production for the epic's
 *       whole life. Dispatching BUILD_SCENARIO into the LIVE prod store
 *       produced ZERO requests: nothing was listening.
 *
 * Twice in six weeks. This guard converts "discovered months later by a user
 * whose button does nothing" into a red build on the commit that causes it.
 *
 * WHAT IT ASSERTS
 * ---------------
 *   1. Every function exported from the epicsAnuga.js barrel is a key in the
 *      Anuga plugin's `epics: {}` map (or is explicitly quarantined below).
 *   2. The quarantine list is honest in BOTH directions — each entry is still
 *      a real barrel export (so the list cannot rot), and is still absent from
 *      the epics map (so registering one forces its removal from the list).
 *   3. + 4. The same explicit-enumeration trap on the `reducers: {}` side:
 *      every reducer module on disk is actually folded into the plugin's state.
 *   5. + 6. (TASK-2733, epic 2706 W3) The DISK sweep and the naming convention
 *      that makes it trustworthy — see the block comment above spec 5.
 */
import expect from 'expect';
import AnugaPlugin from '../Anuga';
import * as epicsAnuga from '../epicsAnuga';
import anugaReducer from '../reducersAnuga';
/*
 * TASK-2733 — TerrainWorkbench is DECIDED, NOT SILENT (AC10).
 * The tw*Epic functions live in a sibling plugin directory but this plugin is
 * their REGISTRAR (Anuga.js imports them and lists them in its own `epics: {}`
 * map), so the same dead-at-runtime trap applies to them verbatim. They are
 * therefore IN SCOPE and swept below. It is a single module rather than a
 * directory, so it is pulled in as a namespace import rather than a
 * require.context. Anuga.js already imports it, so this adds no module to the
 * karma bundle that the `import AnugaPlugin from '../Anuga'` above did not
 * already load.
 */
import * as epicsTerrainWorkbench from '../../TerrainWorkbench/epicsTerrainWorkbench';

/*
 * Epics deliberately exported from the barrel but deliberately NOT registered.
 * An entry here is a DECISION ON RECORD, not an exemption to be handed out
 * casually — the whole point of the guard is that silence is not an option.
 *
 * IT IS EMPTY, AND KEEPING IT EMPTY IS THE POINT (TASK-2742, W5 epic 2706).
 *
 * This guard was born with exactly one entry, createAnugaCulvertEpic, and that
 * was always uncomfortable: epic 2706's own root cause (TASK-2707) was
 * buildScenarioEpic being barrel-exported but unregistered, which made the
 * Build button a production no-op for the epic's entire life. A guard written
 * in response to that, shipped with an exemption already in it, has conceded
 * the first case before it starts.
 *
 * The culvert epic could not simply be registered, because registering it
 * would have been actively wrong rather than merely unnecessary:
 *   (a) THE ACTION WAS UNREACHABLE. renderPane()'s `case 'culverts'` routed to
 *       renderCulvertPane(), the TASK-1755 blank placeholder, NOT to
 *       renderCreatePane() — the only consumer of CREATE_PANE_CONFIG's
 *       createProp. Nothing anywhere dispatched CREATE_ANUGA_CULVERT.
 *   (b) THERE WAS NO BACKEND ROUTE EITHER. makeCreateEpic called
 *       anugaApi.createResource(projectId, 'culvert', ...), and 'culvert' had
 *       no V2_PLURAL entry, so it resolved to the singular
 *       POST /api/v2/anuga/projects/{p}/culvert/ — a route that does not
 *       exist, and whose failure makeCreateEpic swallows.
 * So (a) makes the 404 in (b) HYPOTHETICAL rather than latent: no click could
 * ever have reached it. Both had to be true for the quarantine to be the right
 * call, and both are stated here because the earlier version of this block
 * implied the epic was one registration away from firing 404s, which it was
 * not. (That version also named `INPUT_MENU_CONFIG.culverts.createProp`, a
 * const that has never existed; the real name is CREATE_PANE_CONFIG.)
 *
 * TASK-2742 resolved it the honest way: it retired the affordance instead of
 * exempting the epic. The rail item, the placeholder pane, the action
 * creators, the epic and the two i18n strings are all gone; the Culvert model,
 * its migrations, the reserved layer rank and the whole VectorDraw cul_ draw
 * path are deliberately untouched and ready for a future culvert epic.
 *
 * The result is a guard that protects every epic uniformly, with nothing
 * excused. If you are about to add an entry here, that is the bar: a case that
 * genuinely cannot be registered AND cannot be retired.
 */
const QUARANTINED_EPICS = {};

/*
 * Sub-slices of state.anuga that are combined in reducersAnuga.js but whose
 * modules live OUTSIDE Anuga/reducers/ (they are owned by the sibling Paywall
 * plugin directory), so the on-disk file sweep below cannot see them.
 */
const PAYWALL_SLICES = ['paywall', 'computeMeter', 'accountSummary'];

/*
 * TASK-2733 — the ONE registered epic whose name does not end in `Epic`.
 * updateAnugaModelTitle (epics/crudEpics.js) is a genuine, live, registered
 * epic. The disk sweep below filters exported names with /Epic$/, so this
 * allowlist is what keeps that filter HONEST: spec 6 fails the moment a
 * SECOND off-convention epic is registered, which is the moment the /Epic$/
 * filter would start hiding real epics from the sweep.
 *
 * RESIDUAL GAP, ON RECORD: an epic that is BOTH off-convention (name does not
 * end in `Epic`) AND unregistered stays invisible to spec 5 — the sweep cannot
 * see it and spec 6 only inspects what IS registered. Detecting it by VALUE
 * shape is unreliable (rx epics are plain arrow functions, indistinguishable
 * from any other exported helper), so the naming-convention assertion is the
 * mitigation rather than the cure.
 */
const OFF_CONVENTION_REGISTERED_EPICS = ['updateAnugaModelTitle'];

/*
 * TASK-2733 — collect every /Epic$/-suffixed export of every module a
 * require.context saw, tagged with the module it came from so a failure is
 * actionable without opening this file (AC7).
 */
const sweepContext = (dirLabel, ctx) => {
    const found = [];
    ctx.keys().forEach((key) => {
        const mod = ctx(key);
        Object.keys(mod)
            .filter((name) => /Epic$/.test(name))
            .forEach((name) => found.push({
                name,
                module: `${dirLabel}/${key.replace(/^\.\//, '')}`
            }));
    });
    return found;
};

describe('TASK-2707 — Anuga plugin registration completeness', () => {

    it('registers EVERY epic exported from the epicsAnuga.js barrel', () => {
        const registered = Object.keys(AnugaPlugin.epics);
        const exported = Object.keys(epicsAnuga)
            .filter((name) => typeof epicsAnuga[name] === 'function');

        // Sanity floor: if the barrel ever resolves to an empty/among-mocked
        // module the comparison below would trivially "pass" against nothing.
        // Prove the detector has something to look at before trusting its zero.
        expect(exported.length > 50).toBe(true);
        expect(registered.length > 50).toBe(true);

        const missing = exported.filter(
            (name) => registered.indexOf(name) === -1
                && !Object.prototype.hasOwnProperty.call(QUARANTINED_EPICS, name)
        );

        // A non-empty `missing` means those epics are DEAD AT RUNTIME: exported,
        // unit-tested, never subscribed. Fix by adding each name to BOTH the
        // named-import block AND the `epics: {}` map in Anuga.js — or, if it is
        // deliberately dormant, to QUARANTINED_EPICS above with the reason.
        expect(missing).toEqual([]);
    });

    it('keeps the epic quarantine list honest in both directions', () => {
        // TASK-2742 (epic AC17) — the list is EMPTY and must stay empty. This
        // assertion is the forcing function: a future exemption cannot be
        // slipped in quietly alongside the code it excuses, it has to come
        // here and change this number, in a diff someone reviews.
        expect(Object.keys(QUARANTINED_EPICS).length).toBe(0);
        // ...and the epic that used to be the sole entry is genuinely retired,
        // not merely un-listed.
        expect(epicsAnuga.createAnugaCulvertEpic).toNotExist();
        // POSITIVE CONTROL: the barrel really did load, so the assertion above
        // is reporting an absence rather than an empty module.
        expect(typeof epicsAnuga.createAnugaStructureEpic).toBe('function');

        Object.keys(QUARANTINED_EPICS).forEach((name) => {
            // Still a real export? If not, the entry is stale — delete it.
            expect(typeof epicsAnuga[name]).toBe('function');
            // Still unregistered? If it HAS been registered, the reason on
            // record no longer holds — delete the entry so the sweep above
            // starts protecting it like every other epic.
            expect(Object.keys(AnugaPlugin.epics).indexOf(name)).toBe(-1);
            // Every quarantine entry must carry a reason.
            expect(QUARANTINED_EPICS[name].length > 20).toBe(true);
        });
    });

    it('folds EVERY reducer module under Anuga/reducers/ into the anuga slice', () => {
        // Non-recursive, so reducers/__tests__/ is excluded by construction.
        const reducerFiles = require.context('../reducers', false, /Reducer\.js$/);
        const onDisk = reducerFiles.keys();

        const anugaState = anugaReducer(undefined, { type: '@@TASK-2707/PROBE' });
        const slices = Object.keys(anugaState);

        PAYWALL_SLICES.forEach((slice) => {
            expect(slices.indexOf(slice) > -1).toBe(true);
        });

        // combineReducers erases the identity of its inputs, so the honest
        // check is arity: one slice per reducer module on disk, plus the three
        // Paywall-owned slices. A new reducers/fooReducer.js that nobody added
        // to reducersAnuga.js's combineReducers() call moves the file count
        // without moving the slice count, and this fails naming both numbers.
        expect(onDisk.length + PAYWALL_SLICES.length).toBe(slices.length);
    });

    it('registers EVERY playback reducer module as a top-level plugin reducer', () => {
        const playbackFiles = require.context('../playback/reducers', false, /Reducer\.js$/);
        const registeredReducers = Object.keys(AnugaPlugin.reducers)
            .map((key) => AnugaPlugin.reducers[key]);

        // These are registered top-level (not combined), so identity survives
        // and we can assert the exact function object is wired in.
        playbackFiles.keys().forEach((key) => {
            const mod = playbackFiles(key);
            const fn = mod.default || mod;
            expect(registeredReducers.indexOf(fn) > -1).toBe(true);
        });
        expect(playbackFiles.keys().length > 0).toBe(true);
    });

    /*
     * TASK-2733 (epic 2706 W3) — THE DISK SWEEP.
     *
     * Spec 1 above sweeps the epicsAnuga.js barrel's RUNTIME exports. That is
     * a real guard, but it has one structural blind spot: Anuga.js pulls epics
     * from EIGHT sources, and the barrel is only one of them. 41 registered
     * epics never touch the barrel at all — 32 imported straight from modules
     * under epics/ and playback/epics/, plus the 9 tw*Epic names from
     * ../TerrainWorkbench/epicsTerrainWorkbench. Spec 1 therefore CANNOT SEE
     * an epic module that exists on disk and was never wired up, which is
     * exactly the TASK-2577 / TASK-2707 bug class it exists to catch.
     *
     * The whole playback/epics/ subtree — the code epic 2706 is actively
     * writing — lives in that blind spot (`grep -c playback epicsAnuga.js` ->
     * 0). The drift has already happened once: playbackDisposeEpic landed in
     * gmc 0ab6d1c9f (TASK-2744) and WAS registered correctly, but spec 1 was
     * structurally incapable of verifying that.
     *
     * So this spec asserts DISK -> REGISTERED, deliberately NOT disk -> barrel.
     * Demanding barrel membership would go red naming 41 perfectly healthy
     * epics and would churn 41 imports for zero runtime gain — the barrel is a
     * convenience index, not the registrar. `AnugaPlugin.epics` IS the
     * registrar, and it is the only thing that decides whether an epic runs.
     *
     * Non-recursive (`false`) on both contexts is MANDATORY, exactly as the
     * reducers sweep above: it excludes epics/__tests__/ and
     * playback/epics/__tests__/ by construction.
     *
     * Exemptions reuse the EXISTING QUARANTINED_EPICS map — there is
     * deliberately no second exemption list to keep in sync.
     */
    it('registers EVERY epic module ON DISK under epics/ and playback/epics/', () => {
        const registered = Object.keys(AnugaPlugin.epics);

        // Literal args: require.context is resolved by webpack at BUILD time.
        const fromEpicsDir = sweepContext('epics', require.context('../epics', false, /\.js$/));
        const fromPlaybackDir = sweepContext(
            'playback/epics', require.context('../playback/epics', false, /\.js$/)
        );
        const fromTerrainWorkbench = Object.keys(epicsTerrainWorkbench)
            .filter((name) => /Epic$/.test(name))
            .map((name) => ({ name, module: '../TerrainWorkbench/epicsTerrainWorkbench.js' }));

        // Sanity floors, mirroring spec 1: an empty, mocked or mis-resolved
        // context would otherwise make the comparison below pass against
        // nothing. Prove the detector has something to look at before trusting
        // its zero. STRICT INEQUALITIES ON PURPOSE — do NOT tighten these into
        // equalities: the playback count legitimately moved 6 -> 7 when
        // playbackDisposeEpic landed, and every new epic moves them again.
        expect(registered.length > 50).toBe(true);
        expect(fromEpicsDir.length > 90).toBe(true);
        expect(fromPlaybackDir.length > 4).toBe(true);
        expect(fromTerrainWorkbench.length > 5).toBe(true);

        // A non-empty result means those epics are DEAD AT RUNTIME: on disk,
        // probably unit-tested, never subscribed. Fix by adding each name to
        // BOTH the named-import block AND the `epics: {}` map in Anuga.js —
        // or, if it is deliberately dormant, to QUARANTINED_EPICS above with
        // the reason on record.
        const unregistered = fromEpicsDir
            .concat(fromPlaybackDir)
            .concat(fromTerrainWorkbench)
            .filter(({ name }) => registered.indexOf(name) === -1
                && !Object.prototype.hasOwnProperty.call(QUARANTINED_EPICS, name))
            .map(({ name, module }) => `${name} (${module})`)
            .sort();

        expect(unregistered).toEqual([]);
    });

    /*
     * TASK-2733 — what makes the /Epic$/ filter above trustworthy. See the
     * OFF_CONVENTION_REGISTERED_EPICS comment for the residual gap this
     * mitigates but does not close.
     */
    it('registers only epics whose key ends in "Epic" (keeps the /Epic$/ disk filter honest)', () => {
        const registered = Object.keys(AnugaPlugin.epics);
        expect(registered.length > 50).toBe(true);

        const offConvention = registered.filter(
            (name) => !/Epic$/.test(name)
                && OFF_CONVENTION_REGISTERED_EPICS.indexOf(name) === -1
        );

        expect(offConvention).toEqual([]);
    });
});
