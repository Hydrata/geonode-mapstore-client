/**
 * paywallContract.js — JS wrapper around the frozen paywall contract fixture.
 *
 * Source of truth: apps/gn_anuga/fixtures/paywall_contract.json (hydrata repo).
 * This module re-exports the fixture + provides helpers so the FE and Karma tests
 * consume the canonical shape without re-authoring it.
 *
 * DO NOT modify the CONTRACT_FIXTURE shape here — edit the JSON source instead
 * and update paywall-contract.md accordingly.
 */

/**
 * Verbatim contract fixture.
 * Six states: free_public, upgrade_prompt, pending, paid_private, past_due, anon.
 * Hard rules: LAPSE NEVER AUTO-PUBLISHES; gate reads ENTITLEMENT not role.
 *
 * Note: `pending` is FE-only (see _meta.note_on_pending).
 * Note: `anon` has payload=null (paywall key is absent for anonymous callers).
 */
export const CONTRACT_FIXTURE = {
    "_meta": {
        "authored_by": "TASK-1363/W3",
        "purpose": "Canonical paywall contract fixture — anti-drift source of truth for the my_perms `paywall` block. TASK-1356/1357/1350-Karma consume this file verbatim. Do not edit the shape without updating the derivation table in docs/strategy/paywall-contract.md and re-running the W3 gate tests.",
        "version": "1.0",
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
            "description": "Private project with active entitlement. Full access, manage-billing CTA.",
            "backend_condition": "project.visibility == 'private' AND acting-user account entitled",
            "payload": {
                "state": "paid_private",
                "checkout_url": null,
                "read_only": false
            }
        },
        {
            "state": "past_due",
            "description": "Private project with LAPSED/expired entitlement. Visibility STAYS private (lapse never auto-publishes — hard contract rule). read_only=true (dunning state). checkout_url points to renew/manage billing.",
            "backend_condition": "project.visibility == 'private' AND acting-user account NOT entitled",
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
        "LAPSE NEVER AUTO-PUBLISHES: A lapsed/expired entitlement on a private project MUST leave visibility=private. Reverting to public is an explicit user action. See AC4.",
        "Gate reads ENTITLEMENT not role: The public->private gate is an ORTHOGONAL entitlement check (account.has_paid_private_entitlement) added on top of the existing MANAGER+ role check. Do NOT conflate role and entitlement."
    ]
};

/**
 * Look up a state entry from the contract fixture by state name.
 * Returns { state, description, backend_condition, payload } or throws if not found.
 *
 * @param {string} stateName — one of: free_public, upgrade_prompt, pending, paid_private, past_due, anon
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
