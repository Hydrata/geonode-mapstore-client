/*
 * OpenReplay session-replay integration — epic 1511 W3 (TASK-1516).
 *
 * Engineering-grade capture via the npm packages (compiled into the bundle),
 * replacing the abandoned W2 Django script-snippet (which could not work: the
 * self-hosted box does not serve the tracker bundle — it is CDN-only):
 *   - @openreplay/tracker        masked session replay + network + console
 *   - @openreplay/tracker-redux  captures dispatched Redux actions so a "stuck
 *                                session" shows e.g. RUN_SCENARIO dispatched,
 *                                /api/v2/anuga/run/ 401'd, AnugaContainer threw.
 *
 * Config is rendered server-side into window.__GEONODE_CONFIG__.openReplay
 * (gated on a non-empty projectKey). When projectKey is falsy — no box
 * provisioned / not flipped on, or on localhost — every function here is inert,
 * exactly like umami_tracking stays inert when job_name matches no branch.
 *
 * Privacy is LOAD-BEARING (carries the W4 consent/masking requirement):
 *   - defaultInputMode 1 (OBSCURED): every input value masked by default.
 *   - obscure{Input,Text}{Emails,Numbers}: emails + numbers masked in inputs
 *     AND visible text.
 *   - network.capturePayload false: request/response BODIES never captured; a
 *     defensive sanitizer also redacts Authorization/JWT/cookie headers and
 *     nulls bodies in case payload capture is ever enabled operator-side.
 *   - Redux stateTransformer drops the security slice (access_token + user PII)
 *     and actionFilter skips auth actions, so tokens never reach the store.
 *   - EU visitors are consent-gated: tracker.start() is withheld until they
 *     accept the in-page disclosure (fail-safe — unknown timezone => treat as
 *     EU). Non-EU visitors run masked-with-disclosure immediately.
 */
import Tracker from '@openreplay/tracker';
import trackerRedux from '@openreplay/tracker-redux';
// Pure, tracker-independent redaction helpers (unit-tested in openReplayPrivacy-test).
import { scrubUrlCredentials, sanitizeReduxAction, resolveOpenReplayUserId, stripHeavyStateForReplay } from './openReplayPrivacy';

const CONSENT_KEY = 'or_consent_v1';
// Separate from CONSENT_KEY: tracks that a non-EU visitor has already seen the
// informational disclosure, so the dismissible "Got it" banner shows once per
// browser instead of on every page load.
const DISCLOSURE_SEEN_KEY = 'or_disclosure_seen_v1';

// Module singletons: the tracker is built once and shared by the redux
// middleware factory and the consent/start path.
let _tracker = null;
let _started = false;
// TASK-2129 W3 (F1): true once setUserID has stamped an authenticated user on
// the session, so the per-action login listener (AppUtils onStoreInit) is a
// cheap no-op afterwards and we never re-stamp.
let _userStamped = false;

// Stamp the OpenReplay userID for `user` exactly once, on a started tracker.
// Shared by boot-start (below) and the mid-session login path
// (setOpenReplayUser). No-op when inert, not started, already stamped, or the
// user is still anonymous (resolveOpenReplayUserId returns ''). Never
// throws into the app.
function applyUserId(tracker, user) {
    const id = resolveOpenReplayUserId(user, _userStamped);
    if (!id) { return; }
    try { tracker.setUserID(id); _userStamped = true; } catch (e) { /* ignore */ }
}

function getConfig() {
    const cfg = (typeof window !== 'undefined'
        && window.__GEONODE_CONFIG__
        && window.__GEONODE_CONFIG__.openReplay) || {};
    // Same-origin first-party path so ad-blockers (which blocklist known replay
    // hostnames) don't drop the beacon; nginx proxies /_openreplay/ to the
    // self-hosted box (geonode-https.j2, flag-gated).
    const rawIngest = cfg.ingestPoint || '/_openreplay/ingest';
    return {
        projectKey: cfg.projectKey || '',
        // The tracker uploads /i event batches from a Web Worker, which has no
        // document base URL, so a ROOT-RELATIVE ingestPoint throws "Failed to
        // parse URL" there and events silently never upload (TASK-1540). Anchor
        // a root-relative path to the current origin so every site works off the
        // same-origin '/_openreplay/ingest' default — no absolute per-site URL
        // needed in inventory. An already-absolute or protocol-relative value is
        // left untouched.
        ingestPoint: (typeof window !== 'undefined' && rawIngest.charAt(0) === '/' && rawIngest.charAt(1) !== '/')
            ? window.location.origin + rawIngest
            : rawIngest,
        // Empty default: an unset cohort must be benign. The old 'linkedin-june'
        // default silently tagged any site that forgot to set OPENREPLAY_COHORT
        // into hydrata.com's campaign cohort on the shared box.
        cohort: cfg.cohort || ''
    };
}

