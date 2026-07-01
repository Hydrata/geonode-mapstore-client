import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {ScenarioCategoryRail} from '../scenarioCategoryRail';

/**
 * TASK-2045 (F3, epic 2037 W1b) — the rail must resolve scenario.boundary
 * against the `boundaries` resource list and pass boundaryHasFeatures into
 * validateCategoryProgress, so an auto-scaffolded empty boundary reads
 * NOT-ready (2/3, not a false 3/3).
 *
 * Mounted standalone (same precedent as scenarioRail-test.js) — Message
 * falls back to its msgId string with no intl Provider, so no context
 * wiring is required to assert on the tag pill text.
 */
describe('TASK-2045 ScenarioCategoryRail — boundary feature-presence gating', () => {
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

    const scenario = {terrain: 1, boundary: 42, inflow: 3};

    function getInputsTagText() {
        const inputsItem = container.querySelector('.anuga-scenario-category-section-inputs .sv-anuga-scenario-category-item');
        return inputsItem.querySelector('.sv-anuga-scenario-category-item-tag').textContent;
    }

    it('reads 2/3 (not ready) when the selected boundary resource has has_features=false', (done) => {
        const boundaries = [{id: 42, title: 'Empty scaffold boundary', has_features: false}];
        ReactDOM.render(
            <ScenarioCategoryRail scenario={scenario} boundaries={boundaries} selectedCategoryId="inputs" />,
            container,
            () => {
                expect(getInputsTagText()).toBe('2/3');
                done();
            }
        );
    });

    it('reads 3/3 (ready) when the selected boundary resource has has_features=true', (done) => {
        const boundaries = [{id: 42, title: 'Drawn boundary', has_features: true}];
        ReactDOM.render(
            <ScenarioCategoryRail scenario={scenario} boundaries={boundaries} selectedCategoryId="inputs" />,
            container,
            () => {
                expect(getInputsTagText()).toBe('3/3');
                done();
            }
        );
    });

    it('reads 3/3 (backward-safe default) when the boundaries list has not loaded yet (undefined prop)', (done) => {
        ReactDOM.render(
            <ScenarioCategoryRail scenario={scenario} selectedCategoryId="inputs" />,
            container,
            () => {
                expect(getInputsTagText()).toBe('3/3');
                done();
            }
        );
    });

    it('reads 3/3 (backward-safe default) when the selected boundary id is not yet present in boundaries', (done) => {
        ReactDOM.render(
            <ScenarioCategoryRail scenario={scenario} boundaries={[]} selectedCategoryId="inputs" />,
            container,
            () => {
                expect(getInputsTagText()).toBe('3/3');
                done();
            }
        );
    });
});
