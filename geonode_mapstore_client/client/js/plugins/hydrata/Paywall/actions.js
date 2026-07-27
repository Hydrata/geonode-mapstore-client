/**
 * Paywall FE-only actions (TASK-2099, epic 2092 W4.1).
 *
 * The STEADY paywall state (free_public / paid_private / past_due) comes from
 * the Anuga my_perms fetch (SET_ANUGA_RESOURCE_PERMS, payload.paywall — see
 * reducer.js). These actions cover the states my_perms never emits:
 *
 *   upgrade_prompt — the 402 error-response shape from a visibility PATCH
 *                    (dispatched by membershipEpics.updateProjectVisibilityEpic).
 *   pending        — FE-only transient while polling my_perms after a Stripe
 *                    Checkout return, before the webhook has flipped anything
 *                    (see paywallContract.js _meta.note_on_pending).
 */

export const SET_PAYWALL_UPGRADE_PROMPT = 'PAYWALL:SET_UPGRADE_PROMPT';
export const DISMISS_PAYWALL_UPGRADE = 'PAYWALL:DISMISS_UPGRADE';
export const SET_PAYWALL_PENDING = 'PAYWALL:SET_PENDING';
// TASK-2457 (adversarial R2, epic 2425 W2.5) — disarms the pending overlay
// when the poll gives up. Without it a lost/slow webhook stranded the customer
// in `pending` until they reloaded: the overlay MASKS `steady` in
// getEffectivePaywallPayload, so the app kept insisting it was "confirming
// your subscription" while the server had long since answered. An
// un-dismissable state is a trap (ModalHost.js's own standard).
//
// W2.10 REVERT (operator decision 2026-07-26). W2.8 replaced this with
// STALL_PAYWALL_PENDING plus a Billing-tab notice, and W2.9 reinstated it as a
// third "confirmed by the balance" channel. Both are gone. Clearing on give-up
// reveals `steady` and nothing more — W2.5 deleted PendingSpinner — which is
// correct on the credit-pack path (the balance beside it is already right) and
// silent on a subscription webhook slower than 60s. That silence is a real
// defect and it is TASK-2489's, whose mechanism is a server-side read of
// whether this checkout session was processed. Do not add another client-side
// detector to this slice: three attempts each shipped a claim the customer's
// own screen could refute.
export const CLEAR_PAYWALL_PENDING = 'PAYWALL:CLEAR_PENDING';
// Requests a Checkout Session (POST /commerce/checkout/create-session/) and
// redirects the browser to the returned session.url. Used by both the
// upgrade_prompt "Subscribe" CTA and the past_due "Renew" CTA (2099), and by
// the compute-meter pack-purchase flow (2100, purchaseType='credit_pack').
export const SUBSCRIBE_CHECKOUT_REQUEST = 'PAYWALL:SUBSCRIBE_CHECKOUT_REQUEST';

/**
 * TASK-2441 (epic 2425 W4.2) — the create-session round-trip has finished, by
 * ANY route: a session url returned, a 200 with no url, or an error. Clears the
 * checkout in-flight flag SUBSCRIBE_CHECKOUT_REQUEST arms.
 *
 * There is deliberately ONE settle action rather than a success/error pair.
 * Since UAT-2 the checkout opens in a NEW TAB (paywallEpics.js _openInNewTab),
 * so the originating tab survives a success and no navigation ever unmounts the
 * flag — a clear-on-error-only design would disable every buy control forever
 * after the first successful purchase. Same shape, same reason, as
 * SET_BILLING_PORTAL_OPENED (Paywall/account/actions.js).
 */
export const SUBSCRIBE_CHECKOUT_SETTLED = 'PAYWALL:SUBSCRIBE_CHECKOUT_SETTLED';

/**
 * @param {string} checkoutUrl — from the 402 body (upgrade_prompt.checkout_url).
 * @param {string} visibility — the destination the customer was REFUSED, so the
 *   checkout can buy the tier they actually chose. Dropping it is what made a
 *   customer who picked Organization pay for Organization and receive Private
 *   (W3d; checkout_views.py's _grant_entitlement_and_flip_project).
 * @param {number} projectId — which project this refusal is ABOUT. The overlay
 *   survives an SPA nav and its modal is not dismiss-on-click, so without a
 *   stamp a refusal armed on project A stays on screen over project B and its
 *   Subscribe button buys — and privatises — B. See getEffectivePaywallPayload.
 */
export function setPaywallUpgradePrompt(checkoutUrl, visibility, projectId) {
    return { type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl, visibility, projectId };
}

/** "Keep it public" — dismisses the upgrade_prompt overlay only. */
export function dismissPaywallUpgrade() {
    return { type: DISMISS_PAYWALL_UPGRADE };
}

/**
 * Arms the FE-only pending overlay (checkout=success return, pre-webhook).
 *
 * @param {object|null} anchor — TASK-2489 (epic 2425 W3c). The departure record
 *   subscribeCheckoutEpic persisted to localStorage before opening the Stripe
 *   tab, lifted back out by checkoutReturnEpic:
 *   {purchaseType, accountOnly, projectId, latestPurchaseIso, balanceObserved}.
 *
 *   It rides the ACTION rather than being re-read from storage on every poll
 *   tick for two reasons. It scopes the record to the checkout this overlay is
 *   actually about — the store copy dies with the overlay, so a stale record
 *   cannot be adopted by a later arming. And the Billing tab's confirming notice
 *   is rendered from it, which needs a pure store read: a mapStateToProps that
 *   touched localStorage would run on every dispatch in the app.
 *
 *   `null` whenever no record survived (storage blocked, corrupt payload, or a
 *   return this browser did not start). That degrades to exactly pre-W2.8
 *   behaviour rather than to a guess.
 */
export function setPaywallPending(anchor = null) {
    return { type: SET_PAYWALL_PENDING, anchor };
}

/**
 * Disarms the pending overlay, revealing whatever `steady` the server last
 * reported. Idempotent and narrow: it clears ONLY a pending overlay, so it can
 * never eat an upgrade_prompt refusal that armed in the meantime.
 */
export function clearPaywallPending() {
    return { type: CLEAR_PAYWALL_PENDING };
}

/**
 * @param {string} purchaseType — 'subscription' (default) or 'credit_pack'.
 * @param {object} extra — e.g. { priceId } for credit_pack purchases (2100).
 */
export function subscribeCheckoutRequest(purchaseType = 'subscription', extra = {}) {
    return { type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType, ...extra };
}

/** The create-session round-trip finished (success, empty body, or error). */
export function subscribeCheckoutSettled() {
    return { type: SUBSCRIBE_CHECKOUT_SETTLED };
}
