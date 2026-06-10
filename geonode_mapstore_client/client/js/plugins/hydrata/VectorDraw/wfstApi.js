import Rx from 'rxjs';
import { describeFeatureType, getFeatureSimple } from '../../../../MapStore2/web/client/api/WFS';
import requestBuilder from '../../../../MapStore2/web/client/utils/ogc/WFST/RequestBuilder';
import { fidFilter } from '../../../../MapStore2/web/client/utils/ogc/Filter/filter';
import axios from '../../../../MapStore2/web/client/libs/ajax';
import { interceptOGCError } from '../../../../MapStore2/web/client/utils/ObservableUtils';
// Side-effect import: ensures the 'bdy' translator is registered before any
// wfstInsert/wfstUpdate call. boundaryTranslate.js's registerTranslate('bdy', ...)
// fires at module-load time. No `sideEffects: false` in client/package.json
// → webpack preserves this import.
import './boundaryTranslate';
// TASK-850 (W2.3-FE) — Same pattern for the Inflow translator.
// inflowTranslate.js's registerTranslate('inf', ...) fires at module-load
// time so wfstInsert/wfstUpdate on inf_* layers routes through the
// Constant/TimeSeries translateOut instead of the IDENTITY fallback.
import './inflowTranslate';
// TASK-1404 (W2 FE) — Rainfall translator (rai_ prefix). Rainfall shares the
// same FeatureDataMixin wire schema as Inflow (data_constant / data_timeseries_id
// XOR). Without this import the identity fallback stringifies the structured
// `data` object as '[object Object]' and leaves both XOR cols NULL → rai_data_xor
// CHECK violation on every save.
import './rainfallTranslate';
// TASK-1594 (W1) — Culvert translator (cul_ prefix). Culvert has scalar-only
// hydraulic attributes (no compound XOR); translateOut coerces numeric strings
// to floats and synthesizeIn normalises casing. Without this import the identity
// fallback passes string values for numeric fields — the GeoServer featuretype
// expects float precision for invert levels.
import './culvertTranslate';
import { getTranslate, deriveTranslateKey } from './translateRegistry';

/**
 * TASK-810 W0.4 — Throws an Error with the first line of an OGC ExceptionText
 * if `response.data` contains a GeoServer ExceptionReport. Uses MapStore2's
 * upstream `interceptOGCError` so any future OGC schema change is picked up
 * automatically (replaces two hand-rolled <ows:ExceptionText> regex blocks).
 *
 * Pass a `{ data: stringifiedXml }` object — `interceptOGCError` requires
 * `response.data` to be a string (`indexOf("ExceptionReport") > 0`). The
 * `responseText` extraction in `wfstInsert`/`wfstDelete` already produces
 * that string (axios sometimes returns parsed XML).
 *
 * The first-line-only message contract is preserved so the toast UX is
 * unchanged from the pre-W0.4 regex implementation.
 */
const throwIfOGCException = async(response, fallbackMessage) => {
    try {
        await interceptOGCError(Rx.Observable.of(response)).toPromise();
    } catch (ogcErr) {
        const msg = (ogcErr && ogcErr.message ? String(ogcErr.message).split('\n')[0] : '') || fallbackMessage;
        throw new Error(msg);
    }
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

    // TASK-813 (W1.2) — Dispatch through the translate registry. For 'bdy_*'
    // layers this routes to boundaryTranslate.translateOut (the former
    // translateTimeBoundaryProperties — see boundaryTranslate.js). For other
    // prefixes (inf_, fri_, str_, mes_) the unregistered fallback is identity
    // today; W2 will add inflowTranslate.
    const wireProperties = getTranslate(deriveTranslateKey(typeName)).translateOut(properties);

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

    // TASK-810 W0.4 — delegate ExceptionReport detection to MapStore2's
    // upstream interceptOGCError (replaces a hand-rolled <ows:ExceptionText>
    // regex). Pass responseText (string) — axios may return parsed XML.
    await throwIfOGCException({ data: responseText }, 'WFS-T transaction failed');

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

    // TASK-813 (W1.2) — Dispatch through the translate registry. For 'bdy_*'
    // layers this routes to boundaryTranslate.translateOut (the former
    // translateTimeBoundaryProperties — see boundaryTranslate.js). For other
    // prefixes (inf_, fri_, str_, mes_) the unregistered fallback is identity
    // today; W2 will add inflowTranslate.
    const wireProperties = getTranslate(deriveTranslateKey(typeName)).translateOut(properties);

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

    // TASK-810 W0.4 — delegate ExceptionReport detection to MapStore2's
    // upstream interceptOGCError (replaces a hand-rolled <ows:ExceptionText>
    // regex). Pass responseText (string) — axios may return parsed XML.
    await throwIfOGCException({ data: responseText }, 'WFS-T delete failed');

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
