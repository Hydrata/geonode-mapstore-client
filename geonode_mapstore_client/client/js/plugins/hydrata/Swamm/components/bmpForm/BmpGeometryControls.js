import React from "react";

const BmpGeometryControls = ({
    storedBmpForm,
    complexBmpForm,
    requiresOutlet,
    requiresFootprint,
    requiresWatershed,
    watershedIsFootprint,
    changingBmpType,
    bmpOutletLayer,
    bmpFootprintLayer,
    bmpWatershedLayer,
    showLoadingBmp,
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
        {
            requiresFootprint || complexBmpForm ?
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
                            disabled={(!storedBmpForm?.group_profile_id || !storedBmpForm.bmpName)}
                            className="swamm-button default"
                            style={{backgroundColor: "darkgreen"}}
                            onClick={() => {
                                toggleLayer(bmpFootprintLayer?.id, true);
                                onDrawBmpStep1(bmpFootprintLayer?.name);
                            }}
                        >
                            Draw Footprint
                        </button>
                    }
                </div>
                : null
        }
        {
            (requiresWatershed || complexBmpForm) && !watershedIsFootprint ?
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
                            disabled={(!storedBmpForm?.group_profile_id || !storedBmpForm.bmpName)}
                            className="swamm-button default"
                            style={{backgroundColor: "darkgreen"}}
                            onClick={() => {
                                toggleLayer(bmpWatershedLayer?.id, true);
                                onDrawBmpStep1(bmpWatershedLayer?.name);
                            }}
                        >
                            Draw Watershed
                        </button>
                    }
                </div>
                : null
        }
    </React.Fragment>
);

export { BmpGeometryControls };
