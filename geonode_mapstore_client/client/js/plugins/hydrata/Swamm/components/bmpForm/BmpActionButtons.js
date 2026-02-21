import React from "react";

const BmpActionButtons = ({
    storedBmpForm,
    complexBmpForm,
    setComplexBmpForm,
    downloadBmpReport,
    hideBmpForm,
    standard_url,
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
                    onClick={() => { downloadBmpReport(storedBmpForm?.id);}}>
                    Make PDF
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
        <button
            type={'button'}
            disabled={!!standard_url}
            className={`swamm-button ${standard_url ? "" : "swamm-button-disabled"}`}
            onClick={() => window.open(standard_url, "_blank")}>
            Description
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
            }}>
            Save
        </button>
    </div>
);

export { BmpActionButtons };
