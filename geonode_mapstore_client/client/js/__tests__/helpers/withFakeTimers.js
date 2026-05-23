/*
 * Test helper: withFakeTimers
 *
 * SPEC DEVIATION (intentional, evidence-backed): the spec asks to wrap "sinon
 * or jasmine fake-timers". Runner is karma + @geosolutions/mocha; sinon, lolex
 * and @sinonjs/fake-timers are all MISSING from node_modules and NO test calls
 * `useFakeTimers`. Rather than add a dep, this is a zero-dependency manual
 * clock: it swaps in controllable setTimeout/clearTimeout/setInterval/
 * clearInterval/Date.now and restores the real globals on teardown.
 * `clock.tick(ms)` advances virtual time and fires due callbacks synchronously.
 *
 * Usage: beforeEach(() => { clock = withFakeTimers(); }); // afterEach restores
 *        it('...', () => { setTimeout(fn, 100); clock.tick(100); ... });
 *
 * No `-test` suffix → excluded from the karma glob. Depends on nothing.
 */

/**
 * Install a fake clock over the timer globals.
 * @returns {{tick: function, now: function, restore: function}}
 */
export default function withFakeTimers() {
    const real = {
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
        setInterval: global.setInterval,
        clearInterval: global.clearInterval,
        dateNow: Date.now
    };
    let current = 0;
    let nextId = 1;
    const timers = new Map(); // id -> { time, cb, interval }

    global.setTimeout = (cb, ms = 0) => {
        const id = nextId++;
        timers.set(id, { time: current + ms, cb, interval: null });
        return id;
    };
    global.setInterval = (cb, ms = 0) => {
        const id = nextId++;
        timers.set(id, { time: current + ms, cb, interval: ms });
        return id;
    };
    global.clearTimeout = (id) => { timers.delete(id); };
    global.clearInterval = (id) => { timers.delete(id); };
    Date.now = () => current;

    const clock = {
        now: () => current,
        tick: (ms) => {
            const target = current + ms;
            let due = [...timers.entries()].filter(([, t]) => t.time <= target)
                .sort((a, b) => a[1].time - b[1].time);
            while (due.length) {
                const [id, t] = due.shift();
                current = t.time;
                if (t.interval !== null) {
                    timers.set(id, { ...t, time: t.time + t.interval });
                } else {
                    timers.delete(id);
                }
                t.cb();
                due = [...timers.entries()].filter(([, e]) => e.time <= target)
                    .sort((a, b) => a[1].time - b[1].time);
            }
            current = target;
        },
        restore: () => {
            global.setTimeout = real.setTimeout;
            global.clearTimeout = real.clearTimeout;
            global.setInterval = real.setInterval;
            global.clearInterval = real.clearInterval;
            Date.now = real.dateNow;
        }
    };
    if (typeof afterEach === 'function') {
        afterEach(() => clock.restore());
    }
    return clock;
}
