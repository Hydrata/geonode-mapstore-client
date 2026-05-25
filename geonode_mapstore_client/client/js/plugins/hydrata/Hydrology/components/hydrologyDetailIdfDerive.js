/**
 * TASK-934 — IDF Derive panel.
 *
 * One-shot form (no list-of-items pattern). Posts {lat, lon, durations_min,
 * return_periods_yr} to /api/v2/anuga/projects/{pid}/idf-tables/derive/.
 * The derive endpoint returns 202 + {task_id, process_id}; we then watch
 * TaskMonitor for the matching process row to flip to 'complete' and
 * fetch the resulting IDFTable for inline display.
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
        <div className="" style={{overflowX: 'auto', maxWidth: '100%'}}>
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

    render() {
        const {durations, errors} = this.validate();
        const minDuration = minOf(durations);
        const showSubDailyBanner = Number.isFinite(minDuration) && minDuration < SUB_DAILY_THRESHOLD_MIN;
        const isInFlight = this.props.inFlight
            && this.props.processId
            && (this.props.processStatus === 'pending'
                || this.props.processStatus === 'running'
                || !this.props.processStatus);
        const disabled = !this.props.celeryAnugaEnabled
            || errors.length > 0
            || isInFlight;

        return (
            <div id={'hydrology-idf-derive-panel'} style={{padding: '10px'}}>
                <h3 style={{marginTop: 0, color: 'white'}}>
                    <Message msgId="hydrata.hydrology.idfDerive" />
                </h3>

                <div style={{display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '10px'}}>
                    <label htmlFor={'idf-derive-lat'} style={{color: 'white', width: '90px'}}>
                        <Message msgId="hydrata.hydrology.idfDeriveLat" />
                    </label>
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
                    <label htmlFor={'idf-derive-lon'} style={{color: 'white', width: '90px'}}>
                        <Message msgId="hydrata.hydrology.idfDeriveLon" />
                    </label>
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
                    <Button
                        id={'idf-derive-pick-on-map'}
                        bsSize={'small'}
                        bsStyle={this.props.mapPickActive ? 'primary' : 'default'}
                        onClick={this.handlePickClick}
                    >
                        <Message msgId="hydrata.hydrology.idfDerivePickOnMap" />
                    </Button>
                </div>

                <div style={{marginBottom: '10px'}}>
                    <label htmlFor={'idf-derive-durations'} style={{color: 'white', display: 'block'}}>
                        <Message msgId="hydrata.hydrology.idfDeriveDurations" />
                    </label>
                    <input
                        id={'idf-derive-durations'}
                        type={'text'}
                        className={'hydrology-text-input'}
                        style={{width: '500px'}}
                        value={this.props.durationsText}
                        onChange={(e) => this.props.setIdfDeriveDurations(e.target.value)}
                    />
                </div>

                <div style={{marginBottom: '10px'}}>
                    <label htmlFor={'idf-derive-rps'} style={{color: 'white', display: 'block'}}>
                        <Message msgId="hydrata.hydrology.idfDeriveRPs" />
                    </label>
                    <input
                        id={'idf-derive-rps'}
                        type={'text'}
                        className={'hydrology-text-input'}
                        style={{width: '500px'}}
                        value={this.props.rpsText}
                        onChange={(e) => this.props.setIdfDeriveRPs(e.target.value)}
                    />
                </div>

                {showSubDailyBanner && (
                    <div
                        id={'idf-derive-sub-daily-banner'}
                        style={{
                            backgroundColor: '#fcf8e3',
                            border: '1px solid #faebcc',
                            color: '#8a6d3b',
                            padding: '10px',
                            marginBottom: '10px',
                            borderRadius: '4px'
                        }}
                    >
                        <span className={'glyphicon glyphicon-warning-sign'} style={{marginRight: '6px'}}/>
                        <Message msgId="hydrata.hydrology.idfDeriveSubDailyBanner" />
                    </div>
                )}

                {errors.length > 0 && (
                    <div
                        id={'idf-derive-validation-errors'}
                        style={{color: '#f2dede', marginBottom: '10px'}}
                    >
                        {errors.join('; ')}
                    </div>
                )}

                {!this.props.celeryAnugaEnabled ? (
                    <div
                        id={'idf-derive-unavailable'}
                        style={{
                            color: '#fff',
                            backgroundColor: '#5e5e5e',
                            padding: '8px',
                            borderRadius: '4px',
                            marginBottom: '10px'
                        }}
                    >
                        <Message msgId="hydrata.hydrology.idfDeriveUnavailable" />
                    </div>
                ) : (
                    <Button
                        id={'idf-derive-button'}
                        bsStyle={'success'}
                        disabled={disabled}
                        onClick={this.handleDeriveClick}
                    >
                        <Message msgId="hydrata.hydrology.idfDeriveDeriveButton" />
                    </Button>
                )}

                {this.props.error && (
                    <div
                        id={'idf-derive-error'}
                        style={{color: '#f2dede', marginTop: '10px'}}
                    >
                        {this.props.error}
                    </div>
                )}

                {isInFlight && (
                    <div
                        id={'idf-derive-progress'}
                        style={{color: 'white', marginTop: '10px'}}
                    >
                        <span className={'glyphicon glyphicon-refresh'} style={{marginRight: '6px'}}/>
                        {this.props.processName || 'Deriving IDF...'}
                    </div>
                )}

                {this.props.result && (
                    <div id={'idf-derive-results'} style={{marginTop: '15px', backgroundColor: 'white', padding: '10px', borderRadius: '4px'}}>
                        <ResultsTable idfTable={this.props.result}/>
                        <div style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
                            <Button
                                id={'idf-derive-download-json'}
                                bsSize={'small'}
                                onClick={() => downloadProvenanceJson(this.props.result)}
                            >
                                <Message msgId="hydrata.hydrology.idfDeriveDownloadJson" />
                            </Button>
                            <Button
                                id={'idf-derive-download-csv'}
                                bsSize={'small'}
                                onClick={this.handleCsvDownload}
                            >
                                <Message msgId="hydrata.hydrology.idfDeriveDownloadCsv" />
                            </Button>
                        </div>
                        <div id={'idf-derive-provenance'} style={{marginTop: '10px', fontSize: '0.9em', color: '#333'}}>
                            <h4><Message msgId="hydrata.hydrology.idfDeriveProvenance" /></h4>
                            <pre style={{whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto'}}>
                                {JSON.stringify(this.props.result.provenance || {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
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
