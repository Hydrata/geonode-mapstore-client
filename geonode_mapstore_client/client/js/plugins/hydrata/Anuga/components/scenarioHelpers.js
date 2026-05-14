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
    if (!secs) {
        return 'hh:mm';
    }
    const secNum = parseInt(secs.toString(), 10);
    const hours = Math.floor(secNum / 3600);
    const minutes = Math.floor(secNum / 60) % 60;
    const seconds = secNum % 60;

    return [hours, minutes, seconds]
        .map((val) => (val < 10 ? `0${val}` : val))
        .filter((val, index) => val !== "00" || index > 0)
        .join(":")
        .replace(/^0/, "")
        .slice(0, -3);
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
    if (!scenario?.inflow) {
        return 'inflow';
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
