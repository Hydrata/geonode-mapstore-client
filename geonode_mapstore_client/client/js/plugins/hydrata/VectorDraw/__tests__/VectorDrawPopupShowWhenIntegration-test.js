/*
 * TASK-795 review TASK-805 — End-to-end-style coverage for the showWhen →
 * wfstApi-translate contract that's split across two files today:
 *
 *   1. VectorDrawPopup.js: matchesShowWhen() filters fields out of the
 *      rendered form when their `showWhen` predicate fails. So a
 *      `time-data-picker` field with `showWhen: {field:'boundary', equals:'Time'}`
 *      DISAPPEARS from the DOM when the user toggles boundary to Reflective.
 *
 *   2. wfstApi.js: translateTimeBoundaryProperties() additionally STRIPS
 *      data / data_constant / data_timeseries_id from wire properties when
 *      boundary !== 'Time'. So even if formValues still carries a stale
 *      `data` value (e.g. user picked a constant, then switched boundary
 *      kind without saving), it never reaches GeoServer.
 *
 * The two halves combined are the "preserve in state, strip at translate
 * time" contract. A future refactor that drops only one half would silently
 * break user-visible behaviour or wire-protocol invariants. Pin both halves
 * here so a single-test failure fingers the regression.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup from '../components/VectorDrawPopup';
import { translateTimeBoundaryProperties } from '../wfstApi';
import { UPDATE_FORM_VALUES } from '../actionsVectorDraw';

const FORM_CONFIG = {
    title: 'Boundary',
    fields: [
        { name: 'description', type: 'text', label: 'Description' },
        {
            name: 'boundary',
            type: 'select',
            label: 'Boundary',
            "default": 'Reflective',
            options: [
                { value: 'Reflective', label: 'Reflective' },
                { value: 'Dirichlet', label: 'Dirichlet' },
                { value: 'Transmissive', label: 'Transmissive' },
                { value: 'Time', label: 'Time' }
            ]
        },
        {
            name: 'data',
            type: 'time-data-picker',
            label: 'Boundary value',
            showWhen: { field: 'boundary', equals: 'Time' }
        }
    ]
};

function makeStore(state, dispatched) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: (a) => { dispatched.push(a); }
    };
}

const stateWithBoundary = (boundaryValue, extra = {}) => ({
    vectorDraw: {
        phase: 'form',
        config: {
            layerName: 'geonode:bdy_4_test',
            geomType: 'LineString',
            formConfig: FORM_CONFIG
        },
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        formValues: {
            description: 'X',
            boundary: boundaryValue,
            ...extra
        },
        initialFormValues: { description: 'X', boundary: boundaryValue, ...extra }
    },
    draw: { tempFeatures: [], features: [] },
    // TimeDataPicker reads getProjectId from state.anuga — supply a stub so
    // the connect() wrapper doesn't throw on missing keys. With projectId
    // null the picker skips the fetch (defensive shortcut in FormField.js)
    // so the test doesn't depend on axios / network.
    anuga: { projects: { data: null } }
});

describe('TASK-805 showWhen integration: picker visibility ↔ wire-property strip', () => {
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

    const render = (state) => {
        ReactDOM.render(
            <Provider store={makeStore(state, dispatched)}>
                <VectorDrawPopup />
            </Provider>,
            container
        );
    };

    it('boundary=Time → time-data-picker DOM IS rendered', () => {
        render(stateWithBoundary('Time', { data: { kind: 'constant', constant: 5 } }));
        // FormField.js renders the picker with className="time-data-picker"
        // (TimeDataPicker root div) — that's our anchor for "is the picker
        // mounted?" without coupling to internal radio chrome.
        expect(container.querySelector('.time-data-picker')).toExist();
    });

    it('boundary=Reflective → time-data-picker DOM is GONE (showWhen unmounts it)', () => {
        // Even with formValues.data carrying a stale structured value (e.g.
        // user picked a constant, then toggled to Reflective without saving),
        // the picker must not render. The wire-strip half of the contract
        // catches this on the way out; the showWhen half catches it visually.
        render(stateWithBoundary('Reflective', { data: { kind: 'constant', constant: 5 } }));
        expect(container.querySelector('.time-data-picker')).toBe(null);
    });

    it('toggling Time → Reflective via re-render: picker disappears (DOM diff)', () => {
        render(stateWithBoundary('Time', { data: { kind: 'constant', constant: 5 } }));
        expect(container.querySelector('.time-data-picker')).toExist();

        // Simulate the reducer applying UPDATE_FORM_VALUES('boundary',
        // 'Reflective') — re-render with the new state shape.
        render(stateWithBoundary('Reflective', { data: { kind: 'constant', constant: 5 } }));
        expect(container.querySelector('.time-data-picker')).toBe(null);
    });

    it('the boundary select fires UPDATE_FORM_VALUES on change (proves the dispatch path)', () => {
        render(stateWithBoundary('Time'));
        // Find the boundary select. FormField renders a <select> for type='select'.
        const selects = container.querySelectorAll('select');
        const boundarySelect = Array.from(selects).find(s =>
            Array.from(s.options).some(o => o.value === 'Reflective')
        );
        expect(boundarySelect).toExist();
        // Mimic user changing the value.
        boundarySelect.value = 'Reflective';
        const ev = new Event('change', { bubbles: true });
        boundarySelect.dispatchEvent(ev);
        const dispatch = dispatched.find(a =>
            a && a.type === UPDATE_FORM_VALUES && a.fieldName === 'boundary'
        );
        expect(dispatch).toExist();
        expect(dispatch.value).toBe('Reflective');
    });
});

describe('TASK-805 showWhen integration: wire-property strip half (translate)', () => {
    it('boundary=Reflective with stale data → wire props have NO data*', () => {
        const wire = translateTimeBoundaryProperties({
            description: 'X',
            boundary: 'Reflective',
            // Stale time-picker shape left in formValues from a prior Time
            // selection — translate must drop it.
            data: { kind: 'constant', constant: 5 },
            data_constant: 5
        });
        expect(wire.boundary).toBe('Reflective');
        expect(wire.description).toBe('X');
        expect('data' in wire).toBe(false);
        expect('data_constant' in wire).toBe(false);
        expect('data_timeseries_id' in wire).toBe(false);
    });

    it('boundary=Time + data.kind=constant → wire has data_constant only', () => {
        const wire = translateTimeBoundaryProperties({
            description: 'X',
            boundary: 'Time',
            data: { kind: 'constant', constant: 5 }
        });
        expect(wire.boundary).toBe('Time');
        expect(wire.data_constant).toBe(5);
        expect('data' in wire).toBe(false);
        expect('data_timeseries_id' in wire).toBe(false);
    });

    it('boundary=Time + data.kind=timeseries → wire has data_timeseries_id only', () => {
        const wire = translateTimeBoundaryProperties({
            description: 'X',
            boundary: 'Time',
            data: { kind: 'timeseries', timeseries_id: 42 }
        });
        expect(wire.boundary).toBe('Time');
        expect(wire.data_timeseries_id).toBe(42);
        expect('data' in wire).toBe(false);
        expect('data_constant' in wire).toBe(false);
    });

    it('non-Boundary layer (no boundary key) → translate is pass-through (Inflow.data preserved)', () => {
        // Inflow / Friction / Structure / MeshRegion all hit the same
        // wfstInsert/wfstUpdate path. Their `data` field MUST survive intact
        // — see TASK-795 review C1 (the regression that broke Inflow saves).
        const wire = translateTimeBoundaryProperties({
            description: 'Inflow north',
            data: '100',
            location: 'External'
        });
        expect(wire.data).toBe('100');
        expect(wire.description).toBe('Inflow north');
        expect(wire.location).toBe('External');
    });
});
