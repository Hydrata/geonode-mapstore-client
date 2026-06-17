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
 * TASK-1010 B2 — `secondaryActions` slot. When non-empty, the primitive
 * renders a sibling `<span className='menu-row-toolbar-secondary'>` block
 * carrying additional glyphs (currently used by simpleViewMenuRow for the
 * always-mounted delete-confirm trigger + upload). Children pass
 * `{glyph, onClick, ariaLabel?, className?, ariaDisabled?}`; the primitive
 * stamps `btn glyphicon menu-row-glyph ${glyph}` and merges optional
 * `className` overrides at the end so callers can layer on
 * `sv-glyph-active` / `sv-glyph-delete` / `sv-glyph-disabled` etc.
 *
 * Custom-content escape hatch (for the delete-confirm overlay which is
 * itself a `<span>` sibling, not a glyph): if a secondary entry includes
 * a `render` function it is invoked and its output is rendered verbatim
 * in place of the auto-stamped glyph span.
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
    onDownload,
    secondaryActions
}) => {
    return (
        <React.Fragment>
            <div className={"menu-row-toolbar"}>
                <span
                    className={`${MENU_ROW_GLYPH} ${layer?.visibility ? "glyphicon-ok sv-glyph-active" : "glyphicon-remove sv-glyph-inactive"}`}
                    onClick={onToggleVisibility}
                />
                <span
                    className={`${MENU_ROW_GLYPH} glyphicon-zoom-to sv-glyph-zoom`}
                    onClick={onZoom}
                />
                {
                    canEdit ?
                        <span
                            className={`${MENU_ROW_GLYPH} glyphicon-pencil sv-glyph-edit`}
                            onClick={onEdit}
                        /> : null
                }
                {
                    canDownload ?
                        <span
                            className={`${MENU_ROW_GLYPH} glyphicon-download sv-glyph-active`}
                            onClick={onDownload}
                        /> : null
                }
            </div>
            {
                (secondaryActions && secondaryActions.length > 0) ?
                    <span className={"menu-row-toolbar-secondary"}>
                        {secondaryActions.map((a, i) => {
                            if (!a) return null;
                            // Custom-content escape hatch — used by the
                            // delete-confirm overlay which is a `<span>`
                            // sibling, not a glyph.
                            if (typeof a.render === 'function') {
                                return (
                                    <React.Fragment key={a.key || `sec-${i}`}>
                                        {a.render()}
                                    </React.Fragment>
                                );
                            }
                            const className = `${MENU_ROW_GLYPH} ${a.glyph}`
                                + (a.className ? ` ${a.className}` : '');
                            return (
                                <span
                                    key={a.key || `sec-${i}`}
                                    className={className}
                                    onClick={a.onClick}
                                    aria-label={a.ariaLabel}
                                    aria-disabled={a.ariaDisabled ? true : undefined}
                                />
                            );
                        })}
                    </span>
                    : null
            }
        </React.Fragment>
    );
};

LayerActionToolbar.propTypes = {
    layer: PropTypes.object,
    canEdit: PropTypes.bool,
    canDownload: PropTypes.bool,
    onToggleVisibility: PropTypes.func,
    onZoom: PropTypes.func,
    onEdit: PropTypes.func,
    onDownload: PropTypes.func,
    secondaryActions: PropTypes.array
};

LayerActionToolbar.defaultProps = {
    secondaryActions: []
};

export {LayerActionToolbar};
