/*
 * TASK-795 review I8 / TASK-1409 — Cancel discard-warning confirm.
 *
 * TASK-1409 updated the confirm from blocking window.confirm to an async
 * React inline overlay. The overlay renders two buttons:
 *   - "Keep editing" (className sv-vector-draw-discard-cancel-btn) → no-op
 *   - "Discard"      (className sv-vector-draw-discard-confirm-btn) → dispatches CANCEL_VECTOR_DRAW
 *
 * Pinned behaviour:
 *   1. formValuesAreDirty() pure helper — JSON-shape comparison.
 *   2. Cancel without unsaved changes: NO overlay shown, fires onCancel.
 *   3. Cancel with form-value diff: overlay shown; "Discard" → cancel; "Keep editing" → no-op.
 *   4. Cancel with geometry drawn (CREATE mode draw started): overlay shown.
 *   5. Cancel with vertex moved (EDIT mode tempFeatures populated): overlay shown.
 *   6. Picker-phase Cancel (no active edit) does NOT warn.
 *   7. Error-phase Close button does NOT warn (just closing the error toast).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup, { formValuesAreDirty } from '../components/VectorDrawPopup';
import { CANCEL_VECTOR_DRAW } from '../actionsVectorDraw';

function makeStore(state, dispatched) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => { dispatched.push(a); }
    };
}

describe('TASK-795 review I8 formValuesAreDirty', () => {
    it('returns false for identical bags', () => {
        expect(formValuesAreDirty({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(false);
    });

    it('returns true when a value differs', () => {
        expect(formValuesAreDirty({ a: 1 }, { a: 2 })).toBe(true);
    });

    it('returns true when a key was added', () => {
        expect(formValuesAreDirty({ a: 1, b: 2 }, { a: 1 })).toBe(true);
    });

    it('returns true when a key was removed', () => {
        expect(formValuesAreDirty({ a: 1 }, { a: 1, b: 2 })).toBe(true);
    });

    it('handles null/undefined as empty bags', () => {
        expect(formValuesAreDirty(null, undefined)).toBe(false);
        expect(formValuesAreDirty(undefined, {})).toBe(false);
        expect(formValuesAreDirty({ a: 1 }, null)).toBe(true);
    });

    it('compares structured nested values (data.constant change)', () => {
        const a = { boundary: 'Time', data: { kind: 'constant', constant: 5 } };
        const b = { boundary: 'Time', data: { kind: 'constant', constant: 7 } };
        expect(formValuesAreDirty(a, b)).toBe(true);
    });
});

describe('TASK-795 review I8 / TASK-1409 popup Cancel discard-confirm wiring (React overlay)', () => {
    let container;
    let dispatched;

    const baseFormConfig = {
        title: 'Boundary',
        fields: [
            { name: 'description', type: 'text' },
            { name: 'boundary', type: 'select', "default": 'Reflective' }
        ]
    };

    const FORM_CLEAN = {
        vectorDraw: {
            phase: 'form',
            config: {
                layerName: 'geonode:bdy_4_test',
                geomType: 'LineString',
                formConfig: baseFormConfig
            },
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
            // Live values match snapshot → not dirty.
            formValues: { boundary: 'Reflective', description: 'X' },
            initialFormValues: { boundary: 'Reflective', description: 'X' }
        },
        draw: { tempFeatures: [], features: [] }
    };

    const FORM_DIRTY_FIELD = {
        ...FORM_CLEAN,
        vectorDraw: {
            ...FORM_CLEAN.vectorDraw,
            // User typed in the description field after seed.
            formValues: { boundary: 'Reflective', description: 'X then more' },
            initialFormValues: { boundary: 'Reflective', description: 'X' }
        }
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        dispatched = [];
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    const render = (state) => {
        ReactDOM.render(
            <Provider store={makeStore(state, dispatched)}>
                <VectorDrawPopup />
            </Provider>,
            container
        );
    };

    const clickCancelButton = () => {
        const buttons = container.querySelectorAll('button');
        const cancelBtn = Array.from(buttons).find(b => /^cancel$/i.test(b.textContent));
        expect(cancelBtn).toExist();
        cancelBtn.click();
    };

    const clickHeaderX = () => {
        // TASK-1763 — the header close is now PanelHeader's cascade-safe
        // .sv-panel-header-close chip (was the bespoke .glyphicon-remove span).
        const x = container.querySelector('.sv-panel-header-close');
        expect(x).toExist();
        x.click();
    };

    const clickDiscardButton = () => {
        const btn = container.querySelector('.sv-vector-draw-discard-confirm-btn');
        expect(btn).toExist();
        btn.click();
    };

    const clickKeepEditingButton = () => {
        const btn = container.querySelector('.sv-vector-draw-discard-cancel-btn');
        expect(btn).toExist();
        btn.click();
    };

    it('clean form Cancel: NO overlay shown, dispatches CANCEL_VECTOR_DRAW immediately', () => {
        render(FORM_CLEAN);
        clickCancelButton();
        // Overlay must NOT be present — clean form needs no confirmation.
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toBe(null);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('dirty form Cancel: overlay shown, CANCEL_VECTOR_DRAW NOT yet dispatched', () => {
        render(FORM_DIRTY_FIELD);
        clickCancelButton();
        // Overlay is now visible.
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toExist();
        // Action must NOT be dispatched until the user confirms.
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('dirty form Cancel + click Discard: dispatches CANCEL_VECTOR_DRAW', () => {
        render(FORM_DIRTY_FIELD);
        clickCancelButton();
        clickDiscardButton();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('dirty form Cancel + click Keep editing: no dispatch, overlay dismissed', () => {
        render(FORM_DIRTY_FIELD);
        clickCancelButton();
        clickKeepEditingButton();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
        // Overlay dismissed after clicking Keep editing.
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toBe(null);
    });

    it('header X on dirty form: same overlay path as the Cancel button', () => {
        render(FORM_DIRTY_FIELD);
        clickHeaderX();
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toExist();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
        // Confirm Discard → fires the cancel action.
        clickDiscardButton();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('drawing-phase Cancel with tempFeatures populated (vertex dragged): overlay shown', () => {
        // EDIT mode draws populate tempFeatures with the in-progress edit.
        // formValues match seed (user only moved a vertex, didn't type),
        // so the form-diff path is clean — but draw is dirty.
        render({
            vectorDraw: {
                phase: 'drawing',
                config: {
                    layerName: 'geonode:bdy_4_test',
                    geomType: 'LineString',
                    featureId: 'bdy_4_test.5'  // EDIT mode
                },
                formValues: {},
                initialFormValues: {}
            },
            draw: {
                tempFeatures: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [9, 9]] } }],
                features: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }]
            }
        });
        clickCancelButton();
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toExist();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('drawing-phase Cancel after CREATE-mode draw started (drawFeatures with geometry): overlay shown', () => {
        // CREATE mode: geometry drawn, no featureId.
        render({
            vectorDraw: {
                phase: 'drawing',
                config: { layerName: 'geonode:bdy_4_test', geomType: 'LineString' },
                formValues: {},
                initialFormValues: {}
            },
            draw: {
                tempFeatures: [],
                features: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }]
            }
        });
        clickCancelButton();
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toExist();
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('picker-phase header X: NO overlay (no active edit, just closing the picker)', () => {
        // The picker isn't an "edit session" — closing it just dismisses
        // the toolbar, no data to lose.
        render({
            vectorDraw: {
                phase: 'picking',
                config: { layerName: 'geonode:bdy_4_test' },
                featureList: [{ id: 'bdy_4_test.1' }],
                formValues: { boundary: 'Reflective' },
                initialFormValues: { boundary: 'Reflective' }
            },
            draw: { tempFeatures: [], features: [] }
        });
        clickHeaderX();
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toBe(null);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('error-phase Close: NO overlay (just closing the error toast)', () => {
        render({
            vectorDraw: {
                phase: 'error',
                config: { layerName: 'geonode:bdy_4_test' },
                formValues: { description: 'foo' },
                initialFormValues: { description: 'bar' },  // looks dirty
                error: 'Network error'
            },
            draw: { tempFeatures: [], features: [] }
        });
        const buttons = container.querySelectorAll('button');
        const closeBtn = Array.from(buttons).find(b => /^close$/i.test(b.textContent));
        expect(closeBtn).toExist();
        closeBtn.click();
        // No overlay — error close is just dismissal, no edit to lose.
        expect(container.querySelector('.sv-vector-draw-discard-confirm')).toBe(null);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });
});
