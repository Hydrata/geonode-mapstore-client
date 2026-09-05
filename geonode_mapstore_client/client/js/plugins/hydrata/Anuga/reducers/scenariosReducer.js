import {
    SET_ANUGA_SCENARIO_DATA,
    SET_ANUGA_POLLING_DATA,
    ADD_ANUGA_SCENARIO,
    UPDATE_ANUGA_SCENARIO,
    SAVE_ANUGA_SCENARIO_SUCCESS,
    DUPLICATE_ANUGA_SCENARIO_SUCCESS,
    ARCHIVE_ANUGA_SCENARIO,
    ARCHIVE_ANUGA_SCENARIO_SUCCESS,
    // TASK-2264 — a 412 (scenario has an active/queued run) stashes the BE
    // detail as `archiveError` on the scenario so the pane's notices surface
    // can anchor it, instead of relying only on the easy-to-miss toast.
    ARCHIVE_ANUGA_SCENARIO_ERROR,
    UNARCHIVE_ANUGA_SCENARIO_SUCCESS,
    SET_ANUGA_SCENARIO_ARCHIVE_FILTER,
    SELECT_ANUGA_SCENARIO,
    TOGGLE_SCENARIO_SELECTED,
    SET_ANUGA_SCENARIO_IS_LOADED,
    // TASK-2079 — build-dedup: BUILD_SCENARIO_ERROR previously had no
    // reducer (action-only); a benign 409 (conflict: true) now stashes
    // `buildConflict` on the scenario so it can render inline near the
    // Build button instead of a toast.
    BUILD_SCENARIO,
    BUILD_SCENARIO_SUCCESS,
    BUILD_SCENARIO_ERROR,
    // TASK-2890 (epic 2815 W3, Layer 4) — Redux mirror of a deferred
    // Build-and-Run intent, keyed by scenario id.
    ARM_RUN_AFTER_BUILD,
    ADVANCE_RUN_AFTER_BUILD,
    CLEAR_RUN_AFTER_BUILD
} from "../actionsAnuga";

const initialState = {
    byId: {},
    allIds: [],
    selectedId: null,
    // Active/Archived view filter. 'none' = active only (default, matches BE
    // default queryset), 'only' = archived only, 'all' = both.
    archiveFilter: 'none',
    // TASK-2890 (epic 2815 W3, Layer 4) — { [scenarioId]: {phase: 'awaiting-inflight' | 'awaiting-built', localOwned} }.
    // See runAfterBuildEpic (epics/pollingEpics.js).
    runAfterBuild: {}
};

/**
 * Normalize an array of scenarios into byId/allIds.
 */
const normalizeScenarios = (scenarios) => {
    const byId = {};
    const allIds = [];
    scenarios.forEach(s => {
        byId[s.id] = s;
        allIds.push(s.id);
    });
    return { byId, allIds };
};

