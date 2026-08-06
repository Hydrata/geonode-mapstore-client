/**
 * BetaNoticeBanner — TASK-2638 (epic 2635 W1).
 *
 * Dismissible, hydrata.com-only, signed-in-user notice: the platform is in
 * beta, names the account's remaining compute credit (a number the user can
 * watch go down — NOT an open-ended "free" claim), and states payments are
 * in TEST mode (no card is charged). Pure/presentational: all gating
 * (jobName, signed-in, dismissed) is computed by
 * BetaNoticeBannerContainer — this component only decides whether to
 * render its own DOM given the `visible` prop it is handed, exactly the
 * split anugaScenarioMenu.js/scenarioPane.js use for isStaff.
 *
 * The credit figure is sourced from Paywall/account/reducer.js's
 * `balance` (GET /commerce/account/, already fetched once per INIT_ANUGA
 * regardless of whether the Billing tab is ever opened — see
 * accountEpics.js's triggerFetchAccountSummaryOnInitEpic) — never a
 * hardcoded literal, and never duplicated/recomputed here.
 */
import React from 'react';
const PropTypes = require('prop-types');
import './betaNoticeBanner.css';

const BetaNoticeBanner = ({ visible, balance, loaded, onDismiss }) => {
    if (!visible) return null;

    const hasCredit = loaded && balance !== null && balance !== undefined && !Number.isNaN(Number(balance));
    const creditClause = hasCredit
        ? ` You have $${Number(balance).toFixed(2)} of free compute credit remaining on your account.`
        : '';

    return (
        <div className="sv-beta-notice-banner" role="status" data-testid="sv-beta-notice-banner">
            <span className="sv-beta-notice-banner-text" data-testid="sv-beta-notice-banner-text">
                {'Hydrata is currently in beta.'}
                {creditClause}
                {' Payments are in test mode — no card will be charged.'}
            </span>
            <button
                type="button"
                className="sv-beta-notice-banner-dismiss"
                data-testid="sv-beta-notice-banner-dismiss"
                aria-label="Dismiss beta notice"
                onClick={onDismiss}
            >
                {'×'}
            </button>
        </div>
    );
};

BetaNoticeBanner.propTypes = {
    visible: PropTypes.bool,
    balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    loaded: PropTypes.bool,
    onDismiss: PropTypes.func
};

BetaNoticeBanner.defaultProps = {
    visible: false,
    balance: null,
    loaded: false,
    onDismiss: () => {}
};

export default BetaNoticeBanner;
