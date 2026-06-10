import Rx from "rxjs";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import * as anugaApi from '../api/anugaApi';
import {
    FETCH_MEMBERSHIPS,
    ADD_MEMBERSHIP_REQUEST,
    UPDATE_MEMBERSHIP_REQUEST,
    DELETE_MEMBERSHIP_REQUEST,
    UPDATE_PROJECT_VISIBILITY_REQUEST,
    setMemberships,
    setMembershipsLoading,
    setAnugaProjectData,
    // TASK-860 — invitation actions
    FETCH_INVITATIONS,
    SEND_INVITATION_REQUEST,
    REVOKE_INVITATION_REQUEST,
    RESEND_INVITATION_REQUEST,
    setInvitations,
    fetchInvitations
} from "../actionsAnuga";

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
            if (!projectId) return Rx.Observable.empty();
            return Rx.Observable.from(anugaApi.updateProjectVisibility(projectId, visibility))
                .switchMap(response => Rx.Observable.from([
                    setAnugaProjectData(response.data),
                    show({title: "Visibility updated", message: `Project is now ${visibility}`, level: "success"})
                ]))
                .catch(err => {
                    const detail = err?.response?.data?.detail || "Failed to update visibility";
                    return Rx.Observable.of(
                        show({title: "Error", message: detail, level: "error"})
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
