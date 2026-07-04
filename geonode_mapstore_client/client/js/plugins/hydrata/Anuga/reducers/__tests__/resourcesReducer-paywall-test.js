/*
 * TASK-2099 (epic 2092 W4.1) — regression: SET_ANUGA_RESOURCE_PERMS's
 * generic per-resource-type merge loop must SKIP the `paywall` key.
 *
 * `paywall` is an OBJECT ({state, checkout_url, read_only}), not an
 * {idStr: perms[]} map, but it still passes the loop's `typeof idsToPerms
 * !== 'object'` guard (an object IS an object) — so without an explicit
 * skip, Object.entries(paywall) yields keys 'state'/'checkout_url'/
 * 'read_only', each fails parseInt(), and resources.paywall silently ends
 * up [] (the payload is dropped instead of reaching Paywall/reducer.js).
 */
import expect from 'expect';
import resourcesReducer from '../resourcesReducer';
import {SET_ANUGA_RESOURCE_PERMS} from '../../actionsAnuga';

describe('TASK-2099 resourcesReducer — paywall key is skipped by the resource merge', () => {
    it('does not create a resources.paywall slot from the my_perms paywall block', () => {
        const state = resourcesReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {
                my_role: 'owner',
                visibility: 'public',
                paywall: {state: 'free_public', checkout_url: null, read_only: false},
                boundaries: {'1': ['view_resourcebase']}
            }
        });

        // The generic merge loop must never have touched 'paywall'.
        expect(state.paywall).toBe(undefined);
        // Sanity: a genuine resource-type key in the SAME action still merges normally.
        expect(state.boundaries.find((b) => b.id === 1).perms).toEqual(['view_resourcebase']);
    });

    it('leaves permsLoadFailed cleared and does not throw on a paywall-only payload', () => {
        const state = resourcesReducer(undefined, {
            type: SET_ANUGA_RESOURCE_PERMS,
            payload: {paywall: {state: 'past_due', checkout_url: 'https://x/commerce/checkout/create-session/', read_only: true}}
        });
        expect(state.permsLoadFailed).toBe(false);
        expect(state.paywall).toBe(undefined);
    });
});
