import React from "react";
const PropTypes = require('prop-types');
import Message from '@mapstore/framework/components/I18N/Message';

/**
 * TASK-1007 (W3) — Pure presentational replacement for the inline
 * `<div className="menu-row-toolbar">` block in `simpleViewMenuRow.js`
 * (introduced in W2/TASK-1006 as a 4-icon `vis | zoom | edit | delete`
 * locked-order toolbar).
 *
 * The DOM is byte-identical to the W2 inline version (R03 class-name
 * contract): same span class strings, same .menu-row-delete-confirm
 * overlay sibling of the trash glyph. Existing selectors used by
 * `simpleViewMenuRowDelete-test.js` (`.menu-row-delete-confirm
 * .save-confirm-btn.danger`) continue to resolve.
 *
 * Single-instance DOM (R17): when `deleteConfirmVisible` is true the
 * trash action button gets `glyph-hidden` (CSS hidden) but stays in
 * the DOM. The interactive trash carries `.glyph-delete` —
 * `.menu-row-glyph.glyphicon-trash.glyph-delete` matches exactly 1
 * per row. The decorative trash inside `.menu-row-delete-confirm`
 * has neither `.menu-row-glyph` nor `.glyph-delete` so it does NOT
 * collide with selectors used by the delete-test suite (mirrors the
 * pre-W3 inline structure byte-for-byte).
 *
 * No redux: this primitive has no store binding (verified by the
 * AC #6 grep). All wiring is via plain function props supplied by
 * the parent `MenuRow` container, which keeps the VectorDraw 6-action
 * onClick body, perm gating, and bbox-fetch fallback as caller-owned
 * concerns.
 *
 * Props:
 *  - `onEdit`: callback fired when the pencil glyph is clicked. The
 *    container's VectorDraw 6-action onClick body lives there.
 *  - `onDelete`: callback fired when the trash glyph is clicked
 *    (opens the inline confirm overlay; the parent flips
 *    `deleteConfirmVisible` true).
 *  - `onConfirmDelete`: callback fired when the overlay's "Delete"
 *    button is clicked (the actual cascade-delete dispatch).
 *  - `onCancelDelete`: callback fired when the overlay's "Cancel"
 *    button is clicked (the parent flips `deleteConfirmVisible` false).
 */
const LayerActionToolbar = ({
    layer,
    canEditMap,
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
    const canEditAndEdit = canEditMap && canEdit;
    const canEditAndDelete = canEditMap && canDelete;
    return (
        <div className={"menu-row-toolbar"}>
            <span
                className={"btn glyphicon menu-row-glyph " + (layer?.visibility ? "glyphicon-ok glyph-active" : "glyphicon-remove glyph-inactive")}
                onClick={onToggleVisibility}
            />
            <span
                className={"btn glyphicon menu-row-glyph glyphicon-zoom-to glyph-zoom"}
                onClick={onZoom}
            />
            {
                canEditAndEdit ?
                    <span
                        className={"btn glyphicon menu-row-glyph glyphicon-pencil glyph-edit"}
                        onClick={onEdit}
                    /> : null
            }
            {
                canEditAndDelete ?
                    <span
                        className={
                            "btn glyphicon menu-row-glyph glyphicon-trash glyph-delete"
                            + (deleting ? " glyph-disabled" : "")
                            + (deleteConfirmVisible ? " glyph-hidden" : "")
                        }
                        onClick={deleting ? undefined : onDelete}
                        aria-disabled={deleting ? true : undefined}
                    /> : null
            }
            {
                // R04 always-mounted CSS-toggle pattern: confirm overlay stays
                // in the DOM so unit tests can find Delete/Cancel buttons
                // after the first trash click without a setState→re-render
                // flush (react@16.14 / react-dom@16.10 mismatch in
                // Karma+JSDOM). Visibility driven by `is-open` class.
                canEditAndDelete ?
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
    canEditMap: PropTypes.bool,
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
