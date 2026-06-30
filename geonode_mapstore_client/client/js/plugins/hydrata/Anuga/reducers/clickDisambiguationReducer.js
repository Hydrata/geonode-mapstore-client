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
 *
 * W2-corrective-4 (epic 1969) — `aggregating`: a plain boolean that defers the
 * default MapStore Identify dock while clickDisambiguationEpic buffers a per-click
 * cross-layer GetFeatureInfo burst (the core Identify dock `open` gate AND-s in
 * `!aggregating`, sourced via a null-guarded selector in MapStore2 plugins/Identify.jsx).
 *
 * DESIGN — SET and CLEAR are BOTH epic-scoped, deliberately:
 *   SET   = ARM_CLICK_AGGREGATION, dispatched ONLY by clickDisambiguationEpic (once
 *           per click, on the first FeatureCollection of the burst). It is NOT set on
 *           a raw LOAD_FEATURE_INFO here — that would let the globally-mounted,
 *           never-removed slice arm on a page where the epic is MUTED (preview /
 *           dataset / dashboard) with no epic to clear it => the dock would stay
 *           permanently suppressed (the high-severity stuck-flag trap). Because the
 *           epic dispatches the arm, the flag can only be set where the epic also runs
 *           to clear it.
 *   CLEAR = on the epic's branch actions (HIDE on 0-candidate/vectordraw/1-candidate,
 *           SHOW on >=2), PLUS on every FEATURE_INFO_CLICK as a belt-and-suspenders
 *           recovery net: a flag stranded by mid-window SPA navigation is cleared by
 *           the next click — effective precisely because the re-arm is epic-driven, so
 *           on a muted page the click clears it and nothing re-sets it.
 */
import { FEATURE_INFO_CLICK } from '../../../../../MapStore2/web/client/actions/mapInfo';
import {
    SHOW_CLICK_DISAMBIGUATION,
    HIDE_CLICK_DISAMBIGUATION,
    ARM_CLICK_AGGREGATION
} from '../actions/clickDisambiguationActions';

const initialState = { candidates: [], aggregating: false };

export default function clickDisambiguation(state = initialState, action = {}) {
    switch (action.type) {
    case ARM_CLICK_AGGREGATION:
        // false->true transition only, so an N-layer burst is at most one render.
        return state.aggregating ? state : { ...state, aggregating: true };
    case FEATURE_INFO_CLICK:
        // start-of-click reset + cross-map / mid-flush-navigation stuck recovery.
        return state.aggregating ? { ...state, aggregating: false } : state;
    case SHOW_CLICK_DISAMBIGUATION:
        return { ...state, candidates: action.candidates || [], aggregating: false };
    case HIDE_CLICK_DISAMBIGUATION:
        return { ...state, candidates: [], aggregating: false };
    default:
        return state;
    }
}
