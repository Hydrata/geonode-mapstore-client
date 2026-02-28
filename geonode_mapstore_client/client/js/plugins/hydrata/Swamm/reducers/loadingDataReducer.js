import {
    SET_SWAMM_EROSION_DATA
} from "../actionsSwamm";

const loadingDataReducer = (state, action) => {
    switch (action.type) {
    case SET_SWAMM_EROSION_DATA:
        return { erosions: action.data };
    default:
        return {};
    }
};

export default loadingDataReducer;
