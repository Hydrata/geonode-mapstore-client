/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TASK-3076 (AC11) — WHICH SCENARIO IS LOADED. One helper, used by BOTH the
 * Results menu (its highlighted row) and the playback bar (its heading), so
 * the two can never disagree about what the reader is looking at.
 *
 * The match is the one the Results menu has always made: the scenario whose
 * `latest_complete_run.id` equals the playback controller's `runId`,
 * compared as strings — the reducer stores runId as a string (playbackInit
 * is dispatched with String(run.id)) while the API sends a number.
 *
 * Lives in its own module rather than in anugaScenarioMenu.js because the bar
 * must not import the whole Results/Scenarios menu (and its stylesheets and
 * every menu dependency) to answer a one-line question.
 *
 * @param {Array<object>} scenarios selectorsAnuga.getScenariosArray(state)
 * @param {string|number|null|undefined} runId state.anugaPlayback.runId
 * @returns {object|null} the loaded scenario, or null when nothing matches
 */
export function findLoadedScenario(scenarios, runId) {
    if (runId === null || runId === undefined || !Array.isArray(scenarios)) {
        return null;
    }
    const wanted = String(runId);
    return scenarios.find((scenario) => {
        const run = scenario && scenario.latest_complete_run;
        return !!run && String(run.id) === wanted;
    }) || null;
}

export default findLoadedScenario;
