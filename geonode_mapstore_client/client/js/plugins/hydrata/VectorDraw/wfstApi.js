import { describeFeatureType, getFeatureSimple } from '../../../../MapStore2/web/client/api/WFS';
import requestBuilder from '../../../../MapStore2/web/client/utils/ogc/WFST/RequestBuilder';
import { fidFilter } from '../../../../MapStore2/web/client/utils/ogc/Filter/filter';
import axios from '../../../../MapStore2/web/client/libs/ajax';

/**
 * TASK-795 — Translate a form's structured Time-boundary `data` value into
 * the per-column WFS-T properties the BE schema expects.
 *
 * The TimeDataPicker compound widget owns the structured shape:
 *   { kind: 'constant',   constant: <Number> }
 *   { kind: 'timeseries', timeseries_id: <Number> }
 *
 * The WFS schema has three relevant columns:
 *   * `data` (legacy text — DEPRECATED for new writes; back-compat reads only)
 *   * `data_constant` (FLOAT, NULL when data_timeseries_id is set)
 *   * `data_timeseries_id` (INTEGER FK, NULL when data_constant is set)
 *
 * BE-side CHECK constraint: when boundary='Time', exactly one of
 * data_constant/data_timeseries_id MUST be non-null. When boundary !== 'Time',
 * BOTH must be null.
 *
 * Wire contract (this function's output):
 *   * boundary !== 'Time' → strip data, data_constant, data_timeseries_id
 *     (BE will see only the_geom + boundary + location + description)
 *   * boundary === 'Time' + kind='constant' → emit data_constant only,
 *     OMIT data + data_timeseries_id
 *   * boundary === 'Time' + kind='timeseries' → emit data_timeseries_id only,
 *     OMIT data + data_constant
 *
 * Pure function — no Redux, no axios. Called from wfstInsert/wfstUpdate
 * before WFS-T transaction build. Re-exported for unit tests.
 */
export const translateTimeBoundaryProperties = (input) => {
    const props = { ...(input || {}) };
    const isTime = props.boundary === 'Time';
    const data = props.data;
    // Always strip the structured shape — it is NOT a wire column.
    delete props.data;
    if (!isTime) {
        // Non-Time boundary types (Reflective / Dirichlet / Transmissive)
        // never carry a data value. Strip all three to be safe — protects
        // against stale formValues from a user toggling boundary type
        // mid-edit (e.g. picked Time, set a constant, then switched back
        // to Reflective without saving in between).
        delete props.data_constant;
        delete props.data_timeseries_id;
        return props;
    }
    // boundary === 'Time'. Translate the structured value into one of the
    // two wire columns. Default to constant when shape is missing or
    // malformed — the BE CHECK will reject a fully-null payload, which
    // surfaces as a save error to the user (correct behaviour: they must
    // pick one).
    if (data && typeof data === 'object') {
        if (data.kind === 'timeseries') {
            const id = data.timeseries_id;
            // Only emit when an id was actually picked; otherwise leave
            // both null so the BE CHECK fires + save returns an error.
            if (id !== null && id !== undefined && id !== '') {
                props.data_timeseries_id = typeof id === 'number' ? id : parseInt(id, 10);
            } else {
                delete props.data_timeseries_id;
            }
            delete props.data_constant;
            return props;
        }
        // Default branch: constant
        const c = data.constant;
        if (c !== null && c !== undefined && c !== '') {
            props.data_constant = typeof c === 'number' ? c : parseFloat(c);
        } else {
            delete props.data_constant;
        }
        delete props.data_timeseries_id;
        return props;
    }
    // Time boundary but no structured value at all — strip the per-column
    // keys so the BE rejects with a CHECK violation (forces the user to
    // pick a value).
    delete props.data_constant;
    delete props.data_timeseries_id;
    return props;
};

