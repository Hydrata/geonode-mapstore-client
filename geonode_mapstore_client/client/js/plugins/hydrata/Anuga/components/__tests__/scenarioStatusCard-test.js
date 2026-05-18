import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioStatusCard} from '../scenarioStatusCard';

/**
 * TASK-C-scenarios-miller Wave 3A — basic render contract for the
 * ScenarioStatusCard component. Asserts each lifecycle status renders
 * the expected card chrome (pill, optional progress bar, optional ETA
 * or elapsed text).
 */

describe('Wave 3A — ScenarioStatusCard', () => {
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
        ReactDOM.render(<ScenarioStatusCard scenario={null} />, container, () => {
            expect(container.querySelector('.anuga-scenario-status-card')).toNotExist();
            done();
        });
    });

    it('renders the card + pill for status=built', (done) => {
        ReactDOM.render(
            <ScenarioStatusCard scenario={{id: 1, status: 'built'}} />,
            container,
            () => {
                const card = container.querySelector('.anuga-scenario-status-card');
                expect(card).toExist();
                expect(card.className).toInclude('anuga-scenario-status-card--built');
                expect(container.querySelector('.scenario-status-pill')).toExist();
                // Built status has no progress bar.
                expect(container.querySelector('.anuga-scenario-status-card-progress')).toNotExist();
                done();
            }
        );
    });

    it('renders progress bar + ETA for status=computing', (done) => {
        const s = {
            id: 1,
            status: 'computing',
            latest_run: {progress_pct: 47, eta_seconds: 724}
        };
        ReactDOM.render(
            <ScenarioStatusCard scenario={s} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-status-card--computing')).toExist();
                expect(container.querySelector('.anuga-scenario-status-card-progress')).toExist();
                const eta = container.querySelector('.anuga-scenario-status-card-eta');
                expect(eta).toExist();
                expect(eta.className).toNotInclude('is-stopped');
                done();
            }
        );
    });

    it('renders elapsed (stopped after) text for status=error', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {elapsed_seconds: 1102}
        };
        ReactDOM.render(
            <ScenarioStatusCard scenario={s} />,
            container,
            () => {
                const eta = container.querySelector('.anuga-scenario-status-card-eta');
                expect(eta).toExist();
                expect(eta.className).toInclude('is-stopped');
                done();
            }
        );
    });

    it('renders elapsed (stopped after) text for status=cancelled', (done) => {
        const s = {
            id: 1,
            status: 'cancelled',
            latest_run: {elapsed_seconds: 300}
        };
        ReactDOM.render(
            <ScenarioStatusCard scenario={s} />,
            container,
            () => {
                const eta = container.querySelector('.anuga-scenario-status-card-eta');
                expect(eta).toExist();
                expect(eta.className).toInclude('is-stopped');
                done();
            }
        );
    });

    it('renders the card for status=created without crashing', (done) => {
        ReactDOM.render(
            <ScenarioStatusCard scenario={{id: 1, status: 'created'}} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-status-card')).toExist();
                done();
            }
        );
    });

    it('renders the card for status=complete', (done) => {
        ReactDOM.render(
            <ScenarioStatusCard scenario={{id: 1, status: 'complete'}} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-status-card--complete')).toExist();
                done();
            }
        );
    });

    it('renders the card for status=queued', (done) => {
        ReactDOM.render(
            <ScenarioStatusCard scenario={{id: 1, status: 'queued'}} />,
            container,
            () => {
                expect(container.querySelector('.anuga-scenario-status-card--queued')).toExist();
                done();
            }
        );
    });

    it('applies is-error to the progress fill when status=error with progress data', (done) => {
        const s = {
            id: 1,
            status: 'error',
            latest_run: {progress_pct: 32, elapsed_seconds: 1102}
        };
        ReactDOM.render(
            <ScenarioStatusCard scenario={s} />,
            container,
            () => {
                const fill = container.querySelector('.anuga-scenario-status-card-progress-fill');
                expect(fill).toExist();
                expect(fill.className).toInclude('is-error');
                done();
            }
        );
    });
});
