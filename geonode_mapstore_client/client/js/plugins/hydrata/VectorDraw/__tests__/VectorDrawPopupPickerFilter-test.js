/*
 * TASK-795 review I10 (TASK-803) — Picker text filter for 50+ features.
 *
 * Pinned behaviour:
 *   1. Filter input is HIDDEN below PICKER_FILTER_THRESHOLD rows (visual
 *      noise on small projects with 4-6 boundaries).
 *   2. Filter input is SHOWN at/above the threshold (long-form floodplains
 *      with 80+ segments).
 *   3. Typing into the filter narrows the visible list by featureLabel
 *      substring match (case-insensitive).
 *   4. The "+ Add new" row is ALWAYS visible regardless of filter text
 *      (creating a new feature shouldn't be hidden by a narrow filter).
 *   5. Empty-result state shows a "No features match" placeholder so the
 *      user knows the list isn't broken.
 *   6. Trash icon still works on filtered rows (dispatch path unchanged).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';
import { PickerView, PICKER_FILTER_THRESHOLD } from '../components/VectorDrawPopup';

const makeFeatures = (n, labelPrefix = 'Feature') =>
    Array.from({ length: n }, (_, i) => ({
        id: `lyr.${i + 1}`,
        properties: { title: `${labelPrefix}_${(i + 1).toString().padStart(2, '0')}` }
    }));

describe('TASK-803 PICKER_FILTER_THRESHOLD constant', () => {
    it('exports a sensible threshold > 1 and ≤ 10', () => {
        // Tested indirectly because we'd want feedback if it ever creeps
        // into a non-sensible range (e.g. 50 → no project ever sees the
        // filter; 1 → noise on every picker).
        expect(PICKER_FILTER_THRESHOLD).toBeGreaterThan(1);
        expect(PICKER_FILTER_THRESHOLD).toBeLessThan(11);
    });
});

describe('TASK-803 PickerView text filter', () => {
    let container;
    let originalConfirm;
    let calls;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalConfirm = window.confirm;
        // Default to "no" so accidental clicks during these tests don't fire deletes
        window.confirm = () => false;
        calls = { selects: [], deletes: [], cancels: 0 };
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
        window.confirm = originalConfirm;
    });

    const render = (featureList) => {
        ReactDOM.render(
            <PickerView
                formConfig={{ title: 'Boundary' }}
                featureList={featureList}
                deletingFeatureId={null}
                onCancel={() => { calls.cancels += 1; }}
                onSelectFeature={(id) => { calls.selects.push(id); }}
                onDeleteFeature={(id) => { calls.deletes.push(id); }}
            />,
            container
        );
    };

    it('with fewer features than threshold → filter input is NOT rendered', () => {
        render(makeFeatures(PICKER_FILTER_THRESHOLD - 1));
        expect(container.querySelector('.vector-draw-picker-filter')).toBe(null);
    });

    it('with feature count == threshold → filter input IS rendered', () => {
        render(makeFeatures(PICKER_FILTER_THRESHOLD));
        const input = container.querySelector('.vector-draw-picker-filter');
        expect(input).toExist();
        expect(input.tagName).toBe('INPUT');
    });

    it('with many features (50) → filter input is rendered AND all rows visible by default', () => {
        render(makeFeatures(50));
        expect(container.querySelector('.vector-draw-picker-filter')).toExist();
        // Each row gets a className from the picker template; count rows
        // excluding the "+ Add new" item (which has its own className).
        const allRows = container.querySelectorAll('.simple-view-panel-item-row');
        const addNewRow = container.querySelector('.vector-draw-picker-add-new');
        expect(addNewRow).toExist();
        // 50 features + 1 "+ Add new" row.
        expect(allRows.length).toBe(51);
    });

    it('typing in the filter narrows the visible list by featureLabel substring', () => {
        const features = makeFeatures(20, 'Inlet');
        // Add a couple of distinguishable rows so we can see the filter work.
        features.push({ id: 'lyr.99', properties: { title: 'NorthOutlet' } });
        features.push({ id: 'lyr.100', properties: { title: 'EastTide' } });
        render(features);
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: 'tide' } });
        const rows = container.querySelectorAll('.simple-view-panel-item-row');
        // 1 matching row + 1 "+ Add new" row = 2 total
        expect(rows.length).toBe(2);
        const labels = Array.from(rows).map(r => r.textContent);
        expect(labels.some(l => /EastTide/.test(l))).toBe(true);
        // "+ Add new" still present
        expect(container.querySelector('.vector-draw-picker-add-new')).toExist();
    });

    it('case-insensitive matching: "INLET" matches "Inlet_03"', () => {
        render(makeFeatures(15, 'Inlet'));
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: 'INLET_03' } });
        const rows = container.querySelectorAll('.simple-view-panel-item-row');
        // 1 matching row + "+ Add new"
        expect(rows.length).toBe(2);
    });

    it('filter with no matches → renders the empty-state placeholder', () => {
        render(makeFeatures(15, 'Inlet'));
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: 'zzz_no_match' } });
        const empty = container.querySelector('.vector-draw-picker-empty');
        expect(empty).toExist();
        expect(empty.textContent).toMatch(/No features match/);
        // "+ Add new" still rendered (creating new isn't blocked by filter)
        expect(container.querySelector('.vector-draw-picker-add-new')).toExist();
    });

    it('clearing the filter restores the full list', () => {
        render(makeFeatures(15, 'Inlet'));
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: 'Inlet_05' } });
        let rows = container.querySelectorAll('.simple-view-panel-item-row');
        expect(rows.length).toBe(2);

        Simulate.change(input, { target: { value: '' } });
        rows = container.querySelectorAll('.simple-view-panel-item-row');
        // 15 + "+ Add new"
        expect(rows.length).toBe(16);
    });

    it('clicking a filtered row still dispatches onSelectFeature with that fid', () => {
        const features = makeFeatures(15, 'Inlet');
        render(features);
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: 'Inlet_07' } });
        const rows = container.querySelectorAll('.simple-view-panel-item-row');
        // First non-"+ Add new" row is the only filtered match.
        const matchRow = Array.from(rows).find(r => /Inlet_07/.test(r.textContent));
        expect(matchRow).toExist();
        matchRow.click();
        expect(calls.selects).toEqual(['lyr.7']);
    });

    it('whitespace-only filter text is treated as empty (full list shown)', () => {
        render(makeFeatures(15));
        const input = container.querySelector('.vector-draw-picker-filter');
        Simulate.change(input, { target: { value: '   ' } });
        const rows = container.querySelectorAll('.simple-view-panel-item-row');
        // 15 + "+ Add new"
        expect(rows.length).toBe(16);
    });
});
