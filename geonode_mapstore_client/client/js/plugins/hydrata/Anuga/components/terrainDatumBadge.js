/**
 * TASK-2327 (epic 2323) — Vertical-datum badge for a terrain row.
 *
 * Reads the BE inference (TerrainSerializerV2 `vertical_datum`, from TASK-2325)
 * off a terrain-model row and surfaces a NON-BLOCKING advisory in the terrain
 * list (anugaInputMenu TerrainHierarchyRow). Loud ONLY when there is a likely
 * problem, quiet when fine:
 *
 *   - datum_guess === 'ellipsoid'                       -> WARN (offer 3 actions)
 *   - a KNOWN guess we are not confident about (< 0.6)  -> WARN (offer 3 actions)
 *   - datum_guess === 'orthometric_egm2008' high-conf   -> quiet confirmed tick
 *   - 'unknown' / unstamped legacy terrain              -> silent (never nag)
 *
 * The 3 WARN actions: "Convert to EGM2008" (dispatches the TASK-2326 derived-
 * terrain action — never auto-converts), "Keep as-is" and "It's already correct"
 * both locally dismiss the advisory. Styling mirrors the terrain-row chrome
 * (TASK-1749/1750): inline glyph + pill, sv-anuga-* class hooks + data-testids
 * for Chrome-MCP verification.
 */
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Message from '@mapstore/framework/components/I18N/Message';
import {getProjectId} from '@js/plugins/hydrata/Anuga/selectorsAnuga';
import {convertTerrainDatum} from '@js/plugins/hydrata/Anuga/actions/dataActions';

// A known guess below this confidence is surfaced as "unverified" (WARN).
export const DATUM_LOW_CONFIDENCE = 0.6;

// Returns 'warn' | 'ok' | null (null = stay silent, non-blocking).
export function datumBadgeSeverity(verticalDatum) {
    if (!verticalDatum || !verticalDatum.datum_guess) return null;
    const guess = verticalDatum.datum_guess;
    const conf = typeof verticalDatum.confidence === 'number' ? verticalDatum.confidence : null;
    if (guess === 'ellipsoid') return 'warn';
    if (guess === 'orthometric_egm2008') {
        return (conf !== null && conf < DATUM_LOW_CONFIDENCE) ? 'warn' : 'ok';
    }
    return null; // 'unknown' -> we make no claim, so we stay silent
}

class TerrainDatumBadge extends React.Component {
    static propTypes = {
        terrain: PropTypes.object,       // the terrain-model row (carries vertical_datum + id)
        projectId: PropTypes.number,
        onConvert: PropTypes.func
    };

    constructor(props) {
        super(props);
        // WARN opens expanded so the evidence + actions are immediately visible
        // (this is the "loud" case). The header toggles it; the two ack buttons
        // dismiss it entirely for the session.
        this.state = {expanded: true, dismissed: false};
    }

    render() {
        const {terrain, projectId, onConvert} = this.props;
        const verticalDatum = terrain && terrain.vertical_datum;
        const severity = datumBadgeSeverity(verticalDatum);
        if (!severity || this.state.dismissed) return null;

        const terrainId = terrain.id;

        if (severity === 'ok') {
            return (
                <span
                    className="sv-anuga-terrain-datum-ok"
                    data-testid={`terrain-datum-ok-${terrainId}`}
                    title="Vertical datum verified as EGM2008 (orthometric)"
                    style={{marginLeft: 6, color: 'rgba(120,210,140,0.9)', fontSize: 11, whiteSpace: 'nowrap'}}
                >
                    <span className="glyphicon glyphicon-ok-circle" aria-hidden="true" style={{marginRight: 3}} />
                    <Message msgId="hydrata.anuga.terrainDatumConfirmed" />
                </span>
            );
        }

        // WARN
        const offset = verticalDatum.dod_vs_glo30_median_m;
        const offsetStr = (typeof offset === 'number') ? `${offset > 0 ? '+' : ''}${offset.toFixed(1)}` : '—';
        const guess = verticalDatum.datum_guess;
        const {expanded} = this.state;

        return (
            <div
                className="sv-anuga-terrain-datum-badge"
                data-testid={`terrain-datum-badge-${terrainId}`}
                style={{
                    margin: '2px 0 4px 18px', padding: '4px 6px',
                    borderLeft: '3px solid rgba(240,180,90,0.9)',
                    background: 'rgba(240,180,90,0.10)', borderRadius: 3, fontSize: 11
                }}
            >
                <span
                    role="button"
                    tabIndex={0}
                    className="sv-anuga-terrain-datum-badge-head"
                    data-testid={`terrain-datum-badge-toggle-${terrainId}`}
                    onClick={() => this.setState((s) => ({expanded: !s.expanded}))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setState((s) => ({expanded: !s.expanded})); } }}
                    style={{cursor: 'pointer', color: 'rgba(245,200,130,0.95)', fontWeight: 600, display: 'inline-flex', alignItems: 'center'}}
                    title="Check this terrain's vertical datum"
                >
                    <span className="glyphicon glyphicon-warning-sign" aria-hidden="true" style={{marginRight: 4}} />
                    <Message msgId="hydrata.anuga.terrainDatumBadgeWarn" />
                </span>
                {expanded ? (
                    <div className="sv-anuga-terrain-datum-detail" style={{marginTop: 4}}>
                        <div
                            className="sv-anuga-terrain-datum-evidence"
                            data-testid={`terrain-datum-evidence-${terrainId}`}
                            style={{color: 'rgba(255,255,255,0.75)', marginBottom: 5}}
                        >
                            <Message
                                msgId="hydrata.anuga.terrainDatumBadgeEvidence"
                                msgParams={{guess, offset: offsetStr}}
                            />
                        </div>
                        <div className="sv-anuga-terrain-datum-actions" style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                            <button
                                type="button"
                                className="btn btn-xs btn-primary sv-anuga-terrain-datum-convert"
                                data-testid={`terrain-datum-convert-${terrainId}`}
                                onClick={() => onConvert && onConvert(projectId, terrainId)}
                            >
                                <Message msgId="hydrata.anuga.terrainDatumConvert" />
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs btn-default sv-anuga-terrain-datum-keep"
                                data-testid={`terrain-datum-keep-${terrainId}`}
                                onClick={() => this.setState({dismissed: true})}
                            >
                                <Message msgId="hydrata.anuga.terrainDatumKeep" />
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs btn-default sv-anuga-terrain-datum-correct"
                                data-testid={`terrain-datum-correct-${terrainId}`}
                                onClick={() => this.setState({dismissed: true})}
                            >
                                <Message msgId="hydrata.anuga.terrainDatumCorrect" />
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }
}

export default connect(
    (state) => ({projectId: getProjectId(state)}),
    (dispatch) => ({onConvert: (projectId, terrainId) => dispatch(convertTerrainDatum(projectId, terrainId))})
)(TerrainDatumBadge);
