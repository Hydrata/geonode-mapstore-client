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
    setAnugaProjectData
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
