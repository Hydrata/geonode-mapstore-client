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

/**
 * How many samples to take along EACH edge of the native bounding rectangle
 * when projecting it into EPSG:3857. Four corners alone are not sufficient in
 * general — UTM -> Web Mercator is not an affine map, so an extreme of the
 * projected region can fall strictly between two corners. Over a domain this
 * size the curvature is negligible, but the sampling costs 4*32 = 128
 * transforms once per mesh load, so there is nothing to buy by cutting it.
 */
const BOUNDS_SAMPLES_PER_EDGE = 32;

/**
 * TASK-2726 (W5.5, epic 2706) — the EPSG:3857 bounding box of a playback
 * store's mesh, for the "zoom to results" control.
 *
 * WHY NOT reprojectMeshVertices(...) THEN min/max: that is the obvious
 * implementation and it is the wrong one HERE. It allocates two Float64Arrays
 * of node length — on the Msimbazi store (3,393,075 nodes) that is 54 MiB held
 * for the lifetime of the run, to answer a question with four numbers in it.
 * Epic 2706 exists to bring playback memory DOWN (AC2a/AC2b are hard byte
 * budgets), so a zoom affordance must not be the thing that adds 54 MiB.
 *
 * This walks nodeX/nodeY once to find the NATIVE bounding rectangle — an O(n)
 * scan with ZERO allocation — and then projects that rectangle's perimeter.
 * Accuracy over a ~3.5 km domain is far inside one metre, i.e. far inside one
 * pixel at any zoom a user can reach.
 *
 * DEVIATION FROM THE CARD, RECORDED DELIBERATELY: TASK-2726's AC3 says the
 * bounds must be "sourced from the already-reprojected x3857/y3857
 * (AnugaPlaybackLayer.js:150)". Those arrays live inside the OL layer, which
 * has no dispatch, and the epic's own copy (getReprojectedMesh) is a LAZY
 * identify-path cache that a zoom button would force to be allocated on every
 * load. Both routes cost the 54 MiB that AC4 ("ZERO NET COST ... no new
 * Float64Array/Float32Array of node length is introduced") forbids. AC3's
 * binding intent — do NOT hand MapStore the store's UTM EPSG as the zoom CRS,
 * and do NOT treat native-CRS numbers as 3857 — is fully honoured: what is
 * published IS EPSG:3857.
 *
 * @param {Float32Array|Float64Array} localX node_x (store-local, schema §2)
 * @param {Float32Array|Float64Array} localY node_y (store-local, schema §2)
 * @param {{epsg: number|string, xllcorner?: number, yllcorner?: number}} georef
 * @returns {[number, number, number, number]|null} [minX, minY, maxX, maxY] in
 *   EPSG:3857, or null when the inputs cannot produce a usable box.
 */
export function reprojectMeshBounds(localX, localY, georef) {
    const { epsg, xllcorner = 0, yllcorner = 0 } = georef || {};
    const sourceEpsg = normalizeEpsgCode(epsg);
    if (!sourceEpsg || !localX || !localY || !localX.length || localX.length !== localY.length) {
        return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < localX.length; i++) {
        const x = localX[i];
        const y = localY[i];
        if (x < minX) { minX = x; }
        if (x > maxX) { maxX = x; }
        if (y < minY) { minY = y; }
        if (y > maxY) { maxY = y; }
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return null;
    }
    const transformer = proj4(sourceEpsg, 'EPSG:3857');
    let outMinX = Infinity;
    let outMinY = Infinity;
    let outMaxX = -Infinity;
    let outMaxY = -Infinity;
    const take = (nx, ny) => {
        const [px, py] = transformer.forward([nx + xllcorner, ny + yllcorner]);
        if (!isFinite(px) || !isFinite(py)) { return; }
        if (px < outMinX) { outMinX = px; }
        if (px > outMaxX) { outMaxX = px; }
        if (py < outMinY) { outMinY = py; }
        if (py > outMaxY) { outMaxY = py; }
    };
    for (let s = 0; s <= BOUNDS_SAMPLES_PER_EDGE; s++) {
        const f = s / BOUNDS_SAMPLES_PER_EDGE;
        const x = minX + (maxX - minX) * f;
        const y = minY + (maxY - minY) * f;
        take(x, minY);   // bottom edge
        take(x, maxY);   // top edge
        take(minX, y);   // left edge
        take(maxX, y);   // right edge
    }
    if (!isFinite(outMinX) || !isFinite(outMinY) || !isFinite(outMaxX) || !isFinite(outMaxY)) {
        return null;
    }
    return [outMinX, outMinY, outMaxX, outMaxY];
}

export default reprojectMeshVertices;
