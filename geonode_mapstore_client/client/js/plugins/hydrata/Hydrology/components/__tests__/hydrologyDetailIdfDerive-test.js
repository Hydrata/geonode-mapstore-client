/**
 * TASK-934 — IDF Derive panel render + behaviour tests.
 * TASK-1500 (W3) — updated for the duration×RP boolean matrix (Parameters step
 * replaced; old text-input-path tests removed / updated).
 *
 * Tests the unconnected HydrologyDetailIdfDeriveClass so we don't need a
 * full redux store wired up. Helpers (parseNumberList, downloadProvenanceJson,
 * formatDuration, IdfDeriveMatrix) are exercised as pure functions / shallowly.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';

const {
    HydrologyDetailIdfDeriveClass,
    IdfDeriveMatrix,
    IdfProvenanceBadge,
    parseNumberList,
    SUB_DAILY_THRESHOLD_MIN,
    CANONICAL_DURATIONS_MIN,
    CANONICAL_RETURN_PERIODS_YR,
    formatDuration,
    IDF_YEAR_RANGE_OPTIONS,
    ERA5_MAX_YEAR
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
        // TASK-1789 — year-range mode defaults
        yearRangeMode: '10yr',
        setIdfDeriveLat: noop,
        setIdfDeriveLon: noop,
        setIdfDeriveDurations: noop,
        setIdfDeriveRPs: noop,
        setIdfDeriveMapPickActive: noop,
        deriveIdfRequest: noop,
        setIdfDeriveYearRangeMode: noop
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

    it('renders an inline "unavailable" message and DISABLES Derive when celery_anuga_enabled=false', () => {
        // TASK-1452 (W5): the button is always present but disabled; the
        // unavailable notice sits above it (no longer hidden entirely).
        mount({celeryAnugaEnabled: false});
        const unavailable = container.querySelector('#sv-idf-derive-unavailable');
        const btn = container.querySelector('#idf-derive-button');
        expect(unavailable).toExist();
        expect(btn).toExist();
        expect(btn.disabled).toBe(true);
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

    // W3 (TASK-1500): The matrix only allows toggling canonical durations/RPs —
    // there is no text-input path for non-numeric tokens any more.
    // The validate() method now only checks for empty selection + lat/lon.
    it('Derive button disabled when durations empty (nothing selected)', () => {
        mount({durationsText: ''});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    it('Derive button disabled when return periods empty (nothing selected)', () => {
        mount({rpsText: ''});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(true);
    });

    // Sub-hourly durations (5, 10, 15, 20, 30, 45 min) are canonical matrix
    // cells and do NOT disable the derive button — they only trigger the sub-
    // daily banner. Validate that the button is enabled for sub-hourly selections.
    it('Derive button NOT disabled for canonical sub-hourly duration (30 min)', () => {
        mount({durationsText: '30, 60', rpsText: '2, 10'});
        const btn = container.querySelector('#idf-derive-button');
        expect(btn.disabled).toBe(false);
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
        const err = container.querySelector('#sv-idf-derive-error');
        expect(err).toExist();
        expect(err.textContent.indexOf('503')).toBeGreaterThan(-1);
    });

    // TASK-1667 conform-migration: the bespoke .sv-idf-derive-error box is now the
    // shared SimpleView <ErrorStrip> primitive (token-backed dark-glass danger
    // strip, role="alert"). The #sv-idf-derive-error id wrapper is preserved so the
    // existing test/behaviour hooks above keep working.
    it('idf-derive error block composes the shared ErrorStrip primitive', () => {
        mount({error: 'BE said 503'});
        const err = container.querySelector('#sv-idf-derive-error');
        const strip = err.querySelector('.sv-error-strip[role="alert"]');
        expect(strip).toExist();
        expect(strip.textContent.indexOf('503')).toBeGreaterThan(-1);
    });

    it('renders progress message when inFlight + processId set', () => {
        mount({inFlight: true, processId: 99, processName: 'IDF derive @ (-37.8,144.9)'});
        const progress = container.querySelector('#sv-idf-derive-progress');
        expect(progress).toExist();
    });

    it('renders results table when result is set', () => {
        // TASK-1452 (W5): provenance is collapsed by default; the toggle button
        // is present in the #sv-idf-derive-provenance div but the <pre> is hidden
        // until the user clicks the toggle. Check for the div + toggle, not the
        // raw provenance text (which is now behind a collapsible).
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
        const resultsDiv = container.querySelector('#sv-idf-derive-results');
        expect(resultsDiv).toExist();
        const provenance = container.querySelector('#sv-idf-derive-provenance');
        expect(provenance).toExist();
        // The provenance toggle button is visible; the text is behind it.
        const toggle = container.querySelector('.sv-idf-derive-provenance-toggle');
        expect(toggle).toExist();
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

    describe('W3 (TASK-1500) — canonical matrix axes', () => {
        it('CANONICAL_DURATIONS_MIN has 19 entries', () => {
            expect(CANONICAL_DURATIONS_MIN.length).toBe(19);
        });

        it('CANONICAL_DURATIONS_MIN starts at 5 min and ends at 4320 min', () => {
            expect(CANONICAL_DURATIONS_MIN[0]).toBe(5);
            expect(CANONICAL_DURATIONS_MIN[CANONICAL_DURATIONS_MIN.length - 1]).toBe(4320);
        });

        it('CANONICAL_RETURN_PERIODS_YR has 9 entries', () => {
            expect(CANONICAL_RETURN_PERIODS_YR.length).toBe(9);
        });

        it('CANONICAL_RETURN_PERIODS_YR starts at 0.5 and ends at 500', () => {
            expect(CANONICAL_RETURN_PERIODS_YR[0]).toBe(0.5);
            expect(CANONICAL_RETURN_PERIODS_YR[CANONICAL_RETURN_PERIODS_YR.length - 1]).toBe(500);
        });

        it('formatDuration shows minutes by default', () => {
            expect(formatDuration(60, false)).toBe('60 min');
            expect(formatDuration(5, false)).toBe('5 min');
            expect(formatDuration(4320, false)).toBe('4320 min');
        });

        it('formatDuration shows hours when showHours=true for exact multiples', () => {
            expect(formatDuration(60, true)).toBe('1 h');
            expect(formatDuration(1440, true)).toBe('24 h');
            expect(formatDuration(4320, true)).toBe('72 h');
        });

        it('formatDuration shows sub-hour in minutes even when showHours=true', () => {
            expect(formatDuration(5, true)).toBe('5 min');
            expect(formatDuration(30, true)).toBe('30 min');
        });

        it('formatDuration does NOT store hours in the value (display-only)', () => {
            // The persisted value must remain minutes — formatDuration returns a
            // display string, never mutates the underlying number.
            const dur = 4320;
            const display = formatDuration(dur, true);
            expect(display).toBe('72 h');
            // Original value unchanged
            expect(dur).toBe(4320);
        });
    });

    describe('W3 (TASK-1500) — matrix renders canonical grid', () => {
        let matrixContainer;

        beforeEach(() => {
            matrixContainer = document.createElement('div');
            document.body.appendChild(matrixContainer);
        });

        afterEach(() => {
            ReactDOM.unmountComponentAtNode(matrixContainer);
            document.body.removeChild(matrixContainer);
        });

        it('renders 13 derivable row headers (>=60 min; sub-hourly hidden by the floor fix)', () => {
            // TASK-1497 derive-floor fix: the matrix HIDES sub-hourly durations
            // (<60 min) entirely — only the 13 derivable durations 60..4320 show.
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[]}
                    selectedRPs={[]}
                    onDurationsChange={() => {}}
                    onRPsChange={() => {}}
                    showHours={false}
                />,
                matrixContainer
            );
            const rowHeaders = matrixContainer.querySelectorAll('.sv-idf-matrix-row-header');
            expect(rowHeaders.length).toBe(13);
        });

        it('renders 9 column headers (canonical return periods)', () => {
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[]}
                    selectedRPs={[]}
                    onDurationsChange={() => {}}
                    onRPsChange={() => {}}
                    showHours={false}
                />,
                matrixContainer
            );
            const colHeaders = matrixContainer.querySelectorAll('.sv-idf-matrix-col-header');
            expect(colHeaders.length).toBe(9);
        });

        it('renders tick glyphs for selected duration+RP pairs', () => {
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[60]}
                    selectedRPs={[10]}
                    onDurationsChange={() => {}}
                    onRPsChange={() => {}}
                    showHours={false}
                />,
                matrixContainer
            );
            const ticks = matrixContainer.querySelectorAll('.sv-idf-matrix-tick');
            expect(ticks.length).toBeGreaterThan(0);
        });

        it('shows hours labels when showHours=true', () => {
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[]}
                    selectedRPs={[]}
                    onDurationsChange={() => {}}
                    onRPsChange={() => {}}
                    showHours
                />,
                matrixContainer
            );
            // 4320 min = 72 h should appear
            const text = matrixContainer.textContent;
            expect(text.indexOf('72 h')).toBeGreaterThan(-1);
        });

        it('calls onDurationsChange when a row header is clicked', () => {
            let called = null;
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[]}
                    selectedRPs={[2, 5]}
                    onDurationsChange={(d) => { called = d; }}
                    onRPsChange={() => {}}
                    showHours={false}
                />,
                matrixContainer
            );
            const rowHeaders = matrixContainer.querySelectorAll('.sv-idf-matrix-row-header');
            // First row header is now 60 min (sub-hourly rows hidden by the floor fix).
            ReactTestUtils.Simulate.click(rowHeaders[0]);
            expect(called).toExist();
            expect(called.indexOf(60)).toBeGreaterThan(-1);
        });

        it('calls onRPsChange when a derivable column header is clicked', () => {
            let called = null;
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[60, 120]}
                    selectedRPs={[]}
                    onDurationsChange={() => {}}
                    onRPsChange={(r) => { called = r; }}
                    showHours={false}
                />,
                matrixContainer
            );
            const colHeaders = matrixContainer.querySelectorAll('.sv-idf-matrix-col-header');
            // colHeaders[0] is the 0.5yr column — DISABLED by the floor fix (inert).
            // colHeaders[1] is 1yr, the first derivable column.
            ReactTestUtils.Simulate.click(colHeaders[1]);
            expect(called).toExist();
            expect(called.indexOf(1)).toBeGreaterThan(-1);
        });

        it('the sub-annual 0.5yr column header is disabled and inert (floor fix)', () => {
            let called = null;
            ReactDOM.render(
                <IdfDeriveMatrix
                    selectedDurations={[60, 120]}
                    selectedRPs={[]}
                    onDurationsChange={() => {}}
                    onRPsChange={(r) => { called = r; }}
                    showHours={false}
                />,
                matrixContainer
            );
            const colHeaders = matrixContainer.querySelectorAll('.sv-idf-matrix-col-header');
            expect(colHeaders[0].className).toInclude('sv-idf-matrix-header--disabled');
            ReactTestUtils.Simulate.click(colHeaders[0]);
            expect(called).toBe(null); // click does nothing
        });
    });

    // ── TASK-1789 — Year-range toggle + provenance badge ──────────────────

    describe('TASK-1789 year-range toggle', () => {
        it('ERA5_MAX_YEAR is 2026', () => {
            expect(ERA5_MAX_YEAR).toBe(2026);
        });

        it('IDF_YEAR_RANGE_OPTIONS has 10yr and 75yr entries', () => {
            expect(IDF_YEAR_RANGE_OPTIONS.length).toBe(2);
            const keys = IDF_YEAR_RANGE_OPTIONS.map(o => o.key);
            expect(keys).toInclude('10yr');
            expect(keys).toInclude('75yr');
        });

        it('10yr option has startYear = ERA5_MAX_YEAR - 9', () => {
            const opt = IDF_YEAR_RANGE_OPTIONS.find(o => o.key === '10yr');
            expect(opt.startYear).toBe(ERA5_MAX_YEAR - 9);
            expect(opt.endYear).toBe(ERA5_MAX_YEAR);
        });

        it('75yr option has startYear = 1950', () => {
            const opt = IDF_YEAR_RANGE_OPTIONS.find(o => o.key === '75yr');
            expect(opt.startYear).toBe(1950);
            expect(opt.endYear).toBe(ERA5_MAX_YEAR);
        });

        it('renders the year-range toggle buttons', () => {
            mount({setIdfDeriveYearRangeMode: noop, yearRangeMode: '10yr'});
            const btn10 = container.querySelector('#idf-derive-year-range-10yr');
            const btn75 = container.querySelector('#idf-derive-year-range-75yr');
            expect(btn10).toExist();
            expect(btn75).toExist();
        });

        it('10yr button has active class when yearRangeMode=10yr', () => {
            mount({setIdfDeriveYearRangeMode: noop, yearRangeMode: '10yr'});
            const btn10 = container.querySelector('#idf-derive-year-range-10yr');
            expect(btn10.className).toInclude('idf-derive-year-range-btn--active');
        });

        it('75yr button has active class when yearRangeMode=75yr', () => {
            mount({setIdfDeriveYearRangeMode: noop, yearRangeMode: '75yr'});
            const btn75 = container.querySelector('#idf-derive-year-range-75yr');
            expect(btn75.className).toInclude('idf-derive-year-range-btn--active');
        });

        it('clicking 75yr button calls setIdfDeriveYearRangeMode("75yr")', () => {
            let called = null;
            mount({setIdfDeriveYearRangeMode: (m) => { called = m; }, yearRangeMode: '10yr'});
            const btn75 = container.querySelector('#idf-derive-year-range-75yr');
            ReactTestUtils.Simulate.click(btn75);
            expect(called).toBe('75yr');
        });

        it('clicking 10yr button calls setIdfDeriveYearRangeMode("10yr")', () => {
            let called = null;
            mount({setIdfDeriveYearRangeMode: (m) => { called = m; }, yearRangeMode: '75yr'});
            const btn10 = container.querySelector('#idf-derive-year-range-10yr');
            ReactTestUtils.Simulate.click(btn10);
            expect(called).toBe('10yr');
        });
    });

    describe('TASK-1789 IdfProvenanceBadge', () => {
        let badgeContainer;

        beforeEach(() => {
            badgeContainer = document.createElement('div');
            document.body.appendChild(badgeContainer);
        });

        afterEach(() => {
            ReactDOM.unmountComponentAtNode(badgeContainer);
            document.body.removeChild(badgeContainer);
        });

        it('renders nothing when provenance is null', () => {
            ReactDOM.render(<IdfProvenanceBadge provenance={null} />, badgeContainer);
            expect(badgeContainer.querySelector('#idf-derive-provenance-badge')).toNotExist();
        });

        it('renders nothing when provenance has no grade or source_key', () => {
            ReactDOM.render(<IdfProvenanceBadge provenance={{}} />, badgeContainer);
            expect(badgeContainer.querySelector('#idf-derive-provenance-badge')).toNotExist();
        });

        it('renders badge for GPEX screening provenance', () => {
            const prov = {grade: 'screening', source_key: 'gpex_mev_v4'};
            ReactDOM.render(<IdfProvenanceBadge provenance={prov} />, badgeContainer);
            const badge = badgeContainer.querySelector('#idf-derive-provenance-badge');
            expect(badge).toExist();
            // Should contain "GPEX" and "Screening" text
            const text = badge.textContent;
            expect(text.toUpperCase().indexOf('GPEX')).toBeGreaterThan(-1);
            expect(text.indexOf('Screening')).toBeGreaterThan(-1);
        });

        it('renders badge for ERA5 standard provenance (no disclaimer)', () => {
            const prov = {grade: 'standard', source_key: 'era5_land'};
            ReactDOM.render(<IdfProvenanceBadge provenance={prov} />, badgeContainer);
            const badge = badgeContainer.querySelector('#idf-derive-provenance-badge');
            expect(badge).toExist();
            expect(badge.textContent.indexOf('Standard')).toBeGreaterThan(-1);
        });

        it('GPEX screening result shows provenance badge in Step 4', () => {
            const result = {
                id: 9,
                durations_min: [60],
                return_periods_yr: [10],
                intensities_mm_per_hr: [[8.0]],
                ci_lower_mm_per_hr: [[7.0]],
                ci_upper_mm_per_hr: [[9.0]],
                provenance: {grade: 'screening', source_key: 'gpex_mev_v4'}
            };
            mount({result, setIdfDeriveYearRangeMode: noop, yearRangeMode: '10yr'});
            const badge = container.querySelector('#idf-derive-provenance-badge');
            expect(badge).toExist();
        });
    });

    // ── TASK-1 — depth↔intensity result-table display toggle ──────────────
    // FE-only, no re-derive. The result table defaults to intensity (mm/hr); the
    // Depth radio converts every cell (point estimate + CI band) by the PER-ROW
    // duration/60 factor and flips the per-RP header unit. The BE payload is
    // never mutated (conversion is render-only).
    describe('TASK-1 depth↔intensity result toggle', () => {
        const result = {
            id: 11,
            durations_min: [60, 120],
            return_periods_yr: [10],
            intensities_mm_per_hr: [[10], [8]],
            ci_lower_mm_per_hr: [[9], [7]],
            ci_upper_mm_per_hr: [[12], [9]],
            provenance: {}
        };

        it('defaults to Intensity: radio checked + "(mm/hr)" header', () => {
            mount({result});
            const intensityRadio = container.querySelector('#idf-derive-unit-intensity');
            expect(intensityRadio).toExist();
            expect(intensityRadio.checked).toBe(true);
            expect(container.textContent.indexOf('10-yr (mm/hr)')).toBeGreaterThan(-1);
        });

        it('switching to Depth flips the header to "(mm)" and converts cells per-row', () => {
            mount({result});
            const depthRadio = container.querySelector('#idf-derive-unit-depth');
            expect(depthRadio).toExist();
            ReactTestUtils.Simulate.change(depthRadio);
            // header unit flips
            expect(container.textContent.indexOf('10-yr (mm)')).toBeGreaterThan(-1);
            expect(container.textContent.indexOf('10-yr (mm/hr)')).toBe(-1);
            // 120-min row: intensity 8 → depth 8×(120/60)=16.0 (only appears in depth)
            expect(container.textContent.indexOf('16.0')).toBeGreaterThan(-1);
        });
    });
});
