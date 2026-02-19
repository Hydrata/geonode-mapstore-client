import {
    SET_SWAMM_EROSION_DATA,
    SET_SWAMM_NITROGEN_DATA,
    SET_SWAMM_PHOSPHORUS_DATA,
    SET_SWAMM_SEDIMENT_DATA
} from "../actionsSwamm";

const loadingDataReducer = (state, action) => {
    switch (action.type) {
    case SET_SWAMM_EROSION_DATA:
        return { erosions: action.data };
    case SET_SWAMM_NITROGEN_DATA:
        return { nitrogen: action.data };
    case SET_SWAMM_PHOSPHORUS_DATA:
        return { phosphorus: action.data };
    case SET_SWAMM_SEDIMENT_DATA:
        return { sediment: action.data };
    default:
        return {};
    }
};

export default loadingDataReducer;