/**
 * TASK-795 — Reverse of translateTimeBoundaryProperties for the EDIT-mode
 * seeding path. Given a row's WFS properties (with `data_constant` and/or
 * `data_timeseries_id` populated), synthesize the structured `data` shape
 * the TimeDataPicker reads. Removes the per-column keys to avoid the picker
 * getting confused about which is the source of truth.
 *
 * Pure function. Used by VectorDrawPopup before passing seeded formValues
 * down to FormField.
 */
export const synthesizeTimeBoundaryFormValue = (props) => {
    const out = { ...(props || {}) };
    // Prefer an existing structured `data` value if present — the picker
    // (TimeDataPicker) writes the structured shape on every keystroke /
    // radio change, so once the user has interacted, formValues.data is
    // the source of truth. Synthesis only fires when `data` is absent or
    // a stale text-string from the legacy bare-text-field BE column.
    const hasStructuredData = out.data && typeof out.data === 'object'
        && (out.data.kind === 'constant' || out.data.kind === 'timeseries');
    if (!hasStructuredData) {
        const hasConstant = out.data_constant !== null && out.data_constant !== undefined && out.data_constant !== '';
        const hasTs = out.data_timeseries_id !== null && out.data_timeseries_id !== undefined && out.data_timeseries_id !== '';
        if (hasTs) {
            const id = out.data_timeseries_id;
            out.data = { kind: 'timeseries', timeseries_id: typeof id === 'number' ? id : parseInt(id, 10) };
        } else if (hasConstant) {
            const c = out.data_constant;
            out.data = { kind: 'constant', constant: typeof c === 'number' ? c : parseFloat(c) };
        } else if (typeof out.data === 'string') {
            // Legacy BE row: `data` was a bare text column. Try to parse as
            // a number → constant; otherwise drop (BE will require the user
            // to pick a value via the CHECK constraint).
            const n = parseFloat(out.data);
            if (!Number.isNaN(n) && Number.isFinite(n) && String(n) === out.data.trim()) {
                out.data = { kind: 'constant', constant: n };
            } else {
                // Non-numeric legacy text (e.g. a TimeSeries name) — drop.
                // The user will need to re-pick on next save. Surface as
                // an unset picker rather than auto-stuffing a stale name.
                delete out.data;
            }
        }
    }
    // Strip the per-column keys regardless — the picker is the only thing
    // that should be reading these on the FE side, and it reads via the
    // structured `data` shape.
    delete out.data_constant;
    delete out.data_timeseries_id;
    return out;
};

/**
 * Insert a new feature via WFS-T.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name (e.g. 'geonode:dec_bmp_watershed')
 * @param {object} geometry - GeoJSON geometry object
 * @param {object} properties - Key-value pairs for feature attributes
 * @returns {Promise<string|null>} The FID of the inserted feature
 */
export const wfstInsert = async(wfsUrl, typeName, geometry, properties) => {
    const describe = await describeFeatureType(wfsUrl, typeName);
    const builder = requestBuilder(describe);

    // TASK-795 — Translate the form's structured Time-boundary `data` value
    // into per-column wire properties (data_constant XOR data_timeseries_id).
    // No-op for non-bdy_ layers (boundary key absent → isTime=false → only
    // delete legacy `data` key which won't exist anyway).
    const wireProperties = translateTimeBoundaryProperties(properties);

    const featureObj = {
        type: 'Feature',
        geometry: geometry,
        properties: wireProperties
    };

    // Wrap the synchronous WFS-T body build so a malformed describe (e.g.,
    // missing geometry property → `findGeometryProperty(...).name` throws,
    // or a property descriptor lookup miss → `isGeometryType(undefined)`
    // throws "Cannot read properties of undefined (reading 'type')") surfaces
    // as a meaningful error instead of leaking the raw stack frame to the
    // user's save toast.
    let xml;
    try {
        xml = builder.transaction(builder.insert(featureObj));
    } catch (buildErr) {
        throw new Error(
            `Could not build WFS-T insert for ${typeName} — describe schema may be missing the geometry column. (${buildErr?.message || 'unknown'})`
        );
    }

    const response = await axios.post(wfsUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    // Parse response — check for WFS-T errors before parsing FID
    const responseText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data);

    // Detect GeoServer ExceptionReport
    if (responseText.includes('ExceptionReport') || responseText.includes('ExceptionText')) {
        const errorMatch = responseText.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/);
        const errorMsg = errorMatch ? errorMatch[1].split('\n')[0] : 'WFS-T transaction failed';
        throw new Error(errorMsg);
    }

    // Parse FID from TransactionResponse
    const fidMatch = responseText.match(/fid="([^"]+)"/);
    if (!fidMatch) {
        console.warn('VectorDraw wfstInsert: could not parse FID from response:', responseText.substring(0, 500));
    }
    return fidMatch ? fidMatch[1] : null;
};

