import React from "react";

const BmpOrgStatusFields = ({
    storedBmpForm,
    saveableGroupProfiles,
    statuses,
    handleChange,
    handleGroupProfileChange
}) => (
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
                            className={groupProfile?.saveable ? "" : "sv-non-savable-group-profile"}
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
    </React.Fragment>
);

export { BmpOrgStatusFields };
