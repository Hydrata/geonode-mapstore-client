import React from 'react';
import Message from '@mapstore/framework/components/I18N/Message';
import HGevalInputPanel from './hgevalInputPanel';
import HGevalReportDisplay from './hgevalReportDisplay';
import HGevalProgressIndicator from './hgevalProgressIndicator';

const HGevalContainer = ({
    step, coordinates, form, reportData, rasterValues, warnings,
    queryProgress, loading: _loading, error, validationError, savedReport, isLoggedIn,
    signupErrors, signingUp, loginErrors, loggingIn, mapImageDataUrl,
    rasterApiUrl: _rasterApiUrl, reportApiUrl: _reportApiUrl,
    onSetStep: _onSetStep, onSetCoordinates, onUpdateForm, onStartReport,
    onSaveReport, onSignupAndSave, onLoginAndSave, onReset
}) => {
    // Button is now rendered by SimpleView toolbar; nothing to show when idle
    if (step === 'idle') return null;

    return (
        <div className="hgeval-panel">
            <div className="hgeval-header">
                <h4><Message msgId="hydrata.hgeval.hydrogeologicalEvaluation" /></h4>
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
                        isLoggedIn={isLoggedIn}
                        signupErrors={signupErrors}
                        signingUp={signingUp}
                        loginErrors={loginErrors}
                        loggingIn={loggingIn}
                        mapImageDataUrl={mapImageDataUrl}
                        onSave={onSaveReport}
                        onSignupAndSave={onSignupAndSave}
                        onLoginAndSave={onLoginAndSave}
                        onNewReport={onReset}
                        onUpdateForm={onUpdateForm}
                    />
                )}
            </div>
        </div>
    );
};

export default HGevalContainer;
