/**
 * TASK-934 — IDF Derive panel (originally); TASK-1452 (W5) — redesigned.
 * TASK-1500 (W3) — replaced Parameters text inputs with duration×RP matrix.
 *
 * W5 redesign: reflows the one-shot form into a 4-step vertical stepper
 * rendered inside the standard .anuga-scenario-pane-detail idiom:
 *
 *   Step 1 — LOCATION   lat/lon row + Pick-on-map toggle
 *   Step 2 — PARAMETERS duration×RP boolean matrix (W3 replacement)
 *                       Rows = 19 canonical durations (5…4320 min)
 *                       Cols = 9 canonical return periods (0.5…500 yr)
 *                       Row-header click toggles whole row
 *                       Column-header click toggles whole column
 *                       Hours display toggle (read-aid; stored values stay minutes)
 *   Step 3 — DERIVE     primary green Derive button (bottom-right); disabled
 *                       with an inline reason when !celeryAnugaEnabled or
 *                       validation fails
 *   Step 4 — RESULTS    read-only table + Download JSON/CSV + collapsible
 *                       provenance <pre>
 *
 * Posts {lat, lon, durations_min, return_periods_yr} to
 * /api/v2/anuga/projects/{pid}/idf-tables/derive/.
 * The derive endpoint returns 202 + {task_id, process_id}; we then watch
 * TaskMonitor for the matching process row to flip to 'complete' and
 * fetch the resulting IDFTable for inline display.
 *
 * Styling: .anuga-scenario-pane-* classes + --sv-* vars from anuga.css.
 * No bespoke inline styles except where truly dynamic (e.g. mapPickActive
 * bsStyle toggle on the Pick button).
 */
import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {Button} from 'react-bootstrap';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import Message from '@mapstore/framework/components/I18N/Message';

import {
    setIdfDeriveLat,
    setIdfDeriveLon,
    setIdfDeriveDurations,
    setIdfDeriveRPs,
    setIdfDeriveMapPickActive,
    deriveIdfRequest,
    // TASK-1789 — year-range mode toggle
    setIdfDeriveYearRangeMode
} from '../actionsHydrology';
import {StatusBadge, Tooltip} from '../../SimpleView/components/primitives';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';

// ---------------------------------------------------------------------------
// Canonical matrix axes (W3 / TASK-1500)
// ---------------------------------------------------------------------------

// 19 canonical durations in minutes (matches the Input/Manual-tab axes).
const CANONICAL_DURATIONS_MIN = [
    5, 10, 15, 20, 30, 45,
    60, 120, 180, 240, 300, 360,
    540, 720, 900, 1080, 1440, 2880, 4320
];

// 9 canonical return periods in years (matches the Input/Manual-tab axes).
const CANONICAL_RETURN_PERIODS_YR = [0.5, 1, 2, 5, 10, 20, 50, 100, 500];

// Sub-daily warning threshold — minutes. ERA5-Land hourly systematically
// underestimates ≤6h peak intensities (Lavers 2024, Brown 2023). Any
// selected duration < 1440 min (24h) triggers the validation-recommended banner.
const SUB_DAILY_THRESHOLD_MIN = 1440;

// ERA5 derive floors. Sub-hourly durations (ERA5-Land is hourly) and sub-annual
// return periods (the GEV quantile p = 1 − 1/T needs T ≥ 1; T=0.5 → p=−1 → NaN)
// can't be DERIVED. Those rows/column stay in the matrix for visual parity with
// the manual Input table but render DISABLED here; deriveIdfEpic also filters
// them from the POST as a safety net. Mirrors DERIVE_MIN_* in epicsHydrology.js.
const DERIVE_MIN_DURATION_MIN = 60;
const DERIVE_MIN_RETURN_PERIOD_YR = 1;

// TASK-1789 — ERA5 year-range constants.
// Mirrors idf_core._ERA5_MAX_YEAR=2026. Single source in epicsHydrology; kept
// here as a display-only reference for labels + tooltips.
const ERA5_MAX_YEAR = 2026;
// Year-range options for the toggle button-pair.
const IDF_YEAR_RANGE_OPTIONS = [
    {
        key: '10yr',
        label: '10yr',
        startYear: ERA5_MAX_YEAR - 9,
        endYear: ERA5_MAX_YEAR
    },
    {
        key: '75yr',
        label: '75yr',
        startYear: 1950,
        endYear: ERA5_MAX_YEAR
    }
];
const isDerivableDuration = (dur) => dur >= DERIVE_MIN_DURATION_MIN;
const isDerivableRP = (rp) => rp >= DERIVE_MIN_RETURN_PERIOD_YR;
// Derivable axis subsets — used by the row/column "select all" fallbacks so
// toggling a header never injects a non-derivable cell.
const DERIVABLE_DURATIONS_MIN = CANONICAL_DURATIONS_MIN.filter(isDerivableDuration);
const DERIVABLE_RETURN_PERIODS_YR = CANONICAL_RETURN_PERIODS_YR.filter(isDerivableRP);

