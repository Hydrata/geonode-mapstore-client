import React from "react";
import {Table} from "react-bootstrap";

/**
 * Build the field name for a given pathway, pollutant, and metric.
 * Previous: {pathway}_previous_{pollutant}_load
 * Reduction: {pathway}_{pollutant}_load_reduction
 * New: {pathway}_new_{pollutant}_load
 */
const getFieldName = (pathway, pollutant, metric) => {
    if (metric === 'previous') return `${pathway}_previous_${pollutant}_load`;
    if (metric === 'reduction') return `${pathway}_${pollutant}_load_reduction`;
    return `${pathway}_new_${pollutant}_load`;
};

/**
 * Build the total field name for a given pollutant and metric.
 * Previous: total_previous_{pollutant}_load
 * Reduction: total_{pollutant}_load_reduction
 * New: total_new_{pollutant}_load
 */
const getTotalFieldName = (pollutant, metric) => {
    if (metric === 'previous') return `total_previous_${pollutant}_load`;
    if (metric === 'reduction') return `total_${pollutant}_load_reduction`;
    return `total_new_${pollutant}_load`;
};

/**
 * Parse a field name back into its pathway, pollutant, and metric.
 * e.g. "surface_previous_n_load" -> { pathway: "surface", pollutant: "n", metric: "previous" }
 * e.g. "tiled_p_load_reduction" -> { pathway: "tiled", pollutant: "p", metric: "reduction" }
 * e.g. "erosion_new_s_load" -> { pathway: "erosion", pollutant: "s", metric: "new" }
 */
const parseFieldName = (fieldName) => {
    const pathways = ['surface', 'tiled', 'erosion'];
    for (const pathway of pathways) {
        if (!fieldName.startsWith(pathway + '_')) continue;
        const rest = fieldName.slice(pathway.length + 1);
        if (rest.startsWith('previous_')) {
            const pollutant = rest.replace('previous_', '').replace('_load', '');
            return { pathway, pollutant, metric: 'previous' };
        }
        if (rest.startsWith('new_')) {
            const pollutant = rest.replace('new_', '').replace('_load', '');
            return { pathway, pollutant, metric: 'new' };
        }
        if (rest.endsWith('_load_reduction')) {
            const pollutant = rest.replace('_load_reduction', '');
            return { pathway, pollutant, metric: 'reduction' };
        }
    }
    return null;
};

const PATHWAYS = ['surface', 'tiled', 'erosion'];

