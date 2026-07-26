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
 * THAT SHARING SECTION IS GATED MORE LOOSELY THAN EITHER OF THEM, and this gate
 * deliberately does NOT copy it. membershipPanel.js's renderVisibilitySection
 * (:219) gates on `canAdd` = _deriveCanAdd (:676), which is owner/manager OR any
 * membership row carrying `change_resourcebase_permissions` — so an editor with
 * that perm sees the visibility radios and is then refused 403 by
 * check_project_role's min_role=MANAGER. Pre-existing, not introduced here, and
 * filed as TASK-2485 rather than quietly matched: the INDICATOR must track the
 * write gate, because a padlock is a statement about billing, whereas an
 * affordance being too generous is a separate (real) bug in the other direction.
 * Matching _deriveCanAdd here would have propagated it instead of exposing it.
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

/** True when the account's subscription has lapsed (server steady state). */
export const isPaywallPastDue = (state) => getPaywallSteadyState(state) === 'past_due';
