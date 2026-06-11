import React from "react";
import PropTypes from "prop-types";
import Message from "@mapstore/framework/components/I18N/Message";
import {trackEvent} from "@js/utils/analytics";
const Spinner = require('react-spinkit');

const PHASE_CONFIG = {
    terrain: {
        headingMsgId: "hydrata.anuga.starterCardHeading",
        introMsgId: "hydrata.anuga.starterCardIntro",
        step1Modifier: "anuga-starter-step--active",
        step1DescMsgId: "hydrata.anuga.starterStep1Desc",
        step1Marker: "1",
        showStep1Cta: true,
        step2Modifier: "anuga-starter-step--pending",
        step2DescMsgId: "hydrata.anuga.starterStep2Desc",
        step2Marker: "2",
        step2AriaDisabled: "true",
        step2AriaBusy: undefined
    },
    defaults: {
        headingMsgId: "hydrata.anuga.starterCardHeadingDefaults",
        introMsgId: "hydrata.anuga.starterCardIntroDefaults",
        step1Modifier: "anuga-starter-step--done",
        step1DescMsgId: "hydrata.anuga.starterStep1DescDone",
        step1Marker: "check",
        showStep1Cta: false,
        step2Modifier: "anuga-starter-step--active",
        step2DescMsgId: "hydrata.anuga.starterStep2DescActive",
        step2Marker: "spinner",
        step2AriaDisabled: undefined,
        step2AriaBusy: "true"
    }
};

const renderMarker = (marker) => {
    if (marker === "check") return <span className={"glyphicon glyphicon-ok"} />;
    if (marker === "spinner") {
        return <Spinner color="#fff" className="anuga-starter-step-spinner" spinnerName="circle" noFadeIn/>;
    }
    return marker;
};

// TASK-1646 (W1.5): add onImportFromWeb prop for the 'Import from web' CTA.
const AnugaInputStarterCard = ({phase, onUploadTerrain, onImportFromWeb}) => {
    const cfg = PHASE_CONFIG[phase];
    const handleUpload = () => {
        trackEvent("button", "click", "anuga-input-starter-upload-terrain");
        onUploadTerrain();
    };
    const handleImport = () => {
        trackEvent("button", "click", "anuga-input-starter-import-from-web");
        if (onImportFromWeb) onImportFromWeb();
    };

    return (
        <div
            className={"anuga-starter-card"}
            role="region"
            aria-label="Project setup checklist"
        >
            <div className={"anuga-starter-card-heading"}>
                <Message msgId={cfg.headingMsgId} />
            </div>
            <div className={"anuga-starter-card-intro"}>
                <Message msgId={cfg.introMsgId} />
            </div>
            <div className={`anuga-starter-step ${cfg.step1Modifier}`}>
                <span className={"anuga-starter-step-num"} aria-hidden="true">
                    {renderMarker(cfg.step1Marker)}
                </span>
                <div className={"anuga-starter-step-body"}>
                    <div className={"anuga-starter-step-title"}>
                        <Message msgId="hydrata.anuga.starterStep1Title" />
                    </div>
                    <div className={"anuga-starter-step-desc"}>
                        <Message msgId={cfg.step1DescMsgId} />
                    </div>
                    {cfg.showStep1Cta ?
                        <div className={"anuga-starter-step-cta"}>
                            {/* TASK-1646: 'Import from web' left of 'Upload Terrain' */}
                            <button
                                type="button"
                                className={"btn btn-success btn-sm"}
                                onClick={handleImport}
                                data-testid="anuga-starter-import-from-web"
                                style={{marginRight: 8}}
                            >
                                <span
                                    className={"glyphicon glyphicon-globe"}
                                    style={{marginRight: 6}}
                                    aria-hidden="true"
                                />
                                Import from web
                            </button>
                            <button
                                type="button"
                                className={"btn btn-success btn-sm"}
                                onClick={handleUpload}
                            >
                                <span
                                    className={"glyphicon glyphicon-upload"}
                                    style={{marginRight: 6}}
                                    aria-hidden="true"
                                />
                                <Message msgId="hydrata.anuga.starterStep1Button" />
                            </button>
                        </div> : null
                    }
                </div>
            </div>
            <div
                className={`anuga-starter-step ${cfg.step2Modifier}`}
                aria-disabled={cfg.step2AriaDisabled}
                aria-busy={cfg.step2AriaBusy}
            >
                <span className={"anuga-starter-step-num"} aria-hidden="true">
                    {renderMarker(cfg.step2Marker)}
                </span>
                <div className={"anuga-starter-step-body"}>
                    <div className={"anuga-starter-step-title"}>
                        <Message msgId="hydrata.anuga.starterStep2Title" />
                    </div>
                    <div className={"anuga-starter-step-desc"}>
                        <Message msgId={cfg.step2DescMsgId} />
                    </div>
                </div>
            </div>
            <div
                className={"anuga-starter-step anuga-starter-step--pending"}
                aria-disabled="true"
            >
                <span className={"anuga-starter-step-num"} aria-hidden="true">3</span>
                <div className={"anuga-starter-step-body"}>
                    <div className={"anuga-starter-step-title"}>
                        <Message msgId="hydrata.anuga.starterStep3Title" />
                    </div>
                    <div className={"anuga-starter-step-desc"}>
                        <Message msgId="hydrata.anuga.starterStep3Desc" />
                    </div>
                </div>
            </div>
        </div>
    );
};

AnugaInputStarterCard.propTypes = {
    phase: PropTypes.oneOf(Object.keys(PHASE_CONFIG)),
    onUploadTerrain: PropTypes.func,
    onImportFromWeb: PropTypes.func  // TASK-1646
};

AnugaInputStarterCard.defaultProps = {
    phase: "terrain"
};

export default AnugaInputStarterCard;
