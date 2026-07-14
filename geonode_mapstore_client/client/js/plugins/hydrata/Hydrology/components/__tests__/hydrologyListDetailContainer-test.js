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
// UAT 2026-07-02 — real TimeSeries class for the create-mode footer tests (the
// draft must carry the temp-… id + rowData/columnDefs the create panel reads).
// TASK-2119 — real IdfTable class for the Source/Description placeholder tests.
import { TimeSeries, IdfTable } from '../../classesHydrology';

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

    // TASK-2126 — "Derive" is gated ("Coming soon") for the bundled launch: the
    // segment is disabled with a badge and clicking it no longer switches to
    // idf-derive. (Re-enable by flipping LAUNCH_GATES.idfDerive.)
    it('the "IDF Derive" button is disabled and does not call setActiveHydrologyPage', () => {
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
        expect(buttons[1].disabled).toBe(true);
        expect(buttons[1].querySelector('.sv-coming-soon-badge')).toExist();
        ReactTestUtils.act(() => {
            buttons[1].click();
        });
        expect(calledWith).toBe(null);
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

// TASK-1986 — Hydrographs CRUD panel reuses Design Storms container,
// filtered to series_type=hydrograph via a separate hydrographs state slice.
describe('TASK-1986 — Hydrographs CRUD panel', () => {
    let container;

    const noop = () => {};

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) { container.parentNode.removeChild(container); }
    });

    // Test 1 — the connected container reads from state.hydrology.hydrographs (not
    // state.hydrology.timeSeriess) when activeHydrologyPage='hydrographs'.
    // This asserts the series_type=hydrograph LIST FILTER: the panel shows only
    // hydrograph rows (state.hydrographs), not the full timeSeriess list.
    it('hydrographs page reads from the hydrographs state slice, not timeSeriess', () => {
        const hydrographItems = [
            { id: 101, name: 'Flow A', series_type: 'hydrograph' },
            { id: 102, name: 'Flow B', series_type: 'hydrograph' }
        ];
        const timeSeriesItems = [
            { id: 1, name: 'Design Storm X', series_type: 'hyetograph' }
        ];
        const state = {
            hydrology: {
                activeHydrologyPage: 'hydrographs',
                activeHydrologyItem: null,
                hydrographs: hydrographItems,
                timeSeriess: timeSeriesItems,
                idfTables: [],
                idfDerive: {
                    celeryAnugaEnabled: true, lat: null, lon: null,
                    durationsText: '', rpsText: '', mapPickActive: false,
                    inFlight: false, error: null, result: null
                }
            },
            anuga: { projects: { data: { id: 1 } } }
        };
        const store = createStore((s = state) => s, state);
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}><HydrologyListDetailContainer /></Provider>,
                container
            );
        });
        const itemBtns = container.querySelectorAll(
            '#hydrology-list-detail-items #top-buttons .sv-hydrology-item-button'
        );
        // Must show 2 hydrograph items, NOT the design-storm item
        expect(itemBtns.length).toBe(2);
        expect(container.textContent).toInclude('Flow A');
        expect(container.textContent).toInclude('Flow B');
        expect(container.textContent).toNotInclude('Design Storm X');
    });

    // Test 2 — CREATE_HYDROLOGY_FORM dispatched for the 'hydrographs' page must
    // create a TimeSeries instance with series_type='hydrograph' (not the BE
    // default 'hyetograph'). This asserts the CREATE STAMP AC.
    it('CREATE_HYDROLOGY_FORM on hydrographs page stamps series_type=hydrograph on the new item', () => {
        // Import the live reducer to test the state transition directly.
        // (path: components/__tests__/ → ../../ = Hydrology/)
        const hydrologyReducer = require('../../reducersHydrology').default;
        const { CREATE_HYDROLOGY_FORM } = require('../../actionsHydrology');
        const before = { hydrographs: [], timeSeriess: [] };
        const action = { type: CREATE_HYDROLOGY_FORM, activeHydrologyPage: 'hydrographs', autoNameLabel: undefined };
        const after = hydrologyReducer(before, action);
        expect(after.hydrographs.length).toBe(1);
        expect(after.hydrographs[0].series_type).toBe('hydrograph');
        // The item must NOT appear in the Design Storms list
        expect(after.timeSeriess.length).toBe(0);
    });

    // Test 3 — clicking New Item on the hydrographs page dispatches
    // createHydrologyForm with page='hydrographs', and the component enters
    // tsCreateMode (mirrors the Design Storms New Item path).
    it('clicking New Item on hydrographs page dispatches createHydrologyForm and enters create mode', () => {
        let createFormCalledWith = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    activeHydrologyPage="hydrographs"
                    activeHydrologyItems={[]}
                    activeHydrologyItem={null}
                    setActiveHydrologyItem={noop}
                    setActiveHydrologyPage={noop}
                    updateActiveHydrologyItem={noop}
                    saveHydrologyItem={noop}
                    createHydrologyForm={(page) => { createFormCalledWith = page; }}
                    deleteHydrologyItem={noop}
                    canManageHydrology
                />,
                container
            );
        });
        const newItemBtn = container.querySelector('#bottom-buttons .sv-hydrology-button');
        expect(newItemBtn).toExist();
        ReactTestUtils.act(() => { newItemBtn.click(); });
        expect(createFormCalledWith).toBe('hydrographs');
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

