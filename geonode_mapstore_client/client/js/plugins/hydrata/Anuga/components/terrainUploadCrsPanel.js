/**
 * TASK-1880 (epic 1884 W2 — THE HEADLINE) — in-app terrain-upload CRS picker.
 *
 * Replaces the MissingCRSError dead-end (bounce the modeller to QGIS to tag the
 * raster) with in-app recovery: a CRS-less DEM uploads by the user assigning its
 * SOURCE CRS in this picker. The picker assigns ONLY the per-file source CRS so a
 * CRS-less raster can be interpreted; it does NOT set project.projection (the
 * project keeps bootstrapping its CRS from the first terrain) and the TARGET UTM
 * zone stays auto-derived (D1).
 *
 * Lifecycle (the upload glyph / starter CTA route through anugaInputMenu's
 * _onTerrainFileSelected, which now OPENS this panel carrying the File + an
 * auto-title instead of starting the byte transfer):
 *   1. On open, detectGeotiffCrs(file) runs (cheap header range-read) (D2):
 *        hasCrs===true  → show "Detected CRS: <epsg>" read-only; Confirm proceeds
 *                         with NO override.
 *        hasCrs===false → the source-CRS picker is REQUIRED before Confirm.
 *        hasCrs===null  → inconclusive parse: an always-shown OPTIONAL source-CRS
 *                         field; NEVER block upload on a parse failure (the BE
 *                         only applies the override to a CRS-less raster anyway).
 *   2. The source-CRS control starts UNSELECTED (D3) — nothing pre-selected; a
 *      wrong source CRS silently produces a wrong flood model, so no auto-accept.
 *      Confirm stays DISABLED until the user actively picks (in the required path).
 *   3. Confirm runs uploadTerrainDirect(projectId, file, {title, crsOverride});
 *      crsOverride is forwarded to finalize as `crs_override` (TASK-1885 BE
 *      contract). The BE (osr.SetFromUserInput) is the SINGLE authority (D4) — a
 *      typed national-grid code proj4 can't resolve is NOT hard-blocked here; the
 *      BE 400 VALIDATION_ERROR surfaces in the ErrorStrip via err.data.
 *
 * Mounted as a CONTAINER-LEVEL sibling (anugaContainer.js) like TerrainBboxPanel
 * so closing the Inputs menu cannot unmount it mid-upload (the TASK-1648 lesson).
 * Self-gates on the redux terrainUploadCrsPanelVisible flag.
 *
 * Styling is the project-standard dark-glass chassis: PanelShell + PanelHeader +
 * ErrorStrip + FormRow primitives, a NATIVE <select className="sv-scenario-select">
 * dual-classed with a thin local width variant (anuga.css .sv-crs-picker-select),
 * react-bootstrap Button. No react-select / Modal / bespoke design-system CSS, and
 * no MapStore2 submodule edit.
 */
import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import { ErrorStrip, FormRow } from '../../SimpleView/components/primitives';
import MovablePanel from '../../shared/components/MovablePanel';
import {
    setTerrainUploadCrsPanel,
    setTerrainUploadCrsError,
    startAnugaModelCreationPolling
} from '../actionsAnuga';
import { setMovablePanelState } from '../actions/uiActions';
import { updateProcess, toggleTaskMonitorPanel } from '../../TaskMonitor/actionsTaskMonitor';
import { getProjectId } from '@js/plugins/hydrata/Anuga/selectorsAnuga';
import { uploadTerrainDirect } from '../api/anugaApi';
import { listUtmWgs84CRS, utmCodeFromBbox, detectGeotiffCrs } from '../../Utils/crsHelpers';
import { trackEvent } from '@js/utils/analytics';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

// Free-text sentinel value for the "type an EPSG code" picker option.
const FREEFORM = '__freeform__';

