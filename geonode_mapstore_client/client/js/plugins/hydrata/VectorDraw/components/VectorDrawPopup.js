import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import FormField from './FormField';
import {
    cancelVectorDraw,
    submitForm,
    updateFormValues,
    drawingComplete,
    selectExistingFeature,
    deleteFeature
} from '../actionsVectorDraw';
import { synthesizeTimeBoundaryFormValue } from '../wfstApi';
// TASK-784 polish — uniform fonts inside the popup. The stylesheet is
// imported here so the popup brings its own rules even if the SimpleView
// panel (which usually owns simpleView.css and the .simple-view-panel
// baseline) hasn't been mounted yet on this page-load ordering.
import './vectorDrawPopup.css';

// TASK-795 — Pure helper. Returns true if `field.showWhen` matches the
// current formValues. Currently supports a single equality clause:
//   showWhen: {field: 'boundary', equals: 'Time'}
// When `field.showWhen` is undefined, the field is always rendered (no-op).
// Exported so the SimpleView routing tests can pin the contract.
export const matchesShowWhen = (showWhen, formValues) => {
    if (!showWhen) return true;
    const current = formValues ? formValues[showWhen.field] : undefined;
    if ('equals' in showWhen) {
        return current === showWhen.equals;
    }
    // Defensive default — unknown showWhen shape: render the field rather
    // than silently hide. Future predicates (notEquals, in, ...) can be
    // added without changing call sites.
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
        && data.kind === 'timeseries'
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

const VectorDrawPopup = ({
    phase,
    config,
    formValues,
    initialFormValues,
    featureList,
    deletingFeatureId,
    drawTempFeatures,
    drawFeatures,
    onCancel,
    onSubmit,
    onUpdateField,
    onSaveEdit,
    onSaveEditAndSubmit,
    onSelectFeature,
    onDeleteFeature
}) => {
    if (!phase || phase === 'idle' || phase === 'describing' || phase === 'cancelling') {
        return null;
    }

    const isEditing = !!config?.featureId;
    const formConfig = config?.formConfig;
    const geomType = config?.geomType || 'Polygon';

    // TASK-795 review I8 — Wrap onCancel in a discard-changes confirm. Two
    // signals are dirty: form-value diff against the captured snapshot, OR
    // geometry was drawn (CREATE mode) / vertices moved (EDIT mode).
    const drawDirty = (drawTempFeatures && drawTempFeatures.length > 0)
        || (!isEditing && drawFeatures && drawFeatures.length > 0
            && drawFeatures.some(f => f && f.geometry));
    const formDirty = formValuesAreDirty(formValues, initialFormValues);
    const handleCancel = () => {
        if (formDirty || drawDirty) {
            // eslint-disable-next-line no-alert
            if (!window.confirm('Discard unsaved changes?')) return;
        }
        onCancel();
    };

    // TASK-795 — Synthesize the structured `data` shape for the
    // TimeDataPicker if any field uses time-data-picker. This is a pure
    // render-time transform; the picker writes the structured shape on
    // every interaction so once the user has touched it,
    // synthesizeTimeBoundaryFormValue is a no-op (it preserves the existing
    // structured data). Only fires the synthesis branch on the FIRST render
    // after a SEED_FORM_VALUES dispatched by the EDIT-mode load epic.
    const hasTimeDataPicker = (formConfig?.fields || []).some(
        f => f.type === 'time-data-picker'
    );
    const effectiveFormValues = hasTimeDataPicker
        ? synthesizeTimeBoundaryFormValue(formValues)
        : formValues;

    // Picking phase — let user choose an existing feature or "+ Add new"
    if (phase === 'picking') {
        const headerTitle = formConfig?.title
            ? `Choose ${formConfig.title}`
            : 'Choose Feature';
        const rowStyle = {
            cursor: 'pointer',
            padding: '8px',
            marginBottom: 4,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
        };
        const onRowEnter = (e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        const onRowLeave = (e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
        // Trash icon click — stop propagation so the row's onClick (which
        // would select the feature for editing) doesn't also fire. Confirm
        // before destructive action; WFS-T delete is irreversible.
        const onTrashClick = (feature) => (e) => {
            e.stopPropagation();
            const label = featureLabel(feature);
            // eslint-disable-next-line no-alert
            if (window.confirm(`Delete "${label}"? This cannot be undone.`)) {
                onDeleteFeature(feature.id);
            }
        };
        const trashStyle = {
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 3,
            opacity: 0.7,
            flexShrink: 0
        };

        return (
            <div className="vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: 380,
                padding: 0
            }}>
                <div className="simple-view-panel-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px'
                }}>
                    <span>{headerTitle}</span>
                    <span
                        className="btn glyphicon glyphicon-remove legend-close"
                        onClick={onCancel}
                    />
                </div>
                <div style={{ padding: '8px 12px', maxHeight: 240, overflowY: 'auto' }}>
                    <div
                        className="simple-view-panel-item-row"
                        style={rowStyle}
                        onClick={() => onSelectFeature(null)}
                        onMouseEnter={onRowEnter}
                        onMouseLeave={onRowLeave}
                    >
                        <span>+ Add new</span>
                    </div>
                    {(featureList || []).map(feature => {
                        // TASK-795 review I3 — dim + disable the trash icon
                        // for the row currently being WFS-T-deleted so the
                        // user can't double-click and trigger a second
                        // DELETE that would 404 (a confusing error toast on
                        // what was actually a successful first delete).
                        const isDeleting = !!deletingFeatureId
                            && feature.id === deletingFeatureId;
                        return (
                            <div
                                key={feature.id || featureLabel(feature)}
                                className="simple-view-panel-item-row"
                                style={rowStyle}
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
                                    className="glyphicon glyphicon-trash vector-draw-trash"
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
            </div>
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
            <div className="vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: showInlineForm ? 380 : 350,
                padding: 0
            }}>
                <div className="simple-view-panel-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px'
                }}>
                    <span>{headerLabel}</span>
                    <span
                        className="btn glyphicon glyphicon-remove legend-close"
                        onClick={handleCancel}
                    />
                </div>
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
                                    if (showInlineForm) {
                                        const err = validateTimeBoundaryFormValues(effectiveFormValues);
                                        if (err) {
                                            // eslint-disable-next-line no-alert
                                            window.alert(err);
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
            </div>
        );
    }

    // Form phase — only reached in CREATE mode (after END_DRAWING) since
    // EDIT mode now renders the form inline in the drawing phase.
    if (phase === 'form' && formConfig) {
        return (
            <div className="vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: 380,
                padding: 0
            }}>
                <div className="simple-view-panel-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px'
                }}>
                    <span>{formConfig.title || 'Feature Attributes'}</span>
                    <span
                        className="btn glyphicon glyphicon-remove legend-close"
                        onClick={handleCancel}
                    />
                </div>
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
                            const err = validateTimeBoundaryFormValues(effectiveFormValues);
                            if (err) {
                                // eslint-disable-next-line no-alert
                                window.alert(err);
                                return;
                            }
                            onSubmit();
                        }}>
                            Save
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Saving phase — show spinner
    if (phase === 'saving') {
        return (
            <div className="vector-draw-popup simple-view-panel" style={{
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
            <div className="vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 200,
                padding: '12px'
            }}>
                <p style={{color: 'red', margin: 0}}>Save failed. Please try again.</p>
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
    onDeleteFeature: (fid) => dispatch(deleteFeature(fid))
});

// TASK-794 — featureLabel is exported as a named export so the picker
// fallback chain can be unit-tested independently of the connected
// component. Default export remains the connected component.
export { featureLabel };
export default connect(mapStateToProps, mapDispatchToProps)(VectorDrawPopup);
