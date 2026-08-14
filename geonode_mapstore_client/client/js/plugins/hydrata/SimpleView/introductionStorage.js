/**
 * ANONYMOUS acceptance of the project introduction — localStorage, and ONLY
 * localStorage (TASK-2774, epic 2765 W3).
 *
 * SETTLED DECISION 3. An AUTHENTICATED acceptance is a server row
 * (`POST /api/v2/anuga/projects/<id>/introduction/accept/`, which writes an
 * `IntroductionAcceptance` keyed by user x project x content_version). An
 * ANONYMOUS acceptance is a flag in this one browser and NOTHING ELSE. It is
 * explicitly NOT evidence that anybody agreed to anything — it exists so a
 * stranger who has already read the disclaimer is not re-interrupted on every
 * page load, and for no other purpose. Nothing in this module, in any consumer,
 * or in any UI copy may imply otherwise.
 *
 * ⚠ WHY THE FRONTEND MUST NOT SIMPLY POST WHEN LOGGED OUT.
 * `/accept/` is `IsAuthenticated`, and an anonymous POST answers 401 WITH a
 * `WWW-Authenticate: Basic` header — BasicAuthentication leads GeoNode's
 * `DEFAULT_AUTHENTICATION_CLASSES`, and DRF emits the challenge of whichever
 * authenticator comes first. A browser is entitled to answer that header by
 * surfacing a NATIVE BASIC-AUTH PASSWORD PROMPT, which would be a serious
 * failure on precisely the anonymous link-recipient path this epic exists to
 * serve. So the anonymous accept issues NO request at all — it writes here and
 * stops. `introductionEpics-test.js` pins that no `/accept/` request is made
 * when logged out; that assertion is the guard, not this comment.
 *
 * KEYED BY PROJECT, VALUED BY CONTENT VERSION. Any content edit changes
 * `content_version`, so a stored value that no longer equals the current one
 * re-prompts: the viewer accepted the OLD text. That is the "acceptance resets
 * on edit" rule, implemented as a comparison rather than as an ever-accepted
 * boolean. `content_version` is an opaque sha256 hex token — compared for
 * equality only, never ordered, never parsed, never displayed.
 *
 * NOT keyed by username, unlike `betaNoticeBannerDismiss`: this path is only
 * ever reached when there IS no username. An authenticated viewer's acceptance
 * is the server row and never touches localStorage, so a shared workstation
 * cannot leak one signed-in user's acceptance to the next.
 */

const KEY_PREFIX = 'hydrata.introduction.acceptedVersion.v1.';

const keyFor = (projectId) => `${KEY_PREFIX}${projectId}`;

const usable = () => typeof window !== 'undefined' && !!window.localStorage;

/**
 * The `content_version` this browser last anonymously accepted for `projectId`,
 * or null.
 *
 * Fails toward SHOWING the modal on every storage fault (private browsing,
 * quota, storage disabled). Over-showing a disclaimer is recoverable in one
 * click; silently suppressing it for someone who has never seen it is not.
 */
export const anonymousAcceptedVersion = (projectId) => {
    if (!projectId || !usable()) return null;
    try {
        return window.localStorage.getItem(keyFor(projectId)) || null;
    } catch (e) {
        return null;
    }
};

/** Record an anonymous acceptance of `contentVersion` for `projectId`. */
export const rememberAnonymousAcceptance = (projectId, contentVersion) => {
    if (!projectId || !contentVersion || !usable()) return;
    try {
        window.localStorage.setItem(keyFor(projectId), contentVersion);
    } catch (e) {
        // Same fail-open posture as the read: the acceptance just does not
        // persist, and the viewer is asked again next time.
    }
};

/** Test seam — drop the flag for one project. */
export const __forgetAnonymousAcceptance = (projectId) => {
    if (!projectId || !usable()) return;
    try {
        window.localStorage.removeItem(keyFor(projectId));
    } catch (e) { /* see above */ }
};
