/**
 * Compute-meter FE actions (TASK-2100, epic 2092 W4.2).
 *
 * Separate from Paywall/actions.js (the privacy-paywall 402) — this is the
 * COMPUTE-METER's own 402/429 vocabulary from StartRunView's meter gate
 * (TASK-2097). The two features share the checkout POST->redirect machinery
 * (SUBSCRIBE_CHECKOUT_REQUEST, Paywall/actions.js) but have distinct
 * contract shapes, so distinct actions/reducer keep the two failure modes
 * (insufficient_balance vs FREE_CAP_EXCEEDED) from being conflated.
 */

export const FETCH_COMPUTE_BALANCE = 'METER:FETCH_BALANCE';
export const SET_COMPUTE_BALANCE = 'METER:SET_BALANCE';
export const SET_METER_INSUFFICIENT_BALANCE = 'METER:SET_INSUFFICIENT_BALANCE';
export const SET_METER_CAP_EXCEEDED = 'METER:SET_CAP_EXCEEDED';
export const SET_METER_ESTIMATE_CEILING = 'METER:SET_ESTIMATE_CEILING';
export const SET_METER_EMAIL_UNVERIFIED = 'METER:SET_EMAIL_UNVERIFIED';
export const DISMISS_METER_MODAL = 'METER:DISMISS_MODAL';

// TASK-2849 (epic 2839 W2.2) — resend-verification surface for TASK-2844's
// BE dispatch gate (EMAIL_UNVERIFIED 403). Separate action family from the
// modal-set actions above: resend is a USER-INITIATED request/response pair
// against the modal that is already open, not a new refusal arriving.
export const RESEND_EMAIL_VERIFICATION_REQUEST = 'METER:RESEND_EMAIL_VERIFICATION_REQUEST';
export const SET_RESEND_EMAIL_VERIFICATION_RESULT = 'METER:SET_RESEND_EMAIL_VERIFICATION_RESULT';

export function fetchComputeBalance() {
    return { type: FETCH_COMPUTE_BALANCE };
}

/** @param {object} data — the balance endpoint's response body. */
export function setComputeBalance(data) {
    return { type: SET_COMPUTE_BALANCE, data };
}

/**
 * @param {string} checkoutUrl — from the 402 body (StartRunView, api_v2.py).
 * @param {string} detail — the server-supplied human-readable message.
 */
export function setMeterInsufficientBalance(checkoutUrl, detail) {
    return { type: SET_METER_INSUFFICIENT_BALANCE, checkoutUrl, detail };
}

/** @param {string} detail — the FREE_CAP_EXCEEDED 429 body's message. */
export function setMeterCapExceeded(detail) {
    return { type: SET_METER_CAP_EXCEEDED, detail };
}

/**
 * TASK-2123 — a run priced above the launch estimate ceiling. Distinct from
 * BOTH insufficient_balance (a pack purchase fixes that) and cap_exceeded (a
 * free-band daily limit) — no CTA can fix this; the FE shows a contact-us path.
 * @param {string} detail — the 402 body's message (StartRunView, api_v2.py).
 */
export function setMeterEstimateCeiling(detail) {
    return { type: SET_METER_ESTIMATE_CEILING, detail };
}

/**
 * TASK-2849 (epic 2839 W2.2) — StartRunView's 403 EMAIL_UNVERIFIED refusal
 * (gn_anuga.api_v2._email_verification_refusal, TASK-2844's gate).
 * @param {string} detail — the server-supplied human-readable message.
 * @param {string} resendUrl — the 403 body's `resend_url`
 *   (EmailVerificationResendView; never hardcoded on the FE).
 */
export function setMeterEmailUnverified(detail, resendUrl) {
    return { type: SET_METER_EMAIL_UNVERIFIED, detail, resendUrl };
}

export function dismissMeterModal() {
    return { type: DISMISS_METER_MODAL };
}

/** User clicked "Resend verification email" on the email_unverified modal. */
export function resendEmailVerificationRequest() {
    return { type: RESEND_EMAIL_VERIFICATION_REQUEST };
}

/**
 * @param {string} status — one of 'sent' | 'already_verified' | 'cooldown' |
 *   'send_failed' | 'error' (EmailVerificationResendView's response shapes,
 *   plus 'error' for a network/5xx failure the epic itself catches).
 * @param {string} [detail] — present for 'cooldown' (and any future status
 *   that carries one); undefined otherwise.
 */
export function setResendEmailVerificationResult(status, detail) {
    return { type: SET_RESEND_EMAIL_VERIFICATION_RESULT, status, detail };
}
