/**
 * TASK-1450 (W3) — HydrologyDetailTemporalPattern component tests.
 *
 * Tests the unconnected HydrologyTemporalPatternClass so we don't need a
 * full redux store. Exercises the preset picker list, curve preview,
 * geography suggestion banner, and advanced manual-edit toggle.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import {
    ALTERNATING_BLOCK,
    SCS_TYPE_II,
    SCS_TYPE_IA,
    PRESET_FAMILIES
} from '../../temporalPatternPresets';

const { HydrologyTemporalPatternClass } = require('../hydrologyDetailTemporalPattern');

describe('TASK-1450 HydrologyDetailTemporalPattern component', () => {
    let container;
    const noop = () => {};

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const mount = (overrides) => {
        const baseProps = {
            activeHydrologyItem: null,
            updateTemporalPatternRowData: noop,
            setTemporalPatternPreset: noop,
            projectLat: null,
            projectLon: null,
            ...overrides
        };
        ReactDOM.render(<HydrologyTemporalPatternClass {...baseProps} />, container);
    };

    // -------------------------------------------------------------------------
    it('renders the preset picker with radio buttons', () => {
        mount({});
        const picker = container.querySelector('#temporal-pattern-preset-picker');
        expect(picker).toExist();
        const radios = container.querySelectorAll('input[type="radio"]');
        // 6 families: Alternating Block + SCS I/IA/II/III + Huff (SCS-SA removed TASK-1498)
        expect(radios.length).toBeGreaterThanOrEqualTo(6);
    });

    it('alternating-block is selected by default', () => {
        mount({});
        const radios = container.querySelectorAll('input[type="radio"]');
        const checked = Array.from(radios).find(r => r.checked);
        expect(checked).toExist();
        expect(checked.value).toBe(ALTERNATING_BLOCK);
    });

    it('shows IDF-note for alternating-block (no fixed curve)', () => {
        mount({});
        const note = container.querySelector('#temporal-pattern-preview-note');
        expect(note).toExist();
        // The chart should NOT be rendered for alternating-block
        const chart = container.querySelector('#temporal-pattern-curve-preview');
        expect(chart).toNotExist();
    });

    it('shows a curve preview when a named preset is selected', () => {
        mount({ activeHydrologyItem: { id: 'tp-1', rowData: [], selectedPreset: SCS_TYPE_II } });
        // Force the component to start with SCS_TYPE_II selected by re-mounting
        // The component initialises selectedKey from activeHydrologyItem.selectedPreset
        const chart = container.querySelector('#temporal-pattern-curve-preview');
        expect(chart).toExist();
        const note = container.querySelector('#temporal-pattern-preview-note');
        expect(note).toNotExist();
    });

    it('does NOT render a suggestion banner when lat/lon are null', () => {
        mount({ projectLat: null, projectLon: null });
        const banner = container.querySelector('#temporal-pattern-suggestion');
        expect(banner).toNotExist();
    });

    it('does NOT render a suggestion banner for South Africa lat/lon (SCS-SA removed, TASK-1498)', () => {
        // suggestPatternFromLatLon(-33.9, 18.4) returns ALTERNATING_BLOCK (SCS-SA removed);
        // component suppresses banner when suggestion === ALTERNATING_BLOCK (no meaningful suggestion).
        mount({ projectLat: -33.9, projectLon: 18.4 });
        const banner = container.querySelector('#temporal-pattern-suggestion');
        expect(banner).toNotExist();
    });

    it('renders a suggestion banner for US Pacific NW lat/lon (SCS_TYPE_IA)', () => {
        // Seattle: lat=47.6, lon=-122.3 → SCS_TYPE_IA (non-default → banner shown)
        mount({ projectLat: 47.6, projectLon: -122.3 });
        const banner = container.querySelector('#temporal-pattern-suggestion');
        expect(banner).toExist();
    });

    it('suggestion banner shows "Use this" button when preset differs from suggestion', () => {
        // Default selected = ALTERNATING_BLOCK; suggestion for Seattle = SCS_TYPE_IA → show button
        mount({ projectLat: 47.6, projectLon: -122.3 });
        const btn = container.querySelector('#temporal-pattern-accept-suggestion');
        expect(btn).toExist();
    });

    it('clicking "Use this" selects the suggested preset', () => {
        let called = null;
        mount({
            projectLat: 47.6,
            projectLon: -122.3,
            activeHydrologyItem: { id: 'tp-suggest', rowData: [] },
            setTemporalPatternPreset: (id, key) => { called = key; }
        });
        const btn = container.querySelector('#temporal-pattern-accept-suggestion');
        expect(btn).toExist();
        ReactTestUtils.Simulate.click(btn);
        expect(called).toBe(SCS_TYPE_IA);
    });

    it('the advanced toggle button is rendered and hides the grid initially', () => {
        mount({});
        const toggle = container.querySelector('#temporal-pattern-advanced-toggle');
        expect(toggle).toExist();
        const manualEdit = container.querySelector('#temporal-pattern-manual-edit');
        // Initially collapsed
        expect(manualEdit).toNotExist();
    });

    it('clicking advanced toggle reveals the manual edit grid', () => {
        mount({ activeHydrologyItem: { id: 'tp-1', rowData: [{percentage: 10}], getChartData: () => [] } });
        const toggle = container.querySelector('#temporal-pattern-advanced-toggle');
        ReactTestUtils.Simulate.click(toggle);
        const manualEdit = container.querySelector('#temporal-pattern-manual-edit');
        expect(manualEdit).toExist();
    });

    it('clicking advanced toggle again collapses the manual edit grid', () => {
        mount({ activeHydrologyItem: { id: 'tp-1', rowData: [], getChartData: () => [] } });
        const toggle = container.querySelector('#temporal-pattern-advanced-toggle');
        ReactTestUtils.Simulate.click(toggle);
        expect(container.querySelector('#temporal-pattern-manual-edit')).toExist();
        ReactTestUtils.Simulate.click(toggle);
        expect(container.querySelector('#temporal-pattern-manual-edit')).toNotExist();
    });

    // -------------------------------------------------------------------------
    // TASK-1529 — preset description demoted from inline text to a hover tooltip
    // -------------------------------------------------------------------------
    it('does NOT render preset descriptions as visible inline text', () => {
        mount({});
        const picker = container.querySelector('#temporal-pattern-preset-picker');
        expect(picker).toExist();
        // The default (alternating-block) description must not appear as a
        // visible inline text node anywhere inside the picker.
        const defaultDesc = PRESET_FAMILIES.find(f => f.id === ALTERNATING_BLOCK).description;
        expect(picker.textContent.indexOf(defaultDesc)).toBe(-1);
    });

    it('exposes each preset description as tooltip/title content on an info icon', () => {
        mount({});
        const picker = container.querySelector('#temporal-pattern-preset-picker');
        const infoIcons = picker.querySelectorAll('.hydrology-preset-info');
        // one info icon per preset family
        expect(infoIcons.length).toBe(PRESET_FAMILIES.length);
        // each icon carries its family description as the native title fallback
        const titles = Array.from(infoIcons).map(el => el.getAttribute('title'));
        PRESET_FAMILIES.forEach(fam => {
            expect(titles.indexOf(fam.description)).toBeGreaterThanOrEqualTo(0);
        });
    });

    it('still shows the short preset label inline', () => {
        mount({});
        const picker = container.querySelector('#temporal-pattern-preset-picker');
        const altBlock = PRESET_FAMILIES.find(f => f.id === ALTERNATING_BLOCK);
        expect(picker.textContent.indexOf(altBlock.label)).toBeGreaterThanOrEqualTo(0);
    });

    it('clicking a different radio dispatches setTemporalPatternPreset', () => {
        let called = null;
        mount({
            activeHydrologyItem: { id: 'tp-99', rowData: [] },
            setTemporalPatternPreset: (id, key) => { called = { id, key }; }
        });
        const scsIIRadio = container.querySelector(`input[value="${SCS_TYPE_II}"]`);
        expect(scsIIRadio).toExist();
        ReactTestUtils.Simulate.change(scsIIRadio, { target: { value: SCS_TYPE_II } });
        expect(called).toExist();
        expect(called.id).toBe('tp-99');
        expect(called.key).toBe(SCS_TYPE_II);
    });
});
