/*
 * TASK-2215 (W5.1, epic 2204) — row-level "edit properties" affordance.
 *
 * Dogfood 07-09 finding: a fresh user cannot discover that feature data
 * (Inflow Constant<->Hydrograph, Rainfall kind, etc.) is edited via
 * map-click->disambiguation; the picker row was clickable but had no
 * LABELLED affordance signalling "this opens edit". The row already
 * dispatched onSelectFeature(feature.id) -> SELECT_EXISTING_FEATURE ->
 * vectorDrawSelectExistingEpic -> the SAME describe/loadFeature/
 * seedFormValues/inline-form flow anugaClickTargets.js's map-click EDIT
 * branch feeds (see that file's docstring: "exactly what the existing
 * pick->edit path passes") — this task adds an explicit, recognisable
 * pencil icon that fires the IDENTICAL dispatch, mirroring the trash
 * icon's own TASK-1409 pattern.
 *
 * Mirrors VectorDrawPopupPickerTrash-test.js's store/render harness.
 *
 * Asserts:
 *   1. Each existing-feature row renders a .glyphicon-pencil.sv-vector-draw-edit-properties icon.
 *   2. The "+ Add new" row does NOT render the edit-properties icon.
 *   3. Clicking the pencil dispatches SELECT_EXISTING_FEATURE with that row's featureId.
 *   4. Clicking the pencil dispatches SELECT_EXISTING_FEATURE exactly ONCE (stopPropagation
 *      — no duplicate dispatch from the row's own onClick bubbling through).
 *   5. The row's own onClick (map-click path proxy / whole-row click) is UNCHANGED —
 *      clicking the row body (not the pencil) still dispatches SELECT_EXISTING_FEATURE too.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup from '../components/VectorDrawPopup';
import { SELECT_EXISTING_FEATURE } from '../actionsVectorDraw';

function makeStore(state, dispatched) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => { dispatched.push(a); }
    };
}

const PICKER_STATE = {
    vectorDraw: {
        phase: 'picking',
        config: { layerName: 'geonode:inf_4_test', geomType: 'LineString' },
        featureList: [
            { id: 'inf_4_test.1', properties: { description: 'Inflow A' } },
            { id: 'inf_4_test.2', properties: { description: 'Inflow B' } }
        ],
        formValues: {}
    },
    draw: { tempFeatures: [], features: [] }
};

describe('TASK-2215 VectorDrawPopup picker "edit properties" pencil', () => {
    let container;
    let dispatched;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        dispatched = [];
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    const render = (state = PICKER_STATE) => {
        ReactDOM.render(
            <Provider store={makeStore(state, dispatched)}>
                <VectorDrawPopup />
            </Provider>,
            container
        );
    };

    it('renders an edit-properties pencil icon on each existing-feature row', () => {
        render();
        const popup = container.querySelector('.sv-vector-draw-popup');
        expect(popup).toExist();
        const pencils = popup.querySelectorAll('.sv-vector-draw-edit-properties');
        expect(pencils.length).toBe(2);
        pencils.forEach(p => expect(p.className).toMatch(/glyphicon-pencil/));
    });

    it('does NOT render the edit-properties icon on the "+ Add new" row', () => {
        render();
        const popup = container.querySelector('.sv-vector-draw-popup');
        const rows = popup.querySelectorAll('.simple-view-panel-item-row');
        const addNewRow = rows[0];
        expect(addNewRow.textContent).toMatch(/Add new/);
        expect(addNewRow.querySelector('.sv-vector-draw-edit-properties')).toBe(null);
    });

    it('clicking the pencil opens the SAME attribute-edit form the map-click path opens (SELECT_EXISTING_FEATURE with that row\'s id)', () => {
        render();
        const pencil = container.querySelectorAll('.sv-vector-draw-edit-properties')[1]; // inf_4_test.2
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        pencil.dispatchEvent(evt);

        const selects = dispatched.filter(a => a && a.type === SELECT_EXISTING_FEATURE);
        expect(selects.length).toBe(1);
        expect(selects[0].featureId).toBe('inf_4_test.2');
    });

    it('clicking the pencil dispatches exactly ONCE (stopPropagation — no duplicate from the row\'s own onClick)', () => {
        render();
        const pencil = container.querySelectorAll('.sv-vector-draw-edit-properties')[0];
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        pencil.dispatchEvent(evt);

        const selects = dispatched.filter(a => a && a.type === SELECT_EXISTING_FEATURE);
        expect(selects.length).toBe(1);
    });

    it('AC#2 — the row body click (whole-row / map-click-proxy path) is UNCHANGED: still dispatches SELECT_EXISTING_FEATURE', () => {
        render();
        const rows = container.querySelectorAll('.simple-view-panel-item-row');
        // rows[0] is "+ Add new"; rows[1] is inf_4_test.1.
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        rows[1].dispatchEvent(evt);

        const selects = dispatched.filter(a => a && a.type === SELECT_EXISTING_FEATURE);
        expect(selects.length).toBe(1);
        expect(selects[0].featureId).toBe('inf_4_test.1');
    });
});
