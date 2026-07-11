import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import {ScenarioErrorStrip} from '../scenarioErrorStrip';

/**
 * TASK-C-scenarios-miller Wave 3A — render contract for the
 * ScenarioErrorStrip component. The strip is visible only when the
 * resolved scenario status is 'error'.
 *
 * TASK-1730 (Phase-C parity migration) — the strip now renders through the
 * shared {ErrorStrip} primitive. The outer `.sv-anuga-scenario-error-strip`
 * class + `role="alert"` are preserved (via `extraClassName`); the inner
 * head/payload hooks canonicalised from `.sv-anuga-scenario-error-strip-head/
 * -payload` to the primitive's `.sv-error-strip-head/-payload`. These specs
 * assert BOTH the preserved outer hook AND the canonical inner hooks so the
 * structural parity is pinned.
 *
 * W1.2 (TASK-2207, epic 2204) — classified cause + collapsible run.log tail
 * + staff-only CloudWatch deep link, built on the W1.1 (TASK-2206, BE)
 * capture/classification. AC#4's run-1283-shaped fixture proof lives at the
 * bottom of this file.
 */

describe('Wave 3A — ScenarioErrorStrip', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('returns null when scenario is null', (done) => {
        ReactDOM.render(<ScenarioErrorStrip scenario={null} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
            done();
        });
    });

    it('returns null when status is not error', (done) => {
        ReactDOM.render(
            <ScenarioErrorStrip scenario={{id: 1, status: 'built'}} />,
            container,
            () => {
                expect(container.querySelector('.sv-anuga-scenario-error-strip')).toNotExist();
                done();
            }
        );
    });

    it('renders the head + error payload when status is error', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {error_message: 'ValueError: mesh validation failed'}
        };
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                const strip = container.querySelector('.sv-anuga-scenario-error-strip');
                expect(strip).toExist();
                expect(strip.getAttribute('role')).toBe('alert');
                // Canonical: the shared primitive carries the sv-error-strip hook too.
                expect(strip.className).toInclude('sv-error-strip');
                expect(container.querySelector('.sv-error-strip-head')).toExist();
                const payload = container.querySelector('.sv-error-strip-payload');
                expect(payload).toExist();
                expect(payload.textContent).toInclude('mesh validation failed');
                done();
            }
        );
    });

    it('falls back to the statusError message when latest_run has no error_message', (done) => {
        const s = {id: 1, status: 'error', latest_run: {}};
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                expect(container.querySelector('.sv-error-strip-payload')).toExist();
                done();
            }
        );
    });

    it('still renders when latest_run is missing entirely', (done) => {
        const s = {id: 1, status: 'error'};
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                expect(container.querySelector('.sv-anuga-scenario-error-strip')).toExist();
                done();
            }
        );
    });

    it('renders the error message as a code element when provided', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {error_message: 'Boom'}
        };
        ReactDOM.render(
            <ScenarioErrorStrip scenario={s} />,
            container,
            () => {
                const code = container.querySelector('code.sv-error-strip-payload');
                expect(code).toExist();
                expect(code.textContent).toBe('Boom');
                done();
            }
        );
    });
});

/*
 * W1.2 (TASK-2207, epic 2204) — classified cause + collapsible run.log
 * tail + staff-only CloudWatch deep link.
 */
const RUN_1283_TRACEBACK =
    'Traceback (most recent call last):\n'
    + '  File "anuga/parallel/parallel_inlet_operator.py", line 121, in update_inlet\n'
    + '    assert volume >= 0, msg\n'
    + 'AssertionError: Volume of watrer in inlet negative!\n';

describe('W1.2 ScenarioErrorStrip — classified cause', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('renders no cause line when error_class is missing (pre-2206 rows)', (done) => {
        const s = {id: 1, status: 'error', latest_run: {error_message: 'Boom'}};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-cause')).toNotExist();
            done();
        });
    });

    it('renders the translated cause label for a classified error', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {error_message: 'AssertionError: boom', error_class: 'in-process'}
        };
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            const cause = container.querySelector('.sv-anuga-scenario-error-cause');
            expect(cause).toExist();
            expect(cause.textContent.length).toBeGreaterThan(0);
            done();
        });
    });
});

