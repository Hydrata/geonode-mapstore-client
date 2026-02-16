import React from 'react';
import HGevalLocationSelector from './hgevalLocationSelector';
import HGevalProjectForm from './hgevalProjectForm';
import HGevalReportDisplay from './hgevalReportDisplay';
import HGevalProgressIndicator from './hgevalProgressIndicator';

const HGevalContainer = ({
    step, coordinates, form, reportData, rasterValues, warnings,
    queryProgress, loading, error, validationError, savedReport, isLoggedIn,
    rasterApiUrl, reportApiUrl,
    onSetStep, onSetCoordinates, onUpdateForm, onStartReport,
    onSaveReport, onReset
}) => {
    if (!isLoggedIn) return null;

    if (step === 'idle') {
        return (
            <div className="hgeval-toolbar-button">
                <button
                    className="btn btn-primary hgeval-start-btn"
                    onClick={() => onSetStep('selecting')}
                    title="Evaluate groundwater at a location"
                >
                    <span className="glyphicon glyphicon-tint" />
                    <span className="hgeval-btn-label"> HGeval</span>
                </button>
            </div>
        );
    }

    return (
        <div className="hgeval-overlay">
            <div className="hgeval-header">
                <h3>Hydrogeological Evaluation</h3>
                <button className="btn btn-link hgeval-close" onClick={onReset}>
                    <span className="glyphicon glyphicon-remove" />
                </button>
            </div>
            <div className="hgeval-content">
                {step === 'selecting' && (
                    <HGevalLocationSelector
                        coordinates={coordinates}
                        validationError={validationError}
                        onSetCoordinates={onSetCoordinates}
                        onConfirm={() => onSetStep('form')}
                        onCancel={onReset}
                    />
                )}
                {step === 'form' && (
                    <HGevalProjectForm
                        form={form}
                        coordinates={coordinates}
                        error={error}
                        validationError={validationError}
                        onUpdateForm={onUpdateForm}
                        onBack={() => onSetStep('selecting')}
                        onSubmit={onStartReport}
                    />
                )}
                {step === 'loading' && (
                    <HGevalProgressIndicator
                        progress={queryProgress}
                    />
                )}
                {step === 'report' && (
                    <HGevalReportDisplay
                        coordinates={coordinates}
                        form={form}
                        reportData={reportData}
                        rasterValues={rasterValues}
                        warnings={warnings}
                        savedReport={savedReport}
                        onSave={onSaveReport}
                        onNewReport={onReset}
                    />
                )}
            </div>
        </div>
    );
};

export default HGevalContainer;
