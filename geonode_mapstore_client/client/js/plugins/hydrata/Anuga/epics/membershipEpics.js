import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import * as anugaApi from '../api/anugaApi';
import {
    FETCH_MEMBERSHIPS,
    ADD_MEMBERSHIP_REQUEST,
    UPDATE_MEMBERSHIP_REQUEST,
    DELETE_MEMBERSHIP_REQUEST,
    UPDATE_PROJECT_VISIBILITY_REQUEST,
    updateProjectVisibilitySettled,
    setMemberships,
    setMembershipsLoading,
    setAnugaProjectData,
    // TASK-860 — invitation actions
    FETCH_INVITATIONS,
    SEND_INVITATION_REQUEST,
    REVOKE_INVITATION_REQUEST,
    RESEND_INVITATION_REQUEST,
    setInvitations,
    fetchInvitations,
    // TASK-2464 (epic 2425 W2.5) — a successful visibility change must refresh
    // the paywall steady state from the SERVER, not from local optimism.
    fetchMyPerms
} from "../actionsAnuga";
// TASK-2099 (epic 2092 W4.1) — 402 on a public->private visibility PATCH
// carries the upgrade_prompt contract shape (_check_private_entitlement_response,
// api_v2.py). Route it into the paywall overlay instead of the generic error toast.
import {setPaywallUpgradePrompt} from '../../Paywall/actions';
// Shared axios error-shape readers (see crudEpics.js's original comment / the
// util's own docstring for the MapStore2 ajax-interceptor gotcha).
import {readErrStatus as _readErrStatus, readErrData as _readErrData} from '../utils/apiErrorUtils';
// TASK-2498 (epic 2425 W3d) — the visibility PATCH writes the same slice
// my_perms responses do, so it has to draw from the same per-project sequence.
// permsEpics owns the counter; a second one here would not be a sequence.
import {markProjectWriteApplied} from './permsEpics';

const getProjectId = (state) => state?.anuga?.projects?.data?.id;

export const fetchMembershipsEpic = (action$, store) =>
    action$.ofType(FETCH_MEMBERSHIPS)
        .switchMap(() => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.getMemberships(projectId))
                .map(response => setMemberships(response?.data?.results || response?.data || []))
                .catch(() => Rx.Observable.of(
                    setMembershipsLoading(false),
                    show({title: "Error", message: "Failed to load members", level: "error"})
                ));
        });

