const START_ANUGA_SCENARIO_POLLING = 'START_ANUGA_SCENARIO_POLLING';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const START_ANUGA_ELEVATION_POLLING = 'START_ANUGA_ELEVATION_POLLING';
const STOP_ANUGA_ELEVATION_POLLING = 'STOP_ANUGA_ELEVATION_POLLING';
const START_ANUGA_MODEL_CREATION_POLLING = 'START_ANUGA_MODEL_CREATION_POLLING';
const STOP_ANUGA_MODEL_CREATION_POLLING = 'STOP_ANUGA_MODEL_CREATION_POLLING';
const START_COMPARISON_POLLING = 'START_COMPARISON_POLLING';
const STOP_COMPARISON_POLLING = 'STOP_COMPARISON_POLLING';
const START_ACTIVE_RUN_POLLING = 'START_ACTIVE_RUN_POLLING';
const STOP_ACTIVE_RUN_POLLING = 'STOP_ACTIVE_RUN_POLLING';
const UPDATE_RUN_STATUS = 'UPDATE_RUN_STATUS';

function startAnugaScenarioPolling() {
    return { type: START_ANUGA_SCENARIO_POLLING };
}

function stopAnugaScenarioPolling() {
    return { type: STOP_ANUGA_SCENARIO_POLLING };
}

function startAnugaElevationPolling() {
    return { type: START_ANUGA_ELEVATION_POLLING };
}

function stopAnugaElevationPolling() {
    return { type: STOP_ANUGA_ELEVATION_POLLING };
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

function stopComparisonPolling() {
    return { type: STOP_COMPARISON_POLLING };
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

module.exports = {
    START_ANUGA_SCENARIO_POLLING, startAnugaScenarioPolling,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    START_ANUGA_ELEVATION_POLLING, startAnugaElevationPolling,
    STOP_ANUGA_ELEVATION_POLLING, stopAnugaElevationPolling,
    START_ANUGA_MODEL_CREATION_POLLING, startAnugaModelCreationPolling,
    STOP_ANUGA_MODEL_CREATION_POLLING, stopAnugaModelCreationPolling,
    START_COMPARISON_POLLING, startComparisonPolling,
    STOP_COMPARISON_POLLING, stopComparisonPolling,
    START_ACTIVE_RUN_POLLING, startActiveRunPolling,
    STOP_ACTIVE_RUN_POLLING, stopActiveRunPolling,
    UPDATE_RUN_STATUS, updateRunStatus
};
