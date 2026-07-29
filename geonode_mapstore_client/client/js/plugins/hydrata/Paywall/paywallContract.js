/**
 * paywallContract.js — JS wrapper around the frozen paywall contract fixture.
 *
 * Source of truth: apps/gn_anuga/fixtures/paywall_contract.json (hydrata repo).
 * This module re-exports the fixture + provides helpers so the FE and Karma tests
 * consume the canonical shape without re-authoring it.
 *
 * DO NOT modify the CONTRACT_FIXTURE shape here — edit the JSON source instead
 * and update paywall-contract.md accordingly.
 *
 * SYNC PROCEDURE (TASK-2446): this copy is manually mirrored. On any bump,
 * copy the JSON verbatim here AND re-pin PINNED_CONTRACT_HASH in
 * __tests__/paywallContractHash-test.js — the guard is the only thing that
 * catches drift, since gmc CI has no hydrata checkout.
 */

/**
 * Verbatim contract fixture — v1.1 (TASK-2432 added `paid_organization`).
 * Seven states: free_public, upgrade_prompt, pending, paid_private,
 * paid_organization, past_due, anon.
 * Hard rules: LAPSE NEVER AUTO-PUBLISHES; gate reads ENTITLEMENT not role;
 * plus the TASK-2431/TASK-2432 rules added in v1.1.
 *
 * Note: `pending` is FE-only (see _meta.note_on_pending).
 * Note: `anon` has payload=null (paywall key is absent for anonymous callers).
 */
