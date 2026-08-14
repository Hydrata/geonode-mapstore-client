/**
 * THE LANDING-INTERRUPT ORDERING CONTRACT, and the introduction's own
 * eligibility rules — in ONE place (epic 2765 W3: TASK-2776 owns the ordering,
 * TASK-2774 the member/accept rules, TASK-2777 the ANUGA-context gate).
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────────
 *
 *   1. AUTHENTICATION RESOLVES FIRST.
 *   2. THE PAYWALL SECOND.
 *   3. THE INTRODUCTION LAST.
 *
 * Two modals must never race on landing, and the order is a CONTRACT rather
 * than an accident of mount order. It is expressed as one function —
 * `introductionVerdict` — that returns exactly one of three answers, so a
 * FOURTH interrupt added later has an obvious place to slot in: a new WAIT
 * clause, above the SHOW, in the numbered order below.
 *
 *   WAIT     — something ahead of the introduction in the queue is still
 *              unresolved or on screen. Not "no": ask again later.
 *   SUPPRESS — this viewer is not owed the introduction at all. Terminal.
 *   SHOW     — every predecessor has cleared and this viewer has not accepted
 *              the current content.
 *
 * WHY A THREE-VALUED ANSWER RATHER THAN A BOOLEAN: a boolean collapses "not
 * yet" into "no", and the failure that collapse produces is invisible in dev
 * (where you are logged in, a member, and past the paywall) and lands on
 * exactly the anonymous link-recipient this epic exists to serve.
 *
 * ── WHAT "AUTH RESOLVED" MEANS HERE, PRECISELY ───────────────────────────────
 *
 * Not "the security slice is populated". The question this gate actually has to
 * answer is *do we know enough about who is looking to decide member vs
 * non-member*, and the two halves resolve at different times:
 *
 *   ANONYMOUS — resolved IMMEDIATELY. `AppUtils.js` awaits `getAccountInfo()`
 *     before the store is created, so an absent `state.security.user` at epic
 *     time is a settled answer, not a pending one. And an anonymous viewer is
 *     a non-member by definition; there is nothing further to learn.
 *
 *   LOGGED IN — resolved only when `state.anuga.projects.data` describes THIS
 *     project, because `my_role` is what separates member from non-member and
 *     it arrives with `SET_ANUGA_PROJECT_DATA` (initAnugaEpic, which is itself
 *     login-gated). Until then a member would be flashed a modal they are
 *     supposed to never auto-see.
 *
 * ⚠ AND IT MUST DESCRIBE *THIS* PROJECT. `state.anuga.projects.data` is the
 * ANUGA panel's LAST-loaded project and is NOT reset on SPA navigation, so it
 * is stale-but-truthy after a hop to another map. Trusting its truthiness is
 * the exact TASK-2427 bug that paired one map's layers with the previous
 * project's id for months. Here the same mistake would let a member of project
 * A silently bypass project B's disclaimer. So the role is only ever read when
 * the loaded project id equals the project the introduction payload is FOR.
 *
 * ── WHY THE PAYWALL CHECK LOOKS LIKE THIS ────────────────────────────────────
 *
 * `upgrade_prompt` is the ONE blocking state the Paywall renders (PaywallPanel
 * renders null for every other contract state), and it is hosted in a
 * body-level ModalHost with a focus trap and a click-absorbing backdrop. A
 * second dialog opening behind it is not merely untidy — it is unreachable.
 *
 * The check is ANDed with the plugin's own kill-switch, read from the Paywall
 * entry's `cfg.paywallEnabled` in localConfig. That is not belt-and-braces: it
 * is what makes "turning the paywall off still yields a correct auth ->
 * introduction order" true rather than hoped for. With the switch off
 * PaywallPanel renders null whatever the slice says, so waiting on the slice
 * would be waiting on a dialog that can never appear.
 *
 * ── WHY THE ANUGA-CONTEXT GATE IS A localConfig READ ─────────────────────────
 *
 * Settled decision 1: gn_anuga Projects only. There is ONE MapStore build
 * fleet-wide, so the gate cannot be "which build is this". It is "which
 * plugins is this site running": the `Anuga` plugin appears in the `map_viewer`
 * block of hydrata.com's config and of NO other site's —
 * theswamm.com/sararaportal.com/nicaraguahydroportal.com ship SimpleView
 * WITHOUT Anuga (ansible/playbooks/roles/ansible-geonode/files/*.json, verified
 * 2026-08-14). `simpleViewContainer` already reads the same array for
 * `searchPluginPresent` / `measurePluginPresent` / `hgevalPluginPresent`; this
 * is that established idiom, not a new mechanism.
 *
 * That is the SITE gate. The MAP gate is the introduction fetch itself: the
 * project id is resolved through `POST /projects/from-map/`, which 404s for a
 * map no ANUGA project owns — so a plain GeoNode map on hydrata.com never gets
 * a payload and therefore never reaches SHOW.
 */
import { getEffectivePaywallPayload } from '../Paywall/reducer';

export const INTRODUCTION_SHOW = 'show';
export const INTRODUCTION_WAIT = 'wait';
export const INTRODUCTION_SUPPRESS = 'suppress';

const mapViewerPlugins = (state) => state?.localConfig?.plugins?.map_viewer || [];

const pluginEntry = (state, name) => mapViewerPlugins(state).find(p => p?.name === name);

/** Settled decision 1 — is this an ANUGA site at all? See the header. */
export const isAnugaContext = (state) => !!pluginEntry(state, 'Anuga');

/**
 * Can the Paywall's blocking modal appear on this site at all? Mirrors
 * `PaywallPanel`'s own kill-switch, read from the same localConfig cfg that
 * MapStore spreads into the plugin as `paywallEnabled`.
 */