describe('W1.2 ScenarioErrorStrip — collapsible run.log tail', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('renders no tail toggle when there is nothing to show', (done) => {
        const s = {id: 1, status: 'error', latest_run: {error_message: 'Boom'}};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-log-tail-toggle')).toNotExist();
            done();
        });
    });

    it('starts collapsed and reveals the log tail on click (zero AWS for in-process)', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {
                error_message: 'AssertionError: Volume of watrer in inlet negative!',
                error_class: 'in-process',
                log: RUN_1283_TRACEBACK
            }
        };
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            expect(container.querySelector('.sv-log-viewer')).toNotExist();
            const toggle = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
            expect(toggle).toExist();
            TestUtils.Simulate.click(toggle);
            setTimeout(() => {
                const viewer = container.querySelector('.sv-log-viewer');
                expect(viewer).toExist();
                expect(viewer.textContent).toInclude('AssertionError: Volume of watrer in inlet negative!');
                done();
            });
        });
    });

    it('TASK-2221 (W5, epic 2204): resets the log tail to collapsed when a different scenario is shown', (done) => {
        const scenarioA = {
            id: 1,
            status: 'error',
            latest_run: {
                id: 101,
                error_message: 'Scenario A boom',
                error_class: 'in-process',
                log: RUN_1283_TRACEBACK
            }
        };
        const scenarioB = {
            id: 2,
            status: 'error',
            latest_run: {
                id: 202,
                error_message: 'Scenario B boom',
                error_class: 'in-process',
                log: 'Traceback for scenario B\nAssertionError: something else'
            }
        };
        ReactDOM.render(<ScenarioErrorStrip scenario={scenarioA} />, container, () => {
            const toggle = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
            TestUtils.Simulate.click(toggle);
            setTimeout(() => {
                expect(container.querySelector('.sv-log-viewer')).toExist();
                // Re-render at the SAME tree position with scenario B's props —
                // no unmount, so component-local state (logTailOpen) survives
                // unless the component resets it itself.
                ReactDOM.render(<ScenarioErrorStrip scenario={scenarioB} />, container, () => {
                    setTimeout(() => {
                        expect(container.querySelector('.sv-log-viewer')).toNotExist();
                        expect(container.querySelector('.sv-anuga-scenario-error-log-tail-toggle')).toExist();
                        done();
                    });
                });
            });
        });
    });

    it('TASK-2221 (W5, epic 2204): resets the log tail to collapsed for a NEW run of the SAME scenario', (done) => {
        const run1 = {
            id: 1,
            status: 'error',
            latest_run: {
                id: 301,
                error_message: 'First run boom',
                error_class: 'in-process',
                log: RUN_1283_TRACEBACK
            }
        };
        const run2 = {
            id: 1,
            status: 'error',
            latest_run: {
                id: 302,
                error_message: 'Retry run boom',
                error_class: 'in-process',
                log: 'Traceback for the retry\nAssertionError: retried and failed again'
            }
        };
        ReactDOM.render(<ScenarioErrorStrip scenario={run1} />, container, () => {
            const toggle = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
            TestUtils.Simulate.click(toggle);
            setTimeout(() => {
                expect(container.querySelector('.sv-log-viewer')).toExist();
                ReactDOM.render(<ScenarioErrorStrip scenario={run2} />, container, () => {
                    setTimeout(() => {
                        expect(container.querySelector('.sv-log-viewer')).toNotExist();
                        done();
                    });
                });
            });
        });
    });

    it('falls back to cloudwatch_log_tail when run.log has nothing (entrypoint-death backstop)', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {
                error_message: 'Batch entrypoint failed with exit code 1',
                error_class: 'entrypoint-failure',
                log: '',
                cloudwatch_log_tail: 'line from CloudWatch\nanother line'
            }
        };
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            const toggle = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
            expect(toggle).toExist();
            TestUtils.Simulate.click(toggle);
            setTimeout(() => {
                const viewer = container.querySelector('.sv-log-viewer');
                expect(viewer.textContent).toInclude('line from CloudWatch');
                done();
            });
        });
    });
});

