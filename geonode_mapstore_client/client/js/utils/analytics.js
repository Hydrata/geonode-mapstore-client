/**
 * Analytics utility — wraps Umami's global tracker.
 *
 * Preserves the (category, action, label) call signature used across the
 * codebase so each call-site only needs a one-line import swap.
 */
export function trackEvent(category, action, label) {
    if (typeof umami !== 'undefined') {
        umami.track(label, { category, action });
    }
}