const BmpReductionDisplay = ({ storedBmpForm, complexBmpForm, watershedIsFootprint, updateBmpForm, submitBmpForm, projectId }) => {
    const [editingCell, setEditingCell] = React.useState(null);
    const [editValue, setEditValue] = React.useState('');

    const isOverridden = storedBmpForm?.manual_override_loads;

    const commitEdit = (fieldName) => {
        if (!editingCell) return; // Guard against double-commit (Enter fires onKeyDown then unmount fires onBlur)
        const numVal = parseFloat(editValue) || 0;
        const updates = { [fieldName]: numVal, manual_override_loads: true };

        const parsed = parseFieldName(fieldName);
        if (parsed) {
            const { pathway, pollutant, metric } = parsed;

            // Auto-recalculate new_load when editing previous or reduction
            if (metric === 'previous' || metric === 'reduction') {
                const prevField = getFieldName(pathway, pollutant, 'previous');
                const redField = getFieldName(pathway, pollutant, 'reduction');
                const newField = getFieldName(pathway, pollutant, 'new');
                const prevVal = metric === 'previous' ? numVal : (storedBmpForm?.[prevField] || 0);
                const redVal = metric === 'reduction' ? numVal : (storedBmpForm?.[redField] || 0);
                updates[newField] = prevVal - redVal;
            }

            // Recalculate totals for this pollutant/metric
            // Also recalculate total for 'new' if we changed previous or reduction
            const metricsToRecalc = metric === 'previous' || metric === 'reduction'
                ? [metric, 'new']
                : [metric];

            for (const m of metricsToRecalc) {
                const totalField = getTotalFieldName(pollutant, m);
                let total = 0;
                for (const pw of PATHWAYS) {
                    const pwField = getFieldName(pw, pollutant, m);
                    if (updates[pwField] !== undefined) {
                        total += updates[pwField];
                    } else {
                        total += (storedBmpForm?.[pwField] || 0);
                    }
                }
                updates[totalField] = total;
            }
        }

        updateBmpForm(updates);
        setEditingCell(null);
    };

    const handleCellClick = (fieldName, value) => {
        setEditingCell(fieldName);
        setEditValue(value != null ? value.toString() : '0');
    };

    const handleKeyDown = (e, fieldName) => {
        if (e.key === 'Enter') {
            commitEdit(fieldName);
        }
        if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const renderEditableCell = (fieldName, value) => {
        const isEditing = editingCell === fieldName;

        if (isEditing) {
            return (
                <td>
                    <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(fieldName)}
                        onKeyDown={(e) => handleKeyDown(e, fieldName)}
                        autoFocus
                        style={{
                            width: '100%',
                            textAlign: 'right',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.5)',
                            color: 'inherit',
                            padding: '1px 4px',
                            fontSize: 'inherit'
                        }}
                    />
                </td>
            );
        }

        return (
            <td
                onClick={() => handleCellClick(fieldName, value)}
                style={{ cursor: 'pointer' }}
                title="Click to edit"
            >
                {value != null ? parseFloat(value.toPrecision(3)) : '\u2014'}
            </td>
        );
    };

    const renderTotalCell = (fieldName) => {
        const val = storedBmpForm?.[fieldName];
        return (
            <td>{val != null ? parseFloat(val.toPrecision(3)) : '\u2014'}</td>
        );
    };

    if (complexBmpForm) {
        return (
            <React.Fragment>
                <Table
                    condensed
                    bordered
                    hover
                    responsive="sm"
                    className={"text-right"}
                    style={{
                        tableLayout: "fixed",
                        border: "solid 1px rgb(255, 255, 255, 0.2)",
                        borderRadius: "2px"
                    }}
                >
                    <thead>
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <th style={{"width": "30%"}}>Results</th>
                            <th style={{"width": "13%"}}>Surface</th>
                            <th style={{"width": "13%"}}>Tiled</th>
                            <th style={{"width": "13%", "wordBreak": "break-word"}}>Gully/<wbr/>Bank</th>
                            <th style={{"width": "10%"}}>Total</th>
                            {
                                watershedIsFootprint ?
                                    <React.Fragment>
                                        <th style={{"width": "10%"}}>Per Acre</th>
                                        <th style={{"width": "11%"}}/>
                                    </React.Fragment>
                                    :
                                    <th style={{"width": "11%"}}/>
                            }
                        </tr>
                    </thead>
                    <tbody>
                        {/* Nitrogen previous */}
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Nitrogen load previous: </td>
                            {renderEditableCell('surface_previous_n_load', storedBmpForm?.surface_previous_n_load)}
                            {renderEditableCell('tiled_previous_n_load', storedBmpForm?.tiled_previous_n_load)}
                            {renderEditableCell('erosion_previous_n_load', storedBmpForm?.erosion_previous_n_load)}
                            {renderTotalCell('total_previous_n_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_n_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Nitrogen reduction */}
                        <tr>
                            <td>Nitrogen load reduction: </td>
                            {renderEditableCell('surface_n_load_reduction', storedBmpForm?.surface_n_load_reduction)}
                            {renderEditableCell('tiled_n_load_reduction', storedBmpForm?.tiled_n_load_reduction)}
                            {renderEditableCell('erosion_n_load_reduction', storedBmpForm?.erosion_n_load_reduction)}
                            {renderTotalCell('total_n_load_reduction')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_n_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Nitrogen new */}
                        <tr>
                            <td>Nitrogen load new: </td>
                            {renderEditableCell('surface_new_n_load', storedBmpForm?.surface_new_n_load)}
                            {renderEditableCell('tiled_new_n_load', storedBmpForm?.tiled_new_n_load)}
                            {renderEditableCell('erosion_new_n_load', storedBmpForm?.erosion_new_n_load)}
                            {renderTotalCell('total_new_n_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_n_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Phosphorus previous */}
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Phosphorus load previous: </td>
                            {renderEditableCell('surface_previous_p_load', storedBmpForm?.surface_previous_p_load)}
                            {renderEditableCell('tiled_previous_p_load', storedBmpForm?.tiled_previous_p_load)}
                            {renderEditableCell('erosion_previous_p_load', storedBmpForm?.erosion_previous_p_load)}
                            {renderTotalCell('total_previous_p_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_p_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Phosphorus reduction */}
                        <tr>
                            <td>Phosphorus load reduction: </td>
                            {renderEditableCell('surface_p_load_reduction', storedBmpForm?.surface_p_load_reduction)}
                            {renderEditableCell('tiled_p_load_reduction', storedBmpForm?.tiled_p_load_reduction)}
                            {renderEditableCell('erosion_p_load_reduction', storedBmpForm?.erosion_p_load_reduction)}
                            {renderTotalCell('total_p_load_reduction')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_p_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Phosphorus new */}
                        <tr>
                            <td>Phosphorus load new: </td>
                            {renderEditableCell('surface_new_p_load', storedBmpForm?.surface_new_p_load)}
                            {renderEditableCell('tiled_new_p_load', storedBmpForm?.tiled_new_p_load)}
                            {renderEditableCell('erosion_new_p_load', storedBmpForm?.erosion_new_p_load)}
                            {renderTotalCell('total_new_p_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_p_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>lbs/<wbr/>year</td>
                        </tr>
                        {/* Sediment previous */}
                        <tr style={{borderTop: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Sediment load previous: </td>
                            {renderEditableCell('surface_previous_s_load', storedBmpForm?.surface_previous_s_load)}
                            {renderEditableCell('tiled_previous_s_load', storedBmpForm?.tiled_previous_s_load)}
                            {renderEditableCell('erosion_previous_s_load', storedBmpForm?.erosion_previous_s_load)}
                            {renderTotalCell('total_previous_s_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_previous_s_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        {/* Sediment reduction */}
                        <tr>
                            <td>Sediment load reduction: </td>
                            {renderEditableCell('surface_s_load_reduction', storedBmpForm?.surface_s_load_reduction)}
                            {renderEditableCell('tiled_s_load_reduction', storedBmpForm?.tiled_s_load_reduction)}
                            {renderEditableCell('erosion_s_load_reduction', storedBmpForm?.erosion_s_load_reduction)}
                            {renderTotalCell('total_s_load_reduction')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_s_load_reduction / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        {/* Sediment new */}
                        <tr style={{borderBottom: "solid 3px rgb(255, 255, 255, 1)"}}>
                            <td>Sediment load new: </td>
                            {renderEditableCell('surface_new_s_load', storedBmpForm?.surface_new_s_load)}
                            {renderEditableCell('tiled_new_s_load', storedBmpForm?.tiled_new_s_load)}
                            {renderEditableCell('erosion_new_s_load', storedBmpForm?.erosion_new_s_load)}
                            {renderTotalCell('total_new_s_load')}
                            {watershedIsFootprint ?
                                <td>{storedBmpForm?.calculated_footprint_area
                                    ? parseFloat((storedBmpForm?.total_new_s_load / storedBmpForm?.calculated_footprint_area).toPrecision(3))
                                    : '\u2014'}</td>
                                : null
                            }
                            <td className={"text-left"}>tons/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Cost Estimate:</td>
                            {storedBmpForm?.calculated_total_cost ?
                                <td>${Number(storedBmpForm?.calculated_total_cost?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td/>
                        </tr>
                        <tr>
                            <td>Nitrogen reduction value: </td>
                            {storedBmpForm?.total_cost_per_lbs_n_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_lbs_n_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/lb/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Phosphorus reduction value: </td>
                            {storedBmpForm?.total_cost_per_lbs_p_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_lbs_p_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/lb/<wbr/>year</td>
                        </tr>
                        <tr>
                            <td>Sediment reduction value: </td>
                            {storedBmpForm?.total_cost_per_ton_s_reduced ?
                                <td>{Number(storedBmpForm?.total_cost_per_ton_s_reduced?.toFixed(0)).toLocaleString()}</td> :
                                <td/>}
                            <td className={"text-left"}>$/ton/<wbr/>year</td>
                        </tr>
                    </tbody>
                </Table>
                {storedBmpForm?.created_by ?
                    <p>Created by: {storedBmpForm?.created_by} on {new Date(storedBmpForm?.created_at).toLocaleString()}</p> :
                    null
                }
                {storedBmpForm?.updated_by ?
                    <p>Updated by: {storedBmpForm?.updated_by} on {new Date(storedBmpForm?.updated_at).toLocaleString()}</p> :
                    null
                }
                {isOverridden ? (
                    <div style={{marginTop: '8px'}}>
                        <div style={{
                            borderLeft: '3px solid rgba(255,255,255,0.4)',
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            padding: '6px 10px',
                            margin: '6px 0',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: '1.4'
                        }}>
                            Load values have been manually overridden. Reduction percentages are disabled.
                        </div>
                        <button
                            type="button"
                            className="swamm-button"
                            style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                width: '100%',
                                marginLeft: 0,
                                marginRight: 0
                            }}
                            onClick={() => {
                                updateBmpForm({manual_override_loads: false});
                                submitBmpForm({...storedBmpForm, manual_override_loads: false}, projectId);
                            }}
                        >
                            Reset to Calculated Values
                        </button>
                    </div>
                ) : null}
            </React.Fragment>
        );
    }

    return (
        <Table
            bordered
            condensed
            hover
            responsive="sm"
            style={{
                tableLayout: "fixed",
                border: "solid 1px rgb(255, 255, 255, 0.2)",
                borderRadius: "2px"
            }}
            className={"text-right"}
        >
            <thead>
                <tr>
                    <th>Results</th>
                    <th style={{"width": "100px"}}>Total</th>
                    <th/>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Nitrogen load reduction: </td>
                    <td>{storedBmpForm?.total_n_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>lbs/year</td>
                </tr>
                <tr>
                    <td>Phosphorus load reduction: </td>
                    <td>{storedBmpForm?.total_p_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>lbs/year</td>
                </tr>
                <tr>
                    <td>Sediment load reduction: </td>
                    <td>{storedBmpForm?.total_s_load_reduction?.toFixed(0)}</td>
                    <td className={"text-left"}>tons/year</td>
                </tr>
            </tbody>
        </Table>
    );
};

export { BmpReductionDisplay };
