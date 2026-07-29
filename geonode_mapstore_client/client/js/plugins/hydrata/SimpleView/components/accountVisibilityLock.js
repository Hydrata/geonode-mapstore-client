/**
 * accountVisibilityLock — the project's visibility, as a padlock overlaid on
 * the top-right of the person icon in the RHS Account button.
 *
 * TASK-2463 (epic 2425 W2.5). Replaces the on-map paywall badge that W2
 * anchored top-centre over the map and the operator rejected at the UAT gate:
 * "the Private badge in the middle of the screen is way too much. can we just
 * move it so the padlock appears over the top right hand side of the person
 * icon in the account button."
 *
 * WHY IT LIVES IN SimpleView AND NOT IN Paywall/
 * ----------------------------------------------
 * It has to be a DOM child of the Account button to be positioned against it
 * (`.sv-visibility-lock-host { position: relative }`), and the Account button
 * is emitted by simpleViewContainer.js. The alternative — portaling from the
 * Paywall plugin into a button owned by another plugin — would make the badge
 * depend on the mount order of two independently-registered plugins and on a
 * DOM node it does not own. The Paywall plugin still owns the DECISION (the
 * TASK-2462 gate lives in Paywall/selectors.js); SimpleView owns the pixels.
 *
 * WHY NO z-index HERE
 * -------------------
 * `.sv-visibility-lock-host` is `position: relative` with z-index AUTO, which
 * does NOT create a stacking context — only a containing block for absolutely
 * positioned descendants, and the Account button has no others. Adding a
 * z-index WOULD create one. Both bites in this epic came from exactly that:
 * `.paywall-panel`'s old `position:relative; z-index:2` capped its own
 * "z-index: 100000" descendant. The precedent followed here is
 * `.sv-tm-button` / `.sv-tm-notification-dot` on the Tasks button directly
 * below — same button family, same corner, same no-z-index rule.
 *
 * ACCESSIBILITY — read before "simplifying" the duplicated label.
 * The padlock carries role="img" + aria-label. On its own that is NOT enough:
 * the `button` role has PRESENTATIONAL CHILDREN in ARIA, so a descendant
 * role=img inside a <button> is not guaranteed to be announced separately.
 * That is why simpleViewContainer ALSO folds visibilityLockLabel() into the
 * button's own aria-label — the padlock is correctly typed for the tools that
 * do expose it, and the information reaches everyone else through the
 * button's accessible name. Neither half is redundant.
 */
import React from 'react';
import { Glyphicon } from 'react-bootstrap';
const PropTypes = require('prop-types');

/** The visibilities that get a padlock. `public` deliberately gets nothing. */
const LOCKED_VISIBILITIES = {
    'private': 'Private',
    'organization': 'Organization'
};

/**
 * The accessible name for a given visibility, or null when no lock renders.
 * Exported so the host button's aria-label and the badge cannot drift apart.
 *
 * VISIBILITY ONLY — no billing annotation (TASK-2463, epic 2425 W2.9). This used
 * to take a second `lapsed` argument and append "(subscription lapsed)". That
 * sentence is a claim about THE PROJECT, and nothing reachable from the frontend
 * establishes it:
 *
 *   - `past_due` comes from `_derive_paywall_state(project, user)`
 *     (gn_anuga/api_v2.py), which resolves `_get_acting_account(user)` and never
 *     `project.account`. It means "the READING user's account holds no paid
 *     private entitlement" — nothing about who paid for the project.
 *   - W2.8 tried to make it attributable by requiring the reader to BE the owner.
 *     That closes only one direction. The mirror is an OWNER whose own account is
 *     unentitled, reading a project a MANAGER privatised on the MANAGER's live
 *     subscription — the backend write gate is min_role=MANAGER and the
 *     entitlement is charged to the ACTING account, so this is a real shape, and
 *     it arrives here in a payload IDENTICAL to a genuinely lapsed owner's.
 *   - `Project.account` is not serialized anywhere (serializers_v2.py) and is
 *     NULL on all 166 production projects, so shipping it would not help either.
 *
 * So the padlock states the visibility, which it knows. The account's own
 * standing is stated where it can be stated truthfully — Account > Billing
 * (BillingTabPanel's SubscriptionSection), which is also where the renew action
 * has always lived. Whether a proactive lapse notice returns, and in what words,
 * is TASK-2487 / epic decision W2.7-D4, both open with the operator.
 *
 * HARD CONTRACT RULE, unchanged and now trivially satisfied: a lapse never
 * auto-publishes, and this label never mentions `public` for a locked tier.
 */
export function visibilityLockLabel(visibility) {
    // hasOwnProperty, not a bare lookup: `visibility` arrives from the wire, and
    // a bare LOCKED_VISIBILITIES[visibility] returns a truthy Object.prototype
    // member for 'constructor'/'toString'/'valueOf' — which would render a
    // padlock whose accessible name is a stringified function.
    if (!Object.prototype.hasOwnProperty.call(LOCKED_VISIBILITIES, visibility)) {
        return null;
    }
    return `Project visibility: ${LOCKED_VISIBILITIES[visibility]}`;
}

function AccountVisibilityLock({ visibility }) {
    const label = visibilityLockLabel(visibility);
    if (!label) {
        return null;
    }
    return (
        <span
            data-testid="sv-visibility-lock"
            data-visibility={visibility}
            className="sv-visibility-lock"
            role="img"
            aria-label={label}
        >
            <Glyphicon glyph="lock" />
        </span>
    );
}

AccountVisibilityLock.propTypes = {
    /** Project visibility from the server: 'public' | 'private' | 'organization'. */
    visibility: PropTypes.string
};

AccountVisibilityLock.defaultProps = {
    visibility: null
};

export default AccountVisibilityLock;
