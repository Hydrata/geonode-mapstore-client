/**
 * Pure helpers for scenario time conversion and status display.
 */

export const getSecondsFromHHMM = (userInputValue) => {
    const [hours, minutes] = userInputValue.split(":");

    const hoursNumber = Number(hours);
    const minutesNumber = Number(minutes);

    if (!isNaN(hoursNumber) && isNaN(minutesNumber)) {
        return hoursNumber * 60;
    }

    if (!isNaN(hoursNumber) && !isNaN(minutesNumber)) {
        return (hoursNumber * 60 + minutesNumber) * 60;
    }

    return 0;
};

export const toHHMM = (secs) => {
    // Convert seconds to whole minutes, then split into zero-padded HH:MM (hours may exceed 99 for long durations).
    const n = Number(secs);
    if (!Number.isFinite(n) || n <= 0) {
        return '00:00';
    }
    const totalMinutes = Math.floor(n / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
};

export const findScenarioStatus = (scenario) => {
    return scenario?.computed_status || scenario?.status || 'created';
};

/**
 * Validate that a scenario has all required fields populated.
 *
 * Returns `null` when every required field is present, or the name of the
 * first missing field as a string. Callers can surface that name in a
 * user-facing message (e.g. "<field> is required"). Fields are checked in
 * a stable order so the returned name is deterministic.
 *
 * TASK-868: previously returned a bare boolean. Field-name return shape lets
 * the Build-button alert tell the user which field is missing instead of
 * a generic "Scenario is not valid".
 */
export const validateScenario = (scenario) => {
    if (!scenario || typeof scenario !== 'object') {
        return 'scenario';
    }
    if (!(scenario?.name?.length > 0)) {
        return 'name';
    }
    if (!scenario?.terrain) {
        return 'terrain';
    }
    if (!scenario?.inflow && !scenario?.rainfall) {
        return 'inflowOrRainfall';
    }
    if (!(scenario?.resolution > 0)) {
        return 'resolution';
    }
    if (!(scenario?.duration > 0)) {
        return 'duration';
    }
    if (!scenario?.boundary) {
        return 'boundary';
    }
    return null;
};

/**
 * TASK-C-scenarios-miller Wave 3A — derive a tag + severity for one
 * category rail item from a scenario. Returns:
 *
 *   { satisfied, total, tag, severity, unsaved }
 *
 * Severities map to the .is-ok / .is-warn / .is-err tag CSS variants on
 * the category rail item. `tag` is the short string painted in the
 * trailing pill (e.g. "4/4", "OK", "47%", "err", "—").
 *
 * Wave 3C C4 — the `unsaved` flag mirrors the scenario-level
 * `scenario.unsaved` boolean. Per-category diffing is out of scope (we
 * don't keep a persisted-backend snapshot cache on the FE) so every
 * category tag returns the SAME `unsaved` value — true when the scenario
 * has unsaved changes anywhere, false otherwise. The category rail uses
 * this to paint a small dot/asterisk prefix on the tag pill so users see
 * "this scenario has unsaved diffs" surfaces on every visible category.
 *
 * Categories handled:
 *   - 'inputs'        — required count of {terrain, boundary, (inflow OR
 *                       rainfall)}. Inflow and rainfall are mutually
 *                       substitutable water sources (validateScenario
 *                       requires one of the two), so they share a single
 *                       slot. Tag reads "N/3". severity=ok at 3/3, warn
 *                       at 1-2/3, err at 0/3.
 *   - 'advanced'      — count of {friction, structure, mesh_region,
 *                       network}. ALL FIELDS OPTIONAL in
 *                       validateScenario, so severity stays ok-or-empty
 *                       (never err). Tag still reads "N/4" for parity.
 *   - 'runConfig'     — {resolution > 0, duration > 0}. Tag "OK" when
 *                       both set, "X/2" otherwise. severity err only
 *                       when neither is set.
 *   - 'statusActions' — derived from findScenarioStatus(scenario):
 *                       computing → "{pct}%" + ok
 *                       error     → "err" + err
 *                       complete  → "100%" + ok
 *                       built     → "built" + ok
 *                       cancelled → "—" + warn
 *                       created   → "—" + warn
 *                       queued/processing/building → "..." + warn
 *
 * Defensive contract: null/undefined scenarios return a no-op tag
 * ({satisfied: 0, total: N, tag: '—', severity: 'warn'}) so the rail
 * still renders before a scenario is selected.
 */
export const validateCategoryProgress = (category, scenario) => {
    // Defensive: missing scenario means tag rendering should be neutral.
    if (!scenario || typeof scenario !== 'object') {
        return {satisfied: 0, total: 0, tag: '—', severity: 'warn', unsaved: false};
    }
    // Wave 3C C4 — scenario-level unsaved flag, propagated identically to
    // every category tag. The FE doesn't keep a persisted-backend snapshot
    // so per-category diffing isn't available; the dot is intentionally
    // coarse ("this scenario has unsaved diffs somewhere").
    const unsaved = !!scenario.unsaved;

    if (category === 'inputs') {
        // Inflow and Rainfall are mutually substitutable water sources — the
        // build-time validateScenario requires only one of the two — so the
        // category-rail tag counts them as a single slot
        // (terrain + boundary + (inflow|rainfall) = 3).
        const hasTerrain = scenario.terrain != null && scenario.terrain !== ''; // eslint-disable-line no-eq-null, eqeqeq
        const hasBoundary = scenario.boundary != null && scenario.boundary !== ''; // eslint-disable-line no-eq-null, eqeqeq
        const hasWaterSource = (scenario.inflow != null && scenario.inflow !== '') // eslint-disable-line no-eq-null, eqeqeq
            || (scenario.rainfall != null && scenario.rainfall !== ''); // eslint-disable-line no-eq-null, eqeqeq
        const satisfied = (hasTerrain ? 1 : 0) + (hasBoundary ? 1 : 0) + (hasWaterSource ? 1 : 0);
        const total = 3;
        let severity = 'warn';
        if (satisfied === total) severity = 'ok';
        else if (satisfied === 0) severity = 'err';
        return {satisfied, total, tag: `${satisfied}/${total}`, severity, unsaved};
    }

    if (category === 'advanced') {
        // TASK-1412 (ISSUE 20.3): 'network' removed from the scenario-config
        // advanced pane; the tag counts only the 3 remaining optional fields.
        const fields = ['friction', 'structure', 'mesh_region'];
        const satisfied = fields.filter(f => scenario[f] != null && scenario[f] !== '').length; // eslint-disable-line no-eq-null, eqeqeq
        const total = fields.length;
        // Advanced fields are optional; never err.
        return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'ok', unsaved};
    }

    if (category === 'runConfig') {
        const hasResolution = (scenario.resolution || 0) > 0;
        const hasDuration = (scenario.duration || 0) > 0;
        const satisfied = (hasResolution ? 1 : 0) + (hasDuration ? 1 : 0);
        const total = 2;
        if (satisfied === total) {
            return {satisfied, total, tag: 'OK', severity: 'ok', unsaved};
        }
        if (satisfied === 0) {
            return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'err', unsaved};
        }
        return {satisfied, total, tag: `${satisfied}/${total}`, severity: 'warn', unsaved};
    }

    // TASK-1416 (ISSUE 20.7): merged 'run' category combines runConfig config
    // fields (resolution/duration) with the execution status signal. Tag
    // priority: execution status (error/computing/complete/built) > config
    // completeness — the user is most interested in whether the scenario ran.
    if (category === 'run') {
        const status = findScenarioStatus(scenario);
        const pct = scenario?.latest_run?.progress_pct;
        const hasResolution = (scenario.resolution || 0) > 0;
        const hasDuration = (scenario.duration || 0) > 0;
        const configReady = hasResolution && hasDuration;
        // If the scenario has run (or is running), show execution status as tag.
        if (status === 'computing') {
            return {satisfied: 0, total: 1, tag: Number.isFinite(pct) ? `${Math.round(pct)}%` : '...', severity: 'ok', unsaved};
        }
        if (status === 'error') {
            return {satisfied: 0, total: 1, tag: 'err', severity: 'err', unsaved};
        }
        if (status === 'complete') {
            return {satisfied: 1, total: 1, tag: '100%', severity: 'ok', unsaved};
        }
        if (status === 'built') {
            return {satisfied: 1, total: 1, tag: 'built', severity: 'ok', unsaved};
        }
        if (status === 'cancelled') {
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        }
        if (status === 'queued' || status === 'processing' || status === 'building') {
            return {satisfied: 0, total: 1, tag: '...', severity: 'warn', unsaved};
        }
        // status === 'created' — show config completeness tag instead.
        if (configReady) {
            return {satisfied: 1, total: 1, tag: 'OK', severity: 'ok', unsaved};
        }
        const configSatisfied = (hasResolution ? 1 : 0) + (hasDuration ? 1 : 0);
        return {satisfied: configSatisfied, total: 2, tag: `${configSatisfied}/2`, severity: configSatisfied === 0 ? 'err' : 'warn', unsaved};
    }

    if (category === 'statusActions') {
        const status = findScenarioStatus(scenario);
        const pct = scenario?.latest_run?.progress_pct;
        switch (status) {
        case 'computing':
            return {
                satisfied: 0,
                total: 1,
                tag: Number.isFinite(pct) ? `${Math.round(pct)}%` : '...',
                severity: 'ok',
                unsaved
            };
        case 'error':
            return {satisfied: 0, total: 1, tag: 'err', severity: 'err', unsaved};
        case 'complete':
            return {satisfied: 1, total: 1, tag: '100%', severity: 'ok', unsaved};
        case 'built':
            return {satisfied: 1, total: 1, tag: 'built', severity: 'ok', unsaved};
        case 'cancelled':
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        case 'queued':
        case 'processing':
        case 'building':
            return {satisfied: 0, total: 1, tag: '...', severity: 'warn', unsaved};
        case 'created':
        default:
            return {satisfied: 0, total: 1, tag: '—', severity: 'warn', unsaved};
        }
    }

    // Unknown category — neutral fallback (defensive default so adding a
    // new category in the rail data doesn't crash the helper).
    return {satisfied: 0, total: 0, tag: '—', severity: 'warn', unsaved};
};
