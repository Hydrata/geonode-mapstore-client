/**
 * Paywall selectors — the viewer-capability gate and the steady-state reader.
 *
 * TASK-2462 (epic 2425), DECIDED by the operator at the W2 test gate:
 *   "task 2462 needs to be gated to users who own or are part of the
 *    organisation that owns a project."
 * i.e. option B — gate the paywall indicator to viewers for whom the project's
 * paid/private status is actually their concern. Everyone else sees nothing.
 *
 * TASK-2484 (W2.7) WIDENED THE PROJECT HALF TO MANAGER+, operator-decided:
 *   "managers should see the padlock." It was owner-only, and that was wrong in
 *   the direction that costs money rather than the safe one. The BACKEND gate on
 *   the visibility write is MANAGER+ (gn_anuga/api_v2.py: check_project_role,
 *   min_role=ProjectMembership.Role.MANAGER) and the entitlement check charges
 *   REQUEST.USER's account (_check_private_entitlement_response ->
 *   resolve_account_for_user). So a manager could flip a project to Private, be
 *   BILLED FOR IT, and later receive past_due refusals, while never being shown
 *   a padlock or a lapse notice. The indicator now covers everyone the write
 *   gate covers — no more, no less.
 *
 * ⚠ THIS GATE IS STILL HALF-IMPLEMENTED, ON PURPOSE, AND THE MISSING HALF IS A
 *   BACKEND GAP — NOT AN OVERSIGHT. See TASK-2471.
 *
 *   IMPLEMENTED: owner or manager (my_role; the backend returns 'owner' for
 *   superusers — sync.py steps 2-3).
 *
 *   NOT IMPLEMENTED: "member of the OWNING ORGANISATION". That is not
 *   derivable on the frontend today, and it is not a close call:
 *     - my_perms returns {my_role, visibility, ...per-resource perms} —
 *       no owner identity, no organisation (gn_anuga/api_v2.py:420-490).
 *     - ProjectSerializerV2 sends id, name, projection, simple_view_config,
 *       visibility, owner_username, my_role. Project.account (FK to
 *       commerce.Account, which is where an organisation would hang) exists on
 *       the model and is NOT serialized (serializers_v2.py:570-601).
 *     - GeoNode's UserSerializer sends no groups and no organisation.
 *     - state.anuga.accountSummary.organisation is the VIEWER'S OWN billing
 *       org (commerce/account_views.py:122-124), not the project's. Comparing
 *       it to anything about the project is impossible because the project
 *       side is never sent.
 *     - There is no server-side concept of "the owning organisation of a
 *       project" in gn_anuga at all: TASK-859 removed the org auto-fold, so
 *       visibility='organization' grants zero implicit access and access is
 *       invite-driven via explicit ProjectMembership rows only (sync.py:139-171).
 *
 *   So the org half needs a NEW backend field on my_perms (see TASK-2471).
 *   Until it lands this gate UNDER-shows: an org colleague with no
 *   ProjectMembership sees no padlock. That is the safe direction. The unsafe
 *   direction — falling back to "any authenticated viewer", or to
 *   my_role !== null — is precisely the mislead this epic exists to remove: it
 *   would show a paid-tier indicator to people who cannot act on it.
 *
 * CONSISTENCY WITH THE W1 DESTINATION GATE (TASK-2431): now EXACT rather than
 * merely safe. The backend WRITE gate is owner/manager and so is this, so nobody
 * is shown a paid-tier state they cannot act on, and nobody who can act on it
 * (and be billed for it) is left without the signal. This wave adds no second
 * make-private CTA; the action stays in Account > Sharing.
 *
 * A RETRACTION (TASK-2463, epic 2425 W2.8). W2.7 wrote here that the Sharing
 * panel's visibility section is "gated MORE LOOSELY than either of them" because
 * membershipPanel.js's _deriveCanAdd was owner/manager OR any membership row
 * carrying `change_resourcebase_permissions`, so "an editor with that perm sees
 * the visibility radios and is then refused 403". THAT DIVERGENCE DID NOT EXIST,
 * and the claim spawned TASK-2485 on a non-existent bug (since archived).
 *
 * Why it was wrong: `m.perms` is not the row user's perms. MembershipSerializerV2
 * gets them from _PermsFieldMixin.get_perms -> get_user_resource_perms_batch(
 * project, REQUEST.USER), which derives ONE perm list from the REQUESTING user's
 * role and stamps it on every row (sync.py). And
 * `change_resourcebase_permissions` exists only in _ROLE_PERMS[MANAGER] and
 * _OWNER_PERMS. So the second branch could only be true when the reader was
 * already owner or manager: a strict subset of the first, never a widening.
 * W2.8 deleted that branch as dead code, so the Sharing gate and this one are
 * now visibly the same predicate.
 *
 * The reason for stating the retraction rather than just deleting the paragraph:
 * a comment asserting the FE is the looser gate invites a future change to
 * "tighten" it, and it already produced one backlog task. What survives from
 * W2.7's reasoning is the principle, which is sound and still applies: an
 * INDICATOR must track the WRITE gate, because a padlock is a statement about
 * billing.
 */
