/**
 * TASK-934 — IDF Derive panel render + behaviour tests.
 *
 * Tests the unconnected HydrologyDetailIdfDeriveClass so we don't need a
 * full redux store wired up. Helpers (parseNumberList, downloadProvenanceJson)
 * are exercised as pure functions.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';

const {
    HydrologyDetailIdfDeriveClass,
    parseNumberList,
    SUB_DAILY_THRESHOLD_MIN
} = require('../hydrologyDetailIdfDerive');

describe('TASK-934 HydrologyDetailIdfDerive panel', () => {
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

    const baseProps = {
        projectId: 42,
        lat: -37.8,
        lon: 144.9,
        durationsText: '60, 180, 360, 720, 1440, 2880, 10080',
        rpsText: '2, 5, 10, 20, 50, 100, 200',
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

    const mount = (overrides) => {
        const props = {...baseProps, ...overrides};
        const ref = React.createRef();
        ReactDOM.render(
            <HydrologyDetailIdfDeriveClass ref={ref} {...props}/>,
            container
        );
        return ref.current;
    };

    it('renders the panel and Derive button when celery_anuga_enabled', () => {
        mount({});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn).toExist();
        expect(btn.disabled).toBe(false);
    });

    it('renders an inline "unavailable" message and HIDES Derive when celery_anuga_enabled=false', () => {
        mount({celeryAnugaEnabled: false});
        const unavailable = container.querySelector('#idf-derive-unavailable');
        const btn = container.querySelector('#idf-derive-button');
        expect(unavailable).toExist();
        expect(btn).toNotExist();
    });

    it('shows sub-daily warning banner when min(durations) < 1440', () => {
        mount({durationsText: '60, 1440, 2880'});
        const banner = container.querySelector('#idf-derive-sub-daily-banner');
        expect(banner).toExist();
    });

    it('hides sub-daily warning banner when all durations >= 1440', () => {
        mount({durationsText: '1440, 2880, 10080'});
        const banner = container.querySelector('#idf-derive-sub-daily-banner');
        expect(banner).toNotExist();
    });

    it('SUB_DAILY_THRESHOLD_MIN is 1440 (24h)', () => {
        expect(SUB_DAILY_THRESHOLD_MIN).toBe(1440);
    });

    it('Derive button disabled when no lat/lon', () => {
        mount({lat: null, lon: null});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn).toExist();
        expect(btn.disabled).toBe(true);
    });

    it('Derive button disabled when durations include non-number', () => {
        mount({durationsText: '60, foo, 720'});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Derive button disabled when a duration is below 60min', () => {
        mount({durationsText: '30, 60'});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Derive button disabled when duplicate return periods', () => {
        mount({rpsText: '2, 5, 10, 10'});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Derive button click dispatches deriveIdfRequest', () => {
        let called = 0;
        mount({deriveIdfRequest: () => { called += 1; }});
        const btn = container.querySelector('#idf-derive-button');
        ReactTestUtils.Simulate.click(btn);
        expect(called).toBe(1);
    });

    it('Pick on map click toggles mapPickActive', () => {
        let toggled = null;
        mount({setIdfDeriveMapPickActive: (a) => { toggled = a; }});
        const pickBtn = container.querySelector('#idf-derive-pick-on-map');
        ReactTestUtils.Simulate.click(pickBtn);
        expect(toggled).toBe(true);
    });

    it('renders error message inline when error is set', () => {
        mount({error: 'BE said 503'});
        const err = container.querySelector('#idf-derive-error');
        expect(err).toExist();
        expect(err.textContent.indexOf('503')).toBeGreaterThan(-1);
    });

    it('renders progress message when inFlight + processId set', () => {
        mount({inFlight: true, processId: 99, processName: 'IDF derive @ (-37.8,144.9)'});
        const progress = container.querySelector('#idf-derive-progress');
        expect(progress).toExist();
    });

    it('renders results table when result is set', () => {
        const result = {
            id: 7,
            durations_min: [60, 1440],
            return_periods_yr: [2, 100],
            intensities_mm_per_hr: [[10.5, 50.1], [3.2, 12.4]],
            ci_lower_mm_per_hr: [[9.0, 45.0], [2.8, 11.0]],
            ci_upper_mm_per_hr: [[12.0, 55.0], [3.6, 13.5]],
            provenance: {source: 'ERA5-Land', period_of_record: '1981-2024'}
        };
        mount({result});
        const resultsDiv = container.querySelector('#idf-derive-results');
        expect(resultsDiv).toExist();
        const provenance = container.querySelector('#idf-derive-provenance');
        expect(provenance).toExist();
        expect(provenance.textContent.indexOf('ERA5-Land')).toBeGreaterThan(-1);
    });

    it('CSV download button opens the BE CSV URL in new tab', () => {
        const result = {
            id: 7,
            durations_min: [60],
            return_periods_yr: [2],
            intensities_mm_per_hr: [[10.5]],
            ci_lower_mm_per_hr: [[9.0]],
            ci_upper_mm_per_hr: [[12.0]],
            provenance: {}
        };
        const originalOpen = window.open;
        let openedUrl = null;
        let openedTarget = null;
        window.open = (url, target) => { openedUrl = url; openedTarget = target; };
        try {
            mount({result, projectId: 42});
            const csvBtn = container.querySelector('#idf-derive-download-csv');
            ReactTestUtils.Simulate.click(csvBtn);
            expect(openedUrl).toBe('/api/v2/anuga/projects/42/idf-tables/7/csv/');
            expect(openedTarget).toBe('_blank');
        } finally {
            window.open = originalOpen;
        }
    });

    it('JSON download button creates a Blob and triggers download', () => {
        const result = {
            id: 7,
            durations_min: [60],
            return_periods_yr: [2],
            intensities_mm_per_hr: [[10.5]],
            ci_lower_mm_per_hr: [[9.0]],
            ci_upper_mm_per_hr: [[12.0]],
            provenance: {source: 'ERA5-Land', caveats: ['hourly underestimates 1-6h']}
        };
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        let createdBlob = null;
        URL.createObjectURL = (blob) => { createdBlob = blob; return 'blob:fake'; };
        URL.revokeObjectURL = () => {};
        try {
            mount({result});
            const jsonBtn = container.querySelector('#idf-derive-download-json');
            ReactTestUtils.Simulate.click(jsonBtn);
            expect(createdBlob).toExist();
            expect(createdBlob.type).toBe('application/json');
        } finally {
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
        }
    });

    describe('parseNumberList helper', () => {
        it('parses comma-separated numbers', () => {
            expect(parseNumberList('60, 180, 360')).toEqual([60, 180, 360]);
        });
        it('trims whitespace and filters empties', () => {
            expect(parseNumberList('  60 ,, 180 ')).toEqual([60, 180]);
        });
        it('filters non-numbers', () => {
            expect(parseNumberList('60, foo, 180')).toEqual([60, 180]);
        });
        it('returns [] for empty string', () => {
            expect(parseNumberList('')).toEqual([]);
        });
        it('returns [] for null', () => {
            expect(parseNumberList(null)).toEqual([]);
        });
    });
});
