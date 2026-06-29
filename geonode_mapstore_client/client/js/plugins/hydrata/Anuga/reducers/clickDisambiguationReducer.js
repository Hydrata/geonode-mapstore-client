/*
 * TASK-1991 (W1.2) — Map-click disambiguation reducer slice.
 *
 * Holds ONLY plain candidate data (D6): each candidate is
 * {kind, featureId, layerName, label:{title,subtitle,icon}}. No functions.
 *
 * Mounted by W2.1 (TASK-1993) into reducersAnuga.js's combineReducers, so the
 * live slice is state.anuga.clickDisambiguation.candidates (mirrors Swamm's
 * state.swamm.bmpChooserCandidates). W1 (TASK-1991) shipped it unmounted +
 * unit-tested as a pure reducer.
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
