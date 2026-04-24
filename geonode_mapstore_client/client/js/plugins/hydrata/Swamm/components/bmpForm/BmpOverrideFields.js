import React from "react";
import {
    computePreview,
    isFieldPinned,
    recomputeTotalsForPollutant
} from "../../utils/bmpPreviewMath";

/**
 * The 8 percent-efficiency inputs, laid out in display order.
 * Note: tiled-sediment (s) is intentionally excluded — the model doesn't
 * expose an editable tiled sediment reduction % in this panel. Editing the
 * tiled_s_load_reduction cell in the grid is the only way to override it.
 */
const PERCENT_CELLS = [
    { pathway: 'surface', pollutant: 'n', label: 'Surface Nitrogen Reduction Percentage' },
    { pathway: 'surface', pollutant: 'p', label: 'Surface Phosphorus Reduction Percentage' },
    { pathway: 'surface', pollutant: 's', label: 'Surface Sediment Reduction Percentage' },
    { pathway: 'tiled', pollutant: 'n', label: 'Tiled Nitrogen Reduction Percentage' },
    { pathway: 'tiled', pollutant: 'p', label: 'Tiled Phosphorus Reduction Percentage' },
    { pathway: 'erosion', pollutant: 'n', label: 'Erosion Nitrogen Reduction Percentage' },
    { pathway: 'erosion', pollutant: 'p', label: 'Erosion Phosphorus Reduction Percentage' },
    { pathway: 'erosion', pollutant: 's', label: 'Erosion Sediment Reduction Percentage' }
];

const PINNED_BORDER = '3px solid rgba(120,220,180,0.6)';
const PINNED_STYLE = { opacity: 0.45, borderLeft: PINNED_BORDER };
const PINNED_PLACEHOLDER = 'Overridden — edit to re-enable';
const PINNED_TITLE = 'Load manually overridden. Edit this percentage to recalculate.';

const BmpOverrideFields = ({
    storedBmpForm,
    priorities,
    handleChange,
    updateBmpForm
}) => {
    /**
     * Handle a change to a percent input. Dispatches a compound update that:
     *   1. sets the new percent value
     *   2. NULLs the corresponding *_load_reduction_manual (unpins the cell)
     *   3. applies computePreview to refresh the reduction and new-load cells
     *   4. recomputes the 3 total fields for the affected pollutant
     *
     * This is live preview only — user still has to click Save to persist.
     */
    const handlePercentChange = (pathway, pollutant, event) => {
        if (typeof updateBmpForm !== 'function') {
            // Fallback: defer to the legacy handleChange if the parent hasn't
            // wired updateBmpForm through. Preserves existing save behavior.
            handleChange(event);
            return;
        }
        const rawValue = event.target.value;
        const parsed = parseFloat(rawValue);
        const newPct = Number.isFinite(parsed) ? parsed : 0;
        const percentFieldName = `override_${pollutant}_${pathway}_red_percent`;
        const reductionField = `${pathway}_${pollutant}_load_reduction`;
        const newLoadField = `${pathway}_new_${pollutant}_load`;
        const previousField = `${pathway}_previous_${pollutant}_load`;
        const previous = Number(storedBmpForm?.[previousField]) || 0;
        const { reduction, newLoad } = computePreview(previous, newPct);

        const updates = {
            [percentFieldName]: newPct,
            [`${reductionField}_manual`]: null,
            [reductionField]: reduction,
            [newLoadField]: newLoad
        };
        // Recompute totals for this pollutant using the in-flight updates
        Object.assign(updates, recomputeTotalsForPollutant(storedBmpForm, pollutant, updates));
        updateBmpForm(updates);
    };

    const renderPercentInput = ({ pathway, pollutant, label }) => {
        const percentFieldName = `override_${pollutant}_${pathway}_red_percent`;
        const reductionField = `${pathway}_${pollutant}_load_reduction`;
        const isPinned = isFieldPinned(storedBmpForm, reductionField);
        const storedValue = storedBmpForm?.[percentFieldName];
        const displayValue = storedValue != null
            ? parseFloat(storedValue).toFixed(0)
            : '';
        const containerId = `${pollutant}_${pathway}_red_percent-selector-container`;
        return (
            <div
                key={percentFieldName}
                className={"simple-view-panel-item-row"}
                id={containerId}
                style={isPinned ? { borderLeft: PINNED_BORDER } : undefined}
                title={isPinned ? PINNED_TITLE : undefined}
            >
                <div>{label}</div>
                <input
                    type={"number"}
                    step={1}
                    name={percentFieldName}
                    value={displayValue}
                    onChange={(e) => handlePercentChange(pathway, pollutant, e)}
                    placeholder={isPinned ? PINNED_PLACEHOLDER : "---"}
                    title={isPinned ? PINNED_TITLE : undefined}
                    style={isPinned ? PINNED_STYLE : undefined}
                />
            </div>
        );
    };

    return (
        <React.Fragment>
            <div className={"simple-view-panel-item-row"} id="priority-selector-container">
                <div>
                  BMP Priority
                </div>
                <select
                    id="priority-selector"
                    name="priority"
                    value={storedBmpForm?.priority}
                    onChange={handleChange}
                >
                    {priorities.map((priority) => {
                        return (
                            <option
                                id={priority.id}
                                key={priority.id}
                                value={priority?.value}
                            >
                                {priority.label}
                            </option>
                        );
                    })}
                </select>
            </div>
            {PERCENT_CELLS.map(renderPercentInput)}
            <div className={"simple-view-panel-item-row"} id="override_cost_base-selector-container">
                <div>
                  Base Cost ($)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_base"
                    value={storedBmpForm?.override_cost_base}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="cost_rate_per_footprint_area-selector-container">
                <div>
                  Footprint Cost ($/acre)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_rate_per_footprint_area"
                    value={storedBmpForm?.override_cost_rate_per_footprint_area}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
            <div className={"simple-view-panel-item-row"} id="cost_rate_per_watershed_area-selector-container">
                <div>
                  Watershed Cost ($/acre)
                </div>
                <input
                    type={"number"}
                    step={1}
                    name="override_cost_rate_per_watershed_area"
                    value={storedBmpForm?.override_cost_rate_per_watershed_area}
                    onChange={handleChange}
                    placeholder="---"
                />
            </div>
        </React.Fragment>
    );
};

export { BmpOverrideFields };
