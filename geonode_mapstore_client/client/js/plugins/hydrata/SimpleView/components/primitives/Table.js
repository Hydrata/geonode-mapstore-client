import React from 'react';
import PropTypes from 'prop-types';

/**
 * Table — dark-glass data table primitive.
 *
 * Best-of-breed sources:
 *   - `.idf-table` (hydrology.css lines 213-232): width:100%, border-collapse,
 *     bg:white, color:black (chart carve-out: idf table uses light surface)
 *   - `.temporal-pattern-table` (hydrology.css): same pattern as idf-table
 *   - `.time-series-table` (hydrology.css): same family
 *   - `.idf-matrix-table` (hydrology.css): border-collapse, font-size:11px
 *   - `.sv-anuga-built-mesh-roster-table` (anuga.css): width:100%, font-size:11px,
 *     color rgba(255,255,255,0.80), border-collapse
 *   - `.run-server-table` / `.network-table` (anuga.css): margin-bottom:0, text-align:center
 *   - `.hgeval-section .table` (hgeval.css): margin-bottom:0, font-size:12px,
 *     color var(--sv-text)
 *   - `.hgeval-section .table td` (hgeval.css): border-color var(--sv-section-border)
 *
 * Rule-of-three consumers (>= 3 across the 8 panels):
 *   1. Hydrology  — idf-table, temporal-pattern-table, time-series-table, idf-matrix-table
 *   2. Anuga      — sv-anuga-built-mesh-roster-table, run-server-table, network-table
 *   3. HGeval     — hgeval-section .table (results table)
 *   4. Swamm      — swamm network/BMP data tables
 *   5. VectorDraw — attribute popup tables
 *   6. TaskMonitor — sv-tm-subtask-row tabular structure
 * Total: 6 consumers.
 *
 * TWO surface modes:
 *   - 'dark' (default): dark-glass table surface (rgba text on transparent)
 *   - 'light': white table surface (idf-table / chart-adjacent tables)
 *     Use 'light' when the table sits inside a Card variant="chart" or
 *     alongside recharts — same carve-out rationale as Card.
 *
 * Columns are defined via the `columns` prop (array of {key, label, width?} objects).
 * Rows via the `data` prop (array of objects keyed by column.key).
 * Alternatively, render raw JSX children (thead + tbody) for bespoke layouts.
 *
 * Usage:
 *   // Structured form (preferred)
 *   <Table
 *     surface="dark"
 *     columns={[
 *       { key: 'duration', label: 'Duration' },
 *       { key: 'intensity', label: 'Intensity (mm/h)' }
 *     ]}
 *     data={idfRows}
 *   />
 *
 *   // Light surface (IDF-style)
 *   <Table surface="light" columns={cols} data={rows} />
 *
 *   // Raw JSX children for bespoke tables
 *   <Table>
 *     <thead>...</thead>
 *     <tbody>...</tbody>
 *   </Table>
 */

const getTableStyle = (surface, style) => {
    const base = {
        width: '100%',
        borderCollapse: 'collapse',
        borderRadius: 'var(--sv-card-radius, 3px)',
        tableLayout: 'fixed',
        fontSize: '11px'
    };
    if (surface === 'light') {
        return { ...base, background: 'var(--sv-chart-surface, #ffffff)', color: 'black', ...style };
    }
    return { ...base, background: 'transparent', color: 'var(--sv-text, rgba(255, 255, 255, 0.85))', ...style };
};

const getThStyle = (surface) => {
    if (surface === 'light') {
        return {
            backgroundColor: 'var(--sv-input-blue, #5178af)',
            color: 'white',
            textAlign: 'center',
            padding: '2px 4px',
            fontWeight: 600
        };
    }
    return {
        color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.55))',
        fontWeight: 600,
        textAlign: 'left',
        padding: '2px 4px',
        borderBottom: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.12))',
        background: 'rgba(255, 255, 255, 0.06)'
    };
};

const getTdStyle = (surface) => {
    if (surface === 'light') {
        return {
            padding: '2px 4px',
            verticalAlign: 'top',
            border: '1px solid rgba(53, 133, 176, 0.4)'
        };
    }
    return {
        padding: '3px 4px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        fontVariantNumeric: 'tabular-nums',
        verticalAlign: 'middle'
    };
};

const Table = ({
    columns,
    data,
    surface,
    style,
    extraClassName,
    children
}) => {
    const tableStyle = getTableStyle(surface, style);
    const thStyle = getThStyle(surface);
    const tdStyle = getTdStyle(surface);

    const className = 'sv-table' + (surface === 'light' ? ' sv-table--light' : ' sv-table--dark') + (extraClassName ? ' ' + extraClassName : '');

    // If children are provided, use them directly (bespoke table JSX)
    if (children) {
        return (
            <table className={className} style={tableStyle}>
                {children}
            </table>
        );
    }

    // Structured form: columns + data
    if (!columns || columns.length === 0) {
        return null;
    }

    const rows = Array.isArray(data) ? data : [];

    return (
        <table className={className} style={tableStyle}>
            <thead>
                <tr>
                    {columns.map((col) => (
                        <th
                            key={col.key}
                            style={{ ...thStyle, ...(col.width ? { width: col.width } : {}) }}
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td
                            colSpan={columns.length}
                            style={{ ...tdStyle, textAlign: 'center', fontStyle: 'italic', color: 'var(--sv-text-dim, rgba(255,255,255,0.55))' }}
                        >
                            No data
                        </td>
                    </tr>
                ) : rows.map((row, rowIdx) => (
                    <tr key={row.id !== undefined ? row.id : rowIdx}>
                        {columns.map((col) => (
                            <td key={col.key} style={tdStyle}>
                                {row[col.key] !== undefined ? row[col.key] : '—'}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

Table.propTypes = {
    /**
     * Column definitions for the structured form.
     * Each entry: { key: string, label: string, width?: string }
     * Omit when using JSX children directly.
     */
    columns: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.node.isRequired,
        width: PropTypes.string
    })),
    /**
     * Row data objects keyed by column.key.
     * Optional `id` field is used as the React key; falls back to row index.
     */
    data: PropTypes.arrayOf(PropTypes.object),
    /**
     * Surface mode:
     *   - 'dark' (default): dark-glass text on transparent (anuga built-mesh, HGeval results)
     *   - 'light': white bg, dark text (idf-table, temporal-pattern, chart-adjacent tables)
     */
    surface: PropTypes.oneOf(['dark', 'light']),
    /** Inline style pass-through on the <table> element. */
    style: PropTypes.object,
    /** Per-panel variant class carried alongside sv-table. */
    extraClassName: PropTypes.string,
    /** Raw JSX children (thead + tbody). Use instead of columns+data for bespoke tables. */
    children: PropTypes.node
};

Table.defaultProps = {
    surface: 'dark'
};

export {Table};
