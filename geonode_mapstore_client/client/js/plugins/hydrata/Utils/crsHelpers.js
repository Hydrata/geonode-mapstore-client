/*
 * CRS helpers for the terrain-upload CRS picker (TASK-1886).
 *
 * Pure / async functions, NO redux. This is the data + detection layer the
 * headline picker (TASK-1880) consumes:
 *   - listUtmWgs84CRS()  feeds the searchable UTM zone list
 *   - utmCodeFromBbox()  computes the project-area UTM shortcut
 *   - detectGeotiffCrs() drives the "require the picker only when the file
 *                        lacks a CRS" trigger
 *
 * The backend (TASK-1885, osr.SetFromUserInput) is the SINGLE authority for the
 * actual code — this module shapes/labels the proj4-provided zone set and
 * detects CRS PRESENCE/ABSENCE robustly; it need not resolve every exotic
 * encoding. CoordinatesUtils + reprojectBbox are imported READ-ONLY from the
 * MapStore2 core; no submodule file is edited.
 */
import CoordinatesUtils, { reprojectBbox } from '../../../../MapStore2/web/client/utils/CoordinatesUtils';
import * as geotiff from 'geotiff';

/**
 * EPSG code of the UTM WGS84 zone containing (lon, lat).
 * zone = floor((lon + 180) / 6) + 1; code = (lat >= 0 ? 32600 : 32700) + zone.
 * @param {number} lon longitude in degrees (WGS84)
 * @param {number} lat latitude in degrees (WGS84)
 * @returns {string} e.g. 'EPSG:32640'
 */
export const utmZoneFromLonLat = (lon, lat) => {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const base = lat >= 0 ? 32600 : 32700;
    return `EPSG:${base + zone}`;
};

/**
 * UTM EPSG code for the centroid of a bbox.
 *
 * The bbox is reprojected to EPSG:4326 first (reusing the reprojectBbox import
 * precedent from demRescaleEpic.js), so a non-4326 source crs is handled.
 * Callers MUST pass the PROJECT AOI / existing-terrain extent — never an
 * un-tagged upload's own bbox, whose CRS is unknown.
 *
 * @param {object} bbox {bounds:{minx,miny,maxx,maxy}, crs} (MapStore bbox shape)
 * @returns {string|null} UTM EPSG code, or null if the bbox is unusable
 */
export const utmCodeFromBbox = (bbox) => {
    if (!bbox || !bbox.bounds) {
        return null;
    }
    const { minx, miny, maxx, maxy } = bbox.bounds;
    if ([minx, miny, maxx, maxy].some((v) => v === undefined || v === null || isNaN(v))) {
        return null;
    }
    const sourceCrs = bbox.crs || 'EPSG:4326';
    let extent4326 = [minx, miny, maxx, maxy];
    if (sourceCrs !== 'EPSG:4326') {
        const reprojected = reprojectBbox([minx, miny, maxx, maxy], sourceCrs, 'EPSG:4326');
        if (!reprojected || reprojected.some((v) => v === null || v === undefined || isNaN(v))) {
            return null;
        }
        extent4326 = reprojected;
    }
    const centroidLon = (extent4326[0] + extent4326[2]) / 2;
    const centroidLat = (extent4326[1] + extent4326[3]) / 2;
    return utmZoneFromLonLat(centroidLon, centroidLat);
};

/**
 * Human-friendly label for a UTM WGS84 EPSG code, e.g.
 * 'EPSG:32640' -> 'UTM Zone 40 N (WGS 84)'.
 * @param {string} code EPSG code in the 326xx / 327xx family
 * @returns {string} friendly label (or the raw code if not a UTM WGS84 code)
 */
const labelForUtmCode = (code) => {
    const m = /^EPSG:(326|327)(\d{2})$/.exec(code);
    if (!m) {
        return code;
    }
    const hemisphere = m[1] === '326' ? 'N' : 'S';
    const zone = parseInt(m[2], 10);
    return `UTM Zone ${zone} ${hemisphere} (WGS 84)`;
};

/**
 * The full UTM WGS84 family (EPSG:326xx northern + EPSG:327xx southern),
 * sourced from CoordinatesUtils.getAvailableCRS() — proj4 auto-registers all
 * 120 zones at import, so NO new EPSG data is needed here. Each entry carries a
 * friendly label.
 * @returns {Array<{code:string, label:string}>} sorted by EPSG code
 */
export const listUtmWgs84CRS = () => {
    const available = CoordinatesUtils.getAvailableCRS() || {};
    return Object.keys(available)
        .filter((code) => /^EPSG:(326|327)\d{2}$/.test(code))
        .sort()
        .map((code) => ({ code, label: labelForUtmCode(code) }));
};

/**
 * ASYNC client-side CRS-presence detector for a GeoTIFF upload.
 *
 * Parses ONLY the GeoTIFF header (geotiff.js does a range read — cheap even for
 * a 500 MB file). Returns:
 *   {hasCrs:true,  epsg:<number>, label}  when a CRS GeoKey resolves
 *   {hasCrs:false, epsg:null,     label:null} when the header carries none
 *   {hasCrs:null,  epsg:null,     label:null} on parse failure / non-TIFF
 *                                              (NEVER throws — the picker falls
 *                                              back to an optional field and
 *                                              never blocks upload).
 *
 * @param {Blob|File} file the upload to inspect
 * @param {function} [parseTiff] GeoTIFF parser (defaults to geotiff.fromBlob);
 *   injectable so callers/tests can supply a stub without mocking the module.
 * @returns {Promise<{hasCrs:(boolean|null), epsg:(number|null), label:(string|null)}>}
 */
export const detectGeotiffCrs = async (file, parseTiff = geotiff.fromBlob) => {
    try {
        const tiff = await parseTiff(file);
        const image = await tiff.getImage();
        const geoKeys = image.getGeoKeys() || {};
        // ProjectedCSTypeGeoKey carries the EPSG for a projected CRS;
        // GeographicTypeGeoKey for a geographic CRS. A user-defined sentinel
        // (32767) means "no resolvable EPSG" — treat as absent.
        const projected = geoKeys.ProjectedCSTypeGeoKey;
        const geographic = geoKeys.GeographicTypeGeoKey;
        const raw = projected || geographic;
        if (raw && raw !== 32767) {
            const epsg = raw;
            return { hasCrs: true, epsg, label: `EPSG:${epsg}` };
        }
        return { hasCrs: false, epsg: null, label: null };
    } catch (e) {
        // Parse failure / non-TIFF — never throw, so the picker degrades to an
        // optional field rather than blocking the upload.
        return { hasCrs: null, epsg: null, label: null };
    }
};
