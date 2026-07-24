/**
 * BillingTabPanel — the Account panel's Billing tab content (TASK-2420,
 * epic 2359 W4.5, docs/strategy/account-panel-spec.md).
 *
 * Re-homes the existing DARK ComputeMeterPanel/BalanceStrip content (balance,
 * pack-purchase CTAs, recent ledger, billing-policy link) rather than
 * forking a second copy — this component composes BalanceStrip alongside the
 * NEW sections the spec adds around it: account header (org/personal +
 * manager), the free-band explainer (live settings values), the
 * subscription section (manager-only subscribe/manage), and the /plans
 * footer link (BalanceStrip already carries /billing-policy).
 *
 * Top->bottom order matches the spec's "Billing tab contents" list exactly.
 */
import React from 'react';
const PropTypes = require('prop-types');
import { BalanceStrip } from '../../meter/components/ComputeMeterPanel';
// TASK-2424 (epic 2359 W4.5) — SimpleView Design System v1 primitives (chassis
// Section for titled/divided sub-sections, EmptyState for the recent-activity
// empty state) + Message for i18n'd headings. Reuses the catalogue rather than
// hand-rolling parallel section-header CSS (SimpleView/DESIGN-SYSTEM-AUDIT.md
// Part F). CSS: ../account.css (scoped to .sv-account-billing-tab; the
// flags-off Permissions panel never mounts this component).
import { Section, EmptyState } from '../../../SimpleView/components/primitives';
import Message from '@mapstore/framework/components/I18N/Message';
import '../account.css';

function AccountHeader({ organisation, isPersonal, manager }) {
    // UAT-2 redesign — one compressed line ("Personal account · managed by
    // testuser") instead of three stacked spans; the '·' separators come from
    // CSS so the span texts (and their testids) stay assertion-stable.
    return (
        <div className="sv-account-header" data-testid="sv-account-header">
            <span className="sv-account-header-org" data-testid="sv-account-header-org">
                {isPersonal ? 'Personal account' : organisation}
            </span>
            {!isPersonal ? (
                <span className="sv-account-header-shared" data-testid="sv-account-header-shared">
                    {`shared by all members of ${organisation}`}
                </span>
            ) : null}
            {manager ? (
                <span className="sv-account-header-manager" data-testid="sv-account-header-manager">
                    {`managed by ${manager}`}
                </span>
            ) : null}
        </div>
    );
}

AccountHeader.propTypes = {
    organisation: PropTypes.string,
    isPersonal: PropTypes.bool,
    manager: PropTypes.string
};

/**
 * Free-band explainer (spec item 3): "N of CAP used" + the explainer copy,
 * with CAP/EDGE read live from the account summary (which itself reads
 * settings.COMPUTE_FREE_DAILY_CAP / COMPUTE_PRICE_FREE_THRESHOLD_USD —
 * commerce.account_views.AccountSummaryView) — never hardcoded here, so a
 * settings change can never leave this copy stale.
 */
function FreeBandSection({ freeBand }) {
    const cap = freeBand?.cap ?? 0;
    const usedToday = freeBand?.usedToday ?? 0;
    const edge = freeBand?.edge ?? '0';
    // UAT-2 redesign — segment meter (used = dim, remaining = green). Capped
    // at 12 segments so a config change to a large cap degrades to text-only
    // rather than a wall of slivers.
    const segments = cap > 0 && cap <= 12 ? Array.from({ length: cap }, (_, i) => i < usedToday) : null;
    return (
        <Section title={<Message msgId="hydrata.anuga.accountFreeRunsHeading" />}>
            <div className="sv-account-free-band" data-testid="sv-account-free-band">
                <span className="sv-account-free-band-count" data-testid="sv-account-free-band-count">
                    {`${usedToday} of ${cap} used`}
                </span>
                {segments ? (
                    <div className="sv-account-free-band-meter" aria-hidden="true">
                        {segments.map((used, i) => (
                            <span
                                key={i}
                                className={`sv-account-free-band-meter-seg${used ? ' sv-account-free-band-meter-seg--used' : ''}`}
                            />
                        ))}
                    </div>
                ) : null}
                <span className="sv-account-free-band-explainer">
                    {`Runs estimated under $${edge} are free — up to ${cap} per day for your account.`}
                </span>
            </div>
        </Section>
    );
}