// ---------------------------------------------------------------------------
// Utility: parse comma-separated number list from Redux state string
// ---------------------------------------------------------------------------

const parseNumberList = (text) => {
    if (text === null || text === undefined) return [];
    return String(text)
        .split(',')
        .map(s => String(s).trim())
        .filter(s => s.length > 0)
        .map(s => Number(s))
        .filter(n => Number.isFinite(n));
};

// ---------------------------------------------------------------------------
// Utility: format a duration value for display
// ---------------------------------------------------------------------------

/**
 * formatDuration — convert a minutes value to a display label.
 * When showHours is true, values >= 60 are shown as "N h"; sub-hour
 * values are always shown as "N min" regardless of toggle.
 * IMPORTANT: this is display-only; persisted/sent values stay in minutes.
 */
const formatDuration = (minutes, showHours) => {
    if (showHours && minutes >= 60 && minutes % 60 === 0) {
        return `${minutes / 60} h`;
    }
    if (showHours && minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    }
    return `${minutes} min`;
};

// ---------------------------------------------------------------------------
// IdfDeriveMatrix — the boolean duration×RP selection grid
// ---------------------------------------------------------------------------

/**
 * IdfDeriveMatrix
 *
 * Renders a 19×9 boolean grid.  Each cell is a green-tick (selected) or
 * red-cross (unselected) toggle.  Row-header click toggles the whole row;
 * column-header click toggles the whole column.
 *
 * Props:
 *  selectedDurations  number[]  — currently selected durations (minutes)
 *  selectedRPs        number[]  — currently selected return periods (years)
 *  onDurationsChange  fn(number[])  — called with the new selected durations
 *  onRPsChange        fn(number[])  — called with the new selected RPs
 *  showHours          bool  — whether to display duration labels in hours
 */