// Network sanitizer: tokens must NEVER reach the replay store. capturePayload
// is false (bodies not captured); this also redacts auth/token headers, scrubs
// credential query params from the request URL, and nulls any body that slips
// through. Never throws into the page.
function sanitizeNetwork(data) {
    try {
        const redactHeaders = (headers) => {
            if (!headers) { return; }
            Object.keys(headers).forEach((h) => {
                const lower = h.toLowerCase();
                if (lower === 'authorization'
                    || lower === 'proxy-authorization'
                    || lower === 'cookie'
                    || lower === 'set-cookie'
                    || lower === 'x-csrftoken'
                    || lower.indexOf('token') !== -1
                    || lower.indexOf('jwt') !== -1
                    || lower.indexOf('api-key') !== -1) {
                    headers[h] = 'REDACTED';
                }
            });
        };
        if (data.url) { data.url = scrubUrlCredentials(data.url); }
        if (data.request) { redactHeaders(data.request.headers); data.request.body = null; }
        if (data.response) { redactHeaders(data.response.headers); data.response.body = null; }
    } catch (e) { /* never let the sanitizer throw into the page */ }
    return data;
}

// Redux PII scrub + heavy-binary strip. The `security` slice holds the OAuth
// access_token and full user object — drop it from every captured snapshot.
// TASK-2794: additionally strip any slice carrying large binary arrays —
// tracker-redux structured-clones this transformer's ENTIRE return value into
// its encoder worker on every captured action and string-encodes every array
// element, which on a playback map (~150 MB of mesh typed arrays in
// anugaPlayback) is a fatal single allocation: the production renderer OOM.
// Fail CLOSED: if the strip itself breaks, ship only a stub — never the raw
// state.
function reduxStateTransformer(state) {
    if (!state) { return state; }
    try {
        return { ...stripHeavyStateForReplay(state), security: '[REDACTED]' };
    } catch (e) {
        return { security: '[REDACTED]', replayNote: '[state transform failed — raw state withheld, TASK-2794]' };
    }
}

// Build the masked tracker once. Returns null when inert (no projectKey / no
// window / construction failed) so callers can no-op cleanly. Module-local.
function buildOpenReplayTracker() {
    if (_tracker) { return _tracker; }
    const { projectKey, ingestPoint } = getConfig();
    if (!projectKey || typeof window === 'undefined') { return null; }
    try {
        _tracker = new Tracker({
            projectKey,
            ingestPoint,
            // --- masking (load-bearing) ---
            defaultInputMode: 1, // OBSCURED: every input value masked by default
            obscureInputEmails: true,
            obscureInputNumbers: true,
            obscureTextEmails: true,
            obscureTextNumbers: true,
            // --- replay CSS fidelity ---
            // Fetch each linked stylesheet and embed it as a <style> node so
            // external <link> CSS (GeoNode/MapStore chrome incl. the navbar) and
            // fonts render in playback. The tracker default is
            // InlineCssMode.Disabled(0), which instead relies on the backend
            // assets service caching each sheet — in practice that left most
            // external CSS uncached, so replays rendered unstyled. 3 = PlainFetched.
            inlineCss: 3,
            // --- network: do not capture bodies; strip auth/token headers ---
            network: {
                capturePayload: false,
                ignoreHeaders: ['Authorization', 'Proxy-Authorization', 'Cookie', 'Set-Cookie', 'X-CSRFToken'],
                sanitizer: sanitizeNetwork
            }
        });
    } catch (e) {
        _tracker = null;
    }
    return _tracker;
}

// Returns the @openreplay/tracker-redux Redux middleware (or null when inert).
// The middleware is attached at store creation (via main()'s appMiddlewares) but
// the actionFilter drops everything until tracker.start() runs (the consent
// gate), so nothing is captured or buffered before consent.
export function getOpenReplayReduxMiddleware() {
    const tracker = buildOpenReplayTracker();
    if (!tracker) { return null; }
    try {
        return tracker.use(trackerRedux({
            // Denylist auth/credential action types. The substring set covers
            // LOGIN/LOGOUT, CHANGE_PASSWORD, and — critically — the token-bearing
            // REFRESH_SUCCESS / SESSION_VALID / *AUTH* / SET_PROTECTED_SERVICES
            // actions whose `userDetails` payload holds access_token + refresh_token
            // and which contain neither 'PASSWORD' nor 'LOGIN'.
            actionFilter: (action) => _started
                && !!action
                && typeof action.type === 'string'
                && !/PASSWORD|LOGIN|LOGOUT|TOKEN|REFRESH|SESSION|AUTH|PROTECTED_SERVICES/.test(action.type),
            // Belt-and-suspenders: redact credential payloads on any action that
            // still passes the filter (tracker-redux otherwise sends it verbatim).
            actionTransformer: sanitizeReduxAction,
            stateTransformer: reduxStateTransformer
        }));
    } catch (e) {
        return null;
    }
}

