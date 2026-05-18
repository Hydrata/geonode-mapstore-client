import React from "react";
import PropTypes from 'prop-types';

/**
 * Presentational layer-action toolbar.
 *
 * TASK-1010 W6-polish — the locked 4-icon order is now
 * `vis | zoom | edit | download`. Delete moved out of this primitive and
 * into the secondary toolbar in simpleViewMenuRow (alongside upload), so
 * the trash + delete-confirm overlay are no longer rendered here.
 *
 * Presentation-only; no redux. The container owns dispatch, perm gating,
 * the VectorDraw 6-action onClick body, and the download dispatch —
 * `canEdit` / `canDownload` arrive pre-AND'd from the container.
 */
const MENU_ROW_GLYPH = "btn glyphicon menu-row-glyph";

const LayerActionToolbar = ({
    layer,
    canEdit,
    canDownload,
    onToggleVisibility,
    onZoom,
    onEdit,
    onDownload
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
                canDownload ?
                    <span
                        className={`${MENU_ROW_GLYPH} glyphicon-download glyph-active`}
                        onClick={onDownload}
                    /> : null
            }
        </div>
    );
};

LayerActionToolbar.propTypes = {
    layer: PropTypes.object,
    canEdit: PropTypes.bool,
    canDownload: PropTypes.bool,
    onToggleVisibility: PropTypes.func,
    onZoom: PropTypes.func,
    onEdit: PropTypes.func,
    onDownload: PropTypes.func
};

export {LayerActionToolbar};