import { canManageAnugaMap } from '../Anuga/selectorsAnuga';
import { getPaywallSteady } from './reducer';

/**
 * TASK-2462 gate (widened to MANAGER+ by TASK-2484): may this viewer see the
 * project's visibility indicator?
 *
 * Reads the EXISTING canManageAnugaMap rather than re-listing the roles, so this
 * adds no new copy of the owner/manager list that could drift from the backend's
 * min_role. To be precise about what that does and does not achieve:
 * selectorsAnuga.js ALREADY carries two identical copies of that list
 * (canManageAnugaMap and canManageMembers), which is pre-existing and untouched
 * here — this reuse avoids making it three, it does not collapse the two.
 *
 * Widen this — and ONLY this — when the backend ships the owning-organisation
 * signal (TASK-2471); every consumer reads through here.
 */
export const canSeeVisibilityIndicator = (state) => canManageAnugaMap(state);

/**
 * The paywall STEADY state literal (free_public / paid_private /
 * paid_organization / past_due), or null.
 *
 * Deliberately reads `steady` and NOT getEffectivePaywallPayload: the latter
 * is `overlay || steady`, and the FE-only overlays (upgrade_prompt, pending)
 * would mask the server's entitlement view. A transient "you just clicked
 * subscribe" must not silently change what the padlock claims about the
 * account's standing.
 *
 * TASK-2463 (W2.7) — delegates to reducer.js's getPaywallSteady rather than
 * reaching into the slice, so the "does this steady state describe the project
 * on screen" guard has ONE implementation shared with
 * getEffectivePaywallPayload. Reading state.anuga.paywall.steady directly here
 * is what allowed the padlock to pair B's visibility with A's lapse.
 */
export const getPaywallSteadyState = (state) => {
    const steady = getPaywallSteady(state);
    return (steady && steady.state) || null;
};

/**
 * True when the VIEWING USER'S OWN account has no paid private entitlement
 * (server steady state past_due).
 *
 * The name is a compromise inherited from TASK-2099 and the docstring is the
 * correction: `past_due` is derived from `_get_acting_account(request.user)`
 * (gn_anuga/api_v2.py::_derive_paywall_state), so it is a statement about the
 * READER, not about the project or its owner. Anything that phrases it as a fact
 * about the project must go through showsVisibilityLapse below.
 */
export const isPaywallPastDue = (state) => getPaywallSteadyState(state) === 'past_due';

/**
 * ⚠ THERE IS NO `showsVisibilityLapse` HERE ANY MORE (TASK-2463, epic 2425
 * W2.9), and the reason is worth the paragraph, because two waves in a row
 * reached for one.
 *
 * The padlock used to annotate itself "(subscription lapsed)" at `past_due`.
 * That is a claim about THE PROJECT. `past_due` is not: `_derive_paywall_state`
 * resolves `_get_acting_account(user)` and never `project.account`, so it says
 * only "the reader's own account is unentitled".
 *
 * W2.8 tried to rescue the claim with an ownership predicate — `isPaywallPastDue
 * && _viewerOwnsProject` — on the reasoning that for the owner the two
 * statements coincide. They do not. The backend write gate is min_role=MANAGER
 * (gn_anuga/api_v2.py) and `_check_private_entitlement_response` charges
 * REQUEST.USER, so a MANAGER can privatise a project on the manager's own live
 * subscription. The owner of that project, unsubscribed themselves, then reads
 * `past_due` — and was told THEIR project's subscription had lapsed. That state
 * is byte-identical to a genuinely lapsed owner's, so no predicate over it can
 * separate the two. Ownership did not attribute the claim; it relocated the
 * falsehood.
 *
 * Nor can the frontend repair it from elsewhere: `Project.account` is not
 * serialized anywhere (serializers_v2.py) and is NULL on all 166 production
 * projects (verified read-only 2026-07-26), so even shipping it would answer
 * nothing for the live estate.
 *
 * So the claim is withdrawn rather than re-predicated. The padlock states the
 * visibility; `isPaywallPastDue` above remains for callers that want to speak
 * about the READER'S OWN standing, which is what it actually reports, and the
 * place that does so truthfully today is Account > Billing (BillingTabPanel's
 * SubscriptionSection), which reads the account's own subscription and also
 * carries the renew action.
 *
 * ⚠ WHAT IS STILL OPEN, and is NOT pre-empted here. (i) TASK-2487 — `past_due`
 * collapses "lapsed" and "never subscribed", and on day one at flip the second
 * is the case for all 84 non-public prod owners; any replacement notice has to
 * settle that wording. (ii) Epic decision W2.7-D4 — which account governs a
 * project's paid standing, and whether Project.account should be populated at
 * creation. Withdrawing an unattributable claim is what is safe under BOTH;
 * re-adding an attributable one is what they decide. TASK-2487 has been widened
 * to own the mirror case described above as well.
 */
