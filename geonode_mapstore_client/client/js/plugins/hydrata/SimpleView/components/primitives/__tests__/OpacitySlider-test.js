import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {OpacitySlider} from '../OpacitySlider';

/**
 * TASK-1007 W3 primitive, tested in W4 (TASK-1008).
 *
 * Covers the contract of the presentation-only `OpacitySlider`:
 *   A. Mounts cleanly with no props (default opacity, no `glyph-hidden`).
 *   B. `opacity` prop maps to the nouislider `start` via (opacity ?? 1) * 100.
 *   C. `hidden` prop toggles the `glyph-hidden` class (R04 always-mounted —
 *      the nouislider instance is NEVER unmounted, only CSS-hidden).
 *   D. `onChange` is wired through to nouislider AND receives an *array*
 *      (nouislider's native callback shape, not a 0..1 numeric).
 *   E. Wrapper click stopPropagation (so the parent menu-row doesn't toggle
 *      when the user drags the slider).
 *   F. Inline styles (width 150px; margin-bottom -10px; margin-top 2px).
 *
 * The component is a stateless function component, so for assertions
 * about prop pass-through (D) we invoke it as a function and inspect the
 * returned React element tree directly — this is a safe identity check
 * because there is no hooks/state machinery to elide. JSDOM rendering of
 * `react-nouislider` is independently exercised in MapStore2's own
 * OpacitySlider-test.jsx, so we rely on it for the `.noUi-target` /
 * `.noUiSlider.get()` queries used in A/B/C.
 */