// UAT 2026-07-02 — footer Save/Delete visibility. Save is the SOLE dispatcher
// of saveHydrologyItem (the only PATCH/POST path for every editor this
// container hosts — grid/curve/text edits all merely mark Redux `unsaved`),
// so it must stay wherever an item is being edited. The footer is hidden only
// where both buttons are no-ops/footguns:
//   • no active item (Save would POST undefined; Delete would TypeError in
//     the delete epic);
//   • the Design-Storms Create panel Derive tab, whose own "Derive & Save"
//     button persists via saveDesignStormsRequest (a footer Save there would
//     POST the empty draft as a junk row).
// Delete is additionally hidden for a never-persisted temp-id draft (nothing
// on the BE to DELETE — the request could only 404).
describe('UAT 2026-07-02 — footer Save/Delete visibility', () => {
    let container;
    const noop = () => {};

    const baseProps = {
        activeHydrologyItems: [],
        setActiveHydrologyItem: noop,
        setActiveHydrologyPage: noop,
        updateActiveHydrologyItem: noop,
        saveHydrologyItem: noop,
        createHydrologyForm: noop,
        deleteHydrologyItem: noop,
        canManageHydrology: true
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) { container.parentNode.removeChild(container); }
    });

    // Store for renders whose detail children are connected components. The
    // manager role turns canManageAnugaMap → canManageHydrology ON for the
    // connected-container cases.
    function makeStore(hydrologyExtra = {}) {
        const state = {
            hydrology: {
                activeHydrologyPage: 'time-series',
                activeHydrologyItem: null,
                timeSeriess: [],
                hydrographs: [],
                idfTables: [],
                temporalPatterns: [],
                idfDerive: { lat: null, lon: null },
                ...hydrologyExtra
            },
            anuga: { projects: { data: { id: 1, my_role: 'manager' } } }
        };
        return createStore((s = state) => s, state);
    }

    function renderConnected(item) {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={makeStore({
                    activeHydrologyPage: 'temporal-pattern',
                    activeHydrologyItem: item,
                    temporalPatterns: [item]
                })}>
                    <HydrologyListDetailContainer/>
                </Provider>,
                container
            );
        });
    }

    // A valid custom temporal pattern (mirrors the TASK-1509 fixtures) so the
    // connected render's customCurveError stays null; only the id varies.
    const patternItem = (id) => ({
        id, name: 'C', unsaved: true, pattern_type: 'custom',
        rowData: [{t: 0, cum: 0}, {t: 0.5, cum: 60}, {t: 1, cum: 100}]
    });

    it('hides the footer entirely when no item is selected', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...baseProps}
                    activeHydrologyPage="temporal-pattern"
                    activeHydrologyItem={null}
                />,
                container
            );
        });
        // "Select an item" placeholder renders; no Save/Delete to act on.
        expect(container.querySelector('#hydrology-detail-container')).toExist();
        expect(container.querySelector('#hydrology-list-detail-footer')).toNotExist();
    });

    it('shows Delete + Save for a PERSISTED active item (manager)', () => {
        renderConnected(patternItem(5));
        const footer = container.querySelector('#hydrology-list-detail-footer');
        expect(footer).toExist();
        const buttons = footer.querySelectorAll('button');
        expect(buttons.length).toBe(2);
        // Delete first (red), Save last (green) — assert via the inline tokens.
        expect(buttons[0].style.backgroundColor).toInclude('glyph-delete');
        expect(buttons[1].style.backgroundColor).toInclude('accent-green');
    });

    it('hides Delete (keeps Save) for a never-persisted temp-id item', () => {
        renderConnected(patternItem('temp-abc123'));
        const footer = container.querySelector('#hydrology-list-detail-footer');
        expect(footer).toExist();
        const buttons = footer.querySelectorAll('button');
        // Save only — a temp-… draft has no BE row to DELETE.
        expect(buttons.length).toBe(1);
        expect(buttons[0].style.backgroundColor).toInclude('accent-green');
    });

    it('Design-Storms Create panel: Input tab keeps Save (the POST path); Derive tab hides the footer', () => {
        const draft = new TimeSeries();
        // CREATE_HYDROLOGY_FORM stamps unsaved=true on every new draft
        // (reducersHydrology) — mirror it so Save renders its enabled style.
        draft.unsaved = true;
        let instance = null;
        const store = makeStore({ activeHydrologyItem: draft });
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        ref={(el) => { instance = el; }}
                        {...baseProps}
                        activeHydrologyPage="time-series"
                        activeHydrologyItem={draft}
                    />
                </Provider>,
                container
            );
        });
        // Input tab: the footer Save is the draft's ONLY persistence (POST)
        // path — it must stay; Delete is hidden (temp-id draft).
        ReactTestUtils.act(() => { instance.setState({ tsCreateMode: true, tsCreateTab: 'input' }); });
        let footer = container.querySelector('#hydrology-list-detail-footer');
        expect(footer).toExist();
        expect(footer.querySelectorAll('button').length).toBe(1);
        expect(footer.querySelectorAll('button')[0].style.backgroundColor).toInclude('accent-green');
        // Derive tab: persistence is the Derive flow's own "Derive & Save"
        // button — the footer disappears entirely.
        ReactTestUtils.act(() => { instance.setState({ tsCreateTab: 'derive' }); });
        expect(container.querySelector('#design-storm-create-panel')).toExist();
        expect(container.querySelector('#hydrology-list-detail-footer')).toNotExist();
    });

    it('Hydrographs create mode keeps the footer even with a stale derive tab (page-scoped conditional)', () => {
        const draft = new TimeSeries();
        draft.series_type = 'hydrograph';
        draft.unsaved = true; // mirrors CREATE_HYDROLOGY_FORM
        let instance = null;
        const store = makeStore({
            activeHydrologyPage: 'hydrographs',
            activeHydrologyItem: draft
        });
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        ref={(el) => { instance = el; }}
                        {...baseProps}
                        activeHydrologyPage="hydrographs"
                        activeHydrologyItem={draft}
                    />
                </Provider>,
                container
            );
        });
        // hideDerive forces the Input tab on the Hydrographs page, so even a
        // (theoretically) stale tsCreateTab='derive' must NOT hide the footer
        // Save — it is the hydrograph draft's only POST path.
        ReactTestUtils.act(() => { instance.setState({ tsCreateMode: true, tsCreateTab: 'derive' }); });
        const footer = container.querySelector('#hydrology-list-detail-footer');
        expect(footer).toExist();
        expect(footer.querySelectorAll('button').length).toBe(1);
    });
});

