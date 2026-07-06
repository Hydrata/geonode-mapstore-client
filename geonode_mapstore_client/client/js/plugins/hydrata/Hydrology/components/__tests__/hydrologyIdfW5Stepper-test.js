/**
 * TASK-1452 (W5) — IDF Derive vertical stepper + Manual|Derive segmented
 * control redesign tests.
 *
 * Tests:
 *  1. When on the idf-derive page, the Derive segment is active (is-active
 *     class on Derive button). NOTE: the global default page is now
 *     sv-idf-table (Input-first; UAT 2026-06-23) — this test sets the
 *     idf-derive prop explicitly, so it does not exercise that default.
 *  2. Clicking Manual calls setActiveHydrologyPage('sv-idf-table').
 *  3. Clicking Derive calls setActiveHydrologyPage('idf-derive').
 *  4. The IDF Derive panel renders the 4 step headers (step-location,
 *     step-parameters, step-derive, step-results).
 *  5. Step 1 (Location) renders lat/lon inputs + Pick-on-map button.
 *  6. Step 2 (Parameters) renders durations + return-periods inputs.
 *  7. Step 3 (Derive) renders the Derive button; disabled when !celeryEnabled.
 *  8. Derive button disabled reason = first validation error when present.
 *  9. Step 4 (Results) renders only when result is set.
 * 10. Provenance is collapsed by default; toggling opens it.
 * 11. Derived result renders the read-only table in the Results step.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

const {
    HydrologyDetailIdfDeriveClass
} = require('../hydrologyDetailIdfDerive');

import { HydrologyListDetailContainerClass } from '../hydrologyListDetailContainer';

// ── Minimal Redux store for connected child components ──────────────────
function makeMinimalStore(idfDeriveState = {}) {
    const defaultIdfDerive = {
        celeryAnugaEnabled: true,
        lat: null,
        lon: null,
        durationsText: '60, 1440',
        rpsText: '2, 100',
        mapPickActive: false,
        inFlight: false,
        error: null,
        result: null
    };
    return createStore(
        (s = {hydrology: {idfDerive: {...defaultIdfDerive, ...idfDeriveState}}}) => s,
        {hydrology: {idfDerive: {...defaultIdfDerive, ...idfDeriveState}}}
    );
}

// ── Shared test fixtures ────────────────────────────────────────────────
const noop = () => {};

const baseIdfDeriveProps = {
    projectId: 42,
    lat: -37.8,
    lon: 144.9,
    durationsText: '60, 180, 1440',
    rpsText: '2, 10, 100',
    mapPickActive: false,
    processId: null,
    error: null,
    result: null,
    celeryAnugaEnabled: true,
    inFlight: false,
    setIdfDeriveLat: noop,
    setIdfDeriveLon: noop,
    setIdfDeriveDurations: noop,
    setIdfDeriveRPs: noop,
    setIdfDeriveMapPickActive: noop,
    deriveIdfRequest: noop
};

const defaultContainerProps = {
    activeHydrologyPage: 'idf-derive',
    activeHydrologyItems: [],
    activeHydrologyItem: null,
    setActiveHydrologyItem: noop,
    setActiveHydrologyPage: noop,
    updateActiveHydrologyItem: noop,
    saveHydrologyItem: noop,
    createHydrologyForm: noop,
    deleteHydrologyItem: noop
};

// ── Test suite ──────────────────────────────────────────────────────────
describe('TASK-1452 (W5) IDF Derive stepper + segmented control', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) container.parentNode.removeChild(container);
    });

    const mountDerive = (overrides) => {
        const props = {...baseIdfDeriveProps, ...overrides};
        const ref = React.createRef();
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyDetailIdfDeriveClass ref={ref} {...props} />,
                container
            );
        });
        return ref.current;
    };

    const mountContainerWithProvider = (propsOverrides) => {
        const store = makeMinimalStore();
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <Provider store={store}>
                    <HydrologyListDetailContainerClass
                        {...defaultContainerProps}
                        {...propsOverrides}
                    />
                </Provider>,
                container
            );
        });
    };

    // ── Segmented control tests ─────────────────────────────────────────

    it('segmented control renders with Manual and Derive buttons', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultContainerProps}
                    activeHydrologyPage="sv-idf-table"
                />,
                container
            );
        });
        const segments = container.querySelectorAll('.sv-hydrology-idf-segment');
        expect(segments.length).toBe(2);
    });

    it('Derive segment is active by default (idf-derive page)', () => {
        mountContainerWithProvider({activeHydrologyPage: 'idf-derive'});
        const deriveBtn = container.querySelector('#idf-mode-derive');
        expect(deriveBtn).toExist();
        expect(deriveBtn.className).toInclude('is-active');
        const manualBtn = container.querySelector('#idf-mode-manual');
        expect(manualBtn.className).toNotInclude('is-active');
    });

    it('Manual segment is active when on sv-idf-table page', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultContainerProps}
                    activeHydrologyPage="sv-idf-table"
                    activeHydrologyItem={null}
                />,
                container
            );
        });
        const manualBtn = container.querySelector('#idf-mode-manual');
        expect(manualBtn).toExist();
        expect(manualBtn.className).toInclude('is-active');
    });

    it('clicking Manual segment calls setActiveHydrologyPage("sv-idf-table")', () => {
        let calledWith = null;
        mountContainerWithProvider({
            activeHydrologyPage: 'idf-derive',
            setActiveHydrologyPage: (p) => { calledWith = p; }
        });
        const manualBtn = container.querySelector('#idf-mode-manual');
        ReactTestUtils.act(() => { manualBtn.click(); });
        expect(calledWith).toBe('sv-idf-table');
    });

    // TASK-2126 — "Derive" gated ("Coming soon") for the bundled launch: the
    // segment is disabled and clicking it no longer switches to idf-derive.
    it('Derive segment is disabled and clicking it does not call setActiveHydrologyPage', () => {
        let calledWith = null;
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultContainerProps}
                    activeHydrologyPage="sv-idf-table"
                    activeHydrologyItem={null}
                    setActiveHydrologyPage={(p) => { calledWith = p; }}
                />,
                container
            );
        });
        const deriveBtn = container.querySelector('#idf-mode-derive');
        expect(deriveBtn.disabled).toBe(true);
        ReactTestUtils.act(() => { deriveBtn.click(); });
        expect(calledWith).toBe(null);
    });

    it('segmented control not rendered for non-IDF pages', () => {
        ReactTestUtils.act(() => {
            ReactDOM.render(
                <HydrologyListDetailContainerClass
                    {...defaultContainerProps}
                    activeHydrologyPage="temporal-pattern"
                    activeHydrologyItem={null}
                />,
                container
            );
        });
        const segments = container.querySelectorAll('.sv-hydrology-idf-segment');
        expect(segments.length).toBe(0);
    });

    // ── Stepper structure tests ─────────────────────────────────────────

    it('renders all 4 step blocks (location, parameters, derive, results-absent when no result)', () => {
        mountDerive({});
        expect(container.querySelector('#idf-derive-step-location')).toExist();
        expect(container.querySelector('#idf-derive-step-parameters')).toExist();
        expect(container.querySelector('#idf-derive-step-derive')).toExist();
        // Results step is absent when result=null
        expect(container.querySelector('#idf-derive-step-results')).toNotExist();
    });

    it('Step 1 — Location: renders lat + lon inputs and Pick-on-map button', () => {
        mountDerive({});
        expect(container.querySelector('#idf-derive-lat')).toExist();
        expect(container.querySelector('#idf-derive-lon')).toExist();
        expect(container.querySelector('#idf-derive-pick-on-map')).toExist();
    });

    it('Step 2 — Parameters: renders the duration×RP matrix (W3 replacement for text inputs)', () => {
        // W3 (TASK-1500): text inputs replaced by boolean matrix.
        // Old #idf-derive-durations and #idf-derive-rps inputs are gone.
        mountDerive({});
        // The matrix wrapper must be present in step-parameters
        const step2 = container.querySelector('#idf-derive-step-parameters');
        expect(step2).toExist();
        const matrix = step2.querySelector('.sv-idf-matrix-wrapper');
        expect(matrix).toExist();
        // The hours display toggle checkbox must be present
        const hoursToggle = step2.querySelector('#idf-matrix-show-hours');
        expect(hoursToggle).toExist();
    });

    it('Step 2 — Parameters: sub-daily banner shows when min duration < 1440', () => {
        mountDerive({durationsText: '60, 720'});
        expect(container.querySelector('#idf-derive-sub-daily-banner')).toExist();
    });

    it('Step 2 — Parameters: sub-daily banner absent when all durations >= 1440', () => {
        mountDerive({durationsText: '1440, 2880'});
        expect(container.querySelector('#idf-derive-sub-daily-banner')).toNotExist();
    });

    it('Step 3 — Derive: Derive button is present and enabled with valid inputs', () => {
        mountDerive({});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn).toExist();
        expect(btn.disabled).toBe(false);
    });

    it('Step 3 — Derive: button is disabled when lat/lon missing', () => {
        mountDerive({lat: null, lon: null});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Step 3 — Derive: button is disabled when !celeryAnugaEnabled', () => {
        mountDerive({celeryAnugaEnabled: false});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Step 3 — Derive: unavailable notice shown when !celeryAnugaEnabled', () => {
        mountDerive({celeryAnugaEnabled: false});
        expect(container.querySelector('#sv-idf-derive-unavailable')).toExist();
    });

    it('Step 3 — Derive: error message shown when error prop is set', () => {
        mountDerive({error: 'ERA5 fetch failed'});
        const err = container.querySelector('#sv-idf-derive-error');
        expect(err).toExist();
        expect(err.textContent).toInclude('ERA5');
    });

    it('Step 3 — Derive: progress shown when inFlight + processId set', () => {
        mountDerive({inFlight: true, processId: 77, processName: 'IDF @ (-37.8,144.9)'});
        const progress = container.querySelector('#sv-idf-derive-progress');
        expect(progress).toExist();
    });

    it('Step 4 — Results: absent when result=null', () => {
        mountDerive({result: null});
        expect(container.querySelector('#idf-derive-step-results')).toNotExist();
    });

    it('Step 4 — Results: renders when result is set', () => {
        const result = {
            id: 5,
            durations_min: [60, 1440],
            return_periods_yr: [2, 100],
            intensities_mm_per_hr: [[10.5, 50.1], [3.2, 12.4]],
            ci_lower_mm_per_hr: [[9.0, 45.0], [2.8, 11.0]],
            ci_upper_mm_per_hr: [[12.0, 55.0], [3.6, 13.5]],
            provenance: {source: 'ERA5-Land'}
        };
        mountDerive({result});
        expect(container.querySelector('#idf-derive-step-results')).toExist();
        expect(container.querySelector('#sv-idf-derive-results')).toExist();
    });

    it('Step 4 — Results: download JSON and CSV buttons present', () => {
        const result = {
            id: 5,
            durations_min: [60],
            return_periods_yr: [2],
            intensities_mm_per_hr: [[10.5]],
            ci_lower_mm_per_hr: [[9.0]],
            ci_upper_mm_per_hr: [[12.0]],
            provenance: {}
        };
        mountDerive({result});
        expect(container.querySelector('#idf-derive-download-json')).toExist();
        expect(container.querySelector('#idf-derive-download-csv')).toExist();
    });

    it('Step 4 — Provenance is collapsed by default (pre element absent)', () => {
        const result = {
            id: 5,
            durations_min: [60],
            return_periods_yr: [2],
            intensities_mm_per_hr: [[10.5]],
            ci_lower_mm_per_hr: [[9.0]],
            ci_upper_mm_per_hr: [[12.0]],
            provenance: {source: 'ERA5-Land'}
        };
        mountDerive({result});
        const pre = container.querySelector('.sv-idf-derive-provenance-pre');
        expect(pre).toNotExist();
    });

    it('Step 4 — Provenance expands when toggle clicked', () => {
        const result = {
            id: 5,
            durations_min: [60],
            return_periods_yr: [2],
            intensities_mm_per_hr: [[10.5]],
            ci_lower_mm_per_hr: [[9.0]],
            ci_upper_mm_per_hr: [[12.0]],
            provenance: {source: 'ERA5-Land', period_of_record: '1981-2024'}
        };
        mountDerive({result});
        const toggle = container.querySelector('.sv-idf-derive-provenance-toggle');
        expect(toggle).toExist();
        ReactTestUtils.act(() => {
            ReactTestUtils.Simulate.click(toggle);
        });
        const pre = container.querySelector('.sv-idf-derive-provenance-pre');
        expect(pre).toExist();
        expect(pre.textContent).toInclude('ERA5-Land');
    });

    it('Pick-on-map toggle button has bsStyle primary when mapPickActive=true', () => {
        mountDerive({mapPickActive: true});
        const pickBtn = container.querySelector('#idf-derive-pick-on-map');
        // React-Bootstrap renders bsStyle=primary as "btn-primary"
        expect(pickBtn.className).toInclude('btn-primary');
    });

    it('Pick-on-map toggle button has bsStyle default when mapPickActive=false', () => {
        mountDerive({mapPickActive: false});
        const pickBtn = container.querySelector('#idf-derive-pick-on-map');
        expect(pickBtn.className).toInclude('btn-default');
    });
});