const IdfDeriveMatrix = ({
    selectedDurations,
    selectedRPs,
    onDurationsChange,
    onRPsChange,
    showHours
}) => {
    // Build sets for O(1) membership tests.
    const durSet = new Set(selectedDurations);
    const rpSet = new Set(selectedRPs);

    const toggleCell = (dur, rp) => {
        // Non-derivable cells (sub-hourly / sub-annual) are inert.
        if (!isDerivableDuration(dur) || !isDerivableRP(rp)) return;
        const durSelected = durSet.has(dur);
        const rpSelected = rpSet.has(rp);
        // Toggle: if BOTH selected → deselect this cell.
        // Strategy: cell is "on" when its duration AND return period are both selected.
        // We maintain selectedDurations and selectedRPs as independent sets;
        // a cell is ticked iff both are in their respective sets.
        // Toggling a cell flips membership for BOTH if needed —
        // but the common interpretation is: the cell state is (durSet ∩ rpSet) membership,
        // so toggling a cell adds/removes from both sets.
        let newDurs = [...selectedDurations];
        let newRPs = [...selectedRPs];
        const cellOn = durSelected && rpSelected;
        if (cellOn) {
            // Turn off: remove from both sets only if no other selected RP/duration
            // would keep the counterpart alive.  For simplicity (spec: each cell
            // independently toggles), we track a full selectedCells set approach.
            // SIMPLER: treat selectedDurations and selectedRPs as axis "headers"
            // that are added/removed together.
            // Remove if this is the only selected RP keeping dur alive, etc.
            // PRACTICAL approach: just remove from both when a cell is individually turned off.
            newDurs = newDurs.filter(d => d !== dur);
            newRPs = newRPs.filter(r => r !== rp);
        } else {
            if (!durSelected) newDurs = [...newDurs, dur].sort((a, b) => a - b);
            if (!rpSelected) newRPs = [...newRPs, rp].sort((a, b) => a - b);
        }
        onDurationsChange(newDurs);
        onRPsChange(newRPs);
    };

    const toggleRow = (dur) => {
        // Sub-hourly durations can't be derived — header is inert.
        if (!isDerivableDuration(dur)) return;
        // Toggle whole row: if duration not in set → add it (and add all RPs if none selected).
        // If ALL canonical RPs already selected and this duration is selected → remove duration.
        const durSelected = durSet.has(dur);
        if (durSelected) {
            // Remove this duration from the selection.
            onDurationsChange(selectedDurations.filter(d => d !== dur));
        } else {
            // Add duration; if no RPs selected yet, select all RPs.
            const newDurs = [...selectedDurations, dur].sort((a, b) => a - b);
            onDurationsChange(newDurs);
            if (selectedRPs.length === 0) {
                onRPsChange([...DERIVABLE_RETURN_PERIODS_YR]);
            }
        }
    };

    const toggleCol = (rp) => {
        // Sub-annual return periods can't be derived — header is inert.
        if (!isDerivableRP(rp)) return;
        const rpSelected = rpSet.has(rp);
        if (rpSelected) {
            onRPsChange(selectedRPs.filter(r => r !== rp));
        } else {
            const newRPs = [...selectedRPs, rp].sort((a, b) => a - b);
            onRPsChange(newRPs);
            if (selectedDurations.length === 0) {
                onDurationsChange([...DERIVABLE_DURATIONS_MIN]);
            }
        }
    };

    return (
        <div className="idf-matrix-wrapper">
            <table className="idf-matrix-table">
                <thead>
                    <tr>
                        {/* Top-left corner cell — empty */}
                        <th className="idf-matrix-corner" />
                        {CANONICAL_RETURN_PERIODS_YR.map(rp => {
                            const rpDerivable = isDerivableRP(rp);
                            return (
                                <th
                                    key={rp}
                                    className={`idf-matrix-col-header${rpSet.has(rp) ? ' idf-matrix-header--selected' : ''}${rpDerivable ? '' : ' idf-matrix-header--disabled'}`}
                                    onClick={rpDerivable ? () => toggleCol(rp) : undefined}
                                    title={rpDerivable
                                        ? `Toggle all durations for ${rp}-yr ARI`
                                        : `${rp}-yr ARI can't be derived from ERA5 (annual maxima needs ≥ 1 yr) — use the manual IDF table`}
                                >
                                    {rp < 1 ? `${rp}-yr` : `${rp} yr`}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {/* Sub-hourly durations (< 60 min) are HIDDEN entirely — ERA5-Land
                        is hourly so they can't be derived, and showing them greyed wastes
                        vertical space. They remain available in the manual IDF table, and
                        deriveIdfEpic also filters them from the POST as a safety net. */}
                    {DERIVABLE_DURATIONS_MIN.map(dur => {
                        const durSelected = durSet.has(dur);
                        return (
                            <tr key={dur}>
                                <td
                                    className={`idf-matrix-row-header${durSelected ? ' idf-matrix-header--selected' : ''}`}
                                    onClick={() => toggleRow(dur)}
                                    title={`Toggle all return periods for ${formatDuration(dur, false)}`}
                                >
                                    {formatDuration(dur, showHours)}
                                </td>
                                {CANONICAL_RETURN_PERIODS_YR.map(rp => {
                                    const cellDerivable = isDerivableRP(rp);
                                    const cellOn = durSelected && rpSet.has(rp);
                                    return (
                                        <td
                                            key={rp}
                                            className={`idf-matrix-cell${!cellDerivable ? ' idf-matrix-cell--disabled' : (cellOn ? ' idf-matrix-cell--on' : ' idf-matrix-cell--off')}`}
                                            onClick={cellDerivable ? () => toggleCell(dur, rp) : undefined}
                                            title={cellDerivable
                                                ? `${formatDuration(dur, false)} / ${rp}-yr: ${cellOn ? 'selected' : 'not selected'}`
                                                : 'Not derivable from ERA5 (annual maxima needs ≥ 1 yr) — use the manual IDF table'}
                                        >
                                            {!cellDerivable
                                                ? <span className="idf-matrix-disabled-mark" aria-hidden="true">–</span>
                                                : (cellOn
                                                    ? <span className="glyphicon glyphicon-ok idf-matrix-tick" aria-hidden="true" />
                                                    : <span className="glyphicon glyphicon-remove idf-matrix-cross" aria-hidden="true" />)
                                            }
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

IdfDeriveMatrix.propTypes = {
    selectedDurations: PropTypes.arrayOf(PropTypes.number).isRequired,
    selectedRPs: PropTypes.arrayOf(PropTypes.number).isRequired,
    onDurationsChange: PropTypes.func.isRequired,
    onRPsChange: PropTypes.func.isRequired,
    showHours: PropTypes.bool
};

IdfDeriveMatrix.defaultProps = {
    showHours: true
};

// ---------------------------------------------------------------------------
// Result table (from W5, unchanged)
// ---------------------------------------------------------------------------

// Build TanStack column defs from the IDFTable BE payload.
// Columns: duration_min, then triplet per RP (intensity, ci_lower, ci_upper).
const buildResultColumns = (idfTable) => {
    const helper = createColumnHelper();
    const rps = idfTable?.return_periods_yr || [];
    const cols = [
        helper.accessor('duration_min', {
            cell: info => info.getValue(),
            header: () => <span><Message msgId="hydrata.hydrology.durationMin" /></span>
        })
    ];
    rps.forEach((rp, idx) => {
        cols.push(helper.accessor(`rp${rp}_intensity`, {
            cell: info => {
                const v = info.getValue();
                // eslint-disable-next-line no-eq-null, eqeqeq
                return v == null ? '' : Number(v).toFixed(1);
            },
            header: () => <span>{`${rp}-yr (mm/hr)`}</span>,
            id: `rp-${rp}-intensity-${idx}`
        }));
        cols.push(helper.accessor(`rp${rp}_ci_lower`, {
            cell: info => {
                const v = info.getValue();
                // eslint-disable-next-line no-eq-null, eqeqeq
                return v == null ? '' : Number(v).toFixed(1);
            },
            header: () => <span>{`${rp}-yr CI low`}</span>,
            id: `rp-${rp}-ci-lower-${idx}`
        }));
        cols.push(helper.accessor(`rp${rp}_ci_upper`, {
            cell: info => {
                const v = info.getValue();
                // eslint-disable-next-line no-eq-null, eqeqeq
                return v == null ? '' : Number(v).toFixed(1);
            },
            header: () => <span>{`${rp}-yr CI high`}</span>,
            id: `rp-${rp}-ci-upper-${idx}`
        }));
    });
    return cols;
};

const buildResultRows = (idfTable) => {
    const durations = idfTable?.durations_min || [];
    const rps = idfTable?.return_periods_yr || [];
    const intensities = idfTable?.intensities_mm_per_hr || [];
    const ciLow = idfTable?.ci_lower_mm_per_hr || [];
    const ciHigh = idfTable?.ci_upper_mm_per_hr || [];
    return durations.map((d, i) => {
        const row = {duration_min: d};
        rps.forEach((rp, j) => {
            row[`rp${rp}_intensity`] = (intensities[i] || [])[j];
            row[`rp${rp}_ci_lower`] = (ciLow[i] || [])[j];
            row[`rp${rp}_ci_upper`] = (ciHigh[i] || [])[j];
        });
        return row;
    });
};

const ResultsTable = ({idfTable}) => {
    const columns = React.useMemo(() => buildResultColumns(idfTable), [idfTable]);
    const data = React.useMemo(() => buildResultRows(idfTable), [idfTable]);
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel()
    });
    return (
        <div className="idf-derive-results-table-wrap">
            <table className={'idf-table'}>
                <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map(row => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

ResultsTable.propTypes = {
    idfTable: PropTypes.object
};

// Trigger a browser download of the provenance manifest as JSON.
// Pure client-side: builds a Blob from the IDFTable's provenance dict so
// users get the GEV fit parameters + caveats without an extra round-trip.
const downloadProvenanceJson = (idfTable) => {
    try {
        const blob = new Blob(
            [JSON.stringify(idfTable?.provenance || {}, null, 2)],
            {type: 'application/json'}
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `idf-provenance-${idfTable?.id || 'manifest'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Release the blob after click; setTimeout-0 avoids race in Safari.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
        // No-op: download failure is non-fatal, user can re-trigger.
    }
};

/**
 * IdfDeriveStepHeader — a numbered step heading in the vertical stepper.
 * Shows a circular step number badge + a title label.
 */
const IdfDeriveStepHeader = ({step, titleMsgId}) => (
    <div className="idf-derive-step-head">
        <span className="idf-derive-step-badge">{step}</span>
        <span className="idf-derive-step-title">
            <Message msgId={titleMsgId} />
        </span>
    </div>
);
IdfDeriveStepHeader.propTypes = {
    step: PropTypes.number.isRequired,
    titleMsgId: PropTypes.string.isRequired
};

// ---------------------------------------------------------------------------
// TASK-1789 — Provenance badge (source + grade)
// ---------------------------------------------------------------------------

// Map from provenance.grade to StatusBadge status for visual meaning.
const GRADE_TO_BADGE_STATUS = {
    screening: 'pending',   // amber — pre-design only, needs ground-truth
    standard: 'complete'    // green — ERA5 full-record derive
};

/**
 * IdfProvenanceBadge — shows source key + grade as a StatusBadge + Tooltip.
 * GPEX ('screening' grade) gets a specific disclaimer about pre-design use.
 * ERA5 ('standard' grade) shows a clean "Verified" or no disclaimer.
 *
 * Props: provenance — the provenance object from the IDFTable BE payload.
 */
const IdfProvenanceBadge = ({provenance}) => {
    if (!provenance) return null;
    const grade = provenance.grade;
    const sourceKey = provenance.source_key || provenance.source || '';
    if (!grade && !sourceKey) return null;

    const badgeStatus = GRADE_TO_BADGE_STATUS[grade] || 'pending';
    const gradeLabel = grade === 'screening' ? 'Screening' : grade === 'standard' ? 'Standard' : grade;
    const badgeLabel = sourceKey
        ? `${sourceKey.toUpperCase()} · ${gradeLabel}`
        : gradeLabel;

    return (
        <div id="idf-derive-provenance-badge" className="idf-derive-provenance-badge-row">
            <StatusBadge
                status={badgeStatus}
                label={badgeLabel}
                showGlyph
                compact
            />
            {grade === 'screening' && (
                <Tooltip
                    label=""
                    placement="bottom"
                    showGlyph
                >
                    <Message msgId="hydrata.hydrology.idfDeriveScreeningDisclaimer" />
                </Tooltip>
            )}
        </div>
    );
};

IdfProvenanceBadge.propTypes = {
    provenance: PropTypes.object
};

class HydrologyDetailIdfDeriveClass extends React.Component {
    static propTypes = {
        projectId: PropTypes.number,
        lat: PropTypes.number,
        lon: PropTypes.number,
        durationsText: PropTypes.string,
        rpsText: PropTypes.string,
        mapPickActive: PropTypes.bool,
        processId: PropTypes.number,
        error: PropTypes.string,
        result: PropTypes.object,
        celeryAnugaEnabled: PropTypes.bool,
        inFlight: PropTypes.bool,
        processStatus: PropTypes.string,
        processName: PropTypes.string,
        // TASK-1789 — year-range mode + setter
        yearRangeMode: PropTypes.string,
        setIdfDeriveLat: PropTypes.func,
        setIdfDeriveLon: PropTypes.func,
        setIdfDeriveDurations: PropTypes.func,
        setIdfDeriveRPs: PropTypes.func,
        setIdfDeriveMapPickActive: PropTypes.func,
        deriveIdfRequest: PropTypes.func,
        setIdfDeriveYearRangeMode: PropTypes.func
    };

    static defaultProps = {
        celeryAnugaEnabled: true,
        mapPickActive: false,
        inFlight: false,
        yearRangeMode: '10yr'
    };

    constructor(props) {
        super(props);
        this.state = {
            provenanceOpen: false,
            // hours display toggle — read-aid only (stored values stay minutes).
            // TASK-1497 (UAT note-4): defaults to ticked (hours) — the derive
            // matrix axis is >=60 min, so hours is the more natural read-aid.
            showHours: true
        };
    }

    // Inline validation — runs on every render to disable Derive and show
    // an error string when inputs are malformed. The epic re-validates BE
    // side, so any race condition is non-fatal.
    validate = () => {
        const durations = parseNumberList(this.props.durationsText);
        const rps = parseNumberList(this.props.rpsText);
        const errors = [];
        if (durations.length === 0) errors.push('Select at least one duration');
        if (rps.length === 0) errors.push('Select at least one return period');
        if (!Number.isFinite(this.props.lat) || !Number.isFinite(this.props.lon)) {
            errors.push('Lat/lon required');
        }
        return {durations, rps, errors};
    };

    handlePickClick = () => {
        this.props.setIdfDeriveMapPickActive(!this.props.mapPickActive);
    };

    handleDeriveClick = () => {
        // Debounce: ignore re-clicks while a derive is in flight so a quick
        // double-click can't fire two derive tasks (TASK-1539). The button is
        // also disabled via isInFlight; this guards the sub-render-frame race.
        if (this.props.inFlight) return;
        this.props.deriveIdfRequest();
    };

    handleCsvDownload = () => {
        const id = this.props.result?.id;
        if (!id || !this.props.projectId) return;
        window.open(
            `/api/v2/anuga/projects/${this.props.projectId}/idf-tables/${id}/csv/`,
            '_blank'
        );
    };

    toggleProvenance = () => {
        this.setState(s => ({provenanceOpen: !s.provenanceOpen}));
    };

    toggleShowHours = () => {
        this.setState(s => ({showHours: !s.showHours}));
    };

    // Called by the matrix when the user toggles a row/col/cell.
    // Serialises the number[] back to a comma-separated string for Redux.
    handleDurationsChange = (newDurations) => {
        this.props.setIdfDeriveDurations(newDurations.join(', '));
    };

    handleRPsChange = (newRPs) => {
        this.props.setIdfDeriveRPs(newRPs.join(', '));
    };

    render() {
        const {durations, rps, errors} = this.validate();
        const selectedDurations = durations;
        const selectedRPs = rps;

        // Sub-daily banner: show if any selected duration < 1440 min.
        const showSubDailyBanner = selectedDurations.some(
            d => Number.isFinite(d) && d < SUB_DAILY_THRESHOLD_MIN
        );

        // inFlight is set synchronously by the DERIVE_IDF_REQUEST reducer and
        // cleared on error/result, so it alone is the in-flight signal. The old
        // gate also required processId, which only arrives with the async 202 —
        // leaving the button live during the request window so a double-click
        // fired two derive tasks (TASK-1539).
        const isInFlight = !!this.props.inFlight;

        let deriveDisabledReason = null;
        if (!this.props.celeryAnugaEnabled) {
            deriveDisabledReason = null;
        } else if (isInFlight) {
            deriveDisabledReason = null;
        } else if (errors.length > 0) {
            deriveDisabledReason = errors[0];
        }
        const deriveDisabled = !this.props.celeryAnugaEnabled || errors.length > 0 || isInFlight;

        return (
            <div id={'hydrology-idf-derive-panel'} className="idf-derive-panel">
                {/* Head title — pane idiom */}
                <div className="anuga-scenario-pane-detail-head">
                    <span className="anuga-scenario-pane-detail-head-title">
                        <Message msgId="hydrata.hydrology.idfDerive" />
                    </span>
                </div>

                {/* Scrollable body */}
                <div className="anuga-scenario-pane-detail-body idf-derive-body">

                    {/* ── STEP 1: LOCATION ────────────────────────────── */}
                    <div
                        id="idf-derive-step-location"
                        className="idf-derive-step"
                    >
                        <IdfDeriveStepHeader step={1} titleMsgId="hydrata.hydrology.idfDeriveStepLocation" />

                        <div className="anuga-scenario-pane-section">
                            <span className="anuga-scenario-pane-label">
                                <Message msgId="hydrata.hydrology.idfDeriveLat" />
                            </span>
                            <div className="anuga-scenario-pane-field">
                                <input
                                    id={'idf-derive-lat'}
                                    type={'number'}
                                    className={'hydrology-text-input'}
                                    // eslint-disable-next-line no-eq-null, eqeqeq
                                    value={this.props.lat == null ? '' : this.props.lat}
                                    onChange={(e) => this.props.setIdfDeriveLat(
                                        e.target.value === '' ? null : Number(e.target.value)
                                    )}
                                />
                            </div>
                        </div>

                        <div className="anuga-scenario-pane-section">
                            <span className="anuga-scenario-pane-label">
                                <Message msgId="hydrata.hydrology.idfDeriveLon" />
                            </span>
                            <div className="anuga-scenario-pane-field">
                                <input
                                    id={'idf-derive-lon'}
                                    type={'number'}
                                    className={'hydrology-text-input'}
                                    // eslint-disable-next-line no-eq-null, eqeqeq
                                    value={this.props.lon == null ? '' : this.props.lon}
                                    onChange={(e) => this.props.setIdfDeriveLon(
                                        e.target.value === '' ? null : Number(e.target.value)
                                    )}
                                />
                            </div>
                        </div>

                        <div className="anuga-scenario-pane-section">
                            <span className="anuga-scenario-pane-label" />
                            <div className="anuga-scenario-pane-field">
                                <Button
                                    id={'idf-derive-pick-on-map'}
                                    bsSize={'small'}
                                    bsStyle={this.props.mapPickActive ? 'primary' : 'default'}
                                    onClick={this.handlePickClick}
                                >
                                    <span
                                        className="glyphicon glyphicon-map-marker"
                                        aria-hidden="true"
                                    />
                                    {' '}
                                    <Message msgId="hydrata.hydrology.idfDerivePickOnMap" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ── STEP 2: PARAMETERS (matrix) ─────────────────── */}
                    <div
                        id="idf-derive-step-parameters"
                        className="idf-derive-step"
                    >
                        <IdfDeriveStepHeader step={2} titleMsgId="hydrata.hydrology.idfDeriveStepParameters" />

                        {/* Hours display toggle — read-aid only; stored values stay minutes.
                            Flat .idf-matrix-unit-toggle-row markup (TASK-1527) so the
                            checkbox sits flush-left next to its label, matching the Input
                            sub-view (no .anuga-scenario-pane-label 130px gutter). */}
                        <div className="idf-matrix-unit-toggle-row">
                            <input
                                id="idf-matrix-show-hours"
                                type="checkbox"
                                checked={this.state.showHours}
                                onChange={this.toggleShowHours}
                            />
                            {' '}
                            <label htmlFor="idf-matrix-show-hours" className="idf-matrix-unit-label">
                                Display in hours
                            </label>
                        </div>

                        <IdfDeriveMatrix
                            selectedDurations={selectedDurations}
                            selectedRPs={selectedRPs}
                            onDurationsChange={this.handleDurationsChange}
                            onRPsChange={this.handleRPsChange}
                            showHours={this.state.showHours}
                        />

                        {showSubDailyBanner && (
                            <div
                                id={'idf-derive-sub-daily-banner'}
                                className="idf-derive-banner idf-derive-banner--warning"
                            >
                                <span className={'glyphicon glyphicon-warning-sign idf-derive-banner-glyph'}/>
                                <Message msgId="hydrata.hydrology.idfDeriveSubDailyBanner" />
                            </div>
                        )}
                    </div>

                    {/* ── STEP 3: DERIVE ──────────────────────────────── */}
                    <div
                        id="idf-derive-step-derive"
                        className="idf-derive-step"
                    >
                        <IdfDeriveStepHeader step={3} titleMsgId="hydrata.hydrology.idfDeriveStepDerive" />

                        {errors.length > 0 && (
                            <div
                                id={'idf-derive-validation-errors'}
                                className="idf-derive-validation-errors"
                            >
                                {errors.join('; ')}
                            </div>
                        )}

                        {this.props.error && (
                            <div
                                id={'idf-derive-error'}
                                className="idf-derive-error"
                            >
                                {this.props.error}
                            </div>
                        )}

                        {isInFlight && (
                            <div
                                id={'idf-derive-progress'}
                                className="idf-derive-progress"
                            >
                                <span className={'glyphicon glyphicon-refresh idf-derive-spin'}/>
                                {' '}
                                {this.props.processName || 'Deriving IDF...'}
                            </div>
                        )}

                        {/* Disabled-reason shown below button when celery off */}
                        {!this.props.celeryAnugaEnabled && (
                            <div
                                id={'idf-derive-unavailable'}
                                className="idf-derive-unavailable"
                            >
                                <Message msgId="hydrata.hydrology.idfDeriveUnavailable" />
                            </div>
                        )}

                        {/* TASK-1789 — Year-range toggle. GPEX-covered points return
                            instantly regardless; this governs the ERA5 Tier-3 depth. */}
                        <div className="idf-derive-year-range-row">
                            <span className="idf-derive-year-range-label">
                                <Message msgId="hydrata.hydrology.idfDeriveYearRangeLabel" />
                            </span>
                            <div className="idf-derive-year-range-toggle" role="group" aria-label="Year range">
                                {IDF_YEAR_RANGE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.key}
                                        id={`idf-derive-year-range-${opt.key}`}
                                        className={
                                            'idf-derive-year-range-btn'
                                            + (this.props.yearRangeMode === opt.key
                                                ? ' idf-derive-year-range-btn--active'
                                                : '')
                                        }
                                        onClick={() => this.props.setIdfDeriveYearRangeMode(opt.key)}
                                        title={`${opt.startYear}–${opt.endYear}`}
                                        aria-pressed={this.props.yearRangeMode === opt.key}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <Tooltip
                                label=""
                                placement="top"
                                showGlyph
                            >
                                <Message msgId="hydrata.hydrology.idfDeriveYearRangeTooltip" />
                            </Tooltip>
                        </div>

                        {/* Primary Derive button — bottom-right of step block */}
                        <div className="idf-derive-step-actions">
                            <Button
                                id={'idf-derive-button'}
                                bsStyle={'success'}
                                disabled={deriveDisabled}
                                onClick={this.handleDeriveClick}
                                title={deriveDisabledReason || ''}
                            >
                                <Message msgId="hydrata.hydrology.idfDeriveDeriveButton" />
                            </Button>
                        </div>
                    </div>

                    {/* ── STEP 4: RESULTS ─────────────────────────────── */}
                    {this.props.result && (
                        <div
                            id={'idf-derive-step-results'}
                            className="idf-derive-step"
                        >
                            <IdfDeriveStepHeader step={4} titleMsgId="hydrata.hydrology.idfDeriveStepResults" />

                            <div id={'idf-derive-results'} className="idf-derive-results">
                                {/* TASK-1789 — provenance badge. Shows source key and
                                    grade; GPEX='screening' gets a disclaimer tooltip. */}
                                <IdfProvenanceBadge provenance={this.props.result?.provenance} />
                                <ResultsTable idfTable={this.props.result}/>
                                <div className="idf-derive-results-actions">
                                    <Button
                                        id={'idf-derive-download-json'}
                                        bsSize={'small'}
                                        onClick={() => downloadProvenanceJson(this.props.result)}
                                    >
                                        <span className="glyphicon glyphicon-download-alt" aria-hidden="true" />
                                        {' '}
                                        <Message msgId="hydrata.hydrology.idfDeriveDownloadJson" />
                                    </Button>
                                    <Button
                                        id={'idf-derive-download-csv'}
                                        bsSize={'small'}
                                        onClick={this.handleCsvDownload}
                                    >
                                        <span className="glyphicon glyphicon-download-alt" aria-hidden="true" />
                                        {' '}
                                        <Message msgId="hydrata.hydrology.idfDeriveDownloadCsv" />
                                    </Button>
                                </div>

                                <div id={'idf-derive-provenance'} className="idf-derive-provenance">
                                    <button
                                        className="idf-derive-provenance-toggle"
                                        onClick={this.toggleProvenance}
                                        aria-expanded={this.state.provenanceOpen}
                                    >
                                        <span
                                            className={
                                                'glyphicon '
                                                + (this.state.provenanceOpen
                                                    ? 'glyphicon-chevron-down'
                                                    : 'glyphicon-chevron-right')
                                            }
                                            aria-hidden="true"
                                        />
                                        {' '}
                                        <Message msgId="hydrata.hydrology.idfDeriveProvenance" />
                                    </button>
                                    {this.state.provenanceOpen && (
                                        <pre className="idf-derive-provenance-pre">
                                            {JSON.stringify(this.props.result.provenance || {}, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const slice = state?.hydrology?.idfDerive || {};
    const processId = slice.processId;
    const proc = processId ? state?.taskMonitor?.processes?.byId?.[processId] : null;
    return {
        projectId: state?.anuga?.projects?.data?.id,
        lat: slice.lat,
        lon: slice.lon,
        durationsText: slice.durationsText,
        rpsText: slice.rpsText,
        mapPickActive: !!slice.mapPickActive,
        processId: slice.processId,
        error: slice.error,
        result: slice.result,
        celeryAnugaEnabled: slice.celeryAnugaEnabled !== false,
        inFlight: !!slice.inFlight,
        processStatus: proc?.status,
        processName: proc?.name,
        // TASK-1789 — year-range mode
        yearRangeMode: slice.yearRangeMode || '10yr'
    };
};

const mapDispatchToProps = (dispatch) => ({
    setIdfDeriveLat: (lat) => dispatch(setIdfDeriveLat(lat)),
    setIdfDeriveLon: (lon) => dispatch(setIdfDeriveLon(lon)),
    setIdfDeriveDurations: (text) => dispatch(setIdfDeriveDurations(text)),
    setIdfDeriveRPs: (text) => dispatch(setIdfDeriveRPs(text)),
    setIdfDeriveMapPickActive: (active) => dispatch(setIdfDeriveMapPickActive(active)),
    deriveIdfRequest: () => dispatch(deriveIdfRequest()),
    // TASK-1789 — year-range mode
    setIdfDeriveYearRangeMode: (mode) => dispatch(setIdfDeriveYearRangeMode(mode))
});

const HydrologyDetailIdfDerive = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfDeriveClass);

export default HydrologyDetailIdfDerive;
export {
    HydrologyDetailIdfDeriveClass,
    IdfDeriveMatrix,
    IdfProvenanceBadge,
    parseNumberList,
    downloadProvenanceJson,
    SUB_DAILY_THRESHOLD_MIN,
    CANONICAL_DURATIONS_MIN,
    CANONICAL_RETURN_PERIODS_YR,
    formatDuration,
    // TASK-1789 — year-range exports for test assertions
    IDF_YEAR_RANGE_OPTIONS,
    ERA5_MAX_YEAR
};
