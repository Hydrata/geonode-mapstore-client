import React from 'react';
import HGevalInputPanel from './hgevalInputPanel';
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
        <div className="hgeval-panel">
            <div className="hgeval-header">
                <h4>Hydrogeological Evaluation</h4>
                <button className="btn btn-link hgeval-close" onClick={onReset}>
                    <span className="glyphicon glyphicon-remove" />
                </button>
            </div>
            <div className="hgeval-content">
                {(step === 'selecting' || step === 'form') && (
                    <HGevalInputPanel
                        coordinates={coordinates}
                        form={form}
                        validationError={validationError}
                        error={error}
                        onSetCoordinates={onSetCoordinates}
                        onUpdateForm={onUpdateForm}
                        onStartReport={onStartReport}
                        onCancel={onReset}
                    />
                )}
                {step === 'loading' && (
                    <HGevalProgressIndicator progress={queryProgress} />
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
