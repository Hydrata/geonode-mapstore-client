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
/**
 * TASK-2463 (epic 2425 W2.8) — the post-checkout poll has run its full budget
 * without observing the purchase land. REPLACES `CLEAR_PAYWALL_PENDING`.
 *
 * WHY THE CLEAR HAD TO GO. TASK-2457 (W2.5) added CLEAR_PENDING for a real
 * reason: a poll that stopped silently left the customer in `pending` forever,
 * and the overlay MASKS `steady`, so the app kept insisting it was confirming
 * something the server had already answered about. That reasoning was sound
 * WHEN `pending` still rendered a spinner. The same wave then deleted
 * PendingSpinner, and from that moment clearing the overlay revealed NOTHING:
 * a webhook slower than 60s produced no padlock, no spinner, no toast and no
 * retry, with every surface reading the pre-payment state. The customer had
 * paid and the product said nothing at all. Trading a stuck spinner for total
 * silence is not a fix on the money path.
 *
 * So the terminal state is now HONEST rather than empty: the overlay stays,
 * marked `stalled`, and the Billing tab says we are still confirming and offers
 * a re-check. Nothing about it is un-dismissable in the ModalHost sense — it
 * blocks no input and portals nothing; it is a line of text in a panel.
 */
export const STALL_PAYWALL_PENDING = 'PAYWALL:STALL_PENDING';
/**
 * TASK-2463 (W2.8) — the customer pressed "Check again" on the stalled notice.
 * Handled by recheckPaymentEpic, which re-asks every endpoint that could carry
 * the news (my_perms forced, compute balance, account summary).
 */
export const RECHECK_PAYMENT = 'PAYWALL:RECHECK_PAYMENT';
// Requests a Checkout Session (POST /commerce/checkout/create-session/) and
// redirects the browser to the returned session.url. Used by both the
// upgrade_prompt "Subscribe" CTA and the past_due "Renew" CTA (2099), and by
// the compute-meter pack-purchase flow (2100, purchaseType='credit_pack').
export const SUBSCRIBE_CHECKOUT_REQUEST = 'PAYWALL:SUBSCRIBE_CHECKOUT_REQUEST';

/**
 * @param {string} checkoutUrl — from the 402 body (upgrade_prompt.checkout_url).
 */
export function setPaywallUpgradePrompt(checkoutUrl) {
    return { type: SET_PAYWALL_UPGRADE_PROMPT, checkoutUrl };
}

/** "Keep it public" — dismisses the upgrade_prompt overlay only. */
export function dismissPaywallUpgrade() {
    return { type: DISMISS_PAYWALL_UPGRADE };
}

/** Arms the FE-only pending overlay (checkout=success return, pre-webhook). */
export function setPaywallPending() {
    return { type: SET_PAYWALL_PENDING };
}

/**
 * Marks the pending overlay STALLED — the poll is over and the purchase has not
 * been observed to land. Idempotent and narrow: it acts ONLY on a pending
 * overlay, so it can never touch an upgrade_prompt refusal that armed in the
 * meantime (same narrowness as dismissPaywallUpgrade above).
 */
export function stallPaywallPending() {
    return { type: STALL_PAYWALL_PENDING };
}

/** "Check again" on the stalled notice. */
export function recheckPayment() {
    return { type: RECHECK_PAYMENT };
}

/**
 * @param {string} purchaseType — 'subscription' (default) or 'credit_pack'.
 * @param {object} extra — e.g. { priceId } for credit_pack purchases (2100).
 */
export function subscribeCheckoutRequest(purchaseType = 'subscription', extra = {}) {
    return { type: SUBSCRIBE_CHECKOUT_REQUEST, purchaseType, ...extra };
}