// epic 2323 / TASK-2327 (re-aim): this dialog now rides MovablePanel (drag +
// resize) with its OWN persistence key, and opens OFFSET from the top-left Inputs
// panel so it reads as a distinct floating dialog rather than part of the panel
// behind it.
export const TERRAIN_UPLOAD_CRS_PANEL_ID = 'terrainUploadCrs';
function defaultUploadCrsPosition() {
    if (typeof window === 'undefined') { return { x: 40, y: 150 }; }
    // Offset right of the left nav + down from the Inputs-panel header so the
    // dialog is visually separated from the panel behind it.
    return { x: Math.max(40, Math.round(window.innerWidth * 0.22)), y: 150 };
}

export class TerrainUploadCrsPanelClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        file: PropTypes.object,           // the picked File/Blob (rides redux)
        title: PropTypes.string,          // auto-title (file.name minus extension)
        error: PropTypes.string,          // BE finalize 400 surfaced in the ErrorStrip
        projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        // Shortcut sources (read off redux):
        projectProjection: PropTypes.string,            // shortcut 1 (project CRS)
        terrainCrs: PropTypes.arrayOf(PropTypes.string), // shortcut 1 (existing terrain CRS)
        projectExtentBbox: PropTypes.object,            // shortcut 2 (AOI for UTM-from-bbox)
        // Dispatch:
        setTerrainUploadCrsPanel: PropTypes.func,
        setTerrainUploadCrsError: PropTypes.func,
        onUpdateProcess: PropTypes.func,
        onOpenTaskMonitor: PropTypes.func,
        startAnugaModelCreationPolling: PropTypes.func,
        // Injectable for tests (defaults to the real crsHelpers detector).
        detectGeotiffCrs: PropTypes.func,
        // MovablePanel position/size persistence (TASK-2327 re-aim).
        panelState: PropTypes.object,
        setMovablePanelState: PropTypes.func
    };

    static defaultProps = {
        detectGeotiffCrs
    };

    constructor(props) {
        super(props);
        this.state = {
            title: props.title || '',
            // detection: null = not yet run / inconclusive, true/false once resolved.
            detecting: false,
            detected: null,        // {hasCrs, epsg, label} from detectGeotiffCrs
            // The source-CRS the user picked. '' = UNSELECTED (D3 — nothing
            // pre-selected). selectedCrs holds the <select> value; freeformCrs holds
            // the typed EPSG when the FREEFORM option is chosen.
            selectedCrs: '',
            freeformCrs: '',
            // epic 2323 / TASK-2327: the user's VERTICAL-datum declaration.
            // '' = "Not sure — check after upload" (default; inference decides).
            verticalDatumDeclared: '',
            // "Convert to EGM2008 after upload" — only meaningful (enabled) when the
            // datum is ellipsoidal; the BE auto-runs the conversion once imported.
            convertAfterUpload: false,
            uploading: false
        };
        // TASK-1881: beforeunload handler reference, held so we can remove it
        // precisely (addEventListener and removeEventListener must share the
        // same function reference).
        this._beforeUnloadHandler = null;
    }

    _addNavGuard() {
        // TASK-1881: warn the user before navigating away while an upload is in
        // flight. The browser only shows the native "Leave site?" dialog when
        // the handler calls event.preventDefault() (Chromium ≥119 / Firefox
        // 110+ convention). The legacy returnValue assignment is kept for
        // older browsers that still read it.
        this._beforeUnloadHandler = (e) => {
            e.preventDefault();
            e.returnValue = ''; // legacy browsers
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    }

    _removeNavGuard() {
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
    }

    componentWillUnmount() {
        // Safety net: if the component is destroyed mid-upload (shouldn't
        // happen — panel is a container-level sibling per TASK-1648 lesson)
        // we still remove the handler to avoid a memory leak.
        this._removeNavGuard();
    }

    componentDidMount() {
        if (this.props.visible && this.props.file) {
            this._runDetect(this.props.file);
        }
    }

    componentDidUpdate(prevProps) {
        // Panel just opened (or a new File arrived) → reset transient form state and
        // re-detect. The reducer already resets the redux ui cluster on open/close;
        // this resets the component-local picker state (detection, selection,
        // uploading latch) so a re-opened picker is clean. Guarded on a prop
        // transition so it can't loop. (Same intentional-reset pattern as
        // membershipPanel's componentDidMount.)
        const opened = this.props.visible && !prevProps.visible;
        const newFile = this.props.file && this.props.file !== prevProps.file;
        if (opened || newFile) {
            // eslint-disable-next-line react/no-did-update-set-state -- intentional reset of transient picker state on (re)open / new file
            this.setState({
                title: this.props.title || '',
                detecting: false,
                detected: null,
                selectedCrs: '',
                freeformCrs: '',
                verticalDatumDeclared: '',
                convertAfterUpload: false,
                uploading: false
            });
            if (this.props.file) this._runDetect(this.props.file);
        }
    }

    _runDetect(file) {
        this.setState({ detecting: true });
        // Ignore a late resolve after the panel closed OR a different file was picked
        // (a stale detect must not overwrite the current file's detection result).
        const fresh = () => this.props.visible && this.props.file === file;
        Promise.resolve(this.props.detectGeotiffCrs(file))
            .then((result) => {
                if (!fresh()) return;
                this.setState({ detecting: false, detected: result || { hasCrs: null, epsg: null, label: null } });
            })
            .catch(() => {
                if (!fresh()) return;
                // detectGeotiffCrs never throws, but be defensive: fall back to the
                // inconclusive (optional-field) path rather than blocking.
                this.setState({ detecting: false, detected: { hasCrs: null, epsg: null, label: null } });
            });
    }

    // The CRS the upload should carry, or undefined when none is to be sent.
    // - detected hasCrs===true → undefined (no override; BE finalizes as-is)
    // - FREEFORM picked        → the trimmed typed code
    // - a list option picked   → that EPSG code
    // - nothing picked         → undefined
    _resolveCrsOverride() {
        const { detected, selectedCrs, freeformCrs } = this.state;
        // Detected CRS → no override (BE finalizes the tagged raster as-is).
        // A falsy code (nothing picked / empty free-text) also yields undefined so
        // finalize OMITS crs_override (single return keeps consistent-return happy).
        const detectedHasCrs = !!(detected && detected.hasCrs === true);
        const picked = selectedCrs === FREEFORM ? (freeformCrs || '').trim() : selectedCrs;
        const code = detectedHasCrs ? '' : picked;
        return code || undefined;
    }

    // The vertical datum to record on the upload, or undefined to defer to the
    // server-side DoD inference. An embedded vertical CRS (verticalDatumGuess)
    // is authoritative and wins over a user declaration; otherwise the user's
    // pick (or '' = "not sure") is forwarded (the BE only honours the two
    // positive values and drops anything else).
    _resolveVerticalDatum() {
        const { detected, verticalDatumDeclared } = this.state;
        const embedded = detected && detected.verticalDatumGuess;
        return embedded || verticalDatumDeclared || undefined;
    }

    // The picker is REQUIRED only when the file definitively lacks a CRS
    // (hasCrs===false). Detected (true) needs nothing; inconclusive (null) shows an
    // OPTIONAL field that never blocks the upload (D2).
    _crsRequired() {
        const { detected } = this.state;
        return !!(detected && detected.hasCrs === false);
    }

    // Confirm gate (D3): never while detecting / uploading / no file. In the
    // required path Confirm stays DISABLED until the user actively picks a CRS
    // (and, for the free-text option, types a non-empty code).
    _confirmDisabled() {
        if (this.state.uploading || this.state.detecting || !this.props.file) return true;
        if (!this._crsRequired()) return false;        // detected / inconclusive → free to proceed
        if (!this.state.selectedCrs) return true;       // nothing picked
        if (this.state.selectedCrs === FREEFORM && !(this.state.freeformCrs || '').trim()) return true;
        return false;
    }

    // Picker shortcut options, in product-owner priority order, NONE pre-selected:
    //   (1) project's existing CRS (existing terrain CRS and/or project.projection)
    //   (2) recommended UTM WGS84 zone for THIS PROJECT'S AOI (utmCodeFromBbox)
    //   (3) the searchable UTM WGS84 list + EPSG:4326
    //   (4) "type an EPSG code" free-text (FREEFORM)
    _buildShortcuts() {
        const seen = new Set();
        const shortcuts = [];
        const push = (code, label) => {
            if (!code || seen.has(code)) return;
            seen.add(code);
            shortcuts.push({ code, label });
        };
        // (1) project's existing CRS.
        (this.props.terrainCrs || []).forEach((c) => push(c, c));
        if (this.props.projectProjection) push(this.props.projectProjection, this.props.projectProjection);
        // (2) recommended UTM zone for the project AOI — NEVER the un-tagged file's
        //     own bbox (its CRS is unknown). projectExtentBbox is the project AOI /
        //     existing-terrain extent in MapStore bbox shape ({bounds, crs}).
        const recommended = this.props.projectExtentBbox ? utmCodeFromBbox(this.props.projectExtentBbox) : null;
        if (recommended) push(recommended, `${recommended} (recommended for this area)`);
        return shortcuts;
    }

    // TASK-2039 (F4) — a11y: resolve a terrainCrs* message id to plain text for
    // aria-label (screen readers announce a11y attributes, not <Message> children,
    // and must never speak a raw msgId). getMessageById returns the msgId itself
    // on a lookup miss (locale not yet loaded / message undefined) — the fallback
    // covers that gap so the button always has a real accessible name. Matches the
    // tr() pattern in anugaScenarioMenu.js / anugaInputStarterCard.js.
    tr = (msgId, fallback) => {
        const messages = (this.context && this.context.messages) || {};
        const resolved = getMessageById(messages, msgId);
        return resolved === msgId ? fallback : resolved;
    };

    handleSelectChange = (value) => {
        this.setState({ selectedCrs: value });
        if (this.props.error) this.props.setTerrainUploadCrsError(null);
    };

    handleCancel = () => {
        // Closing discards the File without uploading (D — Cancel).
        this.props.setTerrainUploadCrsPanel(false);
        trackEvent('button', 'click', 'anuga-terrain-crs-picker-cancel');
    };

    handleConfirm = () => {
        const { file, projectId } = this.props;
        if (!file || !projectId || this.state.uploading) return;
        const title = (this.state.title || '').trim() || (this.props.title || '');
        const crsOverride = this._resolveCrsOverride();
        const verticalDatumDeclared = this._resolveVerticalDatum();
        // Only request the auto-convert for an ellipsoid terrain that the user ticked.
        const convertToEgm2008 = verticalDatumDeclared === 'ellipsoid' && this.state.convertAfterUpload;
        const name = `Terrain upload: ${file.name}`;
        this.setState({ uploading: true });
        // TASK-1881: register the nav guard BEFORE the first async step so the
        // user can't navigate away during the presign → S3 PUT → finalize chain.
        this._addNavGuard();
        this.props.setTerrainUploadCrsError(null);
        if (this.props.onOpenTaskMonitor) this.props.onOpenTaskMonitor(true);
        // TASK-2139 (c.i): trackEvent is (category, action, label) only — a
        // 4th arg is silently dropped. Fold the override-vs-detected
        // distinction into the label itself instead of losing it.
        trackEvent('process', 'start', `anuga-terrain-direct-upload-${crsOverride ? 'with-crs-override' : 'detected-crs'}`);

        let rowId = `terrain-upload-${Date.now()}`;
        const emit = (id, fields) => {
            if (!this.props.onUpdateProcess) return;
            const now = new Date().toISOString();
            this.props.onUpdateProcess({
                id, process_type: 'terrain_create', created: now, updated: now,
                subtasks: [], log: '', ...fields
            });
        };

        // Guard the post-upload state mutations: if the user re-opened the picker
        // for a DIFFERENT file while this one was in flight, the redux file has been
        // swapped — don't let this upload's resolution close or error the panel that
        // now belongs to the new file. (The Tasks-Panel row still updates regardless.)
        const stillActive = () => this.props.file === file;

        uploadTerrainDirect(projectId, file, {
            title,
            crsOverride,
            verticalDatumDeclared,
            convertToEgm2008,
            onPresign: (data) => {
                if (data && data.process_id) rowId = data.process_id;
                emit(rowId, { name, status: 'running', progress_pct: 0, status_detail: 'Uploading' });
            },
            onProgress: (pct) => {
                emit(rowId, pct >= 100
                    ? { name, status: 'running', progress_pct: 100, status_detail: 'Importing' }
                    : { name, status: 'running', progress_pct: pct, status_detail: 'Uploading' });
            }
        })
            .then(() => {
                // TASK-1881: nav guard no longer needed once the upload succeeds.
                this._removeNavGuard();
                emit(rowId, { name, status: 'running', progress_pct: 100, status_detail: 'Importing' });
                if (this.props.startAnugaModelCreationPolling) this.props.startAnugaModelCreationPolling();
                trackEvent('process', 'complete', 'anuga-terrain-direct-upload');
                // Success → close the picker. The Tasks-Panel row carries the import.
                if (!stillActive()) return;
                this.setState({ uploading: false });
                this.props.setTerrainUploadCrsPanel(false);
            })
            .catch((err) => {
                // TASK-1881: nav guard removed on failure too (panel stays open for
                // retry, but the byte transfer is no longer in flight).
                this._removeNavGuard();
                // MapStore axios interceptor: the body is at err.data (NOT
                // err.response.data); err.message is absent (it's at
                // err.originalError.message). Surface the BE 400 in the ErrorStrip.
                const data = err && err.data;
                const detail = (data && (data.detail || data.message || data.error))
                    || (err && err.originalError && err.originalError.message)
                    || (err && err.message)
                    || 'Upload failed.';
                // Reflect the failure on the Tasks-Panel row regardless of which file
                // the panel now shows. On a crs_override VALIDATION_ERROR the BE
                // created NO Terrain row (TASK-1885), so the modeller can fix the CRS
                // and Confirm again — the panel stays OPEN.
                emit(rowId, { name, status: 'error', status_detail: null, error_message: String(detail) });
                trackEvent('process', 'error', 'anuga-terrain-direct-upload');
                // Only surface the error IN this panel if it still owns this file.
                if (!stillActive()) return;
                this.setState({ uploading: false });
                this.props.setTerrainUploadCrsError(String(detail));
            });
    };

    renderDetectionRow() {
        const { detecting, detected } = this.state;
        if (detecting) {
            return (
                <div className="sv-crs-picker-detecting" data-testid="terrain-crs-detecting" style={{ marginBottom: 8 }}>
                    <Message msgId="hydrata.anuga.terrainCrsDetecting" />
                </div>
            );
        }
        if (detected && detected.hasCrs === true) {
            // Detected → read-only display; proceed with NO override (D2).
            return (
                <div className="sv-crs-picker-detected" data-testid="terrain-crs-detected" style={{ marginBottom: 8 }}>
                    <Message
                        msgId="hydrata.anuga.terrainCrsDetected"
                        msgParams={{ crs: detected.label || `EPSG:${detected.epsg}` }}
                    />
                </div>
            );
        }
        return null;
    }

    renderPicker() {
        const { detected } = this.state;
        // No picker while detection is in flight or a CRS was detected.
        if (this.state.detecting || (detected && detected.hasCrs === true)) return null;

        const required = this._crsRequired();
        const shortcuts = this._buildShortcuts();
        const utmList = listUtmWgs84CRS();
        const proj4HasCode = (code) => /^EPSG:(4326|3857|326\d{2}|327\d{2})$/.test(code);
        const overrideForVerify = this.state.selectedCrs === FREEFORM ? (this.state.freeformCrs || '').trim() : '';

        return (
            <React.Fragment>
                <div className="sv-crs-picker-prompt" data-testid="terrain-crs-prompt" style={{ marginBottom: 6 }}>
                    <Message msgId={required ? 'hydrata.anuga.terrainCrsRequiredPrompt' : 'hydrata.anuga.terrainCrsOptionalPrompt'} />
                </div>
                <FormRow
                    label={<Message msgId="hydrata.anuga.terrainCrsSourceLabel" />}
                    layout="stacked"
                    extraClassName="sv-crs-picker-row"
                >
                    <select
                        data-testid="terrain-crs-select"
                        className="sv-scenario-select sv-crs-picker-select"
                        value={this.state.selectedCrs}
                        onChange={(e) => this.handleSelectChange(e.target.value)}
                    >
                        {/* UNSELECTED placeholder (D3 — nothing pre-selected). */}
                        <option value="">— select the CRS your DEM is authored in —</option>
                        {shortcuts.length ? (
                            <optgroup label="Suggested">
                                {shortcuts.map((s) => (
                                    <option key={s.code} value={s.code}>{s.label}</option>
                                ))}
                            </optgroup>
                        ) : null}
                        <optgroup label="Common">
                            <option value="EPSG:4326">EPSG:4326 (WGS 84 lat/lon)</option>
                        </optgroup>
                        <optgroup label="UTM WGS 84 zones">
                            {utmList.map((z) => (
                                <option key={z.code} value={z.code}>{`${z.code} — ${z.label}`}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Other">
                            <option value={FREEFORM}>Type an EPSG code…</option>
                        </optgroup>
                    </select>
                </FormRow>
                {this.state.selectedCrs === FREEFORM ? (
                    <FormRow
                        label={<Message msgId="hydrata.anuga.terrainCrsFreeformLabel" />}
                        layout="stacked"
                        extraClassName="sv-crs-picker-row"
                        hint={overrideForVerify && !proj4HasCode(`${overrideForVerify}`)
                            ? <Message msgId="hydrata.anuga.terrainCrsWillVerify" />
                            : null}
                    >
                        <input
                            data-testid="terrain-crs-freeform-input"
                            className="sv-data-title-input sv-crs-picker-freeform"
                            type="text"
                            placeholder="e.g. EPSG:2193"
                            value={this.state.freeformCrs}
                            onChange={(e) => this.setState({ freeformCrs: e.target.value })}
                        />
                    </FormRow>
                ) : null}
            </React.Fragment>
        );
    }

    // epic 2323 / TASK-2327: engage the user about the terrain's VERTICAL datum as
    // part of the upload path. An embedded vertical CRS is shown read-only; else
    // (the common case — most DEMs tag only a horizontal CRS) the user declares it.
    // Non-blocking: "Not sure" is the default; the server-side DoD inference decides
    // + cross-checks after upload.
    renderVerticalDatumRow() {
        const { detected } = this.state;
        if (this.state.detecting) return null;
        if (detected && detected.verticalDatumGuess) {
            return (
                <div
                    className="sv-crs-picker-vdatum-detected"
                    data-testid="terrain-vdatum-detected"
                    style={{ marginBottom: 8 }}
                >
                    <Message
                        msgId="hydrata.anuga.terrainVDatumDetected"
                        msgParams={{ datum: detected.verticalLabel || detected.verticalDatumGuess }}
                    />
                </div>
            );
        }
        const options = [
            { value: 'ellipsoid', msgId: 'hydrata.anuga.terrainVDatumEllipsoid' },
            { value: 'orthometric_egm2008', msgId: 'hydrata.anuga.terrainVDatumEgm2008' },
            { value: '', msgId: 'hydrata.anuga.terrainVDatumUnsure' }
        ];
        return (
            <FormRow
                label={<Message msgId="hydrata.anuga.terrainVDatumLabel" />}
                layout="stacked"
                extraClassName="sv-crs-picker-row"
            >
                <div className="sv-crs-picker-vdatum" data-testid="terrain-vdatum-picker" role="radiogroup">
                    {options.map((o) => (
                        <label
                            key={o.value || 'unsure'}
                            className="sv-crs-picker-vdatum-opt"
                            style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}
                        >
                            <input
                                type="radio"
                                name="terrain-vertical-datum"
                                data-testid={`terrain-vdatum-${o.value || 'unsure'}`}
                                checked={this.state.verticalDatumDeclared === o.value}
                                onChange={() => this.setState((s) => ({
                                    verticalDatumDeclared: o.value,
                                    // "Convert" only applies to an ellipsoid terrain — clear it otherwise.
                                    convertAfterUpload: o.value === 'ellipsoid' ? s.convertAfterUpload : false
                                }))}
                                style={{ marginRight: 6 }}
                            />
                            <Message msgId={o.msgId} />
                        </label>
                    ))}
                </div>
            </FormRow>
        );
    }

    // epic 2323 / TASK-2327: "Convert to EGM2008 after upload" — always visible so
    // the option is discoverable, but ENABLED only when the (resolved) datum is
    // ellipsoidal (converting an EGM2008 terrain would double-apply the geoid
    // shift). When ticked the BE auto-runs the conversion once the terrain imports.
    renderConvertCheckbox() {
        if (this.state.detecting) return null;
        const applicable = this._resolveVerticalDatum() === 'ellipsoid';
        return (
            <div
                className="sv-crs-picker-convert"
                data-testid="terrain-vdatum-convert-row"
                style={{ marginBottom: 8, opacity: applicable ? 1 : 0.5 }}
            >
                <label style={{ cursor: applicable ? 'pointer' : 'default' }}>
                    <input
                        type="checkbox"
                        data-testid="terrain-vdatum-convert-checkbox"
                        disabled={!applicable}
                        checked={applicable && this.state.convertAfterUpload}
                        onChange={(e) => this.setState({ convertAfterUpload: e.target.checked })}
                        style={{ marginRight: 6 }}
                    />
                    <Message msgId="hydrata.anuga.terrainVDatumConvertAfterUpload" />
                </label>
            </div>
        );
    }

    render() {
        if (!this.props.visible) return null;
        const persist = this.props.setMovablePanelState || (() => {});
        return (
            <MovablePanel
                panelId={TERRAIN_UPLOAD_CRS_PANEL_ID}
                className="sv-uploader-panel sv-crs-picker-panel sv-crs-picker-movable"
                title={<Message msgId="hydrata.anuga.terrainCrsPanelTitle" />}
                onClose={this.handleCancel}
                position={this.props.panelState?.position}
                size={this.props.panelState?.size}
                defaultPosition={defaultUploadCrsPosition()}
                onMove={(position) => persist(TERRAIN_UPLOAD_CRS_PANEL_ID, { position })}
                onResize={(size) => persist(TERRAIN_UPLOAD_CRS_PANEL_ID, { size })}
            >
                <div style={{ padding: '10px', textAlign: 'left' }} data-testid="terrain-crs-panel">
                    {/* Title input (auto-filled from the filename; editable). */}
                    <FormRow label={<Message msgId="hydrata.anuga.terrainCrsTitleLabel" />} layout="stacked" extraClassName="sv-crs-picker-row">
                        <input
                            data-testid="terrain-crs-title-input"
                            className="sv-data-title-input"
                            type="text"
                            value={this.state.title}
                            onChange={(e) => this.setState({ title: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </FormRow>

                    {this.renderDetectionRow()}
                    {this.renderPicker()}
                    {this.renderVerticalDatumRow()}
                    {this.renderConvertCheckbox()}

                    <ErrorStrip message={this.props.error} extraClassName="sv-crs-picker-error" />
                </div>
                <div className="simple-view-panel-footer">
                    <Button
                        data-testid="terrain-crs-cancel"
                        bsStyle="default"
                        aria-label={this.tr('hydrata.anuga.terrainCrsCancel', 'Cancel')}
                        onClick={this.handleCancel}
                    >
                        <Message msgId="hydrata.anuga.terrainCrsCancel" />
                    </Button>
                    <Button
                        data-testid="terrain-crs-confirm"
                        bsStyle="success"
                        style={{ marginLeft: 8 }}
                        aria-label={this.tr('hydrata.anuga.terrainCrsConfirm', 'Confirm')}
                        disabled={this._confirmDisabled()}
                        onClick={this.handleConfirm}
                    >
                        <Message msgId="hydrata.anuga.terrainCrsConfirm" />
                    </Button>
                </div>
            </MovablePanel>
        );
    }
}

// TASK-2039 (F4) — pull intl messages off React legacy context so tr() can
// resolve aria-label text at render time. Matches the pattern used by
// anugaScenarioMenu.js / hgevalSignupForm.js.
TerrainUploadCrsPanelClass.contextTypes = {
    messages: PropTypes.object
};

// Derive existing-terrain CRS strings + an AOI bbox for the shortcuts.
//   terrainCrs        — distinct `crs` values off the terrain resource rows.
//   projectExtentBbox — the first terrain LAYER's bbox ({bounds, crs}); that is a
//                       confirmed project-area extent (NEVER the un-tagged upload's
//                       own bbox, whose CRS is unknown — D, picker shortcut 2).
const mapStateToProps = (state) => {
    const terrainModels = state?.anuga?.resources?.terrain || [];
    const terrainCrs = Array.from(new Set(
        (Array.isArray(terrainModels) ? terrainModels : [])
            .map((t) => t && t.native_crs)
            .filter(Boolean)
    ));
    const terrainLayers = state?.layers?.flat?.filter((l) => l?.group === 'Input Data.Terrain') || [];
    const aoiLayer = terrainLayers.find((l) => l && l.bbox && l.bbox.bounds);
    return {
        visible: !!state?.anuga?.ui?.terrainUploadCrsPanelVisible,
        file: state?.anuga?.ui?.terrainUploadCrsFile || null,
        title: state?.anuga?.ui?.terrainUploadCrsTitle || '',
        error: state?.anuga?.ui?.terrainUploadCrsError || null,
        projectId: getProjectId(state),
        projectProjection: state?.anuga?.projects?.data?.projection || null,
        terrainCrs,
        projectExtentBbox: aoiLayer ? aoiLayer.bbox : null,
        panelState: state?.anuga?.ui?.movablePanels?.[TERRAIN_UPLOAD_CRS_PANEL_ID]
    };
};

const mapDispatchToProps = (dispatch) => ({
    setTerrainUploadCrsPanel: (visible, file, title) => dispatch(setTerrainUploadCrsPanel(visible, file, title)),
    setTerrainUploadCrsError: (error) => dispatch(setTerrainUploadCrsError(error)),
    onUpdateProcess: (process) => dispatch(updateProcess(process)),
    onOpenTaskMonitor: (open) => dispatch(toggleTaskMonitorPanel(open)),
    startAnugaModelCreationPolling: () => dispatch(startAnugaModelCreationPolling()),
    setMovablePanelState: (panelId, patch) => dispatch(setMovablePanelState(panelId, patch))
});

export const TerrainUploadCrsPanel = connect(mapStateToProps, mapDispatchToProps)(TerrainUploadCrsPanelClass);
