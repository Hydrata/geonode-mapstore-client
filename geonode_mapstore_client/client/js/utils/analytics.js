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

/**
 * TASK-2141 (a) — SPA virtual pageview. MapStore is a single-page app: a
 * multi-hour modelling session that never does a hard navigation is ONE
 * pageview to Umami's auto-collected tracker (the 07-06 forensics finding —
 * bounce/time-on-page metrics were fiction). This fires a synthetic pageview
 * for the given `url`, using Umami's documented SPA pattern — a callback that
 * overrides only `url` on the auto-collected payload (referrer/screen/
 * language/etc. stay real) rather than a bare umami.track() re-firing the
 * CURRENT window.location for every virtual route.
 */
export function trackPageview(url) {
    if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track((props) => ({ ...props, url }));
    }
}
