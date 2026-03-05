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

export const validateScenario = (scenario) => {
    if (!scenario || typeof scenario !== 'object') {
        return false;
    }
    if (!(scenario?.name?.length > 0)) {
        return false;
    }
    if (!scenario?.elevation) {
        return false;
    }
    if (!scenario?.inflow) {
        return false;
    }
    if (!(scenario?.resolution > 0)) {
        return false;
    }
    if (!(scenario?.duration > 0)) {
        return false;
    }
    if (!scenario?.boundary) {
        return false;
    }
    return true;
};
