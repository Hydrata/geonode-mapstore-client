/**
 * TASK-1665 W2: render tests for the TaskMonitor dark-glass migration.
 *
 * These tests verify structural parity: the migrated components must produce
 * the same DOM structure (same elements, same roles, same content slots)
 * as the pre-migration light-theme components. The CSS class names change
 * (tm-* → sv-tm-*) but the DOM structure is identical.
 *
 * NOTE on i18n: We use ReactDOM.render without an IntlProvider. Message.jsx
 * falls back to rendering its msgId string when no provider is present, so
 * we can assert on msgId text where needed. This matches the pattern used in
 * ProcessRow-dom-test.js (mountWithProviders without IntlProvider).
 *
 * NOTE: ProcessRow imports StatusBadge and ProgressBar from the SimpleView
 * primitives barrel. These are peer files (not external deps) that render
 * identically under karma.
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TaskMonitorPanel from '../components/TaskMonitorPanel';
import ProcessRow from '../components/ProcessRow';
import ProcessDetail from '../components/ProcessDetail';
import ProcessLogViewer from '../components/ProcessLogViewer';

describe('TaskMonitor dark-glass migration (TASK-1665 W2)', () => {
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

    // ── Panel shell ───────────────────────────────────────────────────────────

    describe('TaskMonitorPanel', () => {
        const renderPanel = (props = {}) => ReactDOM.render(
            <TaskMonitorPanel
                processes={[]}
                filter="active"
                onClose={() => {}}
                onSetFilter={() => {}}
                onExpandProcess={() => {}}
                onToggleLog={() => {}}
                onCancel={() => {}}
                {...props}
            />,
            container
        );

        it('uses .simple-view-panel (dark-glass shell) NOT .tm-panel', (done) => {
            renderPanel();
            setTimeout(() => {
                expect(container.querySelector('.simple-view-panel')).toExist();
                expect(container.querySelector('.tm-panel')).toNotExist();
                done();
            });
        });

        it('also carries .sv-tm-container class (layout + size)', (done) => {
            renderPanel();
            setTimeout(() => {
                expect(container.querySelector('.sv-tm-container')).toExist();
                done();
            });
        });

        it('renders .sv-tm-header (NOT .tm-panel-header)', (done) => {
            renderPanel();
            setTimeout(() => {
                expect(container.querySelector('.sv-tm-header')).toExist();
                expect(container.querySelector('.tm-panel-header')).toNotExist();
                done();
            });
        });

        it('close button uses .sv-legend-close (NOT .tm-close-btn)', (done) => {
            renderPanel();
            setTimeout(() => {
                expect(container.querySelector('.sv-legend-close')).toExist();
                expect(container.querySelector('.tm-close-btn')).toNotExist();
                done();
            });
        });

        it('renders .sv-tm-empty when processes=[]', (done) => {
            renderPanel();
            setTimeout(() => {
                expect(container.querySelector('.sv-tm-empty')).toExist();
                expect(container.querySelector('.tm-empty')).toNotExist();
                done();
            });
        });

        it('renders one .sv-tm-process-row per process', (done) => {
            const processes = [
                { id: '1', status: 'running', name: 'Process A', process_type: 'anuga_run' },
                { id: '2', status: 'complete', name: 'Process B', process_type: 'layer_create' }
            ];
            renderPanel({ processes });
            setTimeout(() => {
                expect(container.querySelectorAll('.sv-tm-process-row').length).toBe(2);
                done();
            });
        });
    });

    // ── ProcessRow ────────────────────────────────────────────────────────────

    describe('ProcessRow', () => {
        const makeProcess = (overrides = {}) => ({
            id: '1', status: 'running', name: 'Test process',
            process_type: 'anuga_run', ...overrides
        });

        it('uses .sv-tm-process-row (NOT .tm-process-row)', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess()} expanded={false} onClick={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-tm-process-row')).toExist();
                    expect(container.querySelector('.tm-process-row')).toNotExist();
                    done();
                }
            );
        });

        it('adds .sv-tm-expanded when expanded=true', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess()} expanded onClick={() => {}} />,
                container,
                () => {
                    const row = container.querySelector('.sv-tm-process-row');
                    expect(row.className).toInclude('sv-tm-expanded');
                    done();
                }
            );
        });

        it('uses .sv-tm-process-name for the process name', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess({ name: 'My Process' })} expanded={false} onClick={() => {}} />,
                container,
                () => {
                    const name = container.querySelector('.sv-tm-process-name');
                    expect(name).toExist();
                    expect(name.textContent).toInclude('My Process');
                    done();
                }
            );
        });

        it('renders a .sv-status-badge (from StatusBadge primitive, NOT .tm-badge)', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess({ status: 'complete' })} expanded={false} onClick={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-status-badge')).toExist();
                    expect(container.querySelector('.tm-badge')).toNotExist();
                    done();
                }
            );
        });

        it('renders a .sv-progress-track (ProgressBar primitive) when status=running and progress_pct set', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess({ status: 'running', progress_pct: 60 })} expanded={false} onClick={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-progress-track')).toExist();
                    expect(container.querySelector('.tm-progress-bar-container')).toNotExist();
                    done();
                }
            );
        });

        it('does NOT render progress bar when status is not running', (done) => {
            ReactDOM.render(
                <ProcessRow process={makeProcess({ status: 'complete', progress_pct: 100 })} expanded={false} onClick={() => {}} />,
                container,
                () => {
                    expect(container.querySelector('.sv-progress-track')).toNotExist();
                    done();
                }
            );
        });

        it('invokes onClick with process.id on click', (done) => {
            const clicks = [];
            ReactDOM.render(
                <ProcessRow process={makeProcess({ id: 'abc' })} expanded={false} onClick={(id) => clicks.push(id)} />,
                container,
                () => {
                    container.querySelector('.sv-tm-process-row').click();
                    expect(clicks.length).toBe(1);
                    expect(clicks[0]).toBe('abc');
                    done();
                }
            );
        });
    });

    // ── ProcessDetail ─────────────────────────────────────────────────────────

    describe('ProcessDetail', () => {
        const makeProcess = (overrides = {}) => ({
            id: '1', status: 'running', name: 'Test', subtasks: [], ...overrides
        });

        it('renders .sv-tm-process-detail (NOT .tm-process-detail)', (done) => {
            ReactDOM.render(
                <ProcessDetail
                    process={makeProcess()}
                    showLog={false}
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-tm-process-detail')).toExist();
                    expect(container.querySelector('.tm-process-detail')).toNotExist();
                    done();
                }
            );
        });

        it('renders error message in .sv-tm-error-message (NOT .tm-error-message)', (done) => {
            ReactDOM.render(
                <ProcessDetail
                    process={makeProcess({ error_message: 'Something went wrong' })}
                    showLog={false}
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    const errDiv = container.querySelector('.sv-tm-error-message');
                    expect(errDiv).toExist();
                    expect(errDiv.textContent).toInclude('Something went wrong');
                    expect(container.querySelector('.tm-error-message')).toNotExist();
                    done();
                }
            );
        });

        it('renders subtask rows in .sv-tm-subtask-list', (done) => {
            const subtasks = [
                { name: 'Step 1', status: 'complete' },
                { name: 'Step 2', status: 'running' }
            ];
            ReactDOM.render(
                <ProcessDetail
                    process={makeProcess({ subtasks })}
                    showLog={false}
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-tm-subtask-list')).toExist();
                    expect(container.querySelectorAll('.sv-tm-subtask-row').length).toBe(2);
                    expect(container.querySelector('.tm-subtask-list')).toNotExist();
                    done();
                }
            );
        });

        it('renders log viewer (.sv-log-viewer) when showLog=true', (done) => {
            ReactDOM.render(
                <ProcessDetail
                    process={makeProcess({ log: 'some log' })}
                    showLog
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-log-viewer')).toExist();
                    expect(container.querySelector('.tm-log-viewer')).toNotExist();
                    done();
                }
            );
        });

        it('does NOT render log viewer when showLog=false', (done) => {
            ReactDOM.render(
                <ProcessDetail
                    process={makeProcess({ log: 'some log' })}
                    showLog={false}
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    expect(container.querySelector('.sv-log-viewer')).toNotExist();
                    done();
                }
            );
        });

        it('returns null when process is null', (done) => {
            ReactDOM.render(
                <ProcessDetail
                    process={null}
                    showLog={false}
                    onToggleLog={() => {}}
                    onCancel={() => {}}
                />,
                container,
                () => {
                    expect(container.children.length).toBe(0);
                    done();
                }
            );
        });
    });

    // ── ProcessLogViewer (delegates to LogViewer primitive) ───────────────────

    describe('ProcessLogViewer', () => {
        it('renders .sv-log-viewer (from LogViewer primitive, NOT .tm-log-viewer)', (done) => {
            ReactDOM.render(<ProcessLogViewer log="test log" />, container, () => {
                expect(container.querySelector('.sv-log-viewer')).toExist();
                expect(container.querySelector('.tm-log-viewer')).toNotExist();
                done();
            });
        });

        it('renders log content', (done) => {
            ReactDOM.render(<ProcessLogViewer log="Step 1 done" />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('Step 1 done');
                done();
            });
        });

        it('renders placeholder when log is null', (done) => {
            ReactDOM.render(<ProcessLogViewer log={null} />, container, () => {
                const pre = container.querySelector('.sv-log-viewer');
                expect(pre.textContent).toInclude('(no log output)');
                done();
            });
        });
    });
});

// TASK-2235 (r2) — the Tasks-panel close chip must not sit flush at the panel
// corner: it stays corner-anchored (absolute) but at top/right 2px, off the
// border radius.
describe('TASK-2235 TaskMonitor close chip 2px edge margin', () => {
    let container;

    beforeEach(() => {
        // ensure the shared stylesheet with the .sv-tm-header/.sv-legend-close
        // rules is in the karma bundle before computing styles.
        require('../../SimpleView/simpleView.css');
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('close chip is corner-anchored at 2px (not flush over the panel border radius)', (done) => {
        ReactDOM.render(
            <TaskMonitorPanel
                processes={[]}
                filter="active"
                onClose={() => {}}
                onSetFilter={() => {}}
                onExpandProcess={() => {}}
                onToggleLog={() => {}}
                onCancel={() => {}}
            />,
            container,
            () => {
                const chip = container.querySelector('.sv-tm-header .sv-legend-close');
                expect(chip).toExist();
                const cs = window.getComputedStyle(chip);
                expect(cs.position).toBe('absolute');
                expect(cs.top).toBe('2px');
                expect(cs.right).toBe('2px');
                expect(cs.marginTop).toBe('0px');
                done();
            }
        );
    });
});
