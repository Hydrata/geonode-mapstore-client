const START_ANUGA_SCENARIO_POLLING = 'START_ANUGA_SCENARIO_POLLING';
const STOP_ANUGA_SCENARIO_POLLING = 'STOP_ANUGA_SCENARIO_POLLING';
const START_ANUGA_ELEVATION_POLLING = 'START_ANUGA_ELEVATION_POLLING';
const STOP_ANUGA_ELEVATION_POLLING = 'STOP_ANUGA_ELEVATION_POLLING';
const START_ANUGA_MODEL_CREATION_POLLING = 'START_ANUGA_MODEL_CREATION_POLLING';
const STOP_ANUGA_MODEL_CREATION_POLLING = 'STOP_ANUGA_MODEL_CREATION_POLLING';
const START_COMPARISON_POLLING = 'START_COMPARISON_POLLING';
const STOP_COMPARISON_POLLING = 'STOP_COMPARISON_POLLING';

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

module.exports = {
    START_ANUGA_SCENARIO_POLLING, startAnugaScenarioPolling,
    STOP_ANUGA_SCENARIO_POLLING, stopAnugaScenarioPolling,
    START_ANUGA_ELEVATION_POLLING, startAnugaElevationPolling,
    STOP_ANUGA_ELEVATION_POLLING, stopAnugaElevationPolling,
    START_ANUGA_MODEL_CREATION_POLLING, startAnugaModelCreationPolling,
    STOP_ANUGA_MODEL_CREATION_POLLING, stopAnugaModelCreationPolling,
    START_COMPARISON_POLLING, startComparisonPolling,
    STOP_COMPARISON_POLLING, stopComparisonPolling
};
