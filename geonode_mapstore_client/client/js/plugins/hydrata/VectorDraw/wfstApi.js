import { describeFeatureType, getFeatureSimple } from '../../../../MapStore2/web/client/api/WFS';
import requestBuilder from '../../../../MapStore2/web/client/utils/ogc/WFST/RequestBuilder';
import { fidFilter } from '../../../../MapStore2/web/client/utils/ogc/Filter/filter';
import axios from '../../../../MapStore2/web/client/libs/ajax';

/**
 * Insert a new feature via WFS-T.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name (e.g. 'geonode:dec_bmp_watershed')
 * @param {object} geometry - GeoJSON geometry object
 * @param {object} properties - Key-value pairs for feature attributes
 * @returns {Promise<string|null>} The FID of the inserted feature
 */
export const wfstInsert = async (wfsUrl, typeName, geometry, properties) => {
    const describe = await describeFeatureType(wfsUrl, typeName);
    const builder = requestBuilder(describe);

    const featureObj = {
        type: 'Feature',
        geometry: geometry,
        properties: properties || {}
    };

    const xml = builder.transaction(builder.insert(featureObj));

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
export const wfstUpdate = async (wfsUrl, typeName, featureId, geometry, properties) => {
    const describe = await describeFeatureType(wfsUrl, typeName);
    const builder = requestBuilder(describe);

    const changes = Object.keys(properties || {}).map(k =>
        builder.propertyChange(k, properties[k])
    );

    if (geometry) {
        changes.push(builder.propertyChange(builder.getPropertyName('geometry'), geometry));
    }

    const xml = builder.transaction(builder.update(...changes, fidFilter("ogc", featureId)));

    await axios.post(wfsUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    return featureId;
};

/**
 * Load an existing feature for editing.
 * @param {string} wfsUrl - The WFS endpoint URL
 * @param {string} typeName - The qualified layer name
 * @param {string} featureId - The feature ID
 * @returns {Promise<object>} GeoJSON feature
 */
export const loadFeature = async (wfsUrl, typeName, featureId) => {
    const result = await getFeatureSimple(wfsUrl, {
        typeName: typeName,
        featureID: featureId,
        srsName: 'EPSG:4326'
    });
    return result?.features?.[0] || null;
};