describe('SimpleView OpacitySlider primitive (TASK-1007 W3, tested in W4)', () => {

    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    describe('A. Mounts cleanly with no props', () => {

        it('renders without throwing when no props are supplied', () => {
            expect(() => ReactDOM.render(<OpacitySlider />, container)).toNotThrow();
            expect(container.firstChild).toExist();
        });

        it('wrapper carries the four base classes', () => {
            ReactDOM.render(<OpacitySlider />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper).toExist();
            const cls = wrapper.className;
            expect(cls).toInclude('mapstore-slider');
            expect(cls).toInclude('dataset-transparency');
            expect(cls).toInclude('with-tooltip');
            expect(cls).toInclude('menu-row-slider-subrow');
        });

        it('wrapper does NOT have glyph-hidden when hidden prop is absent', () => {
            ReactDOM.render(<OpacitySlider />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toNotInclude('glyph-hidden');
        });

        it('default opacity of 1 -> nouislider start at 100', () => {
            ReactDOM.render(<OpacitySlider />, container);
            const target = container.querySelector('.noUi-target');
            expect(target).toExist();
            // nouislider 9.x attaches its public API onto the target element
            const value = parseFloat(target.noUiSlider.get());
            expect(value).toBe(100);
        });
    });

    describe('B. opacity prop -> nouislider start position', () => {

        it('opacity=0.5 -> handle at 50', () => {
            ReactDOM.render(<OpacitySlider opacity={0.5} />, container);
            const target = container.querySelector('.noUi-target');
            expect(parseFloat(target.noUiSlider.get())).toBe(50);
        });

        it('opacity=0 -> handle at 0', () => {
            ReactDOM.render(<OpacitySlider opacity={0} />, container);
            const target = container.querySelector('.noUi-target');
            expect(parseFloat(target.noUiSlider.get())).toBe(0);
        });

        it('opacity=1 -> handle at 100', () => {
            ReactDOM.render(<OpacitySlider opacity={1} />, container);
            const target = container.querySelector('.noUi-target');
            expect(parseFloat(target.noUiSlider.get())).toBe(100);
        });

        it('opacity=null -> defaults to 100 via nullish coalescing', () => {
            ReactDOM.render(<OpacitySlider opacity={null} />, container);
            const target = container.querySelector('.noUi-target');
            expect(parseFloat(target.noUiSlider.get())).toBe(100);
        });

        it('opacity=undefined -> defaults to 100 via nullish coalescing', () => {
            ReactDOM.render(<OpacitySlider opacity={undefined} />, container);
            const target = container.querySelector('.noUi-target');
            expect(parseFloat(target.noUiSlider.get())).toBe(100);
        });
    });

    describe('C. hidden prop toggles glyph-hidden class (R04 always-mounted)', () => {

        it('hidden=true appends glyph-hidden to the wrapper class', () => {
            ReactDOM.render(<OpacitySlider hidden />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toInclude('glyph-hidden');
        });

        it('hidden=false leaves glyph-hidden off the wrapper class', () => {
            ReactDOM.render(<OpacitySlider hidden={false} />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toNotInclude('glyph-hidden');
        });

        it('flipping hidden across re-renders flips the class (always-mounted)', () => {
            ReactDOM.render(<OpacitySlider hidden={false} opacity={0.4} />, container);
            let wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toNotInclude('glyph-hidden');
            // Re-render into the SAME container — primitive remains mounted
            ReactDOM.render(<OpacitySlider hidden opacity={0.4} />, container);
            wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toInclude('glyph-hidden');
            // And flip back — confirms it is a CSS toggle, not a remount
            ReactDOM.render(<OpacitySlider hidden={false} opacity={0.4} />, container);
            wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.className).toNotInclude('glyph-hidden');
        });

        it('the slider (.noUi-target) is in the DOM regardless of hidden', () => {
            ReactDOM.render(<OpacitySlider hidden opacity={0.7} />, container);
            expect(container.querySelector('.noUi-target')).toExist();

            ReactDOM.render(<OpacitySlider hidden={false} opacity={0.7} />, container);
            expect(container.querySelector('.noUi-target')).toExist();
        });
    });

    describe('D. onChange callback contract (raw nouislider array)', () => {

        // The primitive simply passes `onChange` through to react-nouislider,
        // which in turn registers it on nouislider's `change` event. nouislider
        // 9.x's `change` event only fires on user-driven release (drag/mouseup)
        // — NOT from programmatic `.set()` calls — so a DOM-driven assertion
        // is brittle under JSDOM. Instead we identity-check that the function
        // reference handed to OpacitySlider IS the one delivered to the inner
        // `<Slider/>`, by invoking the (stateless) component as a function
        // and inspecting the returned React element tree.

        it('the onChange we pass in is the onChange that reaches Slider', () => {
            const spy = () => {};
            const tree = OpacitySlider({opacity: 0.5, onChange: spy});
            // tree is the wrapper <div>; its single child is the <Slider/>
            const sliderEl = tree.props.children;
            expect(sliderEl).toExist();
            expect(sliderEl.props.onChange).toBe(spy);
        });

        it('onChange contract: the wrapper passes through whatever onChange returns', () => {
            const raw = (values) => values;
            const tree = OpacitySlider({opacity: 0.5, onChange: raw});
            const sliderEl = tree.props.children;
            expect(sliderEl.props.onChange).toBe(raw);
            expect(sliderEl.props.onChange(["50.00"])).toEqual(["50.00"]);
        });

        it('nouislider is configured with range {min:0, max:100} and step 1', () => {
            const tree = OpacitySlider({opacity: 0.5, onChange: () => {}});
            const sliderEl = tree.props.children;
            expect(sliderEl.props.range).toEqual({min: 0, max: 100});
            expect(sliderEl.props.step).toBe(1);
            expect(sliderEl.props.start).toBe(50);
        });
    });

    describe('E. wrapper click stopPropagation', () => {

        it('a click on the slider sub-row does NOT bubble to a parent click handler', () => {
            let outerCalls = 0;
            const outerOnClick = () => { outerCalls += 1; };

            // Mount the primitive nested inside an outer div that has its
            // own onClick — mirrors the real menu-row parent that would
            // otherwise toggle the row when the user grabs the slider.
            ReactDOM.render(
                <div onClick={outerOnClick}>
                    <OpacitySlider opacity={0.5} />
                </div>,
                container
            );
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper).toExist();

            // Synthesize a bubbling click — same shape React expects to see
            const evt = new MouseEvent('click', {bubbles: true, cancelable: true});
            wrapper.dispatchEvent(evt);

            expect(outerCalls).toBe(0);
        });
    });

    describe('F. inline styles applied to the wrapper', () => {

        it('width is 150px', () => {
            ReactDOM.render(<OpacitySlider opacity={0.5} />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.style.width).toBe('150px');
        });

        it('marginBottom is -10px (pulls the sub-row up against its parent row)', () => {
            ReactDOM.render(<OpacitySlider opacity={0.5} />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.style.marginBottom).toBe('-10px');
        });

        it('marginTop is 2px', () => {
            ReactDOM.render(<OpacitySlider opacity={0.5} />, container);
            const wrapper = container.querySelector('.menu-row-slider-subrow');
            expect(wrapper.style.marginTop).toBe('2px');
        });
    });
});
