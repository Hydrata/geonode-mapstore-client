/*
 * TASK-784 picker-delete — trash icon on each picker row.
 *
 * Asserts:
 *   1. Each existing-feature row renders a .glyphicon-trash icon.
 *   2. The "+ Add new" row does NOT render a trash icon.
 *   3. Clicking the trash icon stops propagation (does not also trigger
 *      the row's onSelectFeature) and dispatches deleteFeature(featureId)
 *      after the user confirms.
 *   4. If the user cancels the confirm dialog, no action is dispatched.
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

describe('TASK-784 VectorDrawPopup picker trash icon', () => {
    let container;
    let dispatched;
    let originalConfirm;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        dispatched = [];
        originalConfirm = window.confirm;
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
        window.confirm = originalConfirm;
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
        const popup = container.querySelector('.vector-draw-popup');
        expect(popup).toExist();
        const trashes = popup.querySelectorAll('.glyphicon-trash');
        expect(trashes.length).toBe(2);
    });

    it('does NOT render a trash icon on the "+ Add new" row', () => {
        render();
        const popup = container.querySelector('.vector-draw-popup');
        const rows = popup.querySelectorAll('.simple-view-panel-item-row');
        // First row is "+ Add new", rest are features.
        const addNewRow = rows[0];
        expect(addNewRow.textContent).toMatch(/Add new/);
        expect(addNewRow.querySelector('.glyphicon-trash')).toBe(null);
    });

    it('clicking the trash with confirm=YES dispatches DELETE_FEATURE with the feature id', () => {
        window.confirm = () => true;
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[1]; // bdy_4_test.2
        // Synthesise a real MouseEvent so React's synthetic-event pipeline
        // also fires e.stopPropagation correctly.
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);

        const del = dispatched.find(a => a && a.type === DELETE_FEATURE);
        expect(del).toExist();
        expect(del.featureId).toBe('bdy_4_test.2');
    });

    it('clicking the trash with confirm=NO dispatches NOTHING', () => {
        window.confirm = () => false;
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[0];
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);

        expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toBe(undefined);
        // And critically, the row's onSelectFeature must ALSO not fire — the
        // trash handler must e.stopPropagation() before the row's onClick
        // bubbles up. Otherwise cancelling the confirm would still navigate
        // into the edit flow for that feature.
        expect(dispatched.find(a => a && a.type === SELECT_EXISTING_FEATURE)).toBe(undefined);
    });

    it('clicking the trash with confirm=YES does NOT also fire row onSelectFeature (stopPropagation)', () => {
        window.confirm = () => true;
        render();
        const trash = container.querySelectorAll('.glyphicon-trash')[0];
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        trash.dispatchEvent(evt);

        // DELETE_FEATURE fires; SELECT_EXISTING_FEATURE must NOT.
        expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toExist();
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
            window.confirm = () => true;
            render(STATE_WITH_DELETE_IN_FLIGHT);
            const trash = container.querySelectorAll('.glyphicon-trash')[1];
            // pointerEvents:'none' is the primary defence — the click never
            // reaches the JS handler because the browser stops it at CSS.
            expect(trash.style.pointerEvents).toBe('none');
            expect(trash.style.cursor).toBe('wait');
            // And as defence in depth, the onClick handler is undefined too,
            // so even if pointer-events somehow gets bypassed (synthetic
            // event, test harness, etc.) no DELETE_FEATURE is dispatched.
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
            trash.dispatchEvent(evt);
            expect(dispatched.find(a => a && a.type === DELETE_FEATURE)).toBe(undefined);
        });

        it('rows that are NOT being deleted remain clickable', () => {
            window.confirm = () => true;
            render(STATE_WITH_DELETE_IN_FLIGHT);
            // Click trash on row 1 (NOT mid-delete) — should still dispatch.
            const trash = container.querySelectorAll('.glyphicon-trash')[0];
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
            trash.dispatchEvent(evt);
            const del = dispatched.find(a => a && a.type === DELETE_FEATURE);
            expect(del).toExist();
            expect(del.featureId).toBe('bdy_4_test.1');
        });

        it('updates the trash title to "Deleting..." mid-flight for clarity', () => {
            render(STATE_WITH_DELETE_IN_FLIGHT);
            const trashes = container.querySelectorAll('.glyphicon-trash');
            expect(trashes[0].title).toBe('Delete this feature');
            expect(trashes[1].title).toBe('Deleting...');
        });
    });
});