export default (state = initialState, action) => {
    switch (action.type) {
    case SET_ANUGA_SCENARIO_DATA: {
        // Always replace — allows refresh after delete/re-init
        const { byId, allIds } = normalizeScenarios(action.scenarios);
        return { ...state, byId, allIds };
    }
    case SET_ANUGA_POLLING_DATA: {
        // Merge backend scenario data into normalized state
        const newById = { ...state.byId };
        const newAllIds = [...state.allIds];

        action.scenarios.forEach(backendScenario => {
            const existing = newById[backendScenario.id];
            if (existing) {
                // TASK-2421 (UAT-1 findings 2+3) — the staleness flag
                // (`unsaved`) was set on input edit (UPDATE_ANUGA_SCENARIO)
                // but this merge previously preserved it unconditionally
                // ("keep local fields") even once a poll tick delivers a
                // GENUINELY refreshed estimate reflecting that edit — the
                // '(estimate outdated — rebuild to refresh)' hint then
                // outlived the very number it was warning about. A poll tick
                // whose triangle/cost estimate DIFFERS from what's currently
                // stored is itself proof a fresh recompute has landed, so it
                // clears `unsaved`; a tick that brings the SAME estimate
                // (nothing recomputed yet — e.g. the user's edit hasn't been
                // saved/built at all) leaves it untouched, so the hint still
                // holds while genuinely stale.
                const nextTriangleEstimate = backendScenario?.mesh_triangle_count_estimate ?? null;
                const nextCostEstimate = backendScenario?.compute_cost_estimate ?? null;
                const estimateRefreshed = existing.unsaved && (
                    nextTriangleEstimate !== (existing.mesh_triangle_count_estimate ?? null)
                    || nextCostEstimate !== (existing.compute_cost_estimate ?? null)
                );
                // Merge: keep local fields (selected, tempTimeString), update backend fields
                newById[backendScenario.id] = {
                    ...existing,
                    unsaved: estimateRefreshed ? false : existing.unsaved,
                    latest_run: backendScenario?.latest_run ?? null,
                    // TASK-2078: latest_complete_run MUST be in this merge
                    // whitelist too — 2078 repointed the FE result consumers
                    // (View Results gate, freshness banner, cross-section
                    // profile, download) from latest_run to latest_complete_run.
                    // Without this line the 8s poll never refreshes it on an
                    // already-loaded scenario, so it stays frozen at init value
                    // and those consumers go stale until a page reload.
                    latest_complete_run: backendScenario?.latest_complete_run ?? null,
                    status: backendScenario?.status || 'unsaved',
                    computed_status: backendScenario?.computed_status || backendScenario?.status,
                    latest_run_is_valid: backendScenario?.latest_run_is_valid,
                    // TASK-2400 (dogfood F1/#1) — the pre-build estimate fields
                    // MUST be in this merge whitelist too, mirroring the exact
                    // TASK-2078 latest_complete_run fix above. Without these
                    // lines, a server-side estimate recompute (e.g. after a
                    // mesh-affecting edit) is returned by every 8s poll tick
                    // but silently dropped on merge — the in-pane estimate
                    // line (scenarioPane.js) and the Build/Build-and-Run
                    // tooltip echo (scenarioHeaderActions.js) both stay frozen
                    // at whatever was last written by SAVE_ANUGA_SCENARIO_SUCCESS
                    // (a full-object replace, unaffected by this whitelist),
                    // reading a stale $0.00-or-any-other-stale-figure while the
                    // user commits a run at the REAL, already-recomputed price.
                    mesh_triangle_count_estimate: backendScenario?.mesh_triangle_count_estimate ?? null,
                    mesh_triangle_count_estimate_breakdown: backendScenario?.mesh_triangle_count_estimate_breakdown ?? null,
                    compute_cost_estimate: backendScenario?.compute_cost_estimate ?? null,
                    vcpu_hours_estimate: backendScenario?.vcpu_hours_estimate ?? null
                };
            } else {
                // New backend-created scenario (e.g. copy)
                newById[backendScenario.id] = backendScenario;
                newAllIds.push(backendScenario.id);
            }
        });

        return {
            ...state,
            byId: newById,
            allIds: newAllIds
        };
    }
    case ADD_ANUGA_SCENARIO: {
        // Temporary scenario with null id — use a temp key
        const tempId = `new_${Date.now()}`;
        return {
            ...state,
            byId: {
                ...state.byId,
                [tempId]: {
                    id: null,
                    _tempId: tempId,
                    // TASK-2953 (epic 2815 W3, Layer 1 sub-decision, top's
                    // pre-decided tradeoff) — Scenario.name is required
                    // non-blank server-side (models/scenario.py:1487). Layer
                    // 1's lazy create fires on the scenario's FIRST COMMIT,
                    // which is usually a SELECT field (terrain/boundary/
                    // inflow), not the name field — holding the create until
                    // a name exists would mean a user who only ever touches
                    // selects never gets a server row. Seeding a non-blank
                    // default here keeps the create POST valid regardless of
                    // which field is committed first. Grepped ZERO uses of a
                    // falsy/blank/'untitled' name sentinel anywhere in the
                    // non-test Anuga FE tree, so this is safe (H3).
                    name: "New scenario",
                    code: null,
                    description: "",
                    // TASK-2038 (F5): matches the BE default
                    // (gn_anuga/models/scenario.py: resolution FloatField
                    // default=100) — resolution is the target triangle EDGE
                    // LENGTH in metres, not an area; 1000 collapsed a small
                    // domain to ~1 triangle (dogfood 2026-07-01).
                    resolution: 100,
                    constant_rainfall: null,
                    duration: null,
                    status: "new",
                    computed_status: "created",
                    project: action.projectId || null,
                    boundary: "",
                    terrain: "",
                    log: "log placeholder",
                    unsaved: false,
                    selected: false
                }
            },
            allIds: [...state.allIds, tempId]
        };
    }
    case UPDATE_ANUGA_SCENARIO: {
        // action.scenario contains the merged fields (action creator spreads kv into it)
        const key = action.scenario.id || action.scenario._tempId;
        if (!key || !state.byId[key]) return state;
        const existing = state.byId[key];
        return {
            ...state,
            byId: {
                ...state.byId,
                [key]: { ...existing, ...action.scenario, unsaved: true }
            }
        };
    }
    case TOGGLE_SCENARIO_SELECTED: {
        const key = action.scenario.id || action.scenario._tempId;
        if (!key || !state.byId[key]) return state;
        const existing = state.byId[key];
        return {
            ...state,
            byId: {
                ...state.byId,
                [key]: { ...existing, selected: !existing.selected }
            }
        };
    }
    case SAVE_ANUGA_SCENARIO_SUCCESS: {
        // TASK-2953 (epic 2815 W3, Layer 2 / amendment A1) — action.scenario
        // is now GUARANTEED to carry a real `id`: crudEpics.js injects it for
        // the PATCH branch, whose raw response never includes one (PROVEN
        // live: a PATCH response carries ONLY ScenarioUpdateSerializerV2's
        // writable fields — no id, no computed_status, no
        // latest_run_is_valid, nothing read-only). Before this fix, a PATCH
        // success wrote to `byId[undefined]` here on EVERY existing-scenario
        // save, silently orphaning the real entry.
        //
        // action.sentPayload (the outgoing PATCH body, present on the update
        // branch only) and action.tempId (present on the create branch only)
        // drive a no-clobber merge instead of the old verbatim full replace:
        // a field is accepted from the server ONLY where nothing has changed
        // locally since the request went out (sent[k] === local[k]);
        // anything that moved on locally in the meantime (e.g. a second
        // commit fired while this one was still in flight) is kept. Fields
        // the client never sends (id, computed_status, latest_run,
        // latest_run_is_valid, perms, ...) always come from the server —
        // there is no local value to protect.
        const server = action.scenario;
        if (!server || server.id === undefined || server.id === null) return state;
        const sent = action.sentPayload;
        const tempId = action.tempId !== undefined && action.tempId !== null ? action.tempId : null;
        const localKey = tempId !== null ? tempId : server.id;
        // TASK-2953 (Layer 1, H4 in-flight-create race) — a second commit for
        // the SAME tempId that arrived while the first commit's create was
        // still in flight PATCHes once that create resolves; by the time ITS
        // PATCH response lands, the first success may have ALREADY migrated
        // byId[tempId] -> byId[realId]. Fall back to the real-id row as the
        // merge baseline so this doesn't clobber fields the PATCH response
        // itself doesn't carry (computed_status, latest_run, estimates, ...).
        const localExisting = state.byId[localKey]
            || (tempId !== null ? state.byId[server.id] : undefined);

        let merged;
        if (sent && localExisting) {
            merged = { ...localExisting };
            Object.keys(server).forEach((k) => {
                if (Object.prototype.hasOwnProperty.call(sent, k)) {
                    if (sent[k] === localExisting[k]) {
                        merged[k] = server[k];
                    }
                    // else: local has moved on since this PATCH was sent — keep local.
                } else {
                    merged[k] = server[k]; // read-only / server-computed field
                }
            });
        } else {
            // Create response, or no local row left to protect — full merge
            // (matches the old full-replace behaviour, plus preserving any
            // purely-local keys like `selected`).
            merged = { ...(localExisting || {}), ...server };
        }
        merged.unsaved = false;
        delete merged._tempId;

        const newById = { ...state.byId };
        let newAllIds = state.allIds;
        if (tempId !== null && Object.prototype.hasOwnProperty.call(newById, tempId)) {
            delete newById[tempId];
            const idx = newAllIds.indexOf(tempId);
            newAllIds = idx === -1 ? [...newAllIds, server.id] : newAllIds.map((id, i) => (i === idx ? server.id : id));
        } else if (newAllIds.indexOf(server.id) === -1) {
            newAllIds = [...newAllIds, server.id];
        }
        newById[server.id] = merged;

        return { ...state, byId: newById, allIds: newAllIds };
    }
    case DUPLICATE_ANUGA_SCENARIO_SUCCESS: {
        // The BE returns a freshly-INSERTed pk (ScenarioSerializerV2); we
        // append to byId/allIds. Defensive guard for malformed dispatch
        // without an id; collisions cannot happen with a fresh insert.
        if (!action.scenario?.id) {
            return state;
        }
        return {
            ...state,
            byId: { ...state.byId, [action.scenario.id]: { ...action.scenario, unsaved: false } },
            allIds: [...state.allIds, action.scenario.id]
        };
    }
    case ARCHIVE_ANUGA_SCENARIO_SUCCESS:
    case UNARCHIVE_ANUGA_SCENARIO_SUCCESS: {
        // The polling epic reconciles visibility on its next tick by
        // re-fetching with the current archiveFilter; we update byId here so
        // the row's badge refreshes immediately.
        const id = action.scenario?.id;
        if (!id || !state.byId[id]) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [id]: {
                    ...state.byId[id],
                    archived_at: action.scenario.archived_at,
                    archived_by: action.scenario.archived_by,
                    archived_by_username: action.scenario.archived_by_username,
                    // TASK-2264 — a successful archive clears any stale 412 error.
                    archiveError: null
                }
            }
        };
    }
    case ARCHIVE_ANUGA_SCENARIO: {
        // TASK-2264 — a fresh archive attempt optimistically clears any stale
        // archiveError before the request resolves (mirrors BUILD_SCENARIO
        // clearing buildConflict).
        const id = action.scenario?.id;
        if (!id || !state.byId[id] || !state.byId[id].archiveError) return state;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], archiveError: null } }
        };
    }
    case ARCHIVE_ANUGA_SCENARIO_ERROR: {
        // TASK-2264 — stash the BE 412 detail on the scenario so the pane's
        // consolidated notices surface can render it inline.
        const id = action.scenarioId;
        if (!id || !state.byId[id]) return state;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], archiveError: action.detail } }
        };
    }
    case SET_ANUGA_SCENARIO_ARCHIVE_FILTER: {
        // Record the chip's mode so the polling epic + initial fetch pass
        // `?archived=` through to the BE. Default 'none' = active only.
        const mode = action.mode;
        if (!['none', 'only', 'all'].includes(mode)) return state;
        return { ...state, archiveFilter: mode };
    }
    case SELECT_ANUGA_SCENARIO:
        return {
            ...state,
            selectedId: action.scenario.id || action.scenario._tempId
        };
    case SET_ANUGA_SCENARIO_IS_LOADED: {
        const existing = state.byId[action.scenarioId];
        if (!existing) return state;
        return {
            ...state,
            byId: {
                ...state.byId,
                [action.scenarioId]: { ...existing, isLoaded: action.isLoaded }
            }
        };
    }
    // TASK-2079 — build-dedup reducer for BUILD_SCENARIO_ERROR (previously
    // action-only, no reducer at all). A fresh Build click optimistically
    // clears any stale conflict lozenge left over from a prior 409 before
    // the new request resolves.
    // A fresh Build click (BUILD_SCENARIO) and a successful build
    // (BUILD_SCENARIO_SUCCESS) both optimistically clear any stale conflict
    // lozenge left over from a prior 409 — identical logic, shared here.
    case BUILD_SCENARIO:
    case BUILD_SCENARIO_SUCCESS: {
        const id = action.scenarioId;
        if (!id || !state.byId[id] || !state.byId[id].buildConflict) return state;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], buildConflict: null } }
        };
    }
    case BUILD_SCENARIO_ERROR: {
        const id = action.scenarioId;
        if (!id || !state.byId[id]) return state;
        // A REAL failure (conflict: false) is surfaced by the 'Build failed'
        // toast (comparisonActions.buildScenarioError) — no inline state to
        // set here, but still clear any stale conflict lozenge.
        const buildConflict = action.conflict
            ? { runId: action.runId, status: action.runStatus, detail: action.detail }
            : null;
        return {
            ...state,
            byId: { ...state.byId, [id]: { ...state.byId[id], buildConflict } }
        };
    }
    // TASK-2890 (epic 2815 W3, Layer 4) — the Redux mirror of the deferred
    // Build-and-Run intent. See runAfterBuildEpic (epics/pollingEpics.js).
    // Review fix (finding 1) — each entry is {phase, localOwned}, not a bare
    // phase string: localOwned distinguishes an arm the MOUNTED component's
    // own local machine will also resolve (armAndDispatchBuildAndRun's
    // dispatched==='build' path only) from a mechanism-2/save-dispatched arm
    // that has no local counterpart, ever — see armRunAfterBuild's doc
    // comment (scenarioActions.js) for the full rationale.
    case ARM_RUN_AFTER_BUILD: {
        if (action.scenarioId === undefined || action.scenarioId === null) return state;
        return {
            ...state,
            runAfterBuild: {
                ...state.runAfterBuild,
                [action.scenarioId]: { phase: 'awaiting-inflight', localOwned: !!action.localOwned }
            }
        };
    }
    case ADVANCE_RUN_AFTER_BUILD: {
        const existing = state.runAfterBuild[action.scenarioId];
        if (!existing || existing.phase !== 'awaiting-inflight') return state;
        return {
            ...state,
            runAfterBuild: {
                ...state.runAfterBuild,
                [action.scenarioId]: { ...existing, phase: 'awaiting-built' }
            }
        };
    }
    case CLEAR_RUN_AFTER_BUILD: {
        if (!Object.prototype.hasOwnProperty.call(state.runAfterBuild, action.scenarioId)) return state;
        const runAfterBuild = { ...state.runAfterBuild };
        delete runAfterBuild[action.scenarioId];
        return { ...state, runAfterBuild };
    }
    default:
        return state;
    }
};
