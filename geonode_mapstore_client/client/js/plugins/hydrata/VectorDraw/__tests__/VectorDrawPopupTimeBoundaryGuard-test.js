/*
 * TASK-795 review C6 / TASK-1409 — Pre-save guard for the boundary='Time' XOR rule.
 *
 * TASK-1409 updated the alert from blocking window.alert to a Redux
 * SHOW_NOTIFICATION dispatch (toast). Tests updated accordingly.
 *
 * Covers:
 *   1. validateTimeBoundaryFormValues() pure helper — returns null when
 *      OK, an error string when blocked.
 *   2. The form-phase Save button dispatches SHOW_NOTIFICATION + does NOT
 *      dispatch SUBMIT_FORM when validation blocks.
 *   3. The drawing-phase (inline edit) Save button dispatches SHOW_NOTIFICATION
 *      + does NOT dispatch DRAWING_COMPLETE when validation blocks.
 *
 * Why: Without this guard, a user who changes a Reflective row's boundary
 * to Time and clicks Save without touching the picker gets a confusing
 * "violates check constraint bdy_data_xor" toast from the BE. The guard
 * surfaces a friendly inline message instead.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup, {
    validateTimeBoundaryFormValues
} from '../components/VectorDrawPopup';
import { SUBMIT_FORM, DRAWING_COMPLETE } from '../actionsVectorDraw';
import { SHOW_NOTIFICATION } from '../../../../../MapStore2/web/client/actions/notifications';

function makeStore(state, dispatched) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => { dispatched.push(a); }
    };
}

describe('TASK-795 review C6 validateTimeBoundaryFormValues', () => {
    it('returns null when boundary is undefined (non-Boundary layer)', () => {
        expect(validateTimeBoundaryFormValues({ description: 'X' })).toBe(null);
    });

    it('returns null when boundary is non-Time (Reflective / Dirichlet / Transmissive)', () => {
        ['Reflective', 'Dirichlet', 'Transmissive'].forEach(b => {
            expect(validateTimeBoundaryFormValues({ boundary: b })).toBe(null);
        });
    });

    it('returns null when boundary=Time + structured constant value', () => {
        const out = validateTimeBoundaryFormValues({
            boundary: 'Time',
            data: { kind: 'constant', constant: 5.5 }
        });
        expect(out).toBe(null);
    });

    it('returns null when boundary=Time + structured timeseries value', () => {
        const out = validateTimeBoundaryFormValues({
            boundary: 'Time',
            data: { kind: 'timeseries', timeseries_id: 42 }
        });
        expect(out).toBe(null);
    });

    it('returns null when boundary=Time + EDIT-mode seeded data_constant', () => {
        // The picker hasn't rendered + synthesized yet; user opens the row
        // and clicks Save immediately. The per-column shape is a valid
        // pre-translation form-value bag.
        const out = validateTimeBoundaryFormValues({
            boundary: 'Time',
            data_constant: 5.5
        });
        expect(out).toBe(null);
    });

    it('returns null when boundary=Time + EDIT-mode seeded data_timeseries_id', () => {
        const out = validateTimeBoundaryFormValues({
            boundary: 'Time',
            data_timeseries_id: 42
        });
        expect(out).toBe(null);
    });

    it('returns error string when boundary=Time + no value at all', () => {
        const out = validateTimeBoundaryFormValues({
            boundary: 'Time',
            description: 'orphan'
        });
        expect(out).toMatch(/Time boundaries require a data value/);
    });

    it('returns error string when boundary=Time + structured kind=constant but constant is empty/null/undefined', () => {
        [null, undefined, ''].forEach(v => {
            const out = validateTimeBoundaryFormValues({
                boundary: 'Time',
                data: { kind: 'constant', constant: v }
            });
            expect(out).toMatch(/Time boundaries require a data value/);
        });
    });

    it('returns error string when boundary=Time + structured kind=timeseries but id is empty', () => {
        [null, undefined, ''].forEach(v => {
            const out = validateTimeBoundaryFormValues({
                boundary: 'Time',
                data: { kind: 'timeseries', timeseries_id: v }
            });
            expect(out).toMatch(/Time boundaries require a data value/);
        });
    });

    it('null/undefined formValues returns null (no false-positive on idle state)', () => {
        expect(validateTimeBoundaryFormValues(null)).toBe(null);
        expect(validateTimeBoundaryFormValues(undefined)).toBe(null);
    });
});

describe('TASK-795 review C6 / TASK-1409 popup Save guard wiring (SHOW_NOTIFICATION)', () => {
    let container;
    let dispatched;

    const FORM_TIME_NO_DATA_STATE = {
        vectorDraw: {
            phase: 'form',
            config: {
                layerName: 'geonode:bdy_4_test',
                geomType: 'LineString',
                formConfig: {
                    title: 'Boundary Edit',
                    fields: [
                        { name: 'boundary', type: 'select', "default": 'Reflective' },
                        { name: 'data', type: 'time-data-picker',
                            showWhen: { field: 'boundary', equals: 'Time' } }
                    ]
                }
            },
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
            // Pure repro: user toggled boundary to Time but never touched
            // the picker. No `data`, no data_constant, no data_timeseries_id.
            formValues: { boundary: 'Time' }
        },
        draw: { tempFeatures: [], features: [] }
    };

    const FORM_TIME_WITH_CONSTANT_STATE = {
        ...FORM_TIME_NO_DATA_STATE,
        vectorDraw: {
            ...FORM_TIME_NO_DATA_STATE.vectorDraw,
            formValues: {
                boundary: 'Time',
                data: { kind: 'constant', constant: 5.5 }
            }
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

    const clickSave = () => {
        const buttons = container.querySelectorAll('button');
        const saveBtn = Array.from(buttons).find(b => /save/i.test(b.textContent));
        expect(saveBtn).toExist();
        saveBtn.click();
    };

    it('form-phase Save: blocks SUBMIT_FORM when boundary=Time + no value, dispatches SHOW_NOTIFICATION', () => {
        render(FORM_TIME_NO_DATA_STATE);
        clickSave();
        // TASK-1409 — replaced window.alert with SHOW_NOTIFICATION dispatch.
        const notif = dispatched.find(a => a && a.type === SHOW_NOTIFICATION);
        expect(notif).toExist();
        expect(notif.message).toMatch(/Time boundaries require a data value/);
        // SUBMIT_FORM was NOT dispatched — the user keeps editing the form
        // instead of getting a confusing BE error toast a network round-trip
        // later.
        expect(dispatched.find(a => a && a.type === SUBMIT_FORM)).toBe(undefined);
    });

    it('form-phase Save: dispatches SUBMIT_FORM when boundary=Time + valid constant value', () => {
        render(FORM_TIME_WITH_CONSTANT_STATE);
        clickSave();
        expect(dispatched.find(a => a && a.type === SHOW_NOTIFICATION)).toBe(undefined);
        expect(dispatched.find(a => a && a.type === SUBMIT_FORM)).toExist();
    });

    it('form-phase Save: dispatches SUBMIT_FORM when boundary is Reflective (rule does not apply)', () => {
        render({
            ...FORM_TIME_NO_DATA_STATE,
            vectorDraw: {
                ...FORM_TIME_NO_DATA_STATE.vectorDraw,
                formValues: { boundary: 'Reflective' }
            }
        });
        clickSave();
        expect(dispatched.find(a => a && a.type === SHOW_NOTIFICATION)).toBe(undefined);
        expect(dispatched.find(a => a && a.type === SUBMIT_FORM)).toExist();
    });

    it('inline-edit Save: blocks DRAWING_COMPLETE when boundary=Time + no value, dispatches SHOW_NOTIFICATION', () => {
        // Drawing phase + featureId set + formConfig present = inline form
        // path (the showInlineForm branch in VectorDrawPopup).
        render({
            vectorDraw: {
                ...FORM_TIME_NO_DATA_STATE.vectorDraw,
                phase: 'drawing',
                config: {
                    ...FORM_TIME_NO_DATA_STATE.vectorDraw.config,
                    featureId: 'bdy_4_test.5'
                }
            },
            draw: {
                tempFeatures: [],
                features: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }]
            }
        });
        clickSave();
        // TASK-1409 — replaced window.alert with SHOW_NOTIFICATION dispatch.
        const notif = dispatched.find(a => a && a.type === SHOW_NOTIFICATION);
        expect(notif).toExist();
        expect(notif.message).toMatch(/Time boundaries require a data value/);
        // Neither DRAWING_COMPLETE nor SUBMIT_FORM should have fired (the
        // inline edit-Save handler dispatches both via onSaveEditAndSubmit
        // when valid).
        expect(dispatched.find(a => a && a.type === DRAWING_COMPLETE)).toBe(undefined);
        expect(dispatched.find(a => a && a.type === SUBMIT_FORM)).toBe(undefined);
    });
});
