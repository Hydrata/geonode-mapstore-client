import React, { useState } from "react";
import {trackEvent} from "@js/utils/analytics";

// TASK-1409 — converted from arrow-function expression to block body so we
// can use the useState hook for the inline delete-confirm overlay.
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
}) => {
    // TASK-1409 — replaces window.confirm; the delete fires only on Confirm click.
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    return (
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
            <React.Fragment>
                {/* TASK-1409 — inline confirm overlay replaces window.confirm.
                    Gating preserved: deleteBmp fires only on Confirm click. */}
                {deleteConfirmVisible ? (
                    <React.Fragment>
                        <span className="swamm-bmp-delete-confirm-text" style={{alignSelf: 'center', marginRight: '4px'}}>
                            This action can not be undone. Are you sure?
                        </span>
                        <button
                            type={'button'}
                            className={'swamm-button'}
                            onClick={() => setDeleteConfirmVisible(false)}>
                            Cancel
                        </button>
                        <button
                            type={'button'}
                            className={'swamm-button swamm-bmp-delete-confirm-btn'}
                            style={{backgroundColor: "darkred"}}
                            onClick={() => {
                                setDeleteConfirmVisible(false);
                                deleteBmp(projectId, storedBmpForm?.id);
                                trackEvent('button', 'click', `bmp-delete-${storedBmpForm?.id}`);
                            }}>
                            Delete
                        </button>
                    </React.Fragment>
                ) : (
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        style={{backgroundColor: "darkred"}}
                        onClick={() => setDeleteConfirmVisible(true)}>
                        Delete
                    </button>
                )}
            </React.Fragment> : null
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
};

export { BmpActionButtons };
