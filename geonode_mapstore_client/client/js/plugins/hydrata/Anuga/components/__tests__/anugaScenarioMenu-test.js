/*
 * Active/Archived filter chip on anugaScenarioMenu.
 *
 * Anchors the wire contract between the chip click and the redux action:
 *   - Default render reads state.anuga.scenarios.archiveFilter (defaults 'none')
 *   - Click toggles between 'none' (Active label) and 'only' (Archived label)
 *   - Calls props.setAnugaScenarioArchiveFilter(nextMode)
 *
 * We test the unconnected class to avoid having to wire a full redux store
 * — connect() coverage is folded into the reducer + action-creator tests in
 * ../../__tests__/anuga-test.js.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

// Import the connected default to ensure the redux wire still resolves the
// chip props (archiveFilter + setAnugaScenarioArchiveFilter).
import { AnugaScenarioMenu } from '../anugaScenarioMenu';

const makeStore = (archiveFilter = 'none') => createStore((state) => state, {
    anuga: {
        project: { id: 1, my_role: 'editor' },
        scenarios: { byId: {}, allIds: [], archiveFilter },
        resources: {
            // TASK-955 (W2.2 FE) — Rainfall slice added so ScenarioTableRow's
            // rainfalls prop has a deterministic empty array under tests.
            boundaries: [], terrain: [], frictions: [], inflows: [], rainfalls: [],
            structures: [], meshRegions: [], networks: []
        }
    },
    security: { user: { pk: 9999 } }
});

describe('TASK-880 anugaScenarioMenu archive filter chip', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    it('renders the Active label when archiveFilter is the default "none"', () => {
        const store = makeStore('none');
        ReactDOM.render(
            <Provider store={store}><AnugaScenarioMenu /></Provider>,
            container
        );
        // Scenario tab buttons live under #scenario-tab-button-group.
        const group = container.querySelector('#scenario-tab-button-group');
        expect(group).toExist();
        // The chip should NOT carry the .active class for 'none' mode.
        const buttons = Array.from(group.querySelectorAll('button.scenario-tab'));
        // Chip is the 4th tab (manage, advanced, compare, archive-chip).
        expect(buttons.length).toBe(4);
        const chip = buttons[3];
        expect(chip.className).toNotContain('active');
    });

    it('renders the Archived label (.active class) when archiveFilter is "only"', () => {
        const store = makeStore('only');
        ReactDOM.render(
            <Provider store={store}><AnugaScenarioMenu /></Provider>,
            container
        );
        const group = container.querySelector('#scenario-tab-button-group');
        const buttons = Array.from(group.querySelectorAll('button.scenario-tab'));
        expect(buttons.length).toBe(4);
        const chip = buttons[3];
        expect(chip.className).toContain('active');
    });

    it('dispatches SET_ANUGA_SCENARIO_ARCHIVE_FILTER on chip click', () => {
        const dispatched = [];
        const store = {
            getState: () => ({
                anuga: {
                    project: { id: 1, my_role: 'editor' },
                    scenarios: { byId: {}, allIds: [], archiveFilter: 'none' },
                    resources: {
                        // TASK-955 (W2.2 FE) — Rainfall slice for completeness.
                        boundaries: [], terrain: [], frictions: [], inflows: [], rainfalls: [],
                        structures: [], meshRegions: [], networks: []
                    }
                },
                security: { user: { pk: 9999 } }
            }),
            dispatch: (a) => dispatched.push(a),
            subscribe: () => () => {}
        };
        ReactDOM.render(
            <Provider store={store}><AnugaScenarioMenu /></Provider>,
            container
        );
        const buttons = Array.from(container.querySelectorAll('#scenario-tab-button-group button.scenario-tab'));
        const chip = buttons[3];
        chip.click();
        const setFilter = dispatched.find(a => a?.type === 'SET_ANUGA_SCENARIO_ARCHIVE_FILTER');
        expect(setFilter).toExist();
        // Default ('none') → clicking flips to 'only'.
        expect(setFilter.mode).toBe('only');
    });
});
