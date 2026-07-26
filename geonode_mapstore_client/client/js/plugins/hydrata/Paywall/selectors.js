/**
 * Paywall selectors — the viewer-capability gate and the steady-state reader.
 *
 * TASK-2462 (epic 2425), DECIDED by the operator at the W2 test gate:
 *   "task 2462 needs to be gated to users who own or are part of the
 *    organisation that owns a project."
 * i.e. option B — gate the paywall indicator to viewers for whom the project's
 * paid/private status is actually their concern. Everyone else sees nothing.
 *
 * ⚠ THIS GATE IS HALF-IMPLEMENTED, ON PURPOSE, AND THE MISSING HALF IS A
 *   BACKEND GAP — NOT AN OVERSIGHT. See TASK-2471.
 *
 *   IMPLEMENTED: owner (my_role === 'owner', which the backend also returns
 *   for superusers — sync.py steps 2-3).
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
 *   Until it lands this gate UNDER-shows: an org colleague who is not the
 *   owner sees no padlock. That is the safe direction. The unsafe direction —
 *   falling back to "any authenticated viewer", or to my_role !== null — is
 *   precisely the mislead this epic exists to remove: it would show a
 *   paid-tier indicator to people who cannot act on it.
 *
 * CONSISTENCY WITH THE W1 DESTINATION GATE (TASK-2431): satisfied trivially.
 * The indicator is an indicator — it is not an affordance, and this wave adds
 * no second make-private CTA anywhere (the action stays in Account > Sharing,
 * itself canManageMembers-gated to owner/manager). `owner` is a strict subset
 * of owner/manager, so nobody is shown a control the backend will then refuse.
 */
import { isOwnerAnugaMap } from '../Anuga/selectorsAnuga';

/**
 * TASK-2462 gate: may this viewer see the project's visibility indicator?
 *
 * Owner-only today. Widen this — and ONLY this — when the backend ships the
 * owning-organisation signal; every consumer reads through here so there is
 * one place to change.
 */
export const canSeeVisibilityIndicator = (state) => isOwnerAnugaMap(state);

/**
 * The paywall STEADY state literal (free_public / paid_private /
 * paid_organization / past_due), or null.
 *
 * Deliberately reads `steady` and NOT getEffectivePaywallPayload: the latter
 * is `overlay || steady`, and the FE-only overlays (upgrade_prompt, pending)
 * would mask the server's entitlement view. A transient "you just clicked
 * subscribe" must not silently change what the padlock claims about the
 * account's standing.
 */
export const getPaywallSteadyState = (state) =>
    (state && state.anuga && state.anuga.paywall && state.anuga.paywall.steady
        && state.anuga.paywall.steady.state) || null;

/** True when the account's subscription has lapsed (server steady state). */
export const isPaywallPastDue = (state) => getPaywallSteadyState(state) === 'past_due';