describe('TASK-2119 (F3-FE) — IDF Source/Description real placeholders', () => {
    let container;
    const noop = () => {};

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) { container.parentNode.removeChild(container); }
    });

    // Mirrors the "UAT 2026-07-02" describe block's makeStore — the
    // sv-idf-table page renders the CONNECTED HydrologyDetailIdfTable child,
    // which reads state.hydrology.activeHydrologyItem directly.
    function makeStore(item) {
        const state = {
            hydrology: {
                activeHydrologyPage: 'sv-idf-table',
                activeHydrologyItem: item,
                idfTables: [item],
                idfDerive: { lat: null, lon: null }
            },
            anuga: { projects: { data: { id: 1, my_role: 'manager' } } }
        };
        return createStore((s = state) => s, state);
    }

    // AC1 — a new IDF table's Source/Description fields render empty with
    // visible placeholder text (not a persisted literal default).
    it('a new IDF table renders empty Source/Description fields with placeholder text', () => {
        const item = new IdfTable();
        expect(item.source).toBe('');
        expect(item.description).toBe('');

        const store = makeStore(item);
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        activeHydrologyPage="sv-idf-table"
                        activeHydrologyItems={[item]}
                        activeHydrologyItem={item}
                        setActiveHydrologyItem={noop}
                        setActiveHydrologyPage={noop}
                        updateActiveHydrologyItem={noop}
                        saveHydrologyItem={noop}
                        createHydrologyForm={noop}
                        deleteHydrologyItem={noop}
                        canManageHydrology
                    />
                </Provider>,
                container
            );
        });

        const sourceInput = container.querySelector('input#source');
        const descriptionTextarea = container.querySelector('textarea#description');
        expect(sourceInput).toExist();
        expect(descriptionTextarea).toExist();
        expect(sourceInput.value).toBe('');
        expect(descriptionTextarea.value).toBe('');
        // No IntlProvider in this render → resolveMsg's getMessageById(...)
        // returns the msgId unchanged (missing), so it falls through to the
        // English fallback text supplied at the call site — the SAME text a
        // real (translated) render would show, mirroring the pre-existing
        // filterPlaceholder resolveMsg idiom in this file (never a raw msgId
        // leaking to the placeholder, unlike a bare <Message> component).
        expect(sourceInput.getAttribute('placeholder')).toBe('Enter source');
        expect(descriptionTextarea.getAttribute('placeholder')).toBe('Enter description');
    });

    // AC2 — the source input carries a maxLength FE guard mirroring the BE
    // source_key CharField(max_length=64) (serializers_v2.py).
    it('the source input enforces a 64-char maxLength FE guard', () => {
        const item = new IdfTable();
        const store = makeStore(item);
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        activeHydrologyPage="sv-idf-table"
                        activeHydrologyItems={[item]}
                        activeHydrologyItem={item}
                        setActiveHydrologyItem={noop}
                        setActiveHydrologyPage={noop}
                        updateActiveHydrologyItem={noop}
                        saveHydrologyItem={noop}
                        createHydrologyForm={noop}
                        deleteHydrologyItem={noop}
                        canManageHydrology
                    />
                </Provider>,
                container
            );
        });
        const sourceInput = container.querySelector('input#source');
        expect(sourceInput.getAttribute('maxlength')).toBe('64');
    });

    // AC4 — no literal "Enter source"/"Enter description" values reach the
    // save payload: typing into either field dispatches ONLY the typed text,
    // never the old literal defaults.
    it('typing into Source/Description dispatches ONLY the typed text via updateActiveHydrologyItem (no literal defaults)', () => {
        const item = new IdfTable();
        const calls = [];
        const store = makeStore(item);
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        activeHydrologyPage="sv-idf-table"
                        activeHydrologyItems={[item]}
                        activeHydrologyItem={item}
                        setActiveHydrologyItem={noop}
                        setActiveHydrologyPage={noop}
                        updateActiveHydrologyItem={(page, it, kv) => calls.push({page, it, kv})}
                        saveHydrologyItem={noop}
                        createHydrologyForm={noop}
                        deleteHydrologyItem={noop}
                        canManageHydrology
                    />
                </Provider>,
                container
            );
        });
        const sourceInput = container.querySelector('input#source');
        const descriptionTextarea = container.querySelector('textarea#description');
        // NOTE: the `target` override in Simulate's eventData REPLACES the
        // whole target object (it does not merge onto the real node), so
        // `id` must be supplied explicitly here — handleTextChange keys its
        // dispatch off `e.target.id`.
        ReactTestUtils.act(() => {
            ReactTestUtils.Simulate.change(sourceInput, { target: { id: 'source', value: 'BOM Rainfall IFD 2016' } });
        });
        ReactTestUtils.act(() => {
            ReactTestUtils.Simulate.change(descriptionTextarea, { target: { id: 'description', value: 'Zone IDFC-2, 100yr' } });
        });
        expect(calls.length).toBe(2);
        expect(calls[0].kv).toEqual({ source: 'BOM Rainfall IFD 2016' });
        expect(calls[1].kv).toEqual({ description: 'Zone IDFC-2, 100yr' });
        calls.forEach(c => {
            expect(Object.values(c.kv)).toNotInclude('Enter source');
            expect(Object.values(c.kv)).toNotInclude('Enter description');
        });
    });

    // Regression guard: a fresh IdfTable never carries the old literal
    // defaults, confirming classesHydrology.js's constructor change.
    it('a fresh IdfTable never carries the literal "Enter source"/"Enter description" defaults', () => {
        const item = new IdfTable();
        expect(item.source).toNotBe('Enter source');
        expect(item.description).toNotBe('Enter description');
        expect(item.source).toBe('');
        expect(item.description).toBe('');
    });
});
