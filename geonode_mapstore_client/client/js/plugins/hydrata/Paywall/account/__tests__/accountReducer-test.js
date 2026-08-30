/**
 * TASK-2420 (epic 2359 W4.5) — Account summary reducer.
 * TASK-2848 (epic 2839 W2.1) — `free_band.table` retired: band() and its FE
 * mirror are gone from every surface (AC2839-AC6); the /commerce/account/
 * payload no longer carries a price-band table.
 */
import expect from 'expect';
import accountReducer, { getAccountSummaryState } from '../reducer';
import { setAccountSummary, requestBillingPortal, setBillingPortalError } from '../actions';

describe('TASK-2420 account summary reducer', () => {
    it('initial state is not loaded, dark-ish defaults', () => {
        const state = accountReducer(undefined, { type: '@@INIT' });
        expect(state.loaded).toBe(false);
        expect(state.balance).toBe(null);
        expect(state.isPersonal).toBe(true);
        expect(state.isManager).toBe(false);
        expect(state.freeBand).toEqual({ cap: 0, usedToday: 0, edge: '0' });
    });

    it('SET_ACCOUNT_SUMMARY populates every field from the /commerce/account/ shape', () => {
        const state = accountReducer(undefined, setAccountSummary({
            organisation: 'Acme Org',
            is_personal: false,
            manager: 'acme_manager',
            is_manager: true,
            balance: '15.00',
            free_band: { cap: 3, used_today: 1, edge: '0.5' },
            subscription: { active: true, since: '2026-01-01T00:00:00Z' },
            available_packs: [{ price_id: 'p1', amount: '10', currency: 'usd' }],
            recent_entries: [{ date: '2026-07-23', entry_type: 'debit', amount: '2.00', run: null }]
        }));
        expect(state.loaded).toBe(true);
        expect(state.organisation).toBe('Acme Org');
        expect(state.isPersonal).toBe(false);
        expect(state.manager).toBe('acme_manager');
        expect(state.isManager).toBe(true);
        expect(state.balance).toBe('15.00');
        expect(state.freeBand).toEqual({ cap: 3, usedToday: 1, edge: '0.5' });
        expect(state.subscription).toEqual({ active: true, since: '2026-01-01T00:00:00Z' });
        expect(state.availablePacks.length).toBe(1);
        expect(state.recentEntries.length).toBe(1);
    });

    it('SET_ACCOUNT_SUMMARY on a personal account: organisation null, isPersonal true', () => {
        const state = accountReducer(undefined, setAccountSummary({
            organisation: null,
            is_personal: true,
            manager: 'solo_user',
            is_manager: true,
            balance: '0.00',
            free_band: { cap: 3, used_today: 0, edge: '0.5' },
            subscription: { active: false, since: null },
            available_packs: [],
            recent_entries: []
        }));
        expect(state.organisation).toBe(null);
        expect(state.isPersonal).toBe(true);
    });

    it('REQUEST_BILLING_PORTAL arms portalLoading and clears any previous error', () => {
        const withError = accountReducer(undefined, setBillingPortalError('boom'));
        const state = accountReducer(withError, requestBillingPortal());
        expect(state.portalLoading).toBe(true);
        expect(state.portalError).toBe(null);
    });

    it('SET_BILLING_PORTAL_ERROR stores the detail and clears portalLoading', () => {
        const armed = accountReducer(undefined, requestBillingPortal());
        const state = accountReducer(armed, setBillingPortalError('Only the manager can do that.'));
        expect(state.portalLoading).toBe(false);
        expect(state.portalError).toBe('Only the manager can do that.');
    });

    it('getAccountSummaryState reads state.anuga.accountSummary, defaulting when absent', () => {
        expect(getAccountSummaryState({}).loaded).toBe(false);
        const populated = accountReducer(undefined, setAccountSummary({ balance: '5.00' }));
        expect(getAccountSummaryState({ anuga: { accountSummary: populated } }).balance).toBe('5.00');
    });
});