FreeBandSection.propTypes = {
    freeBand: PropTypes.shape({
        cap: PropTypes.number,
        usedToday: PropTypes.number,
        edge: PropTypes.string
    })
};

/**
 * Subscription section (spec item 5): manager-only subscribe/manage.
 * A non-manager sees "ask <manager> to subscribe" per spec — never the
 * subscribe CTA itself (a $100/mo recurring commitment is the manager's
 * call alone, TASK-2364's Account.manager-only decision).
 */
function SubscriptionSection({ subscription, isManager, manager, onSubscribe, onManageBilling, portalLoading }) {
    const active = !!subscription?.active;
    const since = subscription?.since;
    // UAT-2 redesign — "Private models" label + state pill on one line with
    // the (outlined) manager action right-aligned; the /plans link folds into
    // the caption here (the modal footer's orphan "Plans" link is gone).
    return (
        <Section title={<Message msgId="hydrata.anuga.accountSubscriptionHeading" />}>
            <div className="sv-account-subscription" data-testid="sv-account-subscription">
                <div className="sv-account-subscription-topline">
                    <span className="sv-account-subscription-label">Private models</span>
                    <span
                        className={`sv-account-subscription-state sv-account-pill ${active ? 'sv-account-pill--ok' : 'sv-account-pill--dim'}`}
                        data-testid="sv-account-subscription-state"
                    >
                        {active
                            ? `Active${since ? ` since ${since.slice(0, 10)}` : ''}`
                            : 'Not subscribed'}
                    </span>
                    {isManager ? (
                        active ? (
                            <button
                                type="button"
                                data-testid="sv-account-manage-billing-btn"
                                className="sv-account-btn-sm sv-account-manage-billing-btn"
                                disabled={portalLoading}
                                onClick={onManageBilling}
                            >
                                {portalLoading ? 'Opening…' : 'Manage billing'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                data-testid="sv-account-subscribe-btn"
                                className="sv-account-btn-sm sv-account-subscribe-btn"
                                onClick={onSubscribe}
                            >
                                Subscribe
                            </button>
                        )
                    ) : null}
                </div>
                <span className="sv-account-subscription-caption">
                    {'Subscribe to collaborate on private models. '}
                    <a className="sv-account-plans-link" href="/plans" data-testid="sv-account-plans-link">See plans</a>
                </span>
                {!isManager ? (
                    <span className="sv-account-subscription-ask-manager" data-testid="sv-account-ask-manager">
                        {`Ask ${manager || 'your account manager'} to ${active ? 'manage' : 'subscribe'}`}
                    </span>
                ) : null}
            </div>
        </Section>
    );
}

SubscriptionSection.propTypes = {
    subscription: PropTypes.shape({ active: PropTypes.bool, since: PropTypes.string }),
    isManager: PropTypes.bool,
    manager: PropTypes.string,
    onSubscribe: PropTypes.func,
    onManageBilling: PropTypes.func,
    portalLoading: PropTypes.bool
};

function BillingTabPanel({
    loaded, organisation, isPersonal, manager, isManager, balance, freeBand, subscription,
    availablePacks, recentEntries, portalLoading, portalError,
    onBuyPack, onSubscribe, onManageBilling
}) {
    if (!loaded) {
        return (
            <div className="sv-account-billing-tab sv-account-billing-loading" data-testid="sv-account-billing-loading">
                Loading account…
            </div>
        );
    }
    return (
        <div className="sv-account-billing-tab" data-testid="sv-account-billing-tab">
            <AccountHeader organisation={organisation} isPersonal={isPersonal} manager={manager} />
            {/* recentEntries intentionally NOT passed here — this panel renders
                its OWN richer "Recent activity" list below (with run->project
                links, spec item 6), so BalanceStrip only contributes balance +
                packs + the billing-policy link here. */}
            <BalanceStrip
                balance={balance}
                availablePacks={availablePacks}
                onBuyPack={onBuyPack}
                variant="card"
            />
            <FreeBandSection freeBand={freeBand} />
            <SubscriptionSection
                subscription={subscription}
                isManager={isManager}
                manager={manager}
                onSubscribe={onSubscribe}
                onManageBilling={onManageBilling}
                portalLoading={portalLoading}
            />
            {portalError ? (
                <div className="sv-account-portal-error" data-testid="sv-account-portal-error">
                    {portalError}
                </div>
            ) : null}
            {recentEntries && recentEntries.length > 0 ? (
                <Section title={<Message msgId="hydrata.anuga.accountRecentActivityHeading" />}>
                    <div className="sv-account-recent-activity" data-testid="sv-account-recent-activity">
                        <ul className="sv-account-recent-entries-list">
                            {recentEntries.map((entry, idx) => (
                                // index-as-key: read-only, server-ordered list, no reorder/insert
                                // (mirrors BalanceStrip's own recentEntries.map precedent).
                                <li key={idx} className="sv-account-recent-entry-row">
                                    <span className="sv-account-recent-entry-date">{(entry.date || '').slice(0, 10)}</span>
                                    <span className="sv-account-recent-entry-type">{entry.entry_type}</span>
                                    <span className="sv-account-recent-entry-amount">{`$${entry.amount}`}</span>
                                    {entry.run ? (
                                        <a
                                            className="sv-account-recent-entry-run-link"
                                            href={`#/map/${entry.run.project_id}`}
                                            data-testid="sv-account-recent-entry-run-link"
                                        >
                                            {entry.run.project_name || `Run ${entry.run.run_id}`}
                                        </a>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                </Section>
            ) : (
                // TASK-2424 — genuinely empty (no ledger rows for this user) still
                // gets the section heading + the catalogue EmptyState primitive,
                // rather than rendering nothing at all. Distinct data-testid from
                // the populated branch's "sv-account-recent-activity" (TASK-2420
                // karma still asserts THAT testid is absent when empty).
                <Section title={<Message msgId="hydrata.anuga.accountRecentActivityHeading" />}>
                    <div className="sv-account-recent-activity-empty" data-testid="sv-account-recent-activity-empty">
                        <EmptyState heading={<Message msgId="hydrata.anuga.accountRecentActivityEmpty" />}>
                            Purchases and runs will appear here.
                        </EmptyState>
                    </div>
                </Section>
            )}
            {/* UAT-2 redesign — the orphan footer "Plans" link folded into the
                subscription caption above ("See plans"); no footer block. */}
        </div>
    );
}

BillingTabPanel.propTypes = {
    loaded: PropTypes.bool,
    organisation: PropTypes.string,
    isPersonal: PropTypes.bool,
    manager: PropTypes.string,
    isManager: PropTypes.bool,
    balance: PropTypes.string,
    freeBand: PropTypes.shape({
        cap: PropTypes.number, usedToday: PropTypes.number, edge: PropTypes.string
    }),
    subscription: PropTypes.shape({ active: PropTypes.bool, since: PropTypes.string }),
    availablePacks: PropTypes.array,
    recentEntries: PropTypes.array,
    portalLoading: PropTypes.bool,
    portalError: PropTypes.string,
    onBuyPack: PropTypes.func,
    onSubscribe: PropTypes.func,
    onManageBilling: PropTypes.func
};

BillingTabPanel.defaultProps = {
    loaded: false,
    isPersonal: true,
    availablePacks: [],
    recentEntries: [],
    onBuyPack: () => {},
    onSubscribe: () => {},
    onManageBilling: () => {}
};

export default BillingTabPanel;
export { AccountHeader, FreeBandSection, SubscriptionSection };
