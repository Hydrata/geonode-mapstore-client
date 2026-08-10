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
 */
import expect from 'expect';
import AnugaPlugin from '../Anuga';
import * as epicsAnuga from '../epicsAnuga';
import anugaReducer from '../reducersAnuga';

/*
 * Epics deliberately exported from the barrel but deliberately NOT registered.
 * An entry here is a DECISION ON RECORD, not an exemption to be handed out
 * casually — the whole point of the guard is that silence is not an option.
 *
 * createAnugaCulvertEpic (TASK-1594 W1 / diagnosed TASK-2707):
 *   Registering it would be actively WRONG, not merely unnecessary — it is not
 *   the buildScenarioEpic bug class, where a live control reached a real
 *   endpoint. Two independent reasons, both verified 2026-08-10:
 *     (a) NO BACKEND ROUTE. makeCreateEpic calls
 *         anugaApi.createResource(projectId, 'culvert', ...), and 'culvert' has
 *         no V2_PLURAL entry, so that resolves to
 *         POST /api/v2/anuga/projects/{p}/culvert/ — a route that does not
 *         exist. `grep -c culvert apps/gn_anuga/urls.py` -> 0; there is no
 *         CulvertViewSet and no culvert serializer anywhere in the monolith.
 *         makeCreateEpic swallows the failure (`.catch(() => Observable.of(null))`),
 *         so registering it buys a silent 404 per click instead of silence.
 *     (b) THE ACTION IS UNREACHABLE. INPUT_MENU_CONFIG.culverts.createProp
 *         ('createAnugaCulvert') is dead config: renderPane()'s `case 'culverts'`
 *         routes to renderCulvertPane(), the TASK-1755 (W1.8) BLANK PLACEHOLDER
 *         pane, NOT to renderCreatePane('culverts') — the only caller that
 *         consumes createProp. No live control dispatches CREATE_ANUGA_CULVERT.
 *   Culverts are drawn on the map via the independent VectorDraw WFST path
 *   (culvertTranslate.js), which this epic has nothing to do with. Delete this
 *   entry when the culvert BE endpoint + a real create control both land.
 */
const QUARANTINED_EPICS = {
    createAnugaCulvertEpic:
        'TASK-2707: no BE route (/api/v2/anuga/projects/{p}/culvert/ does not exist) ' +
        'and CREATE_ANUGA_CULVERT is dispatched by no live control (culverts pane is ' +
        'the TASK-1755 blank placeholder). Registering it would fire a swallowed 404.'
};

/*
 * Sub-slices of state.anuga that are combined in reducersAnuga.js but whose
 * modules live OUTSIDE Anuga/reducers/ (they are owned by the sibling Paywall
 * plugin directory), so the on-disk file sweep below cannot see them.
 */
const PAYWALL_SLICES = ['paywall', 'computeMeter', 'accountSummary'];

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
});