export const isPaywallArmed = (state) => !!pluginEntry(state, 'Paywall')?.cfg?.paywallEnabled;

/** Is the Paywall's one blocking dialog on screen right now? */
export const isPaywallBlocking = (state) =>
    isPaywallArmed(state) && getEffectivePaywallPayload(state)?.state === 'upgrade_prompt';

/** The introduction slice, or an empty object. */
const introductionSlice = (state) => state?.simpleView?.introduction || {};

/**
 * Does `state.anuga.projects.data` describe the project the introduction
 * payload is for? See the TASK-2427 warning in the header — an unstamped or
 * mismatched slice is treated as "we do not know", never as "not a member".
 *
 * ⚠ DELIBERATELY NOT `selectorsAnuga.describesLoadedProject`, which looks like
 * the same question and answers the opposite way. That helper's rule is
 * "refuse only a stamp that POSITIVELY disagrees", so an unknown reads THROUGH
 * — correct for its callers, where refusing an unstamped paywall payload would
 * discard it outright. Here an unknown must NOT read through: reading through
 * would let a viewer whose role has not arrived be treated as having one, and
 * the modal would be suppressed for someone who has never seen it. So this
 * requires a POSITIVE match. Same shape, inverted default, on purpose.
 */
export const roleDescribesIntroductionProject = (state) => {
    const introProjectId = introductionSlice(state).projectId;
    const loadedId = state?.anuga?.projects?.data?.id;
    if (!introProjectId || !loadedId) return false;
    return String(loadedId) === String(introProjectId);
};

/**
 * Settled decision 2 — "member" is the owner plus every ProjectMembership
 * holder, which is exactly the set for which the server computes a non-null
 * `my_role` (`ProjectSerializerV2.get_my_role` returns None for anonymous AND
 * for an authenticated non-member, even on a public project).
 */
export const isIntroductionProjectMember = (state) =>
    roleDescribesIntroductionProject(state) && !!state?.anuga?.projects?.data?.my_role;

/**
 * Has THIS viewer accepted the CURRENT content version?
 *
 * A VERSION COMPARISON, never an "ever accepted" boolean: any owner edit
 * changes `content_version`, and an edit must re-prompt everyone who accepted
 * the previous text.
 *
 *   authenticated — `accepted_current_version`, computed server-side against
 *                   the version it served in the same payload.
 *   anonymous     — `acceptedVersion`, seeded from localStorage at fetch time
 *                   and updated on accept (see introductionStorage.js).
 *
 * The session-accept also lands in `acceptedVersion`, so the modal does not
 * re-show after the click without waiting for a refetch.
 */
export const hasAcceptedCurrentIntroduction = (state) => {
    const { data, acceptedVersion } = introductionSlice(state);
    if (!data) return false;
    if (data.accepted_current_version === true) return true;
    return !!data.content_version && acceptedVersion === data.content_version;
};

/**
 * THE GUARD. Pure — every input is passed in, so the contract can be tested
 * without a store and read without chasing selectors.
 *
 * @param {boolean} anugaContext     settled decision 1 (see header)
 * @param {boolean} loggedIn         is there an authenticated viewer
 * @param {boolean} roleResolved     does the loaded ANUGA project describe THIS project
 * @param {boolean} paywallBlocking  is the paywall's blocking dialog on screen
 * @param {boolean} payloadLoaded    has the introduction payload arrived
 * @param {boolean} isMember         owner or ProjectMembership holder
 * @param {boolean} hasAccepted      accepted the CURRENT content version
 * @returns {'show'|'wait'|'suppress'}
 */
export function introductionVerdict({
    anugaContext,
    loggedIn,
    roleResolved,
    paywallBlocking,
    payloadLoaded,
    isMember,
    hasAccepted
}) {
    // 0. Not an ANUGA site: SWAMM / Sarara / NICP carry the same build and must
    //    never show this. Terminal, and checked first so nothing below can
    //    accidentally reach a non-ANUGA viewer.
    if (!anugaContext) return INTRODUCTION_SUPPRESS;

    // 1. AUTHENTICATION RESOLVES FIRST. Anonymous is resolved on arrival; a
    //    logged-in viewer is not resolved until their role for THIS project is
    //    known. See the header for why that is the right reading of "auth".
    if (loggedIn && !roleResolved) return INTRODUCTION_WAIT;

    // 2. THE PAYWALL SECOND. Its refusal dialog is modal, focus-trapped and
    //    backdrop-absorbing; anything opened behind it is unreachable.
    if (paywallBlocking) return INTRODUCTION_WAIT;

    // 2b. The payload itself. Ordered after the paywall so a slow introduction
    //     fetch can never be mistaken for "the paywall has cleared".
    if (!payloadLoaded) return INTRODUCTION_WAIT;

    // 3. THE INTRODUCTION LAST — and only for the audience it is for.
    //    Settled decision 2: members never auto-see it (they can still reopen
    //    it from the toolbar); non-members see it every session until they
    //    accept the CURRENT content.
    if (isMember) return INTRODUCTION_SUPPRESS;
    if (hasAccepted) return INTRODUCTION_SUPPRESS;

    return INTRODUCTION_SHOW;
}

/** `introductionVerdict` bound to the store. */
export const introductionVerdictFor = (state) => introductionVerdict({
    anugaContext: isAnugaContext(state),
    loggedIn: !!state?.security?.user,
    roleResolved: roleDescribesIntroductionProject(state),
    paywallBlocking: isPaywallBlocking(state),
    payloadLoaded: !!introductionSlice(state).data,
    isMember: isIntroductionProjectMember(state),
    hasAccepted: hasAcceptedCurrentIntroduction(state)
});
