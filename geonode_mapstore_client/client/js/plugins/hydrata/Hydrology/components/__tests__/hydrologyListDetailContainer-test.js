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
 * For the 'sv-idf-table' page the HydrologyDetailIdfTable child is also connected,
 * so we pass activeHydrologyItem=null to take the "select an item" branch and
 * avoid rendering connected children.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import { HydrologyListDetailContainerClass, HydrologyListDetailContainer } from '../hydrologyListDetailContainer';

// Minimal passthrough Redux store so connected child components (HydrologyDetailIdfDerive)
// can find a store in context without needing any real state.
function makeMinimalStore(state = {}) {
    return createStore((s = state) => s, state);
}

describe('TASK-1448 IDF sub-toggle — setActiveHydrologyPage wiring', () => {
    let container;

    const noop = () => {};

    const defaultProps = {
        activeHydrologyPage: 'sv-idf-table',
        activeHydrologyItems: [],
        activeHydrologyItem: null,   // null → "select an item" branch; avoids connected detail children
        setActiveHydrologyItem: noop,
        setActiveHydrologyPage: noop,
        updateActiveHydrologyItem: noop,
        saveHydrologyItem: noop,
        createHydrologyForm: noop,
        deleteHydrologyItem: noop,
        // TASK-1557 (W2) — default the manager gate ON so existing per-row
        // delete assertions hold; a dedicated test flips it off.
        canManageHydrology: true
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

    it('renders the IDF sub-toggle when activeHydrologyPage is sv-idf-table', () => {
        // Use no-Provider render since activeHydrologyItem=null skips connected children
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass {...defaultProps} activeHydrologyPage="sv-idf-table" />,
                container
            );
        });
        const subToggle = container.querySelector('.sv-hydrology-idf-subtoggle');
        expect(subToggle).toExist();
    });

    it('renders the IDF sub-toggle when activeHydrologyPage is idf-derive', () => {
        // idf-derive branch renders HydrologyDetailIdfDerive (connected) → needs Provider
        renderWithProvider({ activeHydrologyPage: 'idf-derive' });
        const subToggle = container.querySelector('.sv-hydrology-idf-subtoggle');
        expect(subToggle).toExist();
    });

    it('does NOT render the IDF sub-toggle for non-IDF pages', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass {...defaultProps} activeHydrologyPage="temporal-pattern" />,
                container
            );
        });
        const subToggle = container.querySelector('.sv-hydrology-idf-subtoggle');
        expect(subToggle).toNotExist();
    });

    it('clicking "IDF Tables" button calls setActiveHydrologyPage("sv-idf-table")', () => {
        // Start on idf-derive so both buttons are visible and the active page differs
        let calledWith = null;
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            setActiveHydrologyPage: (page) => { calledWith = page; }
        });

        const buttons = container.querySelectorAll('.sv-hydrology-idf-subtoggle button');
        // First button = IDF Tables
        expect(buttons.length).toBe(2);
        ReactTestUtils.act(() => {
            buttons[0].click();
        });
        expect(calledWith).toBe('sv-idf-table');
    });

    it('clicking "IDF Derive" button calls setActiveHydrologyPage("idf-derive")', () => {
        // Start on sv-idf-table (no Provider needed since activeHydrologyItem=null)
        let calledWith = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultProps}
                    activeHydrologyPage="sv-idf-table"
                    setActiveHydrologyPage={(page) => { calledWith = page; }}
                />,
                container
            );
        });

        const buttons = container.querySelectorAll('.sv-hydrology-idf-subtoggle button');
        // Second button = IDF Derive
        expect(buttons.length).toBe(2);
        ReactTestUtils.act(() => {
            buttons[1].click();
        });
        expect(calledWith).toBe('idf-derive');
    });

    // TASK-1497 (UAT note-5) — the "Items" column is now shown on the Derive
    // page too, sourced from idfTables; selecting one jumps to the Manual editor.
    it('renders the Items column on the idf-derive page', () => {
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            idfTables: [{ id: 7, name: 'Table A' }, { id: 8, name: 'Table B' }]
        });
        const colOne = container.querySelector('#hydrology-list-detail-col-one');
        expect(colOne).toExist();
        // Each item row renders its label button (.sv-hydrology-item-button) plus a
        // trash delete button (.sv-hydrology-item-delete-btn).
        const itemButtons = container.querySelectorAll('#hydrology-list-detail-items #top-buttons .sv-hydrology-item-button');
        expect(itemButtons.length).toBe(2);
        const trashButtons = container.querySelectorAll('#hydrology-list-detail-items #top-buttons .sv-hydrology-item-delete-btn');
        expect(trashButtons.length).toBe(2);
        expect(colOne.textContent).toInclude('Table A');
        expect(colOne.textContent).toInclude('Table B');
    });

    it('selecting an item on the idf-derive page activates it and switches to the manual page', () => {
        let activatedItem = null;
        let switchedTo = null;
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            idfTables: [{ id: 7, name: 'Table A' }],
            setActiveHydrologyItem: (item) => { activatedItem = item; },
            setActiveHydrologyPage: (page) => { switchedTo = page; }
        });
        const itemButton = container.querySelector('#hydrology-list-detail-items #top-buttons .sv-hydrology-item-button');
        ReactTestUtils.act(() => {
            itemButton.click();
        });
        expect(activatedItem).toExist();
        expect(activatedItem.id).toBe(7);
        expect(switchedTo).toBe('sv-idf-table');
    });

    // Per-row trash button → inline ConfirmOverlay → deleteHydrologyItem.
    // On the Derive page the listed items are IDF tables, so the delete routes
    // to the 'sv-idf-table' page (not the literal 'idf-derive' active page).
    it('per-row trash button confirms then dispatches deleteHydrologyItem for the row', () => {
        let deleted = null;
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            idfTables: [{ id: 7, name: 'Table A' }, { id: 8, name: 'Table B' }],
            deleteHydrologyItem: (page, item) => { deleted = { page, item }; }
        });
        // Clicking trash on row 2 opens the confirm (no delete yet).
        const trashButtons = container.querySelectorAll('#top-buttons .sv-hydrology-item-delete-btn');
        expect(trashButtons.length).toBe(2);
        ReactTestUtils.act(() => { trashButtons[1].click(); });
        expect(deleted).toBe(null);
        const confirm = container.querySelector('.sv-hydrology-item-delete-confirm');
        expect(confirm).toExist();
        // Confirm → dispatch delete for item 8 against the sv-idf-table page.
        const confirmBtn = confirm.querySelector('.hydrology-delete-confirm-btn');
        expect(confirmBtn).toExist();
        ReactTestUtils.act(() => { confirmBtn.click(); });
        expect(deleted).toExist();
        expect(deleted.item.id).toBe(8);
        expect(deleted.page).toBe('sv-idf-table');
    });

    // TASK-1557 (W2) — the per-row delete affordance is MANAGER-gated. A
    // non-manager (canManageHydrology=false) sees the item rows but NO trash
    // button (the BE 403s them regardless; this hides the dead-end UI).
    it('hides the per-row trash button for a non-manager', () => {
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            idfTables: [{ id: 7, name: 'Table A' }, { id: 8, name: 'Table B' }],
            canManageHydrology: false
        });
        const itemButtons = container.querySelectorAll('#top-buttons .sv-hydrology-item-button');
        expect(itemButtons.length).toBe(2);
        const trashButtons = container.querySelectorAll('#top-buttons .sv-hydrology-item-delete-btn');
        expect(trashButtons.length).toBe(0);
    });

    // TASK-1557 (W2) — name-search filter narrows the rendered rows by a
    // case-insensitive substring; it is hidden until the search toggle opens it.
    it('filters the items list by a case-insensitive name substring', () => {
        renderWithProvider({
            activeHydrologyPage: 'idf-derive',
            idfTables: [{ id: 7, name: 'Alpha storm' }, { id: 8, name: 'Beta storm' }]
        });
        // Both rows render before any filter is applied.
        expect(container.querySelectorAll('#top-buttons .sv-hydrology-item-button').length).toBe(2);
        // Open the filter, type a query that matches only the second row.
        const toggle = container.querySelector('.sv-hydrology-filter-toggle');
        expect(toggle).toExist();
        ReactTestUtils.act(() => { toggle.click(); });
        const input = container.querySelector('.sv-hydrology-filter-input');
        expect(input).toExist();
        ReactTestUtils.act(() => {
            ReactTestUtils.Simulate.change(input, { target: { value: 'BETA' } });
        });
        const filtered = container.querySelectorAll('#top-buttons .sv-hydrology-item-button');
        expect(filtered.length).toBe(1);
        expect(filtered[0].textContent).toBe('Beta storm');
    });

    it('does NOT throw TypeError when setActiveHydrologyPage is provided (regression guard)', () => {
        // Regression guard: before the fix this threw
        // "TypeError: _this2.props.setActiveHydrologyPage is not a function"
        let thrown = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultProps}
                    activeHydrologyPage="sv-idf-table"
                    setActiveHydrologyPage={(page) => page}
                />,
                container
            );
        });

        try {
            ReactTestUtils.act(() => {
                const buttons = container.querySelectorAll('.sv-hydrology-idf-subtoggle button');
                buttons[1].click(); // IDF Derive
            });
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBe(null);
    });
});

