import React from "react";

// adapted from https://codepen.io/andrewchmr-the-vuer/pen/wvWLRVw

export const TimeInput = () => {
    const [value, setValue] = React.useState("00:05:00");

    const onChange = (event) => {
        setValue(event.target.value);
    };

    const getSecondsFromHHMMSS = (userInputValue) => {
        const [str1, str2, str3] = userInputValue.split(":");

        const val1 = Number(str1);
        const val2 = Number(str2);
        const val3 = Number(str3);

        if (!isNaN(val1) && isNaN(val2) && isNaN(val3)) {
            return val1;
        }

        if (!isNaN(val1) && !isNaN(val2) && isNaN(val3)) {
            return val1 * 60 + val2;
        }

        if (!isNaN(val1) && !isNaN(val2) && !isNaN(val3)) {
            return val1 * 60 * 60 + val2 * 60 + val3;
        }

        return 0;
    };

    const toHHMMSS = (secs) => {
        const secNum = parseInt(secs.toString(), 10);
        const hours = Math.floor(secNum / 3600);
        const minutes = Math.floor(secNum / 60) % 60;
        const seconds = secNum % 60;

        return [hours, minutes, seconds]
            .map((val) => (val < 10 ? `0${val}` : val))
            .filter((val, index) => val !== "00" || index > 0)
            .join(":")
            .replace(/^0/, "");
    };

    const onBlur = (event) => {
        const targetValue = event.target.value;
        const seconds = Math.max(0, getSecondsFromHHMMSS(targetValue));

        const time = toHHMMSS(seconds);
        setValue(time);
    };

    return (
        <input type="text" onChange={onChange} onBlur={onBlur} value={value}/>
    );
};
