import React from "react";
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';

/**
 * Presentational layer-action toolbar: 4-icon locked-order
 * `vis | zoom | edit | delete` row plus the always-mounted delete-confirm
 * overlay (CSS-toggled via `is-open` for R04 always-in-DOM dialog).
 *
 * Presentation-only; no redux. The container owns dispatch, perm gating,
 * the VectorDraw 6-action onClick body, and the delete-confirm state
 * machine — `canEdit` / `canDelete` arrive pre-AND'd from the container.
 */
const MENU_ROW_GLYPH = "btn glyphicon menu-row-glyph";

const LayerActionToolbar = ({
    layer,
    canEdit,
    canDelete,
    onToggleVisibility,
    onZoom,
    onEdit,
    onDelete,
    onConfirmDelete,
    onCancelDelete,
    deleting,
    deleteConfirmVisible
}) => {
    return (
        <div className={"menu-row-toolbar"}>
            <span
                className={`${MENU_ROW_GLYPH} ${layer?.visibility ? "glyphicon-ok glyph-active" : "glyphicon-remove glyph-inactive"}`}
                onClick={onToggleVisibility}
            />
            <span
                className={`${MENU_ROW_GLYPH} glyphicon-zoom-to glyph-zoom`}
                onClick={onZoom}
            />
            {
                canEdit ?
                    <span
                        className={`${MENU_ROW_GLYPH} glyphicon-pencil glyph-edit`}
                        onClick={onEdit}
                    /> : null
            }
            {
                canDelete ?
                    <span
                        className={
                            `${MENU_ROW_GLYPH} glyphicon-trash glyph-delete`
                            + (deleting ? " glyph-disabled" : "")
                            + (deleteConfirmVisible ? " glyph-hidden" : "")
                        }
                        onClick={deleting ? undefined : onDelete}
                        aria-disabled={deleting ? true : undefined}
                    /> : null
            }
            {
                // R04 always-mounted CSS-toggle: confirm overlay stays in the
                // DOM so unit tests find Delete/Cancel after the first trash
                // click without a setState→re-render flush (react@16.14 vs
                // react-dom@16.10 mismatch under Karma+JSDOM).
                canDelete ?
                    <span
                        className={
                            "menu-row-delete-confirm"
                            + (deleteConfirmVisible ? " is-open" : "")
                        }
                        role="alertdialog"
                        aria-label="Confirm delete"
                        aria-hidden={deleteConfirmVisible ? undefined : true}
                    >
                        <span className="btn glyphicon glyphicon-trash" style={{fontSize: 14}} aria-hidden="true"/>
                        <span className="menu-row-delete-confirm-text">
                            <Message msgId="hydrata.simpleView.confirmDelete"/>
                            {' "'}{layer?.title}{'"?'}
                        </span>
                        <button
                            type="button"
                            className="save-confirm-btn danger"
                            onClick={onConfirmDelete}
                        >
                            <Message msgId="hydrata.simpleView.delete"/>
                        </button>
                        <button
                            type="button"
                            className="save-confirm-btn cancel"
                            onClick={onCancelDelete}
                        >
                            <Message msgId="hydrata.simpleView.cancel"/>
                        </button>
                    </span>
                    : null
            }
        </div>
    );
};

LayerActionToolbar.propTypes = {
    layer: PropTypes.object,
    canEdit: PropTypes.bool,
    canDelete: PropTypes.bool,
    onToggleVisibility: PropTypes.func,
    onZoom: PropTypes.func,
    onEdit: PropTypes.func,
    onDelete: PropTypes.func,
    onConfirmDelete: PropTypes.func,
    onCancelDelete: PropTypes.func,
    deleting: PropTypes.bool,
    deleteConfirmVisible: PropTypes.bool
};

export {LayerActionToolbar};
