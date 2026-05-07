import React from "react";

const BmpGeometryControls = ({
    storedBmpForm,
    complexBmpForm,
    requiresOutlet,
    requiresFootprint,
    requiresWatershed,
    watershedIsFootprint,
    changingBmpType: _changingBmpType,
    bmpOutletLayer,
    bmpFootprintLayer,
    bmpWatershedLayer,
    showLoadingBmp: _showLoadingBmp,
    toggleLayer,
    setChangingBmpType,
    onDrawBmpStep1
}) => (
    <React.Fragment>
        {
            storedBmpForm?.id ?
                <div className={"simple-view-panel-item-row"}>
                    <div>
                        Type: {storedBmpForm?.type_data?.name}
                    </div>
                    <button
                        type={'button'}
                        className={'swamm-button'}
                        onClick={() => {
                            // eslint-disable-next-line no-alert -- intentional user confirmation
                            if (window.confirm('This will remove any custom data you have entered for the current BMP Type. Are you sure?')) {
                                setChangingBmpType(true);
                            }
                        }}>
                        Edit Type
                    </button>
                </div> :
                null
        }
        {
            requiresOutlet || complexBmpForm ?
                <div className={"simple-view-panel-item-row"}>
                    <div>
                        Outlet Point:
                    </div>
                    {storedBmpForm?.outlet_fid ?
                        <button
                            type={'button'}
                            className={'swamm-button'}
                            onClick={() => {
                                toggleLayer(bmpOutletLayer?.id, true);
                                onDrawBmpStep1(bmpOutletLayer?.name, storedBmpForm?.outlet_fid);
                            }}>
                        Edit Outlet
                        </button> :
                        <button
                            type={'button'}
                            style={{backgroundColor: "darkgreen"}}
                            disabled={(!storedBmpForm?.group_profile_id || !storedBmpForm.bmpName)}
                            className="swamm-button default"
                            onClick={() => {
                                toggleLayer(bmpOutletLayer?.id, true);
                                onDrawBmpStep1(bmpOutletLayer?.name, null);
                            }}>
                        Locate
                        </button>
                    }
                </div>
                : null
        }
        {storedBmpForm?.type_data ?
            <React.Fragment>
                <div className={"simple-view-panel-item-row"}>
                    {storedBmpForm?.footprint_fid ?
                        <React.Fragment>
                            <div>
                                Footprint: {
                                    storedBmpForm?.calculated_footprint_area ?
                                        storedBmpForm?.calculated_footprint_area?.toFixed(2) + " acres" :
                                        ' '
                                }
                            </div>
                            <button
                                type={'button'}
                                className={'swamm-button'}
                                onClick={() => {
                                    toggleLayer(bmpFootprintLayer?.id, true);
                                    onDrawBmpStep1(bmpFootprintLayer?.name, storedBmpForm?.footprint_fid);
                                }}
                            >
                                Edit Footprint
                            </button>
                        </React.Fragment> :
                        <button
                            type={'button'}
                            disabled={!requiresFootprint || !storedBmpForm?.group_profile_id || !storedBmpForm.bmpName}
                            className="swamm-button default"
                            style={{backgroundColor: requiresFootprint ? "darkgreen" : undefined}}
                            title={!requiresFootprint ? "This BMP type does not need a footprint area" : undefined}
                            onClick={() => {
                                toggleLayer(bmpFootprintLayer?.id, true);
                                onDrawBmpStep1(bmpFootprintLayer?.name);
                            }}
                        >
                            {requiresFootprint ? "Draw Footprint" : "Footprint not used"}
                        </button>
                    }
                </div>
                <div className={"simple-view-panel-item-row"}>
                    {storedBmpForm?.watershed_fid ?
                        <React.Fragment>
                            <div>
                                Watershed: {storedBmpForm?.calculated_watershed_area ?
                                    storedBmpForm?.calculated_watershed_area?.toFixed(2) + " acres" :
                                    ' '}
                            </div>
                            <button
                                type={'button'}
                                className={'swamm-button'}
                                onClick={() => {
                                    toggleLayer(bmpWatershedLayer?.id, true);
                                    onDrawBmpStep1(bmpWatershedLayer?.name, storedBmpForm?.watershed_fid);
                                }}
                            >
                                Edit Watershed
                            </button>
                        </React.Fragment> :
                        <button
                            disabled={!requiresWatershed || watershedIsFootprint || !storedBmpForm?.group_profile_id || !storedBmpForm.bmpName}
                            className="swamm-button default"
                            style={{backgroundColor: requiresWatershed && !watershedIsFootprint ? "darkgreen" : undefined}}
                            title={!requiresWatershed
                                ? "This BMP type does not need a watershed area"
                                : watershedIsFootprint
                                    ? "This BMP type uses the footprint as the watershed"
                                    : undefined}
                            onClick={() => {
                                toggleLayer(bmpWatershedLayer?.id, true);
                                onDrawBmpStep1(bmpWatershedLayer?.name);
                            }}
                        >
                            {requiresWatershed && !watershedIsFootprint ? "Draw Watershed" : "Watershed not used"}
                        </button>
                    }
                </div>
            </React.Fragment> : null
        }
    </React.Fragment>
);

export { BmpGeometryControls };
