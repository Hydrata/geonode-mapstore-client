import React, { useState } from 'react';
import { connect } from 'react-redux';
import { hideBmpHistory, fetchBmpHistory } from '../../actionsSwamm';
import { PanelHeader } from '../../../SimpleView/components/primitives';

const LOAD_FIELD_LABELS = {
    surface_previous_n_load: 'Surface Previous N',
    surface_n_load_reduction: 'Surface N Reduction',
    surface_new_n_load: 'Surface New N',
    surface_previous_p_load: 'Surface Previous P',
    surface_p_load_reduction: 'Surface P Reduction',
    surface_new_p_load: 'Surface New P',
    surface_previous_s_load: 'Surface Previous S',
    surface_s_load_reduction: 'Surface S Reduction',
    surface_new_s_load: 'Surface New S',
    tiled_previous_n_load: 'Tiled Previous N',
    tiled_n_load_reduction: 'Tiled N Reduction',
    tiled_new_n_load: 'Tiled New N',
    tiled_previous_p_load: 'Tiled Previous P',
    tiled_p_load_reduction: 'Tiled P Reduction',
    tiled_new_p_load: 'Tiled New P',
    erosion_previous_n_load: 'Erosion Previous N',
    erosion_n_load_reduction: 'Erosion N Reduction',
    erosion_new_n_load: 'Erosion New N',
    erosion_previous_p_load: 'Erosion Previous P',
    erosion_p_load_reduction: 'Erosion P Reduction',
    erosion_new_p_load: 'Erosion New P',
    erosion_previous_s_load: 'Erosion Previous S',
    erosion_s_load_reduction: 'Erosion S Reduction',
    erosion_new_s_load: 'Erosion New S',
    total_previous_n_load: 'Total Previous N',
    total_n_load_reduction: 'Total N Reduction',
    total_new_n_load: 'Total New N',
    total_previous_p_load: 'Total Previous P',
    total_p_load_reduction: 'Total P Reduction',
    total_new_p_load: 'Total New P',
    total_previous_s_load: 'Total Previous S',
    total_s_load_reduction: 'Total S Reduction',
    total_new_s_load: 'Total New S'
};

const EFFICIENCY_FIELD_LABELS = {
    override_n_surface_red_percent: 'N Surface Reduction %',
    override_p_surface_red_percent: 'P Surface Reduction %',
    override_s_surface_red_percent: 'S Surface Reduction %',
    override_n_tiled_red_percent: 'N Tiled Reduction %',
    override_p_tiled_red_percent: 'P Tiled Reduction %',
    override_n_erosion_red_percent: 'N Erosion Reduction %',
    override_p_erosion_red_percent: 'P Erosion Reduction %',
    override_s_erosion_red_percent: 'S Erosion Reduction %'
};

const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(4);
    return String(val);
};

/**
 * Given an override_flags_snapshot object of shape {surface_n: true, tiled_p: false, ...},
 * render one chip per truthy flag. Keys that don't match the pathway-pollutant
 * pattern are skipped. Returns null if the snapshot is missing or no chips to show.
 */
const OverrideFlagChips = ({ flags }) => {
    if (!flags || typeof flags !== 'object') return null;
    const POLLUTANT_LABELS = { n: 'N', p: 'P', s: 'S' };
    const PATHWAY_LABELS = { surface: 'surface', tiled: 'tiled', erosion: 'gully' };
    const chips = Object.entries(flags)
        .filter(([, v]) => !!v)
        .map(([key]) => {
            const parts = key.split('_');
            if (parts.length !== 2) return null;
            const [pathway, pollutant] = parts;
            if (!PATHWAY_LABELS[pathway] || !POLLUTANT_LABELS[pollutant]) return null;
            return {
                key,
                label: `${PATHWAY_LABELS[pathway]}-${POLLUTANT_LABELS[pollutant]}`
            };
        })
        .filter(Boolean);
    if (chips.length === 0) return null;
    return (
        <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {chips.map(chip => (
                <span
                    key={chip.key}
                    style={{
                        fontSize: '0.8em',
                        padding: '1px 6px',
                        borderRadius: 'var(--sv-card-radius, 4px)',
                        backgroundColor: 'var(--sv-pin-accent, rgba(120,220,180,0.6))',
                        border: '1px solid var(--sv-pin-accent, rgba(120,220,180,0.6))'
                    }}
                >
                    {chip.label}
                </span>
            ))}
        </span>
    );
};