/**
 * Update an existing feature via WFS-T.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name
 * @param {string} featureId - The feature ID (e.g. 'layer.42')
 * @param {object} geometry - GeoJSON geometry object
 * @param {object} properties - Key-value pairs for feature attributes
 * @returns {Promise<string>} The feature ID
 */
export const wfstUpdate = async(wfsUrl, typeName, featureId, geometry, properties) => {
    const describe = await describeFeatureType(wfsUrl, typeName);
    const builder = requestBuilder(describe);

    // TASK-795 — Translate Time-boundary structured `data` to wire columns
    // (see wfstInsert + translateTimeBoundaryProperties for full contract).
    const wireProperties = translateTimeBoundaryProperties(properties);

    // Same defensive wrap as wfstInsert — a malformed describe must surface
    // a meaningful error rather than the raw "(reading 'type')" frame.
    let xml;
    try {
        const changes = Object.keys(wireProperties || {}).map(k =>
            builder.propertyChange(k, wireProperties[k])
        );
        if (geometry) {
            changes.push(builder.propertyChange(builder.getPropertyName('geometry'), geometry));
        }
        xml = builder.transaction(builder.update(...changes, fidFilter("ogc", featureId)));
    } catch (buildErr) {
        throw new Error(
            `Could not build WFS-T update for ${typeName} — describe schema may be missing the geometry column. (${buildErr?.message || 'unknown'})`
        );
    }

    await axios.post(wfsUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    return featureId;
};

/**
 * Delete an existing feature via WFS-T.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name
 * @param {string} featureId - The feature ID (e.g. 'layer.42')
 * @returns {Promise<string>} The deleted feature ID
 */
export const wfstDelete = async(wfsUrl, typeName, featureId) => {
    const describe = await describeFeatureType(wfsUrl, typeName);
    const builder = requestBuilder(describe);

    let xml;
    try {
        xml = builder.transaction(builder.deleteByFilter(fidFilter("ogc", featureId)));
    } catch (buildErr) {
        throw new Error(
            `Could not build WFS-T delete for ${typeName}. (${buildErr?.message || 'unknown'})`
        );
    }

    const response = await axios.post(wfsUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    const responseText = typeof response.data === 'string'
        ? response.data
        : new XMLSerializer().serializeToString(response.data);

    if (responseText.includes('ExceptionReport') || responseText.includes('ExceptionText')) {
        const errorMatch = responseText.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/);
        const errorMsg = errorMatch ? errorMatch[1].split('\n')[0] : 'WFS-T delete failed';
        throw new Error(errorMsg);
    }

    return featureId;
};

/**
 * Load an existing feature for editing.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name
 * @param {string} featureId - The feature ID
 * @returns {Promise<object>} GeoJSON feature
 */
export const loadFeature = async(wfsUrl, typeName, featureId) => {
    const result = await getFeatureSimple(wfsUrl, {
        typeName: typeName,
        featureID: featureId,
        srsName: 'EPSG:4326'
    });
    return result?.features?.[0] || null;
};

/**
 * Load all features in a layer (used by the feature-picker phase).
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name
 * @returns {Promise<Array>} Array of GeoJSON features (empty array if none)
 */
export const loadAllFeatures = async(wfsUrl, typeName) => {
    const result = await getFeatureSimple(wfsUrl, {
        typeName: typeName,
        srsName: 'EPSG:4326'
    });
    return result?.features || [];
};
