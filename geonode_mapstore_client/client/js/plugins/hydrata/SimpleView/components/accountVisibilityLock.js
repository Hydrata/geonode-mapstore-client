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
 * `lapsed` is the paywall's past_due steady state. It is surfaced here rather
 * than dropped because past_due is the day-one default at flip (84 of 84
 * non-public prod owners are unentitled) and deleting the dunning banner
 * removed its only other proactive surface. The RENEW ACTION still lives in
 * Account > Billing (BillingTabPanel SubscriptionSection) — this is the
 * notice, not the affordance.
 *
 * HARD CONTRACT RULE: a lapse never auto-publishes. The lapsed wording must
 * therefore never imply the model has become public.
 */
export function visibilityLockLabel(visibility, lapsed) {
    const tier = LOCKED_VISIBILITIES[visibility];
    if (!tier) {
        return null;
    }
    return lapsed
        ? `Project visibility: ${tier} (subscription lapsed)`
        : `Project visibility: ${tier}`;
}

function AccountVisibilityLock({ visibility, lapsed }) {
    const label = visibilityLockLabel(visibility, lapsed);
    if (!label) {
        return null;
    }
    return (
        <span
            data-testid="sv-visibility-lock"
            data-visibility={visibility}
            className={`sv-visibility-lock${lapsed ? ' sv-visibility-lock--lapsed' : ''}`}
            role="img"
            aria-label={label}
        >
            <Glyphicon glyph="lock" />
        </span>
    );
}

AccountVisibilityLock.propTypes = {
    /** Project visibility from the server: 'public' | 'private' | 'organization'. */
    visibility: PropTypes.string,
    /** True when the paywall steady state is past_due. */
    lapsed: PropTypes.bool
};

AccountVisibilityLock.defaultProps = {
    visibility: null,
    lapsed: false
};

export default AccountVisibilityLock;
