/*
 * TASK-2083 (epic 2077) — "+ Add new" hint in the picker (PickerView) phase
 * of the SHARED VectorDrawPopup component.
 *
 * Design constraint (AC2): VectorDrawPopup must stay formConfig-agnostic —
 * no hardcoded inflow-specific copy lives in the shared component. It only
 * conditionally renders `formConfig.addAnotherHint` (an i18n msgId) when the
 * caller's formConfig declares it. Only the `inf_` formConfig
 * (SimpleView/components/simpleViewMenuRow.js ANUGA_FEATURE_CONFIG.inf_)
 * currently sets this key; boundary/friction/etc. formConfigs do not, so
 * their pickers render no hint at all — proving the copy is formConfig-driven
 * rather than baked into the shared component.
 *
 * <Message> renders its raw msgId as text when no intl context is mounted
 * (see MapStore2/web/client/components/I18N/Message.jsx renderMsg — no
 * `this.context.intl` in these unwrapped ReactDOM.render tests), so
 * asserting the hint element's textContent against the msgId string is the
 * established pattern in this test suite (see anugaScenarioMillerColumns-test.js).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { PickerView } from '../components/VectorDrawPopup';
import { ANUGA_FEATURE_CONFIG } from '../../SimpleView/components/simpleViewMenuRow';

const oneFeature = [{ id: 'lyr.1', properties: { title: 'Feature 01' } }];

describe('TASK-2083 VectorDrawPopup PickerView "+ Add new" hint (formConfig-driven)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    const render = (formConfig, featureList = oneFeature) => {
        ReactDOM.render(
            <PickerView
                formConfig={formConfig}
                featureList={featureList}
                deletingFeatureId={null}
                onCancel={() => {}}
                onSelectFeature={() => {}}
                onDeleteFeature={() => {}}
            />,
            container
        );
    };

    it('renders the hint when formConfig declares addAnotherHint (the real inf_ formConfig)', () => {
        render(ANUGA_FEATURE_CONFIG.inf_.formConfig);
        const hint = container.querySelector('.sv-vector-draw-picker-add-new-hint');
        expect(hint).toExist();
        expect(hint.textContent).toInclude('hydrata.anuga.inflowAddAnotherHint');
    });

    it('inf_ formConfig.addAnotherHint resolves to the expected msgId (pins the wiring)', () => {
        expect(ANUGA_FEATURE_CONFIG.inf_.formConfig.addAnotherHint).toBe('hydrata.anuga.inflowAddAnotherHint');
    });

    it('renders NOTHING (no hardcoded inflow copy) for the boundary formConfig, which declares no addAnotherHint', () => {
        expect(ANUGA_FEATURE_CONFIG.bdy_.formConfig.addAnotherHint).toBe(undefined);
        render(ANUGA_FEATURE_CONFIG.bdy_.formConfig);
        expect(container.querySelector('.sv-vector-draw-picker-add-new-hint')).toBe(null);
        // Sanity: the popup body itself still rendered fine (no crash / blank).
        expect(container.querySelector('.sv-vector-draw-picker-add-new')).toExist();
    });

    it('renders nothing for a plain formConfig with only a title (e.g. filter-test fixture shape)', () => {
        render({ title: 'Boundary' });
        expect(container.querySelector('.sv-vector-draw-picker-add-new-hint')).toBe(null);
    });

    it('does not crash when formConfig is undefined', () => {
        render(undefined);
        expect(container.querySelector('.sv-vector-draw-picker-add-new-hint')).toBe(null);
        expect(container.querySelector('.sv-vector-draw-picker-add-new')).toExist();
    });
});
