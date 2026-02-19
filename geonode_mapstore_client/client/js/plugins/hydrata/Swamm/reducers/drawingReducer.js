import {
    SET_DRAWING_BMP_LAYER_NAME,
    CLEAR_DRAWING_BMP_LAYER_NAME,
    SET_EDITING_BMP_FEATURE_ID,
    CLEAR_EDITING_BMP_FEATURE_ID,
    REGISTER_MISSING_BMP_FEATURE_ID,
    SET_BMP_LAYERS
} from "../actionsSwamm";

const drawingReducer = (state, action) => {
    switch (action.type) {
    case SET_DRAWING_BMP_LAYER_NAME: {
        let drawingBmpLayerName = false;
        if (action.drawingBmpLayerName !== state.drawingBmpLayerName) {
            drawingBmpLayerName = action.drawingBmpLayerName;
        }
        return { drawingBmpLayerName: drawingBmpLayerName };
    }
    case CLEAR_DRAWING_BMP_LAYER_NAME:
        return { drawingBmpLayerName: null };
    case SET_EDITING_BMP_FEATURE_ID:
        return { editingBmpFeatureId: action.editingBmpFeatureId };
    case CLEAR_EDITING_BMP_FEATURE_ID:
        return { editingBmpFeatureId: null };
    case REGISTER_MISSING_BMP_FEATURE_ID:
        return { missingBmpFeatureId: action.missingBmpFeatureId };
    case SET_BMP_LAYERS:
        return {
            bmpOutletLayer: action.bmpOutletLayer,
            bmpFootprintLayer: action.bmpFootprintLayer,
            bmpWatershedLayer: action.bmpWatershedLayer
        };
    default:
        return {};
    }
};

export default drawingReducer;
