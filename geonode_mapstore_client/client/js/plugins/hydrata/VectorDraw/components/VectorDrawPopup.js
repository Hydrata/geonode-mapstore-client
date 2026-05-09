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

const featureLabel = (feature) =>
    feature?.properties?.title
    || feature?.properties?.name
    || feature?.properties?.Description
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

    // Drawing phase — show instructions + cancel (create) or save/cancel (edit)
    if (phase === 'drawing') {
        return (
            <div className="vector-draw-popup simple-view-panel" style={{
                position: 'absolute',
                top: 80,
                left: 30,
                zIndex: 1026,
                minWidth: 280,
                maxWidth: 350,
                padding: 0
            }}>
                <div className="simple-view-panel-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px'
                }}>
                    <span>{isEditing ? 'Editing Feature' : 'Drawing'}</span>
                    <span
                        className="btn glyphicon glyphicon-remove legend-close"
                        onClick={onCancel}
                    />
                </div>
                <div style={{padding: '12px'}}>
                    <p style={{margin: '0 0 12px 0', fontSize: '13px'}}>
                        {isEditing
                            ? 'Drag vertices to modify the shape.'
                            : GEOM_INSTRUCTIONS[geomType] || GEOM_INSTRUCTIONS.Polygon
                        }
                    </p>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                        <Button bsStyle="danger" bsSize="small" onClick={onCancel}>
                            Cancel
                        </Button>
                        {isEditing ? (
                            <Button
                                bsStyle="success"
                                bsSize="small"
                                onClick={() => {
                                    // Read geometry from draw state — tempFeatures has edits,
                                    // fall back to features (original) if user didn't move vertices
                                    const geom = drawTempFeatures?.[0]?.geometry
                                        || drawFeatures?.[0]?.geometry;
                                    if (geom) {
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

    // Form phase — show attribute form
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
    onSelectFeature: (fid) => dispatch(selectExistingFeature(fid))
});

export default connect(mapStateToProps, mapDispatchToProps)(VectorDrawPopup);
