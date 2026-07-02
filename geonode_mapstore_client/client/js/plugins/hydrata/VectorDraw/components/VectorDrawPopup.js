import React, { useState, useMemo } from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import FormField from './FormField';
// TASK-1669 — conform-migrate onto the shared SimpleView primitives.
// ErrorStrip replaces the bespoke red-<p> save-failure block; EmptyState
// replaces the hand-rolled italic "No features match" picker placeholder.
// Both are token-backed (--sv-*) and self-styled, so the popup's danger /
// empty chrome now flows from the design system instead of inline JSX.
// TASK-1763 — adopt the PanelHeader chassis primitive for the popup header +
// cascade-safe close chip (replaces the bespoke .simple-view-panel-header +
// .sv-legend-close span in every phase). PanelHeader is token-backed/self-styled,
// so its <h4>+chrome are exempt from the TASK-784 font-uniformity walk (the
// test's primitive-subtree exemption now includes .sv-panel-header).
import { ErrorStrip, EmptyState, PanelHeader } from '../../SimpleView/components/primitives';
// TASK-2083 (epic 2077) — renders the optional formConfig-driven
// `addAnotherHint` msgId next to the picker's "+ Add new" row. VectorDrawPopup
// is a SHARED component (boundary/inflow/friction/etc. all route through it),
// so it must stay formConfig-agnostic: no hardcoded inflow copy lives here,
// only a conditional render of whatever hint (if any) the caller's
// formConfig supplies.
import Message from '@mapstore/framework/components/I18N/Message';
import {
    cancelVectorDraw,
    submitForm,
    updateFormValues,
    drawingComplete,
    selectExistingFeature,
    deleteFeature
} from '../actionsVectorDraw';
import { show } from '../../../../../MapStore2/web/client/actions/notifications';
// TASK-2016 (epic-1970 W7) — registry-KIND vocabulary single source of truth.
import { DISCRIMINATOR_KIND } from '../discriminatorRegistry';
// TASK-795 review I9 (TASK-802) — synthesizeTimeBoundaryFormValue is now
// invoked once at EDIT-load time (vectorDrawStartEpic) and the structured
// `data` shape is persisted in Redux from that moment. The popup just
// reads formValues directly, no render-time transform needed.
// TASK-784 polish — uniform fonts inside the popup. The stylesheet is
// imported here so the popup brings its own rules even if the SimpleView
// panel (which usually owns simpleView.css and the .simple-view-panel
// baseline) hasn't been mounted yet on this page-load ordering.
import './vectorDrawPopup.css';

/**
 * TASK-795 / TASK-816 — Pure helper. Returns true if `field.showWhen`
 * matches the current formValues. Used by FormField rendering to
 * conditionally hide fields based on another field's value.
 *
 * Supported operators (mutually exclusive on a single showWhen object;
 * evaluated in the order listed):
 *   {field: 'X', equals: <value>}      current value === <value>
 *   {field: 'X', notEquals: <value>}   current value !== <value>
 *   {field: 'X', in: [<v1>, <v2>...]}  current value is in the array
 *
 * When `showWhen` is null/undefined the field is always rendered (no-op).
 * Unknown operator KEYS return true (defensive default) so a typo in a
 * formConfig never silently hides a field. A recognised operator with a
 * malformed value (e.g. `in: 'Active'` instead of `in: ['Active']`)
 * returns false — the predicate is well-formed but cannot match anything.
 *
 * Exported so the SimpleView routing tests can pin the contract.
 */
export const matchesShowWhen = (showWhen, formValues) => {
    if (!showWhen) return true;
    const current = formValues ? formValues[showWhen.field] : undefined;
    if ('equals' in showWhen) {
        return current === showWhen.equals;
    }
    if ('notEquals' in showWhen) {
        return current !== showWhen.notEquals;
    }
    if ('in' in showWhen) {
        return Array.isArray(showWhen.in) && showWhen.in.includes(current);
    }
    // Defensive default — unknown showWhen operator: render the field
    // rather than silently hide. New predicates can be added above without
    // changing call sites.
    return true;
};

