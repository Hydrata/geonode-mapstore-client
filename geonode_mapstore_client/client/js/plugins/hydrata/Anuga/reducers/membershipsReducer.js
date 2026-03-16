import {
    SET_MEMBERSHIPS,
    SET_MEMBERSHIPS_LOADING
} from "../actionsAnuga";

const initialState = {
    data: [],
    loading: false
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
    default:
        return state;
    }
};
