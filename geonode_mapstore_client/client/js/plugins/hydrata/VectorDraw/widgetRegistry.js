/*
 * TASK-812 (W1.1) — VectorDraw widget registry.
 *
 * Shape-mirror of MapStore2's
 * `web/client/utils/featuregrid/EditorRegistry.jsx` (register/get/getAll/clean)
 * but using ES module named exports to stay consistent with the rest of the
 * VectorDraw plugin (see components/FormField.js for the import style).
 *
 * Unlike the upstream EditorRegistry which keys editor *factories* by
 * `name + type`, this registry keys a single React component by `name`.
 * That's the right shape for our popup-form context: a `field.type` string
 * (e.g. 'text', 'number', 'time-data-picker') maps directly to one widget
 * component which receives `{field, value, onChange, projectId, timeSeriesOptions}`.
 *
 * The 5 default widgets (text/number/checkbox/select/time-data-picker) are
 * registered at module load time inside FormField.js — see the bottom of
 * that file. Callers that want to add a custom widget can import and call
 * `register({name, component})` before any FormField mounts.
 */

let widgets = {};

export const register = ({ name, component }) => {
    if (!name || !component) {
        return;
    }
    widgets[name] = component;
};

export const get = (name) => widgets[name];

export const getAll = () => widgets;

export const clean = () => {
    widgets = {};
};
