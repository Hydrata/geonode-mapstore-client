import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import FormField from './FormField';
import {
    cancelVectorDraw,
    submitForm,
    updateFormValues,
    drawingComplete,
    selectExistingFeature
} from '../actionsVectorDraw';

const GEOM_INSTRUCTIONS = {
    Point: 'Click on the map to place the point.',
    LineString: 'Click to add vertices, double-click to finish.',
    Polygon: 'Click to add vertices, double-click to close the polygon.'
};

// TASK-784 polish: include lowercase `description` for Inflow features
// (Inflow's BE attributes_template uses lowercase per scenario.py:381-385,
// while the other 4 Anuga prefixes use Title-case `Description`).
const featureLabel = (feature) =>
    feature?.properties?.title
    || feature?.properties?.Title
    || feature?.properties?.name
    || feature?.properties?.Description
    || feature?.properties?.description
    || feature?.id
    || 'Feature';

const VectorDrawPopup = ({
    phase,
    config,
    formValues,
    featureList,
    drawTempFeatures,
    drawFeatures,
    onCancel,
    onSubmit,
    onUpdateField,
    onSaveEdit,
    onSaveEditAndSubmit,
    onSelectFeature
}) => {
    if (!phase || phase === 'idle' || phase === 'describing' || phase === 'cancelling') {
        return null;
    }

    const isEditing = !!config?.featureId;
    const formConfig = config?.formConfig;
    const geomType = config?.geomType || 'Polygon';

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
            backgroundColor: 'rgba(255,255,255,0.1)'
        };
        const onRowEnter = (e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
        const onRowLeave = (e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; };

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
                        <strong>+ Add new</strong>
                    </div>
                    {(featureList || []).map(feature => (
                        <div
                            key={feature.id || featureLabel(feature)}
                            className="simple-view-panel-item-row"
                            style={rowStyle}
                            onClick={() => onSelectFeature(feature.id)}
                            onMouseEnter={onRowEnter}
                            onMouseLeave={onRowLeave}
                        >
                            {featureLabel(feature)}
                        </div>
                    ))}
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
                        onClick={onCancel}
                    />
                </div>
                <div style={{padding: '12px'}}>
                    <p style={{margin: '0 0 12px 0', fontSize: '13px'}}>
                        {hintText}
                    </p>
                    {showInlineForm
                        ? formConfig.fields.map(field => (
                            <FormField
                                key={field.name}
                                field={field}
                                value={formValues[field.name]}
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
                        <Button bsStyle="danger" bsSize="small" onClick={onCancel}>
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
                                    if (showInlineForm) {
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
                        onClick={onCancel}
                    />
                </div>
                <div style={{padding: '12px'}}>
                    {formConfig.fields.map(field => (
                        <FormField
                            key={field.name}
                            field={field}
                            value={formValues[field.name]}
                            onChange={onUpdateField}
                        />
                    ))}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        marginTop: '12px'
                    }}>
                        <Button bsStyle="danger" bsSize="small" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button bsStyle="success" bsSize="small" onClick={onSubmit}>
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
    featureList: state?.vectorDraw?.featureList || [],
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
    onSelectFeature: (fid) => dispatch(selectExistingFeature(fid))
});

export default connect(mapStateToProps, mapDispatchToProps)(VectorDrawPopup);
