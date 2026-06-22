/**
 * TASK-1869 (epic 1814 W5.4) — VerticalExaggerationSlider karma tests.
 *
 * Specs:
 *   1. Hidden when visible=false (not in Cesium 3D mode)
 *   2. Visible in Cesium 3D mode (visible=true)
 *   3. Renders the label showing the current exaggeration value
 *   4. Renders the nouislider element
 *   5. handleChange dispatches the correct numeric value
 *   6. handleChange parses string values correctly
 *   7. handleChange ignores non-numeric input
 *   8. Defaults label to 1.0× when verticalExaggeration is undefined
 *   9. Constants have sensible values
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

import {
    VerticalExaggerationSliderClass,
    VERT_EXAG_DEFAULT,
    VERT_EXAG_MIN,
    VERT_EXAG_MAX
} from '../VerticalExaggerationSlider';

describe('VerticalExaggerationSlider (TASK-1869)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
    });

    const renderSlider = (props = {}) => {
        const defaultProps = {
            visible: true,
            verticalExaggeration: VERT_EXAG_DEFAULT,
            onChangeExaggeration: () => {}
        };
        TestUtils.act(() => {
            ReactDOM.render(
                <VerticalExaggerationSliderClass {...defaultProps} {...props} />,
                container
            );
        });
    };

    it('renders null when visible=false (not in 3D mode)', () => {
        renderSlider({ visible: false });
        const panel = container.querySelector('[data-testid="vertical-exaggeration-panel"]');
        expect(panel).toBe(null);
    });

    it('renders the panel when visible=true (Cesium 3D mode)', () => {
        renderSlider({ visible: true });
        const panel = container.querySelector('[data-testid="vertical-exaggeration-panel"]');
        expect(panel).toBeTruthy();
    });

    it('renders the label with the current exaggeration value', () => {
        renderSlider({ visible: true, verticalExaggeration: 2.5 });
        const label = container.querySelector('[data-testid="vertical-exaggeration-label"]');
        expect(label).toBeTruthy();
        expect(label.textContent).toInclude('2.5');
    });

    it('renders the slider element', () => {
        renderSlider({ visible: true });
        const sliderEl = container.querySelector('[data-testid="vertical-exaggeration-slider"]');
        expect(sliderEl).toBeTruthy();
    });

    it('defaults label to 1.0 when verticalExaggeration is undefined', () => {
        renderSlider({ visible: true, verticalExaggeration: undefined });
        const label = container.querySelector('[data-testid="vertical-exaggeration-label"]');
        expect(label).toBeTruthy();
        expect(label.textContent).toInclude('1.0');
    });

    it('handleChange dispatches the new exaggeration value (array input)', () => {
        let dispatched = null;
        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        TestUtils.act(() => {
            ReactDOM.render(
                <VerticalExaggerationSliderClass
                    visible={true}
                    verticalExaggeration={1.0}
                    onChangeExaggeration={(v) => { dispatched = v; }}
                />,
                c2
            );
        });
        const instance = TestUtils.findRenderedComponentWithType(
            TestUtils.renderIntoDocument(
                <VerticalExaggerationSliderClass
                    visible={true}
                    verticalExaggeration={1.0}
                    onChangeExaggeration={(v) => { dispatched = v; }}
                />
            ),
            VerticalExaggerationSliderClass
        );
        instance.handleChange([3.0]);
        expect(dispatched).toBe(3.0);
        ReactDOM.unmountComponentAtNode(c2);
        document.body.removeChild(c2);
    });

    it('handleChange parses a string value correctly', () => {
        let dispatched = null;
        const instance = TestUtils.renderIntoDocument(
            <VerticalExaggerationSliderClass
                visible={true}
                verticalExaggeration={1.0}
                onChangeExaggeration={(v) => { dispatched = v; }}
            />
        );
        instance.handleChange(['2.5']);
        expect(dispatched).toBe(2.5);
    });

    it('handleChange ignores non-numeric input (no dispatch)', () => {
        let dispatched = null;
        const instance = TestUtils.renderIntoDocument(
            <VerticalExaggerationSliderClass
                visible={true}
                verticalExaggeration={1.0}
                onChangeExaggeration={(v) => { dispatched = v; }}
            />
        );
        instance.handleChange(['nan']);
        expect(dispatched).toBe(null);
    });

    it('VERT_EXAG constants are correct', () => {
        expect(VERT_EXAG_DEFAULT).toBe(1.0);
        expect(VERT_EXAG_MIN).toBe(1);
        expect(VERT_EXAG_MAX).toBe(5);
    });
});
