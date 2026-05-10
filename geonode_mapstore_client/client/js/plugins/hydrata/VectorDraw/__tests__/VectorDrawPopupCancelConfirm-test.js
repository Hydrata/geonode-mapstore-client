/*
 * TASK-795 review I8 — Cancel discard-warning confirm.
 *
 * Pinned behaviour:
 *   1. formValuesAreDirty() pure helper — JSON-shape comparison.
 *   2. Cancel without unsaved changes: NO confirm prompt, fires onCancel.
 *   3. Cancel with form-value diff: confirm prompt; YES → cancel; NO → no-op.
 *   4. Cancel with geometry drawn (CREATE mode draw started): confirm prompt.
 *   5. Cancel with vertex moved (EDIT mode tempFeatures populated): confirm.
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

describe('TASK-795 review I8 popup Cancel discard-confirm wiring', () => {
    let container;
    let dispatched;
    let originalConfirm;
    let confirmCalls;
    let confirmReturn;

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
        originalConfirm = window.confirm;
        confirmCalls = [];
        confirmReturn = true;
        window.confirm = (msg) => { confirmCalls.push(msg); return confirmReturn; };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
        window.confirm = originalConfirm;
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
        const x = container.querySelector('.glyphicon-remove');
        expect(x).toExist();
        x.click();
    };

    it('clean form Cancel: NO confirm, dispatches CANCEL_VECTOR_DRAW immediately', () => {
        render(FORM_CLEAN);
        clickCancelButton();
        expect(confirmCalls.length).toBe(0);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('dirty form Cancel + confirm=YES: confirm shown, then dispatches CANCEL_VECTOR_DRAW', () => {
        render(FORM_DIRTY_FIELD);
        clickCancelButton();
        expect(confirmCalls.length).toBe(1);
        expect(confirmCalls[0]).toMatch(/Discard unsaved changes/);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('dirty form Cancel + confirm=NO: confirm shown, NO dispatch (user keeps editing)', () => {
        confirmReturn = false;
        render(FORM_DIRTY_FIELD);
        clickCancelButton();
        expect(confirmCalls.length).toBe(1);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('header X on dirty form: same confirm path as the Cancel button', () => {
        confirmReturn = false;
        render(FORM_DIRTY_FIELD);
        clickHeaderX();
        expect(confirmCalls.length).toBe(1);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('drawing-phase Cancel with tempFeatures populated (vertex dragged): confirm', () => {
        // EDIT mode draws populate tempFeatures with the in-progress edit.
        // formValues match seed (user only moved a vertex, didn't type),
        // so the form-diff path is clean — but draw is dirty.
        confirmReturn = false;
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
        expect(confirmCalls.length).toBe(1);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('drawing-phase Cancel after CREATE-mode draw started (drawFeatures with geometry): confirm', () => {
        // CREATE mode: geometry drawn, no featureId.
        confirmReturn = false;
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
        expect(confirmCalls.length).toBe(1);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toBe(undefined);
    });

    it('picker-phase header X: NO confirm (no active edit, just closing the picker)', () => {
        // The picker isn't an "edit session" — closing it just dismisses
        // the toolbar, no data to lose. Pre-fix this would have warned
        // unnecessarily because formValues might differ from
        // initialFormValues if the picker had been re-entered after a
        // previous edit. The picker render does NOT receive `handleCancel`
        // — it stays on plain `onCancel`.
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
        expect(confirmCalls.length).toBe(0);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });

    it('error-phase Close: NO confirm (just closing the error toast)', () => {
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
        // No confirm — error close is just dismissal, no edit to lose.
        expect(confirmCalls.length).toBe(0);
        expect(dispatched.find(a => a && a.type === CANCEL_VECTOR_DRAW)).toExist();
    });
});