describe('W1.2 ScenarioErrorStrip — staff-only CloudWatch deep link', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    const runWithGroupAndStream = {
        error_message: 'Batch entrypoint failed with exit code 1',
        error_class: 'entrypoint-failure',
        log_group_name: '/aws/batch/anuga-simulation',
        log_stream_name: 'anuga-x32/default/43173b7437794fa68a9a791d94a77938'
    };

    it('does NOT render the deep link for a non-staff user', (done) => {
        const s = {id: 1, status: 'error', latest_run: runWithGroupAndStream};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} isStaff={false} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-cw-link')).toNotExist();
            done();
        });
    });

    it('does NOT render the deep link when isStaff is omitted (default false)', (done) => {
        const s = {id: 1, status: 'error', latest_run: runWithGroupAndStream};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-cw-link')).toNotExist();
            done();
        });
    });

    it('renders the deep link for a staff user when group+stream are known', (done) => {
        const s = {id: 1, status: 'error', latest_run: runWithGroupAndStream};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} isStaff />, container, () => {
            const link = container.querySelector('.sv-anuga-scenario-error-cw-link-anchor');
            expect(link).toExist();
            expect(link.getAttribute('href')).toInclude('console.aws.amazon.com');
            expect(link.getAttribute('target')).toBe('_blank');
            done();
        });
    });

    it('renders no deep link for staff when group/stream are not yet captured', (done) => {
        const s = {id: 1, status: 'error', latest_run: {error_message: 'Boom'}};
        ReactDOM.render(<ScenarioErrorStrip scenario={s} isStaff />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-cw-link')).toNotExist();
            done();
        });
    });
});

describe('W1.2 AC#4 — run 1283 stored-data shape renders actionably', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    // The exact run-1283 shape post-W1.1 (TASK-2206): classified in-process
    // (the precedence rule recovered the real traceback summary as
    // error_message instead of the generic entrypoint text), the full
    // traceback in `log`, and captured group/stream from describe_jobs.
    const run1283 = {
        id: 1283,
        status: 'error',
        latest_run: {
            error_message: 'AssertionError: Volume of watrer in inlet negative!',
            error_class: 'in-process',
            log: RUN_1283_TRACEBACK,
            log_group_name: '/aws/batch/anuga-simulation',
            log_stream_name: 'anuga-x32/default/43173b7437794fa68a9a791d94a77938',
            cloudwatch_log_tail: null
        }
    };

    it('staff view: classified cause + traceback tail (on expand) + deep link, all present', (done) => {
        ReactDOM.render(<ScenarioErrorStrip scenario={run1283} isStaff />, container, () => {
            // Classified cause visible immediately.
            expect(container.querySelector('.sv-anuga-scenario-error-cause')).toExist();
            // Raw recovered message visible immediately (not the generic
            // "exit code 1" text — proves the BE precedence rule's output
            // renders, not just that SOME message renders).
            const payload = container.querySelector('code.sv-error-strip-payload');
            expect(payload.textContent).toBe('AssertionError: Volume of watrer in inlet negative!');
            expect(payload.textContent).toNotInclude('exit code');
            // Traceback tail behind the collapsible toggle.
            const toggle = container.querySelector('.sv-anuga-scenario-error-log-tail-toggle');
            expect(toggle).toExist();
            TestUtils.Simulate.click(toggle);
            setTimeout(() => {
                expect(container.querySelector('.sv-log-viewer').textContent)
                    .toInclude('parallel_inlet_operator.py');
                // Staff deep link present.
                const link = container.querySelector('.sv-anuga-scenario-error-cw-link-anchor');
                expect(link).toExist();
                done();
            });
        });
    });

    it('non-staff view: same cause + traceback tail, but NO deep link', (done) => {
        ReactDOM.render(<ScenarioErrorStrip scenario={run1283} isStaff={false} />, container, () => {
            expect(container.querySelector('.sv-anuga-scenario-error-cause')).toExist();
            expect(container.querySelector('.sv-anuga-scenario-error-cw-link')).toNotExist();
            done();
        });
    });
});
