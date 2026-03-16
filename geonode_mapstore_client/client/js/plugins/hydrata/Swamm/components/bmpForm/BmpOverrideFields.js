import React from "react";

const BmpOverrideFields = ({
    storedBmpForm,
    saveableGroupProfiles,
    statuses,
    priorities,
    handleChange,
    handleGroupProfileChange,
    updateBmpForm,
    submitBmpForm,
    projectId
}) => {
    const isManualOverride = !!storedBmpForm?.manual_override_loads;

    const handleResetToCalculated = () => {
        updateBmpForm({manual_override_loads: false});
        const resetForm = {...storedBmpForm, manual_override_loads: false};
        submitBmpForm(resetForm, projectId);
    };

    return (
        <React.Fragment>
            <div className={"simple-view-panel-item-row"} id="organization-selector-container">
                <div>
                  Organization
                </div>
                <select
                    id="organization-selector"
                    name={'group_profile'}
                    value={storedBmpForm?.group_profile?.pk}
                    onChange={handleGroupProfileChange}
                    placeholder={storedBmpForm?.group_profile?.title}
                >
                    {saveableGroupProfiles.map((groupProfile) => {
                        return (
                            <option
                                key={groupProfile.pk}
                                value={groupProfile?.pk}
                                className={groupProfile?.saveable ? "" : "non-savable-group-profile"}
                            >
                                {groupProfile.title}
                            </option>
                        );
                    })}
                </select>
            </div>
            <div className={"simple-view-panel-item-row"} id="status-selector-container">
                <div>
                  BMP Status
                </div>
                <select
                    id="status-selector"
                    name={'status'}
                    value={storedBmpForm?.status}
                    onChange={handleChange}
                >
                    <option key={'Unknown'} value={'Unknown'}>{'Unknown'}</option>
                    {statuses
                        .filter(status => status?.name !== 'Unknown')
                        .map(status => <option key={status?.name} value={status?.name}>{status?.name}</option>)
                    }
                </select>
            </div>
            <div className={"simple-view-panel-item-row"} id="priority-selector-container">
                <div>
                  BMP Priority
                </div>
                <select
                    id="priority-selector"
                    name="priority"
                    value={storedBmpForm?.priority}
                    onChange={handleChange}
                >
                    {priorities.map((priority) => {
                        return (
                            <option
                                id={priority.id}
                                key={priority.id}
                                value={priority?.value}
                            >
                                {priority.label}
                            </option>
                        );
                    })}
                </select>
            </div>
            {isManualOverride ? (
                <React.Fragment>
                    <div style={{
                        borderLeft: '3px solid #d4a017',
                        backgroundColor: 'rgba(212, 160, 23, 0.08)',
                        padding: '6px 10px',
                        margin: '6px 0',
                        fontSize: '12px',
                        color: '#8a6d00',
                        lineHeight: '1.4'
                    }}>
                        Load values are manually overridden. Reduction percentages are disabled.
                    </div>
                    <div style={{margin: '4px 0 8px 0'}}>
                        <button
                            type="button"
                            className="swamm-button"
                            style={{
                                backgroundColor: '#d4a017',
                                color: '#fff',
                                fontSize: '12px',
                                padding: '4px 10px',
                                width: '100%'
                            }}
                            onClick={handleResetToCalculated}
                        >
                            Reset to Calculated Values
                        </button>
                    </div>
                </React.Fragment>
            ) : null}
            <div className={"simple-view-panel-item-row"} id="n_surface_red_percent-selector-container">
                <div>
                  Surface Nitrogen Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_n_surface_red_percent"
                    value={storedBmpForm?.override_n_surface_red_percent != null
                        ? parseFloat(storedBmpForm.override_n_surface_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="p_surface_red_percent-selector-container">
                <div>
                  Surface Phosphorus Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_p_surface_red_percent"
                    value={storedBmpForm?.override_p_surface_red_percent != null
                        ? parseFloat(storedBmpForm.override_p_surface_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="s_surface_red_percent-selector-container">
                <div>
                  Surface Sediment Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_s_surface_red_percent"
                    value={storedBmpForm?.override_s_surface_red_percent != null
                        ? parseFloat(storedBmpForm.override_s_surface_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="n_tiled_red_percent-selector-container">
                <div>
                  Tiled Nitrogen Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_n_tiled_red_percent"
                    value={storedBmpForm?.override_n_tiled_red_percent != null
                        ? parseFloat(storedBmpForm.override_n_tiled_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="p_tiled_red_percent-selector-container">
                <div>
                  Tiled Phosphorus Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_p_tiled_red_percent"
                    value={storedBmpForm?.override_p_tiled_red_percent != null
                        ? parseFloat(storedBmpForm.override_p_tiled_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="n_erosion_red_percent-selector-container">
                <div>
                  Erosion Nitrogen Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_n_erosion_red_percent"
                    value={storedBmpForm?.override_n_erosion_red_percent != null
                        ? parseFloat(storedBmpForm.override_n_erosion_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="p_erosion_red_percent-selector-container">
                <div>
                  Erosion Phosphorus Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_p_erosion_red_percent"
                    value={storedBmpForm?.override_p_erosion_red_percent != null
                        ? parseFloat(storedBmpForm.override_p_erosion_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="s_erosion_red_percent-selector-container">
                <div>
                  Erosion Sediment Reduction Percentage
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_s_erosion_red_percent"
                    value={storedBmpForm?.override_s_erosion_red_percent != null
                        ? parseFloat(storedBmpForm.override_s_erosion_red_percent).toFixed(0)
                        : ''}
                    onChange={handleChange}
                    placeholder="---"
                    disabled={isManualOverride}
                    style={{opacity: isManualOverride ? 0.5 : 1}}
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="override_cost_base-selector-container">
                <div>
                  Base Cost ($)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_base"
                    value={storedBmpForm?.override_cost_base}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="cost_rate_per_footprint_area-selector-container">
                <div>
                  Footprint Cost ($/acre)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_rate_per_footprint_area"
                    value={storedBmpForm?.override_cost_rate_per_footprint_area}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="cost_rate_per_watershed_area-selector-container">
                <div>
                  Watershed Cost ($/acre)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_rate_per_watershed_area"
                    value={storedBmpForm?.override_cost_rate_per_watershed_area}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
        </React.Fragment>
    );
};

export { BmpOverrideFields };
