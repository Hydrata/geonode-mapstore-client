/*
 * TASK-784 polish — fonts inside the VectorDraw popup must be uniform
 * across all five phases (picking / drawing / form / saving / error).
 *
 * Strategy: render the connected component for each phase + form-bearing
 * variant, then walk every descendant inside .vector-draw-popup and
 * assert NONE of them carry an inline fontSize / fontWeight / fontFamily
 * style override. Inline overrides were the documented root cause of the
 * inconsistency the user reported.
 *
 * Also asserts that no <strong>, <b>, or <h1>..<h6> tag exists in the
 * rendered output (those add weight or size implicitly via user-agent
 * styles).
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import VectorDrawPopup from '../components/VectorDrawPopup';

function makeStore(state) {
    return {
        getState: () => state,
        subscribe: () => () => {},
        dispatch: () => {}
    };
}

function render(state) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    ReactDOM.render(
        <Provider store={makeStore(state)}>
            <VectorDrawPopup />
        </Provider>,
        container
    );
    return container;
}

function teardown(container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
}

const FORM_CONFIG = {
    title: 'Test Boundary',
    fields: [
        { name: 'kind', label: 'Kind', type: 'select', options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' }
        ] },
        { name: 'flow', label: 'Flow', type: 'number', min: 0, max: 100 },
        { name: 'note', label: 'Note', type: 'text' },
        { name: 'enabled', label: 'Enabled', type: 'checkbox' }
    ]
};

const STATES = {
    picking: {
        vectorDraw: {
            phase: 'picking',
            config: { formConfig: FORM_CONFIG, geomType: 'Polygon' },
            featureList: [
                { id: 'bdy.1', properties: { description: 'Outflow A' } },
                { id: 'bdy.2', properties: { description: 'Outflow B' } }
            ],
            formValues: {}
        },
        draw: { tempFeatures: [], features: [] }
    },
    drawingCreate: {
        vectorDraw: {
            phase: 'drawing',
            config: { formConfig: FORM_CONFIG, geomType: 'Polygon' },
            formValues: {},
            featureList: []
        },
        draw: { tempFeatures: [], features: [] }
    },
    drawingEditInline: {
        vectorDraw: {
            phase: 'drawing',
            config: { featureId: 'bdy.1', formConfig: FORM_CONFIG, geomType: 'Polygon' },
            formValues: { kind: 'a', flow: 5, note: 'hi', enabled: true },
            featureList: []
        },
        draw: { tempFeatures: [], features: [] }
    },
    form: {
        vectorDraw: {
            phase: 'form',
            config: { formConfig: FORM_CONFIG, geomType: 'Polygon' },
            formValues: {},
            featureList: []
        },
        draw: { tempFeatures: [], features: [] }
    },
    saving: {
        vectorDraw: {
            phase: 'saving',
            config: { formConfig: FORM_CONFIG, geomType: 'Polygon' },
            formValues: {},
            featureList: []
        },
        draw: { tempFeatures: [], features: [] }
    },
    error: {
        vectorDraw: {
            phase: 'error',
            config: { formConfig: FORM_CONFIG, geomType: 'Polygon' },
            formValues: {},
            featureList: []
        },
        draw: { tempFeatures: [], features: [] }
    }
};

const FORBIDDEN_INLINE_STYLES = ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight'];
const FORBIDDEN_TAGS = ['STRONG', 'B', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'EM'];

describe('TASK-784 VectorDraw popup font uniformity', () => {

    Object.keys(STATES).forEach(phaseName => {
        describe(`phase=${phaseName}`, () => {
            let container;
            let popup;

            beforeEach(() => {
                container = render(STATES[phaseName]);
                popup = container.querySelector('.vector-draw-popup');
            });

            afterEach(() => {
                teardown(container);
            });

            it('renders a .vector-draw-popup root', () => {
                expect(popup).toExist();
            });

            it('does not contain any <strong>, <b>, <em>, or <h1>..<h6> tag', () => {
                const all = popup.querySelectorAll('*');
                const offenders = [];
                all.forEach(el => {
                    if (FORBIDDEN_TAGS.indexOf(el.tagName) !== -1) {
                        offenders.push(el.tagName.toLowerCase());
                    }
                });
                expect(offenders).toEqual([]);
            });

            it('has no inline fontSize / fontWeight / fontFamily / lineHeight on root or descendants', () => {
                const all = [popup, ...popup.querySelectorAll('*')];
                const offenders = [];
                all.forEach(el => {
                    FORBIDDEN_INLINE_STYLES.forEach(prop => {
                        // el.style.fontSize etc — empty string when absent.
                        if (el.style && el.style[prop]) {
                            offenders.push(`${el.tagName.toLowerCase()}.style.${prop}=${el.style[prop]}`);
                        }
                    });
                });
                expect(offenders).toEqual([]);
            });
        });
    });
});
