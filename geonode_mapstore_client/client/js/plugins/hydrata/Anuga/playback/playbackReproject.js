/**
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * playbackReproject — pure UTM -> EPSG:3857 mesh-vertex reprojection math
 * (TASK-2626, W2.2, epic 2618). Lives as plain functions (no OL/DOM/Worker
 * globals) so the SAME code runs both inside playbackReproject.worker.js
 * (off the main thread, per the AC) and directly in karma tests.
 *
 * proj4 ships the full UTM WGS84 zone family (EPSG:326xx north / EPSG:327xx
 * south) and EPSG:3857/4326 pre-registered at import — see
 * js/plugins/hydrata/Utils/crsHelpers.js's listUtmWgs84CRS doc: "proj4
 * auto-registers all 120 zones at import, so NO new EPSG data is needed
 * here". Confirmed for this vendored proj4 (2.19.10): `proj4.defs('EPSG:32756')`
 * resolves without any manual proj4.defs() call.
 *
 * CRITICAL georeferencing rule (memory: reference-anuga-sww-georef-
 * xllcorner-not-false-easting): a playback store's node_x/node_y are SWW
 * LOCAL coordinates. The absolute (real-world) UTM position is
 * `local + xllcorner` / `local + yllcorner` — NEVER `+ false_easting` /
 * `+ false_northing` (those are descriptive EPSG constants baked into the
 * SWW as attrs; no ANUGA reader/writer ever adds them to x/y). Most W0
 * corpus SWWs have xllcorner=0 so this bug hides — this module is tested
 * against a NONZERO xllcorner/yllcorner fixture specifically to prove the
 * detector (feedback-prove-the-detector-before-trusting-a-zero).
 */
import proj4 from 'proj4';

/**
 * Normalise an EPSG code (326xx/327xx UTM WGS84 family) to proj4's
 * 'EPSG:<n>' string form. Accepts a number, a bare numeric string, or an
 * already-prefixed string.
 * @param {number|string} epsgCode
 * @returns {string|null} null when the input isn't a plain integer code
 */
export function normalizeEpsgCode(epsgCode) {
    if (epsgCode === null || epsgCode === undefined) {
        return null;
    }
    const match = /^(EPSG:)?(\d+)$/.exec(String(epsgCode).trim());
    return match ? `EPSG:${match[2]}` : null;
}

/**
 * True for a UTM WGS84 EPSG code (326xx northern hemisphere, 327xx southern).
 * @param {number|string} epsgCode
 */
export function isUtmWgs84Epsg(epsgCode) {
    const code = normalizeEpsgCode(epsgCode);
    return !!code && /^EPSG:(326|327)\d{2}$/.test(code);
}

/**
 * Reproject a playback store's local mesh-vertex arrays into EPSG:3857.
 * @param {Float32Array|Float64Array} localX node_x (store-local, schema §2)
 * @param {Float32Array|Float64Array} localY node_y (store-local, schema §2)
 * @param {{epsg: number|string, xllcorner?: number, yllcorner?: number}} georef
 *   `epsg`/`xllcorner`/`yllcorner` as carried in the manifest's
 *   `schema_metadata` (mirrors the store's group zarr.json attrs).
 * @returns {{x: Float64Array, y: Float64Array}}
 */
export function reprojectMeshVertices(localX, localY, georef) {
    const { epsg, xllcorner = 0, yllcorner = 0 } = georef || {};
    const sourceEpsg = normalizeEpsgCode(epsg);
    if (!sourceEpsg) {
        throw new Error(`playbackReproject.reprojectMeshVertices: unusable epsg '${epsg}'`);
    }
    if (localX.length !== localY.length) {
        throw new Error('playbackReproject.reprojectMeshVertices: localX/localY length mismatch');
    }
    const transformer = proj4(sourceEpsg, 'EPSG:3857');
    const n = localX.length;
    const outX = new Float64Array(n);
    const outY = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        // Absolute UTM position = local + ll-corner origin. NEVER + false_easting/northing.
        const absX = localX[i] + xllcorner;
        const absY = localY[i] + yllcorner;
        const [x3857, y3857] = transformer.forward([absX, absY]);
        outX[i] = x3857;
        outY[i] = y3857;
    }
    return { x: outX, y: outY };
}

export default reprojectMeshVertices;
