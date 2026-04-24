/**
 * Pure helpers for BMP advanced-mode load preview math.
 *
 * Used by BmpReductionDisplay (3x3 grid of editable load cells) and
 * BmpOverrideFields (8 reduction-percentage inputs) to compute client-side
 * previews without waiting for a server round-trip.
 *
 * Field naming convention:
 *   - {pathway}_previous_{pollutant}_load           — baseline load before BMP
 *   - {pathway}_{pollutant}_load_reduction          — calculated/stored reduction value
 *   - {pathway}_{pollutant}_load_reduction_manual   — user-pinned manual override (null = not pinned)
 *   - {pathway}_new_{pollutant}_load                — derived: previous - reduction
 *   - total_{previous,new}_{pollutant}_load, total_{pollutant}_load_reduction
 *   - override_{pollutant}_{pathway}_red_percent    — efficiency percentage override
 *
 * A cell is "pinned" when its paired *_manual field is non-null.
 */

export const PATHWAYS = ['surface', 'tiled', 'erosion'];
export const POLLUTANTS = ['n', 'p', 's'];

/**
 * Compute preview values for a single pathway/pollutant given a previous load
 * and an efficiency percent. Used to render live preview when user types in a
 * percent input without saving.
 *
 * @param {number} previous — previous load (lbs/year or tons/year)
 * @param {number} percent — reduction percentage (0-100)
 * @returns {{reduction: number, newLoad: number}}
 */
export const computePreview = (previous, percent) => {
    const prev = Number(previous) || 0;
    const pct = Number(percent) || 0;
    if (pct === 100) {
        return { reduction: prev, newLoad: 0 };
    }
    const reduction = prev * pct / 100;
    const newLoad = prev - reduction;
    return { reduction, newLoad };
};

/**
 * Is this load-reduction field currently pinned (manually overridden)?
 *
 * @param {Object} storedBmpForm — full form state slice
 * @param {string} fieldName — e.g. 'surface_n_load_reduction'
 * @returns {boolean}
 */
export const isFieldPinned = (storedBmpForm, fieldName) => {
    if (!storedBmpForm || !fieldName) return false;
    const manualVal = storedBmpForm[fieldName + '_manual'];
    return manualVal !== null && manualVal !== undefined;
};

/**
 * Parse a load-reduction field name into its pathway and pollutant parts.
 * Only matches the *_load_reduction form, not *_previous_*_load or *_new_*_load.
 *
 * @param {string} fieldName — e.g. 'surface_n_load_reduction'
 * @returns {{pathway: string, pollutant: string} | null}
 */
export const parseLoadReductionFieldName = (fieldName) => {
    if (!fieldName || typeof fieldName !== 'string') return null;
    for (const pathway of PATHWAYS) {
        const prefix = pathway + '_';
        if (!fieldName.startsWith(prefix)) continue;
        const rest = fieldName.slice(prefix.length);
        const suffix = '_load_reduction';
        if (!rest.endsWith(suffix)) continue;
        const pollutant = rest.slice(0, -suffix.length);
        if (POLLUTANTS.includes(pollutant)) {
            return { pathway, pollutant };
        }
    }
    return null;
};

/**
 * Read the effective value for a load field, preferring (in order):
 *   1. An in-flight update for the _manual field (null = explicit unpin)
 *   2. The stored _manual field when non-null (pinned)
 *   3. The stored calculated field value
 *
 * @param {Object} storedBmpForm
 * @param {Object} updates — partial updates being built
 * @param {string} fieldName — e.g. 'surface_n_load_reduction'
 * @returns {number}
 */
const effectiveLoadValue = (storedBmpForm, updates, fieldName) => {
    const manualKey = fieldName + '_manual';
    const explicitManualUpdate = Object.prototype.hasOwnProperty.call(updates, manualKey);
    // An explicit update for the _manual key (including null) takes precedence
    if (explicitManualUpdate) {
        const u = updates[manualKey];
        if (u !== null && u !== undefined) return Number(u) || 0;
        // explicit null = unpin => skip the stored _manual even if it's non-null,
        // fall through to either updates[fieldName] or the calculated stored value.
    }
    // A directly updated calculated value
    if (Object.prototype.hasOwnProperty.call(updates, fieldName)) {
        return Number(updates[fieldName]) || 0;
    }
    // Pinned in store — but only if not explicitly unpinned in this update batch
    if (!explicitManualUpdate) {
        const pinned = storedBmpForm?.[manualKey];
        if (pinned !== null && pinned !== undefined) return Number(pinned) || 0;
    }
    // Fallback to calculated
    return Number(storedBmpForm?.[fieldName]) || 0;
};

/**
 * Given an in-flight updates object for one pollutant, recompute the three
 * total fields for that pollutant (previous, reduction, new) by summing
 * effective pathway values. Returns a small dict of total-field overrides
 * that the caller should merge into the dispatch payload.
 *
 * @param {Object} storedBmpForm
 * @param {string} pollutant — 'n', 'p', or 's'
 * @param {Object} updates — partial updates being built
 * @returns {Object} — { total_previous_<p>_load, total_<p>_load_reduction, total_new_<p>_load }
 */
export const recomputeTotalsForPollutant = (storedBmpForm, pollutant, updates) => {
    if (!POLLUTANTS.includes(pollutant)) return {};
    const out = {};
    let totalPrevious = 0;
    let totalReduction = 0;
    let totalNew = 0;
    for (const pathway of PATHWAYS) {
        const prevField = `${pathway}_previous_${pollutant}_load`;
        const redField = `${pathway}_${pollutant}_load_reduction`;
        const newField = `${pathway}_new_${pollutant}_load`;

        const prev = Number(
            Object.prototype.hasOwnProperty.call(updates, prevField)
                ? updates[prevField]
                : storedBmpForm?.[prevField]
        ) || 0;
        const red = effectiveLoadValue(storedBmpForm, updates, redField);
        // newLoad prefers explicit update, else derive from prev - red
        const newLoad = Number(
            Object.prototype.hasOwnProperty.call(updates, newField)
                ? updates[newField]
                : (prev - red)
        ) || 0;

        totalPrevious += prev;
        totalReduction += red;
        totalNew += newLoad;
    }
    out[`total_previous_${pollutant}_load`] = totalPrevious;
    out[`total_${pollutant}_load_reduction`] = totalReduction;
    out[`total_new_${pollutant}_load`] = totalNew;
    return out;
};

/**
 * Build an updates object that NULLs all 9 *_load_reduction_manual fields.
 * Used by the "Reset to Calculated Values" button.
 *
 * @returns {Object}
 */
export const buildUnpinAllUpdates = () => {
    const out = {};
    for (const pathway of PATHWAYS) {
        for (const pollutant of POLLUTANTS) {
            out[`${pathway}_${pollutant}_load_reduction_manual`] = null;
        }
    }
    return out;
};
