import React from "react";
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const FILTER_TOOLTIPS = {
    type: "Group chart data by BMP practice type",
    status: "Group chart data by BMP implementation status",
    group_profile: "Group chart data by implementing organization",
    swamm_engine: "Group chart data by sub-watershed"
};

const DOWNLOAD_TOOLTIP = "Download all BMP data as Excel spreadsheet";

const TargetSelector = ({
    targets,
    selectedTargetId,
    selectSwammTargetId,
    showTargetForm,
    selectedTarget,
    bmpFilterMode,
    setBmpFilterMode,
    downloadTargetData,
    downloadSummaryCSV,
    downloadTargetPdf,
    normalizationMode = 'total',
    setNormalizationMode,
    projectId
}) => (
    <div id={"swamm-bmp-chart-col-one"}>
        <div id={"swamm-bmp-chart-targets"}>
            <div className={"sv-swamm-bmp-chart-heading"}>Targets</div>
            {targets.map((target) => {
                const isSelected = target.id === selectedTargetId;
                return (
                    <button
                        key={target.id}
                        className={"sv-swamm-button"}
                        aria-label={"Select target: " + target.name}
                        aria-pressed={isSelected}
                        style={{
                            backgroundColor: isSelected ? "var(--sv-accent-green, rgba(39,202,59,1))" : "var(--sv-accent-green-dim, rgba(39,202,59,0.6))"
                        }}
                        onClick={() => selectSwammTargetId(target?.id)}>
                        {target?.name}
                    </button>
                );
            })}
            <button
                className={"sv-swamm-button"}
                style={{marginTop: "10px"}}
                onClick={() => showTargetForm(null)}>
                New Target
            </button>
            <button
                className={"sv-swamm-button"}
                style={{marginTop: "10px", marginBottom: "10px"}}
                onClick={() => showTargetForm(selectedTarget)}>
                Edit Target
            </button>
        </div>
        <div id={"swamm-bmp-chart-filter"}>
            <div className={"sv-swamm-bmp-chart-heading"}>
                Sort Data By:
            </div>
            <div role="radiogroup" aria-label="Group data by">
                <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-type">{FILTER_TOOLTIPS.type}</Tooltip>}>
                    <button
                        className={"sv-swamm-button"}
                        role="radio"
                        aria-checked={bmpFilterMode === 'type'}
                        style={{
                            backgroundColor: bmpFilterMode === 'type' ? "var(--sv-accent-green, rgba(39,202,59,1))" : "var(--sv-accent-green-dim, rgba(39,202,59,0.6))"
                        }}
                        onClick={() => setBmpFilterMode('type')}
                    >
                        BMP Type
                    </button>
                </OverlayTrigger>
                <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-status">{FILTER_TOOLTIPS.status}</Tooltip>}>
                    <button
                        className={"sv-swamm-button"}
                        role="radio"
                        aria-checked={bmpFilterMode === 'status'}
                        style={{
                            backgroundColor: bmpFilterMode === 'status' ? "var(--sv-accent-green, rgba(39,202,59,1))" : "var(--sv-accent-green-dim, rgba(39,202,59,0.6))"
                        }}
                        onClick={() => setBmpFilterMode('status')}
                    >
                        BMP Status
                    </button>
                </OverlayTrigger>
                <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-org">{FILTER_TOOLTIPS.group_profile}</Tooltip>}>
                    <button
                        className={"sv-swamm-button"}
                        role="radio"
                        aria-checked={bmpFilterMode === 'group_profile'}
                        style={{
                            backgroundColor: bmpFilterMode === 'group_profile' ? "var(--sv-accent-green, rgba(39,202,59,1))" : "var(--sv-accent-green-dim, rgba(39,202,59,0.6))"
                        }}
                        onClick={() => setBmpFilterMode('group_profile')}
                    >
                        Organization
                    </button>
                </OverlayTrigger>
                <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-subwatershed">{FILTER_TOOLTIPS.swamm_engine}</Tooltip>}>
                    <button
                        className={"sv-swamm-button"}
                        role="radio"
                        aria-checked={bmpFilterMode === 'swamm_engine'}
                        style={{
                            backgroundColor: bmpFilterMode === 'swamm_engine' ? "var(--sv-accent-green, rgba(39,202,59,1))" : "var(--sv-accent-green-dim, rgba(39,202,59,0.6))"
                        }}
                        onClick={() => setBmpFilterMode('swamm_engine')}
                    >
                        Sub-Watershed
                    </button>
                </OverlayTrigger>
            </div>
        </div>
        <div id={"swamm-bmp-chart-normalize"} style={{marginBottom: '20px'}}>
            <div className={"sv-swamm-bmp-chart-heading"}>
                Normalize:
            </div>
            <button
                className={"sv-swamm-button"}
                style={{ backgroundColor: normalizationMode === 'total' ? 'var(--sv-accent-green, rgba(39,202,59,1))' : 'var(--sv-accent-green-dim, rgba(39,202,59,0.6))' }}
                onClick={() => setNormalizationMode && setNormalizationMode('total')}
            >
                Total
            </button>
            <button
                className={"sv-swamm-button"}
                style={{ backgroundColor: normalizationMode === 'per_acre' ? 'var(--sv-accent-green, rgba(39,202,59,1))' : 'var(--sv-accent-green-dim, rgba(39,202,59,0.6))' }}
                onClick={() => setNormalizationMode && setNormalizationMode('per_acre')}
            >
                Per Acre
            </button>
            <button
                className={"sv-swamm-button"}
                style={{ backgroundColor: normalizationMode === 'per_dollar' ? 'var(--sv-accent-green, rgba(39,202,59,1))' : 'var(--sv-accent-green-dim, rgba(39,202,59,0.6))' }}
                onClick={() => setNormalizationMode && setNormalizationMode('per_dollar')}
            >
                Per Dollar
            </button>
        </div>
        <div id={"swamm-bmp-chart-download"}>
            <div className={"sv-swamm-bmp-chart-heading"}>
                Download target data:
            </div>
            <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-download">{DOWNLOAD_TOOLTIP}</Tooltip>}>
                <button
                    className={"sv-swamm-button"}
                    onClick={() => downloadTargetData(projectId, selectedTargetId)}
                >
                    *.xlsx
                </button>
            </OverlayTrigger>
            <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-csv">Download summary as CSV</Tooltip>}>
                <button
                    className={"sv-swamm-button"}
                    onClick={() => downloadSummaryCSV && downloadSummaryCSV(selectedTarget?.speedDialData, selectedTarget?.name)}
                >
                    CSV
                </button>
            </OverlayTrigger>
            <OverlayTrigger placement="right" overlay={<Tooltip id="tooltip-pdf">Download target report as PDF</Tooltip>}>
                <button
                    className={"sv-swamm-button"}
                    onClick={() => downloadTargetPdf && downloadTargetPdf(projectId, selectedTargetId)}
                >
                    PDF
                </button>
            </OverlayTrigger>
        </div>
    </div>
);

export { TargetSelector, FILTER_TOOLTIPS, DOWNLOAD_TOOLTIP };
