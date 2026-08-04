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

// Deep-strip values that the structured-clone algorithm cannot serialize —
// FUNCTIONS today (and, defensively, symbols). tracker-redux ships each action
// to its replay Worker via postMessage(action), which structured-clones it; a
// single un-cloneable value throws an UNCAUGHT, synchronous DataCloneError
// inside the dispatch, which can break whatever flow dispatched it (this bit the
// ANUGA edit pencil: the startVectorDraw action carried React render components
// on field.choices[].render — see VectorDraw/discriminatorRegistry.js). The
// real fix keeps functions out of actions; this is belt-and-braces so NO action
// can ever crash the app via the replay Worker again.
//
// Returns the SAME reference when nothing needed stripping (so the common case
// is allocation-free and behaviourally identical). Recurses into plain objects
// and arrays only; leaves all primitives, Dates, etc. untouched. Depth-guarded
// against pathological/cyclic inputs (a cycle would also be un-cloneable, but we
// don't try to handle it — we just bound the work). Never mutates the input,
// never throws.
const _MAX_STRIP_DEPTH = 12;
function stripNonCloneable(value, depth) {
    if (depth > _MAX_STRIP_DEPTH) { return value; }
    if (!value || typeof value !== 'object') { return value; }
    if (Array.isArray(value)) {
        let copy = null;
        for (let i = 0; i < value.length; i++) {
            const v = value[i];
            if (typeof v === 'function' || typeof v === 'symbol') {
                if (!copy) { copy = value.slice(); }
                copy[i] = undefined;
            } else if (v && typeof v === 'object') {
                const stripped = stripNonCloneable(v, depth + 1);
                if (stripped !== v) {
                    if (!copy) { copy = value.slice(); }
                    copy[i] = stripped;
                }
            }
        }
        return copy || value;
    }
    // Only descend into plain-ish objects; exotic objects (Date, RegExp, Map…)
    // are passed through — structured clone handles the common ones, and we
    // don't want to deep-copy/flatten them.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) { return value; }
    let copy = null;
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = value[k];
        if (typeof v === 'function' || typeof v === 'symbol') {
            if (!copy) { copy = { ...value }; }
            delete copy[k];
        } else if (v && typeof v === 'object') {
            const stripped = stripNonCloneable(v, depth + 1);
            if (stripped !== v) {
                if (!copy) { copy = { ...value }; }
                copy[k] = stripped;
            }
        }
    }
    return copy || value;
}

// Redact credential payloads from a Redux action (defense-in-depth behind the
// actionFilter denylist) AND deep-strip non-cloneable (function) values so the
// replay Worker's structured-clone can never throw DataCloneError. Returns the
// original reference when nothing is sensitive AND nothing is non-cloneable (so
// unaffected actions are untouched); otherwise a clone with the offending
// values replaced/dropped. Never mutates the input. Never throws.
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
        // Run the clone-safety strip over whichever object survives the
        // credential pass (the redacted clone if any, else the original).
        return stripNonCloneable(cloned || action, 0);
    } catch (e) { return action; }
}

// The handle for setUserID, or '' when none. Email-shaped usernames pass
// through unchanged: username is the fleet identity key (DB · Umami · replay),
// and most real users have email-as-username — dropping them left their replay
// sessions permanently anonymous (TASK-2376; replay is self-hosted and
// consent-gated, so the email stays on our own box).
export function extractUsername(user) {
    if (!user) { return ''; }
    return user.username
        || user.name
        || (user.info && (user.info.preferred_username || user.info.username))
        || '';
}

// The OpenReplay userID to stamp for `user`, or '' to skip — the pure decision
// behind setUserID (TASK-2129 W3 F1). Skips when already stamped (idempotent —
// setUserID once per session) OR when extractUsername yields '' (still
// anonymous). Why this exists: the replay session
// usually STARTS anonymous — a visitor lands on the public homepage (which is
// also the login page), so the boot-time setUserID sees no user and no-ops;
// a later login never re-stamped it, leaving sessions.user_id NULL and the
// run->replay linkage (TASK-2142) unable to find the session by username.
export function resolveOpenReplayUserId(user, alreadyStamped) {
    if (alreadyStamped) { return ''; }
    return extractUsername(user);
}
