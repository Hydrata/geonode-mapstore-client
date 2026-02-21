import React from "react";

const TargetSelector = ({
    targets,
    selectedTargetId,
    selectSwammTargetId,
    showTargetForm,
    selectedTarget,
    bmpFilterMode,
    setBmpFilterMode,
    downloadTargetData,
    projectId
}) => (
    <div id={"swamm-bmp-chart-col-one"}>
        <div id={"swamm-bmp-chart-targets"}>
            <div className={"swamm-bmp-chart-heading"}>Targets</div>
            {targets.map((target) => {
                return (
                    <button
                        className={"swamm-button"}
                        style={{
                            backgroundColor: target.id === selectedTargetId ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                        }}
                        onClick={() => selectSwammTargetId(target?.id)}>
                        {target?.name}
                    </button>
                );
            })}
            <button
                className={"swamm-button"}
                style={{marginTop: "10px"}}
                onClick={() => showTargetForm(null)}>
                New Target
            </button>
            <button
                className={"swamm-button"}
                style={{marginTop: "10px", marginBottom: "10px"}}
                onClick={() => showTargetForm(selectedTarget)}>
                Edit Target
            </button>
        </div>
        <div id={"swamm-bmp-chart-filter"}>
            <div className={"swamm-bmp-chart-heading"}>
                Sort Data By:
            </div>
            <button
                className={"swamm-button"}
                style={{
                    backgroundColor: bmpFilterMode === 'type' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                }}
                onClick={() => setBmpFilterMode('type')}
            >
                BMP Type
            </button>
            <button
                className={"swamm-button"}
                style={{
                    backgroundColor: bmpFilterMode === 'status' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                }}
                onClick={() => setBmpFilterMode('status')}
            >
                BMP Status
            </button>
            <button
                className={"swamm-button"}
                style={{
                    backgroundColor: bmpFilterMode === 'group_profile' ? "rgba(39,202,59,1)" : "rgba(39,202,59,0.6)"
                }}
                onClick={() => setBmpFilterMode('group_profile')}
            >
                Organization
            </button>
        </div>
        <div id={"swamm-bmp-chart-download"}>
            <div className={"swamm-bmp-chart-heading"}>
                Download target data:
            </div>
            <button
                className={"swamm-button"}
                onClick={() => downloadTargetData(projectId, selectedTargetId)}
            >
                *.xlsx
            </button>
        </div>
    </div>
);

export { TargetSelector };
