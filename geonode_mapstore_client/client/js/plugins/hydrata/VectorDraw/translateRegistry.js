/*
 * TASK-813 (W1.2) — VectorDraw translate registry.
 *
 * Per-form-shape translators that map between Redux form values (what the
 * picker components write) and WFS-T wire properties (what GeoServer's
 * datastore columns expect). Each translator owns two pure functions:
 *
 *   translateOut(formValues) -> wireProperties   - used on INSERT/UPDATE
 *   synthesizeIn(wireProps)  -> seededFormValues - used on EDIT-load
 *
 * Discriminator: the WFS layer-name prefix (chars before the first
 * underscore, after the optional namespace). Layer prefixes are the
 * existing stable wire identifier for ANUGA feature types — see
 * simpleViewMenuRow.js ANUGA_FEATURE_CONFIG. Using the prefix verbatim
 * keeps the registry decentralised: each feature module
 * (boundaryTranslate.js, future inflowTranslate.js) registers its own
 * key, no central PREFIX_TO_KEY mapping.
 *
 * Unknown keys fall through to an identity pair (translateOut = synthesizeIn
 * = props => props). Wires today were per-form (bdy_ only); without a match
 * the call path is a no-op.
 *
 * Shape-mirrors widgetRegistry.js (TASK-812 W1.1). Two registries because
 * the data shape differs: widgets store a single React component per name;
 * translators store a {translateOut, synthesizeIn} pair per key.
 */
import isFunction from 'lodash/isFunction';

const identity = (props) => props;
const IDENTITY_TRANSLATOR = Object.freeze({
    translateOut: identity,
    synthesizeIn: identity
});

let translators = {};

export const registerTranslate = (key, translator) => {
    if (!key || !translator) {
        return;
    }
    translators[key] = {
        translateOut: isFunction(translator.translateOut) ? translator.translateOut : identity,
        synthesizeIn: isFunction(translator.synthesizeIn) ? translator.synthesizeIn : identity
    };
};

export const getTranslate = (key) => translators[key] || IDENTITY_TRANSLATOR;

export const getAllTranslate = () => translators;

export const cleanTranslate = () => {
    translators = {};
};

/**
 * Derive a translate-registry key from a qualified WFS layer typeName.
 * The key IS the layer-prefix segment before the first underscore (after
 * stripping the optional namespace). E.g.
 *   'geonode:bdy_4_boundary_southsection' -> 'bdy'
 *   'inf_3_inflow_north'                  -> 'inf'
 *   'unknown_layer'                       -> 'unknown'  (caller will get identity)
 *   null / '' / 'no-underscore'           -> null       (caller will get identity)
 *
 * Pure string transform — no Redux, no axios.
 */
export const deriveTranslateKey = (typeName) => {
    if (!typeName || typeof typeName !== 'string') {
        return null;
    }
    const colon = typeName.indexOf(':');
    const local = colon >= 0 ? typeName.substring(colon + 1) : typeName;
    const underscore = local.indexOf('_');
    if (underscore <= 0) {
        return null;
    }
    return local.substring(0, underscore);
};