// TASK-795 review C6 — Pre-save guard for the Time-boundary XOR rule.
// Returns null when the form is valid OR not subject to the rule, otherwise
// a user-facing error string. The BE CHECK constraint would otherwise
// reject with a confusing "violates check constraint bdy_data_xor" toast.
//
// Repro path: open a Reflective row, toggle to Time, click Save without
// touching the picker. Without this guard, BE rejects after a network
// round-trip; with this guard, the user sees a clear inline message
// telling them what to do.
//
// Exported so unit tests can pin the contract independently of the popup.
export const validateTimeBoundaryFormValues = (formValues) => {
    if (!formValues || formValues.boundary !== 'Time') return null;
    const data = formValues.data;
    const hasStructuredConstant = data && typeof data === 'object'
        && data.kind === 'constant'
        && data.constant !== null && data.constant !== undefined && data.constant !== '';
    const hasStructuredTs = data && typeof data === 'object'
        && data.kind === DISCRIMINATOR_KIND.TIMESERIES
        && data.timeseries_id !== null && data.timeseries_id !== undefined && data.timeseries_id !== '';
    // Also accept the per-column shape that the EDIT-mode seeded values
    // arrive in BEFORE the picker has rendered + synthesized them. Without
    // this, a user opening a Time row and immediately clicking Save (no
    // edits) would falsely trip the validation.
    const hasColumnConstant = formValues.data_constant !== null
        && formValues.data_constant !== undefined && formValues.data_constant !== '';
    const hasColumnTs = formValues.data_timeseries_id !== null
        && formValues.data_timeseries_id !== undefined && formValues.data_timeseries_id !== '';
    if (hasStructuredConstant || hasStructuredTs || hasColumnConstant || hasColumnTs) {
        return null;
    }
    return 'Time boundaries require a data value. Please pick a constant or a TimeSeries before saving.';
};

const GEOM_INSTRUCTIONS = {
    Point: 'Click on the map to place the point.',
    LineString: 'Click to add vertices, double-click to finish.',
    Polygon: 'Click to add vertices, double-click to close the polygon.'
};

// TASK-794 fix: GeoServer's WFS DescribeFeatureType for all 5 migrated
// Anuga prefixes returns LOWERCASE property names (PostGIS lower-cases
// unquoted identifiers). The picker therefore prefers `description`, but
// retains the Title-case `Description` fallback so legacy rows inserted
// before TASK-794 (where the Title-case attribute happened to land in
// PostGIS via case-insensitive WFS quirks on some GeoServer versions)
// still display a readable label instead of "Feature" / feature.id.
const featureLabel = (feature) =>
    feature?.properties?.title
    || feature?.properties?.Title
    || feature?.properties?.name
    || feature?.properties?.description
    || feature?.properties?.Description
    || feature?.id
    || 'Feature';

// TASK-795 review I8 — Compute whether the current edit session has
// unsaved changes the user would lose by clicking Cancel. Uses a stable
// JSON-shape comparison against the snapshot the reducer captured when
// the flow started (CREATE: just defaults; EDIT: defaults + seeded BE
// row values). Also flags geometry as dirty if the user actually drew /
// dragged something — pre-fix, a Cancel after a 30-vertex polygon would
// silently throw away the geometry.
//
// Exported for unit tests so we can pin the contract independently of
// window.confirm / DOM.
export const formValuesAreDirty = (current, initial) => {
    try {
        return JSON.stringify(current || {}) !== JSON.stringify(initial || {});
    } catch (e) {
        // Defensive — circular ref shouldn't happen in plain form values
        // but if it does, prefer the safer "ask the user" branch over
        // "silently discard".
        return true;
    }
};