export const addMembershipEpic = (action$, store) =>
    action$.ofType(ADD_MEMBERSHIP_REQUEST)
        .switchMap(({userId, role}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.addMembership(projectId, userId, role))
                .switchMap(() => Rx.Observable.from([
                    {type: FETCH_MEMBERSHIPS},
                    show({title: "Member added", message: "Member added to project", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to add member";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });

export const updateMembershipEpic = (action$, store) =>
    action$.ofType(UPDATE_MEMBERSHIP_REQUEST)
        .switchMap(({membershipId, role}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.updateMembership(projectId, membershipId, role))
                .switchMap(() => Rx.Observable.from([
                    {type: FETCH_MEMBERSHIPS},
                    show({title: "Role updated", message: "Member role updated", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to update role";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });

export const deleteMembershipEpic = (action$, store) =>
    action$.ofType(DELETE_MEMBERSHIP_REQUEST)
        .switchMap(({membershipId}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.deleteMembership(projectId, membershipId))
                .switchMap(() => Rx.Observable.from([
                    {type: FETCH_MEMBERSHIPS},
                    show({title: "Member removed", message: "Member removed from project", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to remove member";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });

export const updateProjectVisibilityEpic = (action$, store) =>
    action$.ofType(UPDATE_PROJECT_VISIBILITY_REQUEST)
        .switchMap(({visibility}) => {
            const projectId = getProjectId(store.getState());
            // TASK-2548 — the map this PATCH is ABOUT, captured at request
            // time rather than at response time. Nothing cancels this request
            // on an SPA map switch, so a response that lands after the user has
            // moved on must be refusable; a response-time read would stamp it
            // with the map they moved TO and re-poison the slice with the
            // project they left. projectsReducer drops a positively
            // disagreeing stamp.
            const requestMapId = store.getState()?.gnresource?.id;
            // TASK-2440 — settle even here. The flag is armed by the REQUEST
            // action, which the reducer has already seen, so an
            // Observable.empty() on this branch would leave all three Sharing
            // rows disabled for the rest of the session.
            if (!projectId) return Rx.Observable.of(updateProjectVisibilitySettled());
            return Rx.Observable.from(anugaApi.updateProjectVisibility(projectId, visibility))
                .switchMap(response => {
                    // TASK-2498 (epic 2425 W3d) — STAMP FIRST, before a single
                    // action is emitted. This write and every my_perms response
                    // touch the same slice, but only my_perms answers were
                    // sequenced against each other, so a fetch issued BEFORE this
                    // PATCH (one that 502'd and is sitting in permsEpics' 1s
                    // backoff) could land AFTER it carrying the pre-PATCH
                    // visibility, and the reducer's guards had no way to tell.
                    // Claiming the next number from permsEpics' own counter makes
                    // this the newest applied write for the project, so anything
                    // older is dropped on BOTH the success and the failure path.
                    //
                    // It must be here rather than after the emit: the forced
                    // refetch below is dispatched in the same array, and it must
                    // draw a HIGHER sequence number than this write.
                    markProjectWriteApplied(projectId);
                    return Rx.Observable.from([
                        setAnugaProjectData(response.data, requestMapId),
                        // TASK-2464 — REFETCH my_perms, on the SUCCESS branch only.
                        //
                        // Why it is needed at all: state.anuga.paywall.steady is
                        // written by exactly one action (SET_ANUGA_RESOURCE_PERMS,
                        // Paywall/reducer.js), emitted by exactly one thing (a
                        // getMyPerms fetch). Nothing dispatched FETCH_MY_PERMS after
                        // a visibility PATCH, so the paywall state stayed frozen at
                        // whatever the panel-open fetch returned — the operator saw
                        // "Public — Current" in this very panel while the indicator
                        // still read Private.
                        //
                        // Why setAnugaProjectData above is NOT enough, even though
                        // triggerFetchMyPermsOnInitEpic listens for it: that stream
                        // maps to the project id and then hits distinctUntilChanged.
                        // The id has not changed, so the emission is dropped and
                        // FETCH_MY_PERMS is never even dispatched.
                        //
                        // Why `force`: permsEpics' 30s dedupe is only invalidated on
                        // FAILURE, so a plain re-dispatch seconds after the
                        // panel-open fetch returns Observable.empty() silently — no
                        // HTTP call, no action, no log. See permsEpics.js.
                        //
                        // SERVER TRUTH, not optimism: this asks the server what the
                        // state is now. A privacy indicator driven by what the user
                        // clicked can be false in the dangerous direction.
                        fetchMyPerms(projectId, true),
                        show({title: "Visibility updated", message: `Project is now ${visibility}`, level: "success"}),
                        // TASK-2440 — LAST, after setAnugaProjectData above.
                        // Unlocking the rows before the new visibility is written
                        // would render an enabled control beside a stale "Current"
                        // pill for a frame.
                        updateProjectVisibilitySettled()
                    ]);
                })
                // The catch below is the REFUSAL path (402 upgrade_prompt from
                // the W1 destination gate) and the error path. Neither reaches
                // the block above, so neither moves the indicator — the server
                // stored nothing, and the FE must claim nothing.
                .catch(err => {
                    // TASK-2099 — 402 carries the upgrade_prompt contract shape
                    // ({state: 'upgrade_prompt', checkout_url, read_only}) from
                    // _check_private_entitlement_response (api_v2.py). Route it
                    // to the paywall overlay instead of the generic error toast.
                    if (_readErrStatus(err) === 402) {
                        const data = _readErrData(err);
                        // W3d — the refusal carries WHAT was refused and WHICH
                        // project it was refused on. Keeping only checkout_url
                        // lost both: the destination (so a customer who chose
                        // Organization was sold, and given, Private) and the
                        // project identity (so a refusal armed here stayed live
                        // over the next project the user opened, and its
                        // Subscribe button bought and privatised THAT one).
                        return Rx.Observable.of(
                            setPaywallUpgradePrompt(data?.checkout_url, visibility, projectId),
                            // TASK-2440 — a REFUSAL is an outcome too. After
                            // W1.1 any move into organization or private can
                            // 402, so a success-only clear would strand the
                            // rows disabled on the commonest unhappy path.
                            updateProjectVisibilitySettled()
                        );
                    }
                    const detail = _readErrData(err)?.detail || "Failed to update visibility";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"}),
                        // TASK-2440 — a failed change must be retryable.
                        updateProjectVisibilitySettled()
                    );
                });
        });

// -- Invitation epics (TASK-860) -------------------------------------------

export const fetchInvitationsEpic = (action$, store) =>
    action$.ofType(FETCH_INVITATIONS)
        .switchMap(() => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.listInvitations(projectId))
                .map(response => setInvitations(response?.data || {}))
                .catch(() => Rx.Observable.of(
                    show({title: "Error", message: "Failed to load invitations", level: "error"})
                ));
        });

export const sendInvitationEpic = (action$, store) =>
    action$.ofType(SEND_INVITATION_REQUEST)
        .switchMap(({email, role}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.sendInvitation(projectId, email, role))
                .switchMap(() => Rx.Observable.from([
                    fetchInvitations(),
                    show({title: "Invitation sent", message: "Invitation sent", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to send invitation";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });

export const revokeInvitationEpic = (action$, store) =>
    action$.ofType(REVOKE_INVITATION_REQUEST)
        .switchMap(({invitationId}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.revokeInvitation(projectId, invitationId))
                .switchMap(() => Rx.Observable.from([
                    fetchInvitations(),
                    show({title: "Invitation revoked", message: "Invitation revoked", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to revoke invitation";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });

export const resendInvitationEpic = (action$, store) =>
    action$.ofType(RESEND_INVITATION_REQUEST)
        .switchMap(({invitationId}) => {
            const projectId = getProjectId(store.getState());
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.resendInvitation(projectId, invitationId))
                .switchMap(() => Rx.Observable.from([
                    fetchInvitations(),
                    show({title: "Invitation resent", message: "Invitation resent", level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to resend invitation";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
                    );
                });
        });
