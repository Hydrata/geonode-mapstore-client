/*
 * TASK-2008 (epic-2001 W2b) — shared MatrixGrid primitive.
 *
 * A presentational 2-D matrix table (row headers x column headers, with a
 * corner cell) that MIRRORS the IDF-table grid pattern
 * (hydrologyDetailIdfTable.js: <table className="sv-idf-matrix-table"> with a
 * corner cell, column headers, row headers and body cells) for visual parity
 * (UAT req 5) — WITHOUT coupling to the IDF intensity-edit logic (IdfInputCell /
 * commitCell / selectRow/selectCol). It renders whatever each cell's
 * `renderCell` returns, so the Design-Storm derive matrix can drop in tick/cross
 * toggles while any future consumer can render something else.
 *
 * It is deliberately dumb: no internal state, no data shaping. The consumer
 * supplies the axes (rows/cols), a cell renderer, and optional title/className
 * hooks. This keeps the primitive reusable and the design-storm tick semantics
 * (a Set of previewKey strings) entirely in DesignStormDerive.
 */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * @param {object[]} rows      row descriptors; each must carry a unique `key` and a `label`.
 * @param {object[]} cols      column descriptors; each must carry a unique `key` and a `label`.
 * @param {function} renderCell (row, col) => ReactNode for the cell body.
 * @param {node}     cornerLabel content of the top-left corner cell (default empty).
 * @param {string}   className   extra class on the wrapper.
 * @param {string}   tableId     optional id for the <table> (test/QA hook).
 */
const MatrixGrid = ({rows, cols, renderCell, cornerLabel, className, tableId}) => {
    const safeRows = rows || [];
    const safeCols = cols || [];
    return (
        <div className={`sv-idf-matrix-wrapper sv-matrix-grid-wrapper${className ? ' ' + className : ''}`}>
            <table id={tableId} className="sv-idf-matrix-table sv-matrix-grid-table">
                <thead>
                    <tr>
                        <th className="sv-idf-matrix-corner sv-matrix-grid-corner">{cornerLabel || null}</th>
                        {safeCols.map(col => (
                            <th
                                key={col.key}
                                className="sv-idf-matrix-col-header sv-matrix-grid-col-header"
                                title={col.title}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {safeRows.map(row => (
                        <tr key={row.key}>
                            <td
                                className="sv-idf-matrix-row-header sv-matrix-grid-row-header"
                                title={row.title}
                            >
                                {row.label}
                            </td>
                            {safeCols.map(col => (
                                <td
                                    key={col.key}
                                    className="sv-idf-matrix-cell sv-matrix-grid-cell"
                                >
                                    {renderCell(row, col)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

MatrixGrid.propTypes = {
    rows: PropTypes.array,
    cols: PropTypes.array,
    renderCell: PropTypes.func.isRequired,
    cornerLabel: PropTypes.node,
    className: PropTypes.string,
    tableId: PropTypes.string
};

export default MatrixGrid;
