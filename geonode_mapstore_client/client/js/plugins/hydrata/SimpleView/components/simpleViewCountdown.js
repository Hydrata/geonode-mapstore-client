import React from 'react';

export class Countdown extends React.Component {
    constructor() {
        super();
        this.state = {time: {}, seconds: 180};
        this.timer = 0;
        this.startTimer = this.startTimer.bind(this);
        this.countDown = this.countDown.bind(this);
    }

    componentDidMount() {
        this.startTimer();
        let timeLeftVar = this.secondsToTime(this.state.seconds);
        this.setState({time: timeLeftVar});
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <React.Fragment>
                {this.state.time.m}:{this.state.time.s}
            </React.Fragment>
        );
    }

    secondsToTime(secs) {
        let hours = Math.floor(secs / (60 * 60));

        let divisorForMinutes = secs % (60 * 60);
        let minutes = Math.floor(divisorForMinutes / 60);

        let divisorForSeconds = divisorForMinutes % 60;
        let seconds = String(Math.ceil(divisorForSeconds)).padStart(2, '0');
        return {
            "h": hours,
            "m": minutes,
            "s": seconds
        };
    }

    startTimer() {
        if (this.timer === 0 && this.state.seconds > 0) {
            this.timer = setInterval(this.countDown, 1000);
        }
    }

    countDown() {
        // Remove one second, set state so a re-render happens.
        let seconds = this.state.seconds - 1;
        this.setState({
            time: this.secondsToTime(seconds),
            seconds: seconds
        });

        // Check if we're at zero.
        if (seconds === 0) {
            clearInterval(this.timer);
        }
    }
}
