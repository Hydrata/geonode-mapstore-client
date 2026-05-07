import React, { useState, useEffect } from "react";
const PropTypes = require('prop-types');
const Spinner = require('react-spinkit');
import {MenuRow} from "../../SimpleView/components/simpleViewMenuRow";
import Message from '@mapstore/framework/components/I18N/Message';
import {trackEvent} from "@js/utils/analytics";

/**
 * Reusable presentational component for an input-data section.
 * Renders: section header + create button + title input + spinner + layer list + empty message.
 *
 * Create flow: input is hidden by default. Clicking the "+" reveals the input
 * and morphs the button into a "save" (✓) glyph. Pressing Enter or clicking
 * the save glyph submits; the input then collapses again.
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
    collapsed = false,
    onToggleCollapse
}) => {
    const collapsible = !!onToggleCollapse;
    const [inputVisible, setInputVisible] = useState(false);

    // `isCreating` is shared across all sections (one global flag), so its
    // true→false transition fires for every mounted InputSection. Without
    // this guard, completing a create in one section would also collapse the
    // input on any other section that happened to be open. `didSubmit` flips
    // true only when *this* section called `submit()`, scoping the auto-collapse.
    const wasCreating = React.useRef(false);
    const didSubmit = React.useRef(false);
    useEffect(() => {
        if (wasCreating.current && !isCreating && didSubmit.current) {
            setInputVisible(false);
            didSubmit.current = false;
        }
        wasCreating.current = isCreating;
    }, [isCreating]);

    const submit = () => {
        if (!titleValue) return;
        didSubmit.current = true;
        onCreate();
        trackEvent('button', 'click', trackEventName);
    };

    const handlePlusClick = () => {
        if (!inputVisible) {
            setInputVisible(true);
        } else if (titleValue) {
            submit();
        } else {
            // Save clicked with empty input → collapse, treat as cancel.
            setInputVisible(false);
        }
    };

    return (
        <div
            className={'menu-rows-container anuga-section'}
        >
            <div
                className={"row menu-row menu-row-header anuga-section-header"}
            >
                <span
                    className={"pull-left menu-row-text" + (collapsible ? " anuga-section-header-clickable" : "")}
                    onClick={collapsible ? onToggleCollapse : undefined}
                    role={collapsible ? "button" : undefined}
                    tabIndex={collapsible ? 0 : undefined}
                    onKeyDown={collapsible ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggleCollapse();
                        }
                    } : undefined}
                    aria-expanded={collapsible ? !collapsed : undefined}
                ><Message msgId={titleMsgId} /></span>
                {canEdit ?
                    <React.Fragment>
                        <span
                            className={`btn glyphicon menu-row-glyph glyph-active ${inputVisible ? 'glyphicon-ok' : 'glyphicon-plus'}`}
                            style={{
                                fontSize: "smaller",
                                textAlign: "right",
                                marginRight: "8px",
                                "float": "right"
                            }}
                            onClick={handlePlusClick}
                            aria-label={inputVisible ? "Save" : "Add new"}
                        />
                        {isCreating ?
                            <span>
                                <Spinner color="white" className="anuga-spinner" spinnerName="circle" noFadeIn/>
                            </span> :
                            inputVisible ?
                                <input
                                    id={inputId}
                                    key={inputId}
                                    className={'data-title-input'}
                                    style={{marginTop: "3px", marginRight: "5px"}}
                                    type={'text'}
                                    value={titleValue}
                                    onChange={(e) => onTitleChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            submit();
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            onTitleChange('');
                                            setInputVisible(false);
                                        }
                                    }}
                                    autoFocus
                                /> : null
                        }
                    </React.Fragment> : null
                }
                {collapsible && (
                    <span
                        className={`btn glyphicon menu-row-glyph glyph-collapse ${collapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}`}
                        style={{ fontSize: "smaller", marginLeft: "auto", marginRight: "8px" }}
                        onClick={onToggleCollapse}
                        aria-label={collapsed ? "Expand section" : "Collapse section"}
                    />
                )}
            </div>
            {!collapsed && layers?.map(layer => <MenuRow key={layer?.name || layer?.id} layer={layer}/>)}
            {!collapsed && layers?.length === 0 ?
                <div className={"row menu-row anuga-section-empty-row"}>
                    <Message msgId={emptyMsgId} />
                </div>
                : null
            }
        </div>
    );
};

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
    collapsed: PropTypes.bool,
    onToggleCollapse: PropTypes.func
};

export default InputSection;
