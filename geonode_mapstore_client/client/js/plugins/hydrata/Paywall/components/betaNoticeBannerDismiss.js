/**
 * TASK-2638 (epic 2635 W1) — per-user dismissal for the beta notice banner.
 *
 * localStorage, keyed by USERNAME (not a global flag): AC3 requires
 * dismissal to persist across a reload but NOT suppress the banner for a
 * different user on the same browser (a shared workstation / e2e_regular ->
 * e2e_staff swap in the same Chrome profile — memory
 * reference-localhost-browser-user-swap-cookie-trap is the same class of
 * bug this guards against). A username-less caller (not yet resolved,
 * anonymous) never reads/writes anything — fail toward SHOWING the banner,
 * never toward silently hiding it for nobody in particular.
 */
const DISMISS_KEY_PREFIX = 'hydrata.betaNoticeBanner.dismissed.';

export const isDismissedFor = (username) => {
    if (!username || typeof window === 'undefined' || !window.localStorage) return false;
    try {
        return window.localStorage.getItem(DISMISS_KEY_PREFIX + username) === '1';
    } catch (e) {
        // Private browsing / storage quota / disabled storage — dismissal
        // just doesn't persist; never throw out of a render path for this.
        return false;
    }
};

export const setDismissedFor = (username) => {
    if (!username || typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(DISMISS_KEY_PREFIX + username, '1');
    } catch (e) {
        // Same fail-open posture as the read above.
    }
};
