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
    // TASK-2970 (W3.7) — DEM resolution per row + the coarser-above-finer mirror.
    formatResolutionM,
    findCoarserAboveFiner,
    TWDemStackPicker,
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

// TASK-2580 (W2-reaim change 1) — Combined surface NAME field: renders above
// the 'Merge terrains' layering UI, initial value = surface.title, PATCHes
// via the EXISTING twUpdateSurfaceEpic path (onUpdate) on blur — NOT via the
// derive body (the dispatch-race the BE sibling fixed).
describe('TASK-2580 TWRecipeBuilder — Combined surface name field', () => {
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

    function renderBuilder(props = {}) {
        const updates = [];
        const onUpdate = (id, payload) => updates.push({ id, payload });
        const instance = ReactDOM.render(
            <TWRecipeBuilder
                surface={surface}
                terrains={TERRAINS}
                onUpdate={onUpdate}
                onDerive={() => {}}
                {...props}
            />,
            container
        );
        return { getUpdates: () => updates, instance };
    }

    it('renders above the Merge terrains layering UI (DEM stack picker)', () => {
        renderBuilder();
        const nameRow = container.querySelector('[data-testid="combined-surface-name-row"]');
        const demStack = container.querySelector('.sv-tw-design-inputs');
        expect(nameRow).toExist('name row renders');
        expect(demStack).toExist('DEM stack layering UI renders');
        // DOCUMENT_POSITION_FOLLOWING (4): nameRow precedes demStack in the DOM.
        // eslint-disable-next-line no-bitwise
        expect(nameRow.compareDocumentPosition(demStack) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy('name field is above the DEM stack picker');
    });

    it('initial value = the surface\'s current title', () => {
        renderBuilder();
        const input = container.querySelector('[data-testid="combined-surface-name-input"]');
        expect(input).toExist();
        expect(input.value).toBe('Surface A');
    });

    it('edit + blur PATCHes the title via onUpdate(surfaceId, {title}) — the update epic path', () => {
        const { getUpdates } = renderBuilder();
        const input = container.querySelector('[data-testid="combined-surface-name-input"]');
        TestUtils.Simulate.change(input, { target: { value: 'Renamed surface' } });
        TestUtils.Simulate.blur(input);
        const updates = getUpdates();
        expect(updates.length).toBe(1);
        expect(updates[0].id).toBe(7);
        expect(updates[0].payload).toEqual({ title: 'Renamed surface' });
    });

    it('blur WITHOUT a change is a no-op (no spurious PATCH)', () => {
        const { getUpdates } = renderBuilder();
        const input = container.querySelector('[data-testid="combined-surface-name-input"]');
        input.focus();
        TestUtils.Simulate.blur(input);
        expect(getUpdates().length).toBe(0);
    });

    it('a not-yet-created placeholder surface (id null) never PATCHes on blur', () => {
        const placeholder = { id: null, title: 'Combined surface', inputs_ordered: [] };
        const { getUpdates } = renderBuilder({ surface: placeholder });
        const input = container.querySelector('[data-testid="combined-surface-name-input"]');
        expect(input.value).toBe('Combined surface');
        TestUtils.Simulate.change(input, { target: { value: 'My model' } });
        TestUtils.Simulate.blur(input);
        expect(getUpdates().length).toBe(0, 'nothing to PATCH before the surface exists');
    });
});

// ---------------------------------------------------------------------------
// TASK-2970 (W3.7) — Merge terrains: DEM resolution per row, insert-by-resolution,
// and the "Derive anyway" acknowledgement for a coarser DEM above a finer one.
//
// Origin: prod map 6629 — the modeller added GLO-30 (native 30.7039 m) first and
// their 0.5 m lidar second, so `addTerrain`'s append-at-the-bottom made the COARSE
// DEM the TOP entry. GLO-30 was valid over 100 % of the grid, so it pasted over
// every lidar pixel and the survey contributed nothing to the 1 m output.
//
// The rows carried a TOP/BASE badge and a title only — nothing on screen said
// which DEM was coarse — hence: a resolution per row, finest-on-top insertion,
// and a refuse-unless-acknowledged confirm step that names the inversion (the
// design-over-survey stack is the ONE legitimate case, so it is a warning the
// user can click through, never a hard block).
// ---------------------------------------------------------------------------

const GLO30 = { id: 584, title: 'Copernicus GLO-30', native_resolution_m: 30.7039 };
const LIDAR = { id: 585, title: 'Newcastle lidar', native_resolution_m: 0.5 };
const UNKNOWN_RES = { id: 586, title: 'Legacy upload' };            // no native_resolution_m
const RES_TERRAINS = [GLO30, LIDAR, UNKNOWN_RES];

describe('TASK-2970 formatResolutionM', () => {
    it('renders one decimal, dropping a trailing .0', () => {
        expect(formatResolutionM(30.7039)).toBe('30.7 m');
        expect(formatResolutionM(0.5)).toBe('0.5 m');
        expect(formatResolutionM(1)).toBe('1 m');
        expect(formatResolutionM(2.25)).toBe('2.3 m');
    });

    it('renders "?" when the resolution is unknown', () => {
        expect(formatResolutionM(null)).toBe('?');
        expect(formatResolutionM(undefined)).toBe('?');
        expect(formatResolutionM(NaN)).toBe('?');
    });
});

describe('TASK-2970 findCoarserAboveFiner (client mirror of the BE rule)', () => {
    it('flags the coarser-above-finer pair, described above/below', () => {
        const pairs = findCoarserAboveFiner(
            [{ terrain_id: 584, priority: 0 }, { terrain_id: 585, priority: 1 }],
            RES_TERRAINS
        );
        expect(pairs.length).toBe(1);
        expect(pairs[0].above.terrain_id).toBe(584);
        expect(pairs[0].above.title).toBe('Copernicus GLO-30');
        expect(pairs[0].above.native_resolution_m).toBe(30.7039);
        expect(pairs[0].below.terrain_id).toBe(585);
        expect(pairs[0].below.native_resolution_m).toBe(0.5);
    });

    it('AC3 direction guard: finest-on-top is clean (never an inverted comparison)', () => {
        expect(findCoarserAboveFiner(
            [{ terrain_id: 585, priority: 0 }, { terrain_id: 584, priority: 1 }],
            RES_TERRAINS
        )).toEqual([]);
    });

    it('an entry with no native_resolution_m never participates', () => {
        expect(findCoarserAboveFiner(
            [{ terrain_id: 586, priority: 0 }, { terrain_id: 585, priority: 1 }],
            RES_TERRAINS
        )).toEqual([]);
        expect(findCoarserAboveFiner(
            [{ terrain_id: 584, priority: 0 }, { terrain_id: 586, priority: 1 }],
            RES_TERRAINS
        )).toEqual([]);
    });

    it('reads priority, not array order (0 = TOP)', () => {
        const pairs = findCoarserAboveFiner(
            [{ terrain_id: 585, priority: 1 }, { terrain_id: 584, priority: 0 }],
            RES_TERRAINS
        );
        expect(pairs.length).toBe(1);
        expect(pairs[0].above.terrain_id).toBe(584);
    });
});

describe('TASK-2970 TWDemStackPicker — resolution per row + insert by resolution', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });

    // TWDemStackPicker is CONTROLLED (it renders `inputs` from props and calls
    // onChange with the next array) — so a two-add sequence MUST re-render with
    // the array the first onChange returned, or the second add is computed
    // against the stale stack.
    function renderPicker(inputs, onChange) {
        return ReactDOM.render(
            <TWDemStackPicker terrains={RES_TERRAINS} inputs={inputs} onChange={onChange}/>,
            container
        );
    }

    function addViaSelect(terrainId) {
        const select = container.querySelector('[data-testid="dem-stack-add-select"]');
        select.value = String(terrainId);
        TestUtils.Simulate.change(select);
    }

    it('AC5: each row shows its native resolution, "?" when unknown', () => {
        renderPicker(
            [
                { terrain_id: 584, priority: 0, unmodified: false },
                { terrain_id: 585, priority: 1, unmodified: false },
                { terrain_id: 586, priority: 2, unmodified: false }
            ],
            () => {}
        );
        const resText = (id) => container
            .querySelector(`[data-testid="dem-stack-row-${id}"] .sv-tw-input-res`)
            .textContent;
        expect(resText(584)).toBe('30.7 m');
        expect(resText(585)).toBe('0.5 m');
        expect(resText(586)).toBe('?');
    });

    it('AC4: adding GLO-30 then the lidar puts the FINER DEM on top (map-6629 regression)', () => {
        const calls = [];
        let inputs = [];
        const onChange = (next) => { calls.push(next); inputs = next; };
        renderPicker(inputs, onChange);
        addViaSelect(584);
        // Re-render with what the picker just produced (it is controlled).
        renderPicker(inputs, onChange);
        addViaSelect(585);

        expect(calls.length).toBe(2);
        const final = calls[1];
        expect(final.length).toBe(2);
        expect(final[0].terrain_id).toBe(585);
        expect(final[0].priority).toBe(0);
        expect(final[1].terrain_id).toBe(584);
        expect(final[1].priority).toBe(1);
        // unmodified flags per today's defaults (first entry seeded false; the
        // base row is locked modifiable by enforceBaseInvariant).
        expect(final[0].unmodified).toBe(false);
        expect(final[1].unmodified).toBe(false);
    });

    it('AC4: a KNOWN resolution is inserted above an existing UNKNOWN entry', () => {
        let result = null;
        renderPicker([{ terrain_id: 586, priority: 0, unmodified: false }], (next) => { result = next; });
        addViaSelect(584);
        expect(result.map(d => d.terrain_id)).toEqual([584, 586]);
        expect(result.map(d => d.priority)).toEqual([0, 1]);
    });

    it('AC4: a new entry with UNKNOWN resolution still appends at the bottom', () => {
        let result = null;
        renderPicker([{ terrain_id: 585, priority: 0, unmodified: false }], (next) => { result = next; });
        addViaSelect(586);
        expect(result.map(d => d.terrain_id)).toEqual([585, 586]);
    });

    it('AC4: a coarser addition lands BELOW a finer entry already in the stack', () => {
        let result = null;
        renderPicker([{ terrain_id: 585, priority: 0, unmodified: false }], (next) => { result = next; });
        addViaSelect(584);
        expect(result.map(d => d.terrain_id)).toEqual([585, 584]);
    });
});

