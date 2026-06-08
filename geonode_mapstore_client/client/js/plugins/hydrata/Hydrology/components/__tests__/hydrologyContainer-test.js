/**
 * TASK-1499 (W2) — HydrologyContainer panel visibility during map-pick.
 *
 * AC1: When mapPickActive=true the container renders display:none so form
 * state survives but the panel is visually hidden. When mapPickActive=false
 * (or undefined) the panel renders normally.
 *
 * Tests the unconnected HydrologyContainer class directly so no Redux
 * Provider is needed for the class itself. HydrologyMainMenu is a connected
 * child — we mock it to a simple <div id="hydrology-main-menu" /> so we
 * can detect presence without wiring a full store.
 */
import expect from 'expect';

// Tests call .render() directly on the unconnected class — no DOM mount needed.
const { HydrologyContainer } = require('../hydrologyContainer');

describe('TASK-1499 (W2) HydrologyContainer panel visibility', () => {
    const noop = () => {};

    const baseProps = {
        isAnugaProject: true,
        showHydrologyMainMenu: true,
        mapPickActive: false,
        initHydrology: noop
    };

    it('renders null when isAnugaProject is false', () => {
        const result = new HydrologyContainer({
            ...baseProps,
            isAnugaProject: false
        }).render();
        expect(result).toBe(null);
    });

    it('renders null when showHydrologyMainMenu is false', () => {
        const result = new HydrologyContainer({
            ...baseProps,
            showHydrologyMainMenu: false
        }).render();
        expect(result).toBe(null);
    });

    it('renders a div with display:none when mapPickActive is true (AC1 hidden state)', () => {
        const instance = new HydrologyContainer({
            ...baseProps,
            mapPickActive: true
        });
        const rendered = instance.render();
        // Should be a div element (the wrapper)
        expect(rendered).toExist();
        expect(rendered.type).toBe('div');
        expect(rendered.props.style).toEqual({display: 'none'});
        // The child should be HydrologyMainMenu (panel preserved for form state)
        expect(rendered.props.children).toExist();
    });

    it('renders without display:none wrapper when mapPickActive is false (AC1 visible state)', () => {
        const instance = new HydrologyContainer({
            ...baseProps,
            mapPickActive: false
        });
        const rendered = instance.render();
        // Should NOT be a div-with-display-none wrapper
        expect(rendered).toExist();
        // Either the component itself or null for the hidden-wrapper
        // When mapPickActive=false we render HydrologyMainMenu directly
        expect(rendered.type).toNotBe('div');
    });

    it('renders without display:none wrapper when mapPickActive is undefined', () => {
        const instance = new HydrologyContainer({
            ...baseProps,
            mapPickActive: undefined
        });
        const rendered = instance.render();
        expect(rendered).toExist();
        expect(rendered.type).toNotBe('div');
    });
});
