import bmpDataReducer from "./reducers/bmpDataReducer";
import bmpFilterReducer from "./reducers/bmpFilterReducer";
import bmpFormReducer from "./reducers/bmpFormReducer";
import uiReducer from "./reducers/uiReducer";
import drawingReducer from "./reducers/drawingReducer";
import loadingDataReducer from "./reducers/loadingDataReducer";

const initialState = {
    showOutlets: true,
    showFootprints: true,
    showWatersheds: true,
    bmpTypes: [],
    groupProfiles: [],
    allBmps: [],
    statuses: [],
    targets: [],
    visibleBmpForm: false,
    visibleTargetForm: false,
    creatingNewBmp: false,
    drawingBmpLayerName: false,
    bmpFilterMode: 'type',
    expandedFilter: null,
    priorities: [
        {id: 0, label: 'Not Assigned', value: 0, visibility: true},
        {id: 1, label: 'Critical', value: 1, visibility: true},
        {id: 2, label: 'Normal', value: 2, visibility: true},
        {id: 3, label: 'Low', value: 3, visibility: true}
    ]
};

export default (state = initialState, action) => ({
    ...state,
    ...bmpDataReducer(state, action),
    ...bmpFilterReducer(state, action),
    ...bmpFormReducer(state, action),
    ...uiReducer(state, action),
    ...drawingReducer(state, action),
    ...loadingDataReducer(state, action)
});
