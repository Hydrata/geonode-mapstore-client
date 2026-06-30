/*
 * TASK (2026-06-23 DataCloneError fix) — Discriminator render/fetch registry.
 *
 * WHY THIS EXISTS
 * ---------------
 * The DiscriminatorPicker choice descriptor used to carry the React render
 * COMPONENT (and an async `fetch` function) inline on each `field.choices[i]`
 * entry, e.g.:
 *
 *     {kind: 'constant',   label: 'Constant',   render: ConstantInput}
 *     {kind: 'timeseries', label: 'TimeSeries', render: TimeSeriesSelect,
 *      fetch: fetchTimeSeries}
 *
 * Those `render` / `fetch` values are FUNCTIONS. The whole field config is
 * embedded in the `formConfig` carried by the `startVectorDraw` Redux action
 * (dispatched from simpleViewMenuRow.onEdit). On PRODUCTION, OpenReplay's
 * session-replay tracker-redux middleware does `Worker.postMessage(action)`
 * for every dispatched action; postMessage uses the structured-clone
 * algorithm, which CANNOT serialize functions. The dispatch therefore threw
 * an uncaught `DataCloneError` ("function ConstantInput(…) could not be
 * cloned"), aborting the describe→draw transition — so the boundary/inflow/
 * rainfall edit pencil looked inert on prod (and only on prod, because
 * OpenReplay's redux capture doesn't run on localhost).
 *
 * THE FIX
 * -------
 * Keep component functions OUT of Redux actions/state. A choice now declares
 * only a serializable `kind` string; the actual render component (and any
 * `fetch` loader) is resolved from THIS registry, keyed by `kind`, at RENDER
 * time inside DiscriminatorPicker — never at action-dispatch time.
 *
 * This mirrors widgetRegistry.js (field `type` -> widget component) but at the
 * choice granularity (choice `kind` -> {render, fetch}).
 *
 * BACK-COMPAT: DiscriminatorPicker still honours an inline `choice.render` /
 * `choice.fetch` when present (the named-export TimeDataPicker path and the
 * existing unit tests inject render components inline). Inline always wins;
 * the registry is the fallback used by the serializable ANUGA formConfigs.
 *
 * The default ANUGA kinds (constant / timeseries) are registered at module
 * load time inside FormField.js — see the bottom of that file — to avoid an
 * import cycle (ConstantInput / TimeSeriesSelect / fetchTimeSeries live in
 * FormField.js).
 */

/*
 * TASK-2016 (epic-1970 W7) — single source of truth for the registry-KIND
 * vocabulary (vocabulary "A"). These are the serializable `kind` strings a
 * DiscriminatorPicker choice declares ({kind: 'timeseries'|'hydrograph'|
 * 'hyetograph'}) and that the inf_/rai_/bdy_ translators emit/recognize on the
 * structured `data` value. They are the choice-discriminator identity ONLY.
 *
 * DO NOT use these for either of the two LOOK-ALIKE vocabularies:
 *   (B) the `series_type` FIELD value on a TimeSeries row ('hydrograph' /
 *       'hyetograph') — that lives in the Hydrology slice (reducersHydrology /
 *       ManualPasteGrid); same strings, different role.
 *   (C) the Hydrology page/category ids ('hydrographs' PLURAL, 'time-series'
 *       HYPHENATED, 'temporal-pattern', 'sv-idf-table').
 * 'hyetograph' is BOTH a registry kind (here) and a series_type value (B) —
 * only the registry-kind role belongs to this constant.
 *
 * NOTE: 'constant' is a registry kind too, but it is OUTSIDE this epic's
 * declared vocabulary-A scope (the three time-series-family kinds) and is left
 * as an inline literal.
 */
export const DISCRIMINATOR_KIND = {
    TIMESERIES: 'timeseries',
    HYDROGRAPH: 'hydrograph',
    HYETOGRAPH: 'hyetograph'
};

let discriminators = {};

// Register a render component (and optional fetch loader) for a discriminator
// `kind`. Last-write-wins so a test/caller can override. Ignores entries with
// no kind or no render component (defensive — mirrors widgetRegistry.register).
export const registerDiscriminator = ({ kind, render, fetch }) => {
    if (!kind || !render) {
        return;
    }
    discriminators[kind] = { render, fetch: typeof fetch === 'function' ? fetch : undefined };
};

// Resolve the {render, fetch} pair for a kind, or undefined if unregistered.
export const getDiscriminator = (kind) => discriminators[kind];

export const getAllDiscriminators = () => discriminators;

export const cleanDiscriminators = () => {
    discriminators = {};
};
