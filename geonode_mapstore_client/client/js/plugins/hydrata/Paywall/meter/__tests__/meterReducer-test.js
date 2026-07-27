/**
 * TASK-2100 (epic 2092 W4.2) — compute-meter reducer.
 */
import expect from 'expect';
import meterReducer, {getComputeMeterState} from '../reducer';
import {
    setComputeBalance,
    setMeterInsufficientBalance,
    setMeterCapExceeded,
    setMeterEstimateCeiling,
    dismissMeterModal
} from '../actions';

describe('TASK-2100 compute-meter reducer', () => {
    it('initial state is dark (enabled false, no modal)', () => {
        const state = meterReducer(undefined, {type: '@@INIT'});
        expect(state.enabled).toBe(false);
        expect(state.balance).toBe(null);
        expect(state.modal).toBe(null);
    });

    it('SET_COMPUTE_BALANCE (flag-off dark shape) keeps everything dark/empty', () => {
        const state = meterReducer(undefined, setComputeBalance({
            enabled: false, balance: null, available_packs: [], recent_entries: []
        }));
        expect(state.enabled).toBe(false);
        expect(state.balance).toBe(null);
    });

    // ── TASK-2513 (epic 2425 W3d): `loaded`, the discriminator ───────────────
    //
    // Mirrors Paywall/account/reducer.js's own flag and its docstring in intent:
    // it distinguishes "never fetched yet" from a genuinely empty/dark response.
    // That distinction is not cosmetic here — initialState and the dark response
    // reduce to the IDENTICAL {enabled: false, balance: null}, so `balance ===
    // null` cannot decide between "the boot fetch failed and nothing has ever
    // answered" and "the meter is off on this site", and a repair keyed on it
    // would fetch on every account summary for the life of every dark session
    // (three of the four prod sites).
    it('a never-fetched slice reads loaded: false', () => {
        expect(meterReducer(undefined, {type: '@@INIT'}).loaded).toBe(false);
    });

    it('the DARK response marks the slice LOADED — dark is an answer, not silence', () => {
        // The verbatim _dark_response() body from commerce/balance_views.py.
        const state = meterReducer(undefined, setComputeBalance({
            enabled: false, balance: null, available_packs: [], recent_entries: []
        }));
        expect(state.loaded).toBe(
            true,
            'a dark response left the slice indistinguishable from never-fetched, '
            + 'so the repair epic will refetch it forever'
        );
        expect(state.enabled).toBe(false);
        expect(state.balance).toBe(null);
    });

    it('the no-billing-account response also marks it LOADED', () => {
        const state = meterReducer(undefined, setComputeBalance({
            enabled: true, balance: null, available_packs: [], recent_entries: []
        }));
        expect(state.loaded).toBe(true);
        expect(state.enabled).toBe(true);
        expect(state.balance).toBe(null);
    });

    it('SET_COMPUTE_BALANCE (flag-on, real data) populates balance/packs/entries', () => {
        // TASK-2124 — available_packs entries are {price_id, amount, currency}
        // objects; the reducer is a transparent passthrough (no shape
        // knowledge of its own), so this also pins that passthrough contract.
        const state = meterReducer(undefined, setComputeBalance({
            enabled: true,
            balance: '15.00',
            available_packs: [
                {price_id: 'price_a', amount: '10', currency: 'usd'},
                {price_id: 'price_b', amount: null, currency: null}
            ],
            recent_entries: [{entry_type: 'debit', amount: '5.00', run_id: 1, created_at: '2026-01-01T00:00:00Z'}]
        }));
        expect(state.enabled).toBe(true);
        expect(state.balance).toBe('15.00');
        expect(state.availablePacks).toEqual([
            {price_id: 'price_a', amount: '10', currency: 'usd'},
            {price_id: 'price_b', amount: null, currency: null}
        ]);
        expect(state.recentEntries.length).toBe(1);
    });

    it('SET_METER_INSUFFICIENT_BALANCE arms the modal with checkoutUrl + detail', () => {
        const state = meterReducer(undefined, setMeterInsufficientBalance('https://x/', 'not enough $'));
        expect(state.modal).toEqual({type: 'insufficient_balance', checkoutUrl: 'https://x/', detail: 'not enough $'});
    });

    it('SET_METER_CAP_EXCEEDED arms a DISTINCT modal type from insufficient_balance', () => {
        const state = meterReducer(undefined, setMeterCapExceeded('cap reached'));
        expect(state.modal.type).toBe('cap_exceeded');
        expect(state.modal.type).toNotBe('insufficient_balance');
        expect(state.modal.checkoutUrl).toBe(null);
    });

    it('SET_METER_ESTIMATE_CEILING arms a DISTINCT modal type from insufficient_balance AND cap_exceeded', () => {
        const state = meterReducer(undefined, setMeterEstimateCeiling('estimate too high'));
        expect(state.modal.type).toBe('estimate_ceiling');
        // NOTE: this repo's `expect` (mjackson/expect@1.20.1) has no `.not`
        // chain — use its own `toNotBe` negation (verified via a scoped
        // karma run; `.not.toBe()` throws "Cannot read properties of
        // undefined" at runtime on this library version).
        expect(state.modal.type).toNotBe('insufficient_balance');
        expect(state.modal.type).toNotBe('cap_exceeded');
        expect(state.modal.checkoutUrl).toBe(null);
        expect(state.modal.detail).toBe('estimate too high');
    });

    it('DISMISS_METER_MODAL clears any modal', () => {
        let state = meterReducer(undefined, setMeterCapExceeded('cap reached'));
        state = meterReducer(state, dismissMeterModal());
        expect(state.modal).toBe(null);
    });

    describe('getComputeMeterState', () => {
        it('returns the dark default when there is no anuga.computeMeter slice', () => {
            expect(getComputeMeterState({}).enabled).toBe(false);
        });

        it('reads the mounted slice', () => {
            const state = {anuga: {computeMeter: {enabled: true, balance: '3.00', availablePacks: [], recentEntries: [], modal: null}}};
            expect(getComputeMeterState(state).balance).toBe('3.00');
        });
    });
});
