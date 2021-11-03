import moment from 'moment';
import {
    INIT_SWAMPS
} from "./actionsAnuga";

const initialState = {
};

export default ( state = initialState, action) => {
    // console.log(action);
    switch (action.type) {
    case INIT_SWAMPS:
        return state;
    default:
        return state;
    }
};
