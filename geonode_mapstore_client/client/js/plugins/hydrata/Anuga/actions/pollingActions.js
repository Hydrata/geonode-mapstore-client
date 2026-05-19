const START_ANUGA_SCENARIO_POLLING = 'START_ANUGA_SCENARIO_POLLING';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const START_ANUGA_MODEL_CREATION_POLLING = 'START_ANUGA_MODEL_CREATION_POLLING';
const STOP_ANUGA_MODEL_CREATION_POLLING = 'STOP_ANUGA_MODEL_CREATION_POLLING';
const START_COMPARISON_POLLING = 'START_COMPARISON_POLLING';
const START_ACTIVE_RUN_POLLING = 'START_ACTIVE_RUN_POLLING';
const STOP_ACTIVE_RUN_POLLING = 'STOP_ACTIVE_RUN_POLLING';
const UPDATE_RUN_STATUS = 'UPDATE_RUN_STATUS';
// W7 (TASK-1045) — wall-clock cap reached on pollActiveRunStatusEpic without
// a terminal status. Reducer flips state.runs.pollingTimeoutFor[runId] = true
// so the runPollingPausedBanner component renders a Resume button.
const RUN_STATUS_POLLING_TIMEOUT = 'RUN_STATUS_POLLING_TIMEOUT';
// W7 — auto-dismiss path (user clicked/focused elsewhere). Distinct from
// START_ACTIVE_RUN_POLLING (which both clears the flag AND re-arms the poll);
// dismiss clears the flag WITHOUT re-arming so the user retains the "I have
// seen this" semantic without silently kicking polling back on.
const DISMISS_RUN_POLLING_TIMEOUT = 'DISMISS_RUN_POLLING_TIMEOUT';

function startAnugaScenarioPolling() {
    return { type: START_ANUGA_SCENARIO_POLLING };
}

function stopAnugaScenarioPolling() {
    return { type: STOP_ANUGA_SCENARIO_POLLING };
}

function startAnugaModelCreationPolling() {
    return { type: START_ANUGA_MODEL_CREATION_POLLING };
}

function stopAnugaModelCreationPolling() {
    return { type: STOP_ANUGA_MODEL_CREATION_POLLING };
}

function startComparisonPolling() {
    return { type: START_COMPARISON_POLLING };
}

function startActiveRunPolling(runId) {
    return { type: START_ACTIVE_RUN_POLLING, runId };
}

function stopActiveRunPolling(runId) {
    return { type: STOP_ACTIVE_RUN_POLLING, runId };
}

function updateRunStatus(runId, data) {
    return { type: UPDATE_RUN_STATUS, runId, ...data };
}

function runStatusPollingTimeout(runId) {
    return { type: RUN_STATUS_POLLING_TIMEOUT, runId };
}

function dismissRunPollingTimeout(runId) {
    return { type: DISMISS_RUN_POLLING_TIMEOUT, runId };
}

module.exports = {
    START_ANUGA_SCENARIO_POLLING, startAnugaScenarioPolling,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    START_ANUGA_MODEL_CREATION_POLLING, startAnugaModelCreationPolling,
    STOP_ANUGA_MODEL_CREATION_POLLING, stopAnugaModelCreationPolling,
    START_COMPARISON_POLLING, startComparisonPolling,
    START_ACTIVE_RUN_POLLING, startActiveRunPolling,
    STOP_ACTIVE_RUN_POLLING, stopActiveRunPolling,
    UPDATE_RUN_STATUS, updateRunStatus,
    RUN_STATUS_POLLING_TIMEOUT, runStatusPollingTimeout,
    DISMISS_RUN_POLLING_TIMEOUT, dismissRunPollingTimeout
};