export const CONTRACT_FIXTURE = {
    "_meta": {
        "authored_by": "TASK-1363/W3",
        "purpose": "Canonical paywall contract fixture — anti-drift source of truth for the my_perms `paywall` block. TASK-1356/1357/1350-Karma consume this file verbatim. Do not edit the shape without updating the derivation table in docs/strategy/paywall-contract.md and re-running the W3 gate tests.",
        "version": "1.1",
        "note_on_v1.1": "TASK-2432 (W1.2, epic 2425) added the `paid_organization` state and widened `paid_private`/`past_due`'s backend_condition to organization where applicable. geonode-mapstore-client's Paywall/paywallContract.js is a manually-maintained VERBATIM copy of this file (not an import). This note used to flag its PaywallPanel.js consumer having no case for `paid_organization` as an open gmc gap awaiting operator decision; that gap is CLOSED. TASK-2463 (W2.5) rewrote PaywallPanel to render exactly one thing — the blocking upgrade_prompt refusal modal — so every other state rendering null is the DESIGNED behaviour, not an unhandled fall-through. Corrected by TASK-2501 (W3d); docs/strategy/paywall-contract.md 'Known FE gaps' records the same resolution.",
        "note_on_pending": "The `pending` state is FE-only (client polled after returning from Stripe before webhook fires). The backend has no in-flight marker today — no DB field was invented this wave. The `pending` payload is included here for FE/Karma contract completeness; the backend never emits it from my_perms."
    },
    "states": [
        {
            "state": "free_public",
            "description": "Default: public project, any entitlement status. The 'Make private' CTA is available. No payment required yet.",
            "backend_condition": "project.visibility == 'public' (any entitlement)",
            "payload": {
                "state": "free_public",
                "checkout_url": null,
                "read_only": false
            }
        },
        {
            "state": "upgrade_prompt",
            "description": "Returned in the 402 body from perform_update when a public->private transition is attempted WITHOUT entitlement. Not a steady-state from my_perms — it is the error response shape from the PUT/PATCH endpoint.",
            "backend_condition": "perform_update: current==public, incoming==private, acting-user account NOT entitled",
            "payload": {
                "state": "upgrade_prompt",
                "checkout_url": "<checkout-session-url>",
                "read_only": false
            }
        },
        {
            "state": "pending",
            "description": "FE-only transient: client has returned from Stripe but webhook has not yet fired. The backend emits free_public from my_perms during this window (project is still public). FE detects 'pending' by local state, not from backend. Included here so Karma/FE tests can assert the full UX state machine.",
            "backend_condition": "N/A — no backend DB marker (deferred; see _meta.note_on_pending)",
            "payload": {
                "state": "pending",
                "checkout_url": null,
                "read_only": false
            }
        },
        {
            "state": "paid_private",
            "description": "Private project with active entitlement. Full access. NO on-map surface, by design: PaywallPanel renders exactly one thing, the blocking upgrade_prompt refusal modal, and every other state renders null there (TASK-2463, W2.5 — do not re-add an on-map badge). The indicator is the padlock on the Account button (gmc SimpleView/components/accountVisibilityLock.js); the billing action lives in Account > Billing, whose manager-gated 'Manage billing' button (BillingTabPanel.js SubscriptionSection) is LIVE and must not be retired.",
            "backend_condition": "project.visibility == 'private' AND acting-user account entitled",
            "payload": {
                "state": "paid_private",
                "checkout_url": null,
                "read_only": false
            }
        },
        {
            "state": "paid_organization",
            "description": "TASK-2432 (W1.2) — Organization-visibility project with active entitlement. Full access, surfaced exactly as paid_private: no on-map surface by design (TASK-2463, W2.5), the Account-button padlock is the indicator, and billing lives in Account > Billing. A DISTINCT state from paid_private: reusing paid_private for an organization project would misdescribe it to the FE.",
            "backend_condition": "project.visibility == 'organization' AND acting-user account entitled",
            "payload": {
                "state": "paid_organization",
                "checkout_url": null,
                "read_only": false
            }
        },
        {
            "state": "past_due",
            "description": "Private OR organization project (TASK-2432 widened this to organization) with LAPSED/expired entitlement. Visibility STAYS whatever it was (lapse never auto-publishes — hard contract rule). read_only=true (dunning state). checkout_url points to renew/manage billing. Shared literal for both non-public visibilities — the dunning UX is identical regardless of which one got cliffed.",
            "backend_condition": "project.visibility in ('private', 'organization') AND acting-user account NOT entitled",
            "payload": {
                "state": "past_due",
                "checkout_url": "<checkout-or-manage-billing-url>",
                "read_only": true
            }
        },
        {
            "state": "anon",
            "description": "Anonymous caller (unauthenticated). paywall block is omitted for anon callers (my_perms already returns 404 for non-public projects when anon; for public projects the paywall block is omitted so the FE shows the default public CTA without billing context).",
            "backend_condition": "request.user is anonymous",
            "payload": null,
            "note": "paywall key is absent from the my_perms response for anon callers"
        }
    ],
    "hard_contract_rules": [
        "LAPSE NEVER AUTO-PUBLISHES: A lapsed/expired entitlement on a private OR organization project MUST leave visibility unchanged. Reverting to public is an explicit user action. See AC4.",
        "Gate reads ENTITLEMENT not role: the entitlement gate is an ORTHOGONAL entitlement check (account.has_paid_private_entitlement) added on top of the existing MANAGER+ role check. Do NOT conflate role and entitlement.",
        "TASK-2431 (W1.1): the entry gate is DESTINATION-based — any visibility CHANGE into private OR organization is gated, not one hardcoded transition pair.",
        "TASK-2432 (W1.2): the STEADY STATE gate mirrors the entry gate — organization is a paid state (paid_organization when entitled, past_due when not), not free_public. Entry-only gating would leave a one-month-deferred hole (subscribe, flip to organization, cancel, keep forever)."
    ]
};

/**
 * Look up a state entry from the contract fixture by state name.
 * Returns { state, description, backend_condition, payload } or throws if not found.
 *
 * @param {string} stateName — one of: free_public, upgrade_prompt, pending,
 *   paid_private, paid_organization, past_due, anon
 */
export function getStatePayload(stateName) {
    const entry = CONTRACT_FIXTURE.states.find(s => s.state === stateName);
    if (!entry) {
        throw new Error(
            `paywallContract: unknown state "${stateName}". ` +
            `Valid states: ${CONTRACT_FIXTURE.states.map(s => s.state).join(', ')}`
        );
    }
    return entry;
}

/**
 * All valid paywall state names (from the fixture).
 */
export const PAYWALL_STATES = CONTRACT_FIXTURE.states.map(s => s.state);
