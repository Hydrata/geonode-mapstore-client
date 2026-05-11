/*
 * TASK-795 review TASK-804 — NIT bundle pin-tests.
 *
 * Each NIT in the bundle is a tiny correctness fix; we pin the desired
 * behaviour here so a future refactor can't silently regress.
 *
 *   NIT-1: previousPhase explicitly cleared on START (defensive even though
 *          ...initialState already covers it today).
 *   NIT-2: extractDrawGeometry has a depth guard against pathological
 *          recursive payloads.
 *   NIT-3: synthesizeTimeBoundaryFormValue uses Number.isFinite (not the
 *          brittle String(n) round-trip) so '0.0', '1e5', '3.140' parse OK.
 *   NIT-6: RETURN_TO_PICKER receives + reducer stores lastSavedFid; the
 *          picker highlights that row.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import reducer from '../reducerVectorDraw';
import {
    START_VECTOR_DRAW,
    CANCEL_VECTOR_DRAW,
    RETURN_TO_PICKER,
    returnToPicker
} from '../actionsVectorDraw';
import { extractDrawGeometry } from '../epicsVectorDraw';
// TASK-813 (W1.2) — synthesizeTimeBoundaryFormValue moved from wfstApi.js to
// boundaryTranslate.js as `synthesizeIn`. Aliased to keep existing test code
// stable; we pin the wire contract by behaviour, not by export name.
import { synthesizeIn as synthesizeTimeBoundaryFormValue } from '../boundaryTranslate';
import { PickerView } from '../components/VectorDrawPopup';

describe('TASK-804 NIT-1: previousPhase explicitly cleared on START', () => {
    it('START_VECTOR_DRAW with stale previousPhase from a prior cancelled flow → previousPhase null', () => {
        // Simulate a stale state: a prior CANCEL_VECTOR_DRAW left
        // previousPhase='picking' on the reducer. A new external start
        // must reset it to null (not inherit the stale value).
        const stale = reducer(
            { phase: 'idle', previousPhase: 'picking' },
            { type: START_VECTOR_DRAW, config: { layerName: 'l' } }
        );
        expect(stale.previousPhase).toBe(null);
    });

    it('CANCEL_VECTOR_DRAW captures the just-active phase as previousPhase, not the prior session\'s', () => {
        // Belt-and-braces — the captured previousPhase must reflect THIS
        // flow's phase, never leak from before.
        let s = reducer(undefined, { type: 'UNKNOWN' });
        s = reducer(s, { type: START_VECTOR_DRAW, config: { layerName: 'l' } });
        // phase: 'describing'
        s = reducer(s, { type: CANCEL_VECTOR_DRAW });
        expect(s.previousPhase).toBe('describing');
        // New flow → previousPhase must be wiped before the next CANCEL.
        s = reducer(s, { type: START_VECTOR_DRAW, config: { layerName: 'l2' } });
        expect(s.previousPhase).toBe(null);
    });
});

describe('TASK-804 NIT-2: extractDrawGeometry depth guard', () => {
    it('returns null for a pathologically nested FeatureCollection (> max depth)', () => {
        // Build a nested FC chain longer than the depth guard. The guard
        // prevents a runaway stack (cheap safety on payloads we don't
        // control).
        let nested = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
        };
        for (let i = 0; i < 8; i += 1) {
            nested = {
                type: 'FeatureCollection',
                features: [nested]
            };
        }
        // Without the guard this would still walk down and find the inner
        // Point; we want it to bail at the depth limit instead.
        expect(extractDrawGeometry(nested)).toBe(null);
    });

    it('still extracts geometry from a single-level FeatureCollection (regression check)', () => {
        const fc = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [1, 2] },
                properties: {}
            }]
        };
        expect(extractDrawGeometry(fc)).toEqual({ type: 'Point', coordinates: [1, 2] });
    });
});

describe('TASK-804 NIT-3: legacy text parser uses Number.isFinite (not String round-trip)', () => {
    it("'0.0' (legacy) → kind=constant, constant=0", () => {
        // Pre-fix: parseFloat('0.0') === 0; String(0) === '0' !== '0.0' → REJECTED
        // Post-fix: Number.isFinite(0) → accepted
        const out = synthesizeTimeBoundaryFormValue({ data: '0.0' });
        expect(out.data).toEqual({ kind: 'constant', constant: 0 });
    });

    it("'1e5' (legacy scientific notation) → kind=constant, constant=100000", () => {
        // Pre-fix: parseFloat('1e5') === 100000; String(100000) === '100000' !== '1e5' → REJECTED
        const out = synthesizeTimeBoundaryFormValue({ data: '1e5' });
        expect(out.data).toEqual({ kind: 'constant', constant: 100000 });
    });

    it("'3.140' (trailing zero) → kind=constant, constant=3.14", () => {
        // Pre-fix: parseFloat('3.140') === 3.14; String(3.14) === '3.14' !== '3.140' → REJECTED
        const out = synthesizeTimeBoundaryFormValue({ data: '3.140' });
        expect(out.data).toEqual({ kind: 'constant', constant: 3.14 });
    });

    it("non-numeric legacy text (e.g. 'TideStation_North') still drops cleanly", () => {
        // Old behaviour preserved: a TimeSeries.name in legacy `data` text
        // can't be reconstructed without a project query, so drop it and
        // make the user re-pick.
        const out = synthesizeTimeBoundaryFormValue({ data: 'TideStation_North' });
        expect('data' in out).toBe(false);
    });

    it("Infinity / NaN strings are rejected", () => {
        // parseFloat('Infinity') === Infinity, but Number.isFinite(Infinity) === false.
        const a = synthesizeTimeBoundaryFormValue({ data: 'Infinity' });
        expect('data' in a).toBe(false);
        const b = synthesizeTimeBoundaryFormValue({ data: 'NaN' });
        expect('data' in b).toBe(false);
    });
});

describe('TASK-804 NIT-6: RETURN_TO_PICKER threads lastSavedFid', () => {
    it('returnToPicker(features, fid) action carries lastSavedFid', () => {
        const action = returnToPicker([{ id: 'l.1' }], 'l.42');
        expect(action.type).toBe(RETURN_TO_PICKER);
        expect(action.lastSavedFid).toBe('l.42');
    });

    it('returnToPicker(features) with no fid → lastSavedFid null', () => {
        const action = returnToPicker([{ id: 'l.1' }]);
        expect(action.lastSavedFid).toBe(null);
    });

    it('reducer stores lastSavedFid on RETURN_TO_PICKER', () => {
        const prev = {
            phase: 'saving',
            config: { layerName: 'l' },
            cameFromPicker: true,
            featureList: [],
            initialFormValues: {},
            formValues: {}
        };
        const state = reducer(prev, returnToPicker([{ id: 'l.1' }, { id: 'l.42' }], 'l.42'));
        expect(state.lastSavedFid).toBe('l.42');
        expect(state.phase).toBe('picking');
    });

    it('cancel/delete RETURN_TO_PICKER (no fid) clears lastSavedFid (stale carry-over guard)', () => {
        const prev = {
            phase: 'saving',
            config: { layerName: 'l' },
            cameFromPicker: true,
            featureList: [],
            lastSavedFid: 'l.99',  // stale from a previous save
            initialFormValues: {},
            formValues: {}
        };
        const state = reducer(prev, returnToPicker([{ id: 'l.1' }]));
        // No fid → stale value should be cleared, not preserved.
        expect(state.lastSavedFid).toBe(null);
    });
});

describe('TASK-804 NIT-6: PickerView highlights the lastSavedFid row', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    it('row matching lastSavedFid gets the just-saved className', () => {
        const features = [
            { id: 'l.1', properties: { title: 'A' } },
            { id: 'l.42', properties: { title: 'Just-saved' } },
            { id: 'l.5', properties: { title: 'C' } }
        ];
        ReactDOM.render(
            <PickerView
                formConfig={{ title: 'Boundary' }}
                featureList={features}
                deletingFeatureId={null}
                lastSavedFid="l.42"
                onCancel={() => {}}
                onSelectFeature={() => {}}
                onDeleteFeature={() => {}}
            />,
            container
        );
        const highlighted = container.querySelectorAll('.vector-draw-picker-row-just-saved');
        // Exactly one row matches.
        expect(highlighted.length).toBe(1);
        expect(highlighted[0].textContent).toMatch(/Just-saved/);
    });

    it('lastSavedFid=null → no row gets the highlight class', () => {
        const features = [
            { id: 'l.1', properties: { title: 'A' } },
            { id: 'l.2', properties: { title: 'B' } }
        ];
        ReactDOM.render(
            <PickerView
                formConfig={{ title: 'Boundary' }}
                featureList={features}
                deletingFeatureId={null}
                lastSavedFid={null}
                onCancel={() => {}}
                onSelectFeature={() => {}}
                onDeleteFeature={() => {}}
            />,
            container
        );
        const highlighted = container.querySelectorAll('.vector-draw-picker-row-just-saved');
        expect(highlighted.length).toBe(0);
    });
});