describe('TASK-2970 TWRecipeBuilder — "Derive anyway" acknowledgement', () => {
    let container;
    beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
    afterEach(() => { ReactDOM.unmountComponentAtNode(container); document.body.removeChild(container); });

    const invertedSurface = {
        id: 7,
        title: 'Surface A',
        inputs_ordered: [
            { id: 1, terrain: 584, priority: 0, unmodified: false },
            { id: 2, terrain: 585, priority: 1, unmodified: false }
        ],
        feather_width_m: 10,
        target_resolution_m: 1
    };
    const saneSurface = {
        ...invertedSurface,
        inputs_ordered: [
            { id: 1, terrain: 585, priority: 0, unmodified: false },
            { id: 2, terrain: 584, priority: 1, unmodified: false }
        ]
    };

    function renderBuilder(props = {}) {
        let derivedWith = null;
        const instance = ReactDOM.render(
            <TWRecipeBuilder
                surface={invertedSurface}
                terrains={RES_TERRAINS}
                onUpdate={() => {}}
                onDerive={(id, body) => { derivedWith = { id, body }; }}
                {...props}
            />,
            container
        );
        return { getDerived: () => derivedWith, instance };
    }

    it('AC6: an inverted stack warns in the confirm dialog, naming both terrains', () => {
        renderBuilder();
        container.querySelector('[data-testid="derive-btn"]').click();
        const dialog = container.querySelector('[data-testid="derive-confirm-dialog"]');
        expect(dialog).toExist();
        const warning = container.querySelector('[data-testid="derive-confirm-coarser-warning"]');
        expect(warning).toExist('the coarser-above-finer warning renders');
        // Without an IntlProvider <Message> renders its raw msgId.
        expect(warning.textContent).toInclude('hydrata.anuga.terrainMergeCoarserWarningTitle');
        expect(warning.textContent).toInclude('hydrata.anuga.terrainMergeCoarserWarningBody');
        expect(warning.textContent).toInclude('Copernicus GLO-30');
        expect(warning.textContent).toInclude('30.7 m');
        expect(warning.textContent).toInclude('Newcastle lidar');
        expect(warning.textContent).toInclude('0.5 m');
        // The confirm button becomes "Derive anyway".
        expect(container.querySelector('[data-testid="derive-confirm-ok"]').textContent)
            .toInclude('hydrata.anuga.terrainMergeDeriveAnywayButton');
    });

    it('AC6: confirming an inverted stack sends acknowledge_coarser_above_finer:true', () => {
        const { getDerived } = renderBuilder();
        container.querySelector('[data-testid="derive-btn"]').click();
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        expect(getDerived().body.acknowledge_coarser_above_finer).toBe(true);
    });

    it('AC6: a SANE stack shows no warning and the key is ABSENT from the derive body', () => {
        const { getDerived } = renderBuilder({ surface: saneSurface });
        container.querySelector('[data-testid="derive-btn"]').click();
        expect(container.querySelector('[data-testid="derive-confirm-coarser-warning"]')).toNotExist();
        expect(container.querySelector('[data-testid="derive-confirm-ok"]').textContent)
            .toNotInclude('terrainMergeDeriveAnywayButton');
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        const body = getDerived().body;
        expect(Object.prototype.hasOwnProperty.call(body, 'acknowledge_coarser_above_finer')).toBe(false);
    });

    it('AC7: server-seeded pairs re-open the dialog and the confirm carries the flag, even when the CLIENT sees no inversion', () => {
        // The whole point of the server path: state.terrainWorkbench.terrains was
        // STALE, so the client mirror finds nothing. Recomputing the pairs at
        // confirm-time would drop the flag, get another 400 and re-open forever —
        // the flag must come from whatever pairs OPENED the dialog.
        const staleTerrains = [{ id: 584, title: 'Copernicus GLO-30' }, { id: 585, title: 'Newcastle lidar' }];
        expect(findCoarserAboveFiner(
            [{ terrain_id: 584, priority: 0 }, { terrain_id: 585, priority: 1 }],
            staleTerrains
        )).toEqual([], 'precondition: the client mirror is blind on stale terrains');

        let derivedWith = null;
        const props = {
            surface: invertedSurface,
            terrains: staleTerrains,
            onUpdate: () => {},
            onDerive: (id, body) => { derivedWith = { id, body }; }
        };
        ReactDOM.render(<TWRecipeBuilder {...props} coarserPairsFromServer={null}/>, container);
        expect(container.querySelector('[data-testid="derive-confirm-dialog"]')).toNotExist();

        const serverPairs = [{
            above: { terrain_id: 584, title: 'Copernicus GLO-30', native_resolution_m: 30.7039 },
            below: { terrain_id: 585, title: 'Newcastle lidar', native_resolution_m: 0.5 }
        }];
        ReactDOM.render(<TWRecipeBuilder {...props} coarserPairsFromServer={serverPairs}/>, container);

        const warning = container.querySelector('[data-testid="derive-confirm-coarser-warning"]');
        expect(warning).toExist('the 400 re-opens the confirm dialog');
        expect(warning.textContent).toInclude('Copernicus GLO-30');
        expect(warning.textContent).toInclude('30.7 m');
        container.querySelector('[data-testid="derive-confirm-ok"]').click();
        expect(derivedWith).toExist('the re-ack dispatches a derive');
        expect(derivedWith.body.acknowledge_coarser_above_finer).toBe(true);
    });
});