// TASK-1509 — Save button disabled when the active custom temporal-pattern
// curve is invalid. Drives the CONNECTED container so mapStateToProps computes
// customCurveError from the store item (the realistic path after TASK-1508).
describe('TASK-1509 — Save disabled on invalid custom curve', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) { container.parentNode.removeChild(container); }
    });

    function makeStore(item) {
        const state = {
            hydrology: {
                activeHydrologyPage: 'temporal-pattern',
                activeHydrologyItem: item,
                temporalPatterns: [item],
                idfTables: [],
                idfDerive: { lat: null, lon: null }
            },
            anuga: { projects: { data: { id: 1 } } }
        };
        return createStore((s = state) => s, state);
    }

    function renderConnected(item) {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={makeStore(item)}>
                    <HydrologyListDetailContainer/>
                </Provider>,
                container
            );
        });
    }

    // Save is the last button in the footer (delete first, save last).
    function saveButton() {
        const footer = container.querySelector('#hydrology-list-detail-footer');
        const buttons = footer.querySelectorAll('button');
        return buttons[buttons.length - 1];
    }

    const invalidCustom = {
        id: 5, name: 'C', unsaved: true, pattern_type: 'custom',
        rowData: [{t: 0, cum: 0}, {t: 1, cum: 50}]  // last cum !== 100 → invalid
    };
    const validCustom = {
        id: 5, name: 'C', unsaved: true, pattern_type: 'custom',
        rowData: [{t: 0, cum: 0}, {t: 0.5, cum: 60}, {t: 1, cum: 100}]
    };

    it('disables Save (with tooltip) when the custom curve is invalid', () => {
        renderConnected(invalidCustom);
        const save = saveButton();
        expect(save.disabled).toBe(true);
        expect(save.getAttribute('title') || '').toInclude('Fix validation errors');
    });

    it('leaves Save enabled when the custom curve is valid and the item is unsaved', () => {
        renderConnected(validCustom);
        const save = saveButton();
        expect(save.disabled).toBe(false);
    });
});