// TASK-795 review I10 (TASK-803) — Threshold above which the picker shows
// a text filter input. Below this, a filter would be visual noise (and
// scrolling the maxHeight=240 list is fine for small projects). Picked at
// 8 because that's roughly when 1-row scrolling starts feeling worth a
// shortcut to jump to a known label without eyeballing.
export const PICKER_FILTER_THRESHOLD = 8;

// TASK-795 review I10 (TASK-803) — Picker subcomponent. Owns its own filter
// state (kept local because filter survives only within the same picker
// session — re-entering the picker via RETURN_TO_PICKER remounts and clears
// the filter, which matches user expectation: "I'm starting a new pick").
export const PickerView = ({
    formConfig,
    featureList,
    deletingFeatureId,
    lastSavedFid,
    onCancel,
    onSelectFeature,
    onDeleteFeature
}) => {
    const [filterText, setFilterText] = useState('');
    // TASK-1409 — replace window.confirm with an inline React confirm overlay.
    // pendingDeleteFeature holds the feature waiting for confirmation; null
    // means the overlay is closed. Gating is preserved: onDeleteFeature only
    // fires on the Confirm button click, never on cancel or overlay open.
    const [pendingDeleteFeature, setPendingDeleteFeature] = useState(null);
    const list = featureList || [];
    const showFilter = list.length >= PICKER_FILTER_THRESHOLD;
    const filterLower = filterText.trim().toLowerCase();
    const filteredList = useMemo(() => {
        if (!filterLower) return list;
        return list.filter(f => featureLabel(f).toLowerCase().indexOf(filterLower) !== -1);
    }, [list, filterLower]);

    const headerTitle = formConfig?.title
        ? `Choose ${formConfig.title}`
        : 'Choose Feature';
    const rowStyle = {
        cursor: 'pointer',
        padding: '8px',
        marginBottom: 4,
        borderRadius: 'var(--sv-card-radius)',
        backgroundColor: 'var(--sv-row-hover-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sv-form-row-gap)'
    };
    // TASK-1758 W3 — resting row surface is the tokenised --sv-row-hover-bg
    // (rgba 255,255,255,0.1). The deepen-on-hover (0.2) is now tokenised as
    // --sv-row-hover-bg-strong (second token round); resting is restored via the
    // --sv-row-hover-bg CSS var on leave.
    const onRowEnter = (e) => { e.currentTarget.style.backgroundColor = 'var(--sv-row-hover-bg-strong, rgba(255,255,255,0.2))'; };
    const onRowLeave = (e) => { e.currentTarget.style.backgroundColor = 'var(--sv-row-hover-bg)'; };
    // TASK-1409 — Trash icon click opens the inline React confirm overlay
    // instead of window.confirm. stopPropagation prevents the row's onClick
    // (select-feature) from firing alongside the delete path.
    const onTrashClick = (feature) => (e) => {
        e.stopPropagation();
        setPendingDeleteFeature(feature);
    };
    const onConfirmDelete = () => {
        if (pendingDeleteFeature) {
            onDeleteFeature(pendingDeleteFeature.id);
        }
        setPendingDeleteFeature(null);
    };
    const onCancelDelete = () => {
        setPendingDeleteFeature(null);
    };
    const trashStyle = {
        cursor: 'pointer',
        padding: '4px 6px',
        borderRadius: 'var(--sv-card-radius)',
        opacity: 0.7,
        flexShrink: 0
    };

    return (
        <div className="sv-vector-draw-popup simple-view-panel" style={{
            position: 'absolute',
            top: 80,
            left: 30,
            zIndex: 1026,
            minWidth: 280,
            maxWidth: 380,
            padding: 0
        }}>
            <PanelHeader title={headerTitle} onClose={onCancel} />
            {/* TASK-1409 — inline delete-confirm overlay replaces window.confirm.
                Rendered over the picker list when pendingDeleteFeature is set;
                the guarded onDeleteFeature fires ONLY on the Confirm button. */}
            {pendingDeleteFeature ? (
                <div className="sv-vector-draw-delete-confirm" style={{padding: '12px'}}>
                    <p style={{margin: '0 0 10px 0'}}>
                        {`Delete "${featureLabel(pendingDeleteFeature)}"? This cannot be undone.`}
                    </p>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                        <Button bsSize="small" onClick={onCancelDelete}>
                            Cancel
                        </Button>
                        <Button bsStyle="danger" bsSize="small" className="sv-vector-draw-delete-confirm-btn" onClick={onConfirmDelete}>
                            Delete
                        </Button>
                    </div>
                </div>
            ) : (
                <React.Fragment>
                    {showFilter ? (
                        <div style={{padding: '8px 12px 0 12px'}}>
                            <input
                                type="text"
                                className="sv-vector-draw-picker-filter"
                                placeholder={`Filter ${list.length} features…`}
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                style={{width: '100%', padding: '4px 6px', fontSize: 'inherit'}}
                            />
                        </div>
                    ) : null}
                    <div style={{ padding: '8px 12px', maxHeight: 240, overflowY: 'auto' }}>
                        <div
                            className="simple-view-panel-item-row sv-vector-draw-picker-add-new"
                            style={rowStyle}
                            onClick={() => onSelectFeature(null)}
                            onMouseEnter={onRowEnter}
                            onMouseLeave={onRowLeave}
                        >
                            <span>+ Add new</span>
                        </div>
                        {/* TASK-2083 (epic 2077) — formConfig-driven hint (AC2: no
                            hardcoded inflow string in this SHARED component). Only
                            renders when the caller's formConfig declares
                            `addAnotherHint` (currently only the inf_ formConfig in
                            simpleViewMenuRow.js); a boundary/friction/etc. picker
                            has no such key and this renders nothing. */}
                        {formConfig?.addAnotherHint ? (
                            <div className="sv-vector-draw-picker-add-new-hint">
                                <Message msgId={formConfig.addAnotherHint} />
                            </div>
                        ) : null}
                        {filteredList.length === 0 && filterText ? (
                            // TASK-1669 — shared EmptyState primitive replaces the
                            // bespoke italic placeholder. The legacy
                            // `.sv-vector-draw-picker-empty` hook is preserved via
                            // extraClassName so existing tests + any scoped CSS
                            // still match; the "No features match" copy is unchanged.
                            <EmptyState
                                extraClassName="sv-vector-draw-picker-empty"
                                heading={`No features match “${filterText}”`}
                            />
                        ) : null}
                        {filteredList.map(feature => {
                            // TASK-795 review I3 — dim + disable the trash icon
                            // for the row currently being WFS-T-deleted so the
                            // user can't double-click and trigger a second
                            // DELETE that would 404 (a confusing error toast on
                            // what was actually a successful first delete).
                            const isDeleting = !!deletingFeatureId
                                && feature.id === deletingFeatureId;
                            // TASK-795 review NIT-6 (TASK-804) — highlight the
                            // row the user just committed (set by the save epic
                            // via RETURN_TO_PICKER's lastSavedFid). Cleared on
                            // next selection / RESET.
                            const isLastSaved = !!lastSavedFid
                                && feature.id === lastSavedFid;
                            const highlightedRowStyle = isLastSaved
                                ? { ...rowStyle, backgroundColor: 'var(--sv-row-bg-success, rgba(80, 200, 120, 0.25))' }
                                : rowStyle;
                            return (
                                <div
                                    key={feature.id || featureLabel(feature)}
                                    className={'simple-view-panel-item-row' + (isLastSaved ? ' sv-vector-draw-picker-row-just-saved' : '')}
                                    style={highlightedRowStyle}
                                    onClick={() => onSelectFeature(feature.id)}
                                    onMouseEnter={onRowEnter}
                                    onMouseLeave={onRowLeave}
                                >
                                    <span style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1
                                    }}>{featureLabel(feature)}</span>
                                    <span
                                        className="glyphicon glyphicon-trash sv-vector-draw-trash"
                                        style={{
                                            ...trashStyle,
                                            opacity: isDeleting ? 0.3 : 0.7,
                                            pointerEvents: isDeleting ? 'none' : 'auto',
                                            cursor: isDeleting ? 'wait' : 'pointer'
                                        }}
                                        title={isDeleting ? 'Deleting...' : 'Delete this feature'}
                                        onClick={isDeleting ? undefined : onTrashClick(feature)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

const VectorDrawPopup = ({
    phase,
    config,
    formValues,
    initialFormValues,
    featureList,
    deletingFeatureId,
    lastSavedFid,
    drawTempFeatures,
    drawFeatures,
    onCancel,
    onSubmit,
    onUpdateField,
    onSaveEdit,
    onSaveEditAndSubmit,
    onSelectFeature,
    onDeleteFeature,
    onShowNotification
}) => {
    // TASK-1409 — discard-changes confirm overlay state. True when the user
    // clicked Cancel on a dirty form/draw and the overlay is visible. The
    // actual onCancel dispatch fires ONLY on the "Discard" button click so
    // the async→sync gating semantics are preserved.
    const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

    if (!phase || phase === 'idle' || phase === 'describing' || phase === 'cancelling') {
        return null;
    }

    const isEditing = !!config?.featureId;
    const formConfig = config?.formConfig;
    const geomType = config?.geomType || 'Polygon';

    // TASK-795 review I8 / TASK-1409 — Wrap onCancel in a discard-changes
    // confirm overlay. Two signals are dirty: form-value diff against the
    // captured snapshot, OR geometry was drawn (CREATE mode) / vertices moved
    // (EDIT mode). Previously used window.confirm (sync); now uses a React
    // overlay (async). The guarded onCancel fires ONLY on "Discard" click.
    const drawDirty = (drawTempFeatures && drawTempFeatures.length > 0)
        || (!isEditing && drawFeatures && drawFeatures.length > 0
            && drawFeatures.some(f => f && f.geometry));
    const formDirty = formValuesAreDirty(formValues, initialFormValues);
    const handleCancel = () => {
        if (formDirty || drawDirty) {
            setDiscardConfirmVisible(true);
            return;
        }
        onCancel();
    };
    const handleDiscardConfirm = () => {
        setDiscardConfirmVisible(false);
        onCancel();
    };
    const handleDiscardCancel = () => {
        setDiscardConfirmVisible(false);
    };

    // TASK-795 review I9 (TASK-802) — formValues is the source of truth.
    // The structured `data` shape for TimeDataPicker is synthesized once at
    // EDIT-load time inside vectorDrawStartEpic (so it's persisted in Redux
    // from the start) and the picker writes structured shape on every
    // interaction. No render-time transform needed.
    const effectiveFormValues = formValues;

    // TASK-1409 — shared discard-changes confirm overlay. Rendered inside the
    // drawing/form phase popup containers when discardConfirmVisible=true.
    // Replaces the blocked `window.confirm` call with a React overlay that
    // preserves the same gating: onCancel fires only on "Discard" click.
    const discardConfirmOverlay = discardConfirmVisible ? (
        <div className="sv-vector-draw-discard-confirm" style={{padding: '12px'}}>
            <p style={{margin: '0 0 10px 0'}}>Discard unsaved changes?</p>
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                <Button bsSize="small" className="sv-vector-draw-discard-cancel-btn" onClick={handleDiscardCancel}>
                    Keep editing
                </Button>
                <Button bsStyle="danger" bsSize="small" className="sv-vector-draw-discard-confirm-btn" onClick={handleDiscardConfirm}>
                    Discard
                </Button>
            </div>
        </div>
    ) : null;

    // Picking phase — let user choose an existing feature or "+ Add new"
    if (phase === 'picking') {
        return (
            <PickerView
                formConfig={formConfig}
                featureList={featureList}
                deletingFeatureId={deletingFeatureId}
                lastSavedFid={lastSavedFid}
                onCancel={onCancel}
                onSelectFeature={onSelectFeature}
                onDeleteFeature={onDeleteFeature}
            />
        );
    }

    // Drawing phase. In EDIT mode with formConfig (TASK-784 polish), render
    // the attribute form fields inline below the vertex-drag hint and have
    // a single Save commit both the geometry and form values — instead of
    // the previous two-step "Save geometry → form panel → Save attributes".
    // Create mode keeps the two-step (geometry must be drawn first before
    // the form can render).
    if (phase === 'drawing') {
        const showInlineForm = isEditing && formConfig;
        const headerLabel = showInlineForm
            ? (formConfig.title || 'Editing Feature')
            : (isEditing ? 'Editing Feature' : 'Drawing');
        const hintText = isEditing
            ? 'Drag vertices to modify the shape.'
            : (GEOM_INSTRUCTIONS[geomType] || GEOM_INSTRUCTIONS.Polygon);
        return (
            <div className="sv-vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: showInlineForm ? 380 : 350,
                padding: 0
            }}>
                <PanelHeader title={headerLabel} onClose={handleCancel} />
                {/* TASK-1409 — discard-confirm overlay replaces window.confirm */}
                {discardConfirmOverlay || (
                    <div style={{padding: '12px'}}>
                        <p style={{margin: '0 0 12px 0'}}>
                            {hintText}
                        </p>
                        {showInlineForm
                            ? formConfig.fields
                                .filter(field => matchesShowWhen(field.showWhen, effectiveFormValues))
                                .map(field => (
                                    <FormField
                                        key={field.name}
                                        field={field}
                                        value={effectiveFormValues[field.name]}
                                        onChange={onUpdateField}
                                    />
                                ))
                            : null}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                            marginTop: showInlineForm ? '12px' : '0'
                        }}>
                            <Button bsStyle="danger" bsSize="small" onClick={handleCancel}>
                                Cancel
                            </Button>
                            {isEditing ? (
                                <Button
                                    bsStyle="success"
                                    bsSize="small"
                                    onClick={() => {
                                        // Read geometry from draw state — tempFeatures
                                        // has edits, fall back to features (original)
                                        // if user didn't move vertices.
                                        const geom = drawTempFeatures?.[0]?.geometry
                                            || drawFeatures?.[0]?.geometry;
                                        if (!geom) return;
                                        // TASK-795 review C6 — block Time/no-data
                                        // saves before they hit the BE CHECK.
                                        // TASK-1409 — replaced window.alert with
                                        // onShowNotification toast (no gating — just
                                        // informs the user; save is blocked by early
                                        // return below, not by the dialog result).
                                        if (showInlineForm) {
                                            const err = validateTimeBoundaryFormValues(effectiveFormValues);
                                            if (err) {
                                                onShowNotification(err);
                                                return;
                                            }
                                            // One-click commit of geometry + form
                                            // values (TASK-784 polish).
                                            onSaveEditAndSubmit(geom);
                                        } else {
                                            // Edit without formConfig — geometry
                                            // only; reducer goes straight to
                                            // 'saving' since there's no form.
                                            onSaveEdit(geom);
                                        }
                                    }}
                                >
                                    Save
                                </Button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Form phase — only reached in CREATE mode (after END_DRAWING) since
    // EDIT mode now renders the form inline in the drawing phase.
    if (phase === 'form' && formConfig) {
        return (
            <div className="sv-vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: 380,
                padding: 0
            }}>
                <PanelHeader title={formConfig.title || 'Feature Attributes'} onClose={handleCancel} />
                {/* TASK-1409 — discard-confirm overlay replaces window.confirm */}
                {discardConfirmOverlay || (
                    <div style={{padding: '12px'}}>
                        {formConfig.fields
                            .filter(field => matchesShowWhen(field.showWhen, effectiveFormValues))
                            .map(field => (
                                <FormField
                                    key={field.name}
                                    field={field}
                                    value={effectiveFormValues[field.name]}
                                    onChange={onUpdateField}
                                />
                            ))}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                            marginTop: '12px'
                        }}>
                            <Button bsStyle="danger" bsSize="small" onClick={handleCancel}>
                                Cancel
                            </Button>
                            <Button bsStyle="success" bsSize="small" onClick={() => {
                                // TASK-795 review C6 — block Time/no-data saves
                                // before they hit the BE CHECK constraint.
                                // TASK-1409 — replaced window.alert with
                                // onShowNotification toast.
                                const err = validateTimeBoundaryFormValues(effectiveFormValues);
                                if (err) {
                                    onShowNotification(err);
                                    return;
                                }
                                onSubmit();
                            }}>
                                Save
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Saving phase — show spinner
    if (phase === 'saving') {
        return (
            <div className="sv-vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 200,
                padding: '12px',
                textAlign: 'center'
            }}>
                <span>Saving...</span>
            </div>
        );
    }

    // Error phase
    if (phase === 'error') {
        return (
            <div className="sv-vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 200,
                padding: '12px'
            }}>
                {/* TASK-1669 — shared ErrorStrip primitive replaces the bespoke
                    red-<p>. It self-styles from the --sv-text-danger token and
                    carries role="alert"; margin is zeroed so it sits flush in
                    the already-padded popup body. */}
                <ErrorStrip message="Save failed. Please try again." style={{margin: 0}} />
                <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
                    <Button bsSize="small" onClick={onCancel}>
                        Close
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};

const mapStateToProps = (state) => ({
    phase: state?.vectorDraw?.phase,
    config: state?.vectorDraw?.config,
    formValues: state?.vectorDraw?.formValues || {},
    initialFormValues: state?.vectorDraw?.initialFormValues || {},
    featureList: state?.vectorDraw?.featureList || [],
    deletingFeatureId: state?.vectorDraw?.deletingFeatureId || null,
    lastSavedFid: state?.vectorDraw?.lastSavedFid || null,
    drawTempFeatures: state?.draw?.tempFeatures,
    drawFeatures: state?.draw?.features
});

const mapDispatchToProps = (dispatch) => ({
    onCancel: () => dispatch(cancelVectorDraw()),
    onSubmit: () => dispatch(submitForm()),
    onUpdateField: (fieldName, value) => dispatch(updateFormValues(fieldName, value)),
    onSaveEdit: (geometry) => dispatch(drawingComplete(geometry)),
    // TASK-784 polish — combined edit-mode Save: dispatch geometry-complete
    // first (reducer transitions drawing→form because formConfig present),
    // then submitForm immediately (reducer transitions form→saving). Save
    // epic listens on SUBMIT_FORM filtered by phase==='saving' and fires.
    onSaveEditAndSubmit: (geometry) => {
        dispatch(drawingComplete(geometry));
        dispatch(submitForm());
    },
    onSelectFeature: (fid) => dispatch(selectExistingFeature(fid)),
    onDeleteFeature: (fid) => dispatch(deleteFeature(fid)),
    // TASK-1409 — dispatch a warning notification toast instead of window.alert.
    onShowNotification: (message) => dispatch(show({
        message,
        title: 'Validation error',
        uid: 'sv-vector-draw-validation-error',
        position: 'tc',
        autoDismiss: 8
    }, 'warning'))
});

// TASK-794 — featureLabel is exported as a named export so the picker
// fallback chain can be unit-tested independently of the connected
// component. Default export remains the connected component.
export { featureLabel };
export default connect(mapStateToProps, mapDispatchToProps)(VectorDrawPopup);
