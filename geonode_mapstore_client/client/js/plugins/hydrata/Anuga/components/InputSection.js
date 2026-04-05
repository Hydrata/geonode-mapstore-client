import React from "react";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";

/**
 * Reusable presentational component for an input-data section.
 * Renders: section header + create button + title input + spinner + layer list + empty message.
 */
const InputSection = ({
    titleMsgId,
    emptyMsgId = "hydrata.anuga.none",
    layers = [],
    titleValue,
    onTitleChange,
    onCreate,
    isCreating,
    canEdit,
    inputId,
    trackEventName,
    extraHeaderContent
}) => (
    <div
        className={'menu-rows-container anuga-section'}
    >
        <div
            className={"row menu-row menu-row-header anuga-section-header"}
        >
            <span className="pull-left menu-row-text"><Message msgId={titleMsgId} /></span>
            {extraHeaderContent}
            {canEdit ?
                <React.Fragment>
                    <span
                        className={`btn glyphicon menu-row-glyph glyph-active glyphicon-plus${titleValue ? "" : " disabled"}`}
                        style={{
                            fontSize: "smaller",
                            textAlign: "right",
                            marginRight: "8px",
                            float: "right"
                        }}
                        onClick={() => {
                            onCreate();
                            trackEvent('button', 'click', trackEventName);
                        }}
                    />
                    {isCreating ?
                        <span>
                            <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                        </span> :
                        <input
                            id={inputId}
                            key={inputId}
                            className={'data-title-input'}
                            style={{marginTop: "3px", marginRight: "5px"}}
                            type={'text'}
                            value={titleValue}
                            onChange={(e) => onTitleChange(e.target.value)}
                        />
                    }
                </React.Fragment> : null
            }
        </div>
        {layers?.map(layer => <MenuRow key={layer?.name || layer?.id} layer={layer}/>)}
        {layers?.length === 0 ?
            <div className={"row menu-row anuga-section-empty-row"}>
                <Message msgId={emptyMsgId} />
            </div>
            : null
        }
    </div>
);

InputSection.propTypes = {
    titleMsgId: PropTypes.string.isRequired,
    emptyMsgId: PropTypes.string,
    layers: PropTypes.array,
    titleValue: PropTypes.string,
    onTitleChange: PropTypes.func,
    onCreate: PropTypes.func,
    isCreating: PropTypes.bool,
    canEdit: PropTypes.bool,
    inputId: PropTypes.string,
    trackEventName: PropTypes.string,
    extraHeaderContent: PropTypes.node
};

export default InputSection;
