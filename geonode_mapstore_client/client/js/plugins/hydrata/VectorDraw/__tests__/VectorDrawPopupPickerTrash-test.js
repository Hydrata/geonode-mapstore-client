/*
 * TASK-784 picker-delete / TASK-1409 React confirm overlay.
 *
 * TASK-1409 replaced window.confirm in the picker trash handler with an
 * inline React confirm overlay (className sv-vector-draw-delete-confirm). The
 * overlay shows feature label + Delete/Cancel buttons:
 *   - Cancel (.btn-default or just bsStyle not danger) → no dispatch
 *   - Delete (.sv-vector-draw-delete-confirm-btn bsStyle=danger) → DELETE_FEATURE
 *
 * Asserts:
 *   1. Each existing-feature row renders a .glyphicon-trash icon.
 *   2. The "+ Add new" row does NOT render a trash icon.
 *   3. Clicking the trash icon stops propagation (does not fire onSelectFeature)
 *      and opens the inline confirm overlay.
 *   4. Clicking Delete in the overlay dispatches deleteFeature(featureId).
 *   5. Clicking Cancel in the overlay dispatches nothing.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup from '../components/VectorDrawPopup';
import { DELETE_FEATURE, SELECT_EXISTING_FEATURE } from '../actionsVectorDraw';

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
        config: { layerName: 'geonode:bdy_4_test', geomType: 'LineString' },
        featureList: [
            { id: 'bdy_4_test.1', properties: { description: 'Outflow A' } },
            { id: 'bdy_4_test.2', properties: { description: 'Outflow B' } }
        ],
        formValues: {}
    },
    draw: { tempFeatures: [], features: [] }
};

describe('TASK-784 / TASK-1409 VectorDrawPopup picker trash icon (React confirm overlay)', () => {
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

    it('renders a trash icon on each existing-feature row', () => {
        render();
        const popup = container.querySelector('.sv-vector-draw-popup');
        expect(popup).toExist();
        const trashes = popup.querySelectorAll('.glyphicon-trash');
        expect(trashes.length).toBe(2);
    });

    it('does NOT render a trash icon on the "+ Add new" row', () => {
        render();
        const popup = container.querySelector('.sv-vector-draw-popup');
        const rows = popup.querySelectorAll('.simple-view-panel-item-row');
        // First row is "+ Add new", rest are features.
        const addNewRow = rows[0];
        expect(addNewRow.textContent).toMatch(/Add new/);
        expect(addNewRow.querySelector('.glyphicon-trash')).toBe(null);
    });

    it('clicking the trash opens the inline confirm overlay (not DELETE yet)', () => {
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[1]; // bdy_4_test.2
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);
        // Overlay must appear.
        expect(container.querySelector('.sv-vector-draw-delete-confirm')).toExist();
        // No dispatch yet — user hasn't confirmed.
        expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toBe(undefined);
    });

    it('clicking the trash does NOT fire onSelectFeature (stopPropagation)', () => {
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[0];
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);
        // DELETE_FEATURE must NOT have fired yet, and SELECT_EXISTING_FEATURE must not either.
        expect(dispatched.find(a => a && a.type === SELECT_EXISTING_FEATURE)).toBe(undefined);
    });

    it('clicking Delete in the overlay dispatches DELETE_FEATURE with the feature id', () => {
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[1]; // bdy_4_test.2
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);

        // Now click Delete in the overlay.
        const deleteBtn = container.querySelector('.sv-vector-draw-delete-confirm-btn');
        expect(deleteBtn).toExist();
        deleteBtn.click();

        const del = dispatched.find(a => a && a.type === DELETE_FEATURE);
        expect(del).toExist();
        expect(del.featureId).toBe('bdy_4_test.2');
    });

    it('clicking Cancel in the overlay dispatches NOTHING', () => {
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[0];
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);

        // Find Cancel button (not the Delete button).
        const overlay = container.querySelector('.sv-vector-draw-delete-confirm');
        expect(overlay).toExist();
        const buttons = overlay.querySelectorAll('button');
        const cancelBtn = Array.from(buttons).find(b => /^cancel$/i.test(b.textContent));
        expect(cancelBtn).toExist();
        cancelBtn.click();

        expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toBe(undefined);
        // And the row's onSelectFeature must ALSO not fire.
        expect(dispatched.find(a => a && a.type === SELECT_EXISTING_FEATURE)).toBe(undefined);
    });

    // TASK-795 review I3 — in-flight feedback. Pre-fix, the trash icon
    // looked the same regardless of whether a delete was already in flight,
    // so a user could double-click and trigger a second WFS-T DELETE that
    // would 404 (the row was already gone after the first delete) and
    // surface as "Failed to delete feature: ..." on what was actually a
    // successful delete.
    describe('in-flight feedback (deletingFeatureId)', () => {
        const STATE_WITH_DELETE_IN_FLIGHT = {
            vectorDraw: {
                ...PICKER_STATE.vectorDraw,
                deletingFeatureId: 'bdy_4_test.2'  // 2nd row mid-delete
            },
            draw: { tempFeatures: [], features: [] }
        };

        it('dims the trash icon for the row being deleted (opacity 0.3)', () => {
            render(STATE_WITH_DELETE_IN_FLIGHT);
            const trashes = container.querySelectorAll('.glyphicon-trash');
            // First trash (bdy_4_test.1) is not deleting → 0.7
            expect(trashes[0].style.opacity).toBe('0.7');
            // Second trash (bdy_4_test.2) IS deleting → 0.3
            expect(trashes[1].style.opacity).toBe('0.3');
        });

        it('disables pointer events on the in-flight trash so a double-click is a no-op', () => {
            render(STATE_WITH_DELETE_IN_FLIGHT);
            const trash = container.querySelectorAll('.glyphicon-trash')[1];
            // pointerEvents:'none' is the primary defence.
            expect(trash.style.pointerEvents).toBe('none');
            expect(trash.style.cursor).toBe('wait');
            // And as defence in depth, the onClick handler is undefined too.
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
            trash.dispatchEvent(evt);
            // No overlay should open either (onClick is undefined).
            expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toBe(undefined);
        });

        it('rows that are NOT being deleted remain clickable (open confirm overlay)', () => {
            render(STATE_WITH_DELETE_IN_FLIGHT);
            // Click trash on row 1 (NOT mid-delete) — should open overlay.
            const trash = container.querySelectorAll('.glyphicon-trash')[0];
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
            trash.dispatchEvent(evt);
            // Overlay appears for row 1.
            expect(container.querySelector('.sv-vector-draw-delete-confirm')).toExist();
        });

        it('updates the trash title to "Deleting..." mid-flight for clarity', () => {
            render(STATE_WITH_DELETE_IN_FLIGHT);
            const trashes = container.querySelectorAll('.glyphicon-trash');
            expect(trashes[0].title).toBe('Delete this feature');
            expect(trashes[1].title).toBe('Deleting...');
        });
    });
});
