/*
 * TASK-1991 (W1.2) — Map-click disambiguation reducer slice.
 *
 * Holds ONLY plain candidate data (D6): each candidate is
 * {kind, featureId, layerName, label:{title,subtitle,icon}}. No functions.
 *
 * NOT wired into the live Anuga combineReducers in W1 (W1 ships inert modules
 * only — registering a reducer is harmless but the slice has no live producer
 * until W2.1 wires the panel + the live epic). Exported + unit-tested here;
 * W2.1 (TASK-1993) mounts it.
 */
import {
    SHOW_CLICK_DISAMBIGUATION,
    HIDE_CLICK_DISAMBIGUATION
} from '../actions/clickDisambiguationActions';

const initialState = { candidates: [] };

export default function clickDisambiguation(state = initialState, action = {}) {
    switch (action.type) {
    case SHOW_CLICK_DISAMBIGUATION:
        return { ...state, candidates: action.candidates || [] };
    case HIDE_CLICK_DISAMBIGUATION:
        return { ...state, candidates: [] };
    default:
        return state;
    }
}
