/**
 * BetaNoticeBannerContainer — connects BetaNoticeBanner to Redux (TASK-2638,
 * epic 2635 W1).
 *
 * Gate is RUNTIME, on jobName — same proven per-site switch as
 * simpleViewMenuRow.js:1094-1098 (SWAMM-only UI). No localConfig.json cfg
 * key: one gmc dist serves all four sites (release.yml carries a single
 * SHA with no per-site override) and plugin cfg threading has an unresolved
 * risk filed as TASK-2422.
 *
 * Dismissal is per-USERNAME localStorage (betaNoticeBannerDismiss.js), read
 * on mount and whenever the signed-in user changes — a different user on
 * the same browser (shared workstation / test-persona swap) must see the
 * banner even if a previous user dismissed it (AC3).
 */
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import BetaNoticeBanner from '../components/BetaNoticeBanner';
import { getAccountSummaryState } from '../account/reducer';
import { isDismissedFor, setDismissedFor } from '../components/betaNoticeBannerDismiss';

export const BetaNoticeBannerContainer = ({ jobName, username, signedIn, balance, loaded }) => {
    const [dismissed, setDismissed] = useState(() => isDismissedFor(username));

    useEffect(() => {
        setDismissed(isDismissedFor(username));
    }, [username]);

    const handleDismiss = () => {
        setDismissedFor(username);
        setDismissed(true);
    };

    const visible = !!signedIn && jobName === 'hydratabase' && !dismissed;

    return (
        <BetaNoticeBanner
            visible={visible}
            balance={balance}
            loaded={loaded}
            onDismiss={handleDismiss}
        />
    );
};

const mapStateToProps = (state) => {
    const account = getAccountSummaryState(state);
    return {
        jobName: state?.gnsettings?.jobName,
        username: state?.security?.user?.username || null,
        signedIn: !!state?.security?.user,
        balance: account.balance,
        loaded: account.loaded
    };
};

export default connect(mapStateToProps)(BetaNoticeBannerContainer);