// --- EU consent gate (ported from the abandoned W2 snippet) -------------------
function isLikelyEU() {
    try {
        const tz = (new Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        // Europe/* and the EU-adjacent Atlantic zones (Canary/Madeira/Azores).
        return /^Europe\//.test(tz) || /^Atlantic\/(Canary|Madeira|Azores)$/.test(tz);
    } catch (e) {
        // If we cannot determine the zone, fail SAFE → treat as EU (require consent).
        return true;
    }
}
function hasStoredConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY) === 'yes'; } catch (e) { return false; }
}
function storeConsent() {
    try { window.localStorage.setItem(CONSENT_KEY, 'yes'); } catch (e) { /* ignore */ }
}
function hasSeenDisclosure() {
    try { return window.localStorage.getItem(DISCLOSURE_SEEN_KEY) === 'yes'; } catch (e) { return false; }
}
function storeDisclosureSeen() {
    try { window.localStorage.setItem(DISCLOSURE_SEEN_KEY, 'yes'); } catch (e) { /* ignore */ }
}

function actuallyStart(user) {
    const tracker = buildOpenReplayTracker();
    if (!tracker || _started) { return; }
    _started = true; // gate the redux actionFilter ON
    const { cohort } = getConfig();
    try {
        const startResult = tracker.start();
        const after = () => {
            // Stamp the user if one is already known at boot (a page loaded while
            // authenticated); when the session starts anonymous this no-ops and
            // setOpenReplayUser stamps it on the later login (F1).
            applyUserId(tracker, user);
            try { tracker.setMetadata('cohort', cohort); } catch (e) { /* ignore */ }
        };
        if (startResult && typeof startResult.then === 'function') {
            startResult.then(after).catch(() => {});
        } else {
            after();
        }
    } catch (e) { /* never let tracker start throw into the app */ }
}

// Cohort-disclosure banner — also the EU consent gate. Mirrors the abandoned
// snippet's banner: for EU visitors recording does not start until they accept.
function showDisclosure(requireConsentBeforeStart, onAccept) {
    if (typeof document === 'undefined' || document.getElementById('or-consent-banner')) { return; }
    const banner = document.createElement('div');
    banner.id = 'or-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
        'z-index:100000', 'max-width:640px', 'width:calc(100% - 32px)', 'box-sizing:border-box',
        'padding:12px 16px', 'background:#1f2d3d', 'color:#f5f7fa', 'border-radius:6px',
        'box-shadow:0 4px 16px rgba(0,0,0,0.35)', 'font-size:13px', 'line-height:1.4',
        'display:flex', 'align-items:center', 'gap:12px', 'flex-wrap:wrap'
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = 'flex:1 1 280px;';
    text.innerHTML = 'To improve Hydrata, we capture anonymised sessions — '
        + 'your inputs and sensitive data stay masked. '
        + '<a href="/privacy-policy" style="color:#54acd2;text-decoration:underline;">Privacy Policy</a>.';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex:0 0 auto;';

    const removeBanner = () => { if (banner.parentNode) { banner.parentNode.removeChild(banner); } };
    const mkBtn = (label, primary) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = primary
            ? 'border:0;border-radius:4px;padding:6px 14px;font-size:13px;cursor:pointer;background:#54acd2;color:#06222e;font-weight:600;'
            : 'border:0;border-radius:4px;padding:6px 14px;font-size:13px;cursor:pointer;background:transparent;color:#c3ced8;text-decoration:underline;';
        return b;
    };

    if (requireConsentBeforeStart) {
        const accept = mkBtn('Accept & continue', true);
        accept.addEventListener('click', () => { storeConsent(); removeBanner(); if (onAccept) { onAccept(); } });
        const decline = mkBtn('No thanks', false);
        decline.addEventListener('click', removeBanner);
        actions.appendChild(accept);
        actions.appendChild(decline);
    } else {
        const ok = mkBtn('Got it', true);
        ok.addEventListener('click', () => { storeDisclosureSeen(); removeBanner(); });
        actions.appendChild(ok);
    }

    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
}

// Public entry: run the consent gate then start the tracker. EU + no prior
// consent => show the gate and start only on accept; otherwise start masked
// immediately and show a dismissible disclosure. Safe to call once after the
// store is created (onStoreInit). No-op when inert.
export function startOpenReplayWithConsent(user) {
    const tracker = buildOpenReplayTracker();
    if (!tracker) { return; }
    if (isLikelyEU() && !hasStoredConsent()) {
        showDisclosure(true, () => actuallyStart(user));
    } else {
        actuallyStart(user);
        // Informational (non-consent) disclosure: show once per browser, not on
        // every page load — re-showing it is what made the banner feel naggy.
        if (!hasSeenDisclosure()) { showDisclosure(false); }
    }
}

// TASK-2129 W3 (F1): stamp the OpenReplay userID mid-session, the first time an
// authenticated `user` appears in the store. The replay session usually STARTS
// anonymous (a visitor lands on the public homepage / login page), so the
// boot-time setUserID in actuallyStart() sees no user; without this a later
// login left sessions.user_id NULL and the run->replay linkage (TASK-2142)
// could not find the session by username. Called from the onStoreInit action
// listener on every action — cheap: a single boolean check once stamped, and a
// no-op until the tracker is started and a non-anonymous user exists. Idempotent
// (applyUserId's _userStamped guard). No-op when inert. Never throws.
export function setOpenReplayUser(user) {
    if (_userStamped || !_tracker || !_started) { return; }
    applyUserId(_tracker, user);
}
