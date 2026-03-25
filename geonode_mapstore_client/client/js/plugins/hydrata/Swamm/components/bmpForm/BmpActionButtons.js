import React from "react";
import {trackEvent} from "@js/utils/analytics";

const BmpActionButtons = ({
    storedBmpForm,
    complexBmpForm,
    setComplexBmpForm,
    downloadBmpReport,
    fetchBmpHistory,
    hideBmpForm,
    deleteBmp,
    projectId,
    hasGeometry,
    submitBmpForm,
    onRefreshBmpLayers
}) => (
    <div
        id={"swamm-bmp-form-grid-footer"}
        className={"simple-view-panel-item-row"}
        style={{
            display: "flex",
            justifyContent: "flex-end"
        }}
    >
        {storedBmpForm?.id ?
            <React.Fragment>
                {
                    complexBmpForm ?
                        <button
                            type={'button'}
                            className={'swamm-button'}
                            onClick={() => setComplexBmpForm(false)}>
                            Simple
                        </button>
                        :
                        <button
                            type={'button'}
                            className={'swamm-button'}
                            onClick={() => setComplexBmpForm(true)}>
                            Advanced
                        </button>
                }
                <button
                    type={'button'}
                    className={'swamm-button'}
                    onClick={() => {
                        downloadBmpReport(storedBmpForm?.id);
                        trackEvent('button', 'click', `bmp-download-pdf-${storedBmpForm?.id}`);
                    }}>
                    Make PDF
                </button>
                <button
                    type={'button'}
                    className={'swamm-button'}
                    onClick={() => {
                        fetchBmpHistory(projectId, storedBmpForm?.id);
                        trackEvent('button', 'click', `bmp-history-${storedBmpForm?.id}`);
                    }}>
                    History
                </button>
            </React.Fragment>
            : null}
        <button
            type={'button'}
            className={'swamm-button'}
            onClick={() => {
                hideBmpForm();
                onRefreshBmpLayers();
            }}>
            View Map
        </button>
        {storedBmpForm?.id ?
            <button
                type={'button'}
                className={'swamm-button'}
                style={{
                    backgroundColor: "darkred"
                }}
                onClick={() => {
                    if (window.confirm('This action can not be undone. Are you sure?')) {
                        deleteBmp(projectId, storedBmpForm?.id);
                        trackEvent('button', 'click', `bmp-delete-${storedBmpForm?.id}`);
                    }
                }}>
                Delete
            </button> : null
        }
        <button
            type={'button'}
            className={hasGeometry ? 'swamm-button' : 'swamm-button disabled'}
            style={{
                backgroundColor: "darkgreen"
            }}
            onClick={() => {
                submitBmpForm(storedBmpForm, projectId);
                trackEvent('button', 'click', storedBmpForm?.id ? `bmp-save-${storedBmpForm.id}` : 'bmp-create');
            }}>
            Save
        </button>
    </div>
);

export { BmpActionButtons };
