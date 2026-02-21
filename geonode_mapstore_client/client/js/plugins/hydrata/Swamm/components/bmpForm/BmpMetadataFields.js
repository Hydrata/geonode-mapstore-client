import React from "react";

const BmpMetadataFields = ({ storedBmpForm, handleChange, children }) => (
    <React.Fragment>
        <div className={"simple-view-panel-item-row"}>
            <div>
              Field Identifier:
            </div>
            <input
                type={"text"}
                name="field_identifier"
                style={{
                    maxWidth: "fit-content"
                }}
                value={storedBmpForm?.field_identifier}
                onChange={handleChange}
                placeholder="---"
            />
        </div>
        <div className={"simple-view-panel-item-row"}>
            <div style={{textAlign: "left"}}>
              Owner details:
            </div>
            <input
                type={"text"}
                name="owner_identifier"
                style={{
                    maxWidth: "fit-content"
                }}
                value={storedBmpForm?.owner_identifier}
                onChange={handleChange}
                placeholder="---"
            />
        </div>
        {children}
        <div style={{marginTop: "10px"}}>
            Notes
        </div>
        <textarea
            id={'bmp-notes'}
            rows={4}
            cols={50}
            name="notes"
            value={storedBmpForm?.notes}
            onChange={handleChange}
        />
    </React.Fragment>
);

export { BmpMetadataFields };
