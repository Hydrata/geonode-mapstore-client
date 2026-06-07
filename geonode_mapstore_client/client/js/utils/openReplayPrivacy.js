/*
 * OpenReplay privacy redaction — pure helpers (epic 1511 W3, TASK-1516).
 *
 * Split out of openReplayUtils.js so the LOAD-BEARING redaction logic has no
 * @openreplay/tracker dependency and can be unit-tested in isolation. These are
 * pure functions: given an input they return a redacted copy (or the input when
 * nothing is sensitive) and NEVER throw into the page.
 *
 * Why each exists (both close real token-leak gaps a state-only scrub missed):
 *   - scrubUrlCredentials: the OAuth access_token rides as a query param on
 *     GeoServer/GWC tile + GeoNode API URLs (gwcTileRouting appends
 *     &access_token=…). The tracker's built-in URL redaction only masks an exact
 *     'token' key, so 'access_token' would leak in captured request URLs.
 *   - sanitizeReduxAction: the token-bearing MapStore actions (LOGIN_SUCCESS /
 *     REFRESH_SUCCESS / SESSION_VALID) carry access_token + refresh_token under
 *     `userDetails`; tracker-redux otherwise sends the whole action verbatim.
 *   - extractUsername: never ship an email as the OpenReplay user id (a site
 *     configured with email-as-username would otherwise leak PII via setUserID).
 */

// Credential query-param keys to strip from captured request URLs.
export const CREDENTIAL_QUERY_KEYS = ['access_token', 'token', 'refresh_token', 'jwt', 'id_token', 'code', 'api_key', 'apikey'];

// Top-level action keys whose values may carry credentials.
export const SENSITIVE_ACTION_KEYS = ['userDetails', 'access_token', 'refresh_token', 'token', 'authHeader', 'password', 'apikey', 'api_key'];

// Redact credential query params from a URL (relative or absolute), case-
// insensitive on the key, leaving every other param intact. Never throws.
export function scrubUrlCredentials(url) {
    if (!url || typeof url !== 'string') { return url; }
    try {
        return url.replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, sep, key) =>
            (CREDENTIAL_QUERY_KEYS.indexOf(key.toLowerCase()) !== -1 ? `${sep}${key}=REDACTED` : match));
    } catch (e) { return url; }
}

// Redact credential payloads from a Redux action (defense-in-depth behind the
// actionFilter denylist). Returns the original reference when nothing is
// sensitive (so unaffected actions are untouched); otherwise a shallow clone
// with the sensitive keys replaced. Never mutates the input. Never throws.
export function sanitizeReduxAction(action) {
    if (!action || typeof action !== 'object') { return action; }
    try {
        let cloned = null;
        Object.keys(action).forEach((k) => {
            if (SENSITIVE_ACTION_KEYS.indexOf(k) !== -1) {
                if (!cloned) { cloned = { ...action }; }
                cloned[k] = '[REDACTED]';
            }
        });
        return cloned || action;
    } catch (e) { return action; }
}

// The cohort handle for setUserID, or '' when none — or when the candidate looks
// like an email (a site using email-as-username would otherwise ship PII).
export function extractUsername(user) {
    if (!user) { return ''; }
    const candidate = user.username
        || user.name
        || (user.info && (user.info.preferred_username || user.info.username))
        || '';
    return /.+@.+\..+/.test(candidate) ? '' : candidate;
}
