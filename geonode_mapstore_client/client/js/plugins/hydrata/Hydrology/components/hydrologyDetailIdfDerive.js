/**
 * TASK-934 — IDF Derive panel (originally); TASK-1452 (W5) — redesigned.
 *
 * W5 redesign: reflows the one-shot form into a 4-step vertical stepper
 * rendered inside the standard .anuga-scenario-pane-detail idiom:
 *
 *   Step 1 — LOCATION   lat/lon row + Pick-on-map toggle
 *   Step 2 — PARAMETERS durations + return-periods + sub-daily banner
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
    deriveIdfRequest
} from '../actionsHydrology';
import '../hydrology.css';
import '../../SimpleView/simpleView.css';

// Sub-daily warning threshold — minutes. ERA5-Land hourly systematically
// underestimates ≤6h peak intensities (Lavers 2024, Brown 2023). Anything
// shorter than 1440 min (24h) triggers the validation-recommended banner.
const SUB_DAILY_THRESHOLD_MIN = 1440;

// parseNumberList — comma-separated → number[].
// Empty tokens are dropped (so '60,,180' → [60, 180]); non-numeric tokens
// are filtered out so the helper itself never returns NaN. Callers that
// need to detect bad input (e.g. the inline validator) inspect the raw
// tokens separately rather than relying on parseNumberList's output.
const parseNumberList = (text) => {
    if (text === null || text === undefined) return [];
    return String(text)
        .split(',')
        .map(s => String(s).trim())
        .filter(s => s.length > 0)
        .map(s => Number(s))
        .filter(n => Number.isFinite(n));
};

// hasBadToken — returns true iff any non-empty comma-separated token does
// not parse to a finite number. Used by validate() so 'foo' isn't silently
// dropped.
const hasBadToken = (text) => {
    if (text === null || text === undefined) return false;
    const tokens = String(text)
        .split(',')
        .map(s => String(s).trim())
        .filter(s => s.length > 0);
    return tokens.some(t => !Number.isFinite(Number(t)));
};

const minOf = (arr) => (arr.length === 0 ? Infinity : Math.min(...arr));

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
        setIdfDeriveLat: PropTypes.func,
        setIdfDeriveLon: PropTypes.func,
        setIdfDeriveDurations: PropTypes.func,
        setIdfDeriveRPs: PropTypes.func,
        setIdfDeriveMapPickActive: PropTypes.func,
        deriveIdfRequest: PropTypes.func
    };

    static defaultProps = {
        celeryAnugaEnabled: true,
        mapPickActive: false,
        inFlight: false
    };

    // Provenance collapsible state (local only — no need in Redux).
    constructor(props) {
        super(props);
        this.state = {
            provenanceOpen: false
        };
    }

    // Inline validation — runs on every render to disable Derive and show
    // an error string when inputs are malformed. The epic re-validates BE
    // side, so any race condition is non-fatal.
    validate = () => {
        const durations = parseNumberList(this.props.durationsText);
        const rps = parseNumberList(this.props.rpsText);
        const errors = [];
        if (hasBadToken(this.props.durationsText)) errors.push('Durations: non-numeric value');
        if (hasBadToken(this.props.rpsText)) errors.push('Return periods: non-numeric value');
        if (durations.length === 0) errors.push('Durations required');
        if (rps.length === 0) errors.push('Return periods required');
        if (durations.some(n => n < 60)) errors.push('All durations must be ≥60 min');
        if (rps.some(n => n < 2)) errors.push('All return periods must be ≥2 yr');
        const dupD = durations.length !== new Set(durations).size;
        const dupR = rps.length !== new Set(rps).size;
        if (dupD) errors.push('Duplicate durations');
        if (dupR) errors.push('Duplicate return periods');
        if (!Number.isFinite(this.props.lat) || !Number.isFinite(this.props.lon)) {
            errors.push('Lat/lon required');
        }
        return {durations, rps, errors};
    };

    handlePickClick = () => {
        this.props.setIdfDeriveMapPickActive(!this.props.mapPickActive);
    };

    handleDeriveClick = () => {
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

    render() {
        const {durations, errors} = this.validate();
        const minDuration = minOf(durations);
        const showSubDailyBanner = Number.isFinite(minDuration) && minDuration < SUB_DAILY_THRESHOLD_MIN;
        const isInFlight = this.props.inFlight
            && this.props.processId
            && (this.props.processStatus === 'pending'
                || this.props.processStatus === 'running'
                || !this.props.processStatus);

        // Derive button disabled tooltip reason — show the FIRST reason only.
        // NOTE: all values here must be human-readable strings; i18n keys must
        // NOT be passed directly (they render as raw key strings in HTML title).
        // The celery-unavailable message comes from the inline notice below, so
        // the title is left empty in that case to avoid key-string leakage.
        let deriveDisabledReason = null;
        if (!this.props.celeryAnugaEnabled) {
            deriveDisabledReason = null; // visible notice shown inline; don't leak i18n key
        } else if (isInFlight) {
            deriveDisabledReason = null; // progress indicator shown inline
        } else if (errors.length > 0) {
            deriveDisabledReason = errors[0]; // raw human-readable validation string
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

                    {/* ── STEP 2: PARAMETERS ──────────────────────────── */}
                    <div
                        id="idf-derive-step-parameters"
                        className="idf-derive-step"
                    >
                        <IdfDeriveStepHeader step={2} titleMsgId="hydrata.hydrology.idfDeriveStepParameters" />

                        <div className="anuga-scenario-pane-section">
                            <span className="anuga-scenario-pane-label">
                                <Message msgId="hydrata.hydrology.idfDeriveDurations" />
                            </span>
                            <div className="anuga-scenario-pane-field">
                                <input
                                    id={'idf-derive-durations'}
                                    type={'text'}
                                    className={'hydrology-text-input idf-derive-wide-input'}
                                    value={this.props.durationsText}
                                    onChange={(e) => this.props.setIdfDeriveDurations(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="anuga-scenario-pane-section">
                            <span className="anuga-scenario-pane-label">
                                <Message msgId="hydrata.hydrology.idfDeriveRPs" />
                            </span>
                            <div className="anuga-scenario-pane-field">
                                <input
                                    id={'idf-derive-rps'}
                                    type={'text'}
                                    className={'hydrology-text-input idf-derive-wide-input'}
                                    value={this.props.rpsText}
                                    onChange={(e) => this.props.setIdfDeriveRPs(e.target.value)}
                                />
                            </div>
                        </div>

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
        processName: proc?.name
    };
};

const mapDispatchToProps = (dispatch) => ({
    setIdfDeriveLat: (lat) => dispatch(setIdfDeriveLat(lat)),
    setIdfDeriveLon: (lon) => dispatch(setIdfDeriveLon(lon)),
    setIdfDeriveDurations: (text) => dispatch(setIdfDeriveDurations(text)),
    setIdfDeriveRPs: (text) => dispatch(setIdfDeriveRPs(text)),
    setIdfDeriveMapPickActive: (active) => dispatch(setIdfDeriveMapPickActive(active)),
    deriveIdfRequest: () => dispatch(deriveIdfRequest())
});

const HydrologyDetailIdfDerive = connect(mapStateToProps, mapDispatchToProps)(HydrologyDetailIdfDeriveClass);

export default HydrologyDetailIdfDerive;
export {HydrologyDetailIdfDeriveClass, parseNumberList, downloadProvenanceJson, SUB_DAILY_THRESHOLD_MIN};
