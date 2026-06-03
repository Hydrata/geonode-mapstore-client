/**
 * ConfirmOverlay — shared inline confirm widget.
 *
 * TASK-1438 (ISSUE: TASK-1409 follow-up): Three files added identical
 * "This action can not be undone. Are you sure? / Cancel / <action>" patterns.
 * This component centralises the pattern so callers only manage the
 * `visible` boolean and the action-specific callbacks.
 *
 * Props:
 *   message       {string|node}   Prompt text.  Default: "This action can not be undone. Are you sure?"
 *   onConfirm     {func}          Called when the confirm button is clicked.
 *   onCancel      {func}          Called when the cancel button is clicked.
 *   confirmLabel  {string|node}   Text for the confirm button.  Default: "Delete"
 *   confirmStyle  {object}        Inline style for the confirm button.  Default: {backgroundColor:"darkred"}
 *   cancelLabel   {string}        Text for the cancel button.  Default: "Cancel"
 *   buttonClassName {string}      CSS class shared by both buttons (e.g. "swamm-button" or "hydrology-button").
 *   confirmClassName {string}     Extra class appended to the confirm button for test selectors.
 *   wrapperClassName {string}     Class for the wrapper element.  Falsy → React.Fragment (inline).
 *   wrapperStyle  {object}        Inline style for the wrapper element (ignored when no wrapperClassName).
 *
 * Usage (BmpActionButtons style — React.Fragment wrapper):
 *   {deleteConfirmVisible && (
 *       <ConfirmOverlay
 *           buttonClassName="swamm-button"
 *           confirmClassName="swamm-bmp-delete-confirm-btn"
 *           onCancel={() => setDeleteConfirmVisible(false)}
 *           onConfirm={() => { setDeleteConfirmVisible(false); deleteBmp(projectId, storedBmpForm?.id); }}
 *           confirmLabel="Delete"
 *       />
 *   )}
 *
 * Usage (hydrologyListDetailContainer style — div wrapper):
 *   {this.state.deleteConfirmVisible && (
 *       <ConfirmOverlay
 *           wrapperClassName="hydrology-delete-confirm"
 *           buttonClassName="hydrology-button"
 *           confirmClassName="hydrology-delete-confirm-btn"
 *           onCancel={() => this.setState({deleteConfirmVisible: false})}
 *           onConfirm={() => { ... }}
 *           confirmLabel={<Message msgId="hydrata.hydrology.delete" />}
 *       />
 *   )}
 */
import React from 'react';
import PropTypes from 'prop-types';

const DEFAULT_MESSAGE = 'This action can not be undone. Are you sure?';
const DEFAULT_CONFIRM_STYLE = {backgroundColor: 'darkred'};

const ConfirmOverlay = ({
    message = DEFAULT_MESSAGE,
    onConfirm,
    onCancel,
    confirmLabel = 'Delete',
    confirmStyle = DEFAULT_CONFIRM_STYLE,
    cancelLabel = 'Cancel',
    buttonClassName = '',
    confirmClassName = '',
    wrapperClassName,
    wrapperStyle
}) => {
    const content = (
        <React.Fragment>
            <span style={{alignSelf: 'center', marginRight: '4px'}}>{message}</span>
            <button
                type="button"
                className={buttonClassName}
                onClick={onCancel}>
                {cancelLabel}
            </button>
            <button
                type="button"
                className={[buttonClassName, confirmClassName].filter(Boolean).join(' ')}
                style={confirmStyle}
                onClick={onConfirm}>
                {confirmLabel}
            </button>
        </React.Fragment>
    );

    if (wrapperClassName) {
        return (
            <div className={wrapperClassName} style={wrapperStyle}>
                {content}
            </div>
        );
    }
    return content;
};

ConfirmOverlay.propTypes = {
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    confirmLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    confirmStyle: PropTypes.object,
    cancelLabel: PropTypes.string,
    buttonClassName: PropTypes.string,
    confirmClassName: PropTypes.string,
    wrapperClassName: PropTypes.string,
    wrapperStyle: PropTypes.object
};

export default ConfirmOverlay;
