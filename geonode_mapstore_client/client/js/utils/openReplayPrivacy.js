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

// TASK-2794: binary payloads at or over this many bytes are stripped before
// anything reaches tracker-redux. The middleware structured-clones each action
// AND the full redux state into its encoder worker per captured action, then
// string-encodes every element of every array — on a playback map the state
// carries ~150 MB of mesh Float32/Int32Arrays plus uint16 chunk cache, and that
// clone+encode IS the production renderer OOM (V8 CALL_AND_RETRY_LAST; 2/2
// local repro on the prod bundle with the tracker enabled, 5/5 survival with it
// off — evidence in deploy docs/epic-state/wave-reports/TASK-2706-W8-evidence/).
// 64 KiB keeps colormap LUTs and small lookup tables while catching anything
// mesh- or chunk-shaped.
export const HEAVY_BINARY_BYTES = 65536;

// A replay-safe descriptor for a large binary value, or null when the value is
// not a large binary. ArrayBuffer.isView covers every TypedArray + DataView.
function describeHeavyBinary(v) {
    if (ArrayBuffer.isView(v) && v.byteLength >= HEAVY_BINARY_BYTES) {
        const name = (v.constructor && v.constructor.name) || 'TypedArray';
        const n = v.length !== undefined ? v.length : v.byteLength;
        return `[${name} x ${n} STRIPPED — TASK-2794]`;
    }
    if (v instanceof ArrayBuffer && v.byteLength >= HEAVY_BINARY_BYTES) {
        return `[ArrayBuffer ${v.byteLength} B STRIPPED — TASK-2794]`;
    }
    return null;
}

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
                const heavy = describeHeavyBinary(v);
                if (heavy) {
                    if (!copy) { copy = value.slice(); }
                    copy[i] = heavy;
                } else {
                    const stripped = stripNonCloneable(v, depth + 1);
                    if (stripped !== v) {
                        if (!copy) { copy = value.slice(); }
                        copy[i] = stripped;
                    }
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
            const heavy = describeHeavyBinary(v);
            if (heavy) {
                if (!copy) { copy = { ...value }; }
                copy[k] = heavy;
            } else {
                const stripped = stripNonCloneable(v, depth + 1);
                if (stripped !== v) {
                    if (!copy) { copy = { ...value }; }
                    copy[k] = stripped;
                }
            }
        }
    }
    return copy || value;
}

// TASK-2794: bounded probe — does this redux slice hold a large binary payload
// anywhere shallow? Read-only, never throws, budgeted so a huge all-light slice
// costs a bounded number of node visits. Descends plain objects, arrays (first
// 64 entries), Maps and Sets; a plain Array of 65536+ elements is itself heavy
// (it string-encodes just as fatally as a typed array).
const _PROBE_DEPTH = 5;
const _PROBE_BUDGET = 1200;
function sliceCarriesHeavyBinary(value, depth, budget) {
    if (!value || typeof value !== 'object' || depth > _PROBE_DEPTH || budget.n <= 0) { return false; }
    budget.n--;
    if (describeHeavyBinary(value)) { return true; }
    try {
        if (value instanceof Map || value instanceof Set) {
            for (const v of value.values()) {
                if (sliceCarriesHeavyBinary(v, depth + 1, budget)) { return true; }
                if (budget.n <= 0) { break; }
            }
            return false;
        }
        if (Array.isArray(value)) {
            if (value.length >= 65536) { return true; }
            for (let i = 0; i < value.length && i < 64; i++) {
                if (sliceCarriesHeavyBinary(value[i], depth + 1, budget)) { return true; }
                if (budget.n <= 0) { break; }
            }
            return false;
        }
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            if (sliceCarriesHeavyBinary(value[keys[i]], depth + 1, budget)) { return true; }
            if (budget.n <= 0) { break; }
        }
    } catch (e) { /* a throwing getter must never break capture */ }
    return false;
}

// Per-slice verdict caches keyed on object identity: redux replaces a slice
// reference whenever it changes, so identity is a sound cache key and the
// per-action steady-state cost collapses to "probe only the slices that
// changed". WeakSets so retired slices are collectable.
const _lightSlices = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
const _heavySlices = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

// TASK-2794: replace every top-level redux slice that carries a large binary
// payload with a short descriptor string BEFORE the state is handed to
// tracker-redux (which would structured-clone it into its encoder worker and
// string-encode every array element — the production renderer OOM). Returns the
// SAME reference when nothing is heavy. Never mutates the input, never throws.
export function stripHeavyStateForReplay(state) {
    if (!state || typeof state !== 'object') { return state; }
    try {
        let copy = null;
        const keys = Object.keys(state);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const v = state[k];
            if (!v || typeof v !== 'object') { continue; }
            let heavy;
            if (_heavySlices && _heavySlices.has(v)) {
                heavy = true;
            } else if (_lightSlices && _lightSlices.has(v)) {
                heavy = false;
            } else {
                heavy = sliceCarriesHeavyBinary(v, 0, { n: _PROBE_BUDGET });
                const cache = heavy ? _heavySlices : _lightSlices;
                if (cache) { cache.add(v); }
            }
            if (heavy) {
                if (!copy) { copy = { ...state }; }
                copy[k] = `[STRIPPED ${k}: carries large binary arrays; never ship them to the replay worker — TASK-2794]`;
            }
        }
        return copy || state;
    } catch (e) { return state; }
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