const SnapshotTable = ({ data, labels }) => {
    if (!data || typeof data !== 'object') return null;
    const entries = Object.entries(data).filter(([k]) => labels[k]);
    if (entries.length === 0) return null;
    return (
        <table style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse' }}>
            <tbody>
                {entries.map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: '1px solid var(--sv-divider, rgba(255,255,255,0.08))' }}>
                        <td style={{ padding: '2px 6px', opacity: 0.8 }}>{labels[key] || key}</td>
                        <td style={{ padding: '2px 6px', textAlign: 'right' }}>{formatValue(val)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const HistoryRecord = ({ record, expanded, onToggle }) => (
    <div style={{
        marginBottom: 6,
        borderRadius: 'var(--sv-card-radius, 4px)',
        backgroundColor: 'var(--sv-divider, rgba(255,255,255,0.08))',
        overflow: 'hidden'
    }}>
        <div
            style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}
            onClick={onToggle}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--sv-row-hover-bg, rgba(255,255,255,0.10))'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
            <div>
                <div style={{ marginBottom: 2 }}>
                    <strong>{formatTimestamp(record.timestamp)}</strong>
                    {record.override_flags_snapshot ? (
                        <OverrideFlagChips flags={record.override_flags_snapshot} />
                    ) : (
                        record.manual_override_loads &&
                        <span style={{
                            marginLeft: 8,
                            fontSize: '0.8em',
                            padding: '1px 6px',
                            borderRadius: 'var(--sv-card-radius, 4px)',
                            backgroundColor: 'var(--sv-warning-bg, rgba(252,248,227,0.12))',
                            border: '1px solid var(--sv-warning-border, rgba(250,235,204,0.4))',
                            color: 'var(--sv-warning-color, #fcf8e3)'
                        }}>manual override</span>
                    )}
                </div>
                <div style={{ fontSize: '0.85em', opacity: 0.7 }}>
                    {record.reason_display || record.reason || 'Unknown reason'}
                    {record.changed_by_username &&
                        <span> &middot; {record.changed_by_username}</span>
                    }
                </div>
            </div>
            <span style={{ fontSize: '0.8em', opacity: 0.6 }}>
                {expanded ? '\u25B2' : '\u25BC'}
            </span>
        </div>
        {expanded && (
            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--sv-divider, rgba(255,255,255,0.08))',
                backgroundColor: 'var(--sv-inset-bg, rgba(0,0,0,0.15))'
            }}>
                {record.load_snapshot && Object.keys(record.load_snapshot).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: 4, opacity: 0.9 }}>
                            Load Values
                        </div>
                        <SnapshotTable data={record.load_snapshot} labels={LOAD_FIELD_LABELS} />
                    </div>
                )}
                {record.efficiency_snapshot && Object.keys(record.efficiency_snapshot).length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: 4, opacity: 0.9 }}>
                            Efficiency Overrides
                        </div>
                        <SnapshotTable data={record.efficiency_snapshot} labels={EFFICIENCY_FIELD_LABELS} />
                    </div>
                )}
            </div>
        )}
    </div>
);

const BmpHistoryViewer = ({ records, loading, nextCursor, projectId, bmpId, onClose, onLoadMore }) => {
    const [expandedId, setExpandedId] = useState(null);

    if (!records) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 1031,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onClick={onClose}
        >
            <div
                className="simple-view-panel"
                style={{
                    minWidth: 400,
                    maxWidth: 600,
                    maxHeight: '80vh',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                <PanelHeader
                    title={<span>Load History — BMP {bmpId}</span>}
                    onClose={onClose}
                    closeLabel="Close history"
                />
                <div style={{ padding: '8px 12px', overflowY: 'auto', flex: 1 }}>
                    {records.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, opacity: 0.7 }}>
                            No history records
                        </div>
                    ) : (
                        records.map(record => (
                            <HistoryRecord
                                key={record.id}
                                record={record}
                                expanded={expandedId === record.id}
                                onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                            />
                        ))
                    )}
                    {nextCursor && (
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <button
                                className="sv-swamm-button"
                                disabled={loading}
                                onClick={() => onLoadMore(projectId, bmpId, nextCursor)}
                            >
                                {loading ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const mapStateToProps = (state) => ({
    records: state?.swamm?.bmpHistoryRecords,
    loading: state?.swamm?.bmpHistoryLoading,
    nextCursor: state?.swamm?.bmpHistoryNextCursor,
    projectId: state?.swamm?.projectData?.id,
    bmpId: state?.swamm?.storedBmpForm?.id
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(hideBmpHistory()),
    onLoadMore: (projectId, bmpId, cursor) => dispatch(fetchBmpHistory(projectId, bmpId, cursor))
});

export default connect(mapStateToProps, mapDispatchToProps)(BmpHistoryViewer);
