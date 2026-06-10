import {
    SET_MEMBERSHIPS,
    SET_MEMBERSHIPS_LOADING,
    // TASK-860 — invitation state
    SET_INVITATIONS
} from "../actionsAnuga";

const initialState = {
    data: [],
    loading: false,
    // TASK-860 — invitation list + flag (populated by FETCH_INVITATIONS epic)
    invitations: [],
    invitations_enabled: true
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_MEMBERSHIPS:
        return {
            ...state,
            data: action.data || [],
            loading: false
        };
    case SET_MEMBERSHIPS_LOADING:
        return {
            ...state,
            loading: action.loading
        };
    case SET_INVITATIONS:
        // payload: { invitations_enabled: bool, results: [...] }
        // BE returns the envelope shape; action.payload?.data fallback was for
        // an obsolete response shape (removed TASK-862 W3 cleanup).
        return {
            ...state,
            invitations: action.payload?.results || [],
            invitations_enabled: action.payload?.invitations_enabled !== false
        };
    default:
        return state;
    }
};
