/**
 * TASK-2582 (W2a) — Merge extent FE: 'Set extent' draw + summary/Clear + live
 * output-size estimate, inside the Combined-surface recipe builder
 * (TWRecipeBuilder, recipeBuilderComponents.js).
 *
 * Covers:
 *   - estimateOutputSize()'s new optional extentWgs84 arg: null = full union;
 *     an extent BEYOND the union clips back to the union; a SMALLER extent
 *     shrinks the estimate via bbox intersection; no overlap -> zero-sized.
 *   - formatEstimateSize / mergeExtentDimsKm — small pure display helpers.
 *   - TWRecipeBuilder: the 'Set extent' button (flips to Cancel while
 *     drawing), the summary+Clear row (only once an extent is set; Clear ->
 *     null), the live estimate row (recomputes on extent AND target-resolution
 *     changes), and the atomic derive body carrying merge_extent_wgs84 (null
 *     when cleared).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
// Without an IntlProvider in scope (no locale context in these unit tests),
// <Message msgId msgParams/> just renders the raw msgId string and DROPS
// msgParams entirely (MapStore2/web/client/components/I18N/Message.jsx
// renderMsg branch) — the same reason terrainBboxPanel-test.js only asserts
// dynamic numbers that are rendered as plain JSX, never via msgParams. The
// live-estimate value IS msgParams-driven (i18n-correct grammar), so proving
// it recomputes means reading the mounted Message element's own msgParams
// prop rather than its rendered text.
import Message from '@mapstore/framework/components/I18N/Message';

import {
    estimateOutputSize,
    formatEstimateSize,
    mergeExtentDimsKm,
    TWRecipeBuilder
} from '../recipeBuilderComponents';

// Find the live-estimate <Message> instance mounted under `instance` (the
// TWRecipeBuilder root returned by ReactDOM.render) and return its msgParams.
function liveEstimateMsgParams(instance) {
    const messages = TestUtils.scryRenderedComponentsWithType(instance, Message);
    const msg = messages.find(m => m.props.msgId === 'hydrata.anuga.mergeExtentEstimateLabel');
    return msg ? msg.props.msgParams : null;
}

// A single DEM whose bbox_wgs84 is a 1deg x 1deg box near lat -34.5 — big
// enough to produce a non-zero, non-"too large" estimate at native res.
const TERRAINS = [
    { id: 1, title: 'DEM A', bbox_wgs84: [140.0, -35.0, 141.0, -34.0], native_resolution_m: 30 }
];
const INPUTS = [{ terrain_id: 1, priority: 0, unmodified: false }];

describe('TASK-2582 estimateOutputSize — Merge extent clipping', () => {
    it('extent=null estimates the full DEM-stack union', () => {
        const est = estimateOutputSize(INPUTS, TERRAINS, 30, null);
        expect(est).toExist();
        expect(est.estimatedGB).toBeGreaterThan(0);
    });

    it('an extent that fully CONTAINS the union clips BACK to the union (identical estimate)', () => {
        const full = estimateOutputSize(INPUTS, TERRAINS, 30, null);
        const beyond = estimateOutputSize(INPUTS, TERRAINS, 30, [130, -40, 150, -30]);
        expect(beyond).toEqual(full);
    });

    it('an extent SMALLER than the union shrinks the estimate (intersection, not the raw extent)', () => {
        const full = estimateOutputSize(INPUTS, TERRAINS, 30, null);
        // Half width, half height -> ~ a quarter of the union area.
        const smaller = estimateOutputSize(INPUTS, TERRAINS, 30, [140.0, -35.0, 140.5, -34.5]);
        expect(smaller.estimatedGB).toBeLessThan(full.estimatedGB);
        expect(smaller.estimatedGB).toBeGreaterThan(0);
    });

    it('an extent with NO overlap with the union returns a zero-sized estimate', () => {
        const noOverlap = estimateOutputSize(INPUTS, TERRAINS, 30, [10, 10, 11, 11]);
        expect(noOverlap).toEqual({ estimatedGB: 0, tooLarge: false });
    });
});

describe('TASK-2582 formatEstimateSize / mergeExtentDimsKm', () => {
    it('formatEstimateSize: null in, null out', () => {
        expect(formatEstimateSize(null)).toBe(null);
    });

    it('formatEstimateSize: sub-1GB renders as MB', () => {
        expect(formatEstimateSize({ estimatedGB: 0.5, tooLarge: false })).toBe('~512 MB');
    });

    it('formatEstimateSize: >=1GB renders as GB', () => {
        expect(formatEstimateSize({ estimatedGB: 2.345, tooLarge: false })).toBe('~2.3 GB');
    });

    it('mergeExtentDimsKm: null/invalid bbox -> null', () => {
        expect(mergeExtentDimsKm(null)).toBe(null);
        expect(mergeExtentDimsKm([1, 2, 3])).toBe(null);
    });

    it('mergeExtentDimsKm: a 1deg x 1deg box near the equator is roughly 111km x 111km', () => {
        const dims = mergeExtentDimsKm([0, -0.5, 1, 0.5]);
        expect(parseFloat(dims.widthKm)).toBeGreaterThan(100);
        expect(parseFloat(dims.widthKm)).toBeLessThan(112.5);
        expect(parseFloat(dims.heightKm)).toBeGreaterThan(100);
        expect(parseFloat(dims.heightKm)).toBeLessThan(112.5);
    });
});

describe('TASK-2582 TWRecipeBuilder — Merge extent UI', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const surface = {
        id: 7,
        title: 'Surface A',
        inputs_ordered: [{ id: 1, terrain: 1, priority: 0, unmodified: false }],
        feather_width_m: 10,
        target_resolution_m: 30
    };

    // Renders TWRecipeBuilder against the fixture surface/terrains; returns a
    // getter for the (id, body) the last onDerive call received, plus the
    // mounted component instance (for liveEstimateMsgParams()).
    function renderBuilder(props = {}) {
        let derivedWith = null;
        const onDerive = (id, body) => { derivedWith = { id, body }; };
        const instance = ReactDOM.render(
            <TWRecipeBuilder
                surface={surface}
                terrains={TERRAINS}
                onUpdate={() => {}}
                onDerive={onDerive}
                {...props}
            />,
            container
        );
        return { getDerived: () => derivedWith, instance };
    }

    // Renders with only mergeExtent varying (used by the recompute specs
    // below); returns the mounted instance.
    function renderWithExtent(extent) {
        return ReactDOM.render(
            <TWRecipeBuilder surface={surface} terrains={TERRAINS} onUpdate={() => {}} onDerive={() => {}} mergeExtent={extent}/>,
            container
        );
    }

    it('AC1: "Set extent" renders; clicking it calls onStartMergeExtentDraw', () => {
        let started = false;
        renderBuilder({ onStartMergeExtentDraw: () => { started = true; } });
        const btn = container.querySelector('[data-testid="merge-extent-set-btn"]');
        expect(btn).toExist();
        expect(btn.textContent).toMatch(/mergeExtentSetButton|Set extent/);
        btn.click();
        expect(started).toBe(true);
    });

    it('AC1: while drawing the button reads Cancel; clicking it calls onCancelMergeExtentDraw', () => {
        let cancelled = false;
        renderBuilder({ mergeExtentDrawing: true, onCancelMergeExtentDraw: () => { cancelled = true; } });
        const btn = container.querySelector('[data-testid="merge-extent-set-btn"]');
        expect(btn.textContent).toMatch(/mergeExtentCancelButton|Cancel/);
        btn.click();
        expect(cancelled).toBe(true);
    });

    it('AC1: no summary/Clear row when mergeExtent is null (full union)', () => {
        renderBuilder({ mergeExtent: null });
        expect(container.querySelector('[data-testid="merge-extent-summary"]')).toNotExist();
        expect(container.querySelector('[data-testid="merge-extent-clear-btn"]')).toNotExist();
    });

    it('AC1: summary + Clear render once mergeExtent is set; Clear calls onClearMergeExtent -> null', () => {
        let cleared = 'untouched';
        renderBuilder({
            mergeExtent: [140.0, -35.0, 140.5, -34.5],
            onClearMergeExtent: () => { cleared = null; }
        });
        expect(container.querySelector('[data-testid="merge-extent-summary"]')).toExist();
        const clearBtn = container.querySelector('[data-testid="merge-extent-clear-btn"]');
        expect(clearBtn).toExist();
        clearBtn.click();
        expect(cleared).toBe(null);
    });

    it('AC2: the live estimate shows the full-union estimate when mergeExtent is null', () => {
        const { instance } = renderBuilder({ mergeExtent: null });
        expect(container.querySelector('[data-testid="merge-extent-live-estimate"]')).toExist();
        const full = estimateOutputSize(INPUTS, TERRAINS, 30, null);
        const params = liveEstimateMsgParams(instance);
        expect(params).toExist();
        expect(params.size).toBe(formatEstimateSize(full));
    });

    it('AC2: the live estimate recomputes (shrinks) once a smaller Merge extent is set', () => {
        let instance = renderWithExtent(null);
        const fullSize = liveEstimateMsgParams(instance).size;
        instance = renderWithExtent([140.0, -35.0, 140.5, -34.5]);
        const smallerSize = liveEstimateMsgParams(instance).size;
        expect(smallerSize).toNotEqual(fullSize);
        // Sanity: it's actually SMALLER, not merely different.
        const full = estimateOutputSize(INPUTS, TERRAINS, 30, null);
        const smaller = estimateOutputSize(INPUTS, TERRAINS, 30, [140.0, -35.0, 140.5, -34.5]);
        expect(smaller.estimatedGB).toBeLessThan(full.estimatedGB);
    });

    it('AC2: extent BEYOND the union shows the union-clipped estimate (identical to null)', () => {
        let instance = renderWithExtent(null);
        const nullSize = liveEstimateMsgParams(instance).size;
        instance = renderWithExtent([130, -40, 150, -30]);
        const beyondSize = liveEstimateMsgParams(instance).size;
        expect(beyondSize).toBe(nullSize);
    });

    it('AC2: the live estimate recomputes on a Target resolution (m) change', () => {
        const { instance } = renderBuilder({ mergeExtent: null });
        const before = liveEstimateMsgParams(instance).size;
        const resInput = container.querySelector('[data-testid="target-res-input"]');
        TestUtils.Simulate.change(resInput, { target: { value: '5' } });
        const after = liveEstimateMsgParams(instance).size;
        expect(after).toNotEqual(before);
    });

    it('AC3: the derive body carries merge_extent_wgs84 = null when no extent has been drawn', () => {
        const { getDerived } = renderBuilder({ mergeExtent: null });
        container.querySelector('[data-testid="derive-btn"]').click();
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        const derived = getDerived();
        expect(derived).toExist();
        expect(derived.body.merge_extent_wgs84).toBe(null);
    });

    it('AC3: the derive body carries merge_extent_wgs84 = the drawn extent when set', () => {
        const extent = [140.0, -35.0, 140.5, -34.5];
        const { getDerived } = renderBuilder({ mergeExtent: extent });
        container.querySelector('[data-testid="derive-btn"]').click();
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        const derived = getDerived();
        expect(derived.body.merge_extent_wgs84).toEqual(extent);
    });
});
