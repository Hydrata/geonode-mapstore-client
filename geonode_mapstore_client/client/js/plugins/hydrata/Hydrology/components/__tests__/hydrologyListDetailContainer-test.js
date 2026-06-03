/**
 * TASK-1448 — IDF Manual|Derive sub-toggle regression test.
 *
 * Regression: setActiveHydrologyPage was called in the IdfSubToggle click
 * handlers but was neither imported from actionsHydrology nor wired in
 * mapDispatchToProps → TypeError: _this2.props.setActiveHydrologyPage is
 * not a function.
 *
 * This test drives the UNCONNECTED HydrologyListDetailContainerClass so no
 * Redux Provider is needed for the class itself. However, when
 * activeHydrologyPage === 'idf-derive' the class renders HydrologyDetailIdfDerive
 * which IS a connected child component — those cases wrap in a minimal Provider.
 *
 * For the 'idf-table' page the HydrologyDetailIdfTable child is also connected,
 * so we pass activeHydrologyItem=null to take the "select an item" branch and
 * avoid rendering connected children.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import { HydrologyListDetailContainerClass } from '../hydrologyListDetailContainer';

// Minimal passthrough Redux store so connected child components (HydrologyDetailIdfDerive)
// can find a store in context without needing any real state.
function makeMinimalStore(state = {}) {
    return createStore((s = state) => s, state);
}

describe('TASK-1448 IDF sub-toggle — setActiveHydrologyPage wiring', () => {
    let container;

    const noop = () => {};

    const defaultProps = {
        activeHydrologyPage: 'idf-table',
        activeHydrologyItems: [],
        activeHydrologyItem: null,   // null → "select an item" branch; avoids connected detail children
        setActiveHydrologyItem: noop,
        setActiveHydrologyPage: noop,
        updateActiveHydrologyItem: noop,
        saveHydrologyItem: noop,
        createHydrologyForm: noop,
        deleteHydrologyItem: noop
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    /**
     * Render the class with a minimal Provider so connected child components
     * rendered in the idf-derive branch can find a store.
     */
    function renderWithProvider(props) {
        const store = makeMinimalStore({ hydrology: { idfDerive: { celeryAnugaEnabled: true, lat: null, lon: null, durationsText: '', rpsText: '', mapPickActive: false, inFlight: false, error: null, result: null } } });
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        {...defaultProps}
                        {...props}
                    />
                </Provider>,
                container
            );
        });
    }

    it('renders the IDF sub-toggle when activeHydrologyPage is idf-table', () => {
        // Use no-Provider render since activeHydrologyItem=null skips connected children
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass {...defaultProps} activeHydrologyPage="idf-table" />,
                container
            );
        });
        const subToggle = container.querySelector('.hydrology-idf-subtoggle');
        expect(subToggle).toExist();
    });

    it('renders the IDF sub-toggle when activeHydrologyPage is idf-derive', () => {
        // idf-derive branch renders HydrologyDetailIdfDerive (connected) → needs Provider
        renderWithProvider({ activeHydrologyPage: 'idf-derive' });
        const subToggle = container.querySelector('.hydrology-idf-subtoggle');
        expect(subToggle).toExist();
    });

    it('does NOT render the IDF sub-toggle for non-IDF pages', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass {...defaultProps} activeHydrologyPage="temporal-pattern" />,
                container
            );
        });
        const subToggle = container.querySelector('.hydrology-idf-subtoggle');
        expect(subToggle).toNotExist();
    });

    it('clicking "IDF Tables" button calls setActiveHydrologyPage("idf-table")', () => {
        // Start on idf-derive so both buttons are visible and the active page differs
        let calledWith = null;
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            setActiveHydrologyPage: (page) => { calledWith = page; }
        });

        const buttons = container.querySelectorAll('.hydrology-idf-subtoggle button');
        // First button = IDF Tables
        expect(buttons.length).toBe(2);
        ReactTestUtils.act(() => {
            buttons[0].click();
        });
        expect(calledWith).toBe('idf-table');
    });

    it('clicking "IDF Derive" button calls setActiveHydrologyPage("idf-derive")', () => {
        // Start on idf-table (no Provider needed since activeHydrologyItem=null)
        let calledWith = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultProps}
                    activeHydrologyPage="idf-table"
                    setActiveHydrologyPage={(page) => { calledWith = page; }}
                />,
                container
            );
        });

        const buttons = container.querySelectorAll('.hydrology-idf-subtoggle button');
        // Second button = IDF Derive
        expect(buttons.length).toBe(2);
        ReactTestUtils.act(() => {
            buttons[1].click();
        });
        expect(calledWith).toBe('idf-derive');
    });

    it('does NOT throw TypeError when setActiveHydrologyPage is provided (regression guard)', () => {
        // Regression guard: before the fix this threw
        // "TypeError: _this2.props.setActiveHydrologyPage is not a function"
        let thrown = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultProps}
                    activeHydrologyPage="idf-table"
                    setActiveHydrologyPage={(page) => page}
                />,
                container
            );
        });

        try {
            ReactTestUtils.act(() => {
                const buttons = container.querySelectorAll('.hydrology-idf-subtoggle button');
                buttons[1].click(); // IDF Derive
            });
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBe(null);
    });
});
